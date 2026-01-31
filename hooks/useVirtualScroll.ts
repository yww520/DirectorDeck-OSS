/**
 * useVirtualScroll - 虚拟滚动 Hook
 * 
 * 提供更灵活的虚拟滚动逻辑，可用于自定义容器。
 * 
 * 使用示例:
 * ```tsx
 * function MyList() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   
 *   const {
 *     visibleItems,
 *     totalHeight,
 *     handleScroll
 *   } = useVirtualScroll({
 *     items: myItems,
 *     itemHeight: 60,
 *     containerHeight: 400
 *   });
 *   
 *   return (
 *     <div ref={containerRef} onScroll={handleScroll} style={{ height: 400, overflow: 'auto' }}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {visibleItems.map(({ item, index, style }) => (
 *           <div key={index} style={style}>
 *             {item.name}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useMemo } from 'react';

interface UseVirtualScrollOptions<T> {
    /** 数据列表 */
    items: T[];
    /** 每项的高度（像素） */
    itemHeight: number;
    /** 容器高度（像素） */
    containerHeight: number;
    /** 缓冲区大小（额外渲染的项目数量，默认 5） */
    overscan?: number;
}

interface VisibleItem<T> {
    item: T;
    index: number;
    style: React.CSSProperties;
}

interface UseVirtualScrollResult<T> {
    /** 可见项列表 */
    visibleItems: VisibleItem<T>[];
    /** 总高度 */
    totalHeight: number;
    /** 起始索引 */
    startIndex: number;
    /** 结束索引 */
    endIndex: number;
    /** 当前滚动位置 */
    scrollTop: number;
    /** 滚动处理函数 */
    handleScroll: (e: React.UIEvent<HTMLElement>) => void;
    /** 滚动到指定索引 */
    scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => number;
    /** 滚动到指定位置 */
    scrollToOffset: (offset: number) => void;
}

/**
 * 虚拟滚动 Hook
 */
function useVirtualScroll<T>({
    items,
    itemHeight,
    containerHeight,
    overscan = 5
}: UseVirtualScrollOptions<T>): UseVirtualScrollResult<T> {
    const [scrollTop, setScrollTop] = useState(0);

    // 计算可见项
    const { visibleItems, totalHeight, startIndex, endIndex } = useMemo(() => {
        const totalHeight = items.length * itemHeight;

        // 计算可见范围
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

        // 提取可见项
        const visibleItems: VisibleItem<T>[] = items.slice(startIndex, endIndex + 1).map((item, i) => ({
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
    const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // 滚动到指定索引
    const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start'): number => {
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
        let offset = clampedIndex * itemHeight;

        if (align === 'center') {
            offset = offset - containerHeight / 2 + itemHeight / 2;
        } else if (align === 'end') {
            offset = offset - containerHeight + itemHeight;
        }

        const clampedOffset = Math.max(0, offset);
        setScrollTop(clampedOffset);
        return clampedOffset;
    }, [items.length, itemHeight, containerHeight]);

    // 滚动到指定位置
    const scrollToOffset = useCallback((offset: number) => {
        setScrollTop(Math.max(0, offset));
    }, []);

    return {
        visibleItems,
        totalHeight,
        startIndex,
        endIndex,
        scrollTop,
        handleScroll,
        scrollToIndex,
        scrollToOffset
    };
}

export default useVirtualScroll;
export { useVirtualScroll };
export type { UseVirtualScrollOptions, UseVirtualScrollResult, VisibleItem };
