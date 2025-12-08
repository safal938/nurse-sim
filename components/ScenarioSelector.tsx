
import React from 'react';
import { PatientData } from '../types';

interface Props {
    scenarios: PatientData[];
    onSelect: (scenario: PatientData) => void;
}

const ScenarioSelector: React.FC<Props> = ({ scenarios, onSelect }) => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
            <div className="max-w-5xl w-full">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Clinical Scenarios</h1>
                    <p className="text-slate-500">Select a patient case to begin the real-time decision support simulation.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {scenarios.map((scenario) => (
                        <button
                            key={scenario.id}
                            onClick={() => onSelect(scenario)}
                            className="flex flex-col text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <svg className="w-24 h-24 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />
                                </svg>
                            </div>

                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        {scenario.patient.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{scenario.patient.name}</h3>
                                        <p className="text-sm text-slate-500">{scenario.patient.age}y / {scenario.patient.sex}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                                    scenario.riskLevel === 'high' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                    {scenario.riskLevel} Risk
                                </span>
                            </div>

                            <div className="space-y-3 z-10">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Presenting Complaint</p>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                                        {scenario.primaryDiagnosis}
                                    </p>
                                </div>
                                
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Medical History</p>
                                    <div className="flex flex-wrap gap-2">
                                        {scenario.problem_list.slice(0, 3).map((p, i) => (
                                            <span key={i} className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ScenarioSelector;
