/**
 * SortableStoryboardRow Component
 * 
 * 可拖拽排序的分镜表行组件
 * 
 * @since 2026-01-13
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Copy, Share2, Image, Film, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { StoryboardItem, GeneratedImage } from '../types';
import { ShotPreviewTooltip } from './ShotPreviewTooltip';

interface SortableRowProps {
    item: StoryboardItem;
    onSyncToCanvas: (item: StoryboardItem) => void;
    onFilterByShot: (shot: string) => void;
    onFilterByLocation: (location: string) => void;
    onFilterByCharacter: (character: string) => void;
    /** 已生成的图片/视频，用于预览 */
    previewImage?: GeneratedImage;
    /** 删除单个分镜 */
    onDelete: (id: string) => void;
    /** 是否折叠 */
    isCollapsed?: boolean;
    /** 切换折叠状态 */
    onToggleCollapse?: () => void;
}

const EnhancedText: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parenRegex = /(\([^)]+\))/g;

    // First split by URL
    const parts = text.split(urlRegex);

    return (
        <>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cine-accent hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }

                // Then split by parentheses for character details
                const subParts = part.split(parenRegex);
                return subParts.map((subPart, j) => {
                    if (subPart.match(parenRegex)) {
                        return (
                            <span key={`p-${j}`} className="text-zinc-500 italic font-medium">
                                {subPart}
                            </span>
                        );
                    }
                    return subPart;
                });
            })}
        </>
    );
};

export const SortableStoryboardRow: React.FC<SortableRowProps> = ({
    item,
    onSyncToCanvas,
    onFilterByShot,
    onFilterByLocation,
    onFilterByCharacter,
    previewImage,
    onDelete,
    isCollapsed = false,
    onToggleCollapse
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto'
    };

    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(item.aiPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group/row relative bg-zinc-900/10 border border-zinc-800/20 rounded-2xl p-4 transition-all hover:bg-zinc-900/30 mb-2 ${isDragging ? 'opacity-50 scale-[0.98] z-50 bg-zinc-800 shadow-2xl' : ''} ${isCollapsed ? 'pb-2' : ''}`}
        >
            {/* Header Row: Handle, #Shot, ShotType tag, Trash */}
            <div className={`flex items-center gap-3 ${isCollapsed ? 'mb-0' : 'mb-4'}`}>
                <button
                    onClick={onToggleCollapse}
                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-cine-accent transition-all"
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>

                <button
                    {...attributes}
                    {...listeners}
                    className="text-zinc-700 hover:text-zinc-500 cursor-grab active:cursor-grabbing ml-[-4px]"
                >
                    <GripVertical size={16} />
                </button>

                <span
                    className="bg-[#e0edff] text-[#4a90e2] px-2 py-0.5 rounded text-xs font-black font-mono cursor-pointer hover:brightness-110 active:scale-95 transition-all select-none"
                    onDoubleClick={() => onFilterByShot(item.shotNumber.split('-')[0])}
                    title="双击以筛选此场次"
                >
                    #{item.shotNumber}
                </span>

                {item.shotType && (
                    <span
                        className="px-3 py-0.5 bg-purple-500/5 border border-purple-500/20 text-purple-400/80 text-[10px] rounded hover:border-purple-500/40 cursor-pointer transition-colors select-none"
                        onDoubleClick={() => onFilterByShot(item.shotType)}
                        title="双击以筛选此景别"
                    >
                        {item.shotType}
                    </span>
                )}

                {isCollapsed && (
                    <div className="flex-1 truncate text-[11px] text-zinc-500 italic ml-2">
                        {item.description}
                    </div>
                )}

                {!isCollapsed && <div className="flex-1" />}

                <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                        onClick={() => onSyncToCanvas(item)}
                        className="p-1.5 text-zinc-500 hover:text-cine-accent transition-colors"
                        title="同步至画布"
                    >
                        <Share2 size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                        title="删除分镜"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Content Body: Structured Rows */}
            {!isCollapsed && (
                <div className="pl-7 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    {/* Cinematic Description Row */}
                    <div className="flex items-start gap-3">
                        <span className="w-6 h-6 shrink-0 flex items-center justify-center border border-zinc-800 text-[10px] text-zinc-600 rounded bg-zinc-950 font-bold">
                            镜
                        </span>
                        <div className="flex-1 text-zinc-300 text-[13px] leading-relaxed pt-0.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {item.shotType && (
                                    <span className="text-cine-accent font-black tracking-tighter">
                                        {item.shotType.startsWith('[') ? item.shotType : `[${item.shotType}]`}
                                    </span>
                                )}
                                <EnhancedText text={item.description} />

                                {item.lighting && (
                                    <span className="text-zinc-400">
                                        <span className="text-purple-400/80 mr-1 font-bold">[光影]</span>
                                        {item.lighting}
                                    </span>
                                )}
                            </div>


                        </div>

                        {/* Conditional Thumbnail if generated */}
                        {previewImage && (
                            <div className="ml-auto shrink-0 w-28 aspect-video rounded-xl overflow-hidden border border-zinc-800 shadow-2xl group-hover/row:scale-105 transition-transform">
                                {previewImage.videoUrl ? (
                                    <video src={previewImage.videoUrl} className="w-full h-full object-cover" muted loop onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                                ) : (
                                    <img src={previewImage.url} className="w-full h-full object-cover" alt="Preview" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Description Row */}
                    {item.action && (
                        <div className="flex items-start gap-3">
                            <span className="w-6 h-6 shrink-0 flex items-center justify-center border border-zinc-800 text-[9px] text-zinc-600 rounded bg-zinc-950 font-bold mt-0.5">
                                动
                            </span>
                            <div className="flex-1 text-white/90 font-medium text-[13px] leading-relaxed">
                                <EnhancedText text={item.action} />
                            </div>
                            {/* Right balance: avoid text going under thumbnail */}
                            {previewImage && <div className="w-28 shrink-0 hidden md:block" />}
                        </div>
                    )}

                    {/* Meta Row: Duration, Sound/Dialogue */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="w-10 h-6 shrink-0 flex items-center justify-center border border-zinc-800 text-[10px] text-zinc-600 rounded bg-zinc-950">
                                时长
                            </span>
                            <span className="text-zinc-500 text-[12px] font-mono">{item.duration}s</span>
                        </div>

                        {(item.audioDescription || item.dialogue !== '-') && (
                            <div className="flex items-center gap-2 ml-4">
                                <span className="bg-blue-400/10 text-blue-400/80 px-1.5 py-0.5 rounded text-[9px] font-black border border-blue-400/20">
                                    BGM
                                </span>
                                <div className="text-zinc-500 text-[12px] flex items-center gap-2">
                                    {item.audioDescription}
                                    {item.dialogue !== '-' && (
                                        <span className="text-zinc-600 italic">
                                            / 台词: "{item.dialogue}"
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* AI Prompt Tooltip/Copy */}
                        <div className="ml-auto opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-2">
                            <button
                                onClick={handleCopy}
                                className={`p-1.5 rounded-lg border border-zinc-800 flex items-center gap-2 text-[10px] transition-all ${copied ? 'bg-cine-accent/10 border-cine-accent text-cine-accent' : 'bg-black/40 text-zinc-600 hover:text-zinc-400'}`}
                            >
                                <Copy size={12} />
                                {copied ? 'Copied' : 'Prompt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SortableStoryboardRow;

