/**
 * API Queue Service
 * 
 * 提供 API 调用队列管理，支持：
 * - 并发控制 (防止 API 限流)
 * - 自动重试 (指数退避)
 * - 任务优先级
 * - 进度回调
 * - 批量任务管理
 * 
 * @since 2026-01-13
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface QueueTask<T = any> {
    id: string;
    name: string;
    priority: TaskPriority;
    status: TaskStatus;
    execute: () => Promise<T>;
    result?: T;
    error?: Error;
    retryCount: number;
    maxRetries: number;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    progress?: number;
    onProgress?: (progress: number) => void;
    onComplete?: (result: T) => void;
    onError?: (error: Error) => void;
}

export interface QueueOptions {
    maxConcurrent: number;
    defaultMaxRetries: number;
    retryDelayBase: number; // Base delay in ms (will be exponentially increased)
    retryDelayMax: number;  // Maximum retry delay
    onTaskStart?: (task: QueueTask) => void;
    onTaskComplete?: (task: QueueTask) => void;
    onTaskError?: (task: QueueTask) => void;
    onQueueEmpty?: () => void;
    onProgressChange?: (completed: number, total: number, running: number) => void;
}

const DEFAULT_OPTIONS: QueueOptions = {
    maxConcurrent: 2,
    defaultMaxRetries: 3,
    retryDelayBase: 1000,
    retryDelayMax: 30000
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3
};

class ApiQueue {
    private queue: QueueTask[] = [];
    private running: Map<string, QueueTask> = new Map();
    private completed: QueueTask[] = [];
    private options: QueueOptions;
    private isPaused: boolean = false;
    private listeners: Map<string, Set<(event: any) => void>> = new Map();

    constructor(options: Partial<QueueOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * 添加任务到队列
     */
    addTask<T>(
        name: string,
        execute: () => Promise<T>,
        options: {
            priority?: TaskPriority;
            maxRetries?: number;
            onProgress?: (progress: number) => void;
            onComplete?: (result: T) => void;
            onError?: (error: Error) => void;
        } = {}
    ): string {
        const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const task: QueueTask<T> = {
            id,
            name,
            priority: options.priority || 'normal',
            status: 'pending',
            execute,
            retryCount: 0,
            maxRetries: options.maxRetries ?? this.options.defaultMaxRetries,
            createdAt: Date.now(),
            onProgress: options.onProgress,
            onComplete: options.onComplete,
            onError: options.onError
        };

        // 按优先级插入队列
        const insertIndex = this.queue.findIndex(
            t => PRIORITY_ORDER[t.priority] > PRIORITY_ORDER[task.priority]
        );

        if (insertIndex === -1) {
            this.queue.push(task);
        } else {
            this.queue.splice(insertIndex, 0, task);
        }

        console.log(`[ApiQueue] Task added: ${name} (${id}), priority: ${task.priority}`);
        this.emit('taskAdded', task);
        this.processQueue();

        return id;
    }

    /**
     * 批量添加任务
     */
    addBatch<T>(
        tasks: Array<{
            name: string;
            execute: () => Promise<T>;
            priority?: TaskPriority;
        }>,
        options: {
            onBatchComplete?: (results: T[]) => void;
            onBatchError?: (errors: Error[]) => void;
            onBatchProgress?: (completed: number, total: number) => void;
        } = {}
    ): string[] {
        const ids: string[] = [];
        const results: T[] = [];
        const errors: Error[] = [];
        let completedCount = 0;
        const total = tasks.length;

        tasks.forEach((taskDef, index) => {
            const id = this.addTask(taskDef.name, taskDef.execute, {
                priority: taskDef.priority,
                onComplete: (result) => {
                    results[index] = result;
                    completedCount++;
                    options.onBatchProgress?.(completedCount, total);

                    if (completedCount === total) {
                        if (errors.length === 0) {
                            options.onBatchComplete?.(results);
                        } else {
                            options.onBatchError?.(errors);
                        }
                    }
                },
                onError: (error) => {
                    errors.push(error);
                    completedCount++;
                    options.onBatchProgress?.(completedCount, total);

                    if (completedCount === total) {
                        options.onBatchError?.(errors);
                    }
                }
            });
            ids.push(id);
        });

        console.log(`[ApiQueue] Batch added: ${total} tasks`);
        return ids;
    }

    /**
     * 处理队列
     */
    private async processQueue(): Promise<void> {
        if (this.isPaused) return;

        while (
            this.running.size < this.options.maxConcurrent &&
            this.queue.length > 0
        ) {
            const task = this.queue.shift()!;
            this.executeTask(task);
        }

        this.emitProgress();
    }

    /**
     * 执行单个任务
     */
    private async executeTask(task: QueueTask): Promise<void> {
        task.status = 'running';
        task.startedAt = Date.now();
        this.running.set(task.id, task);

        console.log(`[ApiQueue] Executing: ${task.name} (${task.id}), attempt ${task.retryCount + 1}`);
        this.options.onTaskStart?.(task);
        this.emit('taskStart', task);

        try {
            const result = await task.execute();

            task.result = result;
            task.status = 'completed';
            task.completedAt = Date.now();

            console.log(`[ApiQueue] Completed: ${task.name} (${task.id}) in ${task.completedAt - task.startedAt!}ms`);

            task.onComplete?.(result);
            this.options.onTaskComplete?.(task);
            this.emit('taskComplete', task);

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            task.retryCount++;

            console.error(`[ApiQueue] Failed: ${task.name} (${task.id}), attempt ${task.retryCount}/${task.maxRetries}`, err.message);

            if (task.retryCount < task.maxRetries) {
                // 重新加入队列，使用指数退避
                const delay = Math.min(
                    this.options.retryDelayBase * Math.pow(2, task.retryCount - 1),
                    this.options.retryDelayMax
                );

                console.log(`[ApiQueue] Retrying ${task.name} in ${delay}ms...`);

                setTimeout(() => {
                    task.status = 'pending';
                    this.queue.unshift(task); // 高优先级重试
                    this.processQueue();
                }, delay);
            } else {
                // 最终失败
                task.error = err;
                task.status = 'failed';
                task.completedAt = Date.now();

                task.onError?.(err);
                this.options.onTaskError?.(task);
                this.emit('taskError', task);
            }
        } finally {
            this.running.delete(task.id);
            this.completed.push(task);
            this.processQueue();

            // 检查队列是否为空
            if (this.queue.length === 0 && this.running.size === 0) {
                this.options.onQueueEmpty?.();
                this.emit('queueEmpty', null);
            }
        }
    }

    /**
     * 取消任务
     */
    cancelTask(id: string): boolean {
        const index = this.queue.findIndex(t => t.id === id);
        if (index !== -1) {
            const task = this.queue.splice(index, 1)[0];
            task.status = 'cancelled';
            task.completedAt = Date.now();
            this.completed.push(task);
            console.log(`[ApiQueue] Cancelled: ${task.name} (${id})`);
            this.emit('taskCancelled', task);
            return true;
        }
        return false;
    }

    /**
     * 取消所有待处理任务
     */
    cancelAll(): number {
        const count = this.queue.length;
        this.queue.forEach(task => {
            task.status = 'cancelled';
            task.completedAt = Date.now();
            this.completed.push(task);
        });
        this.queue = [];
        console.log(`[ApiQueue] Cancelled all ${count} pending tasks`);
        this.emit('queueCleared', { count });
        return count;
    }

    /**
     * 暂停队列处理
     */
    pause(): void {
        this.isPaused = true;
        console.log('[ApiQueue] Queue paused');
        this.emit('queuePaused', null);
    }

    /**
     * 恢复队列处理
     */
    resume(): void {
        this.isPaused = false;
        console.log('[ApiQueue] Queue resumed');
        this.emit('queueResumed', null);
        this.processQueue();
    }

    /**
     * 获取任务状态
     */
    getTaskStatus(id: string): QueueTask | undefined {
        return this.queue.find(t => t.id === id) ||
            this.running.get(id) ||
            this.completed.find(t => t.id === id);
    }

    /**
     * 获取队列统计
     */
    getStats(): {
        pending: number;
        running: number;
        completed: number;
        failed: number;
        total: number;
    } {
        const failed = this.completed.filter(t => t.status === 'failed').length;
        return {
            pending: this.queue.length,
            running: this.running.size,
            completed: this.completed.filter(t => t.status === 'completed').length,
            failed,
            total: this.queue.length + this.running.size + this.completed.length
        };
    }

    /**
     * 清空已完成的任务记录
     */
    clearCompleted(): void {
        this.completed = [];
    }

    /**
     * 事件监听
     */
    on(event: string, callback: (data: any) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // 返回取消订阅函数
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    private emit(event: string, data: any): void {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`[ApiQueue] Event handler error for ${event}:`, e);
            }
        });
    }

    private emitProgress(): void {
        const stats = this.getStats();
        this.options.onProgressChange?.(
            stats.completed,
            stats.total,
            stats.running
        );
        this.emit('progress', stats);
    }
}

// 导出默认实例 (用于图片生成)
export const imageQueue = new ApiQueue({
    maxConcurrent: 2,
    defaultMaxRetries: 3,
    retryDelayBase: 2000
});

// 导出视频生成队列 (更低并发)
export const videoQueue = new ApiQueue({
    maxConcurrent: 1,
    defaultMaxRetries: 2,
    retryDelayBase: 5000
});

// 导出通用队列类
export { ApiQueue };
export default imageQueue;
