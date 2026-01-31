/**
 * ScriptSidebar - 剧本同步侧边栏
 * 
 * 显示来自分镜库的对白列表，支持搜索和选择
 * 使用虚拟滚动优化大列表渲染性能
 */

import React from 'react';
import { History, Search, BookOpen } from 'lucide-react';
import { ScriptItem } from './types';
import { VirtualList } from '../VirtualList';

interface ScriptSidebarProps {
    /** 搜索关键词 */
    searchQuery: string;
    /** 搜索变更回调 */
    onSearchChange: (query: string) => void;
    /** 筛选后的脚本列表 */
    filteredScripts: ScriptItem[];
    /** 选中脚本行回调 */
    onSelectLine: (item: ScriptItem) => void;
}

/** 每个脚本条目的高度（像素） */
const SCRIPT_ITEM_HEIGHT = 100;

const ScriptSidebar: React.FC<ScriptSidebarProps> = React.memo(({
    searchQuery,
    onSearchChange,
    filteredScripts,
    onSelectLine
}) => {
    // 渲染单个脚本条目
    const renderScriptItem = React.useCallback((item: ScriptItem, index: number) => (
        <div
            onClick={() => onSelectLine(item)}
            className="group mx-4 mb-3 p-4 bg-zinc-900/40 border border-zinc-800/30 rounded-2xl hover:bg-zinc-800/40 hover:border-zinc-700/50 transition-all cursor-pointer relative overflow-hidden"
            style={{ height: SCRIPT_ITEM_HEIGHT - 12 }} // 减去 margin
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black bg-zinc-800/80 text-zinc-500 px-2 py-0.5 rounded tracking-wider">
                    {item.shotNumber || `S${index + 1}`}
                </span>
                <span className="text-[10px] font-bold text-cine-accent group-hover:underline">
                    {item.characters}
                </span>
            </div>
            <p className="text-[11px] line-clamp-3 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity italic">
                {item.dialogue}
            </p>
        </div>
    ), [onSelectLine]);

    return (
        <div className="w-[320px] border-r border-zinc-800/40 bg-[#080808] flex flex-col">
            <div className="p-6 border-b border-zinc-800/20 space-y-4">
                <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] flex items-center gap-2.5">
                    <History size={14} className="text-cine-accent" />
                    剧本同步流
                </h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={13} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="搜索台词或角色..."
                        className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-xl pl-9 pr-3 py-2.5 text-[11px] outline-none focus:border-zinc-700 transition-colors"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <VirtualList
                    items={filteredScripts}
                    itemHeight={SCRIPT_ITEM_HEIGHT}
                    containerClassName="h-full custom-scrollbar"
                    overscan={3}
                    getItemKey={(item: ScriptItem, index) => item.shotNumber || `script-${index}`}
                    renderItem={renderScriptItem}
                    emptyState={
                        <div className="flex flex-col items-center justify-center h-full py-20 opacity-20">
                            <BookOpen size={40} strokeWidth={1} />
                            <span className="text-[10px] uppercase font-bold tracking-widest mt-3">暂无可用剧本</span>
                        </div>
                    }
                />
            </div>
        </div>
    );
});

ScriptSidebar.displayName = 'ScriptSidebar';

export default ScriptSidebar;

