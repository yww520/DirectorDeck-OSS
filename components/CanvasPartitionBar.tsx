import React, { useState } from 'react';
import { Folder, Plus, X, Edit2, Check, ChevronRight } from 'lucide-react';

interface CanvasPartitionBarProps {
    groups: string[];
    activeGroup: string;
    onSelectGroup: (name: string) => void;
    onCreateGroup: (name: string) => void;
    onDeleteGroup: (name: string) => void;
    onRenameGroup: (oldName: string, newName: string) => void;
    defaultGroupName?: string;
}

export const CanvasPartitionBar: React.FC<CanvasPartitionBarProps> = ({
    groups,
    activeGroup,
    onSelectGroup,
    onCreateGroup,
    onDeleteGroup,
    onRenameGroup
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingGroup, setEditingGroup] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const protectedGroupName = defaultGroupName || groups[0] || '默认分区';

    const handleCreate = () => {
        if (newName.trim()) {
            onCreateGroup(newName.trim());
            setNewName('');
            setIsCreating(false);
        }
    };

    const handleStartRename = (e: React.MouseEvent, group: string) => {
        e.stopPropagation();
        setEditingGroup(group);
        setEditValue(group);
    };

    const handleSaveRename = (e: React.MouseEvent | React.KeyboardEvent, oldName: string) => {
        e.stopPropagation();
        if (editValue.trim() && editValue !== oldName) {
            onRenameGroup(oldName, editValue.trim());
        }
        setEditingGroup(null);
    };

    return (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-950/50 border-b border-zinc-800/30 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 text-zinc-500 mr-2 flex-shrink-0">
                <Folder size={12} />
                <span className="text-[10px] uppercase font-bold tracking-widest">分镜分区</span>
                <ChevronRight size={10} className="opacity-30" />
            </div>

            {groups.map((group) => (
                <div
                    key={group}
                    onClick={() => onSelectGroup(group)}
                    className={`
                        group relative flex items-center h-7 px-3 rounded-full transition-all cursor-pointer whitespace-nowrap border
                        ${activeGroup === group
                            ? 'bg-cine-accent/10 border-cine-accent/30 text-cine-accent'
                            : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}
                    `}
                >
                    {editingGroup === group ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                className="bg-transparent border-none outline-none text-[11px] w-20 text-white"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveRename(e as any, group)}
                            />
                            <button onClick={(e) => handleSaveRename(e, group)} className="text-cine-accent">
                                <Check size={12} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="text-[11px] font-medium">{group}</span>
                            <div className="flex items-center ml-2 scale-0 group-hover:scale-100 transition-transform origin-right">
                                <button
                                    onClick={(e) => handleStartRename(e, group)}
                                    className="p-0.5 hover:text-white"
                                >
                                    <Edit2 size={10} />
                                </button>
                                {groups.length > 1 && group !== protectedGroupName && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }}
                                        className="p-0.5 hover:text-red-400 ml-1"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ))}

            {isCreating ? (
                <div className="flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded-full border border-cine-accent/30 animate-in fade-in slide-in-from-left-2 duration-200">
                    <input
                        autoFocus
                        className="bg-transparent border-none outline-none text-[11px] text-white w-24"
                        placeholder="新分区名称..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        onBlur={() => !newName && setIsCreating(false)}
                    />
                    <button onClick={handleCreate} className="text-cine-accent p-1">
                        <Check size={12} />
                    </button>
                    <button onClick={() => setIsCreating(false)} className="text-zinc-500 p-1">
                        <X size={12} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center justify-center p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-cine-accent transition-all flex-shrink-0"
                    title="创建新分区"
                >
                    <Plus size={14} />
                </button>
            )}
        </div>
    );
};
