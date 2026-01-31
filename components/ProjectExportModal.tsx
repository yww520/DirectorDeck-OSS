/**
 * ProjectExportModal - 项目导入导出模态框
 * 
 * 提供项目导出和导入的UI界面
 * 
 * @since 2026-01-13
 */

import React, { useState, useRef, memo, useCallback } from 'react';
import {
    Download, Upload, X, Package, FileArchive,
    CheckCircle, AlertCircle, Loader2, Image, Film,
    Users, MapPin, Clapperboard
} from 'lucide-react';
import {
    projectExportService,
    ProjectExportData,
    ExportOptions,
    ImportResult
} from '../services/projectExportService';

interface ProjectExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 导出模式所需的项目数据 */
    exportData?: ProjectExportData;
    /** 导入完成回调 */
    onImportComplete?: (result: ImportResult) => void;
}

const ProjectExportModal: React.FC<ProjectExportModalProps> = memo(({
    isOpen,
    onClose,
    exportData,
    onImportComplete
}) => {
    const [mode, setMode] = useState<'export' | 'import'>('export');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // 导出选项
    const [includeImages, setIncludeImages] = useState(true);
    const [includeVideos, setIncludeVideos] = useState(true);
    const [includeSettings, setIncludeSettings] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 获取导出预览
    const exportPreview = exportData
        ? projectExportService.getExportPreview(exportData)
        : null;

    // 处理导出
    const handleExport = useCallback(async () => {
        if (!exportData) return;

        setIsProcessing(true);
        setProgress(0);
        setResult(null);

        try {
            const options: ExportOptions = {
                includeImages,
                includeVideos,
                includeSettings
            };

            setProgress(30);
            await projectExportService.downloadProject(exportData, options);
            setProgress(100);

            setResult({
                success: true,
                message: '项目导出成功！文件已开始下载。'
            });

        } catch (error) {
            setResult({
                success: false,
                message: `导出失败: ${error instanceof Error ? error.message : String(error)}`
            });
        } finally {
            setIsProcessing(false);
        }
    }, [exportData, includeImages, includeVideos, includeSettings]);

    // 处理导入
    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setProgress(0);
        setResult(null);

        try {
            setProgress(30);
            const importResult = await projectExportService.importProject(file);
            setProgress(100);

            if (importResult.success) {
                setResult({
                    success: true,
                    message: `项目导入成功！${importResult.warnings?.length ? `(${importResult.warnings.length} 个警告)` : ''}`
                });
                onImportComplete?.(importResult);
            } else {
                setResult({
                    success: false,
                    message: importResult.error || '导入失败'
                });
            }

        } catch (error) {
            setResult({
                success: false,
                message: `导入失败: ${error instanceof Error ? error.message : String(error)}`
            });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [onImportComplete]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cine-accent/30 to-purple-500/30 flex items-center justify-center">
                            <Package size={20} className="text-cine-accent" />
                        </div>
                        <h2 className="text-lg font-bold text-white">项目管理</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Mode Tabs */}
                <div className="flex border-b border-zinc-800">
                    <button
                        onClick={() => setMode('export')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'export'
                                ? 'text-cine-accent border-b-2 border-cine-accent'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Download size={16} className="inline mr-2" />
                        导出项目
                    </button>
                    <button
                        onClick={() => setMode('import')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'import'
                                ? 'text-cine-accent border-b-2 border-cine-accent'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Upload size={16} className="inline mr-2" />
                        导入项目
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {mode === 'export' ? (
                        <>
                            {/* Export Preview */}
                            {exportPreview && (
                                <div className="p-4 bg-zinc-800/50 rounded-xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-400">项目内容</span>
                                        <span className="text-xs text-zinc-500">{exportPreview.estimatedSize}</span>
                                    </div>

                                    <div className="grid grid-cols-5 gap-3">
                                        {exportPreview.breakdown.map(item => (
                                            <div key={item.label} className="text-center">
                                                <div className="text-lg font-bold text-white">{item.count}</div>
                                                <div className="text-[10px] text-zinc-500 uppercase">{item.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Export Options */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">导出选项</h3>

                                <label className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-xl cursor-pointer hover:bg-zinc-800/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={includeImages}
                                        onChange={(e) => setIncludeImages(e.target.checked)}
                                        className="w-4 h-4 rounded accent-cine-accent"
                                    />
                                    <Image size={16} className="text-zinc-400" />
                                    <span className="text-sm text-zinc-300">包含图片文件</span>
                                </label>

                                <label className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-xl cursor-pointer hover:bg-zinc-800/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={includeVideos}
                                        onChange={(e) => setIncludeVideos(e.target.checked)}
                                        className="w-4 h-4 rounded accent-cine-accent"
                                    />
                                    <Film size={16} className="text-zinc-400" />
                                    <span className="text-sm text-zinc-300">包含视频文件</span>
                                </label>
                            </div>

                            {/* Export Button */}
                            <button
                                onClick={handleExport}
                                disabled={isProcessing || !exportData}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-cine-accent text-black font-bold rounded-xl hover:bg-cine-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        正在导出...
                                    </>
                                ) : (
                                    <>
                                        <FileArchive size={18} />
                                        导出为 ZIP
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Import Area */}
                            <label className="block p-8 border-2 border-dashed border-zinc-700 rounded-2xl text-center cursor-pointer hover:border-cine-accent/50 hover:bg-zinc-800/30 transition-all">
                                <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-2xl flex items-center justify-center">
                                    <Upload size={28} className="text-zinc-500" />
                                </div>
                                <p className="text-sm text-zinc-300 mb-2">点击上传或拖放项目文件</p>
                                <p className="text-xs text-zinc-600">支持 .zip 格式的项目备份文件</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".zip"
                                    onChange={handleImport}
                                    className="hidden"
                                    disabled={isProcessing}
                                />
                            </label>

                            {/* Import Progress */}
                            {isProcessing && (
                                <div className="flex items-center justify-center gap-3 py-4">
                                    <Loader2 size={20} className="animate-spin text-cine-accent" />
                                    <span className="text-sm text-zinc-400">正在导入...</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* Result Message */}
                    {result && (
                        <div className={`flex items-start gap-3 p-4 rounded-xl ${result.success
                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                : 'bg-rose-500/20 border border-rose-500/30'
                            }`}>
                            {result.success ? (
                                <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
                            )}
                            <p className={`text-sm ${result.success ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {result.message}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

ProjectExportModal.displayName = 'ProjectExportModal';

export { ProjectExportModal };
export default ProjectExportModal;
