
import React, { useState, useCallback } from 'react';
import { FileText, Upload, Table as TableIcon, Download, Sparkles, Plus, Trash2, Copy, AlertCircle, Share2, Search, Filter, GripVertical, Zap, Loader2, Play, Pause, Square, Film, ChevronDown, Check } from 'lucide-react';
import JSZip from 'jszip';
import { StoryboardProject, StoryboardItem, Character, Location, AspectRatio, ImageSize, ArtStyle, GeneratedImage } from '../types';
import { parseScriptToStoryboard, parseDocumentToText, fileToBase64 } from '../services/geminiService';
import SortableStoryboardRow from './SortableStoryboardRow';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

const EnhancedText: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parenRegex = /(\([^)]+\))/g;
    const parts = text.split(urlRegex);
    return (
        <>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cine-accent hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                const subParts = part.split(parenRegex);
                return subParts.map((subPart, j) => {
                    if (subPart.match(parenRegex)) {
                        return (
                            <span key={`p-${j}`} className="text-zinc-500 italic font-medium">
                                {subPart}
                            </span>
                        );
                    }
                    return subPart;
                });
            })}
        </>
    );
};

interface StoryboardLibraryProps {
    projects: StoryboardProject[];
    activeProjectId: string;
    onUpdateProjects: (projects: StoryboardProject[]) => void;
    onSyncToCanvas: (item: StoryboardItem) => void;
    generatedImages?: GeneratedImage[];
    characters?: Character[];
    locations?: Location[];
    onImageGenerated?: (image: GeneratedImage) => void;
}

