import React, { useState, useRef, useEffect } from 'react';
import { GeneratedImage, Asset, Character, Location } from '../types';
import { Trash2, Workflow, LayoutGrid, Video, X, Maximize2, Zap, Users, MapPin, MonitorPlay, Layers, Loader2, Share2, Download, Wand2 } from 'lucide-react';
import { Button } from './Button';
import { TranslateButton } from './TranslateButton';
import { InpaintEditor } from './InpaintEditor';
import { QwenEditor } from './QwenEditor';
import { Camera } from 'lucide-react';

interface CanvasProps {
    images: GeneratedImage[];
    characters: Character[];
    assets: Asset[];
    onSelect: (image: GeneratedImage, isMulti: boolean, sliceIndex?: number) => void;
    onSelectMultiple: (ids: string[]) => void;
    selectedIds: string[];
    onDelete: (id: string) => void;
    onUpdateNodePosition: (id: string, x: number, y: number) => void;
    onUpdateNodeData: (id: string, data: Partial<GeneratedImage>) => void;
    onLinkNodes: (sourceId: string, targetId: string) => void;
    onGenerateFromNode: (node: GeneratedImage) => void;
    onDownloadAll: () => void;
    onAutoAlign: () => void;
    locations: Location[];
}

type ViewMode = 'workflow' | 'grid';

