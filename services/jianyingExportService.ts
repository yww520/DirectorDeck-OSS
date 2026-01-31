
import JSZip from 'jszip';
import { TimelineData, GeneratedImage, TimelineTrack, TimelineClip } from '../types';

/**
 * Service to export DirectorDeck timeline to Jianying (CapCut) draft format.
 */
export const jianyingExportService = {
    /**
     * Creates a ZIP package containing draft_content.json and all referenced assets.
     */
    async exportToJianying(timelineData: TimelineData, images: GeneratedImage[], projectName: string) {
        const zip = new JSZip();
        const assetsFolder = zip.folder("assets");

        // Tracking materials to avoid duplicates
        const materialMap = new Map<string, any>();
        const materials: any = {
            videos: [],
            audios: [],
            texts: []
        };

        // 1. Process Tracks & Segments
        const tracks: any[] = [];

        // Helper to convert seconds to microseconds
        const toUs = (sec: number) => Math.round(sec * 1000000);

        for (const track of timelineData.tracks) {
            const draftTrack: any = {
                id: crypto.randomUUID().toUpperCase(),
                type: track.type === 'subtitle' ? 'text' : track.type,
                segments: [],
                visible: track.isVisible !== false,
                freeze: track.isLocked === true,
                mute: track.isMuted === true
            };

            for (const clip of track.clips) {
                const node = images.find(img => img.id === clip.nodeId);
                if (!node) continue;

                const materialId = `material_${node.id}`;
                const segmentId = crypto.randomUUID().toUpperCase();

                // Build Segment
                const segment: any = {
                    id: segmentId,
                    material_id: materialId,
                    target_timerange: {
                        duration: toUs(clip.duration),
                        start: toUs(clip.startTime)
                    },
                    source_timerange: {
                        duration: toUs(clip.duration),
                        start: toUs(clip.trimStart)
                    },
                    extra_material_refs: []
                };

                // Build Material if not already added
                if (!materialMap.has(materialId)) {
                    const extension = node.nodeType === 'video' ? 'mp4' : 'jpg';
                    const filename = `${node.id}.${extension}`;

                    // Add to Material list
                    if (track.type === 'video') {
                        const videoMaterial = {
                            id: materialId,
                            type: node.nodeType === 'video' ? 'video' : 'photo',
                            path: `./assets/${filename}`, // Relative path hint
                            duration: toUs(node.motionConfig?.duration || 4),
                            width: 1920, // Default resolution
                            height: 1080
                        };
                        materials.videos.push(videoMaterial);
                    } else if (track.type === 'audio') {
                        const audioMaterial = {
                            id: materialId,
                            type: 'audio',
                            path: `./assets/${filename}`,
                            duration: toUs(clip.duration + clip.trimStart), // Full length of source if known
                        };
                        materials.audios.push(audioMaterial);
                    } else if (track.type === 'subtitle') {
                        // Text materials represent the content
                        const textMaterial = {
                            id: materialId,
                            content: clip.customLabel || node.dialogue || node.prompt || '',
                            type: 'text'
                        };
                        materials.texts.push(textMaterial);
                    }

                    materialMap.set(materialId, true);

                    // Fetch and add asset to ZIP (except for text)
                    if (track.type !== 'subtitle') {
                        try {
                            const url = node.videoUrl || node.url;
                            if (url) {
                                const response = await fetch(url);
                                const blob = await response.blob();
                                assetsFolder?.file(filename, blob);
                            }
                        } catch (e) {
                            console.error(`Failed to fetch asset for node ${node.id}:`, e);
                        }
                    }
                }

                draftTrack.segments.push(segment);
            }

            tracks.push(draftTrack);
        }

        // 2. Build draft_content.json
        const draftContent = {
            canvas_config: { height: 1080, width: 1920 },
            duration: toUs(timelineData.totalDuration),
            fps: 30,
            id: crypto.randomUUID().toUpperCase(),
            tracks: tracks,
            materials: materials,
            version: 6
        };

        zip.file("draft_content.json", JSON.stringify(draftContent, null, 2));

        // 3. Generate ZIP and trigger download
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectName}_jianying_draft.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
