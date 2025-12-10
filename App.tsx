
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PatientInfo from './components/PatientInfo';
import ChatInterface from './components/ChatInterface';
import ClinicalDashboard from './components/ClinicalDashboard';
import ScenarioSelector from './components/ScenarioSelector';
import DebugPanel from './components/DebugPanel';
import { advanceSimulation } from './services/geminiService';
import { websocketService, ConnectionStatus, BackendDiagnosis, BackendQuestion } from './services/websocketService';
import { INITIAL_PATIENT_DATA, INITIAL_CHECKLIST, SCENARIOS } from './constants';
import { Message, ChecklistItem, PatientData, DiagnosisOption } from './types';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Backend WebSocket URL - change this to your Python backend
// const WEBSOCKET_URL = "wss://clinic-hepa-backend-481780815788.us-central1.run.app/ws/simulation";
const WEBSOCKET_URL = "wss://clinic-hepa-backend-481780815788.us-central1.run.app/ws/simulation";

// Mode: 'websocket' for real backend, 'gemini' for direct Gemini API
type SimulationMode = 'websocket' | 'gemini';
const SIMULATION_MODE = 'websocket' as SimulationMode; // Change to 'websocket' when backend is ready

const App: React.FC = () => {
    // Navigation State
    const [currentView, setCurrentView] = useState<'dashboard' | 'selector'>('selector');

    // Patient & Chat State
    const [patientData, setPatientData] = useState<PatientData>(INITIAL_PATIENT_DATA);
    const [messages, setMessages] = useState<Message[]>([]);
    
    // Clinical Dashboard State - Dual Diagnosis
    const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
    const [primaryDiagnosis, setPrimaryDiagnosis] = useState<DiagnosisOption>({ diagnosis: "Pending Assessment...", confidenceScore: 0, indicators: [] });
    const [secondaryDiagnosis, setSecondaryDiagnosis] = useState<DiagnosisOption>({ diagnosis: "Pending Assessment...", confidenceScore: 0, indicators: [] });
    const [activeScenarioId, setActiveScenarioId] = useState<string | undefined>(undefined);
    const [diagnosticPivotOccurred, setDiagnosticPivotOccurred] = useState<boolean>(false);
    
    // UI State
    const [isSimulationActive, setIsSimulationActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    
    // WebSocket setup ref to prevent re-initialization
    const wsInitialized = useRef(false);
    
    // Timer State (10 minutes = 600 seconds)
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [timerStarted, setTimerStarted] = useState(false);
    


    const handleSelectScenario = (scenario: PatientData) => {
        setPatientData(scenario);
        // Reset Simulation State
        setMessages([]);
        setChecklist(INITIAL_CHECKLIST);
        setPrimaryDiagnosis({ diagnosis: "Pending Assessment...", confidenceScore: 0, indicators: [] });
        setSecondaryDiagnosis({ diagnosis: "Pending Assessment...", confidenceScore: 0, indicators: [] });
        setActiveScenarioId(undefined);
        setDiagnosticPivotOccurred(false);
        setIsSimulationActive(false);
        setElapsedTime(0);
        setTimerStarted(false);
        setCurrentView('dashboard');
    };

    // Helper: Convert backend probability to confidence score
    // Helper: Calculate confidence score based on indicators_count
    // More indicators = higher confidence
    const calculateConfidenceScore = (indicatorsCount: number): number => {
        // Scale indicators to percentage (assuming max ~10 indicators = 100%)
        // You can adjust this formula based on your needs
        const baseScore = Math.min(indicatorsCount * 10, 95); // Cap at 95%
        const variance = Math.random() * 5; // Add small variance for realism
        return Math.round(Math.max(baseScore + variance, 10)); // Minimum 10%
    };

    // Helper: Convert backend diagnosis to frontend format
    const transformDiagnosis = (diag: BackendDiagnosis): DiagnosisOption => ({
        diagnosis: diag.diagnosis,
        confidenceScore: calculateConfidenceScore(diag.indicators_count),
        indicators: diag.indicators_point.map(point => ({
            finding: point,
            source: 'Patient reported',
            significance: diag.indicators_count >= 5 ? 'high' : diag.indicators_count >= 3 ? 'medium' : 'low' as const,
            patientQuote: point
        }))
    });

    // Helper: Convert backend questions to checklist items
    const transformQuestions = (questions: BackendQuestion[]): ChecklistItem[] => {
        return questions
            .filter(q => q.status !== 'deleted') // Exclude deleted questions
            .map(q => ({
                id: q.qid,
                text: q.content,
                isCompleted: q.status === 'asked',
                category: q.qid.startsWith('0000') ? 'fixed' : 'dynamic' as const,
                answer: q.status === 'asked' ? (q.answer || 'Asked') : undefined
            }));
    };

    // WebSocket mode: Setup callbacks
    useEffect(() => {
        if (SIMULATION_MODE !== 'websocket' || wsInitialized.current) return;
        
        websocketService.setBackendUrl(WEBSOCKET_URL);
        websocketService.setCallbacks({
            onTranscript: (speaker, text, highlights) => {
                const role = speaker === 'NURSE' ? 'nurse' : 'patient';
                const newMsg: Message = {
                    id: generateId(),
                    role,
                    text,
                    timestamp: new Date(),
                    highlights: highlights
                };
                setMessages(prev => [...prev, newMsg]);
            },
            onAudio: (_base64Data) => {
                // Audio is played automatically by the service
                console.log("Audio chunk received");
            },
            onSystem: (message) => {
                console.log("System:", message);
            },
            onClinical: (data) => {
                // Legacy clinical data handler
                if (data.diagnosis && data.confidenceScore !== undefined) {
                    setPrimaryDiagnosis({
                        diagnosis: data.diagnosis,
                        confidenceScore: data.confidenceScore,
                        indicators: data.indicators || []
                    });
                }
            },
            onDiagnoses: (diagnoses: BackendDiagnosis[]) => {
                console.log("[TURN] 🎯 APP CALLBACK: onDiagnoses called - UPDATING UI NOW");
                console.log("[TURN] 🎯 Received", diagnoses.length, "diagnoses");
                
                // Sort by indicators_count (highest first)
                const sorted = [...diagnoses].sort((a, b) => b.indicators_count - a.indicators_count);
                
                if (sorted.length > 0) {
                    console.log(`[TURN] 🎯 Setting Primary: ${sorted[0].diagnosis} (${sorted[0].indicators_count} indicators)`);
                    setPrimaryDiagnosis(transformDiagnosis(sorted[0]));
                }
                if (sorted.length > 1) {
                    console.log(`[TURN] 🎯 Setting Secondary: ${sorted[1].diagnosis} (${sorted[1].indicators_count} indicators)`);
                    setSecondaryDiagnosis(transformDiagnosis(sorted[1]));
                }
            },
            onQuestions: (questions: BackendQuestion[]) => {
                console.log("[TURN] 📋 APP CALLBACK: onQuestions called - UPDATING UI NOW");
                console.log("[TURN] 📋 Received", questions.length, "questions");
                
                const transformed = transformQuestions(questions);
                console.log(`[TURN] 📋 Transformed questions:`, transformed.map(q => ({ 
                    id: q.id, 
                    text: q.text.substring(0, 50), 
                    completed: q.isCompleted 
                })));
                
                // Replace the entire checklist with backend state
                // Backend sends complete state, not incremental updates
                setChecklist(transformed);
            },
            onTurnCycle: (status) => {
                console.log(`[TURN] Turn cycle event: ${status}`);
                if (status === 'end') {
                    // Simulation ended by backend
                    setIsSimulationActive(false);
                }
            },
            onStatusChange: (status) => {
                setConnectionStatus(status);
                if (status === 'disconnected' || status === 'error') {
                    setIsSimulationActive(false);
                }
            }
        });
        
        wsInitialized.current = true;
    }, []);

    // WebSocket mode: Start/Stop simulation
    const startWebSocketSimulation = async () => {
        // Reset audio timing before starting new simulation
        websocketService.resetAudioTiming();
        const connected = await websocketService.connect(patientData.patient_id, patientData.gender);
        if (connected) {
            setIsSimulationActive(true);
            setTimerStarted(true);
        }
    };

    const stopWebSocketSimulation = () => {
        websocketService.disconnect();
        setIsSimulationActive(false);
    };

    // Gemini mode: Run simulation step
    const runSimulationStep = useCallback(async () => {
        if (isProcessing) return;

        // No hard limit on turns - let confidence score determine when to stop

        setIsProcessing(true);

        try {
            // Calculate current turn number (1 pair of messages = 1 turn)
            const turnCount = Math.floor(messages.length / 2) + 1;

            const result = await advanceSimulation(
                messages,
                patientData,
                checklist,
                turnCount,
                activeScenarioId
            );

            // 1. Add Nurse Question
            const nurseMsg: Message = { 
                id: generateId(), 
                role: 'nurse', 
                text: result.nurseQuestion, 
                timestamp: new Date() 
            };
            setMessages(prev => [...prev, nurseMsg]);
            
            // Natural delay based on message length (reading time)
            const nurseReadTime = Math.min(Math.max(result.nurseQuestion.length * 20, 800), 2000);
            await new Promise(r => setTimeout(r, nurseReadTime));

            // 2. Add Patient Reply
            const patientMsg: Message = { 
                id: generateId(), 
                role: 'patient', 
                text: result.patientReply, 
                timestamp: new Date() 
            };
            setMessages(prev => [...prev, patientMsg]);

            // 3. Update Clinical Dashboard - Dual Diagnosis
            setPrimaryDiagnosis(result.primaryDiagnosis);
            setSecondaryDiagnosis(result.secondaryDiagnosis);
            
            // 3a. Handle diagnostic pivot (dual-scenario mode)
            if (result.activeScenarioId) {
                setActiveScenarioId(result.activeScenarioId);
            }
            if (result.diagnosticPivot) {
                setDiagnosticPivotOccurred(true);
                console.log("🔄 DIAGNOSTIC PIVOT: Primary diagnosis is now", result.primaryDiagnosis.diagnosis);
            }

            // 4. Update Checklist 
            // Only update items that are NOT already completed to preserve original answers
            if (result.completedChecklistItems && result.completedChecklistItems.length > 0) {
                console.log("Marking complete:", result.completedChecklistItems);
                setChecklist(prev => prev.map(item => {
                    // Find if this item was completed in this turn
                    const completedItem = result.completedChecklistItems.find(c => c.id === item.id);
                    if (completedItem && !item.isCompleted) {
                        // Store the specific answer for this checklist item
                        return { ...item, isCompleted: true, answer: completedItem.answer };
                    }
                    return item;
                }));
            }

            // 5. Add New Dynamic Questions (limit to max 2)
            console.log("New dynamic questions from API:", result.newDynamicQuestions);
            if (result.newDynamicQuestions && result.newDynamicQuestions.length > 0) {
                // Limit to max 2 questions
                const limitedQuestions = result.newDynamicQuestions.slice(0, 2);
                
                const newItems: ChecklistItem[] = limitedQuestions.map(text => ({
                    id: generateId(),
                    text: text,
                    isCompleted: false,
                    category: 'dynamic'
                }));

                // Avoid duplicates by text
                setChecklist(prev => {
                    const existingTexts = new Set(prev.map(i => i.text));
                    const uniqueNewItems = newItems.filter(i => !existingTexts.has(i.text));
                    console.log("Adding unique new questions:", uniqueNewItems.length);
                    return [...prev, ...uniqueNewItems];
                });
            }

            // Auto-stop if primary confidence is very high (Converged)
            if (result.primaryDiagnosis.confidenceScore >= 95) {
                // Small delay to ensure the closure message is visible before stopping
                setTimeout(() => setIsSimulationActive(false), 500);
            }

        } catch (error) {
            console.error("Simulation error", error);
            setIsSimulationActive(false);
        } finally {
            setIsProcessing(false);
        }
    }, [messages, patientData, checklist, isProcessing, activeScenarioId]);

    // Gemini mode: Auto-advance simulation
    useEffect(() => {
        if (SIMULATION_MODE !== 'gemini') return;
        
        let timer: ReturnType<typeof setTimeout>;
        if (isSimulationActive && !isProcessing) {
            // Natural pause between conversation turns (patient thinking time)
            const thinkingTime = 1200 + Math.random() * 800; // 1.2-2 seconds
            timer = setTimeout(runSimulationStep, thinkingTime);
        }
        return () => clearTimeout(timer);
    }, [isSimulationActive, isProcessing, runSimulationStep]);

    // Toggle simulation based on mode
    const handleToggleSimulation = () => {
        if (SIMULATION_MODE === 'websocket') {
            if (isSimulationActive) {
                stopWebSocketSimulation();
            } else {
                startWebSocketSimulation();
            }
        } else {
            setIsSimulationActive(!isSimulationActive);
        }
    };

    const handleReset = () => {
        // Disconnect WebSocket if in websocket mode
        if (SIMULATION_MODE === 'websocket') {
            websocketService.disconnect();
        }
        setIsSimulationActive(false);
        setMessages([]);
        setChecklist(INITIAL_CHECKLIST);
        setPrimaryDiagnosis({ diagnosis: "Pending Assessment...", confidenceScore: 0, indicators: [] });
        setSecondaryDiagnosis({ diagnosis: "Pending Assessment...", confidenceScore: 0, indicators: [] });
        setActiveScenarioId(undefined);
        setDiagnosticPivotOccurred(false);
        setElapsedTime(0);
        setTimerStarted(false);
    };
    
    // Timer effect - runs every second when simulation is active AND running
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerStarted && isSimulationActive && elapsedTime < 600) { // 600 seconds = 10 minutes
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerStarted, isSimulationActive, elapsedTime]);
    
    // Start timer when simulation starts
    useEffect(() => {
        if (isSimulationActive && !timerStarted) {
            setTimerStarted(true);
        }
    }, [isSimulationActive, timerStarted]);

    if (currentView === 'selector') {
        return <ScenarioSelector scenarios={SCENARIOS} onSelect={handleSelectScenario} />;
    }

    // Calculate dynamic widths based on expanded state
    const getSidebarWidth = () => {
        if (isDashboardExpanded) return 'w-16'; // Always collapsed when dashboard expanded
        return isSidebarOpen ? 'w-1/5 min-w-[280px]' : 'w-16';
    };

    const getChatWidth = () => {
        if (isDashboardExpanded) return 'w-[20%] min-w-[200px]';
        return 'w-1/2';
    };

    const getDashboardWidth = () => {
        if (isDashboardExpanded) return 'w-[80%]';
        return 'w-1/2';
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-gray-100 font-sans text-gray-900 overflow-hidden">
            {/* Debug Button - show in both modes */}
            <button
                onClick={() => setIsDebugOpen(true)}
                className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg hover:bg-gray-700 flex items-center gap-2"
            >
                🔍 Debug Logs
            </button>
            
            {/* Debug Panel */}
            <DebugPanel isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} mode={SIMULATION_MODE} />
            
            <div className="flex w-full h-full max-w-[1920px] mx-auto bg-white shadow-xl overflow-hidden">
                {/* Collapsible Sidebar */}
                <div 
                    className={`${getSidebarWidth()} transition-all duration-500 ease-in-out h-full z-20 flex-shrink-0 relative`}
                >
                    <PatientInfo 
                        data={patientData} 
                        isOpen={isSidebarOpen && !isDashboardExpanded}
                        onToggle={() => !isDashboardExpanded && setIsSidebarOpen(!isSidebarOpen)}
                        onChangeScenario={() => setCurrentView('selector')}
                    />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex h-full overflow-hidden">
                    {/* Chat Interface */}
                    <div className={`${getChatWidth()} h-full border-r border-gray-200 overflow-hidden transition-all duration-500 ease-in-out`}>
                        <ChatInterface 
                            messages={messages}
                            isSimulationActive={isSimulationActive}
                            onToggleSimulation={handleToggleSimulation}
                            onReset={handleReset}
                            isProcessing={isProcessing}
                            elapsedTime={elapsedTime}
                            timerStarted={timerStarted}
                            isCompact={isDashboardExpanded}
                            connectionStatus={SIMULATION_MODE === 'websocket' ? connectionStatus : undefined}
                        />
                    </div>

                    {/* Clinical Zone (Right Panel) */}
                    <div className={`${getDashboardWidth()} h-full overflow-hidden transition-all duration-500 ease-in-out`}>
                        <ClinicalDashboard 
                            checklist={checklist}
                            primaryDiagnosis={primaryDiagnosis}
                            secondaryDiagnosis={secondaryDiagnosis}
                            diagnosticPivot={diagnosticPivotOccurred}
                            isExpanded={isDashboardExpanded}
                            onToggleExpand={() => setIsDashboardExpanded(!isDashboardExpanded)}
                            turnCount={Math.floor(messages.length / 2)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
