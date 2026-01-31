
import React, { useState } from 'react';
import { X, Camera, Sparkles, Loader2, Wand2, RefreshCw } from 'lucide-react';
import { generateQwenImageEdit } from '../services/geminiService';

interface QwenEditorProps {
    imageUrl: string;
    onClose: () => void;
    onComplete: (newImageUrl: string) => void;
    initialPrompt?: string;
}

export const QwenEditor: React.FC<QwenEditorProps> = ({ imageUrl, onClose, onComplete, initialPrompt = '' }) => {
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(imageUrl);

    const cameraPresets = [
        { label: '旋转视角 (Rotate 30°)', prompt: 'Rotate the camera 30 degrees clockwise while maintaining character consistency.' },
        { label: '俯拍 (High Angle)', prompt: 'Move the camera to a high angle, looking down at the character.' },
        { label: '特写 (Close-up)', prompt: 'Zoom in for a cinematic close-up of the character\'s face.' },
        { label: '广角 (Wide Shot)', prompt: 'Extend the view to a wide cinematic shot showing more environment.' },
        { label: '改变光影 (Cinematic Lighting)', prompt: 'Change the lighting to a dramatic high-contrast rim lighting.' }
    ];

    const handleEdit = async (customPrompt?: string) => {
        const finalPrompt = customPrompt || prompt;
        if (!finalPrompt.trim() || isProcessing) return;

        setIsProcessing(true);
        try {
            const result = await generateQwenImageEdit(imageUrl, finalPrompt);
            onComplete(result);
            setPreviewUrl(result);
        } catch (error: any) {
            console.error("Qwen Edit failed:", error);
            alert("Qwen 图像处理失败: " + (error.message || "未知错误"));
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-cine-accent/10 rounded-xl flex items-center justify-center border border-cine-accent/20">
                        <Camera className="text-cine-accent" size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-lg tracking-wider uppercase italic">Qwen 镜头操控 (Camera Control)</h2>
                        <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">AI-Powered Cinematic Image Editing</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 bg-white/5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all group/close">
                    <X size={28} className="group-hover/close:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-6 gap-8">
                {/* Preview Area */}
                <div className="flex-1 relative bg-black/40 border border-zinc-800 rounded-3xl overflow-hidden flex items-center justify-center p-8">
                    <div className="relative max-w-full max-h-full shadow-2xl">
                        <img
                            src={previewUrl}
                            alt="Current"
                            className="max-w-full max-h-[70vh] rounded-lg select-none"
                        />
                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-4">
                                <RefreshCw className="text-cine-accent animate-spin" size={48} />
                                <span className="text-cine-accent font-black uppercase tracking-[0.2em] animate-pulse">Processing Sequence...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info & Action Area */}
                <div className="w-full md:w-[400px] flex flex-col gap-6">
                    <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-[32px] p-8 space-y-8 custom-scrollbar overflow-y-auto">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex justify-between">
                                <span>操控指令 (Edit Instruction)</span>
                                <Wand2 size={12} className="text-cine-accent" />
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="例如: '将摄像机向右旋转30度' 或 '将画面改为角色面部细致特写'..."
                                className="w-full h-32 bg-black/60 border border-zinc-800 rounded-2xl p-6 text-[13px] text-zinc-300 focus:border-cine-accent outline-none transition-all placeholder:text-zinc-700 font-sans leading-relaxed resize-none custom-scrollbar shadow-inner"
                            />
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">快捷预设 (HOT PRESETS)</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {cameraPresets.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => { setPrompt(preset.prompt); handleEdit(preset.prompt); }}
                                        className="w-full px-4 py-3 bg-zinc-800/50 hover:bg-cine-accent hover:text-black border border-zinc-700 rounded-xl text-left text-[11px] font-bold transition-all flex items-center justify-between group"
                                    >
                                        <span>{preset.label}</span>
                                        <Camera size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-cine-accent/5 border border-cine-accent/10 rounded-2xl space-y-3">
                            <h4 className="text-[10px] font-bold text-cine-accent uppercase tracking-widest">Qwen 技术规格</h4>
                            <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                                支持人物面部强一致性保留，可直接通过语义指令调节机位坐标、焦距及环境氛围。
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-6 rounded-2xl bg-zinc-800 text-zinc-400 font-black uppercase tracking-[0.2em] hover:bg-zinc-700 transition-all active:scale-95"
                        >
                            取消退出
                        </button>
                        <button
                            onClick={() => handleEdit()}
                            disabled={isProcessing || !prompt.trim()}
                            className={`flex-[2] py-6 rounded-2xl flex items-center justify-center gap-4 text-sm font-black uppercase tracking-[0.3em] transition-all
                                ${prompt.trim() && !isProcessing
                                    ? 'bg-cine-accent text-black hover:scale-[1.02] shadow-2xl shadow-cine-accent/20 active:scale-95'
                                    : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                                }
                            `}
                        >
                            {isProcessing ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <Sparkles size={20} className="fill-black" />
                                    <span>执行操控</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
