
import React from 'react';
import { Users, Layout, Video, Map, Scissors, Settings, Mic } from 'lucide-react';
import { TabType } from '../types';
import { useUIStore } from '../stores';

interface NavBarProps {
    /** 当前激活的 Tab（可选，如果不传则使用 Zustand） */
    activeTab?: TabType;
    /** Tab 切换回调（可选，如果不传则使用 Zustand） */
    onTabChange?: (tab: TabType) => void;
    /** 打开设置面板 */
    onToggleSettings: () => void;
    /** 是否使用 Zustand 状态（默认 false 保持向后兼容） */
    useStore?: boolean;
}

/**
 * NavBar - 主导航栏
 * 
 * 支持两种模式：
 * 1. Props 模式（默认）：从 props 获取 activeTab 和 onTabChange
 * 2. Store 模式：从 Zustand useUIStore 获取状态
 */
const NavBar: React.FC<NavBarProps> = ({
    activeTab: propActiveTab,
    onTabChange: propOnTabChange,
    onToggleSettings,
    useStore = false
}) => {
    // 从 Zustand 获取状态
    const storeActiveTab = useUIStore(state => state.activeTab);
    const storeSetActiveTab = useUIStore(state => state.setActiveTab);

    // 根据模式选择使用哪个状态
    const activeTab = useStore ? storeActiveTab : (propActiveTab ?? storeActiveTab);
    const setActiveTab = useStore ? storeSetActiveTab : (propOnTabChange ?? storeSetActiveTab);

    const tabs = [
        { id: 'characters' as TabType, label: '角色形象库', icon: <Users size={16} /> },
        { id: 'locations' as TabType, label: '场景资产库', icon: <Map size={16} /> },
        { id: 'storyboard' as TabType, label: '剧本分镜库', icon: <Layout size={16} /> },
        { id: 'canvas' as TabType, label: '创作工作台', icon: <Video size={16} /> },
        { id: 'dubbing' as TabType, label: '智能配音区', icon: <Mic size={16} /> },
        { id: 'editor' as TabType, label: '全局剪辑区', icon: <Scissors size={16} /> },
    ];

    return (
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800/50">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-colors duration-300 relative group whitespace-nowrap
                            ${isActive
                                ? 'bg-cine-accent text-black shadow-[0_0_10px_rgba(201,255,86,0.1)]'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }
                        `}
                    >
                        <span>
                            {tab.icon}
                        </span>
                        <span className="tracking-wide whitespace-nowrap">{tab.label}</span>

                        {isActive && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-cine-accent rounded-full" />
                        )}
                    </button>
                );
            })}

            <div className="w-px h-6 bg-zinc-800/50 mx-2" />

            <button
                onClick={onToggleSettings}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors duration-300 text-zinc-500 hover:text-cine-accent hover:bg-cine-accent/5 group whitespace-nowrap"
            >
                <Settings size={16} className="shrink-0" />
                <span className="whitespace-nowrap">设置</span>
            </button>
        </div>
    );
};

export default NavBar;

