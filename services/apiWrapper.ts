/**
 * API Wrapper - 统一请求处理工具
 * 
 * 提供重试、超时、错误处理等通用功能
 * 
 * 使用方式:
 * ```ts
 * // 基础用法
 * const result = await withRetry(() => fetch('/api/data'));
 * 
 * // 带配置
 * const result = await withRetry(
 *   () => generateImage(prompt),
 *   { maxRetries: 3, retryDelay: 2000 }
 * );
 * ```
 */

export interface RetryConfig {
    /** 最大重试次数，默认 3 */
    maxRetries?: number;
    /** 重试间隔（毫秒），默认 1000，会指数退避 */
    retryDelay?: number;
    /** 是否使用指数退避，默认 true */
    exponentialBackoff?: boolean;
    /** 重试回调，用于日志或 UI 提示 */
    onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
    /** 自定义判断是否应该重试 */
    shouldRetry?: (error: Error) => boolean;
    /** 超时时间（毫秒），默认无超时 */
    timeout?: number;
}

export interface RequestResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
}

/**
 * 判断错误是否可重试
 * 默认：网络错误、5xx错误、超时错误可重试
 * 4xx错误（如参数错误）不应重试
 */
function isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // 网络错误
    if (message.includes('network') ||
        message.includes('fetch') ||
        message.includes('failed to fetch') ||
        message.includes('connection refused') ||
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('etimedout')) {
        return true;
    }

    // 超时错误
    if (message.includes('timeout') || message.includes('timed out')) {
        return true;
    }

    // 服务器错误 (5xx)
    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('internal server error') ||
        message.includes('bad gateway') ||
        message.includes('service unavailable')) {
        return true;
    }

    // 限流错误
    if (message.includes('429') ||
        message.includes('too many requests') ||
        message.includes('rate limit')) {
        return true;
    }

    // 临时错误
    if (message.includes('temporary') || message.includes('retry')) {
        return true;
    }

    return false;
}

/**
 * 创建带超时的 Promise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation = 'Operation'): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${operation} timed out after ${ms}ms`));
        }, ms);

        promise
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

/**
 * 带重试的异步函数包装器
 * 
 * @param fn 要执行的异步函数
 * @param config 重试配置
 * @returns Promise<T>
 * 
 * @example
 * ```ts
 * // 简单用法
 * const data = await withRetry(() => fetch('/api'));
 * 
 * // 带进度回调
 * const data = await withRetry(
 *   () => generateImage(prompt),
 *   {
 *     maxRetries: 3,
 *     retryDelay: 2000,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`重试第 ${attempt} 次，${delay}ms 后继续...`);
 *       setStatus(`生成失败，正在重试 (${attempt}/3)...`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig = {}
): Promise<T> {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        exponentialBackoff = true,
        onRetry,
        shouldRetry = isRetryableError,
        timeout
    } = config;

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const promise = fn();

            if (timeout) {
                return await withTimeout(promise, timeout, 'Request');
            }

            return await promise;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // 如果是最后一次尝试，直接抛出
            if (attempt > maxRetries) {
                throw lastError;
            }

            // 如果错误不应该重试，直接抛出
            if (!shouldRetry(lastError)) {
                throw lastError;
            }

            // 计算延迟时间
            const delay = exponentialBackoff
                ? retryDelay * Math.pow(2, attempt - 1)  // 1x, 2x, 4x, ...
                : retryDelay;

            // 调用重试回调
            if (onRetry) {
                onRetry(attempt, lastError, delay);
            }

            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * 带重试的 fetch 包装器
 * 自动处理 Response 状态检查
 */
