/**
 * VirtualList - 虚拟滚动列表组件
 * 
 * 用于高效渲染大量列表项，只渲染可视区域内的元素。
 * 
 * 使用示例:
 * ```tsx
 * <VirtualList
 *   items={myItems}
 *   itemHeight={60}
 *   containerHeight={400}
 *   renderItem={(item, index) => (
 *     <div key={item.id}>{item.name}</div>
 *   )}
 * />
 * ```
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

/**
 * 虚拟列表 Props
 */
interface VirtualListProps<T> {
    /** 数据列表 */
    items: T[];
    /** 每项的高度（像素） */
    itemHeight: number;
    /** 容器高度（像素），或者使用 `containerClassName` 让容器自适应 */
    containerHeight?: number;
    /** 渲染每个项目的函数 */
    renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
    /** 容器的额外 className */
    containerClassName?: string;
    /** 缓冲区大小（额外渲染的项目数量，默认 5） */
    overscan?: number;
    /** 空状态渲染 */
    emptyState?: React.ReactNode;
    /** 获取项目唯一 key 的函数 */
    getItemKey?: (item: T, index: number) => string | number;
    /** 滚动事件回调 */
    onScroll?: (scrollTop: number) => void;
    /** 是否启用平滑滚动动画 */
    smoothScroll?: boolean;
}

/**
 * 虚拟列表组件
 */
function VirtualList<T>({
    items,
    itemHeight,
    containerHeight: propContainerHeight,
    renderItem,
    containerClassName = '',
    overscan = 5,
    emptyState,
    getItemKey,
    onScroll,
    smoothScroll = false
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(propContainerHeight || 400);

    // 监听容器大小变化
    useEffect(() => {
        if (propContainerHeight) {
            setContainerHeight(propContainerHeight);
            return;
        }

        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [propContainerHeight]);

    // 计算可见项
    const { visibleItems, totalHeight, startIndex, endIndex } = useMemo(() => {
        const totalHeight = items.length * itemHeight;

        // 计算可见范围
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

        // 提取可见项
        const visibleItems = items.slice(startIndex, endIndex + 1).map((item, i) => ({
            item,
            index: startIndex + i,
            style: {
                position: 'absolute' as const,
                top: (startIndex + i) * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight
            }
        }));

        return { visibleItems, totalHeight, startIndex, endIndex };
    }, [items, itemHeight, containerHeight, scrollTop, overscan]);

    // 滚动处理
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const newScrollTop = e.currentTarget.scrollTop;
        setScrollTop(newScrollTop);
        onScroll?.(newScrollTop);
    }, [onScroll]);

    // 空状态
    if (items.length === 0) {
        return (
            <div
                className={`virtual-list-empty ${containerClassName}`}
                style={{ height: propContainerHeight || 'auto' }}
            >
                {emptyState || (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                        暂无数据
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`virtual-list-container overflow-y-auto ${containerClassName}`}
            style={{
                height: propContainerHeight || '100%',
                scrollBehavior: smoothScroll ? 'smooth' : 'auto'
            }}
            onScroll={handleScroll}
        >
            <div
                className="virtual-list-content relative"
                style={{ height: totalHeight }}
            >
                {visibleItems.map(({ item, index, style }) => (
                    <div
                        key={getItemKey ? getItemKey(item, index) : index}
                        className="virtual-list-item"
                        style={style}
                    >
                        {renderItem(item, index, style)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default VirtualList;
export { VirtualList };
export type { VirtualListProps };
