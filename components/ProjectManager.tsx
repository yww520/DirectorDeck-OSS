
import React, { useState } from 'react';
import { Project, ProjectStatus } from '../types';
import {
    Briefcase, Plus, Archive, ChevronRight, Folder,
    Calendar, MoreVertical, Trash2, CheckCircle2,
    X, LayoutGrid, List
} from 'lucide-react';

interface ProjectManagerProps {
    projects: Project[];
    activeProjectId: string;
    onSwitch: (id: string) => void;
    onCreate: (name: string, description: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Project>) => void;
    onClose: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
    projects, activeProjectId, onSwitch, onCreate, onArchive, onDelete, onUpdate, onClose
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            onCreate(newName.trim(), newDesc.trim());
            setNewName('');
            setNewDesc('');
            setIsCreating(false);
        }
    };

    const activeProjects = projects.filter(p => p.status === 'active');
    const archivedProjects = projects.filter(p => p.status === 'archived');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="h-16 flex-shrink-0 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/30">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cine-accent/10 flex items-center justify-center">
                            <Briefcase size={18} className="text-cine-accent" />
                        </div>
                        <h2 className="text-white font-bold tracking-tight">项目工作空间 (Project Hub)</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="bg-cine-accent text-black px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-opacity-90 transition-all active:scale-95"
                        >
                            <Plus size={16} />
                            新建项目
                        </button>
                        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {/* Create Form Overlay */}
                    {isCreating && (
                        <div className="mb-10 bg-zinc-900/50 border border-cine-accent/30 rounded-xl p-6 animate-in slide-in-from-top-4 duration-300">
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-mono">项目名称 (Project Name)</label>
                                        <input
                                            autoFocus
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            placeholder="输入项目名称..."
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cine-accent transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-mono">项目描述 (Description)</label>
                                        <input
                                            value={newDesc}
                                            onChange={e => setNewDesc(e.target.value)}
                                            placeholder="简短的描述该项目..."
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cine-accent transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="px-6 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-cine-accent text-black px-8 py-2.5 rounded-lg text-xs font-bold hover:shadow-[0_0_20px_rgba(201,255,86,0.3)] transition-all active:scale-95"
                                    >
                                        创建并启动
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Active Projects */}
                    <div className="space-y-6 mb-12">
                        <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-cine-accent rounded-full animate-pulse"></div>
                            进行中的项目 ({activeProjects.length})
                        </h3>

                        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                            {activeProjects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    isActive={activeProjectId === project.id}
                                    viewMode={viewMode}
                                    onSwitch={() => onSwitch(project.id)}
                                    onArchive={() => onArchive(project.id)}
                                    onDelete={() => onDelete(project.id)}
                                    onUpdate={onUpdate}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Archived Projects */}
                    {archivedProjects.length > 0 && (
                        <div className="space-y-6">
                            <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                                <Archive size={14} className="text-zinc-600" />
                                已归档项目 ({archivedProjects.length})
                            </h3>

                            <div className={`grid gap-4 opacity-70 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                                {archivedProjects.map(project => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        isActive={activeProjectId === project.id}
                                        viewMode={viewMode}
                                        onSwitch={() => onSwitch(project.id)}
                                        onArchive={() => { }} // Already archived
                                        onDelete={() => onDelete(project.id)}
                                        onUpdate={onUpdate}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-12 border-t border-zinc-900 bg-black/50 flex items-center justify-between px-6 text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
                    <span>DirectorDeck v3.0 // Project Hub</span>
                    <span>Total Systems Nominal</span>
                </div>
            </div>
        </div>
    );
};

interface ProjectCardProps {
    project: Project;
    isActive: boolean;
    viewMode: 'grid' | 'list';
    onSwitch: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onUpdate: (id: string, updates: Partial<Project>) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, isActive, viewMode, onSwitch, onArchive, onDelete, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(project.name);

    const handleSave = () => {
        if (tempName.trim() && tempName !== project.name) {
            onUpdate(project.id, { name: tempName.trim() });
        }
        setIsEditing(false);
    };

    return (
        <div
            onClick={!isEditing ? onSwitch : undefined}
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className={`group relative overflow-hidden transition-all duration-300 cursor-pointer border rounded-xl ${isActive
                ? 'bg-cine-accent/5 border-cine-accent/50 shadow-[0_0_30px_rgba(201,255,86,0.05)]'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/60'
                } ${viewMode === 'list' ? 'flex items-center p-4' : 'p-5'}`}
        >
            {/* Active Indicator */}
            {isActive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 py-1 px-2 bg-cine-accent/20 border border-cine-accent/30 rounded-full">
                    <CheckCircle2 size={10} className="text-cine-accent" />
                    <span className="text-[8px] font-bold text-cine-accent uppercase tracking-tighter">当前进行中</span>
                </div>
            )}

            {/* Icon/Cover */}
            <div className={`flex-shrink-0 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 transition-colors group-hover:bg-zinc-900 ${viewMode === 'list' ? 'w-10 h-10 mr-4' : 'w-12 h-12 mb-4'
                }`}>
                <Folder size={viewMode === 'list' ? 18 : 22} className={isActive ? 'text-cine-accent' : 'text-zinc-600'} />
            </div>

            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        autoFocus
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') {
                                setTempName(project.name);
                                setIsEditing(false);
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-zinc-950 border border-cine-accent rounded px-2 py-1 text-sm text-white focus:outline-none"
                    />
                ) : (
                    <h4 className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                        {project.name}
                    </h4>
                )}
                <p className={`text-xs mt-1 truncate ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {project.description || '无描述'}
                </p>

                <div className={`flex items-center gap-4 mt-3 text-[10px] font-mono ${isActive ? 'text-zinc-500' : 'text-zinc-600'}`}>
                    <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className={`flex items-center gap-1 ml-4 transition-opacity ${viewMode === 'list' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {project.status === 'active' && !isActive && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onArchive(); }}
                        title="存档"
                        className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all"
                    >
                        <Archive size={14} />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    title="删除"
                    className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                    <Trash2 size={14} />
                </button>
                <div className="p-2 text-cine-accent">
                    <ChevronRight size={16} />
                </div>
            </div>
        </div>
    );
};

export default ProjectManager;
