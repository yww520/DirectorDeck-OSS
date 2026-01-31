/**
 * ProjectExportService - 项目导出/导入服务
 * 
 * 支持将完整项目打包为ZIP文件，或从ZIP恢复项目
 * 
 * @since 2026-01-13
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
    Project, Character, Location, StoryboardProject,
    GeneratedImage, TimelineData, AppSettings, CanvasSession
} from '../types';
import { videoBlobStorage } from './videoBlobStorage';

export interface ProjectExportData {
    /** 导出版本 */
    version: string;
    /** 导出时间 */
    exportedAt: number;
    /** 项目信息 */
    project: Project;
    /** 角色列表 */
    characters: Character[];
    /** 场景列表 */
    locations: Location[];
    /** 分镜项目列表 */
    storyboards: StoryboardProject[];
    /** 画布节点 */
    images: GeneratedImage[];
    /** 画布会话 */
    canvasSessions: CanvasSession[];
    /** 时间轴数据 */
    timeline?: TimelineData;
    /** 设置（可选） */
    settings?: Partial<AppSettings>;
}

export interface ExportOptions {
    /** 是否包含图片文件 */
    includeImages?: boolean;
    /** 是否包含视频文件 */
    includeVideos?: boolean;
    /** 是否包含设置 */
    includeSettings?: boolean;
    /** 图片质量 (0-1) */
    imageQuality?: number;
}

export interface ImportResult {
    success: boolean;
    data?: ProjectExportData;
    imageFiles?: Map<string, Blob>;
    videoFiles?: Map<string, Blob>;
    error?: string;
    warnings?: string[];
}

class ProjectExportService {
    private readonly EXPORT_VERSION = '1.0.0';

