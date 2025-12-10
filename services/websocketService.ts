// WebSocket Service for real-time simulation
// Connects to Python backend and receives transcripts + audio

// Debug log storage for WebSocket messages
export interface WsDebugLogEntry {
    id: string;
    timestamp: Date;
    direction: 'sent' | 'received';
    raw: string;
    parsed: WebSocketMessage | null;
    error: string | null;
}

const wsDebugLogs: WsDebugLogEntry[] = [];

export const getWsDebugLogs = () => [...wsDebugLogs];
export const clearWsDebugLogs = () => { wsDebugLogs.length = 0; };

// Backend diagnosis item from WebSocket
export interface BackendDiagnosis {
    did: string;
    diagnosis: string;
    indicators_point: string[];
    indicators_count: number;
    probability: 'Low' | 'Medium' | 'High';
    rank: number;
}

// Backend question item from WebSocket
export interface BackendQuestion {
    qid: string;
    role: string;
    content: string;
    score: number;
    rank: number;
    status: 'asked' | 'deleted' | null;
    answer?: string;
}

// Transcript highlight from backend
export interface TranscriptHighlight {
    level: 'warning' | 'info';
    text: string;
}

export interface WebSocketMessage {
    type: 'transcript' | 'audio' | 'system' | 'clinical' | 'diagnosis' | 'questions' | 'turn' | 'start' ;
    speaker?: 'NURSE' | 'PATIENT';
    text?: string;
    message?: string;
    data?: string | BackendDiagnosis[] | BackendQuestion[]; // Can be audio or structured data
    highlights?: TranscriptHighlight[];
    // Legacy clinical data
    diagnosis?: string;
    confidenceScore?: number;
    indicators?: Array<{
        finding: string;
        source: string;
        significance: string;
        patientQuote: string;
    }>;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketCallbacks {
    onTranscript: (speaker: 'NURSE' | 'PATIENT', text: string, highlights?: TranscriptHighlight[]) => void;
    onAudio: (base64Data: string) => void;
    onSystem: (message: string) => void;
    onClinical?: (data: WebSocketMessage) => void;
    onDiagnoses?: (diagnoses: BackendDiagnosis[]) => void;
    onQuestions?: (questions: BackendQuestion[]) => void;
    onTurnCycle?: (status: 'finish cycle' | 'end') => void;
    onStatusChange: (status: ConnectionStatus) => void;
}

// Queued item: transcript paired with when to show it
interface QueuedItem {
    type: 'transcript';
    speaker: 'NURSE' | 'PATIENT';
    text: string;
    highlights?: TranscriptHighlight[];
    showAtTime: number; // AudioContext time when to show this
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private nextStartTime: number = 0;
    private callbacks: WebSocketCallbacks | null = null;
    private backendUrl: string = '';
    
    // Audio-text sync: queue transcripts to show when their audio starts
    private displayQueue: QueuedItem[] = [];
    private syncCheckInterval: ReturnType<typeof setInterval> | null = null;
    
    // Track the last transcript's audio end time so next one waits
    private lastAudioEndTime: number = 0;
    
    // Pending transcript waiting for its audio
    private pendingTranscript: { speaker: 'NURSE' | 'PATIENT'; text: string; highlights?: TranscriptHighlight[]; id?: string } | null = null;
    private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Track if we've already queued the current transcript for display
    private currentTranscriptQueued: boolean = false;
    
    // Track when the current transcript's first audio chunk started
    private currentTranscriptFirstAudioStart: number = 0;
    
    // Map to track audio chunks that arrived before their transcript (by ID)
    private pendingAudioById: Map<string, { startTime: number; endTime: number }> = new Map();
    
    // Store transcript data while waiting for all audio chunks
    private pendingTranscriptData: { speaker: 'NURSE' | 'PATIENT'; text: string; highlights?: TranscriptHighlight[] } | null = null;
    
