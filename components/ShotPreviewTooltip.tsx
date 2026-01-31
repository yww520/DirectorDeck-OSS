/**
 * ShotPreviewTooltip Component
 * 
 * 分镜预览悬浮提示，显示已生成的图片
 * 
 * @since 2026-01-13
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, Film, Clock } from 'lucide-react';

interface ShotPreviewTooltipProps {
    /** 悬停触发元素 */
    children: React.ReactNode;
    /** 预览图片 URL */
    imageUrl?: string;
    /** 视频 URL */
    videoUrl?: string;
    /** 镜头编号 */
    shotNumber: string;
    /** 场景描述 */
    description?: string;
    /** 是否禁用预览 */
    disabled?: boolean;
}

export const ShotPreviewTooltip: React.FC<ShotPreviewTooltipProps> = memo(({
    children,
    imageUrl,
    videoUrl,
    shotNumber,
    description,
    disabled = false
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    const hasContent = imageUrl || videoUrl;

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (disabled || !hasContent) return;

        // 延迟显示，避免快速滑过时闪烁
        timeoutRef.current = window.setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setPosition({
                    x: rect.right + 12,
                    y: rect.top
                });
                setIsVisible(true);
            }
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // 确保预览框不会超出视窗
    useEffect(() => {
        if (isVisible && typeof window !== 'undefined') {
            const previewHeight = 240;
            const previewWidth = 320;
            const padding = 16;

            let newX = position.x;
            let newY = position.y;

            // 右边界检查
            if (newX + previewWidth > window.innerWidth - padding) {
                const rect = triggerRef.current?.getBoundingClientRect();
                if (rect) {
                    newX = rect.left - previewWidth - 12;
                }
            }

            // 下边界检查
            if (newY + previewHeight > window.innerHeight - padding) {
                newY = window.innerHeight - previewHeight - padding;
            }

            // 上边界检查
            if (newY < padding) {
                newY = padding;
            }

            if (newX !== position.x || newY !== position.y) {
                setPosition({ x: newX, y: newY });
            }
        }
    }, [isVisible, position.x, position.y]);

    const tooltipContent = isVisible && hasContent && (
        <div
            className="fixed z-[9999] pointer-events-none"
            style={{
                left: position.x,
                top: position.y
            }}
        >
            <div className="bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-80">
                {/* Preview Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50 border-b border-zinc-800">
                    {videoUrl ? (
                        <Film size={12} className="text-cine-accent" />
                    ) : (
                        <ImageIcon size={12} className="text-cine-accent" />
                    )}
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        镜头 {shotNumber}
                    </span>
                </div>

                {/* Media Preview */}
                <div className="relative aspect-video bg-black">
                    {videoUrl ? (
                        <video
                            src={videoUrl}
                            className="w-full h-full object-contain"
                            autoPlay
                            muted
                            loop
                            playsInline
                        />
                    ) : imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={`预览 - ${shotNumber}`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : null}
                </div>

                {/* Description */}
                {description && (
                    <div className="px-3 py-2 bg-zinc-900/30 border-t border-zinc-800">
                        <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">
                            {description}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="inline-block"
            >
                {children}
            </div>
            {typeof document !== 'undefined' && tooltipContent && createPortal(tooltipContent, document.body)}
        </>
    );
});

ShotPreviewTooltip.displayName = 'ShotPreviewTooltip';

export default ShotPreviewTooltip;
