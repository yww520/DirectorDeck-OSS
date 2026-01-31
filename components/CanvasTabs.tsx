import React, { useState } from 'react';
import { CanvasSession } from '../types';
import { Plus, X, Edit2, Check, Layout, MoreVertical } from 'lucide-react';

interface CanvasTabsProps {
    sessions: CanvasSession[];
    activeSessionId: string;
    activeGroup: string;
    onSelect: (id: string) => void;
    onCreate: (name: string, group?: string) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
}

export const CanvasTabs = React.memo(({
    sessions,
    activeSessionId,
    activeGroup,
    onSelect,
    onCreate,
    onDelete,
    onRename
}: CanvasTabsProps) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const filteredSessions = sessions.filter(s => (s.group || '默认分区') === activeGroup);

    const handleStartRename = (session: CanvasSession) => {
        setEditingId(session.id);
        setEditValue(session.name);
    };

    const handleSaveRename = (id: string) => {
        if (editValue.trim()) {
            onRename(id, editValue.trim());
        }
        setEditingId(null);
    };

    const handleCreate = () => {
        const name = `新画布 ${filteredSessions.length + 1}`;
        onCreate(name, activeGroup);
    };

    return (
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar no-scrollbar py-2 px-4 bg-black border-b border-zinc-800/50">
            {filteredSessions.map((session) => (
                <div
                    key={session.id}
                    className={`
                        group relative flex items-center h-9 px-4 rounded-t-md transition-colors cursor-pointer border-t border-x
                        ${activeSessionId === session.id
                            ? 'bg-cine-dark border-zinc-700 text-cine-accent'
                            : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                    `}
                    onClick={() => onSelect(session.id)}
                >
                    <Layout size={12} className="mr-2 opacity-50" />

                    {editingId === session.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                className="bg-zinc-800 border-none outline-none text-[11px] px-1 py-0.5 rounded w-24 text-white"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveRename(session.id)}
                            />
                            <button onClick={() => handleSaveRename(session.id)} className="text-cine-accent">
                                <Check size={12} />
                            </button>
                        </div>
                    ) : (
                        <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap truncate max-w-[120px]">
                            {session.name}
                        </span>
                    )}

                    <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId !== session.id && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStartRename(session); }}
                                className="p-1 hover:text-white"
                            >
                                <Edit2 size={10} />
                            </button>
                        )}
                        {sessions.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                                className="p-1 hover:text-red-400"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>

                    {activeSessionId === session.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cine-accent"></div>
                    )}
                </div>
            ))}

            <button
                onClick={handleCreate}
                className="flex items-center justify-center w-8 h-8 ml-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-cine-accent transition-colors"
                title="创建新画布"
            >
                <Plus size={16} />
            </button>
        </div>
    );
});
