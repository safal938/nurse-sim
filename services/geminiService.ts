
import { GoogleGenAI, Type } from "@google/genai";
import { Message, PatientData, SimulationResponse, ChecklistItem } from "../types";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
console.log("Initializing GoogleGenAI with key:", apiKey ? "Key present" : "No key");
const ai = new GoogleGenAI({ apiKey });

// Debug log storage
export interface DebugLogEntry {
    id: string;
    timestamp: Date;
    turnCount: number;
    request: {
        prompt: string;
        systemInstruction: string;
        model: string;
        config: object;
    };
    response: {
        raw: string | null;
        parsed: SimulationResponse | null;
        error: string | null;
    };
}

const debugLogs: DebugLogEntry[] = [];

export const getDebugLogs = () => [...debugLogs];
export const clearDebugLogs = () => { debugLogs.length = 0; };

const generateSystemInstruction = (patientData: PatientData, currentScenarioId?: string) => {
    // Build the possible scenarios section if dual-scenario mode
    let scenarioSection = '';
    if (patientData.possibleScenarios && patientData.possibleScenarios.length > 0) {
        scenarioSection = `
DUAL-SCENARIO MODE - DIAGNOSTIC UNCERTAINTY (TEMPORARY):
This case starts with TWO possible diagnoses, but MUST converge to ONE by turn 5-6.

POSSIBLE DIAGNOSES:
${patientData.possibleScenarios.map((s, i) => `
${i + 1}. ${s.diagnosis} (ID: ${s.id})
   - Trigger keywords/phrases: ${s.triggerKeywords.join(', ')}
   - Hidden details: ${s.secretDetails}
`).join('')}

CURRENT ACTIVE SCENARIO: ${currentScenarioId || 'UNDETERMINED - will be decided by turn 5'}

MANDATORY CONVERGENCE RULES:
- Turns 1-3: Both diagnoses are possibilities, confidence stays low (15-40%)
- Turn 4-5: Patient MUST reveal the KEY DETAIL that determines the correct diagnosis
- Turn 5+: Once a scenario is chosen, COMMIT to it. No more ambiguity.
- Turn 6-7: Confidence should be 70-90%, diagnosis is CLEAR
- Turn 8: Reach 95%+ confidence and provide closure statement
- NEVER go beyond turn 10. If turn >= 8, force confidence to 95%+

DIAGNOSTIC PIVOT RULES:
- Set "diagnosticPivot: true" ONCE when the diagnosis becomes clear (usually turn 4-5)
- Set "activeScenarioId" to the chosen scenario ID and KEEP IT for all future turns
- After pivot, the diagnosis text should be SPECIFIC (e.g., "Acetaminophen Overdose" not "Possible Overdose")

REALISTIC PATIENT BEHAVIOR:
- Patient reveals the critical detail by turn 4-5 (no more hiding after that)
- Once revealed, patient confirms additional details that support the diagnosis
- Patient should NOT introduce new conflicting information after the pivot
`;
    } else {
        scenarioSection = `
SCENARIO TRUTH (Hidden from Nurse initially): ${patientData.scenarioSecret}
`;
    }

    return `
You are an advanced Clinical Decision Support Simulation Engine. 
Your role is to simulate a conversation between a Nurse (following a protocol) and a Patient (${patientData.patient.name}).
You act as both the generative engine for the conversation AND the CDSS analyzer.

SCENARIO OVERVIEW:
Patient: ${patientData.patient.name}
Date of Birth: ${patientData.patient.date_of_birth} (ALWAYS use this exact date)
Age: ${patientData.patient.age} years old
Sex: ${patientData.patient.sex}
${scenarioSection}

Goal: Track TWO possible diagnoses with separate confidence scores. The primary diagnosis should reach 95% confidence within 8-10 turns.

DUAL DIAGNOSIS OUTPUT:
- Always provide TWO diagnoses: primaryDiagnosis and secondaryDiagnosis
- Each has its own confidence score (0-100) and indicators
- Early turns: both diagnoses may have similar confidence (e.g., 30% vs 25%)
- As evidence emerges: primary pulls ahead, secondary drops
- Final turn: primary should be 95%+, secondary should be low (< 20%)

STRICT PHASING & PACING INSTRUCTIONS (MANDATORY):
- Turn 1-2 (Introduction): Nurse confirms ID. Patient explains chief complaint vaguely.
  -> Both diagnoses: 15-25% confidence each.
- Turn 3-4 (History): Nurse asks about medications, history, timeline. Patient gives hints.
  -> Primary: 35-50%, Secondary: 25-40%.
- Turn 5 (THE REVEAL - CRITICAL): Patient reveals the key detail.
  -> Primary: 60-75%, Secondary drops to 15-30%. Set diagnosticPivot: true.
- Turn 6-7 (Confirmation): Nurse confirms findings.
  -> Primary: 80-92%, Secondary: 10-20%.
- Turn 8 (CLOSURE - MANDATORY): Primary MUST be 95%+, Secondary < 15%.
  -> nurseQuestion MUST be a closure statement, patientReply is brief acknowledgment.

HARD RULES:
- If turn >= 8, confidence MUST be >= 95%
- On the FINAL turn (95%+ confidence), the nurseQuestion MUST be a CLOSURE STATEMENT, not a question
- The closure statement should: thank the patient, summarize next steps, reassure them
- NEVER repeat the same question twice
- NEVER ask vague questions after turn 5
- After turn 5, diagnosis must be SPECIFIC, not "possible" or "suspected"
- The conversation ALWAYS ends with the NURSE speaking (closure), not the patient asking something

CHECKLIST COMPLETION RULES:
- ONLY mark a checklist item complete if the patient's reply DIRECTLY provides the information requested
- For each completed item, provide the SPECIFIC excerpt from patientReply that answers it
- Example: If checklist says "Check for pain/distension" and patient says "My stomach hurts on the right side", 
  return: {id: "c6", answer: "My stomach hurts on the right side"}
- The answer should be a direct quote or paraphrase of what the patient said about THAT specific topic
- Do NOT use the full patientReply - extract only the relevant part
- Be conservative - when in doubt, don't mark it complete yet

DYNAMIC QUESTIONS RULES:
- Add ONLY 1 new dynamic question per response (maximum 2 if case is extremely complex)
- Focus on the MOST important follow-up based on what patient just revealed
- Quality over quantity - one focused question is better than multiple vague ones

DIAGNOSTIC INDICATORS RULES:
- List the KEY clinical findings that support the current diagnosis
- Each indicator should have: finding, source, significance, and patientQuote (the EXACT words the patient said)
- Examples: 
  - {finding: "Jaundice", source: "Patient reported", significance: "high", patientQuote: "My eyes look kind of yellow"}
  - {finding: "Right upper quadrant pain", source: "Patient reported", significance: "high", patientQuote: "My stomach has been hurting, especially on my right side"}
  - {finding: "Medication non-compliance", source: "Patient history", significance: "high", patientQuote: "I stopped taking my prednisone two weeks ago"}
- The patientQuote MUST be a direct quote from what the patient actually said in the conversation
  - {finding: "Recent alcohol binge", source: "Patient history", significance: "high"}
- Update this list each turn as new findings emerge
- High significance = strongly supports diagnosis, Medium = supportive, Low = minor/contextual

OUTPUT FORMAT:
Return JSON only.
`;
};

