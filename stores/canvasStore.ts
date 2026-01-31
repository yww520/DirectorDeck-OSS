/**
 * Canvas Store - 画布状态管理
 * 
 * 管理画布节点（GeneratedImage）和画布会话
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GeneratedImage, NodeType, CanvasSession, VideoMotionConfig } from '../types';

/**
 * 节点位置增量 - 横排布局
 * x: 子节点之间的水平间距
 * y: 父子节点之间的垂直间距
 */
const NODE_OFFSET = { x: 200, y: 180 };

/**
 * 画布 Store 状态接口
 */
interface CanvasState {
    // 数据
    nodes: GeneratedImage[];
    sessions: CanvasSession[];
    currentSessionId: string | null;
    selectedNodeId: string | null;

    // 视图状态
    zoom: number;
    panOffset: { x: number; y: number };

    // 计算属性
    selectedNode: GeneratedImage | null;
    currentSession: CanvasSession | null;
    currentSessionNodes: GeneratedImage[];

    // 节点操作
    addNode: (node: Omit<GeneratedImage, 'id' | 'timestamp'>) => string;
    updateNode: (id: string, updates: Partial<GeneratedImage>) => void;
    deleteNode: (id: string) => void;
    selectNode: (id: string | null) => void;
    moveNode: (id: string, position: { x: number; y: number }) => void;

    // 节点关系
    createChildNode: (parentId: string, nodeData: Partial<GeneratedImage>) => string | null;
    getNodeChildren: (parentId: string) => GeneratedImage[];
    getNodeAncestors: (nodeId: string) => GeneratedImage[];

    // 会话操作
    createSession: (projectId: string, name?: string) => string;
    deleteSession: (id: string) => void;
    renameSession: (id: string, name: string) => void;
    setCurrentSession: (id: string | null) => void;

    // 项目筛选
    getNodesByProject: (projectId: string) => GeneratedImage[];
    getSessionsByProject: (projectId: string) => CanvasSession[];

    // 视图操作
    setZoom: (zoom: number) => void;
    setPanOffset: (offset: { x: number; y: number }) => void;
    resetView: () => void;

    // 批量操作
    setNodes: (nodes: GeneratedImage[]) => void;
    clearProjectNodes: (projectId: string) => void;

    // 同步标记
    markNodeAsSynced: (id: string) => void;
    getUnsyncedNodes: () => GeneratedImage[];
}

/**
 * 生成唯一 ID
 */
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * 画布 Store
 */
