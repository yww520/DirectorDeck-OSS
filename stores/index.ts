/**
 * Zustand Stores 索引
 * 
 * 导出所有状态管理 stores
 * 
 * 使用示例:
 * ```tsx
 * import { useProjectStore, useCanvasStore, useUIStore } from './stores';
 * 
 * function MyComponent() {
 *   // 获取状态
 *   const projects = useProjectStore(state => state.projects);
 *   const currentProject = useProjectStore(state => state.currentProject);
 *   
 *   // 获取动作
 *   const addProject = useProjectStore(state => state.addProject);
 *   const showSuccess = useUIStore(state => state.showSuccess);
 *   
 *   // 使用
 *   const handleCreate = () => {
 *     const id = addProject({ name: '新项目', description: '', status: 'active' });
 *     showSuccess('项目创建成功');
 *   };
 * }
 * ```
 */

// Project Store - 项目管理
export { useProjectStore, default as projectStore } from './projectStore';

// Character Store - 角色管理
export { useCharacterStore, default as characterStore } from './characterStore';

// Canvas Store - 画布和节点管理
export { useCanvasStore, default as canvasStore } from './canvasStore';

// UI Store - 界面状态
export { useUIStore, default as uiStore } from './uiStore';

// Settings Store - 应用设置
export { useSettingsStore, default as settingsStore } from './settingsStore';

// Location Store - 场景管理
export { useLocationStore, default as locationStore } from './locationStore';

/**
 * 开发时清除所有 store 数据
 * 用于调试
 */
export function clearAllStores() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('director-deck-projects');
        localStorage.removeItem('director-deck-characters');
        localStorage.removeItem('director-deck-canvas');
        localStorage.removeItem('director-deck-locations');
        localStorage.removeItem('director-deck-settings');
        localStorage.removeItem('dubbingPanelState');
        localStorage.removeItem('api_cache_'); // Partial match usually doesn't work with removeItem, but good to have
        console.log('[Stores] All known Zustand stores cleared from localStorage');
    }
}

/**
 * 导出所有 store 数据用于备份
 */
export function exportAllStoreData(): Record<string, any> {
    if (typeof window === 'undefined') return {};

    return {
        projects: localStorage.getItem('director-deck-projects'),
        characters: localStorage.getItem('director-deck-characters'),
        canvas: localStorage.getItem('director-deck-canvas'),
        locations: localStorage.getItem('director-deck-locations'),
        settings: localStorage.getItem('director-deck-settings')
    };
}

/**
 * 从备份恢复所有 store 数据
 */
export function importAllStoreData(data: Record<string, string | null>) {
    if (typeof window === 'undefined') return;

    if (data.projects) localStorage.setItem('director-deck-projects', data.projects);
    if (data.characters) localStorage.setItem('director-deck-characters', data.characters);
    if (data.canvas) localStorage.setItem('director-deck-canvas', data.canvas);
    if (data.locations) localStorage.setItem('director-deck-locations', data.locations);
    if (data.settings) localStorage.setItem('director-deck-settings', data.settings);

    console.log('[Stores] All Zustand stores imported');
}
