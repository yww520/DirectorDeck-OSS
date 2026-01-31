/**
 * UI Store - 界面状态管理
 * 
 * 管理 UI 相关的临时状态，如活动 Tab、面板状态等
 */

import { create } from 'zustand';
import { TabType, InspectorTab } from '../types';

/**
 * 通知类型
 */
interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
    timestamp: number;
}

/**
 * UI Store 状态接口
 */
interface UIState {
    // 导航状态
    activeTab: TabType;
    inspectorTab: InspectorTab;

    // 面板状态
    isSettingsOpen: boolean;
    isProjectManagerOpen: boolean;
    isSidebarCollapsed: boolean;
    isInspectorCollapsed: boolean;

    // 加载状态
    isGenerating: boolean;
    generationProgress: number;
    generationStep: string;

    // 通知
    notifications: Notification[];

    // 模态框状态
    activeModal: string | null;
    modalData: any;

    // 导航动作
    setActiveTab: (tab: TabType) => void;
    setInspectorTab: (tab: InspectorTab) => void;

    // 面板动作
    toggleSettings: () => void;
    openSettings: () => void;
    closeSettings: () => void;
    toggleProjectManager: () => void;
    toggleSidebar: () => void;
    toggleInspector: () => void;

    // 加载动作
    startGeneration: (step?: string) => void;
    updateGenerationProgress: (progress: number, step?: string) => void;
    endGeneration: () => void;

    // 通知动作
    showNotification: (type: Notification['type'], message: string, duration?: number) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    dismissNotification: (id: string) => void;
    clearNotifications: () => void;

    // 模态框动作
    openModal: (modalId: string, data?: any) => void;
    closeModal: () => void;
}

/**
 * 生成通知 ID
 */
const generateNotificationId = () => `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * UI Store
 */
export const useUIStore = create<UIState>()((set, get) => ({
    // 初始状态
    activeTab: 'canvas',
    inspectorTab: 'details',
    isSettingsOpen: false,
    isProjectManagerOpen: false,
    isSidebarCollapsed: false,
    isInspectorCollapsed: false,
    isGenerating: false,
    generationProgress: 0,
    generationStep: '',
    notifications: [],
    activeModal: null,
    modalData: null,

    // 导航动作
    setActiveTab: (tab) => set({ activeTab: tab }),
    setInspectorTab: (tab) => set({ inspectorTab: tab }),

    // 面板动作
    toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),
    openSettings: () => set({ isSettingsOpen: true }),
    closeSettings: () => set({ isSettingsOpen: false }),
    toggleProjectManager: () => set(state => ({ isProjectManagerOpen: !state.isProjectManagerOpen })),
    toggleSidebar: () => set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    toggleInspector: () => set(state => ({ isInspectorCollapsed: !state.isInspectorCollapsed })),

    // 加载动作
    startGeneration: (step = '准备中...') => set({
        isGenerating: true,
        generationProgress: 0,
        generationStep: step
    }),

    updateGenerationProgress: (progress, step) => set(state => ({
        generationProgress: Math.min(100, Math.max(0, progress)),
        generationStep: step ?? state.generationStep
    })),

    endGeneration: () => set({
        isGenerating: false,
        generationProgress: 100,
        generationStep: ''
    }),

    // 通知动作
    showNotification: (type, message, duration = 5000) => {
        const id = generateNotificationId();
        const notification: Notification = {
            id,
            type,
            message,
            duration,
            timestamp: Date.now()
        };

        set(state => ({
            notifications: [...state.notifications, notification]
        }));

        // 自动消失
        if (duration > 0) {
            setTimeout(() => {
                get().dismissNotification(id);
            }, duration);
        }
    },

    showSuccess: (message) => get().showNotification('success', message),
    showError: (message) => get().showNotification('error', message, 8000),

    dismissNotification: (id) => set(state => ({
        notifications: state.notifications.filter(n => n.id !== id)
    })),

    clearNotifications: () => set({ notifications: [] }),

    // 模态框动作
    openModal: (modalId, data) => set({ activeModal: modalId, modalData: data }),
    closeModal: () => set({ activeModal: null, modalData: null })
}));

export default useUIStore;