    // Pending clinical data updates (wait for turn cycle to complete)
    private pendingDiagnoses: BackendDiagnosis[] | null = null;
    private pendingQuestions: BackendQuestion[] | null = null;

    // Initialize with backend URL
    setBackendUrl(url: string) {
        this.backendUrl = url;
    }

    // Set callbacks for handling messages
    setCallbacks(callbacks: WebSocketCallbacks) {
        this.callbacks = callbacks;
    }

    // Initialize audio context (must be called after user interaction)
    async initAudio(): Promise<boolean> {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
                    sampleRate: 24000 
                });
            } else if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            return true;
        } catch (e) {
            console.error("Audio Context Error:", e);
            return false;
        }
    }

    // Connect to WebSocket server
    async connect(patientId: string, gender: string): Promise<boolean> {
        if (!this.backendUrl) {
            console.error("Backend URL not set");
            return false;
        }

        // Initialize audio first
        const audioReady = await this.initAudio();
        if (!audioReady) {
            console.warn("Audio not available, continuing without audio");
        }

        this.callbacks?.onStatusChange('connecting');

        return new Promise((resolve) => {
            try {
                this.socket = new WebSocket(this.backendUrl);

                this.socket.onopen = () => {
                    console.log("WebSocket connected");
                    this.callbacks?.onStatusChange('connected');
                    // Send start command
                    const startCmd = {
                        type: "start",
                        patient_id: patientId,
                        gender: gender
                    };
                    const startCmdString = JSON.stringify(startCmd);
                    wsDebugLogs.push({
                        id: Math.random().toString(36).substr(2, 9),
                        timestamp: new Date(),
                        direction: 'sent',
                        raw: startCmdString,
                        parsed: startCmd as any,
                        error: null
                    });
                    this.socket?.send(startCmdString);
                    this.callbacks?.onSystem("Initializing simulation...");
                    resolve(true);
                };

                this.socket.onmessage = (event) => {
                    // Log raw message for debugging
                    const logEntry: WsDebugLogEntry = {
                        id: Math.random().toString(36).substr(2, 9),
                        timestamp: new Date(),
                        direction: 'received',
                        raw: event.data,
                        parsed: null,
                        error: null
                    };
                    try {
                        logEntry.parsed = JSON.parse(event.data);
                    } catch (e) {
                        logEntry.error = String(e);
                    }
                    wsDebugLogs.push(logEntry);
                    
                    this.handleMessage(event);
                };

                this.socket.onclose = (event) => {
                    console.log("WebSocket closed:", event);
                    this.callbacks?.onStatusChange('disconnected');
                    this.callbacks?.onSystem("Connection closed.");
                };

                this.socket.onerror = (error) => {
                    console.error("WebSocket error:", error);
                    this.callbacks?.onStatusChange('error');
                    resolve(false);
                };
            } catch (e) {
                console.error("WebSocket connection error:", e);
                this.callbacks?.onStatusChange('error');
                resolve(false);
            }
        });
    }

    // Start checking for items ready to display
    private startSyncCheck() {
        if (this.syncCheckInterval) return;
        
        this.syncCheckInterval = setInterval(() => {
            if (!this.audioContext || this.displayQueue.length === 0) return;
            
            const currentTime = this.audioContext.currentTime;
            
            // Only show the FIRST item when its time comes
            if (this.displayQueue[0].showAtTime <= currentTime) {
                const item = this.displayQueue.shift()!;
                if (item.type === 'transcript') {
                    console.log(`[SYNC] ✅ DISPLAYING TRANSCRIPT NOW at ${currentTime.toFixed(2)}s`);
                    console.log(`[SYNC]    - Speaker: ${item.speaker}`);
                    console.log(`[SYNC]    - Text: "${item.text.substring(0, 80)}..."`);
                    console.log(`[SYNC]    - Scheduled for: ${item.showAtTime.toFixed(2)}s`);
                    console.log(`[SYNC]    - Last audio ends: ${this.lastAudioEndTime.toFixed(2)}s`);
                    this.callbacks?.onTranscript(item.speaker, item.text, item.highlights);
                }
            }
        }, 30); // Check every 30ms for tight sync
    }

    private stopSyncCheck() {
        if (this.syncCheckInterval) {
            clearInterval(this.syncCheckInterval);
            this.syncCheckInterval = null;
        }
    }

    // Handle incoming messages
    private handleMessage(event: MessageEvent) {
        try {
            const msg = JSON.parse(event.data);
            
            // Debug: Log every message type received
            console.log(`[WS] 📨 Received message type: "${msg.type}"`, msg.data ? `(data: ${typeof msg.data === 'string' ? msg.data : Array.isArray(msg.data) ? msg.data.length + ' items' : 'object'})` : '');

            switch (msg.type) {
                case 'transcript':
                    if (msg.speaker && msg.text) {
                        const transcriptId = msg.id;
                        
                        // Clear any pending timeout
                        if (this.pendingTimeout) {
                            clearTimeout(this.pendingTimeout);
                            this.pendingTimeout = null;
                        }
                        
                        // Check if audio already arrived for this transcript (by ID)
                        if (transcriptId && this.pendingAudioById.has(transcriptId)) {
                            const audioTiming = this.pendingAudioById.get(transcriptId)!;
                            
                            // Show text AFTER audio finishes
                            const textShowTime = audioTiming.endTime;
                            console.log(`[SYNC] Transcript arrived AFTER audio (id: ${transcriptId}), queuing at ${textShowTime.toFixed(2)}s (audio ends at ${audioTiming.endTime.toFixed(2)}s)`);
                            
                            // Queue transcript to show
                            this.displayQueue.push({
                                type: 'transcript',
                                speaker: msg.speaker,
                                text: msg.text,
                                highlights: msg.highlights,
                                showAtTime: textShowTime
                            });
                            this.startSyncCheck();
                            this.pendingAudioById.delete(transcriptId);
                            break;
                        }
                        
                        // If there's a previous pending transcript that was never shown, clear it
                        if (this.pendingTranscript && !this.currentTranscriptQueued) {
                            console.warn("Clearing unqueued transcript:", this.pendingTranscript.text);
                        }
                        
                        // Clear any pending transcript data from previous message
                        this.pendingTranscriptData = null;
                        
                        // Store new transcript, wait for audio
                        this.pendingTranscript = {
                            speaker: msg.speaker,
                            text: msg.text,
                            highlights: msg.highlights,
                            id: transcriptId
                        };
                        this.currentTranscriptQueued = false; // Reset for new transcript
                        
                        // If no audio comes within 2 seconds, show transcript immediately
                        this.pendingTimeout = setTimeout(() => {
                            if (this.pendingTranscript?.text === msg.text && !this.currentTranscriptQueued) {
                                console.log(`[SYNC] No audio received for transcript, showing immediately`);
                                this.callbacks?.onTranscript(msg.speaker, msg.text, msg.highlights);
                                this.pendingTranscript = null;
                                this.currentTranscriptQueued = false;
                            }
                        }, 2000);
                    }
                    break;

                case 'audio':
                    if (msg.data && typeof msg.data === 'string') {
                        const audioId = msg.id;
                        const { startTime, endTime, isFirstChunkOfTranscript } = this.playPcmAudio(msg.data);
                        this.callbacks?.onAudio(msg.data);
                        
                        // Check if we have a pending transcript with matching ID
                        const hasPendingTranscript = this.pendingTranscript && 
                            (!audioId || !this.pendingTranscript.id || audioId === this.pendingTranscript.id);
                        
                        // If we have a pending transcript AND haven't queued it yet
                        if (hasPendingTranscript && !this.currentTranscriptQueued) {
                            // Clear the fallback timeout
                            if (this.pendingTimeout) {
                                clearTimeout(this.pendingTimeout);
                                this.pendingTimeout = null;
                            }
                            
                            const currentAudioTime = this.audioContext?.currentTime || 0;
                            console.log(`[SYNC] Audio chunk received: start=${startTime.toFixed(2)}s, end=${endTime.toFixed(2)}s, currentTime=${currentAudioTime.toFixed(2)}s`);
                            
                            // Mark as queued but DON'T actually queue yet - wait for all audio chunks
                            this.currentTranscriptQueued = true;
                            
                            // Store the transcript data to queue later
                            this.pendingTranscriptData = {
                                speaker: this.pendingTranscript!.speaker,
                                text: this.pendingTranscript!.text,
                                highlights: this.pendingTranscript!.highlights
                            };
                            this.pendingTranscript = null;
                            
                            console.log(`[SYNC] 📝 Transcript ready, will show after ALL audio chunks finish`);
                        } else if (this.currentTranscriptQueued && this.pendingTranscriptData) {
                            // Additional audio chunks - just log
                            console.log(`[SYNC] Additional audio chunk (ends at ${endTime.toFixed(2)}s)`);
                        } else if (!this.currentTranscriptQueued && audioId) {
                            // Audio arrived BEFORE transcript - store timing info
                            if (!this.pendingAudioById.has(audioId)) {
                                console.log(`[SYNC] Audio arrived BEFORE transcript (id: ${audioId}), storing timing`);
                                this.pendingAudioById.set(audioId, { startTime, endTime });
                            } else {
                                console.log(`[SYNC] Additional audio chunk for id: ${audioId} (ends at ${endTime.toFixed(2)}s)`);
                                // Update the end time for this audio ID
                                this.pendingAudioById.set(audioId, { startTime: this.pendingAudioById.get(audioId)!.startTime, endTime });
                            }
                        }
                        
                        // Always update the end time (for multiple audio chunks of same transcript)
                        this.lastAudioEndTime = endTime;
                        
                        // TRANSCRIPTION MODE: Queue the transcript to show AFTER this audio chunk ends
                        // This handles the case where this is the LAST chunk
                        if (this.pendingTranscriptData) {
                            // Remove any previously queued version of this transcript
                            this.displayQueue = this.displayQueue.filter(item => 
                                !(item.type === 'transcript' && item.text === this.pendingTranscriptData!.text)
                            );
                            
                            // Queue transcript to show after THIS chunk ends
                            const textShowTime = endTime;
                            console.log(`[SYNC] 📝 Updating transcript to show at ${textShowTime.toFixed(2)}s (after current audio chunk)`);
                            
                            this.displayQueue.push({
                                type: 'transcript',
                                ...this.pendingTranscriptData,
                                showAtTime: textShowTime
                            });
                            
                            this.startSyncCheck();
                        }
                    }
                    break;

                case 'system':
                    if (msg.message) {
                        this.callbacks?.onSystem(msg.message);
                    }
                    break;

                case 'clinical':
                    this.callbacks?.onClinical?.(msg);
                    break;

                case 'diagnosis':
                    if (msg.data && Array.isArray(msg.data)) {
                        // Store diagnosis data, don't apply yet - wait for turn cycle
                        console.log('[TURN] ⏸️ Received diagnosis data, STORING (not applying yet)', msg.data.length, 'diagnoses');
                        this.pendingDiagnoses = msg.data as BackendDiagnosis[];
                        console.log('[TURN] ⏸️ Pending diagnoses stored:', this.pendingDiagnoses?.map(d => d.diagnosis));
                    }
                    break;

                case 'questions':
                    if (msg.data && Array.isArray(msg.data)) {
                        // Store questions data, don't apply yet - wait for turn cycle
                        console.log('[TURN] ⏸️ Received questions data, STORING (not applying yet)', msg.data.length, 'questions');
                        this.pendingQuestions = msg.data as BackendQuestion[];
                        console.log('[TURN] ⏸️ Pending questions stored:', this.pendingQuestions?.length);
                    }
                    break;

                case 'turn':
                    // Turn cycle event - schedule clinical data updates AFTER audio finishes
                    if (msg.data === 'finish cycle') {
                        console.log('═══════════════════════════════════════════════════');
                        console.log('[TURN] ✅ Turn cycle FINISHED event received');
                        console.log('[TURN] 📊 Current state:');
                        console.log('  - Has pending diagnoses?', !!this.pendingDiagnoses, this.pendingDiagnoses ? `(${this.pendingDiagnoses.length} items)` : '');
                        console.log('  - Has pending questions?', !!this.pendingQuestions, this.pendingQuestions ? `(${this.pendingQuestions.length} items)` : '');
                        console.log('  - Audio context exists?', !!this.audioContext);
                        
                        // Calculate when the last audio will finish
                        const audioEndTime = this.lastAudioEndTime;
                        const currentTime = this.audioContext?.currentTime || 0;
                        const delayMs = Math.max(0, (audioEndTime - currentTime) * 1000);
                        
                        console.log('[TURN] 🔊 Audio timing:');
                        console.log(`  - Current audio time: ${currentTime.toFixed(2)}s`);
                        console.log(`  - Last audio ends at: ${audioEndTime.toFixed(2)}s`);
                        console.log(`  - Calculated delay: ${delayMs.toFixed(0)}ms`);
                        
                        if (delayMs <= 0) {
                            console.log('[TURN] ⚠️ WARNING: Audio already finished or no audio context!');
                        }
                        
                        console.log(`[TURN] ⏰ Scheduling clinical data update in ${delayMs.toFixed(0)}ms`);
                        console.log('═══════════════════════════════════════════════════');
                        
                        // Store references to pending data (in case they get cleared)
                        const diagnosesToApply = this.pendingDiagnoses;
                        const questionsToApply = this.pendingQuestions;
                        
                        // Schedule the updates to happen AFTER audio finishes
                        setTimeout(() => {
                            console.log('═══════════════════════════════════════════════════');
                            console.log('[TURN] 🎵 TIMEOUT FIRED - Audio should be finished now');
                            console.log('[TURN] 📊 Applying clinical data:');
                            
                            // Apply pending diagnoses
                            if (diagnosesToApply) {
                                console.log(`[TURN] ✅ Applying ${diagnosesToApply.length} diagnoses NOW`);
                                console.log('[TURN] 🎯 Diagnoses:', diagnosesToApply.map(d => d.diagnosis));
                                this.callbacks?.onDiagnoses?.(diagnosesToApply);
                                this.pendingDiagnoses = null;
                            } else {
                                console.log('[TURN] ⚠️ No diagnoses to apply (was null)');
                            }
                            
                            // Apply pending questions
                            if (questionsToApply) {
                                console.log(`[TURN] ✅ Applying ${questionsToApply.length} questions NOW`);
                                this.callbacks?.onQuestions?.(questionsToApply);
                                this.pendingQuestions = null;
                            } else {
                                console.log('[TURN] ⚠️ No questions to apply (was null)');
                            }
                            console.log('═══════════════════════════════════════════════════');
                        }, delayMs);
                        
                        // Notify callback immediately (not delayed)
                        this.callbacks?.onTurnCycle?.('finish cycle');
                        
                    } else if (msg.data === 'end') {
                        console.log('═══════════════════════════════════════════════════');
                        console.log('[TURN] 🏁 Simulation END event received');
                        console.log('[TURN] 🔊 Must wait for all audio to finish before showing "Assessment Complete"');
                        
                        // Calculate when the last audio will finish
                        const audioEndTime = this.lastAudioEndTime;
                        const currentTime = this.audioContext?.currentTime || 0;
                        const delayMs = Math.max(0, (audioEndTime - currentTime) * 1000);
                        
                        console.log('[TURN] 🔊 Audio timing:');
                        console.log(`  - Current audio time: ${currentTime.toFixed(2)}s`);
                        console.log(`  - Last audio ends at: ${audioEndTime.toFixed(2)}s`);
                        console.log(`  - Calculated delay: ${delayMs.toFixed(0)}ms`);
                        console.log(`[TURN] ⏰ Scheduling "end" notification in ${delayMs.toFixed(0)}ms (after audio finishes)`);
                        console.log('═══════════════════════════════════════════════════');
                        
                        // Schedule the "end" notification to happen AFTER audio finishes
                        setTimeout(() => {
                            console.log('═══════════════════════════════════════════════════');
                            console.log('[TURN] 🎵 All audio finished - NOW showing "Assessment Complete"');
                            console.log('[TURN] 🏁 Notifying app that simulation has ended');
                            this.callbacks?.onTurnCycle?.('end');
                            console.log('═══════════════════════════════════════════════════');
                        }, delayMs);
                    }
                    break;

                default:
                    console.log("Unknown message type:", msg);
            }
        } catch (e) {
            console.error("Error parsing message:", e);
        }
    }

    // Play PCM audio (Base64 -> PCM 16-bit -> Float32 -> Web Audio)
    // Returns start time, end time, and whether this is the first chunk of a new transcript
    private playPcmAudio(base64Data: string): { startTime: number; endTime: number; isFirstChunkOfTranscript: boolean } {
        if (!this.audioContext) return { startTime: 0, endTime: 0, isFirstChunkOfTranscript: false };

        try {
            const binaryString = atob(base64Data);
            const len = binaryString.length;

            // Convert binary string to Int16Array (PCM 16-bit Little Endian)
            const int16Data = new Int16Array(len / 2);
            for (let i = 0; i < len; i += 2) {
                const low = binaryString.charCodeAt(i);
                const high = binaryString.charCodeAt(i + 1);
                int16Data[i / 2] = (high << 8) | low;
            }

            // Convert Int16 to Float32 (-1.0 to 1.0)
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            // Create AudioBuffer (Mono, 24kHz)
            const buffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
            buffer.getChannelData(0).set(float32Data);

            // Create and schedule source
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);

            // Sequential playback: wait for previous audio to finish
            const currentTime = this.audioContext.currentTime;
            // Use the later of: current time OR when last audio ends
            const startTime = Math.max(currentTime, this.lastAudioEndTime);
            
            // Check if this is the first chunk of a new transcript
            const isFirstChunkOfTranscript = this.pendingTranscript !== null && !this.currentTranscriptQueued;
            
            source.start(startTime);
            const endTime = startTime + buffer.duration;
            
            // Update for next audio
            this.lastAudioEndTime = endTime;
            this.nextStartTime = endTime;
            
            return { startTime, endTime, isFirstChunkOfTranscript };
        } catch (e) {
            console.error("Audio playback error:", e);
            return { startTime: 0, endTime: 0, isFirstChunkOfTranscript: false };
        }
    }

    // Reset audio timing (for new simulation)
    resetAudioTiming() {
        this.nextStartTime = 0;
        this.lastAudioEndTime = 0;
        this.displayQueue = [];
        this.pendingTranscript = null;
        this.currentTranscriptQueued = false;
        this.currentTranscriptFirstAudioStart = 0;
        this.pendingAudioById.clear();
        this.pendingTranscriptData = null;
        this.pendingDiagnoses = null;
        this.pendingQuestions = null;
        if (this.pendingTimeout) {
            clearTimeout(this.pendingTimeout);
            this.pendingTimeout = null;
        }
    }

    // Disconnect
    disconnect() {
        this.stopSyncCheck();
        if (this.pendingTimeout) {
            clearTimeout(this.pendingTimeout);
            this.pendingTimeout = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        if (this.audioContext) {
            this.audioContext.suspend();
        }
        this.resetAudioTiming();
    }

    // Check if connected
    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}

// Export singleton instance
export const websocketService = new WebSocketService();
