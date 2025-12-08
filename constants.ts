
import { PatientData, ChecklistItem } from './types';

// Initial checklist - backend will provide questions dynamically
export const INITIAL_CHECKLIST: ChecklistItem[] = [];

export const SCENARIOS: PatientData[] = [
    {
        id: 'methotrexate_or_infection',
        scenarioSecret: "Patient initially presents with symptoms that could be Methotrexate Toxicity OR a viral infection. The TRUE diagnosis depends on what the patient reveals during questioning. If they mention taking extra doses, it's MTX toxicity. If they mention sick contacts or travel, it pivots to viral hepatitis.",
        possibleScenarios: [
            {
                id: 'mtx_toxicity',
                diagnosis: 'Methotrexate Toxicity',
                triggerKeywords: ['extra dose', 'took more', 'missed dose', 'caught up', 'double', 'daily instead of weekly'],
                secretDetails: "She accidentally took her weekly dose DAILY for 3 days because she missed last week. Symptoms: Mucositis, Nausea, yellow eyes."
            },
            {
                id: 'viral_hepatitis',
                diagnosis: 'Acute Viral Hepatitis',
                triggerKeywords: ['sick friend', 'travel', 'raw food', 'shellfish', 'daycare', 'exposed'],
                secretDetails: "She was exposed to Hepatitis A through contaminated food at a family gathering 3 weeks ago. Now presenting with similar liver symptoms."
            }
        ],
        patient: {
            name: "Sarah Miller",
            date_of_birth: "1981-06-03",
            age: 43,
            sex: "Female",
            age_at_first_encounter: 43,
            identifiers: { mrn: "SM43850603" }
        },
        riskLevel: "high",
        primaryDiagnosis: "Undifferentiated Abdominal Pain",
        problem_list: [
            { name: "Rheumatoid Arthritis", status: "active" },
            { name: "Type 2 Diabetes", status: "active" },
            { name: "Hypertension", status: "active" }
        ]
    },
    {
        id: 'overdose_or_gastritis',
        scenarioSecret: "Patient presents with nausea and abdominal pain. Could be Acetaminophen Overdose (took too much for pain) OR Acute Gastritis (from NSAIDs and stress). These are COMPLETELY DIFFERENT conditions requiring different treatments.",
        possibleScenarios: [
            {
                id: 'acetaminophen_overdose',
                diagnosis: 'Acetaminophen Overdose',
                triggerKeywords: ['tylenol', 'acetaminophen', 'extra strength', 'whole bottle', 'many pills', 'lost count', 'took a lot'],
                secretDetails: "He took 15+ Tylenol tablets over 24 hours for severe back pain. Now has right upper quadrant pain and nausea - early liver toxicity signs."
            },
            {
                id: 'acute_gastritis',
                diagnosis: 'Acute Gastritis',
                triggerKeywords: ['ibuprofen', 'advil', 'aspirin', 'motrin', 'empty stomach', 'coffee', 'stress', 'burning'],
                secretDetails: "He's been taking ibuprofen 800mg 4x daily on an empty stomach for back pain, plus drinking lots of coffee. Classic NSAID-induced gastritis."
            }
        ],
        patient: {
            name: "David Chen",
            date_of_birth: "1999-11-12",
            age: 24,
            sex: "Male",
            age_at_first_encounter: 24,
            identifiers: { mrn: "DC99111201" }
        },
        riskLevel: "high",
        primaryDiagnosis: "Acute Abdominal Pain",
        problem_list: [
            { name: "Chronic Back Pain", status: "active" },
            { name: "Insomnia", status: "active" }
        ]
    },
    {
        id: 'alcohol_or_medication',
        scenarioSecret: "Patient presents with jaundice and liver symptoms. Could be Alcoholic Hepatitis OR Drug-Induced Liver Injury from a new supplement/medication. Diagnosis pivots based on what patient reveals.",
        possibleScenarios: [
            {
                id: 'alcoholic_hepatitis',
                diagnosis: 'Acute Alcoholic Hepatitis',
                triggerKeywords: ['drinking', 'alcohol', 'wine', 'beer', 'lost job', 'stress drinking', 'binge'],
                secretDetails: "She has been binge drinking heavily for 2 weeks after losing her job. Initially denies recent use."
            },
            {
                id: 'dili',
                diagnosis: 'Drug-Induced Liver Injury (DILI)',
                triggerKeywords: ['supplement', 'herbal', 'weight loss', 'energy', 'online', 'new medication', 'green tea extract'],
                secretDetails: "She started taking a weight loss supplement with green tea extract 3 weeks ago. It's causing hepatotoxicity."
            }
        ],
        patient: {
            name: "Maria Garcia",
            date_of_birth: "1972-04-15",
            age: 52,
            sex: "Female",
            age_at_first_encounter: 52,
            identifiers: { mrn: "MG72041599" }
        },
        riskLevel: "high",
        primaryDiagnosis: "Jaundice / Hyperbilirubinemia",
        problem_list: [
            { name: "Alcohol Use Disorder", status: "active" },
            { name: "Chronic Gastritis", status: "active" },
            { name: "Anemia", status: "active" }
        ]
    },
    {
        id: 'autoimmune_or_biliary',
        scenarioSecret: "Patient presents with elevated liver enzymes and fatigue. Could be Autoimmune Hepatitis flare (stopped meds) OR Primary Biliary Cholangitis progression. Diagnosis depends on medication history and symptom details.",
        possibleScenarios: [
            {
                id: 'aih_flare',
                diagnosis: 'Autoimmune Hepatitis Flare',
                triggerKeywords: ['stopped', 'prednisone', 'weight gain', 'didn\'t tell doctor', 'ran out', 'side effects'],
                secretDetails: "She stopped her prednisone 2 weeks ago because of weight gain. Now having a flare with fatigue, dark urine, joint pain."
            },
            {
                id: 'pbc_progression',
                diagnosis: 'Primary Biliary Cholangitis',
                triggerKeywords: ['itching', 'scratching', 'dry eyes', 'dry mouth', 'fatigue worse', 'taking medications'],
                secretDetails: "Her PBC is progressing despite treatment. New symptoms include severe pruritus and worsening fatigue. She's been compliant with meds."
            }
        ],
        patient: {
            name: "Emily Wilson",
            date_of_birth: "1988-08-22",
            age: 35,
            sex: "Female",
            age_at_first_encounter: 35,
            identifiers: { mrn: "EW88082255" }
        },
        riskLevel: "medium",
        primaryDiagnosis: "Elevated Liver Enzymes",
        problem_list: [
            { name: "Autoimmune Hepatitis (Type 1)", status: "active" },
            { name: "Hypothyroidism", status: "active" }
        ]
    }
];

export const INITIAL_PATIENT_DATA: PatientData = SCENARIOS[0];
