import React, { useState, useRef, useEffect } from 'react';
import { X, Pencil, Eraser, Undo2, Trash2, Sparkles, Loader2, Wand2, Square, Circle } from 'lucide-react';
import { inpaintImage } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

interface InpaintEditorProps {
    imageUrl: string;
    onClose: () => void;
    onComplete: (newImageUrl: string) => void;
    initialPrompt?: string;
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
    isMultiview?: boolean;
}

export const InpaintEditor: React.FC<InpaintEditorProps> = ({
    imageUrl,
    onClose,
    onComplete,
    initialPrompt = '',
    aspectRatio = AspectRatio.WIDE,
    imageSize = ImageSize.K4,
    isMultiview = false
}) => {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [brushSize, setBrushSize] = useState(30);
    const [isErasing, setIsErasing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement>(null);
    const [tool, setTool] = useState<'brush' | 'square' | 'circle'>('brush');
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [tempCanvasData, setTempCanvasData] = useState<string | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize canvas with transparent black
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save initial state
        setHistory([canvas.toDataURL()]);
    }, []);

    const handleImageLoad = () => {
        const img = bgImageRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        // Match canvas size to image display size
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
        }
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        // Scale coordinates to actual canvas resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const { x, y } = getPos(e);
        setStartPos({ x, y });

        const canvas = canvasRef.current;
        if (canvas) {
            setTempCanvasData(canvas.toDataURL());
        }

        const ctx = canvas?.getContext('2d');
        if (ctx) {
            if (tool === 'brush') {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : 'white';
                ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
                ctx.lineWidth = brushSize;
            }
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const { x, y } = getPos(e);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        if (tool === 'brush') {
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            // Shape tools (Square/Circle) need to clear and redraw from the starting state
            const img = new Image();
            img.onload = () => {
                ctx.globalCompositeOperation = 'source-over';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : 'white';
                ctx.fillStyle = isErasing ? 'rgba(0,0,0,1)' : 'white';
                ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';

                if (tool === 'square') {
                    const width = x - startPos.x;
                    const height = y - startPos.y;
                    ctx.fillRect(startPos.x, startPos.y, width, height);
                } else if (tool === 'circle') {
                    const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
                    ctx.beginPath();
                    ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                    ctx.fill();
                }
            };
            if (tempCanvasData) img.src = tempCanvasData;
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const data = canvas.toDataURL();
            setHistory(prev => [...prev, data].slice(-20));
        }
    };

    const undo = () => {
        if (history.length <= 1) return;
        const newHistory = [...history];
        newHistory.pop();
        const prevState = newHistory[newHistory.length - 1];

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && prevState) {
            const img = new Image();
            img.onload = () => {
                ctx.globalCompositeOperation = 'source-over';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = prevState;
            setHistory(newHistory);
        }
    };

    const clearMask = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHistory([canvas.toDataURL()]);
        }
    };

    const handleInpaint = async () => {
        if (!prompt.trim() || isProcessing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Check if mask is empty
        const ctx = canvas.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        const hasMask = imageData?.data.some(v => v !== 0);

        if (!hasMask) {
            alert("请先涂抹需要重绘的区域");
            return;
        }

        setIsProcessing(true);
        try {
            // Create a mask with white background for masked area, black for others
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const mCtx = maskCanvas.getContext('2d');
            if (mCtx) {
                mCtx.fillStyle = 'black';
                mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                mCtx.drawImage(canvas, 0, 0);
            }

            const maskBase64 = maskCanvas.toDataURL('image/png');
            const result = await inpaintImage(imageUrl, maskBase64, prompt, undefined, aspectRatio, imageSize, isMultiview);
            onComplete(result);
        } catch (error) {
            console.error("Inpainting failed:", error);
            alert("局部重绘失败，请重试");
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
                        <Wand2 className="text-cine-accent" size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-lg tracking-wider uppercase italic">局部重绘 (Inpainting)</h2>
                        <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Select an area to modify with AI</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 bg-white/5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all group/close">
                    <X size={28} className="group-hover/close:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-6 gap-8">
                {/* Editor Area */}
                <div className="flex-1 relative bg-black/40 border border-zinc-800 rounded-3xl overflow-hidden flex items-center justify-center p-8 group">
                    <div className="relative max-w-full max-h-full shadow-2xl" id="editor-container">
                        <img
                            ref={bgImageRef}
                            src={imageUrl}
                            alt="Background"
                            className="max-w-full max-h-[70vh] rounded-lg select-none pointer-events-none"
                            onLoad={handleImageLoad}
                        />
                        <canvas
                            ref={canvasRef}
                            className={`absolute top-0 left-0 w-full h-full cursor-crosshair mix-blend-screen opacity-70 ${isDrawing ? 'scale-[1.002]' : ''} transition-transform`}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>

                    {/* Toolbar Overlay */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-2 rounded-2xl shadow-3xl">
                        <button
                            onClick={() => { setIsErasing(false); setTool('brush'); }}
                            className={`p-3 rounded-xl transition-all ${(!isErasing && tool === 'brush') ? 'bg-cine-accent text-black scale-110 shadow-lg shadow-cine-accent/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="画笔"
                        >
                            <Pencil size={20} />
                        </button>
                        <button
                            onClick={() => { setIsErasing(false); setTool('square'); }}
                            className={`p-3 rounded-xl transition-all ${(!isErasing && tool === 'square') ? 'bg-cine-accent text-black scale-110 shadow-lg shadow-cine-accent/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="方形框选"
                        >
                            <Square size={20} />
                        </button>
                        <button
                            onClick={() => { setIsErasing(false); setTool('circle'); }}
                            className={`p-3 rounded-xl transition-all ${(!isErasing && tool === 'circle') ? 'bg-cine-accent text-black scale-110 shadow-lg shadow-cine-accent/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="圆形框选"
                        >
                            <Circle size={20} />
                        </button>
                        <button
                            onClick={() => setIsErasing(true)}
                            className={`p-3 rounded-xl transition-all ${isErasing ? 'bg-cine-accent text-black scale-110 shadow-lg shadow-cine-accent/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="橡皮擦"
                        >
                            <Eraser size={20} />
                        </button>
                        <div className="w-[1px] h-8 bg-zinc-800 mx-2" />
                        <div className="flex items-center gap-3 px-3">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase">Size</span>
                            <input
                                type="range"
                                min="5"
                                max="100"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="w-32 accent-cine-accent"
                            />
                        </div>
                        <div className="w-[1px] h-8 bg-zinc-800 mx-2" />
                        <button
                            onClick={undo}
                            disabled={history.length <= 1}
                            className="p-3 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="撤销"
                        >
                            <Undo2 size={20} />
                        </button>
                        <button
                            onClick={clearMask}
                            className="p-3 text-zinc-500 hover:text-red-400 transition-all"
                            title="清空蒙版"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>

                {/* Info & Action Area */}
                <div className="w-full md:w-96 flex flex-col gap-6">
                    <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-[32px] p-8 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex justify-between">
                                <span>重绘指令 (Inpaint Prompt)</span>
                                <Sparkles size={12} className="text-cine-accent" />
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="描述你想在该区域看到的变化..."
                                className="w-full h-48 bg-black/60 border border-zinc-800 rounded-2xl p-6 text-[13px] text-zinc-300 focus:border-cine-accent outline-none transition-all placeholder:text-zinc-700 font-sans leading-relaxed resize-none custom-scrollbar shadow-inner"
                            />
                        </div>

                        <div className="p-6 bg-cine-accent/5 border border-cine-accent/10 rounded-2xl space-y-3">
                            <h4 className="text-[10px] font-bold text-cine-accent uppercase tracking-widest">使用技巧</h4>
                            <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                                涂抹遮罩后，在指令中详细描述你想要替换或新增的内容。AI 会参考周围纹理确保融合自然。
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-6 rounded-2xl bg-zinc-800 text-zinc-400 font-black uppercase tracking-[0.2em] hover:bg-zinc-700 transition-all active:scale-95"
                        >
                            取消退出 (EXIT)
                        </button>
                        <button
                            onClick={handleInpaint}
                            disabled={isProcessing || !prompt.trim()}
                            className={`flex-[2] py-6 rounded-2xl flex items-center justify-center gap-4 text-sm font-black uppercase tracking-[0.3em] transition-all
                                ${prompt.trim() && !isProcessing
                                    ? 'bg-cine-accent text-black hover:scale-[1.02] shadow-2xl shadow-cine-accent/20 active:scale-95'
                                    : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                                }
                            `}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>正在重绘...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} className="fill-black" />
                                    <span>开始重绘</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
