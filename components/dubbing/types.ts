/**
 * DubbingPanel 子组件类型定义
 * 这些类型在拆分的子组件间共享
 */

import { Character, Asset, StoryboardProject } from '../../types';

/**
 * 预设音色类型
 */
export interface VoicePreset {
    id: string;
    name: string;
    file: string;
    description: string;
    language: 'zh' | 'en';
    gender: 'male' | 'female';
    emoMode: number;
    emotion?: string;
    emoAudio?: string;
    emoWeight?: number;
    emoVectors?: Record<string, number>;
    emoText?: string;
}

/**
 * 情感向量类型
 */
export interface EmotionVectors {
    happy: number;
    angry: number;
    sad: number;
    fear: number;
    disgust: number;
    depressed: number;
    surprise: number;
    calm: number;
}

/**
 * 剧本条目（带项目信息）
 */
export interface ScriptItem {
    shotNumber?: string;
    characters: string;
    dialogue: string;
    projectTitle?: string;
    projectId?: string;
}

/**
 * 获取角色头像 URL
 */
export function getAvatarUrl(char: Character): string | null {
    if (!char.forms || char.forms.length === 0) return null;
    for (const f of char.forms) {
        if (f.frontViewUrl) return f.frontViewUrl;
        if (f.multiViewUrl) return f.multiViewUrl;
    }
    return null;
}
