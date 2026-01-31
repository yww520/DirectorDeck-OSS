/**
 * DubbingPanel API 调用包装器
 * 
 * 这个文件展示如何将现有的 DubbingPanel API 调用迁移到使用重试机制。
 * 可以直接在 DubbingPanel 中导入替换使用。
 * 
 * 使用方式:
 * 1. 在 DubbingPanel.tsx 中导入: import { uploadVoiceFile, triggerGeneration, pollResult } from './dubbingApiWrapper';
 * 2. 替换现有的 fetch 调用
 */

import { withRetry, fetchWithRetry, RetryConfig } from '../services/apiWrapper';

/**
 * 默认重试配置 - 针对 TTS API 优化
 */
const TTS_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    timeoutMs: 60000, // TTS 生成可能需要较长时间
    retryOn: (error) => {
        // 网络错误、服务器错误时重试
        if (error.name === 'TypeError' || error.message?.includes('network')) return true;
        if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) return true;
        return false;
    }
};

/**
 * 上传语音文件到 Gradio 服务
 * 
 * @param baseUrl Gradio 服务 URL
 * @param voiceBlob 语音文件 Blob
 * @returns 服务器路径
 */
export async function uploadVoiceFile(
    baseUrl: string,
    voiceBlob: Blob
): Promise<string> {
    const formData = new FormData();
    formData.append('files', voiceBlob, 'voice.wav');

    return withRetry(async () => {
        // 尝试主路径
        let response = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            body: formData
        });

        // 如果 404，尝试备用路径
        if (response.status === 404) {
            response = await fetch(`${baseUrl}/gradio_api/upload`, {
                method: 'POST',
                body: formData
            });
        }

        if (!response.ok) {
            throw new Error(`音频上传失败 (${response.status})`);
        }

        const data = await response.json();
        return data[0]; // 返回服务器路径
    }, {
        ...TTS_RETRY_CONFIG,
        maxRetries: 2, // 上传失败快速失败
        onRetry: (error, attempt) => {
            console.warn(`[TTS] 上传重试 ${attempt}: ${error.message}`);
        }
    });
}

/**
 * TTS 生成 Payload 类型
 */
export interface TTSPayload {
    emoMode: number;
    serverPath: string;
    text: string;
    emoWeight: number;
    emotionVectors: {
        happy: number;
        angry: number;
        sad: number;
        fear: number;
        disgust: number;
        depressed: number;
        surprise: number;
        calm: number;
    };
}

/**
 * 触发 TTS 生成
 * 
 * @param baseUrl Gradio 服务 URL
 * @param payload TTS 参数
 * @returns event_id 用于轮询结果
 */
export async function triggerGeneration(
    baseUrl: string,
    payload: TTSPayload
): Promise<string> {
    const requestBody = {
        data: [
            payload.emoMode,
            { "path": payload.serverPath, "meta": { "_type": "gradio.FileData" } },
            payload.text,
            { "path": payload.serverPath, "meta": { "_type": "gradio.FileData" } },
            payload.emoWeight,
            payload.emotionVectors.happy,
            payload.emotionVectors.angry,
            payload.emotionVectors.sad,
            payload.emotionVectors.fear,
            payload.emotionVectors.disgust,
            payload.emotionVectors.depressed,
            payload.emotionVectors.surprise,
            payload.emotionVectors.calm,
            "", false, 120, true, 0.8, 30, 0.8, 0.0, 3, 10.0, 1500
        ]
    };

    return withRetry(async () => {
        let apiUrl = `${baseUrl}/call/gen_antigravity_v1`;
        let response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        // 如果 404，尝试备用路径
        if (response.status === 404) {
            apiUrl = `${baseUrl}/gradio_api/call/gen_antigravity_v1`;
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
        }

        if (!response.ok) {
            throw new Error(`生成任务启动失败 (${response.status})`);
        }

        const { event_id } = await response.json();
        return event_id;
    }, {
        ...TTS_RETRY_CONFIG,
        onRetry: (error, attempt) => {
            console.warn(`[TTS] 生成请求重试 ${attempt}: ${error.message}`);
        }
    });
}

