import { storageService } from './storageService';

interface CacheEntry<T> {
    id: string;
    data: T;
    timestamp: number;
    expiresAt: number;
}

interface CacheOptions {
    /** 缓存时间 (毫秒), 默认 5 分钟 */
    ttl?: number;
    /** 是否使用 IndexedDB 持久化 */
    persistent?: boolean;
    /** 缓存键前缀 */
    prefix?: string;
}

class ApiCacheService {
    private memoryCache = new Map<string, CacheEntry<any>>();
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟
    private readonly MAX_MEMORY_ENTRIES = 50;
    private readonly MAX_STORAGE_ENTRIES = 200;

    /**
     * 获取缓存数据
     */
    async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
        const fullKey = this.getFullKey(key, options);

        // 先检查内存缓存
        const memEntry = this.memoryCache.get(fullKey);
        if (memEntry) {
            if (Date.now() < memEntry.expiresAt) {
                return memEntry.data as T;
            } else {
                this.memoryCache.delete(fullKey);
            }
        }

        // 检查持久化缓存 (IndexedDB)
        if (options?.persistent !== false) {
            try {
                const stored = await storageService.getCacheEntry(fullKey) as CacheEntry<T> | null;
                if (stored) {
                    if (Date.now() < stored.expiresAt) {
                        // 恢复到内存缓存
                        this.setMemoryCache(fullKey, stored);
                        return stored.data;
                    } else {
                        await storageService.deleteCacheEntry(fullKey);
                    }
                }
            } catch (e) {
                // 忽略错误
            }
        }

        return null;
    }

    /**
     * 设置缓存数据
     */
    async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
        const fullKey = this.getFullKey(key, options);
        const ttl = options?.ttl ?? this.DEFAULT_TTL;

        const entry: CacheEntry<T> = {
            id: fullKey,
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl
        };

        // 设置内存缓存
        this.setMemoryCache(fullKey, entry);

        // 持久化缓存
        if (options?.persistent !== false) {
            try {
                await storageService.saveCacheEntry(entry);

                // 定期检查存储大小 (简单粗暴的限制)
                const stats = await this.getStats();
                if (stats.storageSize > this.MAX_STORAGE_ENTRIES) {
                    await this.cleanup();
                }
            } catch (e) {
                console.warn('[ApiCache] Failed to persist cache to IDB:', e);
            }
        }
    }

    /**
     * 删除缓存
     */
    async delete(key: string, options?: CacheOptions): Promise<void> {
        const fullKey = this.getFullKey(key, options);
        this.memoryCache.delete(fullKey);
        await storageService.deleteCacheEntry(fullKey);
    }

    /**
     * 清除所有缓存
     */
    async clear(): Promise<void> {
        this.memoryCache.clear();
        await storageService.clearCache();
        console.log('[ApiCache] Cleared all cache entries');
    }

    /**
     * 清理过期或多余缓存
     */
    async cleanup(): Promise<number> {
        let cleaned = 0;
        const now = Date.now();

        // 1. 清理内存缓存
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now >= entry.expiresAt) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }

        // 2. 清理 IndexedDB
        try {
            const allEntries = await storageService.getAllCacheEntries() as CacheEntry<any>[];

            // 过期的
            const expired = allEntries.filter(e => now >= e.expiresAt);
            for (const entry of expired) {
                await storageService.deleteCacheEntry(entry.id);
                cleaned++;
            }

            // 如果还是太多，按照时间删除最旧的
            const remaining = allEntries.filter(e => now < e.expiresAt)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (remaining.length > this.MAX_STORAGE_ENTRIES) {
                const toDelete = remaining.slice(0, remaining.length - this.MAX_STORAGE_ENTRIES);
                for (const entry of toDelete) {
                    await storageService.deleteCacheEntry(entry.id);
                    cleaned++;
                }
            }
        } catch (e) {
            console.warn('[ApiCache] Cleanup failed:', e);
        }

        return cleaned;
    }

    /**
     * 带缓存的 fetch 包装
     */
    async cachedFetch<T>(
        url: string,
        options?: RequestInit & CacheOptions
    ): Promise<T> {
        const cacheKey = this.generateCacheKey(url, options);

        // 尝试从缓存获取
        const cached = await this.get<T>(cacheKey, options);
        if (cached !== null) {
            console.log(`[ApiCache] Cache hit: ${url}`);
            return cached;
        }

        // 发起请求
        console.log(`[ApiCache] Cache miss: ${url}`);
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as T;

        // 缓存响应
        await this.set(cacheKey, data, options);

        return data;
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(url: string, options?: RequestInit): string {
        const parts = [url];

        if (options?.method && options.method !== 'GET') {
            parts.push(options.method);
        }

        if (options?.body) {
            const bodyHash = this.simpleHash(
                typeof options.body === 'string'
                    ? options.body
                    : JSON.stringify(options.body)
            );
            parts.push(bodyHash);
        }

        return parts.join('_');
    }

    /**
     * 简单哈希函数
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 获取完整缓存键
     */
    private getFullKey(key: string, options?: CacheOptions): string {
        return options?.prefix ? `${options.prefix}_${key}` : key;
    }

    /**
     * 设置内存缓存（带大小限制）
     */
    private setMemoryCache<T>(key: string, entry: CacheEntry<T>): void {
        // 如果超过限制，删除最旧的条目
        if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
            const oldestKey = this.memoryCache.keys().next().value;
            if (oldestKey) {
                this.memoryCache.delete(oldestKey);
            }
        }

        this.memoryCache.set(key, entry);
    }

    /**
     * 获取缓存统计
     */
    async getStats(): Promise<{ memorySize: number; storageSize: number }> {
        const all = await storageService.getAllCacheEntries();
        return {
            memorySize: this.memoryCache.size,
            storageSize: all.length
        };
    }
}

// 导出单例
export const apiCache = new ApiCacheService();
export default apiCache;

// 定期清理过期缓存 (每 10 分钟)
if (typeof window !== 'undefined') {
    setInterval(async () => {
        const cleaned = await apiCache.cleanup();
        if (cleaned > 0) {
            console.log(`[ApiCache] Cleaned ${cleaned} entries`);
        }
    }, 10 * 60 * 1000);
}