    /**
     * 导出项目为ZIP文件
     */
    async exportProject(
        data: ProjectExportData,
        options: ExportOptions = {}
    ): Promise<Blob> {
        const {
            includeImages = true,
            includeVideos = true,
            imageQuality = 0.9
        } = options;

        const zip = new JSZip();

        // 1. 添加项目元数据
        const metadata: ProjectExportData = {
            ...data,
            version: this.EXPORT_VERSION,
            exportedAt: Date.now()
        };

        zip.file('project.json', JSON.stringify(metadata, null, 2));

        // 2. 创建资源文件夹
        const imagesFolder = zip.folder('images');
        const videosFolder = zip.folder('videos');
        const charactersFolder = zip.folder('characters');
        const locationsFolder = zip.folder('locations');

        // 3. 导出角色图片
        if (includeImages && charactersFolder) {
            for (const character of data.characters) {
                for (const form of character.forms || []) {
                    if (form.frontViewUrl) {
                        try {
                            const blob = await this.fetchAsBlob(form.frontViewUrl);
                            if (blob) {
                                const filename = `${character.id}_${form.id}_front.png`;
                                charactersFolder.file(filename, blob);
                            }
                        } catch (e) {
                            console.warn(`[Export] Failed to export character image: ${form.frontViewUrl}`);
                        }
                    }
                    if (form.multiViewUrl) {
                        try {
                            const blob = await this.fetchAsBlob(form.multiViewUrl);
                            if (blob) {
                                const filename = `${character.id}_${form.id}_multi.png`;
                                charactersFolder.file(filename, blob);
                            }
                        } catch (e) {
                            console.warn(`[Export] Failed to export character multiview: ${form.multiViewUrl}`);
                        }
                    }
                }
            }
        }

        // 4. 导出场景图片
        if (includeImages && locationsFolder) {
            for (const location of data.locations) {
                for (const form of location.forms || []) {
                    if (form.url) {
                        try {
                            const blob = await this.fetchAsBlob(form.url);
                            if (blob) {
                                const filename = `${location.id}_${form.id}.png`;
                                locationsFolder.file(filename, blob);
                            }
                        } catch (e) {
                            console.warn(`[Export] Failed to export location image: ${form.url}`);
                        }
                    }
                }
            }
        }

        // 5. 导出生成的图片
        if (includeImages && imagesFolder) {
            for (const image of data.images) {
                if (image.url && !image.url.startsWith('blob:')) {
                    try {
                        const blob = await this.fetchAsBlob(image.url);
                        if (blob) {
                            const filename = `${image.id}.png`;
                            imagesFolder.file(filename, blob);
                        }
                    } catch (e) {
                        console.warn(`[Export] Failed to export image: ${image.url}`);
                    }
                }
            }
        }

        // 6. 导出视频文件
        if (includeVideos && videosFolder) {
            await videoBlobStorage.init();
            for (const image of data.images) {
                if (image.videoUrl || image.videoBlob) {
                    try {
                        let blob = image.videoBlob;
                        if (!blob) {
                            // 尝试从 IndexedDB 获取
                            blob = await videoBlobStorage.getVideoBlob(image.id) || undefined;
                        }
                        if (!blob && image.videoUrl && !image.videoUrl.startsWith('blob:')) {
                            blob = await this.fetchAsBlob(image.videoUrl) || undefined;
                        }
                        if (blob) {
                            const filename = `${image.id}.mp4`;
                            videosFolder.file(filename, blob);
                        }
                    } catch (e) {
                        console.warn(`[Export] Failed to export video: ${image.id}`);
                    }
                }
            }
        }

        // 7. 生成 ZIP 文件
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        console.log(`[Export] Project exported: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
        return zipBlob;
    }

    /**
     * 下载导出的项目
     */
    async downloadProject(
        data: ProjectExportData,
        options?: ExportOptions
    ): Promise<void> {
        const blob = await this.exportProject(data, options);
        const filename = `${data.project.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.zip`;
        saveAs(blob, filename);
    }

    /**
     * 从ZIP文件导入项目
     */
    async importProject(file: File): Promise<ImportResult> {
        const warnings: string[] = [];

        try {
            const zip = await JSZip.loadAsync(file);

            // 1. 读取项目元数据
            const projectJsonFile = zip.file('project.json');
            if (!projectJsonFile) {
                return {
                    success: false,
                    error: '无效的项目文件：缺少 project.json'
                };
            }

            const projectJsonText = await projectJsonFile.async('text');
            const projectData: ProjectExportData = JSON.parse(projectJsonText);

            // 2. 版本兼容性检查
            if (projectData.version !== this.EXPORT_VERSION) {
                warnings.push(`项目版本 (${projectData.version}) 与当前版本 (${this.EXPORT_VERSION}) 不同，可能存在兼容性问题`);
            }

            // 3. 读取图片文件
            const imageFiles = new Map<string, Blob>();
            const imagesFolder = zip.folder('images');
            if (imagesFolder) {
                const imageEntries = Object.entries(imagesFolder.files).filter(
                    ([path]) => path.startsWith('images/') && !path.endsWith('/')
                );
                for (const [path, zipEntry] of imageEntries) {
                    try {
                        const blob = await zipEntry.async('blob');
                        const filename = path.replace('images/', '');
                        imageFiles.set(filename, blob);
                    } catch (e) {
                        warnings.push(`无法读取图片: ${path}`);
                    }
                }
            }

            // 4. 读取角色图片
            const charactersFolder = zip.folder('characters');
            if (charactersFolder) {
                const charEntries = Object.entries(charactersFolder.files).filter(
                    ([path]) => path.startsWith('characters/') && !path.endsWith('/')
                );
                for (const [path, zipEntry] of charEntries) {
                    try {
                        const blob = await zipEntry.async('blob');
                        const filename = path.replace('characters/', '');
                        imageFiles.set(`characters/${filename}`, blob);
                    } catch (e) {
                        warnings.push(`无法读取角色图片: ${path}`);
                    }
                }
            }

            // 5. 读取场景图片
            const locationsFolder = zip.folder('locations');
            if (locationsFolder) {
                const locEntries = Object.entries(locationsFolder.files).filter(
                    ([path]) => path.startsWith('locations/') && !path.endsWith('/')
                );
                for (const [path, zipEntry] of locEntries) {
                    try {
                        const blob = await zipEntry.async('blob');
                        const filename = path.replace('locations/', '');
                        imageFiles.set(`locations/${filename}`, blob);
                    } catch (e) {
                        warnings.push(`无法读取场景图片: ${path}`);
                    }
                }
            }

            // 6. 读取视频文件
            const videoFiles = new Map<string, Blob>();
            const videosFolder = zip.folder('videos');
            if (videosFolder) {
                const videoEntries = Object.entries(videosFolder.files).filter(
                    ([path]) => path.startsWith('videos/') && !path.endsWith('/')
                );
                for (const [path, zipEntry] of videoEntries) {
                    try {
                        const blob = await zipEntry.async('blob');
                        const filename = path.replace('videos/', '');
                        videoFiles.set(filename, blob);
                    } catch (e) {
                        warnings.push(`无法读取视频: ${path}`);
                    }
                }
            }

            console.log(`[Import] Project imported: ${imageFiles.size} images, ${videoFiles.size} videos`);

            return {
                success: true,
                data: projectData,
                imageFiles,
                videoFiles,
                warnings: warnings.length > 0 ? warnings : undefined
            };

        } catch (error) {
            return {
                success: false,
                error: `导入失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * 从URL获取Blob
     */
    private async fetchAsBlob(url: string): Promise<Blob | null> {
        try {
            // 跳过 blob URL
            if (url.startsWith('blob:')) {
                return null;
            }

            // 处理 data URL
            if (url.startsWith('data:')) {
                const response = await fetch(url);
                return response.blob();
            }

            // 普通URL
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.blob();

        } catch (error) {
            console.warn(`[Export] Failed to fetch: ${url}`, error);
            return null;
        }
    }

    /**
     * 获取项目导出预览信息
     */
    getExportPreview(data: ProjectExportData): {
        totalItems: number;
        estimatedSize: string;
        breakdown: { label: string; count: number }[];
    } {
        const breakdown = [
            { label: '角色', count: data.characters.length },
            { label: '场景', count: data.locations.length },
            { label: '分镜', count: data.storyboards.reduce((sum, p) => sum + p.items.length, 0) },
            { label: '图片', count: data.images.length },
            { label: '视频', count: data.images.filter(i => i.videoUrl || i.videoBlob).length }
        ];

        const totalItems = breakdown.reduce((sum, item) => sum + item.count, 0);

        // 粗略估算大小
        const avgImageSize = 500; // KB
        const avgVideoSize = 5000; // KB
        const estimatedKB =
            data.images.length * avgImageSize +
            data.images.filter(i => i.videoUrl).length * avgVideoSize +
            100; // JSON overhead

        let estimatedSize = '';
        if (estimatedKB > 1024 * 1024) {
            estimatedSize = `约 ${(estimatedKB / 1024 / 1024).toFixed(1)} GB`;
        } else if (estimatedKB > 1024) {
            estimatedSize = `约 ${(estimatedKB / 1024).toFixed(1)} MB`;
        } else {
            estimatedSize = `约 ${estimatedKB.toFixed(0)} KB`;
        }

        return { totalItems, estimatedSize, breakdown };
    }
}

// 导出单例
export const projectExportService = new ProjectExportService();
export default projectExportService;