const StoryboardLibrary = React.memo(({ projects, activeProjectId, onUpdateProjects, onSyncToCanvas, generatedImages = [], characters = [], locations = [], onImageGenerated }: StoryboardLibraryProps) => {
    const [scriptInput, setScriptInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [isOneClickRunning, setIsOneClickRunning] = useState(false);
    const [oneClickProgress, setOneClickProgress] = useState<{ totalItems: number, completedItems: number } | null>(null);
    const [showShotSelectorId, setShowShotSelectorId] = useState<string | null>(null);
    const [shotSearch, setShotSearch] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [collapsedItemIds, setCollapsedItemIds] = useState<Set<string>>(new Set());

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const toggleItemCollapse = useCallback((itemId: string) => {
        setCollapsedItemIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }, []);

    const toggleAllCollapse = useCallback((projectItems: StoryboardItem[]) => {
        setCollapsedItemIds(prev => {
            const allIds = projectItems.map(i => i.id);
            const areAllCollapsed = allIds.every(id => prev.has(id));
            if (areAllCollapsed) {
                const next = new Set(prev);
                allIds.forEach(id => next.delete(id));
                return next;
            } else {
                return new Set([...Array.from(prev), ...allIds]);
            }
        });
    }, []);

    const handleParse = async () => {
        if (!scriptInput.trim()) return;
        setIsParsing(true);
        try {
            const parsedItems = await parseScriptToStoryboard(scriptInput);

            // Format into 2.0 structure if AI didn't provide it
            const formattedItems: StoryboardItem[] = parsedItems.map((item, idx) => ({
                id: item.id || crypto.randomUUID(),
                shotNumber: item.shotNumber || `Sc01-${String(idx + 1).padStart(2, '0')}`,
                description: item.description || '',
                cameraAngle: item.cameraAngle || '中景',
                shotType: item.shotType || '中景',
                movement: item.movement || '推',
                location: item.location || '未知场景',
                characters: item.characters || '-',
                dialogue: item.dialogue || '-',
                sfx: item.sfx || '-',
                aiPrompt: item.aiPrompt || '',
                action: item.action || '',
                lighting: item.lighting || '自然光',
                duration: item.duration || 4,
                audioDescription: item.audioDescription || ''
            }));

            const newProject: StoryboardProject = {
                id: crypto.randomUUID(),
                projectId: activeProjectId,
                title: scriptInput.slice(0, 20) + '...',
                scriptContent: scriptInput,
                items: formattedItems,
                createdAt: Date.now()
            };
            onUpdateProjects([...projects, newProject]);
            setScriptInput('');
        } catch (error) {
            console.error("Parse failed:", error);
        } finally {
            setIsParsing(false);
        }
    };

    const handleOneClickGenerate = async (project: StoryboardProject) => {
        if (isOneClickRunning) return;
        setIsOneClickRunning(true);
        setOneClickProgress({ totalItems: project.items.length, completedItems: 0 });

        try {
            // Simplified loop for demonstration - in real app would call generation services
            for (let i = 0; i < project.items.length; i++) {
                // await generateImage(project.items[i]);
                setOneClickProgress(prev => prev ? { ...prev, completedItems: i + 1 } : null);
                await new Promise(r => setTimeout(r, 500));
            }
        } finally {
            setIsOneClickRunning(false);
            setOneClickProgress(null);
        }
    };

    const handleDeleteProject = (projectId: string) => {
        if (window.confirm('确定要删除这个分镜项目吗？')) {
            onUpdateProjects(projects.filter(p => p.id !== projectId));
        }
    };

    const handleDragEnd = (event: any, projectId: string) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const projectIndex = projects.findIndex(p => p.id === projectId);
            const project = projects[projectIndex];
            const oldIndex = project.items.findIndex(i => i.id === active.id);
            const newIndex = project.items.findIndex(i => i.id === over.id);

            const updatedItems = arrayMove(project.items, oldIndex, newIndex);
            const updatedProjects = [...projects];
            updatedProjects[projectIndex] = { ...project, items: updatedItems };
            onUpdateProjects(updatedProjects);
        }
    };

    const handleDeleteShot = (projectId: string, shotId: string) => {
        if (window.confirm('确定要删除这个分镜镜头吗？')) {
            const updatedProjects = projects.map(p => {
                if (p.id === projectId) {
                    return { ...p, items: p.items.filter(i => i.id !== shotId) };
                }
                return p;
            });
            onUpdateProjects(updatedProjects);
        }
    };

    const handleDownloadProjectAssets = async (project: StoryboardProject) => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const zip = new JSZip();
            const itemIds = new Set(project.items.map(i => i.id));

            // Filter images that belong to this storyboard project's shots
            const relatedImages = generatedImages.filter(img =>
                img.sourceShotId && itemIds.has(img.sourceShotId)
            );

            if (relatedImages.length === 0) {
                alert("未找到该项目已生成的素材");
                setIsDownloading(false);
                return;
            }

            const imgFolder = zip.folder("images");
            const vidFolder = zip.folder("videos");
            const sliceFolderRoot = zip.folder("slices");

            for (const img of relatedImages) {
                const shotItem = project.items.find(item => item.id === img.sourceShotId);
                const label = shotItem?.shotNumber || img.id.slice(0, 8);
                const safeLabel = label.replace(/[<>:"/\\|?*]/g, '_');

                // 1. Image
                if (img.url) {
                    if (img.url.startsWith('data:')) {
                        const [header, data] = img.url.split(',');
                        const ext = header.includes('png') ? 'png' : 'jpg';
                        imgFolder?.file(`${safeLabel}.${ext}`, data, { base64: true });
                    } else {
                        try {
                            const res = await fetch(img.url);
                            const blob = await res.blob();
                            imgFolder?.file(`${safeLabel}.png`, blob);
                        } catch (e) { console.error(e); }
                    }
                }

                // 2. Video
                if (img.videoBlob || img.videoUrl) {
                    if (img.videoBlob) {
                        vidFolder?.file(`${safeLabel}.mp4`, img.videoBlob);
                    } else if (img.videoUrl) {
                        try {
                            const res = await fetch(img.videoUrl);
                            vidFolder?.file(`${safeLabel}.mp4`, await res.blob());
                        } catch (e) { console.error(e); }
                    }
                }

                // 3. Slices
                if (img.slices && img.slices.length > 0) {
                    const itemSliceFolder = sliceFolderRoot?.folder(safeLabel);
                    for (let i = 0; i < img.slices.length; i++) {
                        const sliceUrl = img.slices[i];
                        if (sliceUrl.startsWith('data:')) {
                            const [header, data] = sliceUrl.split(',');
                            const ext = header.includes('png') ? 'png' : 'jpg';
                            itemSliceFolder?.file(`slice_${i + 1}.${ext}`, data, { base64: true });
                        }
                    }
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${project.title.slice(0, 20)}_assets.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed:", error);
            alert("下载失败，请稍后重试");
        } finally {
            setIsDownloading(false);
        }
    };

    const filteredLocations = Array.from(new Set(projects.flatMap(p => p.items.map(i => i.location))));

    return (
        <div className="flex flex-col h-full bg-[#0a0a0b] text-zinc-300 overflow-hidden font-sans">
            {/* Header / Script Input */}
            <div className="p-8 border-b border-zinc-800/10 bg-gradient-to-b from-zinc-900/20 to-transparent">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                                <FileText className="text-cine-accent" />
                                分镜剧本库 <span className="text-zinc-700 text-sm font-light">Directorial Deck 2.0</span>
                            </h2>
                            <p className="text-zinc-500 text-sm">将文学剧本精准解析为可视化分镜、角色与动作指令。</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 rounded-xl text-xs font-black transition-all flex items-center gap-2">
                                <Upload size={14} /> 导入 DOCX/PDF
                            </button>
                        </div>
                    </div>

                    <div className="relative group">
                        <textarea
                            value={scriptInput}
                            onChange={(e) => setScriptInput(e.target.value)}
                            placeholder="在此输入您的文学剧本片段 (场景描述、台词、导演指令...)"
                            className="w-full h-32 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-4 focus:ring-cine-accent/10 focus:border-cine-accent/30 transition-all resize-none text-sm leading-relaxed"
                        />
                        <button
                            onClick={handleParse}
                            disabled={isParsing || !scriptInput.trim()}
                            className={`absolute bottom-6 right-6 px-8 py-3 rounded-2xl flex items-center gap-3 font-black text-sm transition-all shadow-2xl ${isParsing || !scriptInput.trim()
                                ? 'bg-zinc-800 text-zinc-600'
                                : 'bg-cine-accent text-black hover:bg-[#d4fc79] hover:scale-105 active:scale-95 shadow-cine-accent/20'
                                }`}
                        >
                            {isParsing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} fill="currentColor" />}
                            {isParsing ? '正在解析剧本指令...' : '解析生成分镜'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Toolbar / Filters */}
            <div className="px-8 py-4 border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input
                            type="text"
                            placeholder="全局搜索分镜描述、关键词..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="w-full bg-zinc-900/40 border border-zinc-800/30 rounded-full pl-12 pr-4 py-2 text-sm focus:outline-none focus:border-cine-accent/30 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-800/30 rounded-full px-4 py-1.5">
                            <Filter size={14} className="text-zinc-600" />
                            <select
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
                            >
                                <option value="all">所有场景</option>
                                {filteredLocations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Projects List */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth">
                <div className="max-w-6xl mx-auto space-y-20 pb-20">
                    {projects.length === 0 && !isParsing && (
                        <div className="flex flex-col items-center justify-center py-40 text-center opacity-30 select-none">
                            <TableIcon size={80} strokeWidth={0.5} className="mb-6" />
                            <h3 className="text-2xl font-black uppercase tracking-[0.2em]">Repository Empty</h3>
                            <p className="max-w-xs mt-2 text-sm">解析您的第一个剧本片断来开始分镜创作</p>
                        </div>
                    )}

                    {projects.map(project => {
                        const filteredItems = project.items.filter(item => {
                            const query = filterQuery.toLowerCase();
                            const matchesSearch = query === '' ||
                                item.description.toLowerCase().includes(query) ||
                                item.location.toLowerCase().includes(query) ||
                                item.characters.toLowerCase().includes(query) ||
                                item.shotNumber.toLowerCase().includes(query) ||
                                (item.shotType && item.shotType.toLowerCase().includes(query));

                            const matchesLocation = selectedLocation === 'all' || item.location === selectedLocation;

                            return matchesSearch && matchesLocation;
                        });

                        if (filteredItems.length === 0 && (filterQuery || selectedLocation !== 'all')) return null;

                        return (
                            <div key={project.id} className="space-y-6 pt-10 border-t border-zinc-800/20 first:border-0 first:pt-0">
                                {/* Reference-style Project Header */}
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4 px-2">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 border border-orange-500/20">
                                            <Film size={24} />
                                        </div>
                                        <div className="space-y-1 pt-1">
                                            <h3 className="text-xl font-black text-white tracking-tight">
                                                <EnhancedText text={project.title} />
                                            </h3>
                                            <p className="text-zinc-500 text-xs font-medium">
                                                由 AI 从剧本自动生成，共 {project.items.length} 个镜头
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDeleteProject(project.id)}
                                            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 rounded-xl transition-all"
                                            title="删除项目"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadProjectAssets(project)}
                                            disabled={isDownloading}
                                            className={`p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl transition-all ${isDownloading ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-white'}`}
                                            title="下载项目配套素材"
                                        >
                                            {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                        </button>
                                        <button className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white rounded-xl transition-all" title="导出数据">
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleOneClickGenerate(project)}
                                            disabled={isOneClickRunning}
                                            className={`px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition-all ${isOneClickRunning
                                                ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                                                : 'bg-orange-600 text-white hover:bg-orange-500 shadow-xl shadow-orange-900/20'
                                                }`}
                                        >
                                            {isOneClickRunning ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                                            {isOneClickRunning ? '正在生成...' : '添加镜头'}
                                        </button>
                                    </div>
                                </div>

                                {/* Shot List Subheader & Compact Stats */}
                                <div className="flex items-center justify-between py-3 px-2 border-b border-zinc-800/20 mb-2">
                                    <div className="flex items-center gap-6">
                                        <div className="relative">
                                            <span
                                                className="text-[11px] font-black text-zinc-300 cursor-pointer hover:text-cine-accent transition-colors select-none flex items-center gap-1 group/header"
                                                onDoubleClick={() => {
                                                    setShowShotSelectorId(project.id);
                                                    setShotSearch('');
                                                }}
                                                title="双击选择分镜序号"
                                            >
                                                镜头列表 ({filteredItems.length}{filteredItems.length !== project.items.length ? ` / ${project.items.length}` : ''})
                                                <ChevronDown size={12} className="opacity-0 group-hover/header:opacity-100 transition-opacity" />
                                            </span>

                                            <button
                                                onClick={() => toggleAllCollapse(project.items)}
                                                className="ml-4 px-2 py-0.5 bg-zinc-900/50 border border-zinc-800 rounded text-[9px] font-bold text-zinc-500 hover:text-cine-accent hover:border-cine-accent/30 transition-all flex items-center gap-1.5"
                                            >
                                                {project.items.every(i => collapsedItemIds.has(i.id)) ? <Plus size={10} /> : <Pause size={10} className="rotate-90" />}
                                                {project.items.every(i => collapsedItemIds.has(i.id)) ? '展开全部' : '收起全部'}
                                            </button>

                                            {showShotSelectorId === project.id && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-[60]"
                                                        onClick={() => setShowShotSelectorId(null)}
                                                    />
                                                    <div className="absolute top-full left-0 mt-2 z-[70] w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl bg-opacity-95 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="p-2 border-b border-zinc-800 bg-black/20">
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" size={10} />
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    placeholder="搜索序号..."
                                                                    value={shotSearch}
                                                                    onChange={(e) => setShotSearch(e.target.value)}
                                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] focus:outline-none focus:border-cine-accent/50"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto custom-scrollbar scroll-smooth">
                                                            <button
                                                                onClick={() => {
                                                                    setFilterQuery('');
                                                                    setSelectedLocation('all');
                                                                    setShowShotSelectorId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-zinc-500 hover:bg-zinc-800 hover:text-cine-accent transition-colors flex items-center justify-between"
                                                            >
                                                                显示全部镜头内容 (重置)
                                                                {filterQuery === '' && selectedLocation === 'all' && <Check size={10} />}
                                                            </button>
                                                            {project.items
                                                                .filter(item => item.shotNumber.toLowerCase().includes(shotSearch.toLowerCase()))
                                                                .map(item => (
                                                                    <button
                                                                        key={item.id}
                                                                        onClick={() => {
                                                                            setFilterQuery(item.shotNumber);
                                                                            setShowShotSelectorId(null);
                                                                        }}
                                                                        className={`w-full text-left px-4 py-2 text-[10px] font-mono transition-colors flex items-center justify-between ${filterQuery === item.shotNumber ? 'bg-cine-accent/10 text-cine-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                                                    >
                                                                        {item.shotNumber}
                                                                        {filterQuery === item.shotNumber && <Check size={10} />}
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="h-4 w-px bg-zinc-800/50" />

                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">出演角色:</span>
                                            <div className="flex -space-x-1.5">
                                                {Array.from(new Set(project.items.flatMap(i => i.characters.split(',').map(c => c.trim())))).filter(c => c !== '-' && c.length > 0).slice(0, 5).map((char, i) => (
                                                    <div
                                                        key={char + i}
                                                        className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[8px] font-black text-zinc-400"
                                                        title={char}
                                                    >
                                                        {char[0]}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                                        <span className="flex items-center gap-2">
                                            <Play size={10} />
                                            总时长: {project.items.reduce((acc: number, curr: StoryboardItem) => acc + (curr.duration || 4), 0)}s
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <TableIcon size={10} />
                                            场景数: {new Set(project.items.map(i => i.location)).size}
                                        </span>
                                    </div>
                                </div>

                                {/* Cards List */}
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(e) => handleDragEnd(e, project.id)}
                                >
                                    <SortableContext
                                        items={filteredItems.map(i => i.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-2">
                                            {filteredItems.map((item) => (
                                                <SortableStoryboardRow
                                                    key={item.id}
                                                    item={item}
                                                    onSyncToCanvas={onSyncToCanvas}
                                                    onFilterByShot={(s) => setFilterQuery(s)}
                                                    onFilterByLocation={(l) => setSelectedLocation(l)}
                                                    onFilterByCharacter={(c) => { setFilterQuery(c); }}
                                                    previewImage={generatedImages.find(img => img.sourceShotId === item.id)}
                                                    onDelete={(shotId) => handleDeleteShot(project.id, shotId)}
                                                    isCollapsed={collapsedItemIds.has(item.id)}
                                                    onToggleCollapse={() => toggleItemCollapse(item.id)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

StoryboardLibrary.displayName = 'StoryboardLibrary';

export default StoryboardLibrary;
