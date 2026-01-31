/**
 * Location Store - 场景状态管理
 * 
 * 管理场景/地点列表和场景相关操作
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Location } from '../types';

/**
 * 场景 Store 状态接口
 */
interface LocationState {
    // 数据
    locations: Location[];
    selectedLocationId: string | null;

    // 计算属性
    selectedLocation: Location | null;

    // 动作
    addLocation: (location: Omit<Location, 'id'>) => string;
    updateLocation: (id: string, updates: Partial<Location>) => void;
    deleteLocation: (id: string) => void;
    selectLocation: (id: string | null) => void;

    // 项目筛选
    getLocationsByProject: (projectId: string) => Location[];

    // 批量操作
    setLocations: (locations: Location[]) => void;
    clearProjectLocations: (projectId: string) => void;
}

/**
 * 生成唯一 ID
 */
const generateId = () => `loc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * 场景 Store
 */
export const useLocationStore = create<LocationState>()(
    (set, get) => ({
        // 初始状态
        locations: [],
        selectedLocationId: null,

        // 计算属性
        get selectedLocation() {
            const state = get();
            return state.locations.find(l => l.id === state.selectedLocationId) || null;
        },

        // 动作
        addLocation: (locationData) => {
            const id = generateId();
            const newLocation: Location = {
                ...locationData,
                id
            };

            set(state => ({
                locations: [...state.locations, newLocation]
            }));

            return id;
        },

        updateLocation: (id, updates) => {
            set(state => ({
                locations: state.locations.map(l =>
                    l.id === id ? { ...l, ...updates } : l
                )
            }));
        },

        deleteLocation: (id) => {
            set(state => ({
                locations: state.locations.filter(l => l.id !== id),
                selectedLocationId: state.selectedLocationId === id ? null : state.selectedLocationId
            }));
        },

        selectLocation: (id) => {
            set({ selectedLocationId: id });
        },

        // 项目筛选
        getLocationsByProject: (projectId) => {
            return get().locations.filter(l => l.projectId === projectId);
        },

        // 批量操作
        setLocations: (locations) => {
            set({ locations });
        },

        clearProjectLocations: (projectId) => {
            set(state => ({
                locations: state.locations.filter(l => l.projectId !== projectId)
            }));
        }
    })
);

export default useLocationStore;
