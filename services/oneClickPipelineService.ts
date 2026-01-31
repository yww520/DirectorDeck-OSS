/**
 * OneClickPipelineService - 一键生成流水线服务
 * 
 * 从剧本到视频的完整自动化生成流程
 * 剧本解析 → 分镜生成 → 图片生成 → 视频生成
 * 
 * @since 2026-01-13
 */

import {
    StoryboardItem, StoryboardProject, GeneratedImage,
    Character, Location, AspectRatio, ImageSize, ArtStyle,
    VideoMotionConfig
} from '../types';
import { batchGenerationService, BatchGenerationProgress } from './batchGenerationService';
import { GenerationResult } from './generationQueue';

export type PipelineStage =
    | 'idle'
    | 'parsing'      // 解析剧本
    | 'storyboard'   // 生成分镜表
    | 'images'       // 批量生成图片
    | 'videos'       // 生成视频
    | 'completed'
    | 'error';

export interface PipelineConfig {
    /** 项目 ID */
    projectId: string;
    /** 剧本文本 */
    scriptText?: string;
    /** 已有分镜项目 */
    storyboardProject?: StoryboardProject;
    /** 角色列表 */
    characters: Character[];
    /** 场景列表 */
    locations: Location[];
    /** 图片设置 */
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
    artStyle?: ArtStyle;
    /** 是否自动生成视频 */
    autoGenerateVideo?: boolean;
    /** 视频运动配置 */
    videoConfig?: VideoMotionConfig;
}

export interface PipelineProgress {
    /** 当前阶段 */
    stage: PipelineStage;
    /** 阶段名称 */
    stageName: string;
    /** 总进度百分比 */
    overallProgress: number;
    /** 当前阶段进度 */
    stageProgress: number;
    /** 已完成项数 */
    completedItems: number;
    /** 总项数 */
    totalItems: number;
    /** 失败项数 */
    failedItems: number;
    /** 当前处理的项目 */
    currentItem?: string;
    /** 预计剩余时间 (秒) */
    estimatedTimeRemaining?: number;
}

export interface PipelineResult {
    success: boolean;
    /** 生成的分镜项目 */
    storyboardProject?: StoryboardProject;
    /** 生成的图片 */
    generatedImages: GeneratedImage[];
    /** 生成的视频 */
    generatedVideos: GeneratedImage[];
    /** 错误信息 */
    error?: string;
    /** 各阶段耗时 (毫秒) */
    stageDurations: Record<string, number>;
}

export interface PipelineCallbacks {
    onProgress?: (progress: PipelineProgress) => void;
    onStageChange?: (stage: PipelineStage, stageName: string) => void;
    onImageGenerated?: (index: number, image: GeneratedImage) => void;
    onVideoGenerated?: (index: number, video: GeneratedImage) => void;
    onError?: (stage: PipelineStage, error: Error) => void;
}

class OneClickPipelineService {
    private isRunning = false;
    private isPaused = false;
    private currentStage: PipelineStage = 'idle';

    private readonly STAGE_WEIGHTS = {
        parsing: 5,
        storyboard: 10,
        images: 70,
        videos: 15
    };

    private readonly STAGE_NAMES: Record<PipelineStage, string> = {
        idle: '待机',
        parsing: '解析剧本',
        storyboard: '生成分镜表',
        images: '批量生成图片',
        videos: '生成动态视频',
        completed: '完成',
        error: '错误'
    };

