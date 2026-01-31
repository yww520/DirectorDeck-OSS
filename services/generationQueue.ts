/**
 * Generation Queue Service
 * 
 * 统一的生成任务管理，将图片/视频生成集成到 API 队列系统
 * 
 * @since 2026-01-13
 */

import { imageQueue, videoQueue, TaskPriority } from './apiQueue';
import { generateMultiViewGrid, generateVideo } from './geminiService';
import { videoBlobStorage } from './videoBlobStorage';
import { GeneratedImage, VideoMotionConfig, AspectRatio, ImageSize, ArtStyle } from '../types';

export interface ImageGenerationTask {
    id: string;
    type: 'image';
    prompt: string;
    gridRows: number;
    gridCols: number;
    aspectRatio: AspectRatio;
    imageSize: ImageSize;
    artStyle: ArtStyle;
    parentNode?: GeneratedImage;
    referenceImages?: any[];
    priority?: TaskPriority;
}

export interface VideoGenerationTask {
    id: string;
    type: 'video';
    sourceNode: GeneratedImage;
    endFrame?: GeneratedImage;
    motionConfig: VideoMotionConfig;
    referenceImages?: any[];
    artStyle: ArtStyle;
    projectId: string;
    priority?: TaskPriority;
}

export type GenerationTask = ImageGenerationTask | VideoGenerationTask;

export interface GenerationResult {
    taskId: string;
    type: 'image' | 'video';
    success: boolean;
    data?: {
        fullImage?: string;
        slices?: string[];
        videoUrl?: string;
        videoBlob?: Blob;
    };
    error?: string;
}

class GenerationQueueService {
    private listeners: Map<string, Set<(result: GenerationResult) => void>> = new Map();

    /**
     * 提交图片生成任务
     */
    async submitImageTask(
        task: Omit<ImageGenerationTask, 'id' | 'type'>,
        callbacks?: {
            onComplete?: (result: GenerationResult) => void;
            onError?: (error: Error) => void;
        }
    ): Promise<string> {
        const taskId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const taskName = `图片生成: ${task.prompt.slice(0, 30)}...`;

        imageQueue.addTask(
            taskName,
            async () => {
                const result = await generateMultiViewGrid(
                    task.prompt,
                    task.gridRows,
                    task.gridCols,
                    task.aspectRatio,
                    task.imageSize,
                    task.referenceImages || [],
                    undefined,
                    task.artStyle
                );

                return {
                    fullImage: result.fullImage,
                    slices: result.slices
                };
            },
            {
                priority: task.priority || 'normal',
                onComplete: (data) => {
                    const result: GenerationResult = {
                        taskId,
                        type: 'image',
                        success: true,
                        data
                    };
                    this.emit(taskId, result);
                    callbacks?.onComplete?.(result);
                },
                onError: (error) => {
                    const result: GenerationResult = {
                        taskId,
                        type: 'image',
                        success: false,
                        error: error.message
                    };
                    this.emit(taskId, result);
                    callbacks?.onError?.(error);
                }
            }
        );

        return taskId;
    }

    /**
     * 提交视频生成任务
     */
    async submitVideoTask(
        task: Omit<VideoGenerationTask, 'id' | 'type'>,
        callbacks?: {
            onComplete?: (result: GenerationResult) => void;
            onError?: (error: Error) => void;
        }
    ): Promise<string> {
        const taskId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const taskName = `视频生成: ${task.sourceNode.prompt?.slice(0, 20) || '分镜'}...`;

        videoQueue.addTask(
            taskName,
            async () => {
                const res = await generateVideo(
                    task.sourceNode,
                    task.endFrame,
                    task.motionConfig,
                    task.referenceImages || [],
                    task.artStyle
                ) as any;

                // 保存视频 Blob 到 IndexedDB
                if (res.blob) {
                    const nodeId = `video_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    await videoBlobStorage.init();
                    await videoBlobStorage.saveVideoBlob(nodeId, task.projectId, res.blob);
                    console.log(`[GenerationQueue] Video blob saved: ${nodeId}`);
                }

                return {
                    videoUrl: res.url,
                    videoBlob: res.blob
                };
            },
            {
                priority: task.priority || 'normal',
                maxRetries: 2, // 视频生成重试次数较少
                onComplete: (data) => {
                    const result: GenerationResult = {
                        taskId,
                        type: 'video',
                        success: true,
                        data
                    };
                    this.emit(taskId, result);
                    callbacks?.onComplete?.(result);
                },
                onError: (error) => {
                    const result: GenerationResult = {
                        taskId,
                        type: 'video',
                        success: false,
                        error: error.message
                    };
                    this.emit(taskId, result);
                    callbacks?.onError?.(error);
                }
            }
        );

        return taskId;
    }

    /**
     * 批量提交图片生成任务
     */
    async submitBatchImageTasks(
        tasks: Array<Omit<ImageGenerationTask, 'id' | 'type'>>,
        callbacks?: {
            onTaskComplete?: (index: number, result: GenerationResult) => void;
            onBatchComplete?: (results: GenerationResult[]) => void;
            onBatchProgress?: (completed: number, total: number) => void;
        }
    ): Promise<string[]> {
        const results: GenerationResult[] = new Array(tasks.length);
        let completedCount = 0;

        const taskIds = await Promise.all(
            tasks.map((task, index) =>
                this.submitImageTask(task, {
                    onComplete: (result) => {
                        results[index] = result;
                        completedCount++;
                        callbacks?.onTaskComplete?.(index, result);
                        callbacks?.onBatchProgress?.(completedCount, tasks.length);

                        if (completedCount === tasks.length) {
                            callbacks?.onBatchComplete?.(results);
                        }
                    },
                    onError: (error) => {
                        results[index] = {
                            taskId: `error_${index}`,
                            type: 'image',
                            success: false,
                            error: error.message
                        };
                        completedCount++;
                        callbacks?.onBatchProgress?.(completedCount, tasks.length);

                        if (completedCount === tasks.length) {
                            callbacks?.onBatchComplete?.(results);
                        }
                    }
                })
            )
        );

        return taskIds;
    }

    /**
     * 订阅任务结果
     */
    subscribe(taskId: string, callback: (result: GenerationResult) => void): () => void {
        if (!this.listeners.has(taskId)) {
            this.listeners.set(taskId, new Set());
        }
        this.listeners.get(taskId)!.add(callback);

        return () => {
            this.listeners.get(taskId)?.delete(callback);
        };
    }

    private emit(taskId: string, result: GenerationResult): void {
        this.listeners.get(taskId)?.forEach(cb => cb(result));
        // 清理完成的任务监听器
        this.listeners.delete(taskId);
    }

    /**
     * 获取队列统计
     */
    getStats() {
        const imageStats = imageQueue.getStats();
        const videoStats = videoQueue.getStats();

        return {
            image: imageStats,
            video: videoStats,
            total: {
                pending: imageStats.pending + videoStats.pending,
                running: imageStats.running + videoStats.running,
                completed: imageStats.completed + videoStats.completed,
                failed: imageStats.failed + videoStats.failed
            }
        };
    }

    /**
     * 暂停所有队列
     */
    pauseAll(): void {
        imageQueue.pause();
        videoQueue.pause();
    }

    /**
     * 恢复所有队列
     */
    resumeAll(): void {
        imageQueue.resume();
        videoQueue.resume();
    }

    /**
     * 取消所有待处理任务
     */
    cancelAll(): { image: number; video: number } {
        return {
            image: imageQueue.cancelAll(),
            video: videoQueue.cancelAll()
        };
    }
}

// 导出单例
export const generationQueue = new GenerationQueueService();
export default generationQueue;
