/**
 * BatchGenerationPanel - 批量生成控制面板
 * 
 * 提供批量生成图片/视频的UI控制界面
 * 
 * @since 2026-01-13
 */

import React, { useState, useCallback, memo } from 'react';
import {
    Play, Pause, Square, CheckCircle, XCircle,
    Loader2, Image, Film, Zap, Settings2
} from 'lucide-react';
import { StoryboardItem, AspectRatio, ImageSize, ArtStyle, Character, Location } from '../types';
import { batchGenerationService, BatchGenerationProgress, BatchGenerationConfig } from '../services/batchGenerationService';
import { GenerationResult } from '../services/generationQueue';

interface BatchGenerationPanelProps {
    /** 分镜项目列表 */
    items: StoryboardItem[];
    /** 项目 ID */
    projectId: string;
    /** 角色列表 */
    characters?: Character[];
    /** 场景列表 */
    locations?: Location[];
    /** 生成完成回调 */
    onComplete?: (results: GenerationResult[]) => void;
    /** 单项完成回调 */
    onItemComplete?: (index: number, result: GenerationResult) => void;
}

const BatchGenerationPanel: React.FC<BatchGenerationPanelProps> = memo(({
    items,
    projectId,
    characters = [],
    locations = [],
    onComplete,
    onItemComplete
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState<BatchGenerationProgress | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // 配置状态
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
    const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.HD);
    const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.MODERN_SHONEN);
    const [gridRows, setGridRows] = useState(1);
    const [gridCols, setGridCols] = useState(1);

    // 开始批量生成
    const handleStart = useCallback(async () => {
        if (items.length === 0) return;

        setIsRunning(true);
        setIsPaused(false);

        const config: BatchGenerationConfig = {
            items,
            projectId,
            aspectRatio,
            imageSize,
            artStyle,
            gridRows,
            gridCols,
            characters,
            locations
        };

        try {
            const results = await batchGenerationService.startBatchGeneration(config, {
                onProgress: setProgress,
                onItemComplete: (index, result, item) => {
                    onItemComplete?.(index, result);
                },
                onBatchComplete: (results) => {
                    onComplete?.(results);
                }
            });
        } finally {
            setIsRunning(false);
            setIsPaused(false);
        }
    }, [items, projectId, aspectRatio, imageSize, artStyle, gridRows, gridCols, characters, locations, onComplete, onItemComplete]);

    // 暂停
    const handlePause = useCallback(() => {
        batchGenerationService.pause();
        setIsPaused(true);
    }, []);

    // 恢复
    const handleResume = useCallback(() => {
        batchGenerationService.resume();
        setIsPaused(false);
    }, []);

    // 取消
    const handleCancel = useCallback(() => {
        batchGenerationService.cancel();
        setIsRunning(false);
        setIsPaused(false);
        setProgress(null);
    }, []);

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cine-accent/30 to-purple-500/30 flex items-center justify-center">
                        <Zap size={20} className="text-cine-accent" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">批量生成</h3>
                        <p className="text-[10px] text-zinc-500">
                            {items.length} 个分镜待处理
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-xl transition-colors ${showSettings
                            ? 'bg-cine-accent/20 text-cine-accent'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                >
                    <Settings2 size={16} />
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                    {/* Aspect Ratio */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 block">
                            宽高比
                        </label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs"
                        >
                            {Object.values(AspectRatio).map(ratio => (
                                <option key={ratio} value={ratio}>{ratio}</option>
                            ))}
                        </select>
                    </div>

                    {/* Image Size */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 block">
                            图片尺寸
                        </label>
                        <select
                            value={imageSize}
                            onChange={(e) => setImageSize(e.target.value as ImageSize)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs"
                        >
                            {Object.values(ImageSize).map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>

                    {/* Art Style */}
                    <div className="col-span-2">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 block">
                            画风
                        </label>
                        <select
                            value={artStyle}
                            onChange={(e) => setArtStyle(e.target.value as ArtStyle)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs"
                        >
                            {Object.values(ArtStyle).map(style => (
                                <option key={style} value={style}>{style}</option>
                            ))}
                        </select>
                    </div>

                    {/* Grid Layout */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 block">
                            网格行数
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={4}
                            value={gridRows}
                            onChange={(e) => setGridRows(parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 block">
                            网格列数
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={4}
                            value={gridCols}
                            onChange={(e) => setGridCols(parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs"
                        />
                    </div>
                </div>
            )}

            {/* Progress */}
            {progress && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">
                            正在处理 {progress.currentIndex + 1} / {progress.total}
                        </span>
                        <span className="text-cine-accent font-bold">
                            {progress.percentage}%
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-cine-accent to-purple-500 transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                        />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-[10px]">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle size={12} />
                            <span>{progress.completed} 成功</span>
                        </div>
                        {progress.failed > 0 && (
                            <div className="flex items-center gap-1.5 text-rose-400">
                                <XCircle size={12} />
                                <span>{progress.failed} 失败</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
                {!isRunning ? (
                    <button
                        onClick={handleStart}
                        disabled={items.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cine-accent text-black font-bold rounded-xl hover:bg-cine-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play size={18} />
                        开始批量生成
                    </button>
                ) : (
                    <>
                        {isPaused ? (
                            <button
                                onClick={handleResume}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-colors"
                            >
                                <Play size={18} />
                                继续
                            </button>
                        ) : (
                            <button
                                onClick={handlePause}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors"
                            >
                                <Pause size={18} />
                                暂停
                            </button>
                        )}

                        <button
                            onClick={handleCancel}
                            className="px-4 py-3 bg-rose-500/20 text-rose-400 font-bold rounded-xl hover:bg-rose-500/30 transition-colors"
                        >
                            <Square size={18} />
                        </button>
                    </>
                )}
            </div>

            {/* Status indicator */}
            {isRunning && (
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <Loader2 size={14} className="animate-spin text-cine-accent" />
                    <span>
                        {isPaused ? '已暂停...' : '正在生成中...'}
                    </span>
                </div>
            )}
        </div>
    );
});

BatchGenerationPanel.displayName = 'BatchGenerationPanel';

export { BatchGenerationPanel };
export default BatchGenerationPanel;
