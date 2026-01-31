import React from 'react';
import { VideoMotionConfig, TabType, Character, Location } from '../types';
import { Play, Settings2, Sliders, Timer, Zap, Trash2, Info, ChevronRight, Users, MapPin, X, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import { TranslateButton } from './TranslateButton';

interface VideoMotionPanelProps {
    config: VideoMotionConfig;
    onChange: (config: VideoMotionConfig) => void;
    onGenerate: () => void;
    onRefinePrompt?: () => void;
    isGenerating: boolean;
    isRefining?: boolean;
    selectedCount: number;
    hasSourceInfo?: boolean;
    sourceContext?: string;
    characters: Character[];
    locations: Location[];
}

export const VideoMotionPanel: React.FC<VideoMotionPanelProps> = ({
    config,
    onChange,
    onGenerate,
    onRefinePrompt,
    isGenerating,
    isRefining,
    selectedCount,
    hasSourceInfo,
    sourceContext,
    characters,
    locations
}) => {
    const [isCharChoiceOpen, setIsCharChoiceOpen] = React.useState(false);
    const [isLocChoiceOpen, setIsLocChoiceOpen] = React.useState(false);

    if (selectedCount === 0) return null;

    const toggleAsset = (assetId: string, type: 'char' | 'loc') => {
        const field = type === 'char' ? 'selectedCharacterIds' : 'selectedLocationIds';
        const current = config[field] || [];
        const next = current.includes(assetId)
            ? current.filter(id => id !== assetId)
            : [...current, assetId];
        onChange({ ...config, [field]: next });
    };

    // Prepare thumbnails for preview
    const selectedAssets = [
        ...(config.selectedCharacterIds || []).map(id => {
            const form = characters.flatMap(c => c.forms).find(f => f.id === id);
            return { id, url: form?.frontViewUrl || form?.multiViewUrl, type: 'char' };
        }),
        ...(config.selectedLocationIds || []).map(id => {
            const form = locations.flatMap(l => l.forms).find(f => f.id === id);
            return { id, url: form?.url, type: 'loc' };
        })
    ].slice(0, 5);

    const motionTypes = [
        { id: 'auto', label: '智能识别 (AI)', icon: <Zap size={12} /> },
        { id: 'dolly_in', label: '推镜头 (Dolly In)', icon: <ChevronRight size={12} className="rotate-90" /> },
        { id: 'dolly_out', label: '拉镜头 (Dolly Out)', icon: <ChevronRight size={12} className="-rotate-90" /> },
        { id: 'pan_left', label: '向左平移 (Pan L)', icon: <ChevronRight size={12} className="rotate-180" /> },
        { id: 'pan_right', label: '向右平移 (Pan R)', icon: <ChevronRight size={12} /> },
    ];

    return (
        <div className="flex flex-col h-full bg-[#0c0c0e] text-zinc-300 font-mono">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/50 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-cine-accent rounded-full"></div>
                    <div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">视频生成控制台</h2>
                        <p className="text-[8px] text-zinc-500 tracking-widest mt-0.5">DIRECTOR VIDEO CONTROL</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-cine-accent/10 border border-cine-accent/20 rounded-sm">
                    <span className="text-[9px] font-bold text-cine-accent">{selectedCount === 1 ? '单帧生成 (I2V)' : '首尾帧插值 (K2V)'}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-sm space-y-2">
                    <div className="flex items-center justify-between text-zinc-400">
                        <div className="flex items-center gap-2">
                            <Info size={12} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">分镜动态指令 (SCENE PROMPT)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onRefinePrompt}
                                disabled={isRefining}
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cine-accent/10 border border-cine-accent/20 text-cine-accent hover:bg-cine-accent/20 transition-all disabled:opacity-50"
                                title="根据画面内容自动优化提示词 (AI Vision Refine)"
                            >
                                {isRefining ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                <span className="text-[8px] font-bold">AI 视觉描述</span>
                            </button>
                            <span className="text-[8px] text-zinc-600">可编辑以覆盖默认指令</span>
                        </div>
                    </div>
                    <div className="relative group/prompt">
                        <textarea
                            value={config.customInstruction || sourceContext || ''}
                            onChange={(e) => onChange({ ...config, customInstruction: e.target.value })}
                            className="w-full bg-transparent text-[13px] text-zinc-400 italic leading-relaxed border-none outline-none resize-none custom-scrollbar min-h-[80px]"
                            placeholder="输入或分析分镜动态指令..."
                        />
                        <TranslateButton
                            text={config.customInstruction || sourceContext || ''}
                            onTranslate={(val) => onChange({ ...config, customInstruction: val })}
                            className="absolute bottom-1 right-1 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                        />
                    </div>
                </div>

                {/* Consistency Anchors Picker */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                        <Users size={12} className="text-cine-accent" />
                        <span>视觉一致性基准 (VISUAL ANCHORS)</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-sm">
                        <div className="flex gap-3">
                            {/* Character Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => { setIsCharChoiceOpen(!isCharChoiceOpen); setIsLocChoiceOpen(false); }}
                                    className={`w-10 h-10 rounded-full border transition-all hover:scale-105 flex items-center justify-center ${config.selectedCharacterIds?.length ? 'bg-cine-accent/20 border-cine-accent text-cine-accent' : 'bg-black border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}
                                >
                                    <Users size={18} />
                                </button>
                                {isCharChoiceOpen && (
                                    <div className="absolute top-12 left-0 w-64 bg-[#0c0c0e] border border-zinc-800 shadow-2xl rounded-sm p-4 z-[100] animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">选择锁定角色</span>
                                            <button onClick={() => setIsCharChoiceOpen(false)} className="text-zinc-500 hover:text-white"><X size={12} /></button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {characters.map(char => char.forms.map(form => (
                                                <button
                                                    key={form.id}
                                                    onClick={() => toggleAsset(form.id, 'char')}
                                                    className={`aspect-square relative rounded-sm overflow-hidden border-2 transition-all group/item ${config.selectedCharacterIds?.includes(form.id) ? 'border-cine-accent ring-1 ring-cine-accent' : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'}`}
                                                    title={`${char.name} - ${form.formName}`}
                                                >
                                                    {(form.frontViewUrl || form.multiViewUrl) ? (
                                                        <img src={form.frontViewUrl || form.multiViewUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-1">
                                                            <Users size={12} className="text-zinc-700 mb-1" />
                                                            <span className="text-[7px] text-zinc-600 text-center truncate w-full">{char.name}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity">
                                                        <span className="text-[6px] font-bold text-white text-center px-1 truncate">{char.name}</span>
                                                    </div>
                                                </button>
                                            )))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Location Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => { setIsLocChoiceOpen(!isLocChoiceOpen); setIsCharChoiceOpen(false); }}
                                    className={`w-10 h-10 rounded-full border transition-all hover:scale-105 flex items-center justify-center ${config.selectedLocationIds?.length ? 'bg-cine-accent/20 border-cine-accent text-cine-accent' : 'bg-black border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}
                                >
                                    <MapPin size={18} />
                                </button>
                                {isLocChoiceOpen && (
                                    <div className="absolute top-12 left-0 w-64 bg-[#0c0c0e] border border-zinc-800 shadow-2xl rounded-sm p-4 z-[100] animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">选择锁定场景</span>
                                            <button onClick={() => setIsLocChoiceOpen(false)} className="text-zinc-500 hover:text-white"><X size={12} /></button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {locations.map(loc => loc.forms.map(form => (
                                                <button
                                                    key={form.id}
                                                    onClick={() => toggleAsset(form.id, 'loc')}
                                                    className={`aspect-square relative rounded-sm overflow-hidden border-2 transition-all group/item ${config.selectedLocationIds?.includes(form.id) ? 'border-cine-accent ring-1 ring-cine-accent' : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'}`}
                                                    title={`${loc.name} - ${form.formName}`}
                                                >
                                                    {form.url ? (
                                                        <img src={form.url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-1">
                                                            <MapPin size={12} className="text-zinc-700 mb-1" />
                                                            <span className="text-[7px] text-zinc-600 text-center truncate w-full">{loc.name}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity">
                                                        <span className="text-[6px] font-bold text-white text-center px-1 truncate">{loc.name}</span>
                                                    </div>
                                                </button>
                                            )))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected Thumbnails */}
                        <div className="flex -space-x-3">
                            {selectedAssets.length > 0 ? selectedAssets.map(asset => (
                                <div key={asset.id} className="w-9 h-9 rounded-full border-2 border-[#0c0c0e] bg-zinc-900 overflow-hidden shadow-xl ring-1 ring-cine-accent/20 flex items-center justify-center">
                                    {asset.url ? (
                                        <img src={asset.url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase">
                                            {asset.type === 'char' ? <Users size={12} /> : <MapPin size={12} />}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="text-[8px] text-zinc-700 uppercase tracking-widest font-black">未指定一致性参考</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Duration & Intensity */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                            <div className="flex items-center gap-2">
                                <Timer size={12} />
                                <span>视频时长 (DURATION)</span>
                            </div>
                            <span className="text-cine-accent">{config.duration}S</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[2, 4, 8, 12].map(d => (
                                <button
                                    key={d}
                                    onClick={() => onChange({ ...config, duration: d })}
                                    className={`py-2 text-[10px] font-black rounded-[2px] border transition-all ${config.duration === d ? 'bg-cine-accent border-cine-accent text-black' : 'bg-black border-zinc-800 text-zinc-600 hover:border-zinc-600'}`}
                                >
                                    {d}S
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                            <div className="flex items-center gap-2">
                                <Sliders size={12} />
                                <span>镜头幅度 (MOTION)</span>
                            </div>
                            <span className="text-cine-accent">{config.intensity}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={config.intensity}
                            onChange={(e) => onChange({ ...config, intensity: parseInt(e.target.value) })}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                        />
                    </div>
                </div>

                {/* Facial & Dialogue */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                        <Users size={12} />
                        <span>面部动画与对白 (FACIAL & DIALOGUE)</span>
                    </div>
                    <button
                        onClick={() => onChange({ ...config, isSpeaking: !config.isSpeaking })}
                        className={`w-full flex items-center justify-between p-4 rounded-sm border transition-all ${config.isSpeaking ? 'bg-cine-accent/10 border-cine-accent text-white' : 'bg-black/40 border-zinc-900 text-zinc-500 hover:border-zinc-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`${config.isSpeaking ? 'text-cine-accent' : 'text-zinc-600'}`}>
                                <MessageSquare size={16} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] font-bold tracking-wider">角色说话模式 (SPEAKING MODE)</span>
                                <span className="text-[7px] text-zinc-600 uppercase mt-0.5">Enable AI Lip Synchronization & Mouth Movement</span>
                            </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${config.isSpeaking ? 'bg-cine-accent' : 'bg-zinc-800'}`}>
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.isSpeaking ? 'right-1' : 'left-1'}`}></div>
                        </div>
                    </button>
                </div>

                {/* Motion Type Presets */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                        <Settings2 size={12} />
                        <span>镜头语言预设 (PRESETS)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {motionTypes.map(type => (
                            <button
                                key={type.id}
                                onClick={() => onChange({ ...config, motionType: type.id as any })}
                                className={`flex items-center justify-between p-3 rounded-sm border transition-all ${config.motionType === type.id ? 'bg-cine-accent/10 border-cine-accent text-white' : 'bg-black/40 border-zinc-900 text-zinc-500 hover:border-zinc-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`${config.motionType === type.id ? 'text-cine-accent' : 'text-zinc-600'}`}>{type.icon}</div>
                                    <span className="text-[10px] font-bold tracking-wider">{type.label}</span>
                                </div>
                                {config.motionType === type.id && <div className="w-1.5 h-1.5 bg-cine-accent rounded-full shadow-[0_0_8px_#3b82f6]"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="p-6 border-t border-zinc-800/50 bg-black/40">
                <button
                    onClick={onGenerate}
                    disabled={isGenerating}
                    className={`w-full py-4 rounded-[2px] flex items-center justify-center gap-3 transition-all font-black text-xs uppercase tracking-[0.2em] shadow-2xl ${isGenerating ? 'bg-zinc-800 text-zinc-500 animate-pulse' : 'bg-cine-accent text-black hover:scale-[1.02] hover:shadow-cine-accent/20 active:scale-95'}`}
                >
                    {isGenerating ? (
                        <>正在渲染镜头片段...</>
                    ) : (
                        <>
                            <Play size={14} fill="currentColor" />
                            开始生成视频 (GENERATE)
                        </>
                    )}
                </button>
                <p className="text-center text-[8px] text-zinc-600 mt-4 tracking-widest uppercase">
                    模型能力受限，单次生成时长最高支持 12S
                </p>
            </div>
        </div>
    );
};
