import React from 'react';
import { ChecklistItem } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    checklist: ChecklistItem[];
}

const ChecklistModal: React.FC<Props> = ({ isOpen, onClose, checklist }) => {
    if (!isOpen) return null;

    const standardItems = checklist.filter(i => i.category === 'fixed');
    const dynamicItems = checklist.filter(i => i.category === 'dynamic');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Nurse Protocol Checklist</h2>
                        <p className="text-sm text-gray-500">Items auto-check based on conversation analysis</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* Section 1: Context Based */}
                    {dynamicItems.length > 0 && (
                        <div>
                            <div className="flex items-center mb-3 text-amber-600">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <h3 className="font-bold text-sm uppercase tracking-wider">Context-Based Questions</h3>
                            </div>
                            <div className="bg-amber-50 rounded-xl border border-amber-100 overflow-hidden">
                                {dynamicItems.map((item) => (
                                    <div key={item.id} className="p-4 border-b border-amber-100 last:border-0 flex items-start space-x-3">
                                        <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border ${
                                            item.isCompleted 
                                                ? 'bg-amber-500 border-amber-500' 
                                                : 'bg-white border-amber-300'
                                        } flex items-center justify-center`}>
                                            {item.isCompleted && (
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className={`text-sm ${item.isCompleted ? 'text-amber-800 line-through opacity-75' : 'text-gray-800 font-medium'}`}>
                                            {item.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Section 2: Standard Protocol */}
                    <div>
                        <div className="flex items-center mb-3 text-gray-500">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <h3 className="font-bold text-sm uppercase tracking-wider">Standard Protocol</h3>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                             {standardItems.map((item) => (
                                <div key={item.id} className="p-4 border-b border-gray-100 last:border-0 flex items-start space-x-3 hover:bg-gray-50 transition-colors">
                                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border ${
                                            item.isCompleted 
                                                ? 'bg-green-500 border-green-500' 
                                                : 'bg-white border-gray-300'
                                        } flex items-center justify-center`}>
                                            {item.isCompleted && (
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    <span className={`text-sm ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                        {item.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
                
                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChecklistModal;