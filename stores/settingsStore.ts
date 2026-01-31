/**
 * Settings Store - 应用设置状态管理
 * 
 * 管理 API 密钥、模型角色配置等应用设置
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings, ApiKeyConfig } from '../types';

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: AppSettings = {
    apiKeys: [],
    roles: {
        scriptAnalysis: 'gemini-1.5-flash',
        imageGeneration: 'imagen-3.0-generate-001',
        videoGeneration: 'veo-3.1-generate-preview',
        audioGeneration: 'future-audio-model',
        chatAssistant: 'gemini-2.0-flash-exp'
    },
    customModels: [],
    autoSwitchKey: true,
    indexTtsUrl: 'http://127.0.0.1:7860'
};

/**
 * Settings Store 状态接口
 */
interface SettingsState {
    // 数据
    settings: AppSettings;

    // 计算属性
    activeApiKey: ApiKeyConfig | null;
    getApiKeyForProvider: (provider: string) => ApiKeyConfig | null;

    // 设置动作
    updateSettings: (updates: Partial<AppSettings>) => void;
    resetSettings: () => void;

    // API Key 管理
    addApiKey: (keyConfig: Omit<ApiKeyConfig, 'id' | 'usageCount'>) => string;
    updateApiKey: (id: string, updates: Partial<ApiKeyConfig>) => void;
    deleteApiKey: (id: string) => void;
    setActiveApiKey: (id: string) => void;
    incrementKeyUsage: (id: string) => void;

    // 角色配置
    setRoleModel: (role: keyof AppSettings['roles'], modelId: string) => void;

    // 自定义模型
    addCustomModel: (modelId: string) => void;
    removeCustomModel: (modelId: string) => void;
}

/**
 * 生成唯一 ID
 */
const generateId = () => `key_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Settings Store
 */
export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            // 初始状态
            settings: DEFAULT_SETTINGS,

            // 计算属性
            get activeApiKey() {
                return get().settings.apiKeys.find(k => k.isActive) || null;
            },

            getApiKeyForProvider: (provider) => {
                const keys = get().settings.apiKeys;
                // 优先返回活跃的
                return keys.find(k => k.isActive && k.provider === provider)
                    || keys.find(k => k.provider === provider)
                    || null;
            },

            // 设置动作
            updateSettings: (updates) => {
                set(state => ({
                    settings: { ...state.settings, ...updates }
                }));
            },

            resetSettings: () => {
                set({ settings: DEFAULT_SETTINGS });
            },

            // API Key 管理
            addApiKey: (keyConfig) => {
                const id = generateId();
                const newKey: ApiKeyConfig = {
                    ...keyConfig,
                    id,
                    usageCount: 0,
                    isActive: keyConfig.isActive ?? get().settings.apiKeys.length === 0
                };

                set(state => ({
                    settings: {
                        ...state.settings,
                        apiKeys: [...state.settings.apiKeys, newKey]
                    }
                }));

                return id;
            },

            updateApiKey: (id, updates) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        apiKeys: state.settings.apiKeys.map(k =>
                            k.id === id ? { ...k, ...updates } : k
                        )
                    }
                }));
            },

            deleteApiKey: (id) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        apiKeys: state.settings.apiKeys.filter(k => k.id !== id)
                    }
                }));
            },

            setActiveApiKey: (id) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        apiKeys: state.settings.apiKeys.map(k => ({
                            ...k,
                            isActive: k.id === id
                        }))
                    }
                }));
            },

            incrementKeyUsage: (id) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        apiKeys: state.settings.apiKeys.map(k =>
                            k.id === id
                                ? { ...k, usageCount: k.usageCount + 1, lastUsed: Date.now() }
                                : k
                        )
                    }
                }));
            },

            // 角色配置
            setRoleModel: (role, modelId) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        roles: {
                            ...state.settings.roles,
                            [role]: modelId
                        }
                    }
                }));
            },

            // 自定义模型
            addCustomModel: (modelId) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        customModels: [...new Set([...state.settings.customModels, modelId])]
                    }
                }));
            },

            removeCustomModel: (modelId) => {
                set(state => ({
                    settings: {
                        ...state.settings,
                        customModels: state.settings.customModels.filter(m => m !== modelId)
                    }
                }));
            }
        }),
        {
            name: 'director-deck-settings',
            storage: createJSONStorage(() => localStorage)
        }
    )
);

export default useSettingsStore;
