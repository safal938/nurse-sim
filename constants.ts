
import { PatientData, ChecklistItem } from './types';

// Initial checklist - backend will provide questions dynamically
export const INITIAL_CHECKLIST: ChecklistItem[] = [];

export const SCENARIOS: any[] = [
    {
      "patient_id" : "P0001",
      "name": "Marcus Mark Elias Thorne",
      "age": 46,
      "gender": "Male",
      "complaint": "Jaundice (yellow eyes) and severe itching",
      "medical_history": [
        "Dental Abscess (Recent)"
      ],
      "severity": "High"
    },
    {
      "patient_id" : "P0002",
      "name": "Elena Maria Rosales",
      "age": 32,
      "gender": "Female",
      "complaint": "Constant nausea and jaundice (looking orange)",
      "medical_history": [],
      "severity": "High"
    },
    {
      "patient_id" : "P0003",
      "name": "Margaret Peggy Louise O’Neil",
      "age": 68,
      "gender": "Female",
      "complaint": "Fatigue and generalized aches (flu-like symptoms)",
      "medical_history": [
        "Hypertension",
        "Recurrent Urinary Tract Infections (UTIs)",
        "Osteoarthritis"
      ],
      "severity": "Medium"
    }
  ];

export const INITIAL_PATIENT_DATA: PatientData = SCENARIOS[0];
