/**
 * BatchGenerationService - 批量生成服务
 * 
 * 管理从分镜表批量生成图片/视频的流程
 * 
 * @since 2026-01-13
 */

import { StoryboardItem, GeneratedImage, AspectRatio, ImageSize, ArtStyle, Character, Location } from '../types';
import { generationQueue, GenerationResult } from './generationQueue';

export interface BatchGenerationConfig {
    /** 分镜项目列表 */
    items: StoryboardItem[];
    /** 项目 ID */
    projectId: string;
    /** 图片宽高比 */
    aspectRatio: AspectRatio;
    /** 图片尺寸 */
    imageSize: ImageSize;
    /** 艺术风格 */
    artStyle: ArtStyle;
    /** 网格布局 (rows x cols) */
    gridRows?: number;
    gridCols?: number;
    /** 角色列表（用于参考） */
    characters?: Character[];
    /** 场景列表（用于参考） */
    locations?: Location[];
    /** 是否自动生成视频 */
    autoGenerateVideo?: boolean;
}

export interface BatchGenerationProgress {
    /** 总任务数 */
    total: number;
    /** 已完成任务数 */
    completed: number;
    /** 失败任务数 */
    failed: number;
    /** 当前正在处理的索引 */
    currentIndex: number;
    /** 当前任务状态 */
    currentStatus: 'pending' | 'generating' | 'completed' | 'failed';
    /** 进度百分比 */
    percentage: number;
}

export interface BatchGenerationCallbacks {
    /** 进度更新回调 */
    onProgress?: (progress: BatchGenerationProgress) => void;
    /** 单个任务完成回调 */
    onItemComplete?: (index: number, result: GenerationResult, item: StoryboardItem) => void;
    /** 批量完成回调 */
    onBatchComplete?: (results: GenerationResult[]) => void;
    /** 错误回调 */
    onError?: (index: number, error: Error, item: StoryboardItem) => void;
}

class BatchGenerationService {
    private isRunning = false;
    private isPaused = false;
    private currentBatchId: string | null = null;

    /**
     * 启动批量生成
     */
    async startBatchGeneration(
        config: BatchGenerationConfig,
        callbacks?: BatchGenerationCallbacks
    ): Promise<GenerationResult[]> {
        if (this.isRunning) {
            throw new Error('已有批量生成任务正在运行');
        }

        this.isRunning = true;
        this.isPaused = false;
        this.currentBatchId = `batch_${Date.now()}`;

        const results: GenerationResult[] = [];
        const { items, gridRows = 1, gridCols = 1 } = config;

        const progress: BatchGenerationProgress = {
            total: items.length,
            completed: 0,
            failed: 0,
            currentIndex: 0,
            currentStatus: 'pending',
            percentage: 0
        };

        try {
            for (let i = 0; i < items.length; i++) {
                // 检查是否暂停
                while (this.isPaused && this.isRunning) {
                    await new Promise(r => setTimeout(r, 500));
                }

                // 检查是否已取消
                if (!this.isRunning) {
                    break;
                }

                const item = items[i];
                progress.currentIndex = i;
                progress.currentStatus = 'generating';
                callbacks?.onProgress?.({ ...progress });

                try {
                    // 构建增强的提示词
                    const enhancedPrompt = this.buildEnhancedPrompt(item, config);

                    // 提交生成任务
                    const taskId = await generationQueue.submitImageTask({
                        prompt: enhancedPrompt,
                        gridRows,
                        gridCols,
                        aspectRatio: config.aspectRatio,
                        imageSize: config.imageSize,
                        artStyle: config.artStyle,
                        referenceImages: this.collectReferenceImages(item, config)
                    });

                    // 等待任务完成
                    const result = await this.waitForTask(taskId);
                    results[i] = result;

                    if (result.success) {
                        progress.completed++;
                        progress.currentStatus = 'completed';
                    } else {
                        progress.failed++;
                        progress.currentStatus = 'failed';
                        callbacks?.onError?.(i, new Error(result.error || '生成失败'), item);
                    }

                    callbacks?.onItemComplete?.(i, result, item);

                } catch (error) {
                    progress.failed++;
                    progress.currentStatus = 'failed';

                    const err = error instanceof Error ? error : new Error(String(error));
                    callbacks?.onError?.(i, err, item);

                    results[i] = {
                        taskId: `error_${i}`,
                        type: 'image',
                        success: false,
                        error: err.message
                    };
                }

                progress.percentage = Math.round(((i + 1) / items.length) * 100);
                callbacks?.onProgress?.({ ...progress });
            }

            callbacks?.onBatchComplete?.(results);
            return results;

        } finally {
            this.isRunning = false;
            this.currentBatchId = null;
        }
    }

