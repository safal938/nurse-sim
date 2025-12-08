import React, { useRef, useEffect } from 'react';
import { Message, MessageHighlight } from '../types';
import { ConnectionStatus } from '../services/websocketService';

// Helper function to render text with highlighted portions
const renderTextWithHighlights = (text: string, highlights?: MessageHighlight[]): React.ReactNode => {
    if (!highlights || highlights.length === 0) {
        return text;
    }

    // Create a map of positions to highlight
    const parts: { text: string; highlighted: boolean; level?: string }[] = [];
    let lastIndex = 0;
    
    // Sort highlights by their position in the text
    const sortedHighlights = highlights
        .map(h => ({ ...h, index: text.toLowerCase().indexOf(h.text.toLowerCase()) }))
        .filter(h => h.index !== -1)
        .sort((a, b) => a.index - b.index);

    sortedHighlights.forEach(highlight => {
        const startIndex = text.toLowerCase().indexOf(highlight.text.toLowerCase(), lastIndex);
        if (startIndex === -1) return;

        // Add non-highlighted text before this highlight
        if (startIndex > lastIndex) {
            parts.push({ text: text.slice(lastIndex, startIndex), highlighted: false });
        }

        // Add highlighted text
        parts.push({ 
            text: text.slice(startIndex, startIndex + highlight.text.length), 
            highlighted: true,
            level: highlight.level 
        });

        lastIndex = startIndex + highlight.text.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), highlighted: false });
    }

    return parts.map((part, index) => 
        part.highlighted ? (
            <span 
                key={index} 
                className={`px-0.5 rounded font-medium ${
                    part.level === 'warning' 
                        ? 'bg-amber-100/70 text-amber-700' 
                        : 'bg-sky-100/70 text-sky-700'
                }`}
            >
                {part.text}
            </span>
        ) : (
            <span key={index}>{part.text}</span>
        )
    );
};

interface Props {
    messages: Message[];
    isSimulationActive: boolean;
    onToggleSimulation: () => void;
    onReset: () => void;
    isProcessing: boolean;
    elapsedTime: number;
    timerStarted: boolean;
    isCompact?: boolean;
    connectionStatus?: ConnectionStatus;
}