export async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    config?: RetryConfig
): Promise<Response> {
    return withRetry(async () => {
        const response = await fetch(url, options);

        // 将 HTTP 错误转换为异常
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${response.statusText}${text ? ` - ${text.substring(0, 200)}` : ''}`);
        }

        return response;
    }, config);
}

/**
 * 带重试的 JSON 请求
 */
export async function fetchJsonWithRetry<T>(
    url: string,
    options?: RequestInit,
    config?: RetryConfig
): Promise<T> {
    const response = await fetchWithRetry(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    }, config);

    return response.json();
}

/**
 * 队列化的请求执行器
 * 用于避免并发请求过多
 */
export class RequestQueue {
    private queue: Array<() => Promise<void>> = [];
    private running = 0;
    private maxConcurrent: number;

    constructor(maxConcurrent = 2) {
        this.maxConcurrent = maxConcurrent;
    }

    async add<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
        return new Promise((resolve, reject) => {
            const task = async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.running--;
                    this.next();
                }
            };

            // 简单的优先级实现：priority > 0 加到队首
            if (priority > 0) {
                this.queue.unshift(task);
            } else {
                this.queue.push(task);
            }

            this.next();
        });
    }

    private next() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        if (task) {
            this.running++;
            task();
        }
    }

    get pending() {
        return this.queue.length;
    }

    get active() {
        return this.running;
    }
}

/**
 * 创建带重试的 API 客户端
 * 
 * @example
 * ```ts
 * const api = createRetryClient({
 *   baseUrl: 'http://localhost:8046',
 *   defaultRetries: 3,
 *   onError: (error) => console.error('[API]', error)
 * });
 * 
 * const result = await api.post('/v2/image_generation', { prompt: '...' });
 * ```
 */
export function createRetryClient(options: {
    baseUrl?: string;
    defaultRetries?: number;
    defaultTimeout?: number;
    defaultHeaders?: Record<string, string>;
    onError?: (error: Error, url: string) => void;
    onRetry?: (attempt: number, error: Error, url: string) => void;
}) {
    const {
        baseUrl = '',
        defaultRetries = 3,
        defaultTimeout = 30000,
        defaultHeaders = {},
        onError,
        onRetry
    } = options;

    async function request<T>(
        method: string,
        path: string,
        body?: unknown,
        customConfig?: RetryConfig & { headers?: Record<string, string> }
    ): Promise<T> {
        const url = baseUrl + path;

        try {
            return await fetchJsonWithRetry<T>(
                url,
                {
                    method,
                    headers: {
                        ...defaultHeaders,
                        ...customConfig?.headers
                    },
                    body: body ? JSON.stringify(body) : undefined
                },
                {
                    maxRetries: customConfig?.maxRetries ?? defaultRetries,
                    timeout: customConfig?.timeout ?? defaultTimeout,
                    onRetry: (attempt, error, delay) => {
                        onRetry?.(attempt, error, url);
                        customConfig?.onRetry?.(attempt, error, delay);
                    },
                    ...customConfig
                }
            );
        } catch (error) {
            onError?.(error as Error, url);
            throw error;
        }
    }

    return {
        get: <T>(path: string, config?: RetryConfig) => request<T>('GET', path, undefined, config),
        post: <T>(path: string, body?: unknown, config?: RetryConfig) => request<T>('POST', path, body, config),
        put: <T>(path: string, body?: unknown, config?: RetryConfig) => request<T>('PUT', path, body, config),
        delete: <T>(path: string, config?: RetryConfig) => request<T>('DELETE', path, undefined, config)
    };
}

// --- 全局实例（可选使用）---

/** 图片生成请求队列，限制最多 2 个并发 */
export const imageGenerationQueue = new RequestQueue(2);

/** 视频生成请求队列，限制最多 1 个并发 */
export const videoGenerationQueue = new RequestQueue(1);

// --- 工具函数 ---

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带取消功能的延迟
 */
export function cancellableDelay(ms: number): { promise: Promise<void>; cancel: () => void } {
    let timer: ReturnType<typeof setTimeout>;
    const promise = new Promise<void>(resolve => {
        timer = setTimeout(resolve, ms);
    });

    return {
        promise,
        cancel: () => clearTimeout(timer)
    };
}

export default {
    withRetry,
    fetchWithRetry,
    fetchJsonWithRetry,
    createRetryClient,
    RequestQueue,
    imageGenerationQueue,
    videoGenerationQueue,
    delay,
    cancellableDelay
};
