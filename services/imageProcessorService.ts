/**
 * ImageProcessorService - 图片处理服务
 * 
 * 使用 Web Worker 在后台处理图片，避免阻塞主线程
 * 
 * @since 2026-01-13
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ResizeOptions {
    width: number;
    height: number;
    maintainAspect?: boolean;
    format?: ImageFormat;
    quality?: number;
}

export interface CompressOptions {
    quality?: number;
    format?: ImageFormat;
}

export interface CropOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    format?: ImageFormat;
    quality?: number;
}

export interface ConvertOptions {
    format: ImageFormat;
    quality?: number;
}

export interface BlurOptions {
    radius?: number;
    format?: ImageFormat;
    quality?: number;
}

interface PendingTask {
    resolve: (value: Blob) => void;
    reject: (error: Error) => void;
}

class ImageProcessorService {
    private worker: Worker | null = null;
    private pendingTasks = new Map<string, PendingTask>();
    private taskIdCounter = 0;
    private isSupported = true;

    constructor() {
        this.initWorker();
    }

    /**
     * 初始化 Worker
     */
    private initWorker(): void {
        try {
            // 检查 Worker 和 OffscreenCanvas 支持
            if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
                console.warn('[ImageProcessor] Web Worker or OffscreenCanvas not supported');
                this.isSupported = false;
                return;
            }

            // 创建内联 Worker
            const workerCode = `
                let canvas = null;
                let context = null;

                function initCanvas(width, height) {
                    canvas = new OffscreenCanvas(width, height);
                    context = canvas.getContext('2d');
                }

                self.onmessage = async (e) => {
                    const { type, id, imageData, options } = e.data;

                    try {
                        const imageBitmap = await createImageBitmap(new Blob([imageData]));
                        let result;

                        switch (type) {
                            case 'resize': {
                                const { width = 800, height = 600, maintainAspect = true, format = 'png', quality = 0.9 } = options;
                                let targetWidth = width;
                                let targetHeight = height;

                                if (maintainAspect) {
                                    const aspectRatio = imageBitmap.width / imageBitmap.height;
                                    if (width / height > aspectRatio) {
                                        targetWidth = Math.round(height * aspectRatio);
                                    } else {
                                        targetHeight = Math.round(width / aspectRatio);
                                    }
                                }

                                initCanvas(targetWidth, targetHeight);
                                context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
                                const blob = await canvas.convertToBlob({ type: 'image/' + format, quality });
                                result = await blob.arrayBuffer();
                                break;
                            }
                            case 'compress': {
                                const { quality = 0.8, format = 'jpeg' } = options;
                                initCanvas(imageBitmap.width, imageBitmap.height);
                                context.drawImage(imageBitmap, 0, 0);
                                const blob = await canvas.convertToBlob({ type: 'image/' + format, quality });
                                result = await blob.arrayBuffer();
                                break;
                            }
                            case 'crop': {
                                const { x = 0, y = 0, cropWidth, cropHeight, format = 'png', quality = 0.9 } = options;
                                const finalWidth = cropWidth || imageBitmap.width - x;
                                const finalHeight = cropHeight || imageBitmap.height - y;
                                initCanvas(finalWidth, finalHeight);
                                context.drawImage(imageBitmap, x, y, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);
                                const blob = await canvas.convertToBlob({ type: 'image/' + format, quality });
                                result = await blob.arrayBuffer();
                                break;
                            }
                            case 'convert': {
                                const { format = 'webp', quality = 0.9 } = options;
                                initCanvas(imageBitmap.width, imageBitmap.height);
                                context.drawImage(imageBitmap, 0, 0);
                                const blob = await canvas.convertToBlob({ type: 'image/' + format, quality });
                                result = await blob.arrayBuffer();
                                break;
                            }
                            case 'blur': {
                                const { blurRadius = 5, format = 'png', quality = 0.9 } = options;
                                initCanvas(imageBitmap.width, imageBitmap.height);
                                context.filter = 'blur(' + blurRadius + 'px)';
                                context.drawImage(imageBitmap, 0, 0);
                                context.filter = 'none';
                                const blob = await canvas.convertToBlob({ type: 'image/' + format, quality });
                                result = await blob.arrayBuffer();
                                break;
                            }
                            default:
                                throw new Error('Unknown operation: ' + type);
                        }

                        self.postMessage({ type: 'success', id, result }, [result]);

                    } catch (error) {
                        self.postMessage({ type: 'error', id, error: error.message || String(error) });
                    }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));

            this.worker.onmessage = (e) => {
                const { type, id, result, error } = e.data;
                const task = this.pendingTasks.get(id);

                if (task) {
                    this.pendingTasks.delete(id);

                    if (type === 'success' && result) {
                        task.resolve(new Blob([result]));
                    } else {
                        task.reject(new Error(error || 'Unknown error'));
                    }
                }
            };

            this.worker.onerror = (e) => {
                console.error('[ImageProcessor] Worker error:', e);
            };

            console.log('[ImageProcessor] Worker initialized');

        } catch (error) {
            console.error('[ImageProcessor] Failed to init worker:', error);
            this.isSupported = false;
        }
    }

    /**
     * 发送任务到 Worker
     */
    private async sendTask(
        type: string,
        imageBlob: Blob,
        options: any
    ): Promise<Blob> {
        if (!this.isSupported || !this.worker) {
            throw new Error('Web Worker not supported');
        }

        const id = `task_${++this.taskIdCounter}`;
        const imageData = await imageBlob.arrayBuffer();

        return new Promise((resolve, reject) => {
            this.pendingTasks.set(id, { resolve, reject });

            this.worker!.postMessage({
                type,
                id,
                imageData,
                options
            }, [imageData]);

            // 超时处理 (30秒)
            setTimeout(() => {
                if (this.pendingTasks.has(id)) {
                    this.pendingTasks.delete(id);
                    reject(new Error('Processing timeout'));
                }
            }, 30000);
        });
    }

    /**
     * 调整图片大小
     */
    async resize(image: Blob | string, options: ResizeOptions): Promise<Blob> {
        const blob = await this.toBlob(image);
        return this.sendTask('resize', blob, options);
    }

    /**
     * 压缩图片
     */
    async compress(image: Blob | string, options: CompressOptions = {}): Promise<Blob> {
        const blob = await this.toBlob(image);
        return this.sendTask('compress', blob, options);
    }

    /**
     * 裁剪图片
     */
    async crop(image: Blob | string, options: CropOptions): Promise<Blob> {
        const blob = await this.toBlob(image);
        return this.sendTask('crop', blob, {
            x: options.x,
            y: options.y,
            cropWidth: options.width,
            cropHeight: options.height,
            format: options.format,
            quality: options.quality
        });
    }

    /**
     * 转换格式
     */
    async convert(image: Blob | string, options: ConvertOptions): Promise<Blob> {
        const blob = await this.toBlob(image);
        return this.sendTask('convert', blob, options);
    }

    /**
     * 模糊图片
     */
    async blur(image: Blob | string, options: BlurOptions = {}): Promise<Blob> {
        const blob = await this.toBlob(image);
        return this.sendTask('blur', blob, {
            blurRadius: options.radius ?? 5,
            format: options.format,
            quality: options.quality
        });
    }

    /**
     * 检查是否支持 Worker 处理
     */
    isWorkerSupported(): boolean {
        return this.isSupported;
    }

    /**
     * 转换为 Blob
     */
    private async toBlob(image: Blob | string): Promise<Blob> {
        if (image instanceof Blob) {
            return image;
        }

        // URL 转 Blob
        const response = await fetch(image);
        return response.blob();
    }

    /**
     * 销毁 Worker
     */
    destroy(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingTasks.clear();
    }
}

// 导出单例
export const imageProcessor = new ImageProcessorService();
export default imageProcessor;
