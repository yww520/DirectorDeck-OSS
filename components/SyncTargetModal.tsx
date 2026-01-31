import React from 'react';
import { CanvasSession } from '../types';
import { Layout, Plus, X, ArrowRight } from 'lucide-react';

interface SyncTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: CanvasSession[];
    onSelect: (sessionId: string) => void;
    onCreateAndSelect: (name: string) => void;
    itemName: string;
}

export const SyncTargetModal: React.FC<SyncTargetModalProps> = ({
    isOpen,
    onClose,
    sessions,
    onSelect,
    onCreateAndSelect,
    itemName
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-lg shadow-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cine-accent shadow-[0_0_10px_#c9ff56]"></div>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">选择同步目标画布</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
                        正在同步分镜: <span className="text-cine-accent font-bold">[{itemName}]</span>
                        <br />请选择要投送的目标工作区：
                    </p>

                    <div className="space-y-6 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                        {Array.from(new Set(sessions.map(s => s.group || '默认分区'))).map(groupName => (
                            <div key={groupName} className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-1 h-3 bg-zinc-800 rounded-full"></div>
                                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{groupName}</span>
                                </div>
                                <div className="space-y-1.5 pl-1">
                                    {sessions.filter(s => (s.group || '默认分区') === groupName).map((session) => (
                                        <button
                                            key={session.id}
                                            onClick={() => onSelect(session.id)}
                                            className="w-full group flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-900 hover:border-cine-accent/50 hover:bg-cine-accent/5 rounded-sm transition-all text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Layout size={14} className="text-zinc-500 group-hover:text-cine-accent" />
                                                <p className="text-[11px] font-bold text-zinc-300 group-hover:text-white uppercase tracking-wider">{session.name}</p>
                                            </div>
                                            <ArrowRight size={12} className="text-zinc-700 group-hover:text-cine-accent group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={() => onCreateAndSelect(`${itemName}-画布`)}
                            className="w-full flex items-center gap-3 p-4 bg-cine-accent/10 border border-dashed border-cine-accent/30 hover:bg-cine-accent/20 hover:border-cine-accent rounded-md transition-all text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-cine-accent/10 flex items-center justify-center text-cine-accent">
                                <Plus size={20} />
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-cine-accent uppercase tracking-wider">新建并同步到此场景</p>
                                <p className="text-[9px] text-cine-accent/60 font-mono uppercase mt-0.5">Automated Workspace Creation</p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 text-center">
                    <p className="text-[9px] text-zinc-700 uppercase tracking-widest font-bold">
                        dierctordeck3.0 Multi-Canvas Protocol v1.0
                    </p>
                </div>
            </div>
        </div>
    );
};
