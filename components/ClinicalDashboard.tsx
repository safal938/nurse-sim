
import React from 'react';
import { ChecklistItem, DiagnosisOption, DiagnosticIndicator } from '../types';

interface Props {
    checklist: ChecklistItem[];
    primaryDiagnosis: DiagnosisOption;
    secondaryDiagnosis: DiagnosisOption;
    diagnosticPivot?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    turnCount?: number;
}

const QuestionCard: React.FC<{ item: ChecklistItem; isDynamic: boolean; isMoving?: boolean; isExpanded?: boolean }> = ({ item, isDynamic, isMoving = false, isExpanded = false }) => {
    const [isAnswerExpanded, setIsAnswerExpanded] = React.useState(false);
    const hasLongAnswer = item.answer && item.answer.length > 80;
    const isNew = isDynamic && !item.isCompleted;
    
    return (
        <div 
            className={`
                group rounded-lg border transition-all duration-500 ease-in-out
                ${isExpanded ? 'p-4' : 'p-3'}
                ${item.isCompleted 
                    ? 'bg-white border-gray-200' 
                    : 'bg-gray-50 border-gray-200'
                }
                ${isNew ? 'ring-2 ring-blue-400 ring-offset-1 border-blue-400 bg-blue-50/30' : ''}
                ${isMoving ? 'animate-move-to-answered' : ''}
                ${isExpanded ? 'hover:shadow-md hover:scale-[1.01]' : ''}
            `}
        >
            <div className="flex items-start gap-2">
                {/* Status Icon */}
                <div className={`
                    mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                    ${isExpanded ? 'w-6 h-6' : 'w-5 h-5'}
                    ${item.isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-300 text-gray-500'
                    }
                `}>
                    {item.isCompleted ? (
                        <svg className={`transition-all duration-300 ${isExpanded ? 'w-4 h-4' : 'w-3 h-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <div className={`rounded-full bg-gray-400 transition-all duration-300 ${isExpanded ? 'w-2.5 h-2.5' : 'w-2 h-2'}`}></div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Question Text */}
                    <div className="flex justify-between items-start gap-2">
                        <h3 className={`font-medium leading-snug transition-all duration-300 ${isExpanded ? 'text-sm' : 'text-xs'} ${item.isCompleted ? 'text-gray-700' : 'text-gray-500'}`}>
                            {item.text}
                        </h3>
                        {isDynamic && !item.isCompleted && (
                             <span className={`flex-shrink-0 inline-flex items-center rounded font-semibold bg-blue-500 text-white uppercase tracking-wide transition-all duration-300 ${isExpanded ? 'px-2 py-1 text-[10px]' : 'px-1.5 py-0.5 text-[9px]'}`}>
                                New
                            </span>
                        )}
                    </div>

                    {/* Answer Box - Click to expand/collapse */}
                    {item.isCompleted && item.answer && (
                        <div 
                            className={`transition-all duration-300 ${isExpanded ? 'mt-3' : 'mt-2'} ${hasLongAnswer ? 'cursor-pointer' : ''}`}
                            onClick={() => hasLongAnswer && setIsAnswerExpanded(!isAnswerExpanded)}
                        >
                            <div 
                                className={`relative overflow-hidden transition-all duration-500 ease-in-out ${
                                    isAnswerExpanded || !hasLongAnswer ? 'max-h-96 opacity-100' : isExpanded ? 'max-h-16 opacity-90' : 'max-h-12 opacity-90'
                                }`}
                            >
                                <div className={`text-gray-600 italic leading-relaxed transition-all duration-300 ${
                                    isAnswerExpanded ? 'opacity-100' : 'opacity-90'
                                } ${isExpanded ? 'text-sm' : 'text-xs'}`}>
                                    "{item.answer}"
                                </div>
                                {/* Fade overlay when collapsed */}
                                {!isAnswerExpanded && hasLongAnswer && (
                                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none transition-opacity duration-300"></div>
                                )}
                            </div>
                            {hasLongAnswer && (
                                <div className="mt-1 flex justify-center transition-all duration-300">
                                    <svg className={`text-gray-400 transition-all duration-300 ${isAnswerExpanded ? 'rotate-180' : ''} ${isExpanded ? 'w-4 h-4' : 'w-3 h-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Pending State */}
                    {!item.isCompleted && (
                        <div className={`font-medium text-gray-400 transition-all duration-300 ${isExpanded ? 'mt-2 text-xs' : 'mt-1 text-[10px]'}`}>
                            Pending...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ClinicalDashboard: React.FC<Props> = ({ checklist, primaryDiagnosis, secondaryDiagnosis, diagnosticPivot, isExpanded = false, onToggleExpand, turnCount = 0 }) => {
    // Hide specific diagnoses until turn 3 - show "Gathering information..." instead
    const MIN_TURNS_FOR_DIAGNOSIS = 3;
    const showDiagnoses = turnCount >= MIN_TURNS_FOR_DIAGNOSIS;
    const [movingItemId, setMovingItemId] = React.useState<string | null>(null);
    const [movingItemData, setMovingItemData] = React.useState<ChecklistItem | null>(null);
    const [showIndicatorsModal, setShowIndicatorsModal] = React.useState(false);
    const [selectedDiagnosis, setSelectedDiagnosis] = React.useState<DiagnosisOption | null>(null);
    const prevChecklistRef = React.useRef(checklist);
    
    // Split checklist into dynamic (new) and fixed (standard)
    // We reverse dynamic so newest added appear at the very top of that section
    const dynamicItems = checklist.filter(i => i.category === 'dynamic').reverse();
    const fixedItems = checklist.filter(i => i.category === 'fixed');
    
    // Detect when an item becomes completed
    React.useEffect(() => {
        const prevChecklist = prevChecklistRef.current;
        
        // Find newly completed items by comparing with previous state
        checklist.forEach((item) => {
            const prevItem = prevChecklist.find(p => p.id === item.id);
            if (prevItem && !prevItem.isCompleted && item.isCompleted) {
                console.log("Item completed, starting animation:", item.id);
                setMovingItemId(item.id);
                // Store the item data before it moves
                setMovingItemData({...prevItem, isCompleted: false});
                // Clear after animation completes
                setTimeout(() => {
                    setMovingItemId(null);
                    setMovingItemData(null);
                }, 1500);
            }
        });
        
        prevChecklistRef.current = checklist;
    }, [checklist]);

    const getConfidenceColor = (score: number) => {
        if (score < 40) return 'text-gray-500';
        if (score < 70) return 'text-amber-500';
        return 'text-blue-600';
    };

    const getBarColor = (score: number) => {
        if (score < 40) return 'bg-gray-300';
        if (score < 70) return 'bg-amber-400';
        return 'bg-blue-600';
    }
    
    const getConfidenceLabel = (score: number) => {
        if (score < 40) return 'Low Confidence';
        if (score < 70) return 'Moderate Confidence';
        return 'High Confidence';
    };

    return (
        <div className="h-full bg-slate-50 border-l border-gray-200 flex flex-col overflow-hidden font-sans">
            {/* Header: Clinical Zone */}
            <div className="px-6 py-5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Real-time Diagnostic Assessment</h2>
                    {onToggleExpand && (
                        <button
                            onClick={onToggleExpand}
                            className="group relative p-2 rounded-lg bg-slate-100 hover:bg-blue-100 transition-all duration-300 ease-in-out hover:scale-105 active:scale-95"
                            title={isExpanded ? "Collapse view" : "Expand view"}
                        >
                            <div className={`transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                {isExpanded ? (
                                    <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L4 4m0 0l5 0m-5 0l0 5m11-5l5 5m0 0l-5 0m5 0l0-5m-5 15l5-5m0 0l-5 0m5 0l0 5M4 15l5 5m0 0l-5 0m5 0l0-5" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                )}
                            </div>
                            {/* Tooltip - positioned to the left to avoid overflow clipping */}
                            <span className="absolute top-1/2 right-full -translate-y-1/2 mr-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                                {isExpanded ? 'Collapse' : 'Expand'}
                            </span>
                        </button>
                    )}
                </div>
                
                {/* Dual Diagnosis Cards - Only show when there's data */}
                {(primaryDiagnosis.confidenceScore > 0 || secondaryDiagnosis.confidenceScore > 0) ? (
                    showDiagnoses ? (
                        <div className="grid grid-cols-2 gap-3">
                            {/* Primary Diagnosis Card */}
                            {primaryDiagnosis.confidenceScore > 0 && (
                                <div 
                                    className="p-1 rounded-2xl bg-gradient-to-br from-blue-50 to-white shadow-lg border border-blue-200 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
                                    onClick={() => { setSelectedDiagnosis(primaryDiagnosis); setShowIndicatorsModal(true); }}
                                >
                                    <div className="bg-white rounded-xl p-4 border border-slate-50 relative overflow-hidden">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-600 text-[9px] font-bold uppercase tracking-wider">
                                                Primary
                                            </span>
                                            {primaryDiagnosis.indicators.length > 0 && (
                                                <span className="text-[9px] text-blue-500">{primaryDiagnosis.indicators.length} findings</span>
                                            )}
                                        </div>
                                        <div className={`text-base font-bold leading-tight transition-all duration-500 ${diagnosticPivot ? 'text-blue-700' : 'text-slate-800'}`}>
                                            {primaryDiagnosis.diagnosis}
                                        </div>
                                        <div className="mt-3">
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full transition-all duration-500 ease-out rounded-full bg-blue-500"
                                                    style={{ width: `${primaryDiagnosis.confidenceScore}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[9px] font-bold text-blue-600">{primaryDiagnosis.confidenceScore}%</span>
                                                <span className="text-[9px] text-slate-400">confidence</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Secondary Diagnosis Card */}
                            {secondaryDiagnosis.confidenceScore > 0 && (
                                <div 
                                    className="p-1 rounded-2xl bg-gradient-to-br from-gray-50 to-white shadow border border-gray-200 cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.01]"
                                    onClick={() => { setSelectedDiagnosis(secondaryDiagnosis); setShowIndicatorsModal(true); }}
                                >
                                    <div className="bg-white rounded-xl p-4 border border-slate-50 relative overflow-hidden">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider">
                                                Secondary
                                            </span>
                                            {secondaryDiagnosis.indicators.length > 0 && (
                                                <span className="text-[9px] text-gray-400">{secondaryDiagnosis.indicators.length} findings</span>
                                            )}
                                        </div>
                                        <div className="text-base font-bold leading-tight text-gray-600">
                                            {secondaryDiagnosis.diagnosis}
                                        </div>
                                        <div className="mt-3">
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full transition-all duration-500 ease-out rounded-full bg-gray-400"
                                                    style={{ width: `${secondaryDiagnosis.confidenceScore}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[9px] font-bold text-gray-500">{secondaryDiagnosis.confidenceScore}%</span>
                                                <span className="text-[9px] text-slate-400">confidence</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Gathering information state - before turn 3 */
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-200 text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <p className="text-sm font-medium text-amber-700">Gathering patient information...</p>
                            <p className="text-xs text-amber-500 mt-1">Diagnostic hypotheses will appear after initial assessment</p>
                        </div>
                    )
                ) : (
                    /* Empty state - waiting for simulation to start */
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 text-center">
                        <p className="text-sm text-gray-400">Start to see diagnostic hypotheses</p>
                    </div>
                )}
            </div>

            {/* Questions List - Responsive Column Layout */}
            <div className={`flex-1 overflow-y-auto min-h-0 bg-gray-50 transition-all duration-500 ${isExpanded ? 'p-6' : 'p-4'}`}>
                <div className={`space-y-4 transition-all duration-500 ${isExpanded ? 'max-w-none' : ''}`}>
                    
                    {/* Unanswered Dynamic Questions */}
                    {(dynamicItems.filter(i => !i.isCompleted).length > 0 || movingItemData) && (
                        <div className="animate-in fade-in duration-300">
                             <div className="flex items-center space-x-2 mb-3">
                                <div className={`rounded-full bg-blue-500 transition-all duration-300 ${isExpanded ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}></div>
                                <h3 className={`font-bold text-gray-600 uppercase tracking-wider transition-all duration-300 ${isExpanded ? 'text-xs' : 'text-[10px]'}`}>New Inquiries</h3>
                            </div>
                            <div className={`grid gap-3 transition-all duration-500 ${isExpanded ? 'grid-cols-3 xl:grid-cols-4' : 'grid-cols-2'}`}>
                                {/* Show the moving item in its original position while animating */}
                                {movingItemData && movingItemData.category === 'dynamic' && (
                                    <div className="relative" key={`moving-${movingItemData.id}`}>
                                        <QuestionCard item={movingItemData} isDynamic={true} isMoving={true} isExpanded={isExpanded} />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-green-500 text-white px-3 py-1 rounded-full shadow-lg animate-bounce">
                                                <span className="text-[10px] font-bold flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                    </svg>
                                                    Answered
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {dynamicItems.filter(i => !i.isCompleted).map((item, index) => (
                                    <div 
                                        key={item.id}
                                        className={`${movingItemData ? 'animate-in slide-in-from-right-2 fade-in duration-700' : 'animate-in slide-in-from-top-2 fade-in duration-300'}`}
                                        style={{ animationDelay: `${movingItemData ? '1200ms' : `${index * 50}ms`}` }}
                                    >
                                        <QuestionCard item={item} isDynamic={true} isMoving={false} isExpanded={isExpanded} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unanswered Fixed Questions */}
                    {(fixedItems.filter(i => !i.isCompleted).length > 0 || (movingItemData && movingItemData.category === 'fixed')) && (
                        <div className="animate-in fade-in duration-300">
                             <div className="flex items-center space-x-2 mb-3">
                                 <div className={`rounded-full bg-gray-300 transition-all duration-300 ${isExpanded ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}></div>
                                <h3 className={`font-bold text-gray-500 uppercase tracking-wider transition-all duration-300 ${isExpanded ? 'text-xs' : 'text-[10px]'}`}>Standard Protocol</h3>
                             </div>
                             <div className={`grid gap-3 transition-all duration-500 ${isExpanded ? 'grid-cols-3 xl:grid-cols-4' : 'grid-cols-2'}`}>
                                 {/* Show the moving item in its original position while animating */}
                                 {movingItemData && movingItemData.category === 'fixed' && (
                                    <div className="relative" key={`moving-${movingItemData.id}`}>
                                        <QuestionCard item={movingItemData} isDynamic={false} isMoving={true} isExpanded={isExpanded} />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-green-500 text-white px-3 py-1 rounded-full shadow-lg animate-bounce">
                                                <span className="text-[10px] font-bold flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                    </svg>
                                                    Answered
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                 {fixedItems.filter(i => !i.isCompleted).map((item) => (
                                     <div key={item.id} className="transition-all duration-500 ease-in-out">
                                         <QuestionCard item={item} isDynamic={false} isMoving={false} isExpanded={isExpanded} />
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}

                    {/* Answered Questions Section */}
                    {(dynamicItems.filter(i => i.isCompleted).length > 0 || fixedItems.filter(i => i.isCompleted).length > 0) && (
                        <div className="pt-4 animate-in fade-in duration-500">
                            <div className="flex items-center gap-3 mb-3">
                                <hr className="flex-1 border-gray-300" />
                                <div className="flex items-center space-x-2">
                                    <svg className={`text-green-600 transition-all duration-300 ${isExpanded ? 'w-4 h-4' : 'w-3 h-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <h3 className={`font-bold text-gray-500 uppercase tracking-wider transition-all duration-300 ${isExpanded ? 'text-xs' : 'text-[10px]'}`}>Answered Questions</h3>
                                </div>
                                <hr className="flex-1 border-gray-300" />
                            </div>
                            <div className={`grid gap-3 transition-all duration-500 ${isExpanded ? 'grid-cols-3 xl:grid-cols-4' : 'grid-cols-2'}`}>
                                {[...dynamicItems.filter(i => i.isCompleted), ...fixedItems.filter(i => i.isCompleted)].map((item) => {
                                    const isJustArrived = movingItemId === item.id;
                                    return (
                                        <div 
                                        
                                            key={item.id} 
                                            className={`${isJustArrived ? 'animate-in fade-in zoom-in duration-500' : 'animate-in fade-in duration-300'}`}
                                            style={isJustArrived ? { animationDelay: '1000ms' } : {}}
                                        >
                                            <QuestionCard item={item} isDynamic={false} isMoving={false} isExpanded={isExpanded} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Diagnostic Indicators Modal */}
            {showIndicatorsModal && selectedDiagnosis && (
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200"
                    onClick={() => { setShowIndicatorsModal(false); setSelectedDiagnosis(null); }}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Diagnostic Indicators</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Key findings for: <span className="font-semibold text-blue-600">{selectedDiagnosis.diagnosis}</span>
                                        <span className="ml-2 text-xs text-gray-400">({selectedDiagnosis.confidenceScore}% confidence)</span>
                                    </p>
                                </div>
                                <button 
                                    onClick={() => { setShowIndicatorsModal(false); setSelectedDiagnosis(null); }}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
                            {selectedDiagnosis.indicators.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No diagnostic indicators yet for this diagnosis.</p>
                            ) : (
                                <div className="space-y-3">
                                    {selectedDiagnosis.indicators.map((indicator, index) => (
                                        <div 
                                            key={index}
                                            className="p-4 rounded-xl border-l-4 bg-blue-50 border-blue-500"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-blue-700">
                                                        {indicator.finding}
                                                    </span>
                                                    {indicator.patientQuote && (
                                                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                                                            <p className="text-xs text-gray-400 mb-1 font-medium">Patient said:</p>
                                                            <p className="text-sm text-gray-700 italic">"{indicator.patientQuote}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setShowIndicatorsModal(false)}
                                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicalDashboard;
