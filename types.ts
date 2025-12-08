
export interface Patient {
    name: string;
    date_of_birth: string;
    age: number;
    sex: string;
    age_at_first_encounter: number;
    identifiers: {
        mrn: string;
    };
}

export interface Problem {
    name: string;
    status: string;
}

export interface ScenarioPath {
    id: string;
    diagnosis: string;
    triggerKeywords: string[]; // Keywords that would pivot toward this diagnosis
    secretDetails: string;
}

export interface PatientData {
    id: string;
    scenarioSecret: string; // The "hidden truth" for the AI simulation
    possibleScenarios?: ScenarioPath[]; // Multiple possible diagnoses that can emerge
    patient: Patient;
    riskLevel: string;
    primaryDiagnosis: string;
    problem_list: Problem[];
}

export interface MessageHighlight {
    level: 'warning' | 'info';
    text: string;
}

export interface Message {
    id: string;
    role: 'nurse' | 'patient';
    text: string;
    timestamp: Date;
    highlights?: MessageHighlight[];
}

export interface ChecklistItem {
    id: string;
    text: string;
    isCompleted: boolean;
    category: 'fixed' | 'dynamic';
    answer?: string;
}

export interface ChecklistAnswer {
    id: string; // The checklist item ID
    answer: string; // The specific answer/excerpt that satisfies this item
}

export interface DiagnosticIndicator {
    finding: string; // The clinical finding (e.g., "Jaundice", "Right upper quadrant pain")
    source: string; // Where this was found (e.g., "Patient reported", "Physical exam")
    significance: 'high' | 'medium' | 'low'; // How important this is for the diagnosis
    patientQuote: string; // The exact patient text that indicated this finding
}

export interface DiagnosisOption {
    diagnosis: string;
    confidenceScore: number; // 0-100
    indicators: DiagnosticIndicator[]; // Key findings supporting THIS diagnosis
}

export interface SimulationResponse {
    nurseQuestion: string; 
    patientReply: string; 
    
    // Clinical Dashboard Data - Two possible diagnoses
    primaryDiagnosis: DiagnosisOption;
    secondaryDiagnosis: DiagnosisOption;
    completedChecklistItems: ChecklistAnswer[]; // Items completed with their specific answers
    newDynamicQuestions: string[]; // Text for new questions to add
    activeScenarioId?: string; // Which scenario path is currently most likely
    diagnosticPivot?: boolean; // True if diagnosis changed significantly this turn
}

export interface DecisionNode {
    id: string;
    label: string;
    status: string;
    nodeType?: 'standard' | 'convergent';
    children?: DecisionNode[];
}
