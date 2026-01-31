/**
 * AudioResultPlayer - 音频结果播放器
 * 
 * 显示生成进度、播放生成的音频、提供保存和下载功能
 */

import React, { useRef, useEffect, useState } from 'react';
import {
    Volume2,
    Play,
    Pause,
    Save,
    CheckCircle,
    Wand2,
    ArrowRightCircle,
    Download
} from 'lucide-react';

interface AudioResultPlayerProps {
    /** 是否正在生成 */
    isGenerating: boolean;
    /** 生成的音频 URL */
    generatedAudioUrl: string | null;
    /** 角色名称（用于显示标签） */
    characterName?: string;
    /** 同步到时间轴回调 */
    onSyncToTimeline?: (url: string, label: string, duration: number) => void;
    /** 保存到媒体库回调 */
    onSaveAsAsset: () => void;
    /** 下载音频回调 */
    onDownload: () => void;
    /** 音频持续时间（秒） */
    duration: number;
    /** 用于获取 duration 的 setter */
    onDurationChange?: (duration: number) => void;
}

const AudioResultPlayer: React.FC<AudioResultPlayerProps> = React.memo(({
    isGenerating,
    generatedAudioUrl,
    characterName,
    onSyncToTimeline,
    onSaveAsAsset,
    onDownload,
    duration: externalDuration,
    onDurationChange
}) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(externalDuration || 0);

    useEffect(() => {
        if (audioRef.current && generatedAudioUrl) {
            const audio = audioRef.current;
            const updateTime = () => setCurrentTime(audio.currentTime);
            const updateDuration = () => {
                setDuration(audio.duration);
                onDurationChange?.(audio.duration);
            };
            const onEnded = () => setIsPlaying(false);

            audio.addEventListener('timeupdate', updateTime);
            audio.addEventListener('loadedmetadata', updateDuration);
            audio.addEventListener('ended', onEnded);

            return () => {
                audio.removeEventListener('timeupdate', updateTime);
                audio.removeEventListener('loadedmetadata', updateDuration);
                audio.removeEventListener('ended', onEnded);
            };
        }
    }, [generatedAudioUrl, onDurationChange]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const p = (e.clientX - rect.left) / rect.width;
        if (audioRef.current) audioRef.current.currentTime = p * duration;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Volume2 size={16} className="text-emerald-400" /> 生成结果
                </h3>
                {generatedAudioUrl && (
                    <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle size={12} /> 已完成
                    </div>
                )}
            </div>

            <div className={`
                relative rounded-[32px] border transition-all overflow-hidden min-h-[256px] flex items-center justify-center
                ${isGenerating || generatedAudioUrl
                    ? 'bg-zinc-900/40 border-zinc-800/50 p-8'
                    : 'bg-zinc-950/50 border-zinc-900/50 border-dashed'
                }
            `}>
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-8 w-full py-4">
                        {/* Indeterminate Progress Animation */}
                        <div className="relative w-full h-1.5 bg-zinc-950 rounded-full border border-zinc-800/50 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cine-accent/80 to-transparent animate-shimmer rounded-full" />
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 border-t-2 border-r-2 border-cine-accent rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Wand2 size={18} className="text-cine-accent animate-pulse" />
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">
                                AI 正在推理中...
                            </span>
                            <span className="text-[9px] text-zinc-700 font-medium">
                                首次生成约需 10-30 秒，相同设置将瞬间完成
                            </span>
                        </div>
                    </div>
                ) : generatedAudioUrl ? (
                    <div className="flex flex-col gap-6 w-full">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={togglePlay}
                                className="w-16 h-16 bg-cine-accent text-black rounded-[20px] flex items-center justify-center hover:scale-105 transition-all shadow-xl active:scale-95 shrink-0"
                            >
                                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                            </button>
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{characterName || 'CUSTOM'}</span>
                                    <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                                        {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                                    </span>
                                </div>
                                <div
                                    className="h-2 bg-black/60 rounded-full overflow-hidden cursor-pointer"
                                    onClick={handleSeek}
                                >
                                    <div
                                        className="h-full bg-gradient-to-r from-cine-accent to-emerald-400 transition-all duration-150"
                                        style={{ width: `${(currentTime / duration) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => onSyncToTimeline?.(generatedAudioUrl, '', duration)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2 active:scale-95"
                            >
                                <ArrowRightCircle size={14} /> 同步
                            </button>
                            <button
                                onClick={onSaveAsAsset}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2 active:scale-95"
                            >
                                <Save size={14} /> 存入媒体库
                            </button>
                            <button
                                onClick={onDownload}
                                className="px-5 py-2.5 bg-cine-accent/10 hover:bg-cine-accent/20 text-cine-accent rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-cine-accent/20 flex items-center gap-2 active:scale-95"
                            >
                                <Download size={14} /> 下载
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-center opacity-30">
                        <Volume2 size={40} strokeWidth={1} />
                        <span className="text-[9px] uppercase font-bold tracking-[0.3em]">等待生成</span>
                    </div>
                )}
            </div>

            {generatedAudioUrl && <audio ref={audioRef} src={generatedAudioUrl} hidden />}
        </div>
    );
});

AudioResultPlayer.displayName = 'AudioResultPlayer';

export default AudioResultPlayer;
