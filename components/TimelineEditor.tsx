import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GeneratedImage, TimelineData, TimelineTrack, TimelineClip } from '../types';
import { Play, Pause, SkipBack, SkipForward, Scissors, Plus, Film, Music, Type, Trash2, Clock, AlignLeft, Download } from 'lucide-react';
import { TranslateButton } from './TranslateButton';
import { jianyingExportService } from '../services/jianyingExportService';

interface TimelineEditorProps {
    images: GeneratedImage[];
    timelineData: TimelineData;
    onUpdateTimeline: (data: TimelineData) => void;
    projectName?: string;
}

export const TimelineEditor = React.memo(({
    images,
    timelineData,
    onUpdateTimeline,
    projectName = "DirectorDeck"
}: TimelineEditorProps) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoom, setZoom] = useState(50); // px per second
    const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
    const timelineRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>();
    const isScrubbing = useRef(false);
    const scrubRafId = useRef<number>();
    const [isVideoLoading, setIsVideoLoading] = useState(false);
    const [previewHeight, setPreviewHeight] = useState(65); // Percentage
    const isResizing = useRef(false);
    const editorRef = useRef<HTMLDivElement>(null);

    // Sync refs to avoid closure staleness during dragging
    const timelineDataRef = useRef(timelineData);
    const onUpdateTimelineRef = useRef(onUpdateTimeline);
    useEffect(() => { timelineDataRef.current = timelineData; }, [timelineData]);
    useEffect(() => { onUpdateTimelineRef.current = onUpdateTimeline; }, [onUpdateTimeline]);

    // Resizing State
    const [isResizingClip, setIsResizingClip] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const clipResizeRef = useRef<{ id: string, side: 'left' | 'right', startX: number, initialStart: number, initialDuration: number, timelineOffset: number } | null>(null);
    const resizeRafId = useRef<number>();

    const handleClipResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!clipResizeRef.current) return;

        if (resizeRafId.current) cancelAnimationFrame(resizeRafId.current);

        resizeRafId.current = requestAnimationFrame(() => {
            if (!clipResizeRef.current || !timelineRef.current) return;
            const { id, side, initialStart, initialDuration } = clipResizeRef.current;

            const timelineRect = timelineRef.current.getBoundingClientRect();
            const scrollLeft = timelineRef.current.scrollLeft;

            // Calculate absolute time at current mouse position relative to timeline 0s
            // Rect.left + 160 is where the track content starts in viewport
            const mouseXInTimeline = e.clientX - (timelineRect.left + 160) + scrollLeft;
            const currentTimeAtMouse = Math.max(0, mouseXInTimeline / zoom);

            let newStart = initialStart;
            let newDuration = initialDuration;

            if (side === 'left') {
                const clipEndTime = initialStart + initialDuration;
                // Clamp: cannot drag start past 0 or past (End - 0.1s)
                newStart = Math.max(0, Math.min(clipEndTime - 0.1, currentTimeAtMouse));
                newDuration = clipEndTime - newStart;
            } else {
                // Clamp: cannot drag duration to less than 0.1s
                newDuration = Math.max(0.1, currentTimeAtMouse - initialStart);
            }

            const currentData = timelineDataRef.current;
            const newTracks = currentData.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => clip.id === id ? { ...clip, startTime: newStart, duration: newDuration } : clip)
            }));

            onUpdateTimelineRef.current({ ...currentData, tracks: newTracks });
        });
    }, [zoom]);

    const stopClipResize = useCallback(() => {
        clipResizeRef.current = null;
        setIsResizingClip(false);
        document.removeEventListener('mousemove', handleClipResizeMouseMove);
        document.removeEventListener('mouseup', stopClipResize);
        document.body.style.cursor = 'default';
    }, [handleClipResizeMouseMove]);

    const startClipResize = (e: React.MouseEvent, clipId: string, side: 'left' | 'right') => {
        e.preventDefault();
        e.stopPropagation();

        const clip = timelineDataRef.current.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
        if (!clip) return;

        const timelineRect = timelineRef.current?.getBoundingClientRect();
        if (!timelineRect) return;

        setIsResizingClip(true);
        clipResizeRef.current = {
            id: clipId,
            side,
            startX: e.clientX,
            initialStart: clip.startTime,
            initialDuration: clip.duration
        };

        document.addEventListener('mousemove', handleClipResizeMouseMove);
        document.addEventListener('mouseup', stopClipResize);
        document.body.style.cursor = 'col-resize';
    };

    const handleScrubbing = useCallback((e: MouseEvent) => {
        if (!isScrubbing.current || !timelineRef.current) return;

        if (scrubRafId.current) cancelAnimationFrame(scrubRafId.current);

        scrubRafId.current = requestAnimationFrame(() => {
            if (!timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            // Subtract the scrollLeft of the container if it's scrollable, 
            // but here the container itself is the timeline viewport.
            // The 160px is the fixed header offset.
            const offsetX = e.clientX - rect.left - 160 + timelineRef.current.scrollLeft;
            const time = Math.max(0, offsetX / zoom);
            setCurrentTime(time);
        });
    }, [zoom]);

    const stopScrubbing = useCallback(() => {
        isScrubbing.current = false;
        document.removeEventListener('mousemove', handleScrubbing);
        document.removeEventListener('mouseup', stopScrubbing);
        document.body.style.cursor = 'default';
        document.body.style.overscrollBehavior = 'auto';
        if (scrubRafId.current) cancelAnimationFrame(scrubRafId.current);
    }, [handleScrubbing]);

    const startScrubbing = (e: React.MouseEvent) => {
        // Only start scrubbing if clicking on the time area or playhead, 
        // not on a clip or button (though stopPropagation usually handles that).
        e.preventDefault();
        setIsPlaying(false); // Pause playback when scrubbing
        isScrubbing.current = true;

        // Initial jump
        const rect = timelineRef.current?.getBoundingClientRect();
        if (rect) {
            const offsetX = e.clientX - rect.left - 160 + (timelineRef.current?.scrollLeft || 0);
            setCurrentTime(Math.max(0, offsetX / zoom));
        }

        document.addEventListener('mousemove', handleScrubbing);
        document.addEventListener('mouseup', stopScrubbing);
        document.body.style.cursor = 'ew-resize';
        document.body.style.overscrollBehavior = 'none'; // Prevent browser bounce
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current || !editorRef.current) return;
        const rect = editorRef.current.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const percentage = (offsetY / rect.height) * 100;
        // Limit between 20% and 85% to prevent UI breaking
        setPreviewHeight(Math.max(20, Math.min(85, percentage)));
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'default';
    }, [handleMouseMove]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'row-resize';
    };

    // Script Wizard State
    const [isScriptWizardOpen, setIsScriptWizardOpen] = useState(false);
    const [scriptInput, setScriptInput] = useState('');
    const [isProcessingScript, setIsProcessingScript] = useState(false);

    // Find active clips for preview (Top-most visible video track wins)
    // Priority 1: Specifically selected clip
    // Priority 2: Playhead position (Top tracks win)
    const selectedClipOnTimeline = timelineData.tracks
        .flatMap(t => t.clips)
        .find(c => selectedClipIds.includes(c.id));

    const activeVideoClip = selectedClipOnTimeline || [...timelineData.tracks]
        .reverse() // Top tracks first
        .filter(t => t.type === 'video' && t.isVisible !== false)
        .flatMap(t => t.clips)
        .find(c => currentTime >= c.startTime && currentTime <= (c.startTime + c.duration));

    const activeNode = activeVideoClip ? images.find(img => img.id === activeVideoClip.nodeId && img.projectId === timelineData.projectId) : null;

    // Find active audio clips (Multiple can play at once)
    const activeAudioClips = timelineData.tracks
        .filter(t => t.type === 'audio' && t.isMuted !== true)
        .flatMap(t => t.clips.filter(c => currentTime >= c.startTime && currentTime <= (c.startTime + c.duration)));

    // Find active subtitle
    const activeSubtitleClip = timelineData.tracks
        .filter(t => t.type === 'subtitle' && t.isVisible !== false)
        .flatMap(t => t.clips)
        .find(c => currentTime >= c.startTime && currentTime <= (c.startTime + c.duration));
    const activeSubtitleText = activeSubtitleClip?.customLabel || '';

    // Calculate internal video time for seeking
    const videoTime = activeVideoClip ? (currentTime - activeVideoClip.startTime + activeVideoClip.trimStart) : 0;

    // Playback Loop
    useEffect(() => {
        const animate = (time: number) => {
            if (lastTimeRef.current !== undefined) {
                const deltaTime = (time - lastTimeRef.current) / 1000;
                setCurrentTime(prev => {
                    const next = prev + deltaTime;
                    if (next >= timelineData.totalDuration) {
                        setIsPlaying(false);
                        return timelineData.totalDuration;
                    }
                    return next;
                });
            }
            lastTimeRef.current = time;
            requestRef.current = requestAnimationFrame(animate);
        };

        if (isPlaying) {
            lastTimeRef.current = undefined;
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, timelineData.totalDuration]);

    // Synchronize Audio Elements
    useEffect(() => {
        activeAudioClips.forEach(clip => {
            const audio = audioRefs.current[clip.id];
            if (!audio) return;

            const clipTime = currentTime - clip.startTime + clip.trimStart;

            // Sync time
            if (Math.abs(audio.currentTime - clipTime) > 0.15) {
                audio.currentTime = clipTime;
            }

            // Sync volume
            audio.volume = Math.max(0, Math.min(2, clip.volume ?? 1));

            // Sync playback state
            if (isPlaying && audio.paused) {
                audio.play().catch(() => { });
            } else if (!isPlaying && !audio.paused) {
                audio.pause();
            }
        });

        // Pause/Cleanup audios that are no longer active
        Object.keys(audioRefs.current).forEach(id => {
            if (!activeAudioClips.find(c => c.id === id)) {
                audioRefs.current[id]?.pause();
            }
        });
    }, [currentTime, isPlaying, activeAudioClips.length]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Sync time
        if (Math.abs(video.currentTime - videoTime) > 0.15) {
            video.currentTime = videoTime;
        }

        // Sync playback state
        if (isPlaying && video.paused) {
            video.play().catch(err => console.error("Playback failed:", err));
        } else if (!isPlaying && !video.paused) {
            video.pause();
        }
    }, [videoTime, isPlaying, activeNode?.id]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, trackId: string) => {
        e.preventDefault();
        const nodeId = e.dataTransfer.getData('nodeId');
        const clipId = e.dataTransfer.getData('clipId');

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const startTime = Math.max(0, (offsetX) / zoom);

        if (clipId) {
            const newTracks = timelineData.tracks.map(track => {
                const filteredClips = track.clips.filter(c => c.id !== clipId);
                if (track.id === trackId) {
                    const movingClip = timelineData.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
                    if (movingClip) {
                        return { ...track, clips: [...filteredClips, { ...movingClip, startTime, trackId }] };
                    }
                }
                return { ...track, clips: filteredClips };
            });
            onUpdateTimeline({ ...timelineData, tracks: newTracks });
        } else if (nodeId) {
            const node = images.find(img => img.id === nodeId && img.projectId === timelineData.projectId);
            if (!node) return;
            const duration = node.motionConfig?.duration || 4;
            const newClip: TimelineClip = {
                id: crypto.randomUUID(),
                nodeId,
                startTime,
                duration,
                trimStart: 0,
                trackId,
                opacity: 1,
                volume: 1,
                playbackRate: 1
            };
            const newTracks = timelineData.tracks.map(track => {
                if (track.id === trackId) return { ...track, clips: [...track.clips, newClip] };
                return track;
            });
            onUpdateTimeline({ ...timelineData, tracks: newTracks });
        }
    };

    const handleTrackClick = (e: React.MouseEvent, trackId: string) => {
        // Individual track clicks now just initiate scrubbing
        startScrubbing(e);
        setSelectedClipIds([]);
    };

    const handleClipClick = (e: React.MouseEvent, clipId: string) => {
        e.stopPropagation();
        if (e.shiftKey) {
            setSelectedClipIds(prev =>
                prev.includes(clipId)
                    ? prev.filter(id => id !== clipId)
                    : [...prev, clipId]
            );
        } else {
            setSelectedClipIds([clipId]);
            // Seek playhead to clip start for visual feedback
            const clip = timelineData.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
            if (clip) {
                setCurrentTime(clip.startTime);
            }
        }
    };

    const selectedClips = timelineData.tracks.flatMap(t => t.clips).filter(c => selectedClipIds.includes(c.id));
    const selectedClip = selectedClips[0] || null; // Primary selected clip

    // Derived: Find the sessionId of the most recently synced node to try and narrow down the strip
    // If no nodes synced yet, or we want all, this is a fallback.
    const lastSyncedNode = [...images].reverse().find(img => img.isSyncedToEditor);
    const activeSessionIdInEditor = lastSyncedNode?.sessionId;

    const videoNodes = images.filter(img =>
        (img.projectId === timelineData.projectId) &&
        (img.nodeType === 'video' || (img.nodeType === 'render' && (img.videoUrl || img.videoBlob))) &&
        img.isSyncedToEditor
    );

    const updateClipProperty = (clipIds: string[], updates: Partial<TimelineClip>) => {
        const newTracks = timelineData.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => clipIds.includes(clip.id) ? { ...clip, ...updates } : clip)
        }));
        onUpdateTimeline({ ...timelineData, tracks: newTracks });
    };

    const handleSplit = () => {
        if (selectedClipIds.length === 0 || !selectedClip) return;

        // Split all selected clips if playhead is inside them
        const newTracks = timelineData.tracks.map(track => {
            const updatedClips: TimelineClip[] = [];

            track.clips.forEach(clip => {
                if (selectedClipIds.includes(clip.id) &&
                    currentTime > clip.startTime &&
                    currentTime < (clip.startTime + clip.duration)) {

                    const splitPoint = currentTime;
                    const firstPartDuration = splitPoint - clip.startTime;
                    const secondPartDuration = clip.duration - firstPartDuration;
                    const secondPartStartTime = splitPoint;
                    const secondPartTrimStart = clip.trimStart + firstPartDuration;

                    const newClip: TimelineClip = {
                        ...clip,
                        id: crypto.randomUUID(),
                        startTime: secondPartStartTime,
                        duration: secondPartDuration,
                        trimStart: secondPartTrimStart
                    };

                    updatedClips.push({ ...clip, duration: firstPartDuration });
                    updatedClips.push(newClip);
                } else {
                    updatedClips.push(clip);
                }
            });

            return { ...track, clips: updatedClips };
        });

        onUpdateTimeline({ ...timelineData, tracks: newTracks });
    };

    const handleMerge = () => {
        if (selectedClipIds.length === 0 || !selectedClip) return;

        const track = timelineData.tracks.find(t => t.id === selectedClip.trackId);
        if (!track) return;

        const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
        const currentIndex = sortedClips.findIndex(c => c.id === selectedClip.id);
        const nextClip = sortedClips[currentIndex + 1];

        // Only merge if they are the same node and adjacent (roughly)
        if (nextClip && nextClip.nodeId === selectedClip.nodeId) {
            const newDuration = (nextClip.startTime + nextClip.duration) - selectedClip.startTime;

            const newTracks = timelineData.tracks.map(t => {
                if (t.id === track.id) {
                    return {
                        ...t,
                        clips: t.clips.filter(c => c.id !== nextClip.id).map(c =>
                            c.id === selectedClip.id ? { ...c, duration: newDuration } : c
                        )
                    };
                }
                return t;
            });
            onUpdateTimeline({ ...timelineData, tracks: newTracks });
        }
    };

    const handleAlignLeft = () => {
        const newTracks = timelineData.tracks.map(track => {
            // Sort clips by their current start time
            const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
            let nextStartTime = 0;

            // Pack them sequentially from 0
            const alignedClips = sortedClips.map(clip => {
                const updatedClip = { ...clip, startTime: nextStartTime };
                nextStartTime += clip.duration;
                return updatedClip;
            });

            return { ...track, clips: alignedClips };
        });
        onUpdateTimeline({ ...timelineData, tracks: newTracks });
    };

    const handleAutoSubtitle = () => {
        const subtitleTrack = timelineData.tracks.find(t => t.type === 'subtitle');
        if (!subtitleTrack) return;

        const newSubtitleClips: TimelineClip[] = [];

        // Loop through all audio tracks to find dubbed clips
        timelineData.tracks.forEach(track => {
            if (track.type === 'audio') {
                track.clips.forEach(audioClip => {
                    const node = images.find(img => img.id === audioClip.nodeId);
                    if (node && (node.dialogue || node.prompt || node.customLabel)) {
                        const text = node.dialogue || node.prompt || node.customLabel || '';

                        // Avoid adding duplicate subtitles at the exact same time
                        const isDuplicate = subtitleTrack.clips.some(sc => sc.startTime === audioClip.startTime && sc.customLabel === text);

                        if (!isDuplicate) {
                            newSubtitleClips.push({
                                id: crypto.randomUUID(),
                                nodeId: audioClip.nodeId,
                                startTime: audioClip.startTime,
                                duration: audioClip.duration,
                                trimStart: audioClip.trimStart,
                                trackId: subtitleTrack.id,
                                customLabel: text
                            });
                        }
                    }
                });
            }
        });

        if (newSubtitleClips.length === 0) return;

        const newTracks = timelineData.tracks.map(t => {
            if (t.id === subtitleTrack.id) {
                return { ...t, clips: [...t.clips, ...newSubtitleClips] };
            }
            return t;
        });

        onUpdateTimeline({ ...timelineData, tracks: newTracks });
    };

    const handleProcessScript = async () => {
        if (!scriptInput.trim()) return;
        setIsProcessingScript(true);
        const lines = scriptInput.split('\n').filter(l => l.trim());
        let currentTrackTime = currentTime;
        const newSubtitleTrack = { ...timelineData.tracks.find(t => t.type === 'subtitle')! };
        const newAudioTrack = { ...timelineData.tracks.find(t => t.type === 'audio')! };

        for (const line of lines) {
            const duration = Math.max(2, line.length * 0.3 + 0.5);
            const nodeId = crypto.randomUUID();
            const mockNode: GeneratedImage = {
                id: nodeId,
                projectId: timelineData.projectId,
                url: undefined as any,
                prompt: line,
                aspectRatio: '16:9',
                timestamp: Date.now(),
                nodeType: 'video',
                customLabel: line.substring(0, 10) + '...',
                videoUrl: '', // Clear hardcoded mock URL
                isSyncedToEditor: true
            };
            // Note: In real app, we would add mockNode to global images state. 
            // For now we assume we only need the clips referenced.
            const subClip: TimelineClip = {
                id: crypto.randomUUID(),
                nodeId,
                startTime: currentTrackTime,
                duration,
                trimStart: 0,
                trackId: newSubtitleTrack.id,
                customLabel: line
            };
            const audioClip: TimelineClip = {
                id: crypto.randomUUID(),
                nodeId,
                startTime: currentTrackTime,
                duration,
                trimStart: 0,
                trackId: newAudioTrack.id,
                volume: 1
            };
            newSubtitleTrack.clips.push(subClip);
            newAudioTrack.clips.push(audioClip);
            currentTrackTime += duration;
            await new Promise(r => setTimeout(r, 400));
        }

        const newTracks = timelineData.tracks.map(t => {
            if (t.type === 'subtitle') return newSubtitleTrack;
            if (t.type === 'audio' && t.id === newAudioTrack.id) return newAudioTrack;
            return t;
        });
        onUpdateTimeline({ ...timelineData, tracks: newTracks, totalDuration: Math.max(timelineData.totalDuration, currentTrackTime + 5) });
        setIsProcessingScript(false);
        setIsScriptWizardOpen(false);
        setScriptInput('');
    };

    const handleExportJianying = async () => {
        setIsExporting(true);
        try {
            await jianyingExportService.exportToJianying(timelineData, images, projectName);
        } catch (error) {
            console.error("Export failed:", error);
            alert("导出失败，请检查控制台详情");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div ref={editorRef} className="flex flex-col h-full bg-[#050505] text-zinc-300 font-sans select-none relative overflow-hidden">
            {/* Preview Area */}
            <div className="flex bg-black items-center justify-center relative group min-h-0 p-2" style={{ flex: `0 0 ${previewHeight}%` }}>
                <div className="w-full h-full max-w-[95%] max-h-[95%] aspect-video bg-[#0a0a0c] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex items-center justify-center border border-zinc-800/50 rounded-sm">
                    {/* Monitor Decorative Elements */}
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                        <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-zinc-500"></div>
                        <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-zinc-500"></div>
                        <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-zinc-500"></div>
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-zinc-500"></div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <div className="w-8 h-[1px] bg-zinc-400"></div>
                            <div className="h-8 w-[1px] bg-zinc-400 absolute"></div>
                        </div>
                    </div>

                    {activeNode && activeNode.videoUrl ? (
                        <div className="relative w-full h-full z-10">
                            <video
                                key={activeNode.id}
                                ref={videoRef}
                                src={activeNode.videoUrl}
                                className="w-full h-full object-contain"
                                muted
                                playsInline
                                onWaiting={() => setIsVideoLoading(true)}
                                onPlaying={() => setIsVideoLoading(false)}
                                onCanPlay={() => setIsVideoLoading(false)}
                            />
                            {isVideoLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-6 h-6 border-2 border-cine-accent border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[10px] font-bold text-cine-accent uppercase tracking-[0.2em]">Buffering...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 z-10">
                            <div className="relative">
                                <Film size={32} className="text-zinc-800" />
                                <div className="absolute inset-0 animate-pulse bg-zinc-400/5 blur-xl rounded-full"></div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-zinc-600 font-mono text-[9px] uppercase tracking-[0.5em] font-bold">Signal Standby</span>
                                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>
                                <span className="text-zinc-800 font-mono text-[8px] uppercase tracking-[0.3em]">No Active Input</span>
                            </div>
                        </div>
                    )}

                    {/* Subtitle Overlay Layer */}
                    {activeSubtitleText && (
                        <div className="absolute inset-x-0 bottom-[12%] flex justify-center items-center px-12 z-40 pointer-events-none">
                            <span
                                className="text-white font-bold text-lg md:text-xl text-center leading-relaxed"
                                style={{
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5), 0 1px 1px rgba(0,0,0,1)',
                                    WebkitTextStroke: '0.5px rgba(0,0,0,0.3)'
                                }}
                            >
                                {activeSubtitleText}
                            </span>
                        </div>
                    )}

                    {/* Scanline Effect Overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,25,0)_0%,rgba(0,0,0,0.4)_100%)] z-20"></div>

                    {/* Hidden Audio Elements */}
                    {activeAudioClips.map(clip => {
                        const node = images.find(img => img.id === clip.nodeId && img.projectId === timelineData.projectId);
                        if (!node || !node.videoUrl) return null;
                        return (
                            <audio key={clip.id} ref={el => { if (el) audioRefs.current[clip.id] = el; }} src={node.videoUrl} preload="auto" />
                        );
                    })}
                </div>

                <div className="absolute top-10 left-12 flex items-center gap-4 z-30">
                    <div className="px-3 py-1 bg-black border border-white/10 rounded-sm font-mono text-cine-accent text-xs shadow-xl">
                        {formatTime(currentTime)}
                    </div>
                </div>
            </div>

            {/* Resize Handle - Draggable bar */}
            <div
                className="h-1 cursor-row-resize hover:bg-cine-accent/40 bg-transparent transition-colors z-50 flex items-center justify-center group/resizer"
                onMouseDown={startResizing}
            >
                <div className="w-12 h-[1px] bg-zinc-800 group-hover/resizer:bg-cine-accent/50 transition-colors"></div>
            </div>

            {/* Controls */}
            <div className="h-14 bg-[#0c0c0e] border-y border-zinc-800/50 flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-600"><SkipBack size={18} /></button>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-10 h-10 bg-cine-accent text-black flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(201,255,86,0.15)]"
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                        </button>
                        <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-600"><SkipForward size={18} /></button>
                    </div>
                    <div className="h-4 w-[1px] bg-zinc-800 mx-2"></div>
                    <div className="flex items-center gap-1">
                        <button
                            className={`p-2 transition-colors flex items-center gap-1 px-3 rounded-md ${selectedClip && currentTime > selectedClip.startTime && currentTime < (selectedClip.startTime + selectedClip.duration) ? 'text-cine-accent bg-cine-accent/10 hover:bg-cine-accent/20' : 'text-zinc-700 pointer-events-none'}`}
                            title="在指针处切割"
                            onClick={handleSplit}
                        >
                            <Scissors size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Split</span>
                        </button>

                        <button
                            className={`p-2 transition-colors flex items-center gap-1 px-3 rounded-md ${selectedClipIds.length > 0 ? 'text-zinc-400 hover:text-cine-accent hover:bg-white/5' : 'text-zinc-700 pointer-events-none'}`}
                            title="合并相邻片段"
                            onClick={handleMerge}
                        >
                            <Plus size={16} className="rotate-45" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Merge</span>
                        </button>

                        <div className="h-4 w-[1px] bg-zinc-800 mx-1"></div>

                        <button
                            className="p-2 hover:text-cine-accent transition-colors flex items-center gap-1 px-3 bg-white/5 rounded-md"
                            title="所有片段向左靠齐，消除间隙"
                            onClick={handleAlignLeft}
                        >
                            <AlignLeft size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Align Left</span>
                        </button>

                        <button
                            className="p-2 hover:text-cine-accent transition-colors flex items-center gap-1 px-3 bg-white/5 rounded-md"
                            onClick={() => setIsScriptWizardOpen(true)}
                        >
                            <Plus size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Script Wizard</span>
                        </button>

                        <button
                            className="p-2 hover:text-cine-accent transition-colors flex items-center gap-1 px-3 bg-cine-accent/10 rounded-md border border-cine-accent/20"
                            onClick={handleAutoSubtitle}
                            title="根据现有配音自动生成字幕"
                        >
                            <Type size={16} className="text-cine-accent" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cine-accent">Auto-Subtitle</span>
                        </button>

                        <button
                            className={`p-2 transition-all flex items-center gap-1 px-4 rounded-md border border-[#C9FF56]/30 bg-[#C9FF56]/10 text-[#C9FF56] hover:bg-[#C9FF56]/20 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={handleExportJianying}
                            disabled={isExporting}
                            title="导出剪映/CapCut可编辑工程包"
                        >
                            {isExporting ? (
                                <div className="w-4 h-4 border-2 border-[#C9FF56] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Download size={16} />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest ml-1">
                                {isExporting ? 'Packaging...' : 'Export to Jianying'}
                            </span>
                        </button>

                        <button
                            className={`p-2 transition-colors ${selectedClipIds.length > 0 ? 'text-red-500 hover:text-red-400' : 'text-zinc-700 pointer-events-none'}`}
                            onClick={() => {
                                if (selectedClipIds.length === 0) return;
                                const newTracks = timelineData.tracks.map(t => ({
                                    ...t,
                                    clips: t.clips.filter(c => !selectedClipIds.includes(c.id))
                                }));
                                onUpdateTimeline({ ...timelineData, tracks: newTracks });
                                setSelectedClipIds([]);
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        <Clock size={12} />
                        <span>Duration: {timelineData.totalDuration}s</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">Zoom</span>
                        <input type="range" min="10" max="200" value={zoom} onChange={(e) => setZoom(parseInt(e.target.value))} className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent" />
                    </div>
                </div>
            </div>

            {/* Timeline & Panels */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-[#09090b]">
                <div className="flex-1 flex flex-col overflow-hidden relative z-10 border-r border-zinc-900 shadow-2xl">
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        {/* Ruler */}
                        <div
                            className="h-8 border-b border-zinc-800/50 flex ml-[160px] relative overflow-hidden flex-shrink-0 cursor-ew-resize"
                            onMouseDown={startScrubbing}
                        >
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="absolute border-l border-zinc-800 h-full flex items-end pb-1" style={{ left: `${i * 5 * zoom}px` }}>
                                    <span className="text-[8px] font-mono text-zinc-600 ml-1 mb-1">{i * 5}s</span>
                                </div>
                            ))}
                        </div>
                        {/* Tracks Container */}
                        <div ref={timelineRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-w-0">
                            {/* Playhead */}
                            <div
                                className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-[100] pointer-events-none"
                                style={{
                                    left: `${160 + currentTime * zoom}px`,
                                    willChange: 'left',
                                    boxShadow: '0 0 15px rgba(220,38,38,0.4)'
                                }}
                            >
                                {/* Drag Handle (invisible larger hit area + visible head) */}
                                <div
                                    className="absolute -top-1 -left-[10px] w-5 h-8 cursor-ew-resize pointer-events-auto flex flex-col items-center group/playhead"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        startScrubbing(e);
                                    }}
                                >
                                    <div className="w-4 h-4 bg-red-600 rotate-45 mt-[-2px] border border-white/20 shadow-lg group-hover/playhead:scale-110 transition-transform"></div>
                                    <div className="w-1 h-3 bg-red-600 mt-[-6px] rounded-full border border-white/10 shadow-lg"></div>
                                </div>
                            </div>
                            {timelineData.tracks.map(track => (
                                <div key={track.id} className={`h-16 border-b border-zinc-800/30 flex group hover:bg-white/[0.02] ${track.isVisible === false ? 'opacity-40' : ''}`}>
                                    <div className="w-[160px] flex-shrink-0 border-r border-zinc-800 flex flex-col justify-center px-4 gap-1 bg-black/20">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="text-zinc-500 group-hover:text-cine-accent transition-colors">
                                                {track.type === 'video' && <Film size={14} />}
                                                {track.type === 'audio' && <Music size={14} />}
                                                {track.type === 'subtitle' && <Type size={14} />}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 truncate">{track.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onUpdateTimeline({ ...timelineData, tracks: timelineData.tracks.map(t => t.id === track.id ? { ...t, isVisible: !t.isVisible } : t) })} className={`p-1 rounded hover:bg-zinc-800 transition-colors ${track.isVisible === false ? 'text-zinc-700' : 'text-zinc-400'}`}>👀</button>
                                            <button onClick={() => onUpdateTimeline({ ...timelineData, tracks: timelineData.tracks.map(t => t.id === track.id ? { ...t, isMuted: !t.isMuted } : t) })} className={`p-1 rounded hover:bg-zinc-800 transition-colors ${track.isMuted ? 'text-red-500' : 'text-zinc-400'}`}>🔇</button>
                                            <button onClick={() => onUpdateTimeline({ ...timelineData, tracks: timelineData.tracks.map(t => t.id === track.id ? { ...t, isLocked: !t.isLocked } : t) })} className={`p-1 rounded hover:bg-zinc-800 transition-colors ${track.isLocked ? 'text-cine-accent' : 'text-zinc-400'}`}>🔒</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative bg-black/10 overflow-hidden"
                                        onClick={(e) => {
                                            // Handle timeline positioning only if not clicking a clip
                                            // We use onClick here instead of onMouseDown for tracks to allow 
                                            // onMouseDown to work cleanly on clips for dragging/resizing
                                            const rect = timelineRef.current?.getBoundingClientRect();
                                            if (rect) {
                                                const offsetX = e.clientX - rect.left - 160 + (timelineRef.current?.scrollLeft || 0);
                                                setCurrentTime(Math.max(0, offsetX / zoom));
                                                setSelectedClipIds([]);
                                            }
                                        }}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, track.id)}
                                    >
                                        {track.clips.map(clip => {
                                            const node = images.find(img => img.id === clip.nodeId && img.projectId === timelineData.projectId);
                                            return (
                                                <div key={clip.id} draggable={!isResizingClip}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation(); // Prevent track click logic
                                                    }}
                                                    onClick={(e) => handleClipClick(e, clip.id)}
                                                    onDragStart={(e) => {
                                                        if (isResizingClip) { e.preventDefault(); return; }
                                                        e.dataTransfer.setData('clipId', clip.id);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                    }}
                                                    className={`absolute top-1 h-14 rounded-sm overflow-hidden flex flex-col group/clip cursor-move z-20 shadow-lg border ${selectedClipIds.includes(clip.id) ? 'bg-cine-accent/20 border-cine-accent ring-1 ring-cine-accent/50' : 'bg-zinc-800/90 border-zinc-700 hover:border-zinc-500'}`}
                                                    style={{
                                                        left: `${clip.startTime * zoom}px`,
                                                        width: `${clip.duration * zoom}px`,
                                                        willChange: 'left, width'
                                                    }}>

                                                    {/* Left Resize Handle */}
                                                    <div
                                                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 hover:bg-white/30 transition-colors"
                                                        onMouseDown={(e) => startClipResize(e, clip.id, 'left')}
                                                    />
                                                    {/* Right Resize Handle */}
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 hover:bg-white/30 transition-colors"
                                                        onMouseDown={(e) => startClipResize(e, clip.id, 'right')}
                                                    />

                                                    {track.type === 'video' && node && (
                                                        <div className="flex h-full">
                                                            {node.url ? (
                                                                <img src={node.url} className="w-12 h-full object-cover opacity-50 contrast-125 grayscale" alt="" />
                                                            ) : (
                                                                <div className="w-12 h-full bg-zinc-800 flex items-center justify-center">
                                                                    <Film size={12} className="text-zinc-600" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 p-2 flex flex-col justify-between overflow-hidden">
                                                                <span className="text-[9px] font-bold text-zinc-400 truncate uppercase mt-0.5 tracking-tighter">{node.customLabel || 'Clip'}</span>
                                                                <div className="h-full bg-cine-accent/20 rounded-full w-full max-w-[40%] h-1 mt-1"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {track.type === 'subtitle' && (
                                                        <div className="flex items-center justify-center h-full px-2">
                                                            <span className="text-[9px] font-bold text-zinc-400 truncate text-center">{clip.customLabel || 'Subtitle'}</span>
                                                        </div>
                                                    )}
                                                    {track.type === 'audio' && (
                                                        <div className="flex items-center justify-center h-full">
                                                            <div className="flex h-4 items-end gap-[1px]">
                                                                {Array.from({ length: 8 }).map((_, i) => (
                                                                    <div key={i} className="w-[2px] bg-cine-accent/40" style={{ height: `${Math.random() * 100}%` }}></div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Asset Strip */}
                    <div className="h-20 bg-black border-t border-zinc-800 flex items-center p-3 gap-3 overflow-x-auto custom-scrollbar flex-shrink-0">
                        {videoNodes.map(node => (
                            <div key={node.id} className="w-28 h-14 flex-shrink-0 border border-zinc-800 rounded-sm overflow-hidden bg-zinc-900 group cursor-pointer hover:border-cine-accent transition-all relative" draggable onDragStart={(e) => e.dataTransfer.setData('nodeId', node.id)}>
                                {node.url ? (
                                    <img src={node.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                        <Film size={16} className="text-zinc-600" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-1">
                                    <span className="text-[7px] font-bold text-zinc-300 truncate uppercase tracking-tighter">{node.customLabel || 'Clip'}</span>
                                    <span className="text-[5px] text-zinc-500 font-mono">ID: {node.id.slice(-6)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Property Panel */}
                <div className="w-72 bg-[#0c0c0e] border-l border-zinc-800 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 bg-black/20 flex items-center gap-2">
                        <div className="w-1 h-3 bg-cine-accent rounded-full"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Clip Inspector</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        {selectedClip ? (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Time & Transform</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-bold text-zinc-500 uppercase">Start Time</label>
                                            <input type="number" step="0.1" value={selectedClip.startTime.toFixed(2)} onChange={(e) => updateClipProperty(selectedClipIds, { startTime: parseFloat(e.target.value) || 0 })} className="w-full bg-black border border-zinc-800 p-2 text-[10px] font-mono text-cine-accent rounded-sm outline-none" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-bold text-zinc-500 uppercase">Duration</label>
                                            <input type="number" step="0.1" value={selectedClip.duration.toFixed(2)} onChange={(e) => updateClipProperty(selectedClipIds, { duration: parseFloat(e.target.value) || 0 })} className="w-full bg-black border border-zinc-800 p-2 text-[10px] font-mono text-zinc-accent rounded-sm outline-none" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-6 border-t border-zinc-900">
                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Master Controls</h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[8px] font-bold uppercase text-zinc-500"><span>Opacity</span><span>{((selectedClip.opacity || 1) * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={selectedClip.opacity || 1} onChange={(e) => updateClipProperty(selectedClipIds, { opacity: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-900 appearance-none cursor-pointer accent-cine-accent" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[8px] font-bold uppercase text-zinc-500"><span>Volume</span><span>{((selectedClip.volume || 1) * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="2" step="0.05" value={selectedClip.volume || 1} onChange={(e) => updateClipProperty(selectedClipIds, { volume: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-900 appearance-none cursor-pointer accent-cine-accent" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4"><Scissors size={32} /><p className="text-[10px] font-black uppercase tracking-[0.2em]">Select a clip<br />to edit properties</p></div>
                        )}
                    </div>
                </div>
            </div>

            {/* Script Wizard Modal Overlay */}
            {isScriptWizardOpen && (
                <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-12">
                    <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cine-accent/20 rounded-lg"><Type size={18} className="text-cine-accent" /></div>
                                <div>
                                    <h3 className="text-sm font-black uppercase text-white">AI Script Wizard</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Automatic Dialogue Arrangement & Sync</p>
                                </div>
                            </div>
                            <button onClick={() => setIsScriptWizardOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-500"><Plus size={20} className="rotate-45" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex justify-between"><span>Dialogue Lines (One per line)</span><span className="text-cine-accent/50 italic">AI will auto-estimate timing</span></label>
                                <div className="relative group/prompt">
                                    <textarea className="w-full h-48 bg-black border border-zinc-800 rounded-lg p-4 text-xs font-medium focus:border-cine-accent/30 outline-none resize-none transition-all placeholder:text-zinc-800" placeholder="Enter your script here..." value={scriptInput} onChange={(e) => setScriptInput(e.target.value)} disabled={isProcessingScript} />
                                    <TranslateButton
                                        text={scriptInput}
                                        onTranslate={setScriptInput}
                                        className="absolute bottom-3 right-3 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                                    />
                                </div>
                            </div>
                            <button onClick={handleProcessScript} disabled={isProcessingScript || !scriptInput.trim()} className="w-full py-4 bg-cine-accent text-black font-black uppercase tracking-[0.3em] text-xs rounded-lg flex items-center justify-center gap-3">
                                {isProcessingScript ? <><div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div><span>Processing...</span></> : <><Play size={14} fill="currentColor" /><span>Generate & Arrange Timeline</span></>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
