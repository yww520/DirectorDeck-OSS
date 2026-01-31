/**
 * useApiQueue Hook
 * 
 * 提供 API 队列状态和操作的 React Hook
 * 
 * @since 2026-01-13
 */

import { useState, useEffect, useCallback } from 'react';
import { imageQueue, videoQueue, ApiQueue, QueueTask, TaskPriority } from '../services/apiQueue';

export interface QueueStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
}

export interface UseApiQueueReturn {
    // 状态
    stats: QueueStats;
    isProcessing: boolean;
    isPaused: boolean;
    currentTasks: QueueTask[];

    // 操作
    addTask: <T>(
        name: string,
        execute: () => Promise<T>,
        options?: {
            priority?: TaskPriority;
            maxRetries?: number;
        }
    ) => Promise<T>;

    addBatch: <T>(
        tasks: Array<{
            name: string;
            execute: () => Promise<T>;
            priority?: TaskPriority;
        }>
    ) => Promise<T[]>;

    cancelTask: (id: string) => boolean;
    cancelAll: () => number;
    pause: () => void;
    resume: () => void;
    clearCompleted: () => void;
}

/**
 * 使用图片生成队列
 */
export function useImageQueue(): UseApiQueueReturn {
    return useApiQueue(imageQueue);
}

/**
 * 使用视频生成队列
 */
export function useVideoQueue(): UseApiQueueReturn {
    return useApiQueue(videoQueue);
}

/**
 * 通用队列 Hook
 */
export function useApiQueue(queue: ApiQueue): UseApiQueueReturn {
    const [stats, setStats] = useState<QueueStats>({
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        total: 0
    });
    const [isPaused, setIsPaused] = useState(false);
    const [currentTasks, setCurrentTasks] = useState<QueueTask[]>([]);

    useEffect(() => {
        // 订阅队列事件
        const unsubProgress = queue.on('progress', (newStats: QueueStats) => {
            setStats(newStats);
        });

        const unsubPaused = queue.on('queuePaused', () => {
            setIsPaused(true);
        });

        const unsubResumed = queue.on('queueResumed', () => {
            setIsPaused(false);
        });

        const unsubTaskStart = queue.on('taskStart', (task: QueueTask) => {
            setCurrentTasks(prev => [...prev, task]);
        });

        const unsubTaskComplete = queue.on('taskComplete', (task: QueueTask) => {
            setCurrentTasks(prev => prev.filter(t => t.id !== task.id));
        });

        const unsubTaskError = queue.on('taskError', (task: QueueTask) => {
            setCurrentTasks(prev => prev.filter(t => t.id !== task.id));
        });

        // 获取初始状态
        setStats(queue.getStats());

        return () => {
            unsubProgress();
            unsubPaused();
            unsubResumed();
            unsubTaskStart();
            unsubTaskComplete();
            unsubTaskError();
        };
    }, [queue]);

    const addTask = useCallback(<T,>(
        name: string,
        execute: () => Promise<T>,
        options: {
            priority?: TaskPriority;
            maxRetries?: number;
        } = {}
    ): Promise<T> => {
        return new Promise((resolve, reject) => {
            queue.addTask(name, execute, {
                ...options,
                onComplete: resolve,
                onError: reject
            });
        });
    }, [queue]);

    const addBatch = useCallback(<T,>(
        tasks: Array<{
            name: string;
            execute: () => Promise<T>;
            priority?: TaskPriority;
        }>
    ): Promise<T[]> => {
        return new Promise((resolve, reject) => {
            queue.addBatch(tasks, {
                onBatchComplete: resolve,
                onBatchError: (errors) => reject(errors[0])
            });
        });
    }, [queue]);

    const cancelTask = useCallback((id: string) => queue.cancelTask(id), [queue]);
    const cancelAll = useCallback(() => queue.cancelAll(), [queue]);
    const pause = useCallback(() => queue.pause(), [queue]);
    const resume = useCallback(() => queue.resume(), [queue]);
    const clearCompleted = useCallback(() => queue.clearCompleted(), [queue]);

    return {
        stats,
        isProcessing: stats.running > 0 || stats.pending > 0,
        isPaused,
        currentTasks,
        addTask,
        addBatch,
        cancelTask,
        cancelAll,
        pause,
        resume,
        clearCompleted
    };
}

export default useImageQueue;
