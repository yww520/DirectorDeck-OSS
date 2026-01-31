/**
 * Project Store - 项目状态管理
 * 
 * 管理项目列表、当前项目和项目相关操作
 * 使用 Zustand 进行状态管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Project, ProjectStatus } from '../types';

/**
 * 项目 Store 状态接口
 */
interface ProjectState {
    // 数据
    projects: Project[];
    currentProjectId: string | null;

    // 计算属性
    currentProject: Project | null;
    activeProjects: Project[];
    archivedProjects: Project[];

    // 动作
    addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => string;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    archiveProject: (id: string) => void;
    restoreProject: (id: string) => void;
    setCurrentProject: (id: string | null) => void;
    duplicateProject: (id: string) => string | null;
}

/**
 * 生成唯一 ID
 */
const generateId = () => `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * 项目 Store
 */
export const useProjectStore = create<ProjectState>()(
    (set, get) => ({
        // 初始状态
        projects: [],
        currentProjectId: null,

        // 计算属性 (使用 getter 模式)
        get currentProject() {
            const state = get();
            return state.projects.find(p => p.id === state.currentProjectId) || null;
        },

        get activeProjects() {
            return get().projects.filter(p => p.status === 'active');
        },

        get archivedProjects() {
            return get().projects.filter(p => p.status === 'archived');
        },

        // 动作
        addProject: (projectData) => {
            const id = generateId();
            const now = Date.now();
            const newProject: Project = {
                ...projectData,
                id,
                createdAt: now,
                updatedAt: now,
                status: projectData.status || 'active'
            };

            set(state => ({
                projects: [...state.projects, newProject],
                currentProjectId: id
            }));

            return id;
        },

        updateProject: (id, updates) => {
            set(state => ({
                projects: state.projects.map(p =>
                    p.id === id
                        ? { ...p, ...updates, updatedAt: Date.now() }
                        : p
                )
            }));
        },

        deleteProject: (id) => {
            set(state => ({
                projects: state.projects.filter(p => p.id !== id),
                currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
            }));
        },

        archiveProject: (id) => {
            get().updateProject(id, { status: 'archived' });
        },

        restoreProject: (id) => {
            get().updateProject(id, { status: 'active' });
        },

        setCurrentProject: (id) => {
            set({ currentProjectId: id });
        },

        duplicateProject: (id) => {
            const project = get().projects.find(p => p.id === id);
            if (!project) return null;

            return get().addProject({
                name: `${project.name} (副本)`,
                description: project.description,
                coverUrl: project.coverUrl,
                status: 'active'
            });
        }
    })
);

export default useProjectStore;
