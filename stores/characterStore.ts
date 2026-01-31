/**
 * Character Store - 角色状态管理
 * 
 * 管理角色列表和角色相关操作
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Character, CharacterForm, ArtStyle, AspectRatio, ImageSize } from '../types';

/**
 * 角色 Store 状态接口
 */
interface CharacterState {
    // 数据
    characters: Character[];
    selectedCharacterId: string | null;

    // 计算属性
    selectedCharacter: Character | null;

    // 动作
    addCharacter: (character: Omit<Character, 'id'>) => string;
    updateCharacter: (id: string, updates: Partial<Character>) => void;
    deleteCharacter: (id: string) => void;
    selectCharacter: (id: string | null) => void;

    // 形态管理
    addCharacterForm: (characterId: string, form: Omit<CharacterForm, 'id'>) => string | null;
    updateCharacterForm: (characterId: string, formId: string, updates: Partial<CharacterForm>) => void;
    deleteCharacterForm: (characterId: string, formId: string) => void;

    // 项目筛选
    getCharactersByProject: (projectId: string) => Character[];

    // 批量操作
    setCharacters: (characters: Character[]) => void;
    clearProjectCharacters: (projectId: string) => void;
}

/**
 * 生成唯一 ID
 */
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * 角色 Store
 */
export const useCharacterStore = create<CharacterState>()(
    (set, get) => ({
        // 初始状态
        characters: [],
        selectedCharacterId: null,

        // 计算属性
        get selectedCharacter() {
            const state = get();
            return state.characters.find(c => c.id === state.selectedCharacterId) || null;
        },

        // 动作
        addCharacter: (characterData) => {
            const id = generateId('char');
            const newCharacter: Character = {
                ...characterData,
                id,
                forms: characterData.forms || []
            };

            set(state => ({
                characters: [...state.characters, newCharacter]
            }));

            return id;
        },

        updateCharacter: (id, updates) => {
            set(state => ({
                characters: state.characters.map(c =>
                    c.id === id ? { ...c, ...updates } : c
                )
            }));
        },

        deleteCharacter: (id) => {
            set(state => ({
                characters: state.characters.filter(c => c.id !== id),
                selectedCharacterId: state.selectedCharacterId === id ? null : state.selectedCharacterId
            }));
        },

        selectCharacter: (id) => {
            set({ selectedCharacterId: id });
        },

        // 形态管理
        addCharacterForm: (characterId, formData) => {
            const character = get().characters.find(c => c.id === characterId);
            if (!character) return null;

            const formId = generateId('form');
            const newForm: CharacterForm = {
                ...formData,
                id: formId
            };

            get().updateCharacter(characterId, {
                forms: [...character.forms, newForm]
            });

            return formId;
        },

        updateCharacterForm: (characterId, formId, updates) => {
            const character = get().characters.find(c => c.id === characterId);
            if (!character) return;

            get().updateCharacter(characterId, {
                forms: character.forms.map(f =>
                    f.id === formId ? { ...f, ...updates } : f
                )
            });
        },

        deleteCharacterForm: (characterId, formId) => {
            const character = get().characters.find(c => c.id === characterId);
            if (!character) return;

            get().updateCharacter(characterId, {
                forms: character.forms.filter(f => f.id !== formId)
            });
        },

        // 项目筛选
        getCharactersByProject: (projectId) => {
            return get().characters.filter(c => c.projectId === projectId);
        },

        // 批量操作
        setCharacters: (characters) => {
            set({ characters });
        },

        clearProjectCharacters: (projectId) => {
            set(state => ({
                characters: state.characters.filter(c => c.projectId !== projectId)
            }));
        }
    })
);

export default useCharacterStore;
