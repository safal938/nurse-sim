import React, { useRef, useState } from 'react';
import { DecisionNode } from '../types';

interface Props {
    nodes: DecisionNode[];
    onOpenChecklist: () => void;
    recentContext: string[];
}

const TreeNode: React.FC<{ node: DecisionNode; hasConvergentSibling?: boolean }> = ({ node, hasConvergentSibling }) => {
    // Separate children into standard (horizontal row) and convergent (merged below)
    const standardChildren = node.children?.filter(c => c.nodeType !== 'convergent') || [];
    const convergentChildren = node.children?.filter(c => c.nodeType === 'convergent') || [];
    
    const hasStandardChildren = standardChildren.length > 0;
    const hasConvergentChildren = convergentChildren.length > 0;
    const isRoot = node.id === 'root';

    return (
        <div className="flex flex-col items-center">
            {/* Node Card */}
            <div 
                className={`
                    relative z-10 flex flex-col items-center justify-center 
                    px-4 py-3 rounded-xl border-2 shadow-sm transition-all duration-500
                    min-w-[140px] max-w-[200px] text-center bg-white select-none
                    ${node.status === 'active' 
                        ? 'border-blue-500 text-blue-700 ring-4 ring-blue-50 shadow-blue-100 scale-105' 
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }
                    ${isRoot ? 'mb-0' : ''}
                `}
            >
                <span className="text-sm font-bold leading-tight">
                    {node.label}
                </span>
                {node.status === 'active' && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-full tracking-wider whitespace-nowrap shadow-sm">
                        Current
                    </div>
                )}
            </div>

            {/* Standard Children Rendering */}
            {hasStandardChildren && (
                <>
                    {/* Vertical Line Down from Parent to Bridge */}
                    <div className="w-px h-8 bg-slate-300"></div>
                    
                    {/* Children Container */}
                    <div className="flex items-start justify-center relative pb-2">
                        {/* Top Bridge Line (Visible if > 1 child) */}
                        {standardChildren.length > 1 && (
                            <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 mx-auto" 
                                 style={{ display: 'none' }}></div>
                        )}

                        {standardChildren.map((child, index) => {
                            const isFirst = index === 0;
                            const isLast = index === standardChildren.length - 1;
                            const isOnly = standardChildren.length === 1;

                            return (
                                <div key={child.id} className="flex flex-col items-center relative px-4">
                                    {/* Top Horizontal Connectors */}
                                    {!isOnly && (
                                        <>
                                            <div className={`absolute top-0 right-1/2 h-px bg-slate-300 ${isFirst ? 'w-0' : 'w-1/2'}`}></div>
                                            <div className={`absolute top-0 left-1/2 h-px bg-slate-300 ${isLast ? 'w-0' : 'w-1/2'}`}></div>
                                        </>
                                    )}

                                    {/* Vertical Line Up to Parent/Bridge */}
                                    <div className="w-px h-8 bg-slate-300"></div>

                                    {/* Recurse */}
                                    <TreeNode node={child} hasConvergentSibling={hasConvergentChildren} />
                                </div>
                            );
                        })}

                        {/* Bottom Bridge for Convergent Node (The Funnel) */}
                        {hasConvergentChildren && (
                             <div className="absolute bottom-0 left-4 right-4 h-4 border-b border-slate-300">
                             </div>
                        )}
                    </div>
                </>
            )}

            {/* If this node itself is a child in a group that has a convergent sibling,
                draw the line dropping down to the funnel bus */}
            {hasConvergentSibling && (
                <div className="w-px h-6 bg-slate-300"></div>
            )}

            {/* Convergent Children Rendering (The "Funnel Output") */}
            {hasConvergentChildren && (
                <>
                     {/* Vertical Line from the Funnel Bus down to the node */}
                     <div className="w-px h-8 bg-slate-300"></div>
                     
                     {/* Render the Convergent Node(s) */}
                     {convergentChildren.map(child => (
                         <div key={child.id} className="mt-0">
                             <TreeNode node={child} />
                         </div>
                     ))}
                </>
            )}
        </div>
    );
};

const DecisionSupport: React.FC<Props> = ({ nodes, onOpenChecklist, recentContext }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Use refs for drag calculations to avoid re-renders on every mouse move
    const startPos = useRef({ x: 0, y: 0 });
    const scrollPos = useRef({ left: 0, top: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        // Check if user clicked on the scrollbar (approximated by comparing mouse position to clientWidth)
        const rect = containerRef.current.getBoundingClientRect();
        // If click is within the last 15px of right or bottom edge, assume it's a scrollbar interaction
        const isOnVerticalScrollbar = e.clientX >= rect.right - 15;
        const isOnHorizontalScrollbar = e.clientY >= rect.bottom - 15;

        if (isOnVerticalScrollbar || isOnHorizontalScrollbar) {
            return; // Let the browser handle scrollbar dragging
        }

        setIsDragging(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        scrollPos.current = { 
            left: containerRef.current.scrollLeft, 
            top: containerRef.current.scrollTop 
        };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current) return;
        e.preventDefault();
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        
        containerRef.current.scrollLeft = scrollPos.current.left - dx;
        containerRef.current.scrollTop = scrollPos.current.top - dy;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    return (
        <div className="h-full bg-slate-50 border-l border-gray-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white shadow-sm z-10 flex justify-between items-center flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Decision Pathway</h2>
                    <p className="text-xs text-gray-500">Live Clinical Logic Tree</p>
                </div>
                <div className="flex space-x-2">
                     <span className="flex items-center text-xs text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Active
                     </span>
                     <span className="flex items-center text-xs text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-slate-300 mr-1"></span> History
                     </span>
                </div>
            </div>

            {/* Tree Canvas */}
            <div 
                ref={containerRef}
                className={`flex-1 overflow-auto min-h-0 p-10 relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
                style={{ 
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
                    backgroundSize: '24px 24px' 
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <div className="min-w-fit min-h-fit flex justify-center pb-20">
                    {nodes.map(node => (
                        <TreeNode key={node.id} node={node} />
                    ))}
                </div>

                {/* Dynamic Context Toast */}
                {recentContext.length > 0 && (
                    <div className="fixed bottom-20 right-8 max-w-sm w-full bg-white/95 backdrop-blur rounded-xl p-4 border border-amber-200 shadow-xl animate-in slide-in-from-bottom-10 z-50 pointer-events-none">
                        <div className="flex items-start justify-between mb-2">
                             <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center">
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                New Clinical Insights
                            </h3>
                        </div>
                        <ul className="space-y-2">
                            {recentContext.map((ctx, idx) => (
                                <li key={idx} className="text-sm text-gray-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-100">
                                    {ctx}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white border-t border-gray-200 z-20">
                <button 
                    onClick={onOpenChecklist}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center space-x-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Verify Protocol Checklist</span>
                </button>
            </div>
        </div>
    );
};

export default DecisionSupport;