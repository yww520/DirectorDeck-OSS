import { GeneratedImage, StoryboardProject, TimelineData, CanvasSession } from '../types';
import { storageService } from './storageService';

export interface SessionSnapshot {
    /** 快照 ID */
    id: string;
    /** 快照时间 */
    timestamp: number;
    /** 项目 ID */
    projectId: string;
    /** 活动标签页 */
    activeTab: string;
    /** 画布节点 */
    images: GeneratedImage[];
    /** 画布会话 */
    canvasSessions: CanvasSession[];
    /** 活动会话 ID */
    activeSessionId: string;
    /** 选中的节点 */
    selectedImageIds: string[];
    /** 分镜项目 */
    storyboardProjects: StoryboardProject[];
    /** 时间轴数据 */
    timelineData?: TimelineData;
    /** 未保存的更改 */
    hasUnsavedChanges: boolean;
    /** 快照版本 */
    version: string;
}

interface RecoveryCallbacks {
    onAutoSave?: () => void;
    onRecoveryAvailable?: (snapshot: SessionSnapshot) => void;
    onRecoveryComplete?: () => void;
}

class SessionRecoveryService {
    private readonly VERSION = '1.0.0';
    private readonly AUTO_SAVE_INTERVAL = 45000; // 稍长一点，因为 IDB 是异步的
    private readonly MAX_SNAPSHOTS = 5;

    private autoSaveTimer: number | null = null;
    private hasUnsavedChanges = false;
    private callbacks: RecoveryCallbacks = {};

    /**
     * 初始化会话恢复服务
     */
    async init(callbacks?: RecoveryCallbacks): Promise<void> {
        this.callbacks = callbacks || {};

        try {
            // 确保 storageService 已初始化
            await storageService.init();

            // 检查是否有可恢复的会话
            const snapshots = await storageService.getRecoverySnapshots();
            if (snapshots.length > 0) {
                const latest = snapshots.sort((a, b) => b.timestamp - a.timestamp)[0];
                if (latest && this.isRecoverable(latest)) {
                    this.callbacks.onRecoveryAvailable?.(latest);
                }
            }
        } catch (error) {
            console.error('[SessionRecovery] Init failed:', error);
        }

        // 监听页面关闭事件
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        console.log('[SessionRecovery] Initialized with IndexedDB');
    }

