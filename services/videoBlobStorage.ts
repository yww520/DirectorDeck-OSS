/**
 * Video Blob Storage Service
 * 
 * 专门用于视频 Blob 数据的 IndexedDB 存储
 * 解决刷新后视频丢失的问题
 * 
 * @since 2026-01-13
 */

const VIDEO_DB_NAME = 'directordeck_video_blobs';
const VIDEO_DB_VERSION = 1;
const VIDEO_STORE_NAME = 'videos';

interface VideoStorageItem {
    nodeId: string;
    projectId: string;
    blob: Blob;
    mimeType: string;
    createdAt: number;
    size: number;
}

class VideoBlobStorage {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * 初始化 IndexedDB
     */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(VIDEO_DB_NAME, VIDEO_DB_VERSION);

            request.onerror = () => {
                console.error('[VideoBlobStorage] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[VideoBlobStorage] Database initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
                    const store = db.createObjectStore(VIDEO_STORE_NAME, { keyPath: 'nodeId' });
                    store.createIndex('projectId', 'projectId', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    console.log('[VideoBlobStorage] Object store created');
                }
            };
        });

        return this.initPromise;
    }

    /**
     * 确保数据库已初始化
     */
    private async ensureDb(): Promise<IDBDatabase> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');
        return this.db;
    }

    /**
     * 保存视频 Blob
     */
    async saveVideoBlob(nodeId: string, projectId: string, blob: Blob): Promise<void> {
        const db = await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(VIDEO_STORE_NAME);

            const item: VideoStorageItem = {
                nodeId,
                projectId,
                blob,
                mimeType: blob.type || 'video/mp4',
                createdAt: Date.now(),
                size: blob.size
            };

            const request = store.put(item);

            request.onsuccess = () => {
                console.log(`[VideoBlobStorage] Saved video blob for node ${nodeId} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
                resolve();
            };

            request.onerror = () => {
                console.error('[VideoBlobStorage] Failed to save video:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 获取视频 Blob
     */
    async getVideoBlob(nodeId: string): Promise<Blob | null> {
        const db = await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readonly');
            const store = transaction.objectStore(VIDEO_STORE_NAME);
            const request = store.get(nodeId);

            request.onsuccess = () => {
                const item = request.result as VideoStorageItem | undefined;
                if (item?.blob) {
                    console.log(`[VideoBlobStorage] Retrieved video blob for node ${nodeId}`);
                    resolve(item.blob);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('[VideoBlobStorage] Failed to get video:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 获取项目的所有视频
     */
    async getVideosByProject(projectId: string): Promise<Map<string, Blob>> {
        const db = await this.ensureDb();
        const result = new Map<string, Blob>();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readonly');
            const store = transaction.objectStore(VIDEO_STORE_NAME);
            const index = store.index('projectId');
            const request = index.openCursor(IDBKeyRange.only(projectId));

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    const item = cursor.value as VideoStorageItem;
                    result.set(item.nodeId, item.blob);
                    cursor.continue();
                } else {
                    console.log(`[VideoBlobStorage] Retrieved ${result.size} videos for project ${projectId}`);
                    resolve(result);
                }
            };

            request.onerror = () => {
                console.error('[VideoBlobStorage] Failed to get project videos:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 删除视频 Blob
     */
    async deleteVideoBlob(nodeId: string): Promise<void> {
        const db = await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(VIDEO_STORE_NAME);
            const request = store.delete(nodeId);

            request.onsuccess = () => {
                console.log(`[VideoBlobStorage] Deleted video for node ${nodeId}`);
                resolve();
            };

            request.onerror = () => {
                console.error('[VideoBlobStorage] Failed to delete video:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 删除项目的所有视频
     */
    async deleteProjectVideos(projectId: string): Promise<void> {
        const db = await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(VIDEO_STORE_NAME);
            const index = store.index('projectId');
            const request = index.openCursor(IDBKeyRange.only(projectId));

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    console.log(`[VideoBlobStorage] Deleted all videos for project ${projectId}`);
                    resolve();
                }
            };

            request.onerror = () => {
                console.error('[VideoBlobStorage] Failed to delete project videos:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 获取存储统计信息
     */
    async getStorageStats(): Promise<{ count: number; totalSize: number }> {
        const db = await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readonly');
            const store = transaction.objectStore(VIDEO_STORE_NAME);
            const request = store.openCursor();

            let count = 0;
            let totalSize = 0;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    const item = cursor.value as VideoStorageItem;
                    count++;
                    totalSize += item.size;
                    cursor.continue();
                } else {
                    resolve({ count, totalSize });
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 清理过期视频 (默认30天)
     */
    async cleanupOldVideos(maxAgeDays: number = 30): Promise<number> {
        const db = await this.ensureDb();
        const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([VIDEO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(VIDEO_STORE_NAME);
            const index = store.index('createdAt');
            const range = IDBKeyRange.upperBound(cutoffTime);
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`[VideoBlobStorage] Cleaned up ${deletedCount} old videos`);
                    resolve(deletedCount);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }
}

// 导出单例
export const videoBlobStorage = new VideoBlobStorage();
export default videoBlobStorage;
