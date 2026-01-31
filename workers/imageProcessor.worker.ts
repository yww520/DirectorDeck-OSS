/**
 * Image Processing Worker
 * 
 * 在 Web Worker 中执行耗时的图片处理操作
 * 
 * @since 2026-01-13
 */

// Worker 消息类型
interface WorkerMessage {
    type: 'resize' | 'compress' | 'crop' | 'convert' | 'blur';
    id: string;
    imageData: ArrayBuffer;
    options: ProcessingOptions;
}

interface ProcessingOptions {
    // 通用
    format?: 'png' | 'jpeg' | 'webp';
    quality?: number; // 0-1

    // resize
    width?: number;
    height?: number;
    maintainAspect?: boolean;

    // crop
    x?: number;
    y?: number;
    cropWidth?: number;
    cropHeight?: number;

    // blur
    blurRadius?: number;
}

interface WorkerResponse {
    type: 'success' | 'error' | 'progress';
    id: string;
    result?: ArrayBuffer;
    error?: string;
    progress?: number;
}

// Worker 上下文
const ctx: Worker = self as any;

// 创建 OffscreenCanvas (如果支持)
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;

function initCanvas(width: number, height: number): void {
    canvas = new OffscreenCanvas(width, height);
    context = canvas.getContext('2d');
}

// 处理消息
ctx.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, id, imageData, options } = e.data;

    try {
        let result: ArrayBuffer;

        switch (type) {
            case 'resize':
                result = await processResize(imageData, options);
                break;
            case 'compress':
                result = await processCompress(imageData, options);
                break;
            case 'crop':
                result = await processCrop(imageData, options);
                break;
            case 'convert':
                result = await processConvert(imageData, options);
                break;
            case 'blur':
                result = await processBlur(imageData, options);
                break;
            default:
                throw new Error(`Unknown operation: ${type}`);
        }

        ctx.postMessage({
            type: 'success',
            id,
            result
        } as WorkerResponse, [result]);

    } catch (error) {
        ctx.postMessage({
            type: 'error',
            id,
            error: error instanceof Error ? error.message : String(error)
        } as WorkerResponse);
    }
};

// 调整大小
async function processResize(
    imageData: ArrayBuffer,
    options: ProcessingOptions
): Promise<ArrayBuffer> {
    const { width = 800, height = 600, maintainAspect = true, format = 'png', quality = 0.9 } = options;

    const imageBitmap = await createImageBitmap(new Blob([imageData]));

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
    if (!context || !canvas) throw new Error('Canvas init failed');

    context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    const blob = await canvas.convertToBlob({
        type: `image/${format}`,
        quality
    });

    return blob.arrayBuffer();
}

// 压缩
async function processCompress(
    imageData: ArrayBuffer,
    options: ProcessingOptions
): Promise<ArrayBuffer> {
    const { quality = 0.8, format = 'jpeg' } = options;

    const imageBitmap = await createImageBitmap(new Blob([imageData]));

    initCanvas(imageBitmap.width, imageBitmap.height);
    if (!context || !canvas) throw new Error('Canvas init failed');

    context.drawImage(imageBitmap, 0, 0);

    const blob = await canvas.convertToBlob({
        type: `image/${format}`,
        quality
    });

    return blob.arrayBuffer();
}

// 裁剪
async function processCrop(
    imageData: ArrayBuffer,
    options: ProcessingOptions
): Promise<ArrayBuffer> {
    const { x = 0, y = 0, cropWidth, cropHeight, format = 'png', quality = 0.9 } = options;

    const imageBitmap = await createImageBitmap(new Blob([imageData]));

    const finalWidth = cropWidth || imageBitmap.width - x;
    const finalHeight = cropHeight || imageBitmap.height - y;

    initCanvas(finalWidth, finalHeight);
    if (!context || !canvas) throw new Error('Canvas init failed');

    context.drawImage(
        imageBitmap,
        x, y, finalWidth, finalHeight,
        0, 0, finalWidth, finalHeight
    );

    const blob = await canvas.convertToBlob({
        type: `image/${format}`,
        quality
    });

    return blob.arrayBuffer();
}

// 格式转换
async function processConvert(
    imageData: ArrayBuffer,
    options: ProcessingOptions
): Promise<ArrayBuffer> {
    const { format = 'webp', quality = 0.9 } = options;

    const imageBitmap = await createImageBitmap(new Blob([imageData]));

    initCanvas(imageBitmap.width, imageBitmap.height);
    if (!context || !canvas) throw new Error('Canvas init failed');

    context.drawImage(imageBitmap, 0, 0);

    const blob = await canvas.convertToBlob({
        type: `image/${format}`,
        quality
    });

    return blob.arrayBuffer();
}

// 模糊 (简单盒式模糊)
async function processBlur(
    imageData: ArrayBuffer,
    options: ProcessingOptions
): Promise<ArrayBuffer> {
    const { blurRadius = 5, format = 'png', quality = 0.9 } = options;

    const imageBitmap = await createImageBitmap(new Blob([imageData]));

    initCanvas(imageBitmap.width, imageBitmap.height);
    if (!context || !canvas) throw new Error('Canvas init failed');

    // 使用 CSS filter 模拟模糊
    context.filter = `blur(${blurRadius}px)`;
    context.drawImage(imageBitmap, 0, 0);
    context.filter = 'none';

    const blob = await canvas.convertToBlob({
        type: `image/${format}`,
        quality
    });

    return blob.arrayBuffer();
}

// 导出空对象以满足模块要求
export { };
