# Turn Cycle Fix - Diagnosis and Questions Update Timing

## Problem
The diagnosis and questions were updating **before** the turn cycle completed, causing them to appear ahead of the conversation context. The backend sends:
- `type: "diagnosis"` with diagnosis data
- `type: "questions"` with questions data  
- `type: "turn"` with `data: "finish cycle"` (after patient answer) or `data: "end"` (simulation end)

Previously, diagnosis and questions were applied immediately when received, but they should wait for the turn cycle to complete.

## Solution

### 1. WebSocket Service Changes (`services/websocketService.ts`)

#### Added Turn Cycle Support
- Added `'turn'` to the `WebSocketMessage` type union
- Added `onTurnCycle` callback to `WebSocketCallbacks` interface
- Added pending data storage:
  ```typescript
  private pendingDiagnoses: BackendDiagnosis[] | null = null;
  private pendingQuestions: BackendQuestion[] | null = null;
  ```

#### Modified Message Handling
- **Diagnosis messages**: Now stored in `pendingDiagnoses` instead of immediately applied
- **Questions messages**: Now stored in `pendingQuestions` instead of immediately applied
- **Turn "finish cycle" messages**: New handler that:
  - Calculates when the last audio will finish (`lastAudioEndTime - currentTime`)
  - Uses `setTimeout` to delay applying pending diagnoses and questions until AFTER audio ends
  - This ensures clinical data updates only after the patient's voice finishes
- **Turn "end" messages**: New handler that:
  - Calculates when the last audio will finish
  - Uses `setTimeout` to delay the "end" notification until AFTER audio ends
  - This ensures "Assessment Complete" only shows after all audio finishes
  - Prevents button status changes before the user hears the final audio

#### Updated Reset Logic
- `resetAudioTiming()` now clears `pendingDiagnoses` and `pendingQuestions`

### 2. App Component Changes (`App.tsx`)

#### Removed Hardcoded Delays
- Removed the 3-second `setTimeout` delays from `onDiagnoses` and `onQuestions` callbacks
- Updates now happen immediately when called (which is after turn cycle completion)

#### Added Turn Cycle Handler
- New `onTurnCycle` callback that:
  - Logs turn cycle events
  - Stops simulation when `status === 'end'`

## Data Flow

### Before Fix
```
1. Backend sends diagnosis → Immediately applied (too early!)
2. Backend sends questions → Immediately applied (too early!)
3. Backend sends turn "finish cycle" → Ignored
4. Patient message appears in UI
```

### After Fix
```
1. Backend sends diagnosis → Stored in pendingDiagnoses
2. Backend sends questions → Stored in pendingQuestions
3. Patient message appears in UI (with audio sync)
4. Backend sends turn "finish cycle" → Calculate audio delay, schedule update
5. Audio plays and finishes
6. After audio ends → Apply pending data NOW ✓
7. Backend sends turn "end" → Calculate audio delay, schedule end notification
8. Final audio plays and finishes
9. After audio ends → Show "Assessment Complete" ✓
```

## Benefits

1. **Audio-First Design**: All UI updates wait for audio to finish - voice is the backbone
2. **Correct Timing**: Diagnosis and questions update only after patient's voice finishes
3. **Context Alignment**: Clinical data always reflects the conversation that's audible
4. **Smooth Completion**: "Assessment Complete" shows only after final audio plays
5. **No Race Conditions**: Eliminates the need for arbitrary delays
6. **Backend Control**: The backend explicitly signals when to update via turn events
7. **Clean Architecture**: Separation between data receipt, audio playback, and data application

## Testing & Debugging

To verify the fix works, open the browser console and look for these log sequences:

### Expected Log Sequence (Correct Behavior)

```
1. [WS] 📨 Received message type: "diagnosis" (data: 2 items)
2. [TURN] ⏸️ Received diagnosis data, STORING (not applying yet) 2 diagnoses
3. [WS] 📨 Received message type: "questions" (data: 5 items)
4. [TURN] ⏸️ Received questions data, STORING (not applying yet) 5 questions
5. [SYNC] ✅ DISPLAYING TRANSCRIPT NOW at X.XXs (PATIENT response appears)
6. [WS] 📨 Received message type: "turn" (data: finish cycle)
7. [TURN] ✅ Turn cycle FINISHED event received
8. [TURN] 🔊 Audio timing: Current: X.XXs, Ends at: Y.YYs, Delay: ZZZms
9. [TURN] ⏰ Scheduling clinical data update in ZZZms
10. ... (wait for audio to finish) ...
11. [TURN] 🎵 TIMEOUT FIRED - Audio should be finished now
12. [TURN] ✅ Applying 2 diagnoses NOW
13. [TURN] 🎯 APP CALLBACK: onDiagnoses called - UPDATING UI NOW
14. [TURN] ✅ Applying 5 questions NOW
15. [TURN] 📋 APP CALLBACK: onQuestions called - UPDATING UI NOW
```

### Key Things to Check

1. **Storage Phase**: Look for ⏸️ emoji - data should be STORED, not applied
2. **Transcript Display**: Patient response should appear BEFORE clinical data updates
3. **Turn Cycle**: Look for the ═══ separator lines showing turn cycle processing
4. **Audio Timing**: Check if delay calculation is correct (should be > 0 if audio is playing)
5. **Timeout Fires**: After the delay, you should see 🎵 and then the updates
6. **App Callbacks**: Finally, 🎯 and 📋 show the UI is actually updating

### Troubleshooting

**If diagnosis/questions update immediately:**
- Check if delay is 0ms (means audio already finished or no audio context)
- Look for ⚠️ warnings about audio timing
- Verify audio chunks are being received before turn cycle event

**If updates never happen:**
- Check if pending data is null when timeout fires
- Look for errors in the setTimeout callback
- Verify turn cycle "finish cycle" event is received

**If audio timing is wrong:**
- Check `lastAudioEndTime` value in logs
- Verify audio chunks are updating this value correctly
- Look at the calculated delay - should match remaining audio duration
