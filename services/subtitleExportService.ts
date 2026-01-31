/**
 * SubtitleExportService - 字幕导出服务
 * 
 * 支持导出 SRT、VTT 等格式的字幕文件
 * 
 * @since 2026-01-13
 */

import { TimelineData, TimelineClip, GeneratedImage, StoryboardItem } from '../types';
import { saveAs } from 'file-saver';

export interface SubtitleEntry {
    /** 序号 */
    index: number;
    /** 开始时间 (秒) */
    startTime: number;
    /** 结束时间 (秒) */
    endTime: number;
    /** 字幕文本 */
    text: string;
    /** 角色名 (可选) */
    speaker?: string;
}

export interface SubtitleExportOptions {
    /** 导出格式 */
    format: 'srt' | 'vtt' | 'ass';
    /** 是否包含角色名 */
    includeSpeaker?: boolean;
    /** 角色名格式 */
    speakerFormat?: 'prefix' | 'line';
    /** 字体大小 (ASS) */
    fontSize?: number;
    /** 字体颜色 (ASS) */
    fontColor?: string;
}

class SubtitleExportService {
    /**
     * 从时间轴数据提取字幕
     */
    extractFromTimeline(
        timeline: TimelineData,
        images: GeneratedImage[]
    ): SubtitleEntry[] {
        const entries: SubtitleEntry[] = [];
        let index = 1;

        // 查找字幕轨道
        const subtitleTrack = timeline.tracks.find(t => t.type === 'subtitle');

        if (subtitleTrack) {
            for (const clip of subtitleTrack.clips) {
                const image = images.find(img => img.id === clip.nodeId);
                if (image?.dialogue) {
                    entries.push({
                        index: index++,
                        startTime: clip.startTime,
                        endTime: clip.startTime + clip.duration,
                        text: image.dialogue,
                        speaker: this.extractSpeaker(image)
                    });
                }
            }
        }

        // 如果没有专门的字幕轨道，从视频轨道提取
        if (entries.length === 0) {
            const videoTrack = timeline.tracks.find(t => t.type === 'video');
            if (videoTrack) {
                for (const clip of videoTrack.clips) {
                    const image = images.find(img => img.id === clip.nodeId);
                    if (image?.dialogue) {
                        entries.push({
                            index: index++,
                            startTime: clip.startTime,
                            endTime: clip.startTime + clip.duration,
                            text: image.dialogue,
                            speaker: this.extractSpeaker(image)
                        });
                    }
                }
            }
        }

        return entries.sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * 从分镜表提取字幕
     */
    extractFromStoryboard(
        items: StoryboardItem[],
        defaultDuration: number = 3
    ): SubtitleEntry[] {
        let currentTime = 0;

        return items
            .filter(item => item.dialogue && item.dialogue.trim())
            .map((item, idx) => {
                const entry: SubtitleEntry = {
                    index: idx + 1,
                    startTime: currentTime,
                    endTime: currentTime + defaultDuration,
                    text: item.dialogue.trim(),
                    speaker: item.characters.split(/[,，、]/)[0]?.trim()
                };
                currentTime += defaultDuration;
                return entry;
            });
    }

    /**
     * 导出为 SRT 格式
     */
    exportSRT(entries: SubtitleEntry[], options?: SubtitleExportOptions): string {
        const includeSpeaker = options?.includeSpeaker ?? true;
        const speakerFormat = options?.speakerFormat ?? 'prefix';

        return entries.map(entry => {
            const startTime = this.formatSRTTime(entry.startTime);
            const endTime = this.formatSRTTime(entry.endTime);

            let text = entry.text;
            if (includeSpeaker && entry.speaker) {
                if (speakerFormat === 'prefix') {
                    text = `[${entry.speaker}] ${text}`;
                } else {
                    text = `${entry.speaker}:\n${text}`;
                }
            }

            return `${entry.index}\n${startTime} --> ${endTime}\n${text}\n`;
        }).join('\n');
    }

    /**
     * 导出为 VTT 格式 (WebVTT)
     */
    exportVTT(entries: SubtitleEntry[], options?: SubtitleExportOptions): string {
        const includeSpeaker = options?.includeSpeaker ?? true;

        let vtt = 'WEBVTT\n\n';

        vtt += entries.map(entry => {
            const startTime = this.formatVTTTime(entry.startTime);
            const endTime = this.formatVTTTime(entry.endTime);

            let text = entry.text;
            if (includeSpeaker && entry.speaker) {
                text = `<v ${entry.speaker}>${text}`;
            }

            return `${entry.index}\n${startTime} --> ${endTime}\n${text}\n`;
        }).join('\n');

        return vtt;
    }

    /**
     * 导出为 ASS 格式 (Advanced SubStation Alpha)
     */
    exportASS(entries: SubtitleEntry[], options?: SubtitleExportOptions): string {
        const fontSize = options?.fontSize ?? 20;
        const fontColor = options?.fontColor ?? '&H00FFFFFF'; // 白色

        let ass = `[Script Info]
Title: DirectorDeck Export
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},${fontColor},&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        ass += entries.map(entry => {
            const startTime = this.formatASSTime(entry.startTime);
            const endTime = this.formatASSTime(entry.endTime);
            const speaker = entry.speaker || '';

            return `Dialogue: 0,${startTime},${endTime},Default,${speaker},0,0,0,,${entry.text}`;
        }).join('\n');

        return ass;
    }

    /**
     * 下载字幕文件
     */
    download(
        entries: SubtitleEntry[],
        filename: string,
        options: SubtitleExportOptions = { format: 'srt' }
    ): void {
        let content: string;
        let extension: string;
        let mimeType: string;

        switch (options.format) {
            case 'vtt':
                content = this.exportVTT(entries, options);
                extension = 'vtt';
                mimeType = 'text/vtt';
                break;
            case 'ass':
                content = this.exportASS(entries, options);
                extension = 'ass';
                mimeType = 'text/plain';
                break;
            case 'srt':
            default:
                content = this.exportSRT(entries, options);
                extension = 'srt';
                mimeType = 'text/plain';
                break;
        }

        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        saveAs(blob, `${filename}.${extension}`);
    }

    /**
     * 格式化 SRT 时间
     */
    private formatSRTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.round((seconds % 1) * 1000);

        return `${this.pad(hours, 2)}:${this.pad(minutes, 2)}:${this.pad(secs, 2)},${this.pad(ms, 3)}`;
    }

    /**
     * 格式化 VTT 时间
     */
    private formatVTTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.round((seconds % 1) * 1000);

        return `${this.pad(hours, 2)}:${this.pad(minutes, 2)}:${this.pad(secs, 2)}.${this.pad(ms, 3)}`;
    }

    /**
     * 格式化 ASS 时间
     */
    private formatASSTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return `${hours}:${this.pad(minutes, 2)}:${secs.toFixed(2).padStart(5, '0')}`;
    }

    /**
     * 数字补零
     */
    private pad(num: number, length: number): string {
        return num.toString().padStart(length, '0');
    }

    /**
     * 从图片数据提取说话者
     */
    private extractSpeaker(image: GeneratedImage): string | undefined {
        // 尝试从自定义标签提取
        if (image.customLabel) {
            const match = image.customLabel.match(/^([^:：]+)/);
            if (match) return match[1].trim();
        }

        // 尝试从提示词提取角色名
        if (image.prompt) {
            const match = image.prompt.match(/角色[：:]\s*([^,，\n]+)/);
            if (match) return match[1].trim();
        }

        return undefined;
    }
}

// 导出单例
export const subtitleExportService = new SubtitleExportService();
export default subtitleExportService;