export const advanceSimulation = async (
    history: Message[],
    patientData: PatientData,
    currentChecklist: ChecklistItem[],
    turnCount: number,
    currentScenarioId?: string
): Promise<SimulationResponse> => {
    
    console.log("API_KEY check:", process.env.API_KEY ? "Found" : "Missing");
    console.log("GEMINI_API_KEY check:", process.env.GEMINI_API_KEY ? "Found" : "Missing");
    
    // Fallback if API fails or for initial testing without key
    if (!process.env.API_KEY && !process.env.GEMINI_API_KEY) {
        console.warn("No API Key found, using mock fallback.");
        return getMockFallback(history, turnCount, patientData);
    }

    try {
        const model = "gemini-2.0-flash-exp";
        
        // Build scenario-aware prompt
        const hasDualScenarios = patientData.possibleScenarios && patientData.possibleScenarios.length > 0;
        const scenarioContext = hasDualScenarios 
            ? `\nPOSSIBLE DIAGNOSES: ${patientData.possibleScenarios!.map(s => s.diagnosis).join(' OR ')}\nCURRENT LEADING SCENARIO: ${currentScenarioId || 'UNDETERMINED'}`
            : '';
        
        // Calculate minimum confidence based on turn
        const getMinConfidence = (turn: number) => {
            if (turn <= 2) return 10;
            if (turn <= 4) return 35;
            if (turn <= 5) return 55;
            if (turn <= 6) return 70;
            if (turn <= 7) return 85;
            return 95; // Turn 8+
        };
        const minConfidence = getMinConfidence(turnCount);
        const shouldClose = turnCount >= 8;

        const prompt = `Turn ${turnCount}${shouldClose ? ' (FINAL TURN - MUST CLOSE)' : ''}

Patient: ${patientData.patient.name}
DOB: ${patientData.patient.date_of_birth}
Age: ${patientData.patient.age}yo ${patientData.patient.sex}
Problems: ${patientData.problem_list.map(p => p.name).join(', ')}${scenarioContext}

PENDING Checklist Items (only these can be marked complete):
${currentChecklist.filter(c => !c.isCompleted).map(c => `[${c.id}] ${c.text}`).join('\n')}

Conversation History:
${history.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}

TURN ${turnCount} REQUIREMENTS:
- Minimum confidence for this turn: ${minConfidence}%
${shouldClose ? `- THIS IS THE FINAL TURN. The nurseQuestion MUST be a CLOSURE STATEMENT (not a question).
- Example closure: "Thank you for sharing all this information with me. I'm going to report these findings to the doctor right away so we can start your treatment. Please rest, and someone will be with you shortly."
- The patientReply should be brief acknowledgment: "Okay, thank you." or "Thanks, nurse."
- Confidence MUST be 95%+.` : ''}
${turnCount === 5 ? '- CRITICAL: Patient should reveal the KEY DETAIL this turn that determines the diagnosis.' : ''}
${turnCount >= 6 && !shouldClose ? '- Diagnosis should be SPECIFIC and CONFIRMED, not vague.' : ''}

CRITICAL INSTRUCTIONS:
1. Generate the next nurse ${shouldClose ? 'CLOSURE STATEMENT' : 'question'} and patient reply
2. ONLY mark checklist items complete if patient DIRECTLY answers them
3. Do NOT repeat questions already asked in conversation history
4. Confidence must be at least ${minConfidence}% this turn
${hasDualScenarios ? `5. DUAL-SCENARIO: Set activeScenarioId when diagnosis becomes clear. Available IDs: ${patientData.possibleScenarios!.map(s => s.id).join(', ')}` : ''}

Generate JSON with TWO diagnoses:
- primaryDiagnosis: {diagnosis, confidenceScore (min ${minConfidence}), indicators: [{finding, source, significance, patientQuote}]}
- secondaryDiagnosis: {diagnosis, confidenceScore, indicators: [{finding, source, significance, patientQuote}]}
- completedChecklistItems: [{id, answer}]
- newDynamicQuestions: []
${hasDualScenarios ? '- activeScenarioId (string), diagnosticPivot (boolean)' : ''}`;

        const diagnosisSchema = {
            type: Type.OBJECT,
            properties: {
                diagnosis: { type: Type.STRING },
                confidenceScore: { type: Type.INTEGER },
                indicators: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            finding: { type: Type.STRING },
                            source: { type: Type.STRING },
                            significance: { type: Type.STRING },
                            patientQuote: { type: Type.STRING }
                        },
                        required: ["finding", "source", "significance", "patientQuote"]
                    }
                }
            },
            required: ["diagnosis", "confidenceScore", "indicators"]
        };

        const responseSchema: any = {
            type: Type.OBJECT,
            properties: {
                nurseQuestion: { type: Type.STRING },
                patientReply: { type: Type.STRING },
                primaryDiagnosis: diagnosisSchema,
                secondaryDiagnosis: diagnosisSchema,
                completedChecklistItems: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            answer: { type: Type.STRING }
                        },
                        required: ["id", "answer"]
                    } 
                },
                newDynamicQuestions: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                }
            },
            required: ["nurseQuestion", "patientReply", "primaryDiagnosis", "secondaryDiagnosis", "completedChecklistItems", "newDynamicQuestions"]
        };

        // Add dual-scenario fields if applicable
        if (hasDualScenarios) {
            responseSchema.properties.activeScenarioId = { type: Type.STRING };
            responseSchema.properties.diagnosticPivot = { type: Type.BOOLEAN };
        }

        const systemInstruction = generateSystemInstruction(patientData, currentScenarioId);
        const config = {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 1.0,
            maxOutputTokens: 1000
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config
        });

        const debugEntry: DebugLogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            turnCount,
            request: {
                prompt,
                systemInstruction,
                model,
                config: { ...config, systemInstruction: '[see above]' }
            },
            response: {
                raw: response.text || null,
                parsed: null,
                error: null
            }
        };

        if (response.text) {
            const parsed = JSON.parse(response.text) as SimulationResponse;
            debugEntry.response.parsed = parsed;
            debugLogs.push(debugEntry);
            return parsed;
        }
        
        debugEntry.response.error = "Empty response from Gemini";
        debugLogs.push(debugEntry);
        throw new Error("Empty response from Gemini");

    } catch (error) {
        console.error("Gemini API Error:", error);
        
        // Log the error
        const errorEntry: DebugLogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            turnCount,
            request: { prompt: 'Error occurred before request completed', systemInstruction: '', model: '', config: {} },
            response: { raw: null, parsed: null, error: String(error) }
        };
        debugLogs.push(errorEntry);
        
        return getMockFallback(history, turnCount, patientData);
    }
};

