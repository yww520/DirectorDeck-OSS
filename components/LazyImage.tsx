/**
 * LazyImage - 懒加载图片组件
 * 
 * 使用 Intersection Observer 实现图片延迟加载，
 * 提高初始页面加载性能。
 * 
 * @since 2026-01-13
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { ImageIcon } from 'lucide-react';

interface LazyImageProps {
    /** 图片 URL */
    src: string;
    /** 图片 alt 属性 */
    alt?: string;
    /** 图片 className */
    className?: string;
    /** 容器 className */
    containerClassName?: string;
    /** 占位符背景色 */
    placeholderColor?: string;
    /** 加载完成回调 */
    onLoad?: () => void;
    /** 加载失败回调 */
    onError?: () => void;
    /** 是否使用淡入效果 */
    fadeIn?: boolean;
    /** 淡入持续时间 (ms) */
    fadeInDuration?: number;
    /** 提前加载的像素距离 */
    rootMargin?: string;
    /** 是否显示加载指示器 */
    showLoader?: boolean;
    /** 点击事件 */
    onClick?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = memo(({
    src,
    alt = '',
    className = '',
    containerClassName = '',
    placeholderColor = 'bg-zinc-900',
    onLoad,
    onError,
    fadeIn = true,
    fadeInDuration = 300,
    rootMargin = '100px',
    showLoader = true,
    onClick
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Intersection Observer 监听
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observer.unobserve(container);
                    }
                });
            },
            { rootMargin }
        );

        observer.observe(container);

        return () => observer.disconnect();
    }, [rootMargin]);

    // 处理加载完成
    const handleLoad = () => {
        setIsLoaded(true);
        onLoad?.();
    };

    // 处理加载失败
    const handleError = () => {
        setHasError(true);
        onError?.();
    };

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden ${containerClassName}`}
            onClick={onClick}
        >
            {/* 占位符 */}
            {(!isLoaded || hasError) && (
                <div className={`absolute inset-0 ${placeholderColor} flex items-center justify-center`}>
                    {showLoader && !hasError && isInView && (
                        <div className="animate-pulse">
                            <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-cine-accent animate-spin" />
                        </div>
                    )}
                    {hasError && (
                        <div className="flex flex-col items-center gap-2 text-zinc-600">
                            <ImageIcon size={24} />
                            <span className="text-[10px] uppercase tracking-wider">加载失败</span>
                        </div>
                    )}
                    {!isInView && !hasError && (
                        <ImageIcon size={24} className="text-zinc-700" />
                    )}
                </div>
            )}

            {/* 实际图片 */}
            {isInView && !hasError && (
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`${className} ${fadeIn ? 'transition-opacity' : ''}`}
                    style={{
                        opacity: isLoaded ? 1 : 0,
                        transitionDuration: `${fadeInDuration}ms`
                    }}
                />
            )}
        </div>
    );
});

LazyImage.displayName = 'LazyImage';

export { LazyImage };
export default LazyImage;
