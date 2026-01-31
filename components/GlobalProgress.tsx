/**
 * GlobalProgress Component
 * 
 * 全局进度条，显示 API 队列的任务进度
 * 
 * @since 2026-01-13
 */

import React, { memo } from 'react';
import { Loader2, Pause, Play, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useImageQueue, useVideoQueue } from '../hooks/useApiQueue';

interface GlobalProgressProps {
    className?: string;
}

export const GlobalProgress: React.FC<GlobalProgressProps> = memo(({ className = '' }) => {
    const imageQueue = useImageQueue();
    const videoQueue = useVideoQueue();
    const [isExpanded, setIsExpanded] = React.useState(false);

    // 合并两个队列的统计
    const totalPending = imageQueue.stats.pending + videoQueue.stats.pending;
    const totalRunning = imageQueue.stats.running + videoQueue.stats.running;
    const totalCompleted = imageQueue.stats.completed + videoQueue.stats.completed;
    const totalFailed = imageQueue.stats.failed + videoQueue.stats.failed;
    const total = totalPending + totalRunning + totalCompleted + totalFailed;

    const isProcessing = imageQueue.isProcessing || videoQueue.isProcessing;
    const isPaused = imageQueue.isPaused || videoQueue.isPaused;

    // 当前正在运行的任务
    const currentTasks = [...imageQueue.currentTasks, ...videoQueue.currentTasks];

    // 计算进度百分比
    const progress = total > 0 ? ((totalCompleted + totalFailed) / total) * 100 : 0;

    // 如果没有任务，不显示
    if (!isProcessing && total === 0) {
        return null;
    }

    const handlePauseResume = () => {
        if (isPaused) {
            imageQueue.resume();
            videoQueue.resume();
        } else {
            imageQueue.pause();
            videoQueue.pause();
        }
    };

    const handleCancelAll = () => {
        if (window.confirm('确定要取消所有待处理的任务吗？')) {
            imageQueue.cancelAll();
            videoQueue.cancelAll();
        }
    };

    return (
        <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
            <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-2xl overflow-hidden min-w-[320px]">
                {/* Header */}
                <div
                    className="flex items-center justify-between p-3 bg-zinc-800/50 cursor-pointer hover:bg-zinc-800/70 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2">
                        {isProcessing && (
                            <Loader2 size={14} className="text-cine-accent animate-spin" />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            任务队列
                        </span>
                        <span className="text-[9px] text-zinc-500">
                            {totalCompleted + totalFailed}/{total}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {isProcessing && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePauseResume(); }}
                                    className="p-1 rounded hover:bg-zinc-700 transition-colors"
                                    title={isPaused ? '恢复' : '暂停'}
                                >
                                    {isPaused ? (
                                        <Play size={12} className="text-cine-accent" />
                                    ) : (
                                        <Pause size={12} className="text-zinc-400" />
                                    )}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCancelAll(); }}
                                    className="p-1 rounded hover:bg-zinc-700 transition-colors"
                                    title="取消全部"
                                >
                                    <X size={12} className="text-zinc-400 hover:text-red-400" />
                                </button>
                            </>
                        )}
                        {isExpanded ? (
                            <ChevronDown size={14} className="text-zinc-500" />
                        ) : (
                            <ChevronUp size={14} className="text-zinc-500" />
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-zinc-800">
                    <div
                        className={`h-full transition-all duration-300 ${totalFailed > 0 ? 'bg-red-500' : 'bg-cine-accent'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="p-2 bg-zinc-800/50 rounded">
                                <div className="text-[16px] font-bold text-yellow-400">{totalPending}</div>
                                <div className="text-[8px] text-zinc-500 uppercase">等待中</div>
                            </div>
                            <div className="p-2 bg-zinc-800/50 rounded">
                                <div className="text-[16px] font-bold text-cine-accent">{totalRunning}</div>
                                <div className="text-[8px] text-zinc-500 uppercase">处理中</div>
                            </div>
                            <div className="p-2 bg-zinc-800/50 rounded">
                                <div className="text-[16px] font-bold text-green-400">{totalCompleted}</div>
                                <div className="text-[8px] text-zinc-500 uppercase">完成</div>
                            </div>
                            <div className="p-2 bg-zinc-800/50 rounded">
                                <div className="text-[16px] font-bold text-red-400">{totalFailed}</div>
                                <div className="text-[8px] text-zinc-500 uppercase">失败</div>
                            </div>
                        </div>

                        {/* Current Tasks */}
                        {currentTasks.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                    当前任务
                                </div>
                                {currentTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="flex items-center gap-2 p-2 bg-zinc-800/30 rounded"
                                    >
                                        <Loader2 size={12} className="text-cine-accent animate-spin" />
                                        <span className="text-[10px] text-zinc-300 truncate flex-1">
                                            {task.name}
                                        </span>
                                        {task.retryCount > 0 && (
                                            <span className="text-[8px] text-yellow-500">
                                                重试 {task.retryCount}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pause Indicator */}
                        {isPaused && (
                            <div className="text-center py-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                                <span className="text-[10px] text-yellow-400 font-bold">
                                    队列已暂停
                                </span>
                            </div>
                        )}

                        {/* Clear Completed */}
                        {(totalCompleted > 0 || totalFailed > 0) && !isProcessing && (
                            <button
                                onClick={() => {
                                    imageQueue.clearCompleted();
                                    videoQueue.clearCompleted();
                                }}
                                className="w-full py-2 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
                            >
                                清除已完成记录
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

GlobalProgress.displayName = 'GlobalProgress';

export default GlobalProgress;