// Fallback logic adjusted for pacing
const getMockFallback = (_history: Message[], turnCount: number, patientData: PatientData): SimulationResponse => {
    const scenarios = patientData.possibleScenarios || [];
    const diag1 = scenarios[0]?.diagnosis || "Condition A";
    const diag2 = scenarios[1]?.diagnosis || "Condition B";
    
    // Simple deterministic sequence based on turn count
    if (turnCount <= 2) {
        return {
            nurseQuestion: `Good morning. Can you confirm your full name and date of birth?`,
            patientReply: `${patientData.patient.name}, ${patientData.patient.date_of_birth}... I don't feel good.`,
            primaryDiagnosis: {
                diagnosis: diag1,
                confidenceScore: 20,
                indicators: [{ finding: "General malaise", source: "Patient reported", significance: "low" as const, patientQuote: "I don't feel good." }]
            },
            secondaryDiagnosis: {
                diagnosis: diag2,
                confidenceScore: 18,
                indicators: [{ finding: "Vague symptoms", source: "Patient reported", significance: "low" as const, patientQuote: "I don't feel good." }]
            },
            completedChecklistItems: [{ id: 'start_1', answer: `${patientData.patient.name}, ${patientData.patient.date_of_birth}` }],
            newDynamicQuestions: []
        };
    } else {
         return {
            nurseQuestion: "Can you tell me more about your symptoms?",
            patientReply: "My stomach hurts and I feel nauseous.",
            primaryDiagnosis: {
                diagnosis: diag1,
                confidenceScore: 35,
                indicators: [
                    { finding: "Abdominal pain", source: "Patient reported", significance: "medium" as const, patientQuote: "My stomach hurts" },
                    { finding: "Nausea", source: "Patient reported", significance: "medium" as const, patientQuote: "I feel nauseous" }
                ]
            },
            secondaryDiagnosis: {
                diagnosis: diag2,
                confidenceScore: 28,
                indicators: [{ finding: "GI symptoms", source: "Patient reported", significance: "low" as const, patientQuote: "My stomach hurts" }]
            },
            completedChecklistItems: [{ id: 'c6', answer: "My stomach hurts" }],
            newDynamicQuestions: []
        };
    }
};