// --- VEO High Performance Video Player ---
const VeoVideoStream = React.memo(({ image }: { image: GeneratedImage }) => {
    return (
        <div className="w-full h-full relative bg-black group/vid">
            {image.videoUrl ? (
                <video
                    src={image.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain pointer-events-none"
                    draggable="false"
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <Loader2 size={24} className="text-cine-accent animate-spin" />
                    <span className="text-[10px] font-black text-cine-accent/50 uppercase tracking-[0.2em]">Veo Engine Processing...</span>
                </div>
            )}

            <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 bg-cine-accent rounded-full border border-cine-accent/30 shadow-xl text-black">
                <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                <span className="text-[9px] font-black text-black italic tracking-widest uppercase">
                    {image.provider === 'jimeng-web' ? 'Jimeng Web Live' :
                        image.provider === 'jimeng' ? 'Jimeng AI Live' :
                            image.modelId?.includes('veo') ? 'Veo Engine Live' : 'AI Video Live'}
                </span>
            </div>

            {/* Cinematic Overlay */}
            <div className="absolute inset-0 border-[20px] border-black/20 pointer-events-none" />
        </div>
    );
});

// --- Node Component (Refined Assets & IO) ---
const Node = React.memo(({ image, selectedIds, onSelect, onDelete, onMouseDown, onStartLink, onCompleteLink, allCharacters, allLocations, onUpdateData, onGenerate, onShowInpaint, onShowQwen, onResizeStart, isStatic }: {
    image: GeneratedImage;
    selectedIds: string[];
    onSelect: (isMulti: boolean, sliceIndex?: number) => void;
    onDelete: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onStartLink: (e: React.MouseEvent) => void;
    onCompleteLink: () => void;
    allCharacters: Character[];
    allLocations: Location[];
    onUpdateData?: (id: string, data: Partial<GeneratedImage>) => void;
    onGenerate?: (node: GeneratedImage) => void;
    onShowInpaint: (url: string, index: number) => void;
    onShowQwen: (url: string, index: number) => void;
    onResizeStart: (e: React.MouseEvent, mode: 'tl' | 'tr' | 'bl' | 'br') => void;
    isStatic?: boolean;
}) => {
    const isVideoNode = image.nodeType === 'video';
    const isPromptNode = image.nodeType === 'prompt';
    const isRenderNode = image.nodeType === 'render';
    const selected = selectedIds.includes(image.id);
    const [isCharChoiceOpen, setIsCharChoiceOpen] = useState(false);
    const [isLocChoiceOpen, setIsLocChoiceOpen] = useState(false);
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);

    // Dynamic Asset Mapping for thumbnails
    const selectedAssets = [
        ...(image.selectedCharacterIds || []).map(id => {
            const form = allCharacters.flatMap(c => c.forms).find(f => f.id === id);
            return { id, url: form?.frontViewUrl || form?.multiViewUrl, type: 'char' };
        }),
        ...(image.selectedLocationIds || []).map(id => {
            const form = allLocations.flatMap(l => l.forms).find(f => f.id === id);
            return { id, url: form?.url, type: 'loc' };
        })
    ].slice(0, 4);

    const toggleAsset = (assetId: string, type: 'char' | 'loc') => {
        const field = type === 'char' ? 'selectedCharacterIds' : 'selectedLocationIds';
        const current = (image as any)[field] || [];
        const next = current.includes(assetId) ? current.filter((i: string) => i !== assetId) : [...current, assetId];
        onUpdateData?.(image.id, { [field]: next });
    };

    return (
        <div
            className={`${isStatic ? 'relative h-auto' : 'absolute'} bg-zinc-950 border rounded-sm shadow-2xl ${selected ? 'border-cine-accent ring-2 ring-cine-accent/50 z-30' : 'border-zinc-800 z-10 hover:border-zinc-700'} ${isVideoNode ? 'border-cine-accent shadow-[0_0_40px_rgba(201,255,86,0.2)]' : ''}`}
            style={{
                left: isStatic ? 'auto' : (image.position?.x || 0),
                top: isStatic ? 'auto' : (image.position?.y || 0),
                width: isStatic ? 'auto' : (image.width || (isVideoNode ? 420 : 340))
            }}
            onMouseDown={onMouseDown}
        >
            {/* Resize Handles */}
            {!isStatic && (
                <>
                    <div className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize z-[100] group/hdl" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'tl'); }}>
                        <div className="w-1.5 h-1.5 bg-cine-accent rounded-full opacity-0 group-hover/hdl:opacity-100 transition-opacity m-1 shadow-[0_0_10px_rgba(201,255,86,1)]" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize z-[100] group/hdl" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'tr'); }}>
                        <div className="w-1.5 h-1.5 bg-cine-accent rounded-full opacity-0 group-hover/hdl:opacity-100 transition-opacity m-1 shadow-[0_0_10px_rgba(201,255,86,1)]" />
                    </div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize z-[100] group/hdl" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bl'); }}>
                        <div className="w-1.5 h-1.5 bg-cine-accent rounded-full opacity-0 group-hover/hdl:opacity-100 transition-opacity m-1 shadow-[0_0_10px_rgba(201,255,86,1)]" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-[100] group/hdl" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'br'); }}>
                        <div className="w-1.5 h-1.5 bg-cine-accent rounded-full opacity-0 group-hover/hdl:opacity-100 transition-opacity m-1 shadow-[0_0_10px_rgba(201,255,86,1)]" />
                    </div>
                </>
            )}
            {!isStatic && (
                <>
                    {/* IO DOTS */}
                    <div className={`absolute left-1/2 -translate-x-1/2 -top-2 w-4 h-4 rounded-full border-2 border-zinc-950 cursor-crosshair z-50 transition-transform hover:scale-125 ${isVideoNode ? 'bg-cine-accent' : 'bg-zinc-800 hover:bg-zinc-400'}`} onMouseUp={onCompleteLink} />

                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rounded-full bg-zinc-600 border-2 border-zinc-950 cursor-crosshair hover:bg-cine-accent z-50 transition-transform hover:scale-125" onMouseDown={onStartLink} />
                </>
            )}

            {/* Header */}
            <div
                className={`px-4 py-2.5 border-b flex justify-between items-center bg-black/50 rounded-t-sm ${!isStatic ? 'cursor-grab active:cursor-grabbing hover:bg-black/70' : ''} ${isVideoNode ? 'border-cine-accent/40' : 'border-zinc-800'}`}
                onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey); }}
            >
                <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${isVideoNode ? 'text-cine-accent' : 'text-zinc-500'}`}>
                    {image.customLabel || image.cameraDescription || (isVideoNode ? 'VEO AI RENDER UNIT' : 'SHOT MODULE')}
                </span>
                <div className="flex items-center gap-2">
                    {isVideoNode && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (image.videoUrl) {
                                        const a = document.createElement('a');
                                        a.href = image.videoUrl;
                                        a.download = `veo_render_${image.id}.mp4`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    }
                                }}
                                className="p-1.5 rounded transition-all text-zinc-700 hover:text-cine-accent border border-transparent"
                                title="Download Video"
                            >
                                <Download size={13} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(false);
                                    onUpdateData?.(image.id, { isSyncedToEditor: !image.isSyncedToEditor });
                                }}
                                className={`p-1.5 rounded transition-all ${image.isSyncedToEditor ? 'text-cine-accent bg-cine-accent/10 border border-cine-accent/20' : 'text-zinc-700 hover:text-zinc-400 border border-transparent'}`}
                                title={image.isSyncedToEditor ? "已同步至剪辑区" : "同步至剪辑区"}
                            >
                                <Share2 size={13} />
                            </button>
                        </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-zinc-700 hover:text-red-500 transition-colors p-1.5">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 bg-gradient-to-b from-black/20 to-transparent">
                {isVideoNode ? (
                    <div className="space-y-4">
                        <div className="relative aspect-video rounded-sm border border-zinc-900 overflow-hidden shadow-2xl">
                            <VeoVideoStream image={image} />
                        </div>
                        <div className="p-3 bg-cine-accent/5 border border-cine-accent/10 rounded-sm flex items-start gap-3 relative group/prompt">
                            <MonitorPlay size={14} className="text-cine-accent mt-0.5 shrink-0" />
                            <textarea
                                className="w-full bg-transparent text-[10px] text-zinc-500 font-mono leading-relaxed outline-none resize-none custom-scrollbar min-h-[40px] italic"
                                value={image.motionConfig?.customInstruction || image.prompt || ''}
                                onChange={(e) => onUpdateData?.(image.id, {
                                    motionConfig: { ...(image.motionConfig || {}), customInstruction: e.target.value } as any
                                })}
                                onMouseDown={(e) => e.stopPropagation()}
                                placeholder="Edit generation prompt..."
                            />
                            <TranslateButton
                                text={image.motionConfig?.customInstruction || image.prompt || ''}
                                onTranslate={(val) => onUpdateData?.(image.id, {
                                    motionConfig: { ...(image.motionConfig || {}), customInstruction: val } as any
                                })}
                                className="absolute bottom-2 right-2 opacity-0 group-hover/prompt:opacity-100 transition-opacity scale-75 origin-bottom-right"
                            />
                        </div>
                    </div>
                ) : isPromptNode ? (
                    <div className="space-y-5">
                        <div className="relative group/prompt">
                            <textarea
                                className="w-full p-4 text-cine-accent text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-sm min-h-[150px] outline-none focus:border-cine-accent/40 selection:bg-cine-accent selection:text-black resize-none"
                                value={image.textData || ''}
                                onChange={(e) => onUpdateData?.(image.id, { textData: e.target.value })}
                                onMouseDown={(e) => e.stopPropagation()}
                                placeholder="Describe your cinematic shot here..."
                            />
                            <TranslateButton
                                text={image.textData || ''}
                                onTranslate={(val) => onUpdateData?.(image.id, { textData: val })}
                                className="absolute bottom-3 right-3 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                            />
                        </div>

                        <div className="flex justify-between items-center py-3 border-y border-zinc-900/50">
                            <div className="flex gap-2.5">
                                {/* Character Picker */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsCharChoiceOpen(!isCharChoiceOpen); setIsLocChoiceOpen(false); }}
                                        className={`w-10 h-10 rounded-full border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${image.selectedCharacterIds?.length ? 'bg-cine-accent/20 border-cine-accent text-cine-accent shadow-[0_0_15px_rgba(201,255,86,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                                        <Users size={18} />
                                    </button>
                                    {isCharChoiceOpen && (
                                        <div className="absolute bottom-full left-0 mb-4 w-72 bg-zinc-950 border border-zinc-800 shadow-3xl rounded-sm p-4 z-50 animate-in fade-in slide-in-from-bottom-3" onMouseDown={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Select Primary Character</p>
                                                <button onClick={() => setIsCharChoiceOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={12} /></button>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3 max-h-56 overflow-y-auto custom-scrollbar">
                                                {allCharacters.flatMap(c => c.forms).map(form => (
                                                    <button key={form.id} onClick={(e) => { e.stopPropagation(); toggleAsset(form.id, 'char'); }} className={`aspect-square rounded-sm overflow-hidden border-2 transition-all ${image.selectedCharacterIds?.includes(form.id) ? 'border-cine-accent scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                                            {(form.frontViewUrl || form.multiViewUrl) ? (
                                                                <img src={form.frontViewUrl || form.multiViewUrl} className="w-full h-full object-cover" draggable="false" />
                                                            ) : (
                                                                <Users size={16} className="text-zinc-800" />
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Location Picker */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsLocChoiceOpen(!isLocChoiceOpen); setIsCharChoiceOpen(false); }}
                                        className={`w-10 h-10 rounded-full border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${image.selectedLocationIds?.length ? 'bg-cine-accent/20 border-cine-accent text-cine-accent shadow-[0_0_15px_rgba(201,255,86,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                                        <MapPin size={18} />
                                    </button>
                                    {isLocChoiceOpen && (
                                        <div className="absolute bottom-full left-0 mb-4 w-72 bg-zinc-950 border border-zinc-800 shadow-3xl rounded-sm p-4 z-50 animate-in fade-in slide-in-from-bottom-3" onMouseDown={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Select Scene Context</p>
                                                <button onClick={() => setIsLocChoiceOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={12} /></button>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3 max-h-56 overflow-y-auto custom-scrollbar">
                                                {allLocations.flatMap(l => l.forms).map(form => (
                                                    <button key={form.id} onClick={(e) => { e.stopPropagation(); toggleAsset(form.id, 'loc'); }} className={`aspect-square rounded-sm overflow-hidden border-2 transition-all ${image.selectedLocationIds?.includes(form.id) ? 'border-cine-accent scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                                        {form.url ? (
                                                            <img src={form.url} className="w-full h-full object-cover" draggable="false" />
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><MapPin size={14} className="text-zinc-600" /></div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* DYNAMIC THUMBNAILS (Combined Characters & Locations) */}
                            <div className="flex -space-x-3">
                                {selectedAssets.map(asset => (
                                    <div key={asset.id} className={`w-8 h-8 rounded-full border-2 bg-zinc-900 overflow-hidden shadow-2xl transition-transform hover:-translate-y-1 ${asset.type === 'char' ? 'border-cine-accent' : 'border-cine-accent'}`}>
                                        {asset.url ? (
                                            <img src={asset.url} className="w-full h-full object-cover" draggable="false" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-800">
                                                {asset.type === 'char' ? <Users size={10} /> : <MapPin size={10} />}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button variant="accent" className="w-full h-14 text-[12px] uppercase font-black tracking-[0.4em] shadow-[0_10px_30px_rgba(201,255,86,0.15)] active:scale-95 transition-all" onClick={(e) => { e.stopPropagation(); onGenerate?.(image); }}>
                            <Zap size={18} className="mr-3 fill-black" /> RENDER SEQUENCE
                        </Button>
                    </div>
                ) : isRenderNode ? (
                    <div className="space-y-3">
                        {/* 使用参考版本的 aspectRatio 计算方式，确保容器高度正确 */}
                        <div
                            className="relative w-full bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden"
                            style={{ aspectRatio: image.aspectRatio ? image.aspectRatio.replace(':', '/') : '16/9' }}
                        >
                            {expandedSlice ? (
                                <div className="w-full h-full relative">
                                    <img src={expandedSlice} className="w-full h-full object-contain cursor-zoom-out bg-black" onClick={() => setExpandedSlice(null)} draggable="false" />
                                    <button className="absolute top-3 right-3 p-1.5 bg-black/70 text-white rounded-full transition-transform hover:scale-110" onClick={(e) => { e.stopPropagation(); setExpandedSlice(null); }}><X size={16} /></button>
                                </div>
                            ) : (
                                /* 使用参考版本的 grid 布局方式: w-full h-full 确保填满容器 */
                                <div
                                    className={`grid w-full h-full gap-[1px] bg-black ${image.slices?.length === 9 ? 'grid-cols-3' :
                                        image.slices?.length >= 16 ? 'grid-cols-4' :
                                            image.slices?.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                                        }`}
                                >
                                    {image.slices?.map((url, idx) => {
                                        const isSel = selectedIds.includes(`${image.id}:${idx}`);
                                        return (
                                            <div
                                                key={idx}
                                                className={`relative w-full h-full overflow-hidden cursor-pointer group transition-all ${isSel ? 'outline outline-4 outline-cine-accent -outline-offset-4 z-20 scale-[1.05] shadow-2xl' : 'hover:opacity-90'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(e.shiftKey, idx);
                                                    if (!e.shiftKey) setExpandedSlice(url);
                                                }}
                                            >
                                                <img src={url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" draggable="false" />

                                                {/* Action Buttons Overlay */}
                                                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log("Camera Button Clicked");
                                                            onShowQwen(url, idx);
                                                        }}
                                                        className="p-2 bg-black/80 backdrop-blur-md rounded-lg text-white hover:text-cine-accent border border-white/10 shadow-xl"
                                                        title="镜头操控 (Camera Edit)"
                                                    >
                                                        <Camera size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log("Inpaint Button Clicked");
                                                            onShowInpaint(url, idx);
                                                        }}
                                                        className="p-2 bg-black/80 backdrop-blur-md rounded-lg text-white hover:text-cine-accent border border-white/10 shadow-xl"
                                                        title="局部重绘 (Inpaint)"
                                                    >
                                                        <Wand2 size={14} />
                                                    </button>
                                                </div>

                                                {/* Hover Overlay */}
                                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />

                                                {isSel && <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-cine-accent text-black flex items-center justify-center font-black text-[10px] shadow-lg border-2 border-black">{selectedIds.indexOf(`${image.id}:${idx}`) + 1}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-600 tracking-[0.2em] uppercase">
                            <span>{image.id.split('-')[0]}</span>
                            <div className="flex gap-3">
                                <Video size={11} className={image.videoUrl ? 'text-cine-accent animate-pulse' : ''} />
                                <Layers size={11} />
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
});

// --- Connection Component ---
const ConnectionLine = React.memo(({ start, end, startWidth, isDragging, isVideoLink }: { start: { x: number, y: number }, end: { x: number, y: number }, startWidth: number, isDragging?: boolean, isVideoLink?: boolean }) => {
    // Horizontal workflow: connections go from RIGHT side of source to LEFT side of target

    // Source point: right-center of source node
    const nodeHeight = 200; // Approximate node height for centering
    const sx = start.x + startWidth; // Right edge of source node
    const sy = start.y + (nodeHeight / 2); // Vertical center

    // End point: left-center of target node
    const ex = end.x;
    const ey = end.y + (nodeHeight / 2);

    // Horizontal S-curve: control points extend horizontally
    const controlOffset = Math.min(80, Math.abs(ex - sx) / 3);
    const path = `M ${sx} ${sy} C ${sx + controlOffset} ${sy}, ${ex - controlOffset} ${ey}, ${ex} ${ey}`;

    return (
        <g>
            <path d={path} stroke={"#c9ff56"} strokeWidth={isDragging ? 3 : 2} fill="none" opacity={isDragging ? 0.9 : 0.3} strokeDasharray={isDragging ? "10 5" : "none"} />
            {!isDragging && <path d={path} stroke={"#c9ff56"} strokeWidth={2} fill="none" className="animate-flow" strokeDasharray="10 15" />}
        </g>
    );
});

// --- MAIN CANVAS MODULE ---
export const Canvas: React.FC<CanvasProps> = (props) => {
    const [viewMode, setViewMode] = useState<ViewMode>('workflow');
    const [pan, setPan] = useState({ x: 80, y: 80 });
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [drgId, setDrgId] = useState<string | null>(null);
    const [rszId, setRszId] = useState<string | null>(null);
    const [rszMode, setRszMode] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [lnkId, setLnkId] = useState<string | null>(null);
    const [lnkPos, setLnkPos] = useState({ x: 0, y: 0 });
    const lastM = useRef({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

    const [inpaintTarget, setInpaintTarget] = useState<{ nodeId: string, url: string, index: number, prompt?: string } | null>(null);
    const [qwenTarget, setQwenTarget] = useState<{ nodeId: string, url: string, index: number } | null>(null);

    // Robust Zoom Handling
    useEffect(() => {
        const el = containerRef.current;
        if (!el || viewMode !== 'workflow') return; // Only bind in workflow mode

        const onWheel = (e: WheelEvent) => {
            // Only intervene if we are in workflow mode
            // We prevent default to stop page scroll, allowing pure canvas zoom
            e.preventDefault();
            // Note: Since we need 'scale' and 'pan', we will rely on React's event handler instead for logic,
            // but we must preventDefault here to stop browser zoom.
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [viewMode]); // Dependency on viewMode to re-bind/un-bind listener

    // Correct approach to "Free Zoom" without stale closures:
    const handleWheel = (e: React.WheelEvent) => {
        if (!containerRef.current || viewMode !== 'workflow') return;
        // e.preventDefault(); // handled by passive: false listener above effectively

        const delta = -e.deltaY * 0.001;
        const nS = Math.min(Math.max(0.15, scale + delta), 2.5);
        const rect = containerRef.current.getBoundingClientRect();
        const wX = (e.clientX - rect.left - pan.x) / scale;
        const wY = (e.clientY - rect.top - pan.y) / scale;
        setPan({ x: (e.clientX - rect.left) - wX * nS, y: (e.clientY - rect.top) - wY * nS });
        setScale(nS);
    };

    // --- Window Level Event Listeners for Reliable Drag/Pan/Resize ---
    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            // Convert React.MouseEvent logic to native MouseEvent logic
            const dx = (e.clientX - lastM.current.x);
            const dy = (e.clientY - lastM.current.y);
            lastM.current = { x: e.clientX, y: e.clientY };

            if (drgId) {
                const i = props.images.find(x => x.id === drgId);
                if (i?.position) props.onUpdateNodePosition(drgId, i.position.x + dx / scale, i.position.y + dy / scale);
            } else if (rszId && rszMode) {
                const i = props.images.find(x => x.id === rszId);
                if (i) {
                    const isVideoNode = i.nodeType === 'video';
                    const currentWidth = i.width || (isVideoNode ? 420 : 340);
                    const currentPos = i.position || { x: 0, y: 0 };
                    let nextWidth = currentWidth;
                    let nextPos = { ...currentPos };

                    if (rszMode === 'tr' || rszMode === 'br') {
                        nextWidth = currentWidth + dx / scale;
                    } else if (rszMode === 'tl' || rszMode === 'bl') {
                        nextWidth = currentWidth - dx / scale;
                        nextPos.x = currentPos.x + dx / scale;
                    }
                    nextWidth = Math.max(200, nextWidth);
                    props.onUpdateNodeData(rszId, { width: nextWidth, position: nextPos });
                }
            } else if (lnkId) {
                const r = containerRef.current?.getBoundingClientRect();
                if (r) setLnkPos({ x: (e.clientX - r.left - pan.x) / scale, y: (e.clientY - r.top - pan.y) / scale });
            } else if (selectionBox) {
                const rect = containerRef.current!.getBoundingClientRect();
                setSelectionBox(prev => prev ? { ...prev, x2: (e.clientX - rect.left - pan.x) / scale, y2: (e.clientY - rect.top - pan.y) / scale } : null);
            } else if (isPanning) {
                setPan(p => ({ x: p.x + dx, y: p.y + dy }));
            }
        };

        const handleWindowMouseUp = () => {
            handleMouseUp();
        };

        if (drgId || rszId || lnkId || selectionBox || isPanning) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
            if (isPanning) document.body.style.cursor = 'grabbing';
            else if (drgId) document.body.style.cursor = 'grabbing';
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            document.body.style.cursor = '';
        };
    }, [drgId, rszId, lnkId, selectionBox, isPanning, scale, pan, props.images]);

    const handleMouseUp = () => {
        if (selectionBox) {
            const xMin = Math.min(selectionBox.x1, selectionBox.x2);
            const xMax = Math.max(selectionBox.x1, selectionBox.x2);
            const yMin = Math.min(selectionBox.y1, selectionBox.y2);
            const yMax = Math.max(selectionBox.y1, selectionBox.y2);

            const sIds = props.images.filter(img => {
                const x = img.position?.x || 0;
                const y = img.position?.y || 0;
                const w = img.width || (img.nodeType === 'video' ? 420 : 340);
                const h = 400; // Estimated height for selection
                return x < xMax && x + w > xMin && y < yMax && y + h > yMin;
            }).map(img => img.id);

            if (sIds.length > 0) props.onSelectMultiple(sIds);
            else props.onSelectMultiple([]);
        }

        setDrgId(null);
        setLnkId(null);
        setRszId(null);
        setRszMode(null);
        setIsPanning(false);
        setSelectionBox(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full w-full bg-[#030303] relative overflow-hidden select-none">
            <div className="absolute top-8 right-8 z-[100] bg-black border border-white/10 px-6 py-3 rounded-full flex items-center gap-6 shadow-[0_25px_80px_rgba(0,0,0,0.8)] pointer-events-auto">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cine-accent italic hidden md:block">GRAPH PRO</span>
                <div className="h-4 w-[1px] bg-white/10 hidden md:block" />
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                    <button onClick={() => setViewMode('workflow')} className={`p-2 rounded-lg transition-all ${viewMode === 'workflow' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`} title="工作流视图"><Workflow size={18} /></button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`} title="平铺视图"><LayoutGrid size={18} /></button>
                </div>
                <div className="h-4 w-[1px] bg-white/10" />
                <button
                    onClick={() => {
                        props.onAutoAlign();
                        setPan({ x: 80, y: 80 });
                        setScale(1);
                    }}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2 group"
                    title="自动对齐排列 (Auto Align)"
                >
                    <Layers size={16} />
                </button>
                <div className="h-4 w-[1px] bg-white/10" />
                <div className="h-4 w-[1px] bg-white/10" />
                <button
                    onClick={props.onDownloadAll}
                    className="p-2.5 rounded-xl bg-cine-accent/10 border border-cine-accent/30 text-cine-accent hover:bg-cine-accent hover:text-black transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(201,255,86,0.1)]"
                    title="打包下载全部生成素材 (Bulk Download)"
                >
                    <Download size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest hidden group-hover:inline">打包下载 (ZIP)</span>
                </button>
            </div>

            {viewMode === 'workflow' ? (
                /* --- INFINITE CANVAS VIEW --- */
                <div
                    className="flex-1 relative cursor-grab active:cursor-grabbing"
                    ref={containerRef}
                    onMouseDown={(e) => {
                        lastM.current = { x: e.clientX, y: e.clientY };
                        if (e.target === e.currentTarget) {
                            e.preventDefault(); // Stop native selection/drag
                            if (e.shiftKey) {
                                const rect = containerRef.current!.getBoundingClientRect();
                                const x = (e.clientX - rect.left - pan.x) / scale;
                                const y = (e.clientY - rect.top - pan.y) / scale;
                                setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
                            } else {
                                setIsPanning(true);
                            }
                        }
                    }}
                    onWheel={handleWheel}
                >
                    {props.images.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-20 text-center opacity-30 select-none">
                            <MonitorPlay size={80} className="mb-8 text-zinc-900 animate-pulse" />
                            <h2 className="text-3xl font-black text-zinc-900 mb-2 uppercase tracking-[0.6em]">System Idle</h2>
                        </div>
                    ) : (
                        <>
                            <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: `${60 * scale}px ${60 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                            <div className="absolute origin-top-left will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                                {selectionBox && (
                                    <div
                                        className="absolute border-2 border-cine-accent bg-cine-accent/10 z-[1000] pointer-events-none"
                                        style={{
                                            left: Math.min(selectionBox.x1, selectionBox.x2),
                                            top: Math.min(selectionBox.y1, selectionBox.y2),
                                            width: Math.abs(selectionBox.x2 - selectionBox.x1),
                                            height: Math.abs(selectionBox.y2 - selectionBox.y1),
                                        }}
                                    />
                                )}
                                <svg className="absolute inset-0 pointer-events-none overflow-visible">
                                    <style>{`@keyframes flow { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } } .animate-flow { animation: flow 1.5s linear infinite; }`}</style>
                                    {props.images.map(img => {
                                        if (img.parentId) {
                                            const p = props.images.find(x => x.id === img.parentId);
                                            if (p?.position && img.position) {
                                                const v = img.nodeType === 'video';
                                                const pWidth = p.width || (p.nodeType === 'video' ? 420 : 340);
                                                const cWidth = img.width || (img.nodeType === 'video' ? 420 : 340);
                                                return <ConnectionLine key={img.id} start={p.position} end={{ x: img.position.x + cWidth / 2, y: img.position.y }} startWidth={pWidth} isVideoLink={v} />;
                                            }
                                        }
                                        return null;
                                    })}
                                    {lnkId && (
                                        <ConnectionLine
                                            start={props.images.find(i => i.id === lnkId)!.position!}
                                            end={lnkPos}
                                            startWidth={props.images.find(i => i.id === lnkId)!.width || (props.images.find(i => i.id === lnkId)!.nodeType === 'video' ? 420 : 340)}
                                            isDragging={true}
                                        />
                                    )}
                                </svg>
                                {props.images.map(img => (
                                    <Node
                                        key={img.id}
                                        image={img}
                                        allCharacters={props.characters}
                                        allLocations={props.locations}
                                        onUpdateData={props.onUpdateNodeData}
                                        onGenerate={props.onGenerateFromNode}
                                        selectedIds={props.selectedIds}
                                        onSelect={(m, i) => props.onSelect(img, m, i)}
                                        onDelete={() => props.onDelete(img.id)}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            lastM.current = { x: e.clientX, y: e.clientY };
                                            setDrgId(img.id);
                                        }}
                                        onStartLink={(e) => {
                                            e.stopPropagation();
                                            lastM.current = { x: e.clientX, y: e.clientY };
                                            const nWidth = img.width || (img.nodeType === 'video' ? 420 : 340);
                                            setLnkId(img.id);
                                            setLnkPos({ x: (img.position?.x || 0) + nWidth, y: (img.position?.y || 0) + 110 });
                                        }}
                                        onCompleteLink={() => lnkId && props.onLinkNodes(lnkId, img.id)}
                                        onShowInpaint={(url, idx) => {
                                            console.log("Trigger Inpaint:", img.id, idx);
                                            setInpaintTarget({ nodeId: img.id, url, index: idx, prompt: img.prompt });
                                        }}
                                        onShowQwen={(url, idx) => {
                                            console.log("Trigger Qwen Edit:", img.id, idx);
                                            setQwenTarget({ nodeId: img.id, url, index: idx });
                                        }}
                                        onResizeStart={(e, mode) => {
                                            e.stopPropagation();
                                            lastM.current = { x: e.clientX, y: e.clientY };
                                            setRszId(img.id);
                                            setRszMode(mode);
                                        }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* --- GRID VIEW (STATIC) --- */
                <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar p-10 bg-black/50">
                    <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-20">
                        {props.images.map(img => (
                            <Node
                                key={img.id}
                                image={img}
                                allCharacters={props.characters}
                                allLocations={props.locations}
                                onUpdateData={props.onUpdateNodeData}
                                onGenerate={props.onGenerateFromNode}
                                selectedIds={props.selectedIds}
                                onSelect={(m, i) => props.onSelect(img, m, i)}
                                onDelete={() => props.onDelete(img.id)}
                                onMouseDown={() => { }}
                                onStartLink={() => { }}
                                onCompleteLink={() => { }}
                                onShowInpaint={(url, idx) => setInpaintTarget({ nodeId: img.id, url, index: idx, prompt: img.prompt })}
                                onShowQwen={(url, idx) => setQwenTarget({ nodeId: img.id, url, index: idx })}
                                onResizeStart={() => { }}
                                isStatic={true}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Global Modals */}
            {inpaintTarget && (
                <InpaintEditor
                    imageUrl={inpaintTarget.url}
                    initialPrompt={inpaintTarget.prompt}
                    onClose={() => setInpaintTarget(null)}
                    onComplete={(newUrl) => {
                        const img = props.images.find(x => x.id === inpaintTarget.nodeId);
                        if (img) {
                            const newSlices = [...(img.slices || [])];
                            newSlices[inpaintTarget.index] = newUrl;
                            props.onUpdateNodeData(img.id, { slices: newSlices });
                        }
                        setInpaintTarget(null);
                    }}
                />
            )}
            {qwenTarget && (
                <QwenEditor
                    imageUrl={qwenTarget.url}
                    onClose={() => setQwenTarget(null)}
                    onComplete={(newUrl) => {
                        const parentImg = props.images.find(x => x.id === qwenTarget.nodeId);
                        if (parentImg) {
                            // 创建新的 render 节点，而非替换原图
                            const newNode: GeneratedImage = {
                                id: `qwen-${Date.now()}`,
                                prompt: `Qwen Edit from ${parentImg.id.split('-')[0]}`,
                                customLabel: `QWEN VARIANT`,
                                url: newUrl,
                                slices: [newUrl],
                                nodeType: 'render',
                                parentId: parentImg.id, // 链接到父节点
                                position: {
                                    x: (parentImg.position?.x || 0) + 380, // 放在右侧
                                    y: (parentImg.position?.y || 0) + 100  // 稍微向下偏移
                                },
                                aspectRatio: parentImg.aspectRatio || '16:9',
                                timestamp: Date.now(),
                                projectId: parentImg.projectId || '',
                                sessionId: parentImg.sessionId,        // Inherit session
                                group: parentImg.group || '默认分区'    // Inherit partition group
                            };

                            // 通过 onUpdateNodeData 触发添加新节点（需要 App.tsx 支持）
                            // 触发一个事件来让 App 读取新节点
                            window.dispatchEvent(new CustomEvent('qwen-node-created', { detail: newNode }));
                        }
                        setQwenTarget(null);
                    }}
                />
            )}
        </div>
    );
};
