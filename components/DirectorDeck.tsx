import React from 'react';
import { Button } from './Button';
import { AspectRatio, ImageSize, GenerationMode, ArtStyle } from '../types';
import { Grid2X2, Grid3X3, Zap, Layers, Lock, GitMerge, Video, Settings2, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface DirectorDeckProps {
    mode: GenerationMode;
    setMode: (mode: GenerationMode) => void;
    aspectRatio: AspectRatio;
    setAspectRatio: (ar: AspectRatio) => void;
    imageSize: ImageSize;
    setImageSize: (size: ImageSize) => void;
    artStyle: ArtStyle;
    setArtStyle: (style: ArtStyle) => void;
    isGenerating: boolean;
    onResetCanvas: () => void;
}

const Grid4X4 = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 7.5h18" />
        <path d="M3 12h18" />
        <path d="M3 16.5h18" />
        <path d="M7.5 3v18" />
        <path d="M12 3v18" />
        <path d="M16.5 3v18" />
    </svg>
);

export const DirectorDeck = React.memo(({
    mode,
    setMode,
    aspectRatio,
    setAspectRatio,
    imageSize,
    setImageSize,
    artStyle,
    setArtStyle,
    isGenerating,
    onResetCanvas
}: DirectorDeckProps) => {


    return (
        <div className="flex flex-col h-full space-y-7 select-none">
            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-6 mt-2">
                <span className="text-zinc-500 text-[10px] uppercase tracking-[0.25em] font-mono font-bold flex items-center gap-2">
                    <Settings2 size={10} className="text-cine-accent opacity-50" />
                    01. 导演控制台
                </span>
                {isGenerating && (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-cine-accent rounded-full shadow-[0_0_8px_#c9ff56]"></div>
                        <span className="text-[9px] text-cine-accent font-mono tracking-widest font-bold">正在执行渲染</span>
                    </div>
                )}
            </div>

            {/* Composition Group */}
            <div className="space-y-3.5">
                <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                    <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
                    构图配置 (COMPOSITION)
                </label>

                <div className="space-y-3 p-4 bg-zinc-900 border border-zinc-800/40 rounded-sm">
                    {/* Mode Selector */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {[
                            { m: GenerationMode.GRID_2x2, icon: Grid2X2, label: "2x2" },
                            { m: GenerationMode.GRID_3x3, icon: Grid3X3, label: "3x3" },
                            { m: GenerationMode.GRID_4x4, icon: Grid4X4, label: "4x4" }
                        ].map((item) => (
                            <button
                                key={item.label}
                                onClick={() => setMode(item.m)}
                                className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-[1px] border transition-colors duration-300 ${mode === item.m
                                    ? 'bg-zinc-800/60 border-cine-accent/50 text-cine-accent'
                                    : 'bg-black/40 border-zinc-800/60 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                                    }`}
                            >
                                <item.icon size={14} />
                                <span className="text-[9px] uppercase tracking-widest font-mono font-bold">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-2 pt-2.5 border-t border-zinc-800/50">
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">画面比例 (RATIO)</span>
                            <span className="text-[8px] text-cine-accent/60 font-mono">{aspectRatio}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {Object.values(AspectRatio).map((ar) => (
                                <button
                                    key={ar}
                                    onClick={() => setAspectRatio(ar)}
                                    className={`text-[9px] h-7 border rounded-[1px] font-mono transition-colors duration-300 flex items-center justify-center ${aspectRatio === ar
                                        ? 'border-zinc-600 text-white bg-zinc-800'
                                        : 'border-zinc-800/60 text-zinc-700 hover:border-zinc-700 hover:text-zinc-500 bg-transparent'
                                        }`}
                                >
                                    {ar}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Art Style Selection - Mirrors Character Library */}
            <div className="space-y-3 pt-2">
                <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                    <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
                    选择视觉画风 (VISUAL STYLE)
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-black/20 rounded-sm border border-zinc-900">
                    {Object.entries(ArtStyle).map(([key, value]) => (
                        <button
                            key={key}
                            onClick={() => setArtStyle(value as ArtStyle)}
                            className={`relative group flex flex-col items-center gap-1.5 p-1.5 rounded-sm transition-colors border ${artStyle === value
                                ? 'border-cine-accent bg-cine-accent/5'
                                : 'border-transparent hover:bg-white/5 active:scale-95'
                                }`}
                            title={value}
                        >
                            <div className="w-full aspect-[4/5] rounded-sm overflow-hidden bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700 transition-colors relative">
                                <img
                                    src={`/styles/${key}.png`}
                                    alt={value}
                                    className={`w-full h-full object-cover transition-opacity duration-300 ${artStyle === value ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
                                        }`}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='20'%3E${value.slice(0, 1)}%3C/text%3E%3C/svg%3E`;
                                        target.onerror = null;
                                    }}
                                />
                                {/* Hover Name Overlay */}
                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2 text-center">
                                    <span className="text-[8px] font-black leading-tight text-white uppercase tracking-widest pointer-events-none">
                                        {value}
                                    </span>
                                </div>
                            </div>
                            <span className={`text-[8px] font-bold text-center leading-tight tracking-tighter uppercase ${artStyle === value ? 'text-cine-accent' : 'text-zinc-600'} group-hover:text-zinc-400 transition-colors`}>
                                {value.split(' ')[0]}
                            </span>
                            {artStyle === value && (
                                <div className="absolute top-2 right-2 w-3 h-3 bg-cine-accent rounded-full flex items-center justify-center shadow-lg ring-2 ring-black">
                                    <CheckCircle2 size={8} className="text-black" strokeWidth={4} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quality/Resolution Selection */}
            <div className="space-y-3 pt-2">
                <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                    <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
                    输出分辨率 (RESOLUTION)
                </label>
                <div className="grid grid-cols-5 gap-1 p-1 bg-black/20 rounded-sm border border-zinc-900">
                    {Object.values(ImageSize).map((size) => (
                        <button
                            key={size}
                            onClick={() => setImageSize(size)}
                            className={`py-1.5 rounded-[1px] border transition-all duration-300 flex flex-col items-center justify-center ${imageSize === size
                                ? 'bg-cine-accent/10 border-cine-accent text-cine-accent'
                                : 'bg-transparent border-zinc-800/40 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                                }`}
                        >
                            <span className="text-[10px] font-black font-mono tracking-tighter">{size}</span>
                        </button>
                    ))}
                </div>
                <div className="flex p-2.5 bg-zinc-900/40 border border-zinc-900/60 rounded-sm items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={10} className="text-cine-accent/50" />
                        <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">GEMINI 视觉引擎 (PRO)</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-[1px] bg-zinc-800 text-[8px] text-zinc-500 font-black tracking-tighter uppercase font-mono">
                        就绪 (Ready)
                    </span>
                </div>
            </div>


            {/* Reset Action */}
            <div className="pt-4 border-t border-zinc-900">
                <button
                    onClick={() => {
                        if (window.confirm("确定要重置画布吗？这将删除所有已生成的分镜和视频，操作不可撤销。")) {
                            onResetCanvas();
                        }
                    }}
                    className="w-full py-3 px-4 border border-red-900/40 bg-red-950/10 hover:bg-red-950/20 text-red-500 rounded-sm transition-colors flex items-center justify-center gap-2 group"
                >
                    <Grid2X2 size={12} className="opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">重置工作空间 (RESET)</span>
                </button>
            </div>
        </div>
    );
});