    /**
     * 销毁服务
     */
    destroy(): void {
        this.stopAutoSave();
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    /**
     * 启动自动保存
     */
    startAutoSave(getSnapshot: () => Partial<SessionSnapshot>): void {
        this.stopAutoSave();

        this.autoSaveTimer = window.setInterval(async () => {
            if (this.hasUnsavedChanges) {
                const snapshot = getSnapshot();
                await this.saveSnapshot(snapshot);
                this.callbacks.onAutoSave?.();
            }
        }, this.AUTO_SAVE_INTERVAL);

        console.log('[SessionRecovery] Auto-save started');
    }

    /**
     * 停止自动保存
     */
    stopAutoSave(): void {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * 标记有未保存的更改
     */
    markDirty(): void {
        this.hasUnsavedChanges = true;
    }

    /**
     * 清除未保存标记
     */
    markClean(): void {
        this.hasUnsavedChanges = false;
    }

    /**
     * 保存快照
     */
    async saveSnapshot(partialSnapshot: Partial<SessionSnapshot>): Promise<void> {
        const snapshot: SessionSnapshot = {
            id: `snapshot_${Date.now()}`,
            timestamp: Date.now(),
            projectId: partialSnapshot.projectId || '',
            activeTab: partialSnapshot.activeTab || 'canvas',
            images: partialSnapshot.images || [],
            canvasSessions: partialSnapshot.canvasSessions || [],
            activeSessionId: partialSnapshot.activeSessionId || '',
            selectedImageIds: partialSnapshot.selectedImageIds || [],
            storyboardProjects: partialSnapshot.storyboardProjects || [],
            timelineData: partialSnapshot.timelineData,
            hasUnsavedChanges: this.hasUnsavedChanges,
            version: this.VERSION
        };

        try {
            // 获取现有快照列表
            const snapshots = await storageService.getRecoverySnapshots();

            // 按时间排序并保留 N 个
            const sorted = snapshots.sort((a, b) => b.timestamp - a.timestamp);
            const trimmed = sorted.slice(0, this.MAX_SNAPSHOTS - 1);

            // 添加新快照并保存
            await storageService.saveRecoverySnapshots([snapshot, ...trimmed]);

            this.hasUnsavedChanges = false;
            console.log(`[SessionRecovery] Snapshot saved to IndexedDB: ${snapshot.id}`);

        } catch (error) {
            console.error('[SessionRecovery] Failed to save snapshot:', error);
        }
    }

    /**
     * 获取所有快照
     */
    async getAllSnapshots(): Promise<SessionSnapshot[]> {
        return storageService.getRecoverySnapshots();
    }

    /**
     * 获取最新快照
     */
    async getLatestSnapshot(): Promise<SessionSnapshot | null> {
        const snapshots = await this.getAllSnapshots();
        if (snapshots.length === 0) return null;
        return snapshots.sort((a, b) => b.timestamp - a.timestamp)[0];
    }

    /**
     * 获取指定项目的最新快照
     */
    async getSnapshotByProject(projectId: string): Promise<SessionSnapshot | null> {
        const snapshots = await this.getAllSnapshots();
        const filtered = snapshots.filter(s => s.projectId === projectId);
        if (filtered.length === 0) return null;
        return filtered.sort((a, b) => b.timestamp - a.timestamp)[0];
    }

    /**
     * 恢复快照
     */
    async restoreSnapshot(snapshotId: string): Promise<SessionSnapshot | null> {
        const snapshots = await this.getAllSnapshots();
        const snapshot = snapshots.find(s => s.id === snapshotId);

        if (snapshot) {
            console.log(`[SessionRecovery] Restoring snapshot: ${snapshotId}`);
            this.callbacks.onRecoveryComplete?.();
            return snapshot;
        }

        return null;
    }

    /**
     * 删除快照
     */
    async deleteSnapshot(snapshotId: string): Promise<void> {
        const snapshots = await this.getAllSnapshots();
        const filtered = snapshots.filter(s => s.id !== snapshotId);
        await storageService.saveRecoverySnapshots(filtered);
        console.log(`[SessionRecovery] Snapshot deleted: ${snapshotId}`);
    }

    /**
     * 清除所有快照
     */
    async clearAllSnapshots(): Promise<void> {
        await storageService.clearRecoverySnapshots();
        console.log('[SessionRecovery] All snapshots cleared');
    }

    /**
     * 检查快照是否可恢复
     */
    private isRecoverable(snapshot: SessionSnapshot): boolean {
        // 检查版本兼容性
        if (snapshot.version !== this.VERSION) {
            return false;
        }

        // 检查快照年龄 (24小时内)
        const age = Date.now() - snapshot.timestamp;
        if (age > 24 * 60 * 60 * 1000) {
            return false;
        }

        // 检查是否有实际内容
        if (snapshot.images.length === 0 && snapshot.storyboardProjects.length === 0) {
            return false;
        }

        return true;
    }

    /**
     * 处理页面关闭
     */
    private handleBeforeUnload = (e: BeforeUnloadEvent): void => {
        if (this.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
        }
    };

    /**
     * 处理页面可见性变化
     */
    private handleVisibilityChange = (): void => {
        if (document.hidden && this.hasUnsavedChanges) {
            // 页面隐藏时尝试保存
            console.log('[SessionRecovery] Page hidden, triggering save...');
            // 注意：不能在这里调用异步方法，因为页面可能随时关闭
        }
    };

    /**
     * 格式化快照时间
     */
    formatSnapshotTime(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - timestamp;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)} 分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)} 小时前`;
        } else {
            return date.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * 获取快照摘要
     */
    getSnapshotSummary(snapshot: SessionSnapshot): string {
        const parts: string[] = [];

        if (snapshot.images.length > 0) {
            parts.push(`${snapshot.images.length} 张图片`);
        }

        if (snapshot.storyboardProjects.length > 0) {
            const totalItems = snapshot.storyboardProjects.reduce(
                (sum, p) => sum + p.items.length, 0
            );
            parts.push(`${totalItems} 个分镜`);
        }

        return parts.join(', ') || '空会话';
    }
}

// 导出单例
export const sessionRecovery = new SessionRecoveryService();
export default sessionRecovery;