/**
 * 轮询结果回调
 */
export interface PollCallbacks {
    onProgress?: (progress: number) => void;
    onComplete: (audioUrl: string) => void;
    onError: (error: Error) => void;
}

/**
 * 轮询 TTS 生成结果
 * 
 * @param baseUrl Gradio 服务 URL
 * @param eventId 事件 ID
 * @param callbacks 回调函数
 * @param maxWaitMs 最大等待时间（毫秒）
 */
export async function pollResult(
    baseUrl: string,
    eventId: string,
    callbacks: PollCallbacks,
    maxWaitMs: number = 600000
): Promise<void> {
    const startTime = Date.now();
    let progress = 0;

    // 尝试两个可能的 API 路径
    const possibleUrls = [
        `${baseUrl}/call/gen_antigravity_v1/${eventId}`,
        `${baseUrl}/gradio_api/call/gen_antigravity_v1/${eventId}`
    ];

    while (Date.now() - startTime < maxWaitMs) {
        try {
            // 使用重试包装的 fetch
            for (const statusUrl of possibleUrls) {
                try {
                    const response = await fetchWithRetry(statusUrl, {
                        headers: { 'Accept': 'text/event-stream' }
                    }, { maxRetries: 1, timeoutMs: 30000 });

                    if (!response.ok) {
                        progress = Math.min(progress + 2, 90);
                        callbacks.onProgress?.(progress);
                        await sleep(2000);
                        continue;
                    }

                    const reader = response.body?.getReader();
                    if (!reader) continue;

                    const decoder = new TextDecoder();
                    let buffer = "";

                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const dataStr = line.slice(6).trim();
                                if (dataStr) {
                                    try {
                                        const parsed = JSON.parse(dataStr);
                                        if (Array.isArray(parsed) && parsed.length > 0) {
                                            const firstElem = parsed[0];
                                            if (typeof firstElem === 'object' && firstElem !== null && 'url' in firstElem) {
                                                callbacks.onComplete(firstElem.url);
                                                return;
                                            }
                                        }
                                    } catch {
                                        // 忽略解析错误
                                    }
                                }
                            }
                        }
                    }
                } catch (fetchError) {
                    // 单个 URL 失败，尝试下一个
                    continue;
                }
            }

            // 更新进度
            progress = Math.min(progress + 5, 90);
            callbacks.onProgress?.(progress);
            await sleep(2000);

        } catch (error) {
            // 继续轮询
            await sleep(2000);
        }
    }

    callbacks.onError(new Error('生成超时，请重试'));
}

/**
 * 辅助：延迟
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 完整的 TTS 生成流程（带重试）
 * 
 * 一体化封装，包含上传、生成、轮询
 */
export async function generateTTSWithRetry(
    options: {
        baseUrl: string;
        voiceBlob: Blob;
        text: string;
        emoMode: number;
        emoWeight: number;
        emotionVectors: TTSPayload['emotionVectors'];
        onProgress?: (progress: number) => void;
    }
): Promise<string> {
    const { baseUrl, voiceBlob, text, emoMode, emoWeight, emotionVectors, onProgress } = options;

    // 1. 上传
    onProgress?.(10);
    const serverPath = await uploadVoiceFile(baseUrl, voiceBlob);

    // 2. 触发生成
    onProgress?.(20);
    const eventId = await triggerGeneration(baseUrl, {
        emoMode,
        serverPath,
        text,
        emoWeight,
        emotionVectors
    });

    // 3. 轮询结果
    return new Promise((resolve, reject) => {
        pollResult(baseUrl, eventId, {
            onProgress: (p) => onProgress?.(20 + p * 0.8),
            onComplete: (url) => {
                onProgress?.(100);
                resolve(url);
            },
            onError: reject
        });
    });
}