    /**
     * 暂停批量生成
     */
    pause(): void {
        if (this.isRunning) {
            this.isPaused = true;
            generationQueue.pauseAll();
            console.log('[BatchGeneration] 已暂停');
        }
    }

    /**
     * 恢复批量生成
     */
    resume(): void {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            generationQueue.resumeAll();
            console.log('[BatchGeneration] 已恢复');
        }
    }

    /**
     * 取消批量生成
     */
    cancel(): void {
        this.isRunning = false;
        this.isPaused = false;
        generationQueue.cancelAll();
        console.log('[BatchGeneration] 已取消');
    }

    /**
     * 获取运行状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            batchId: this.currentBatchId
        };
    }

    /**
     * 构建增强提示词
     */
    private buildEnhancedPrompt(item: StoryboardItem, config: BatchGenerationConfig): string {
        const parts: string[] = [];

        // 基础 AI 提示词
        if (item.aiPrompt) {
            parts.push(item.aiPrompt);
        } else if (item.description) {
            parts.push(item.description);
        }

        // 添加场景信息
        if (item.location) {
            const matchingLocation = config.locations?.find(
                loc => loc.name.toLowerCase().includes(item.location.toLowerCase()) ||
                    item.location.toLowerCase().includes(loc.name.toLowerCase())
            );
            if (matchingLocation?.description) {
                parts.push(`场景: ${matchingLocation.description}`);
            }
        }

        // 添加角色信息
        if (item.characters) {
            const characterNames = item.characters.split(/[,，、]/);
            const matchingChars = characterNames
                .map(name => config.characters?.find(
                    c => c.name.toLowerCase().includes(name.trim().toLowerCase())
                ))
                .filter(Boolean);

            if (matchingChars.length > 0) {
                const charDescriptions = matchingChars
                    .map(c => c!.bio ? `${c!.name}: ${c!.bio}` : c!.name)
                    .join('; ');
                parts.push(`角色: ${charDescriptions}`);
            }
        }

        // 添加镜头信息
        if (item.cameraAngle) {
            parts.push(`镜头: ${item.cameraAngle}`);
        }

        if (item.movement) {
            parts.push(`运动: ${item.movement}`);
        }

        return parts.join('\n');
    }

    /**
     * 收集参考图片
     */
    private collectReferenceImages(item: StoryboardItem, config: BatchGenerationConfig): any[] {
        const references: any[] = [];

        // 场景参考图
        if (item.location && config.locations) {
            const matchingLocation = config.locations.find(
                loc => loc.name.toLowerCase().includes(item.location.toLowerCase())
            );
            if (matchingLocation?.forms?.[0]?.url) {
                references.push({
                    type: 'location',
                    url: matchingLocation.forms[0].url,
                    label: matchingLocation.name
                });
            }
        }

        // 角色参考图
        if (item.characters && config.characters) {
            const characterNames = item.characters.split(/[,，、]/);
            for (const name of characterNames) {
                const character = config.characters.find(
                    c => c.name.toLowerCase().includes(name.trim().toLowerCase())
                );
                if (character?.forms?.[0]?.frontViewUrl) {
                    references.push({
                        type: 'character',
                        url: character.forms[0].frontViewUrl,
                        label: character.name
                    });
                }
            }
        }

        return references;
    }

    /**
     * 等待任务完成
     */
    private waitForTask(taskId: string): Promise<GenerationResult> {
        return new Promise((resolve) => {
            const unsubscribe = generationQueue.subscribe(taskId, (result) => {
                unsubscribe();
                resolve(result);
            });

            // 超时处理 (10分钟)
            setTimeout(() => {
                unsubscribe();
                resolve({
                    taskId,
                    type: 'image',
                    success: false,
                    error: '生成超时'
                });
            }, 600000);
        });
    }
}

// 导出单例
export const batchGenerationService = new BatchGenerationService();
export default batchGenerationService;