const ChatInterface: React.FC<Props> = ({ 
    messages, 
    isSimulationActive, 
    onToggleSimulation, 
    onReset,
    isProcessing,
    elapsedTime,
    timerStarted,
    isCompact = false,
    connectionStatus
}) => {
    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Calculate time remaining (10 minutes = 600 seconds)
    const timeRemaining = 600 - elapsedTime;
    const isTimeWarning = timeRemaining <= 120; // Warning when 2 minutes or less
    const isTimeCritical = timeRemaining <= 60; // Critical when 1 minute or less
    // Reference to the scrollable container itself
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // Track if user has manually scrolled up to pause auto-scroll
    const isUserScrolledUp = useRef(false);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            // If the user is within 100px of the bottom, they are "at the bottom"
            // If they scroll up further, we mark them as scrolled up
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
            isUserScrolledUp.current = !isAtBottom;
        }
    };

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            // Small delay to allow DOM to layout the new message bubbles before scrolling
            setTimeout(() => {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }
    };

    useEffect(() => {
        // Reset scroll lock if chat is cleared
        if (messages.length === 0) {
            isUserScrolledUp.current = false;
        }

        // Only auto-scroll if the user hasn't scrolled up manually
        if (!isUserScrolledUp.current) {
            scrollToBottom();
        }
    }, [messages, isProcessing]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Header - Responsive for compact mode */}
            <div className={`bg-white border-b border-gray-200 shadow-sm z-10 flex-shrink-0 transition-all duration-500 flex justify-between items-center ${
                isCompact ? 'px-3 py-2' : 'px-6 py-4'
            }`}>
                <div className={`flex items-center ${isCompact ? 'space-x-2' : 'space-x-4'}`}>
                    <div className={isCompact ? 'min-w-0' : ''}>
                        <h2 className={`font-bold text-gray-800 transition-all duration-300 ${isCompact ? 'text-sm' : 'text-lg'}`}>
                            Interaction
                        </h2>
                        {!isCompact && (
                            <p className="text-xs text-gray-500">Autonomous Nurse-Patient Interaction</p>
                        )}
                    </div>
                    
                    {/* Timer Display with Progress Bar */}
                    {timerStarted && (
                        <div className={`flex flex-col bg-gray-50 rounded-lg border border-gray-200 transition-all duration-300 ${
                            isCompact ? 'px-2 py-1' : 'px-4 py-2'
                        }`}>
                            <div className={`flex items-center ${isCompact ? 'space-x-1' : 'space-x-2'}`}>
                                <span className={`font-mono font-semibold tabular-nums transition-all duration-300 ${
                                    isCompact ? 'text-xs' : 'text-sm'
                                } ${
                                    isTimeCritical 
                                        ? 'text-red-600' 
                                        : isTimeWarning 
                                            ? 'text-orange-600' 
                                            : 'text-gray-700'
                                }`}>
                                    {formatTime(timeRemaining)}
                                </span>
                                {!isCompact && <span className="text-xs text-gray-400 font-medium">/ 10:00</span>}
                            </div>
                            {/* Timer Progress Bar */}
                            <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${isCompact ? 'h-1 mt-1' : 'h-1.5 mt-1.5'}`}>
                                <div 
                                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                                        isTimeCritical 
                                            ? 'bg-red-500' 
                                            : isTimeWarning 
                                                ? 'bg-orange-500' 
                                                : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${(timeRemaining / 600) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Controls - Always on the right */}
                <div className={`flex items-center transition-all duration-300 ${isCompact ? 'space-x-1' : 'space-x-3'}`}>
                    {isProcessing && !isCompact && (
                         <span className="text-xs font-medium text-amber-600 animate-pulse mr-2">
                            AI Generating...
                        </span>
                    )}
                    {isProcessing && isCompact && (
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-1" title="AI Generating..."></div>
                    )}
                    <button 
                        onClick={onReset}
                        className={`text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors ${isCompact ? 'p-1.5' : 'p-2'}`}
                        title="Reset Simulation"
                    >
                        <svg className={`transition-all duration-300 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={onToggleSimulation}
                        className={`flex items-center justify-center rounded-lg font-medium transition-all bg-gray-900 text-white hover:bg-gray-800 ${
                            isCompact ? 'p-2 text-xs' : 'px-4 py-2 text-sm'
                        }`}
                        title={isSimulationActive ? 'Stop' : 'Start'}
                    >
                        {isSimulationActive ? (
                            <>
                                <svg className={`${isCompact ? 'w-4 h-4' : 'w-4 h-4 mr-2'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                </svg>
                                {!isCompact && 'Stop'}
                            </>
                        ) : (
                            <>
                                <svg className={`${isCompact ? 'w-4 h-4' : 'w-4 h-4 mr-2'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                {!isCompact && 'Start'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className={`flex-1 overflow-y-auto min-h-0 overscroll-contain transition-all duration-500 ${
                    isCompact ? 'p-3 space-y-4' : 'p-6 space-y-8'
                }`}
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                         <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-5.699-2.347m-4-7.404H4.522a3.502 3.502 0 01-3.502-3.502h0a3.502 3.502 0 013.502-3.502h4.956" />
                        </svg>
                        <p className="text-sm font-medium">Ready to start simulation</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex w-full ${msg.role === 'nurse' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-200`}
                    >
                        <div className={`flex ${isCompact ? 'max-w-[95%]' : 'max-w-[85%]'} ${msg.role === 'nurse' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-md z-10 transition-all duration-300 ${
                                isCompact ? 'h-7 w-7 text-[10px]' : 'h-10 w-10 text-xs'
                            } ${
                                msg.role === 'nurse' 
                                    ? `bg-teal-600 ${isCompact ? 'ml-2' : 'ml-4'} ring-2 ring-teal-100` 
                                    : `bg-blue-600 ${isCompact ? 'mr-2' : 'mr-4'} ring-2 ring-blue-100`
                            }`}>
                                {msg.role === 'nurse' ? 'RN' : 'PT'}
                            </div>
                            
                            {/* Bubble */}
                            <div className={`flex flex-col ${msg.role === 'nurse' ? 'items-end' : 'items-start'}`}>
                                {!isCompact && (
                                    <span className="text-xs font-bold text-gray-400 mb-1 mx-1 uppercase tracking-wider">
                                        {msg.role === 'nurse' ? 'Nurse AI' : 'Patient'}
                                    </span>
                                )}
                                <div className={`rounded-2xl shadow-sm leading-relaxed relative transition-all duration-300 ${
                                    isCompact ? 'px-3 py-2 text-xs' : 'px-6 py-4 text-sm'
                                } ${
                                    msg.role === 'nurse' 
                                        ? 'bg-white text-gray-800 border border-teal-100 rounded-tr-none' 
                                        : 'bg-blue-50 text-blue-900 border border-blue-100 rounded-tl-none'
                                }`}>
                                    {renderTextWithHighlights(msg.text, msg.highlights)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {isProcessing && (
                     <div className="flex justify-center py-4">
                         <div className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                            <span className="text-xs text-gray-500 font-medium ml-2">Processing Response...</span>
                         </div>
                     </div>
                )}
                
                {!isSimulationActive && messages.length > 0 && !isProcessing && (
                    <div className="flex justify-center py-6">
                        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 max-w-md">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-green-900">Assessment Complete</p>
                                    <p className="text-xs text-green-700 mt-1">Clinical decision support analysis finished</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatInterface;