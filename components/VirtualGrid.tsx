/**
 * VirtualGrid - 虚拟滚动网格组件
 * 
 * 用于高效渲染大量网格项，只渲染可视区域内的元素。
 * 适用于图片库、角色库、资源库等场景。
 * 
 * 使用示例:
 * ```tsx
 * <VirtualGrid
 *   items={images}
 *   itemWidth={200}
 *   itemHeight={150}
 *   gap={16}
 *   containerHeight={600}
 *   renderItem={(item, index) => (
 *     <img src={item.url} alt={item.name} />
 *   )}
 * />
 * ```
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

/**
 * 虚拟网格 Props
 */
interface VirtualGridProps<T> {
    /** 数据列表 */
    items: T[];
    /** 每个项目的宽度（像素） */
    itemWidth: number;
    /** 每个项目的高度（像素） */
    itemHeight: number;
    /** 项目之间的间距（像素） */
    gap?: number;
    /** 容器高度（像素） */
    containerHeight?: number;
    /** 渲染每个项目的函数 */
    renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
    /** 容器的额外 className */
    containerClassName?: string;
    /** 缓冲行数（默认 2） */
    overscanRows?: number;
    /** 空状态渲染 */
    emptyState?: React.ReactNode;
    /** 获取项目唯一 key 的函数 */
    getItemKey?: (item: T, index: number) => string | number;
    /** 滚动事件回调 */
    onScroll?: (scrollTop: number) => void;
    /** 是否自动计算列数 */
    autoColumns?: boolean;
    /** 固定列数（不使用 autoColumns 时） */
    columns?: number;
    /** 内边距 */
    padding?: number;
}

/**
 * 虚拟网格组件
 */
function VirtualGrid<T>({
    items,
    itemWidth,
    itemHeight,
    gap = 16,
    containerHeight: propContainerHeight,
    renderItem,
    containerClassName = '',
    overscanRows = 2,
    emptyState,
    getItemKey,
    onScroll,
    autoColumns = true,
    columns: propColumns,
    padding = 0
}: VirtualGridProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(propContainerHeight || 400);

    // 监听容器大小变化
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width - padding * 2);
                if (!propContainerHeight) {
                    setContainerHeight(entry.contentRect.height);
                }
            }
        });

        resizeObserver.observe(container);

        // 初始化
        setContainerWidth(container.clientWidth - padding * 2);

        return () => resizeObserver.disconnect();
    }, [propContainerHeight, padding]);

    // 计算列数
    const columns = useMemo(() => {
        if (!autoColumns && propColumns) return propColumns;
        if (containerWidth <= 0) return 1;
        return Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
    }, [autoColumns, propColumns, containerWidth, itemWidth, gap]);

    // 计算可见项
    const { visibleItems, totalHeight, rows } = useMemo(() => {
        const rows = Math.ceil(items.length / columns);
        const rowHeight = itemHeight + gap;
        const totalHeight = rows * rowHeight - gap + padding * 2;

        // 计算可见行范围
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
        const visibleRowCount = Math.ceil(containerHeight / rowHeight);
        const endRow = Math.min(rows - 1, startRow + visibleRowCount + overscanRows * 2);

        // 计算可见项索引
        const startIndex = startRow * columns;
        const endIndex = Math.min(items.length - 1, (endRow + 1) * columns - 1);

        // 提取可见项
        const visibleItems = items.slice(startIndex, endIndex + 1).map((item, i) => {
            const index = startIndex + i;
            const row = Math.floor(index / columns);
            const col = index % columns;

            return {
                item,
                index,
                style: {
                    position: 'absolute' as const,
                    top: padding + row * rowHeight,
                    left: padding + col * (itemWidth + gap),
                    width: itemWidth,
                    height: itemHeight
                }
            };
        });

        return { visibleItems, totalHeight, rows };
    }, [items, columns, itemWidth, itemHeight, gap, containerHeight, scrollTop, overscanRows, padding]);

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
                ref={containerRef}
                className={`virtual-grid-empty ${containerClassName}`}
                style={{ height: propContainerHeight || '100%' }}
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
            className={`virtual-grid-container overflow-y-auto ${containerClassName}`}
            style={{ height: propContainerHeight || '100%' }}
            onScroll={handleScroll}
        >
            <div
                className="virtual-grid-content relative"
                style={{ height: totalHeight }}
            >
                {visibleItems.map(({ item, index, style }) => (
                    <div
                        key={getItemKey ? getItemKey(item, index) : index}
                        className="virtual-grid-item"
                        style={style}
                    >
                        {renderItem(item, index, style)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default VirtualGrid;
export { VirtualGrid };
export type { VirtualGridProps };
