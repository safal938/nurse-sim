import React, { useState } from 'react';
import { getDebugLogs, clearDebugLogs, DebugLogEntry } from '../services/geminiService';
import { getWsDebugLogs, clearWsDebugLogs, WsDebugLogEntry } from '../services/websocketService';

interface DebugPanelProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: 'gemini' | 'websocket';
}

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose, mode = 'gemini' }) => {
    const [geminiLogs, setGeminiLogs] = useState<DebugLogEntry[]>([]);
    const [wsLogs, setWsLogs] = useState<WsDebugLogEntry[]>([]);
    const [selectedGeminiLog, setSelectedGeminiLog] = useState<DebugLogEntry | null>(null);
    const [selectedWsLog, setSelectedWsLog] = useState<WsDebugLogEntry | null>(null);
    const [activeTab, setActiveTab] = useState<'request' | 'response'>('response');
    const [activeMode, setActiveMode] = useState<'gemini' | 'websocket'>(mode);
    const [wsTypeFilter, setWsTypeFilter] = useState<'all' | 'exclude-audio' | 'transcript' | 'audio' | 'system' | 'clinical'>('all');

    const refreshLogs = () => {
        setGeminiLogs(getDebugLogs());
        setWsLogs(getWsDebugLogs());
    };

    const handleClear = () => {
        if (activeMode === 'gemini') {
            clearDebugLogs();
            setGeminiLogs([]);
            setSelectedGeminiLog(null);
        } else {
            clearWsDebugLogs();
            setWsLogs([]);
            setSelectedWsLog(null);
        }
    };

    const handleCopyAll = () => {
        let data;
        if (activeMode === 'gemini') {
            data = geminiLogs;
        } else {
            data = wsTypeFilter === 'all' 
                ? wsLogs 
                : wsTypeFilter === 'exclude-audio'
                ? wsLogs.filter(log => log.parsed?.type !== 'audio')
                : wsLogs.filter(log => log.parsed?.type === wsTypeFilter);
        }
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert(`${data.length} logs copied to clipboard!`);
    };

    React.useEffect(() => {
        if (isOpen) refreshLogs();
    }, [isOpen]);

    React.useEffect(() => {
        setActiveMode(mode);
    }, [mode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-gray-800">🔍 Debug Logs</h2>
                        {/* Mode Toggle */}
                        <div className="flex bg-gray-200 rounded-lg p-1">
                            <button
                                onClick={() => setActiveMode('gemini')}
                                className={`px-3 py-1 text-xs font-medium rounded ${
                                    activeMode === 'gemini' 
                                        ? 'bg-white text-blue-600 shadow' 
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                Gemini API
                            </button>
                            <button
                                onClick={() => setActiveMode('websocket')}
                                className={`px-3 py-1 text-xs font-medium rounded ${
                                    activeMode === 'websocket' 
                                        ? 'bg-white text-purple-600 shadow' 
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                WebSocket
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopyAll}
                            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            Copy All
                        </button>
                        <button
                            onClick={refreshLogs}
                            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={handleClear}
                            className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                            Close
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Log List */}
                    <div className="w-64 border-r bg-gray-50 flex flex-col">
                        {/* WebSocket Type Filter */}
                        {activeMode === 'websocket' && (
                            <div className="p-2 border-b bg-white">
                                <select
                                    value={wsTypeFilter}
                                    onChange={(e) => setWsTypeFilter(e.target.value as typeof wsTypeFilter)}
                                    className="w-full text-xs p-2 border rounded bg-white"
                                >
                                    <option value="all">All Types</option>
                                    <option value="exclude-audio">All Except Audio</option>
                                    <option value="transcript">Transcript Only</option>
                                    <option value="audio">Audio Only</option>
                                    <option value="system">System Only</option>
                                    <option value="clinical">Clinical Only</option>
                                </select>
                            </div>
                        )}
                        
                        <div className="flex-1 overflow-y-auto">
                            {activeMode === 'gemini' ? (
                                geminiLogs.length === 0 ? (
                                    <p className="p-4 text-gray-500 text-sm">No Gemini logs yet.</p>
                                ) : (
                                    geminiLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            onClick={() => setSelectedGeminiLog(log)}
                                            className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${
                                                selectedGeminiLog?.id === log.id ? 'bg-blue-100' : ''
                                            }`}
                                        >
                                            <div className="font-medium text-sm">Turn {log.turnCount}</div>
                                            <div className="text-xs text-gray-500">
                                                {log.timestamp.toLocaleTimeString()}
                                            </div>
                                            {log.response.error && (
                                                <span className="text-xs text-red-500">Error</span>
                                            )}
                                        </div>
                                    ))
                                )
                            ) : (
                                (() => {
                                    const filteredLogs = wsTypeFilter === 'all' 
                                        ? wsLogs 
                                        : wsTypeFilter === 'exclude-audio'
                                        ? wsLogs.filter(log => log.parsed?.type !== 'audio')
                                        : wsLogs.filter(log => log.parsed?.type === wsTypeFilter);
                                    
                                    return filteredLogs.length === 0 ? (
                                        <p className="p-4 text-gray-500 text-sm">
                                            {wsLogs.length === 0 
                                                ? 'No WebSocket logs yet.' 
                                                : `No ${wsTypeFilter} messages found.`}
                                        </p>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <div
                                                key={log.id}
                                                onClick={() => setSelectedWsLog(log)}
                                                className={`p-3 border-b cursor-pointer hover:bg-purple-50 ${
                                                    selectedWsLog?.id === log.id ? 'bg-purple-100' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                        log.direction === 'sent' 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {log.direction === 'sent' ? '↑ SENT' : '↓ RECV'}
                                                    </span>
                                                    {log.parsed?.type && (
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                            log.parsed.type === 'transcript' ? 'bg-purple-100 text-purple-700' :
                                                            log.parsed.type === 'audio' ? 'bg-orange-100 text-orange-700' :
                                                            log.parsed.type === 'clinical' ? 'bg-teal-100 text-teal-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {log.parsed.type}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {log.timestamp.toLocaleTimeString()}
                                                </div>
                                                <div className="text-xs text-gray-600 mt-1 truncate">
                                                    {log.parsed?.text || log.parsed?.message || (log.parsed?.type === 'audio' ? '[audio data]' : log.raw.substring(0, 30))}
                                                </div>
                                                {log.error && (
                                                    <span className="text-xs text-red-500">Parse Error</span>
                                                )}
                                            </div>
                                        ))
                                    );
                                })()
                            )}
                        </div>
                    </div>

                    {/* Detail View */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {activeMode === 'gemini' && selectedGeminiLog ? (
                            <>
                                {/* Tabs */}
                                <div className="flex border-b bg-gray-50">
                                    <button
                                        onClick={() => setActiveTab('request')}
                                        className={`px-4 py-2 text-sm font-medium ${
                                            activeTab === 'request'
                                                ? 'border-b-2 border-blue-500 text-blue-600'
                                                : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        Request
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('response')}
                                        className={`px-4 py-2 text-sm font-medium ${
                                            activeTab === 'response'
                                                ? 'border-b-2 border-blue-500 text-blue-600'
                                                : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        Response
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-auto p-4">
                                    {activeTab === 'request' ? (
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="font-semibold text-sm text-gray-700 mb-2">System Instruction</h3>
                                                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                                                    {selectedGeminiLog.request.systemInstruction}
                                                </pre>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm text-gray-700 mb-2">Prompt</h3>
                                                <pre className="bg-gray-900 text-yellow-400 p-4 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                                                    {selectedGeminiLog.request.prompt}
                                                </pre>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm text-gray-700 mb-2">Config</h3>
                                                <pre className="bg-gray-900 text-blue-400 p-4 rounded text-xs overflow-auto">
                                                    {JSON.stringify(selectedGeminiLog.request.config, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {selectedGeminiLog.response.error && (
                                                <div className="bg-red-50 border border-red-200 p-4 rounded">
                                                    <h3 className="font-semibold text-sm text-red-700 mb-2">Error</h3>
                                                    <p className="text-red-600 text-sm">{selectedGeminiLog.response.error}</p>
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-semibold text-sm text-gray-700 mb-2">Raw Response</h3>
                                                <pre className="bg-gray-900 text-cyan-400 p-4 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                                                    {selectedGeminiLog.response.raw || 'No raw response'}
                                                </pre>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm text-gray-700 mb-2">Parsed Response</h3>
                                                <pre className="bg-gray-900 text-purple-400 p-4 rounded text-xs overflow-auto whitespace-pre-wrap">
                                                    {selectedGeminiLog.response.parsed 
                                                        ? JSON.stringify(selectedGeminiLog.response.parsed, null, 2)
                                                        : 'No parsed response'}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : activeMode === 'websocket' && selectedWsLog ? (
                            <div className="flex-1 overflow-auto p-4">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`text-sm px-2 py-1 rounded font-medium ${
                                            selectedWsLog.direction === 'sent' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {selectedWsLog.direction === 'sent' ? '↑ Sent' : '↓ Received'}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {selectedWsLog.timestamp.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    {selectedWsLog.error && (
                                        <div className="bg-red-50 border border-red-200 p-4 rounded">
                                            <h3 className="font-semibold text-sm text-red-700 mb-2">Parse Error</h3>
                                            <p className="text-red-600 text-sm">{selectedWsLog.error}</p>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <h3 className="font-semibold text-sm text-gray-700 mb-2">Raw Message</h3>
                                        <pre className="bg-gray-900 text-cyan-400 p-4 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                                            {selectedWsLog.raw}
                                        </pre>
                                    </div>
                                    
                                    {selectedWsLog.parsed && (
                                        <div>
                                            <h3 className="font-semibold text-sm text-gray-700 mb-2">Parsed Message</h3>
                                            <pre className="bg-gray-900 text-purple-400 p-4 rounded text-xs overflow-auto whitespace-pre-wrap">
                                                {JSON.stringify(selectedWsLog.parsed, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                Select a log entry to view details
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugPanel;
