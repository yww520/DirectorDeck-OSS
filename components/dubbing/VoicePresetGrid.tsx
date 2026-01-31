/**
 * VoicePresetGrid - 系统预设音色网格
 * 
 * 显示和选择系统预设音色
 */

import React, { useRef, useState } from 'react';
import { Music, Play, Pause, Sparkles } from 'lucide-react';
import { VoicePreset } from './types';

interface VoicePresetGridProps {
    /** 预设列表 */
    voicePresets: VoicePreset[];
    /** 当前选中的预设 ID */
    selectedPresetId: string | null;
    /** 语言筛选 */
    presetFilter: 'all' | 'zh' | 'en';
    /** 筛选变更回调 */
    onFilterChange: (filter: 'all' | 'zh' | 'en') => void;
    /** 选择预设回调 */
    onSelect: (preset: VoicePreset) => void;
}

const VoicePresetGrid: React.FC<VoicePresetGridProps> = React.memo(({
    voicePresets,
    selectedPresetId,
    presetFilter,
    onFilterChange,
    onSelect
}) => {
    const presetAudioRef = useRef<HTMLAudioElement>(null);
    const [isPresetPlaying, setIsPresetPlaying] = useState(false);
    const [presetPlayingId, setPresetPlayingId] = useState<string | null>(null);

    const selectedPreset = voicePresets.find(p => p.id === selectedPresetId);

    const handlePreviewPreset = (preset: VoicePreset, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!presetAudioRef.current) return;

        if (presetPlayingId === preset.id && isPresetPlaying) {
            presetAudioRef.current.pause();
            setIsPresetPlaying(false);
        } else {
            presetAudioRef.current.src = preset.file;
            presetAudioRef.current.play();
            setPresetPlayingId(preset.id);
            setIsPresetPlaying(true);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Music size={16} className="text-cine-accent" />
                    系统预设音色 (System Presets)
                </h3>
                <div className="flex gap-2">
                    {(['all', 'zh', 'en'] as const).map(filter => (
                        <button
                            key={filter}
                            onClick={() => onFilterChange(filter)}
                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${presetFilter === filter
                                ? 'bg-cine-accent/20 border-cine-accent/50 text-cine-accent'
                                : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 hover:text-zinc-400'
                                }`}
                        >
                            {filter === 'all' ? '全部' : filter === 'zh' ? '中文' : 'ENG'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Hidden audio element for preset preview */}
            <audio
                ref={presetAudioRef}
                onEnded={() => { setIsPresetPlaying(false); setPresetPlayingId(null); }}
                onPause={() => setIsPresetPlaying(false)}
                hidden
            />

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                {voicePresets
                    .filter(p => presetFilter === 'all' || p.language === presetFilter)
                    .map(preset => {
                        const isSelected = selectedPresetId === preset.id;
                        const isThisPlaying = presetPlayingId === preset.id && isPresetPlaying;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => onSelect(preset)}
                                className={`group relative p-3 rounded-2xl border transition-all text-left ${isSelected
                                    ? 'bg-cine-accent/10 border-cine-accent/50 shadow-[0_0_20px_rgba(201,255,86,0.15)]'
                                    : 'bg-zinc-900/30 border-zinc-800/40 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                                    }`}
                                title={preset.description}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${preset.gender === 'female'
                                        ? 'bg-pink-500/20 text-pink-400'
                                        : 'bg-sky-500/20 text-sky-400'
                                        }`}>
                                        {preset.gender === 'female' ? '♀' : '♂'}
                                    </div>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${preset.language === 'zh'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                        }`}>
                                        {preset.language}
                                    </span>
                                    <div
                                        onClick={(e) => handlePreviewPreset(preset, e)}
                                        className={`ml-auto w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${isThisPlaying
                                            ? 'bg-cine-accent text-black'
                                            : 'bg-zinc-800/80 text-zinc-500 hover:bg-cine-accent/30 hover:text-cine-accent'
                                            }`}
                                    >
                                        {isThisPlaying ? <Pause size={10} /> : <Play size={10} className="ml-0.5" />}
                                    </div>
                                </div>
                                <p className={`text-[9px] font-bold truncate ${isSelected ? 'text-cine-accent' : 'text-zinc-400'}`}>
                                    {preset.name}
                                </p>
                                {preset.emoMode > 0 && (
                                    <div className="absolute top-1.5 right-1.5">
                                        <Sparkles size={10} className="text-cine-accent" />
                                    </div>
                                )}
                                {isSelected && (
                                    <div className="absolute inset-0 rounded-2xl ring-2 ring-cine-accent/30" />
                                )}
                            </button>
                        );
                    })}
            </div>

            {/* Selected Preset Detail */}
            {selectedPreset && (
                <div className="p-4 bg-cine-accent/5 border border-cine-accent/20 rounded-2xl">
                    <div className="flex items-start gap-4">
                        <button
                            onClick={(e) => handlePreviewPreset(selectedPreset, e)}
                            className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all ${presetPlayingId === selectedPreset.id && isPresetPlaying
                                ? 'bg-cine-accent text-black'
                                : 'bg-cine-accent/20 text-cine-accent hover:bg-cine-accent/40'
                                }`}
                        >
                            {presetPlayingId === selectedPreset.id && isPresetPlaying
                                ? <Pause size={28} />
                                : <Play size={28} className="ml-1" />
                            }
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-cine-accent mb-1">{selectedPreset.name}</p>
                            <p className="text-[10px] text-zinc-500 line-clamp-2 italic">{selectedPreset.description}</p>
                            {selectedPreset.emoMode > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[8px] px-2 py-0.5 bg-cine-accent/20 text-cine-accent rounded uppercase font-black">
                                        情感模式 {selectedPreset.emoMode}
                                    </span>
                                    {selectedPreset.emotion && (
                                        <span className="text-[8px] text-zinc-600">{selectedPreset.emotion}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

VoicePresetGrid.displayName = 'VoicePresetGrid';

export default VoicePresetGrid;
