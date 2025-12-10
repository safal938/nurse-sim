
import React from 'react';
import { PatientData } from '../types';

interface Props {
    data: PatientData;
    isOpen: boolean;
    onToggle: () => void;
    onChangeScenario?: () => void;
}

const PatientInfo: React.FC<Props> = ({ data, isOpen, onToggle, onChangeScenario }) => {
    return (
        <div className="h-full bg-white flex flex-col overflow-hidden relative border-r border-gray-200">
            {/* Toggle Button */}
            <div className={`flex ${isOpen ? 'justify-between px-4 pt-4' : 'justify-center pt-4'}`}>
                {isOpen && onChangeScenario && (
                    <button 
                        onClick={onChangeScenario}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors flex items-center"
                    >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                        </svg>
                        Change Scenario
                    </button>
                )}
                <button 
                    onClick={onToggle}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                    {isOpen ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    )}
                </button>
            </div>

            {isOpen ? (
                // EXPANDED VIEW
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-6 pb-6 pt-2 border-b border-gray-100 bg-white">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl flex-shrink-0">
                                {data.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-bold text-gray-900 truncate">{data.name}</h2>
                                <p className="text-sm text-gray-500 truncate">ID: {data.patient_id}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500 text-xs uppercase tracking-wide">Complaint</p>
                                <p className="font-medium">{data.complaint}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase tracking-wide">Age/Sex</p>
                                <p className="font-medium whitespace-nowrap">{data.age} / {data.gender}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Risk Status</h3>
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                data.severity === 'High' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                                <span className={`w-2 h-2 rounded-full mr-2 ${
                                    data.severity === 'High' ? 'bg-red-500' : 'bg-amber-500'
                                }`}></span>
                                {data.severity.toUpperCase()} RISK
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Presenting Diagnosis</h3>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-800 text-sm leading-relaxed font-medium">
                                {data.complaint}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Active Problems</h3>
                            <ul className="space-y-2">
                                {data.medical_history.map((problem: any, idx: number) => (
                                    <li key={idx} className="flex items-start space-x-2 text-sm text-gray-600 bg-white border border-gray-100 p-2 rounded">
                                        <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{problem}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            ) : (
                // COLLAPSED VIEW
                <div className="flex-1 flex flex-col items-center pt-4 space-y-6">
                     <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg cursor-pointer" title={data.name}>
                        {data.name.charAt(0)}
                    </div>
                    
                    <div className="flex flex-col items-center space-y-2 w-full" title={`Status: ${data.severity}`}>
                        <div className={`w-3 h-3 rounded-full ${
                             data.severity === 'High' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                        }`}></div>
                    </div>

                    <div className="border-t border-gray-100 w-full"></div>

                    <div className="flex flex-col items-center space-y-4 text-gray-400">
                         <button onClick={onChangeScenario} title="Change Scenario">
                             <svg className="w-6 h-6 hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                             </svg>
                         </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientInfo;