    /**
     * 启动一键生成流水线
     */
    async startPipeline(
        config: PipelineConfig,
        callbacks?: PipelineCallbacks
    ): Promise<PipelineResult> {
        if (this.isRunning) {
            throw new Error('流水线正在运行中');
        }

        this.isRunning = true;
        this.isPaused = false;

        const result: PipelineResult = {
            success: false,
            generatedImages: [],
            generatedVideos: [],
            stageDurations: {}
        };

        const startTime = Date.now();
        let storyboardItems: StoryboardItem[] = [];

        try {
            // 阶段1: 解析剧本（如果提供了剧本文本）
            if (config.scriptText) {
                await this.runStage('parsing', callbacks, async () => {
                    // 剧本解析逻辑在调用方处理，这里只是跳过
                    this.reportProgress(callbacks, 'parsing', 100, 0, 0);
                });
                result.stageDurations.parsing = Date.now() - startTime;
            }

            // 阶段2: 获取分镜表
            const storyboardStart = Date.now();
            await this.runStage('storyboard', callbacks, async () => {
                if (config.storyboardProject) {
                    storyboardItems = config.storyboardProject.items;
                    result.storyboardProject = config.storyboardProject;
                } else {
                    throw new Error('缺少分镜数据：请先生成分镜表');
                }
                this.reportProgress(callbacks, 'storyboard', 100, storyboardItems.length, storyboardItems.length);
            });
            result.stageDurations.storyboard = Date.now() - storyboardStart;

            if (storyboardItems.length === 0) {
                throw new Error('分镜表为空，无法生成');
            }

            // 阶段3: 批量生成图片
            const imagesStart = Date.now();
            await this.runStage('images', callbacks, async () => {
                const batchResults = await batchGenerationService.startBatchGeneration({
                    items: storyboardItems,
                    projectId: config.projectId,
                    aspectRatio: config.aspectRatio || AspectRatio.WIDE,
                    imageSize: config.imageSize || ImageSize.HD,
                    artStyle: config.artStyle || ArtStyle.MODERN_SHONEN,
                    characters: config.characters,
                    locations: config.locations
                }, {
                    onProgress: (batchProgress: BatchGenerationProgress) => {
                        this.reportProgress(
                            callbacks,
                            'images',
                            batchProgress.percentage,
                            batchProgress.completed,
                            batchProgress.total,
                            batchProgress.failed,
                            storyboardItems[batchProgress.currentIndex]?.shotNumber
                        );
                    },
                    onItemComplete: (index, genResult, item) => {
                        if (genResult.success && genResult.data?.fullImage) {
                            const generatedImage: GeneratedImage = {
                                id: `img_${Date.now()}_${index}`,
                                projectId: config.projectId,
                                url: genResult.data.fullImage,
                                prompt: item.aiPrompt,
                                timestamp: Date.now(),
                                nodeType: 'render',
                                aspectRatio: config.aspectRatio || AspectRatio.WIDE,
                                sourceShotId: item.id,
                                customLabel: item.shotNumber,
                                cameraDescription: item.shotNumber,
                                dialogue: item.dialogue,
                                slices: genResult.data.slices
                            };
                            result.generatedImages.push(generatedImage);
                            callbacks?.onImageGenerated?.(index, generatedImage);
                        }
                    }
                });
            });
            result.stageDurations.images = Date.now() - imagesStart;

            // 阶段4: 生成视频（可选）
            if (config.autoGenerateVideo && result.generatedImages.length > 0) {
                const videosStart = Date.now();
                await this.runStage('videos', callbacks, async () => {
                    // 视频生成逻辑 - 这里简化处理，实际需要调用视频生成 API
                    for (let i = 0; i < result.generatedImages.length; i++) {
                        if (!this.isRunning) break;

                        while (this.isPaused && this.isRunning) {
                            await new Promise(r => setTimeout(r, 500));
                        }

                        const image = result.generatedImages[i];
                        this.reportProgress(
                            callbacks,
                            'videos',
                            Math.round((i / result.generatedImages.length) * 100),
                            i,
                            result.generatedImages.length,
                            0,
                            image.customLabel
                        );

                        // TODO: 实际调用视频生成 API
                        // const videoResult = await generateVideo(image.url, config.videoConfig);
                        // result.generatedVideos.push(videoResult);
                        // callbacks?.onVideoGenerated?.(i, videoResult);
                    }
                });
                result.stageDurations.videos = Date.now() - videosStart;
            }

            // 完成
            this.currentStage = 'completed';
            callbacks?.onStageChange?.('completed', this.STAGE_NAMES.completed);
            result.success = true;

        } catch (error) {
            this.currentStage = 'error';
            const err = error instanceof Error ? error : new Error(String(error));
            result.error = err.message;
            callbacks?.onError?.(this.currentStage, err);
            callbacks?.onStageChange?.('error', this.STAGE_NAMES.error);

        } finally {
            this.isRunning = false;
            result.stageDurations.total = Date.now() - startTime;
        }

        return result;
    }

    /**
     * 暂停流水线
     */
    pause(): void {
        if (this.isRunning) {
            this.isPaused = true;
            batchGenerationService.pause();
            console.log('[Pipeline] 已暂停');
        }
    }

    /**
     * 恢复流水线
     */
    resume(): void {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            batchGenerationService.resume();
            console.log('[Pipeline] 已恢复');
        }
    }

    /**
     * 取消流水线
     */
    cancel(): void {
        this.isRunning = false;
        this.isPaused = false;
        batchGenerationService.cancel();
        console.log('[Pipeline] 已取消');
    }

    /**
     * 获取状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentStage: this.currentStage,
            stageName: this.STAGE_NAMES[this.currentStage]
        };
    }

    /**
     * 运行单个阶段
     */
    private async runStage(
        stage: PipelineStage,
        callbacks: PipelineCallbacks | undefined,
        executor: () => Promise<void>
    ): Promise<void> {
        this.currentStage = stage;
        callbacks?.onStageChange?.(stage, this.STAGE_NAMES[stage]);
        await executor();
    }

    /**
     * 报告进度
     */
    private reportProgress(
        callbacks: PipelineCallbacks | undefined,
        stage: PipelineStage,
        stageProgress: number,
        completedItems: number,
        totalItems: number,
        failedItems: number = 0,
        currentItem?: string
    ): void {
        // 计算总进度
        let overallProgress = 0;
        const weights = this.STAGE_WEIGHTS;

        switch (stage) {
            case 'parsing':
                overallProgress = (stageProgress / 100) * weights.parsing;
                break;
            case 'storyboard':
                overallProgress = weights.parsing + (stageProgress / 100) * weights.storyboard;
                break;
            case 'images':
                overallProgress = weights.parsing + weights.storyboard + (stageProgress / 100) * weights.images;
                break;
            case 'videos':
                overallProgress = weights.parsing + weights.storyboard + weights.images + (stageProgress / 100) * weights.videos;
                break;
        }

        callbacks?.onProgress?.({
            stage,
            stageName: this.STAGE_NAMES[stage],
            overallProgress: Math.round(overallProgress),
            stageProgress,
            completedItems,
            totalItems,
            failedItems,
            currentItem
        });
    }
}

// 导出单例
export const oneClickPipeline = new OneClickPipelineService();
export default oneClickPipeline;