export const useCanvasStore = create<CanvasState>()(
    (set, get) => ({
        // 初始状态
        nodes: [],
        sessions: [],
        currentSessionId: null,
        selectedNodeId: null,
        zoom: 1,
        panOffset: { x: 0, y: 0 },

        // 计算属性
        get selectedNode() {
            const state = get();
            return state.nodes.find(n => n.id === state.selectedNodeId) || null;
        },

        get currentSession() {
            const state = get();
            return state.sessions.find(s => s.id === state.currentSessionId) || null;
        },

        get currentSessionNodes() {
            const state = get();
            return state.nodes.filter(n => n.sessionId === state.currentSessionId);
        },

        // 节点操作
        addNode: (nodeData) => {
            const id = generateId('node');
            const newNode: GeneratedImage = {
                ...nodeData,
                id,
                timestamp: Date.now(),
                sessionId: nodeData.sessionId || get().currentSessionId || undefined,
                position: nodeData.position || { x: 100, y: 100 }
            };

            set(state => ({
                nodes: [...state.nodes, newNode],
                selectedNodeId: id
            }));

            return id;
        },

        updateNode: (id, updates) => {
            set(state => ({
                nodes: state.nodes.map(n =>
                    n.id === id ? { ...n, ...updates } : n
                )
            }));
        },

        deleteNode: (id) => {
            // 同时删除子节点
            const children = get().getNodeChildren(id);
            const idsToDelete = [id, ...children.map(c => c.id)];

            set(state => ({
                nodes: state.nodes.filter(n => !idsToDelete.includes(n.id)),
                selectedNodeId: idsToDelete.includes(state.selectedNodeId || '')
                    ? null
                    : state.selectedNodeId
            }));
        },

        selectNode: (id) => {
            set({ selectedNodeId: id });
        },

        moveNode: (id, position) => {
            get().updateNode(id, { position });
        },

        // 节点关系
        createChildNode: (parentId, nodeData) => {
            const parent = get().nodes.find(n => n.id === parentId);
            if (!parent) return null;

            // 计算子节点位置 - 横排布局
            const existingChildren = get().getNodeChildren(parentId);
            const childIndex = existingChildren.length;

            const parentX = parent.position?.x ?? 100;
            const parentY = parent.position?.y ?? 100;

            // 横排布局：子节点在父节点下方，横向排列
            // 第一个子节点对齐父节点左侧，后续子节点向右排列
            const position = {
                x: parentX + (childIndex * NODE_OFFSET.x),
                y: parentY + NODE_OFFSET.y
            };

            return get().addNode({
                ...nodeData,
                parentId,
                projectId: parent.projectId,
                sessionId: parent.sessionId,
                position,
                url: nodeData.url || '',
                prompt: nodeData.prompt || parent.prompt || '',
                aspectRatio: nodeData.aspectRatio || parent.aspectRatio || '16:9',
                nodeType: nodeData.nodeType || 'render'
            });
        },

        getNodeChildren: (parentId) => {
            return get().nodes.filter(n => n.parentId === parentId);
        },

        getNodeAncestors: (nodeId) => {
            const ancestors: GeneratedImage[] = [];
            let current = get().nodes.find(n => n.id === nodeId);

            while (current?.parentId) {
                const parent = get().nodes.find(n => n.id === current!.parentId);
                if (parent) {
                    ancestors.push(parent);
                    current = parent;
                } else {
                    break;
                }
            }

            return ancestors;
        },

        // 会话操作
        createSession: (projectId, name) => {
            const id = generateId('session');
            const newSession: CanvasSession = {
                id,
                projectId,
                name: name || `画布 ${get().sessions.filter(s => s.projectId === projectId).length + 1}`,
                createdAt: Date.now()
            };

            set(state => ({
                sessions: [...state.sessions, newSession],
                currentSessionId: id
            }));

            return id;
        },

        deleteSession: (id) => {
            set(state => ({
                sessions: state.sessions.filter(s => s.id !== id),
                nodes: state.nodes.filter(n => n.sessionId !== id),
                currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
            }));
        },

        renameSession: (id, name) => {
            set(state => ({
                sessions: state.sessions.map(s =>
                    s.id === id ? { ...s, name } : s
                )
            }));
        },

        setCurrentSession: (id) => {
            set({ currentSessionId: id, selectedNodeId: null });
        },

        // 项目筛选
        getNodesByProject: (projectId) => {
            return get().nodes.filter(n => n.projectId === projectId);
        },

        getSessionsByProject: (projectId) => {
            return get().sessions.filter(s => s.projectId === projectId);
        },

        // 视图操作
        setZoom: (zoom) => {
            set({ zoom: Math.max(0.1, Math.min(3, zoom)) });
        },

        setPanOffset: (offset) => {
            set({ panOffset: offset });
        },

        resetView: () => {
            set({ zoom: 1, panOffset: { x: 0, y: 0 } });
        },

        // 批量操作
        setNodes: (nodes) => {
            set({ nodes });
        },

        clearProjectNodes: (projectId) => {
            set(state => ({
                nodes: state.nodes.filter(n => n.projectId !== projectId),
                sessions: state.sessions.filter(s => s.projectId !== projectId)
            }));
        },

        // 同步标记
        markNodeAsSynced: (id) => {
            get().updateNode(id, { isSyncedToEditor: true });
        },

        getUnsyncedNodes: () => {
            return get().nodes.filter(n =>
                (n.nodeType === 'render' || n.nodeType === 'video') &&
                !n.isSyncedToEditor
            );
        }
    })
);

export default useCanvasStore;
