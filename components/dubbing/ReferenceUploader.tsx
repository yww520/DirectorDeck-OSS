/**
 * ReferenceUploader - 自定义参考音频上传组件
 * 
 * 支持上传音频/视频作为参考
 * 
 * @since 2026-01-13
 */

import React, { useRef } from 'react';
import { Upload, Mic, Play, Pause } from 'lucide-react';

interface ReferenceUploaderProps {
    /** 当前自定义音频 URL */
    customVoiceUrl: string | null;
    /** 当前自定义音频文件 */
    customVoiceFile: File | null;
    /** 文件类型 */
    refFileType: 'audio' | 'video' | null;
    /** 是否正在播放 */
    isRefPlaying: boolean;
    /** 当前播放时间 */
    refCurrentTime: number;
    /** 总时长 */
    refDuration: number;
    /** 设置自定义音频 URL */
    onSetCustomVoiceUrl: (url: string | null) => void;
    /** 设置自定义音频文件 */
    onSetCustomVoiceFile: (file: File | null) => void;
    /** 设置文件类型 */
    onSetRefFileType: (type: 'audio' | 'video' | null) => void;
    /** 播放/暂停切换 */
    onToggleRefPlay: () => void;
    /** 跳转到指定时间 */
    onSeek: (time: number) => void;
    /** 清除角色选择 */
    onClearCharacterSelection: () => void;
    /** 清除预设选择 */
    onClearPresetSelection: () => void;
    /** 媒体元素引用 */
    refMediaRef: React.RefObject<HTMLMediaElement>;
    /** 文件输入引用 */
    fileInputRef: React.RefObject<HTMLInputElement>;
}

const ReferenceUploader: React.FC<ReferenceUploaderProps> = ({
    customVoiceUrl,
    customVoiceFile,
    refFileType,
    isRefPlaying,
    refCurrentTime,
    refDuration,
    onSetCustomVoiceUrl,
    onSetCustomVoiceFile,
    onSetRefFileType,
    onToggleRefPlay,
    onSeek,
    onClearCharacterSelection,
    onClearPresetSelection,
    refMediaRef,
    fileInputRef
}) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            onSetCustomVoiceFile(f);
            onSetCustomVoiceUrl(URL.createObjectURL(f));
            onSetRefFileType(f.type.startsWith('video') ? 'video' : 'audio');
            onClearCharacterSelection();
            onClearPresetSelection();
        }
    };

    const handleClear = () => {
        onSetCustomVoiceUrl(null);
        onSetCustomVoiceFile(null);
        onSetRefFileType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Upload size={16} className="text-cine-accent" />
                    上传自定义参考 (Custom Reference)
                </h3>
                {customVoiceUrl && (
                    <button
                        onClick={handleClear}
                        className="text-[9px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                    >
                        移除参考
                    </button>
                )}
            </div>

            {customVoiceUrl ? (
                <div className="relative rounded-[40px] border-2 border-dashed border-cine-accent/30 bg-cine-accent/5 p-8 transition-all overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-8 items-center lg:items-start">
                        {/* Media Icon/Thumb */}
                        <div className="relative group/ref shrink-0">
                            <div className="w-32 h-32 bg-cine-accent/10 rounded-[32px] flex items-center justify-center border border-cine-accent/20">
                                {refFileType === 'video' ? (
                                    <video
                                        ref={refMediaRef as React.RefObject<HTMLVideoElement>}
                                        src={customVoiceUrl}
                                        className="w-full h-full object-cover rounded-[32px]"
                                        onClick={(e) => { e.stopPropagation(); onToggleRefPlay(); }}
                                    />
                                ) : (
                                    <Mic size={48} className="text-cine-accent" />
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleRefPlay(); }}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/ref:opacity-100 transition-opacity rounded-[32px]"
                                >
                                    {isRefPlaying
                                        ? <Pause size={32} className="text-white fill-current" />
                                        : <Play size={32} className="text-white fill-current ml-1" />
                                    }
                                </button>
                            </div>
                            {refFileType === 'audio' && (
                                <audio ref={refMediaRef as React.RefObject<HTMLAudioElement>} src={customVoiceUrl} hidden />
                            )}
                        </div>

                        {/* Controls & Name */}
                        <div className="flex-1 w-full space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-cine-accent uppercase tracking-widest">已加载参考资源</p>
                                    <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">{customVoiceFile?.name}</p>
                                </div>
                                <div className="text-[10px] font-mono text-cine-accent/60">
                                    {refCurrentTime.toFixed(1)}s / {refDuration.toFixed(1)}s
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div
                                className="h-1.5 bg-zinc-950 rounded-full overflow-hidden relative cursor-pointer group/bar"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const p = (e.clientX - rect.left) / rect.width;
                                    onSeek(p * refDuration);
                                }}
                            >
                                <div
                                    className="h-full bg-cine-accent transition-all duration-150"
                                    style={{ width: `${(refCurrentTime / refDuration) * 100}%` }}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 transition-colors"
                                >
                                    更换资源
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <label className="relative rounded-[40px] border-2 border-dashed border-zinc-800/60 bg-zinc-900/20 hover:border-cine-accent/50 hover:bg-zinc-900/40 p-12 cursor-pointer transition-all overflow-hidden flex flex-col items-center gap-4 text-center group">
                    <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-[24px] flex items-center justify-center text-zinc-600 group-hover:text-cine-accent group-hover:border-cine-accent/50 transition-all">
                        <Upload size={32} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-black text-white uppercase tracking-widest">点击上传参考音频/视频</p>
                        <p className="text-[9px] text-zinc-600 font-medium uppercase tracking-[0.2em]">支持 .mp3 .wav .mp4 .mov | 建议小于 10MB</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="audio/*,video/*"
                        onChange={handleFileChange}
                    />
                </label>
            )}
        </div>
    );
};

export default ReferenceUploader;
