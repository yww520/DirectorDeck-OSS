import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, Sparkles, Image as ImageIcon, Trash2, Layers, Monitor, Workflow, MousePointer2, Send, FileText, ChevronRight, CheckCircle2, Layout, Upload, FileUp, X, Loader2, FileCode, Plus, Save, ChevronDown, User, FileImage, Download, Wand2, Users, LayoutGrid, Mic, Volume2 } from 'lucide-react';
import JSZip from 'jszip';
import { Character, CharacterForm, ArtStyle, AspectRatio, ImageSize, GeneratedImage } from '../types';
import { generateCharacterDesignPrompts, generateCharacterImage, parseDocumentToText, fileToBase64 } from '../services/geminiService';
import { TranslateButton } from './TranslateButton';
import { InpaintEditor } from './InpaintEditor';

interface CharacterLibraryProps {
    characters: Character[];
    activeProjectId: string;
    onUpdateCharacters: (chars: Character[]) => void;
    images?: GeneratedImage[];
}

const CharacterLibrary: React.FC<CharacterLibraryProps> = ({ characters, activeProjectId, onUpdateCharacters, images = [] }) => {
    // Left Chat/Dialog State
    const [newBio, setNewBio] = useState('');
    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
    const [parsingStep, setParsingStep] = useState<string | null>(null);
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isExtractingText, setIsExtractingText] = useState(false);

    const extractTextFromDocx = async (file: File): Promise<string> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const content = await zip.file("word/document.xml")?.async("string");
            if (!content) return "";
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, "text/xml");
            const textNodes = xmlDoc.getElementsByTagName("w:t");
            const textParts = [];
            for (let i = 0; i < textNodes.length; i++) {
                textParts.push(textNodes[i].textContent || "");
            }
            return textParts.join("");
        } catch (err) {
            console.error("DocX Parser Error:", err);
            return "解析文档文本失败，请尝试另存为标准 .docx 格式或直接粘贴。";
        }
    };

    // Right Canvas State
    const [isGeneratingImages, setIsGeneratingImages] = useState<string | null>(null);
    const [activeFormIds, setActiveFormIds] = useState<Record<string, string>>({});
    const [selectedStyle, setSelectedStyle] = useState<ArtStyle>(ArtStyle.CG_GAME_ART);
    const [scale, setScale] = useState(0.8);
    const [pan, setPan] = useState({ x: 50, y: 50 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [inpaintTarget, setInpaintTarget] = useState<{
        charId: string,
        formId: string,
        url: string,
        prompt: string,
        isMultiview?: boolean,
        aspectRatio?: AspectRatio,
        imageSize?: ImageSize
    } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // Sync selectedStyle with focused character
    useEffect(() => {
        if (selectedCharId) {
            const char = characters.find(c => c.id === selectedCharId);
            if (char?.preferredStyle) {
                setSelectedStyle(char.preferredStyle);
            }
        }
    }, [selectedCharId, characters]);

    const handleCreatePrompt = async () => {
        if (!newBio.trim()) {
            setParsingStep("❌ 请在文本框中输入内容");
            return;
        }

        setIsGeneratingPrompts(true);
        setParsingStep("🧠 AI 正在解析剧本脉络...");

        try {
            const extracted = await generateCharacterDesignPrompts(newBio);
            console.log("Extracted Data:", extracted);

            if (extracted && extracted.length > 0) {
                const newChars: Character[] = extracted.map((item, idx) => {
                    const charId = `char-${Date.now()}-${idx}`;
                    return {
                        id: charId,
                        projectId: activeProjectId,
                        name: item.characterName || "未命名角色",
                        bio: item.characterBio || (newBio.length > 100 ? newBio.slice(0, 100) + "..." : newBio),
                        forms: item.forms.map((f, fIdx) => ({
                            id: `form-${charId}-${fIdx}`,
                            formName: f.formName || "基础形态",
                            prompt: f.prompt || ""
                        })),
                        preferredStyle: selectedStyle
                    };
                });

                onUpdateCharacters([...characters, ...newChars]);

                if (newChars.length > 0) {
                    setSelectedCharId(newChars[0].id);
                    setActiveFormIds(prev => ({ ...prev, [newChars[0].id]: newChars[0].forms[0].id }));
                }

                setNewBio('');
                setParsingStep(`✅ 解析成功！发现 ${newChars.length} 个角色`);
            } else {
                setParsingStep("⚠️ 无法识别角色信息。请确保文本中有明确的名字或描写。");
            }
        } catch (error: any) {
            console.error("Critical Front-end Error:", error);
            setParsingStep(`❌ 系统错误: ${error.message || "请求超时"}`);
        } finally {
            setIsGeneratingPrompts(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
                const text = await file.text();
                setNewBio(text);
                setParsingStep("✅ 文档内容已读取");
            } else if (fileName.endsWith('.docx')) {
                setIsExtractingText(true);
                setParsingStep("📄 正在本地解析 Word 文档...");
                const text = await extractTextFromDocx(file);
                setNewBio(text);
                setIsExtractingText(false);
                setParsingStep("✅ Word 内容已识别，请检查后点击飞机图标提取角色");
            } else if (fileName.endsWith('.pdf') || fileName.match(/\.(png|jpg|jpeg)$/)) {
                setIsExtractingText(true);
                const isImage = fileName.match(/\.(png|jpg|jpeg)$/);
                setParsingStep(isImage ? "📸 正在识别图片内容..." : "📡 正在调用 AI 识别 PDF 内容...");
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const base64 = (reader.result as string).split(',')[1];
                        const text = await parseDocumentToText({
                            mimeType: isImage ? `image/${fileName.split('.').pop()}` : 'application/pdf',
                            data: base64
                        });
                        if (text && text.trim()) {
                            setNewBio(prev => prev ? prev + "\n" + text : text);
                            setParsingStep(isImage ? "✅ 图片识别成功" : "✅ PDF 识别成功，请检查后点击飞机图标提取角色");
                            setTimeout(() => setParsingStep(null), 3000);
                        } else {
                            throw new Error("未能从文件中提取到有效内容");
                        }
                    } catch (err: any) {
                        setParsingStep(`❌ 识别失败: ${err.message}`);
                    } finally {
                        setIsExtractingText(false);
                    }
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error(error);
            setIsExtractingText(false);
            setParsingStep("❌ 解析出错");
        } finally {
            e.target.value = '';
        }
    };

    const handleGenerateImage = async (charId: string, formId: string, view: 'front' | 'multiview') => {
        const char = characters.find(c => c.id === charId);
        const form = char?.forms.find(f => f.id === formId);

        if (!char || !form) return;

        setIsGeneratingImages(formId);

        try {
            const baseForm = char.forms[0];
            // Use user-uploaded reference image, or fall back to identity anchor
            const identityAnchor = char.referenceImageUrl || ((formId !== baseForm.id) ? baseForm.multiViewUrl : undefined);

            const url = await generateCharacterImage(
                form.prompt,
                view,
                char.preferredStyle || ArtStyle.KOREAN_WEBTOON,
                char.preferredAspectRatio || AspectRatio.PORTRAIT,
                char.preferredImageSize || ImageSize.K4,
                identityAnchor
            );

            onUpdateCharacters(characters.map(c => c.id === charId ? {
                ...c,
                forms: c.forms.map(f => f.id === formId ? (view === 'front' ? { ...f, frontViewUrl: url } : { ...f, multiViewUrl: url }) : f)
            } : c));
        } catch (error: any) {
            console.error("Generate Image Error:", error);
            alert(`生成失败: ${error.message || "未知错误"}`);
        } finally {
            setIsGeneratingImages(null);
        }
    };

    const handleDelete = (charId: string) => {
        onUpdateCharacters(characters.filter(c => c.id !== charId));
        if (selectedCharId === charId) setSelectedCharId(null);
    };

    // Canvas Handlers
    const onMouseDown = (e: React.MouseEvent) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-area')) {
            setIsDraggingCanvas(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingCanvas) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const onMouseUp = () => setIsDraggingCanvas(false);

    const onWheel = (e: React.WheelEvent) => {
        const zoomSensitivity = 0.001;
        const newScale = Math.min(Math.max(0.2, scale - e.deltaY * zoomSensitivity), 1.5);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const worldX = (mx - pan.x) / scale;
            const worldY = (my - pan.y) / scale;
            const newPanX = mx - worldX * newScale;
            const newPanY = my - worldY * newScale;
            setScale(newScale);
            setPan({ x: newPanX, y: newPanY });
        } else {
            setScale(newScale);
        }
    };

    const handleImportImage = (img: GeneratedImage) => {
        const charId = `registered-${Date.now()}`;
        const newChar: Character = {
            id: charId,
            projectId: activeProjectId,
            name: "新收录角色",
            bio: "从生成历史导入的人物设计",
            forms: [{
                id: `form-${charId}-0`,
                formName: "初始采样",
                prompt: img.prompt,
                frontViewUrl: img.url
            }],
            preferredStyle: undefined
        };
        onUpdateCharacters([...characters, newChar]);
        setIsImporting(false);
        setTimeout(() => setSelectedCharId(charId), 100);
    };

    const handleDownloadAllCharacters = async () => {
        if (characters.length === 0) return;

        setIsExtractingText(true); // Reusing state for loading feedback
        setParsingStep("📦 正在打包所有角色资产...");

        try {
            const zip = new JSZip();
            const charFolder = zip.folder("Character_Library");

            for (const char of characters) {
                const folder = charFolder?.folder(char.name.replace(/[<>:"/\\|?*]/g, '_'));

                // Add a text file with character info
                folder?.file("info.txt", `Name: ${char.name}\nBio: ${char.bio}\nPreferred Style: ${char.preferredStyle || 'Default'}`);

                for (const form of char.forms) {
                    if (form.frontViewUrl) {
                        try {
                            const response = await fetch(form.frontViewUrl);
                            const blob = await response.blob();
                            folder?.file(`${form.formName}_front.png`, blob);
                        } catch (err) {
                            console.error(`Failed to download front view for ${char.name} ${form.formName}`, err);
                        }
                    }
                    if (form.multiViewUrl) {
                        try {
                            const response = await fetch(form.multiViewUrl);
                            const blob = await response.blob();
                            folder?.file(`${form.formName}_multiview.png`, blob);
                        } catch (err) {
                            console.error(`Failed to download multi view for ${char.name} ${form.formName}`, err);
                        }
                    }
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Character_Bundle_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setParsingStep("✅ 打包下载完成！");
        } catch (error) {
            console.error("Bundle download failed:", error);
            setParsingStep("❌ 打包下载失败");
        } finally {
            setIsExtractingText(false);
        }
    };

    return (
        <div className="flex h-full bg-[#050505] text-zinc-100 relative">
            {/* Import Overlay */}
            {isImporting && (
                <div className="absolute inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <ImageIcon className="text-cine-accent" />
                            <h2 className="text-xl font-bold uppercase">从生成历史导入</h2>
                        </div>
                        <button onClick={() => setIsImporting(false)} className="p-2 hover:bg-zinc-800 rounded-full">
                            <X />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {images.filter(img => img.url).map(img => (
                                <div
                                    key={img.id}
                                    onClick={() => handleImportImage(img)}
                                    className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-cine-accent cursor-pointer group relative"
                                >
                                    <img src={img.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all group-hover:scale-105" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-all">
                                        <Plus className="text-white drop-shadow-lg" size={32} />
                                    </div>
                                </div>
                            ))}
                            {images.length === 0 && (
                                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl">
                                    <ImageIcon size={48} className="mb-4 opacity-20" />
                                    <p>图库暂无生成的图片内容</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT: Management Panel */}
            <aside className="w-[480px] border-r border-zinc-800 bg-cine-dark flex flex-col z-40 shadow-2xl overflow-hidden">
                {/* Panel Header */}
                <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-black/40">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cine-accent/10 rounded-2xl flex items-center justify-center border border-cine-accent/20">
                            <Monitor className="text-cine-accent" size={24} />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg tracking-wider uppercase italic">角色库设计中心</h2>
                            <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase opacity-60">Visual Anchor Consistency Lab</p>
                        </div>
                    </div>
                </div>

                {/* Secondary Header Actions */}
                <div className="px-8 pb-4 flex gap-3 pt-4">
                    <button
                        onClick={() => setIsImporting(true)}
                        className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:border-cine-accent/50 transition-all group"
                    >
                        <ImageIcon size={16} className="text-zinc-500 group-hover:text-cine-accent transition-colors" />
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">从画廊导入</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:border-cine-accent/50 transition-all group"
                    >
                        <Upload size={16} className="text-zinc-500 group-hover:text-cine-accent transition-colors" />
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">上传剧本提取</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Character Identification Status (Overlay when busy) */}
                    {parsingStep && (
                        <div className="px-8 pt-4">
                            <div className="bg-cine-accent/5 border border-cine-accent/20 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-3">
                                    {!parsingStep.includes('✅') && !parsingStep.includes('❌') && !parsingStep.includes('⚠️') && (
                                        <Loader2 className="animate-spin text-cine-accent" size={16} />
                                    )}
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${!parsingStep.includes('🧠') ? '' : 'animate-pulse text-cine-accent'}`}>
                                        {parsingStep}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setParsingStep(null)}
                                    className="p-1 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Chat / Manual Input Box */}
                    <div className="p-8 space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">角色视觉描述 / 剧本片段</span>
                        </div>

                        <div className="relative group/prompt">
                            <textarea
                                value={newBio}
                                onChange={(e) => setNewBio(e.target.value)}
                                onPaste={async (e) => {
                                    const items = Array.from(e.clipboardData.items);
                                    const item = items.find((i: any) => i.type.startsWith('image/')) as DataTransferItem | undefined;
                                    if (item) {
                                        const file = item.getAsFile();
                                        if (!file) return;

                                        setIsExtractingText(true);
                                        setParsingStep("📸 正在识别剪贴板图片...");
                                        try {
                                            const base64 = await fileToBase64(file);
                                            const text = await parseDocumentToText({ mimeType: file.type, data: base64 });
                                            if (text) {
                                                setNewBio(prev => prev ? prev + "\n" + text : text);
                                                setParsingStep("✅ 截图识别成功");
                                                setTimeout(() => setParsingStep(null), 3000);
                                            }
                                        } catch (err: any) {
                                            setParsingStep(`❌ 识别失败: ${err.message}`);
                                        } finally {
                                            setIsExtractingText(false);
                                        }
                                    }
                                }}
                                placeholder="在此录入剧本片段或角色性格描写，支持直接粘贴截图识别..."
                                className="w-full h-48 bg-black/40 border border-zinc-800/80 rounded-[32px] p-6 text-[12px] text-zinc-300 focus:border-cine-accent outline-none transition-all placeholder:text-zinc-700 font-sans leading-relaxed resize-none custom-scrollbar"
                            />
                            <TranslateButton
                                text={newBio}
                                onTranslate={setNewBio}
                                className="absolute bottom-6 left-1/2 -translate-x-12 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                            />

                            {/* Busy Status Over Textarea */}
                            {(isGeneratingPrompts || isExtractingText) && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-[32px] flex items-center justify-center pointer-events-none">
                                    <div className="bg-zinc-900/90 border border-white/5 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl scale-110">
                                        <Loader2 className="animate-spin text-cine-accent" size={20} />
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Processing...</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleCreatePrompt}
                                disabled={isGeneratingPrompts || isExtractingText || !newBio.trim()}
                                className={`absolute bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-2xl
                                    ${newBio.trim()
                                        ? 'bg-cine-accent text-black hover:scale-110 active:scale-95 shadow-cine-accent/30 hover:shadow-cine-accent/50'
                                        : 'bg-zinc-900 text-zinc-700 pointer-events-none'
                                    }
                                    ${isGeneratingPrompts ? 'animate-pulse' : ''}
                                `}
                            >
                                {isGeneratingPrompts ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">选择视觉风格</span>
                                <button
                                    onClick={() => {
                                        if (!newBio.trim()) return;
                                        const lines = newBio.split('\n').filter(l => l.trim());
                                        const name = lines[0].slice(0, 10).trim() || "新角色";
                                        const charId = `manual-${Date.now()}`;
                                        const newChar: Character = {
                                            id: charId,
                                            projectId: activeProjectId,
                                            name: name,
                                            bio: newBio,
                                            forms: [{ id: `f-${charId}`, formName: "基础形态", prompt: newBio }],
                                            preferredStyle: selectedStyle
                                        };
                                        onUpdateCharacters([...characters, newChar]);
                                        setSelectedCharId(charId);
                                        setActiveFormIds(prev => ({ ...prev, [charId]: newChar.forms[0].id }));
                                        setNewBio('');
                                    }}
                                    className="text-[9px] font-bold text-zinc-600 hover:text-cine-accent uppercase tracking-widest border border-zinc-900 px-2 py-0.5 rounded-md hover:border-cine-accent/30 transition-all font-mono"
                                >
                                    直接手动创建角色卡
                                </button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {Object.entries(ArtStyle).map(([key, value]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setSelectedStyle(value);
                                            if (selectedCharId) {
                                                onUpdateCharacters(characters.map(c => c.id === selectedCharId ? { ...c, preferredStyle: value } : c));
                                            }
                                        }}
                                        className={`relative group flex flex-col items-center gap-1 p-1 rounded-xl transition-all border-2 ${selectedStyle === value ? 'border-cine-accent bg-cine-accent/5' : 'border-transparent hover:bg-white/5'}`}
                                        title={value}
                                    >
                                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 relative">
                                            <img
                                                src={`/styles/${key}.png`}
                                                alt={value}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='20'%3E${value.slice(0, 1)}%3C/text%3E%3C/svg%3E`;
                                                    target.onerror = null;
                                                }}
                                            />
                                            {/* Hover Name Overlay */}
                                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2 text-center">
                                                <span className="text-[10px] font-black leading-tight text-white uppercase tracking-widest pointer-events-none">
                                                    {value}
                                                </span>
                                            </div>
                                        </div>
                                        {selectedStyle === value && (
                                            <div className="absolute top-1 right-1 w-3 h-3 bg-cine-accent rounded-full flex items-center justify-center shadow-lg">
                                                <CheckCircle2 size={8} className="text-black" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Identified Characters List */}
                    <div className="px-8 pb-12 space-y-5">
                        <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 italic">识别到的原型角色 ({characters.length})</span>
                        </div>

                        <div className="space-y-4">
                            {characters.map(char => (
                                <div
                                    key={char.id}
                                    onClick={() => setSelectedCharId(char.id)}
                                    className={`w-full p-5 rounded-[28px] border transition-all cursor-pointer group relative overflow-hidden
                                        ${selectedCharId === char.id
                                            ? 'bg-cine-accent/5 border-cine-accent/40 shadow-xl'
                                            : 'bg-zinc-900/20 border-zinc-800/40 hover:border-zinc-700'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors overflow-hidden ${selectedCharId === char.id ? 'bg-cine-accent text-black' : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700'}`}>
                                                {(char.forms[0]?.frontViewUrl || char.forms[0]?.multiViewUrl) ? (
                                                    <img src={char.forms[0].frontViewUrl || char.forms[0].multiViewUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserPlus size={16} />
                                                )}
                                            </div>
                                            <h3 className={`font-bold text-sm tracking-wide ${selectedCharId === char.id ? 'text-cine-accent' : 'text-white'}`}>
                                                {char.name}
                                            </h3>
                                        </div>
                                        <CheckCircle2 size={16} className={selectedCharId === char.id ? 'text-cine-accent' : 'text-zinc-900'} />
                                    </div>
                                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed italic ml-11">
                                        {char.bio}
                                    </p>

                                    <div className="mt-5 ml-11 flex flex-wrap gap-2">
                                        {char.forms.map((f, i) => (
                                            <div key={i} className="px-3 py-1 bg-black/60 border border-zinc-800 rounded-full text-[9px] font-bold font-mono text-zinc-400 group-hover:text-zinc-300 transition-colors uppercase tracking-wider">
                                                {f.formName}
                                            </div>
                                        ))}
                                    </div>

                                    {selectedCharId === char.id && (
                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-cine-accent" />
                                    )}
                                </div>
                            ))}

                            {characters.length === 0 && !isGeneratingPrompts && !isExtractingText && (
                                <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[32px] p-8 text-center bg-black/10">
                                    <FileCode className="text-zinc-900 mb-4" size={48} />
                                    <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest leading-relaxed">
                                        上传剧本或手动录入内容<br />点击飞机图标开始角色资产提取
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* RIGHT: Infinite Generation Canvas */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                {/* Canvas Header */}
                <div className="absolute top-8 left-8 z-30 flex items-center gap-6 bg-black/60 backdrop-blur-2xl border border-zinc-800/50 rounded-full px-6 py-3 shadow-3xl ring-1 ring-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cine-accent animate-pulse" />
                        <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Live Canvas</span>
                    </div>
                    <div className="w-[1px] h-4 bg-zinc-800" />
                    <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Scale: {Math.round(scale * 100)}%</span>
                    <button
                        onClick={() => { setScale(0.85); setPan({ x: 100, y: 100 }); }}
                        className="p-1 px-3 bg-zinc-900 rounded-md text-[9px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-widest border border-zinc-800"
                    >
                        Reset Viewport
                    </button>
                </div>

                {/* Bundle Download Button (Top Right) */}
                <div className="absolute top-8 right-8 z-30">
                    <button
                        onClick={handleDownloadAllCharacters}
                        disabled={characters.length === 0 || isExtractingText}
                        className={`group flex items-center gap-3 bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/50 rounded-full px-6 py-3 shadow-3xl ring-1 ring-white/5 hover:bg-zinc-800 hover:border-cine-accent/50 transition-all ${characters.length === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'active:scale-95'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-cine-accent/10 flex items-center justify-center border border-cine-accent/20 group-hover:bg-cine-accent/20 transition-all">
                            <Download size={16} className="text-cine-accent" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">一键打包角色库</span>
                            <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">Bundle All Assets (ZIP)</span>
                        </div>
                    </button>
                </div>

                {/* The Infinite Canvas */}
                <div
                    ref={containerRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onWheel={onWheel}
                    className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing canvas-area"
                >
                    {/* Pattern Background */}
                    <div className="absolute inset-0 pointer-events-none opacity-20 canvas-area"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)',
                            backgroundSize: `${40 * scale}px ${40 * scale}px`,
                            backgroundPosition: `${pan.x}px ${pan.y}px`
                        }}
                    />

                    {/* Transform Area */}
                    <div
                        className="absolute origin-top-left flex flex-col transition-transform duration-75 ease-out pointer-events-none"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                            width: 'fit-content'
                        }}
                    >
                        <div className="flex items-start gap-32 pl-40 pt-40 pr-40">
                            {characters.map(char => {
                                const activeFormId = activeFormIds[char.id] || char.forms[0]?.id;
                                const activeForm = char.forms.find(f => f.id === activeFormId) || char.forms[0];
                                const isFocused = selectedCharId === char.id;

                                return (
                                    <div
                                        key={char.id}
                                        className={`w-[1080px] shrink-0 bg-cine-dark border rounded-[48px] shadow-[0_60px_100px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-700 pointer-events-auto transition-all ring-1 ring-white/5
                                            ${isFocused ? 'border-cine-accent shadow-[0_50px_120px_rgba(201,255,86,0.15)] scale-100 z-10' : 'border-zinc-800/60 scale-[0.98] opacity-40 grayscale-[0.5]'}
                                        `}
                                        onMouseDown={(e) => { e.stopPropagation(); setSelectedCharId(char.id); }}
                                    >
                                        {/* Card Header */}
                                        <div className="p-10 border-b border-zinc-800/30 flex items-center justify-between bg-black/40">
                                            <div className="flex items-center gap-10">
                                                <div className="space-y-1">
                                                    <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">{char.name}</h3>
                                                    <div className="flex items-center gap-2 relative">
                                                        <span className="w-8 h-[1px] bg-cine-accent/50" />
                                                        <select
                                                            value={char.preferredStyle || ''}
                                                            onChange={(e) => {
                                                                const newStyle = e.target.value as ArtStyle;
                                                                onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, preferredStyle: newStyle } : c));
                                                            }}
                                                            className="bg-zinc-900/50 text-[10px] font-mono text-cine-accent tracking-widest uppercase outline-none border border-zinc-800 rounded px-2 py-0.5 cursor-pointer appearance-none"
                                                        >
                                                            {Object.values(ArtStyle).map(style => (
                                                                <option key={style} value={style} className="bg-zinc-900 text-zinc-300">{style}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="flex bg-black/80 p-1.5 rounded-full border border-zinc-800 shadow-2xl">
                                                    {char.forms.map(f => (
                                                        <button
                                                            key={f.id}
                                                            onClick={(e) => { e.stopPropagation(); setActiveFormIds(prev => ({ ...prev, [char.id]: f.id })); }}
                                                            className={`px-6 py-2.5 rounded-full text-[10px] font-black tracking-[0.2em] transition-all duration-500 uppercase ${activeFormId === f.id ? 'bg-cine-accent text-black shadow-lg shadow-cine-accent/20' : 'text-zinc-600 hover:text-white'}`}
                                                        >
                                                            {f.formName}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }} className="p-4 text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all">
                                                <Trash2 size={26} />
                                            </button>
                                        </div>

                                        {/* Main Render Section */}
                                        {activeForm && (
                                            <div className="p-12 grid grid-cols-12 gap-16 bg-gradient-to-br from-transparent to-black/40">
                                                <div className="col-span-4 space-y-12">
                                                    <div className="space-y-6">
                                                        <div className="flex items-center gap-3">
                                                            <Sparkles size={16} className="text-cine-accent" />
                                                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">视觉 DNA 锚点</span>
                                                        </div>
                                                        <div className="relative group/prompt">
                                                            <textarea
                                                                value={activeForm.prompt}
                                                                onChange={(e) => {
                                                                    const newPrompt = e.target.value;
                                                                    onUpdateCharacters(characters.map(c => c.id === char.id ? {
                                                                        ...c,
                                                                        forms: c.forms.map(f => f.id === activeForm.id ? { ...f, prompt: newPrompt } : f)
                                                                    } : c));
                                                                }}
                                                                className="w-full bg-black/20 text-zinc-300 text-[13px] leading-relaxed font-serif italic p-4 border border-zinc-800/50 rounded-xl outline-none transition-all resize-none h-48 custom-scrollbar"
                                                                placeholder="视觉提示词..."
                                                            />
                                                            <TranslateButton
                                                                text={activeForm.prompt}
                                                                onTranslate={(val) => {
                                                                    onUpdateCharacters(characters.map(c => c.id === char.id ? {
                                                                        ...c,
                                                                        forms: c.forms.map(f => f.id === activeForm.id ? { ...f, prompt: val } : f)
                                                                    } : c));
                                                                }}
                                                                className="absolute bottom-3 right-3 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 text-zinc-600">
                                                            <Layout size={14} />
                                                            <span className="text-[10px] font-bold uppercase tracking-widest">渲染与克隆设置 (DNA SETTINGS)</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-zinc-900/60 p-4 rounded-3xl border border-zinc-800/40">
                                                                <span className="text-[9px] text-zinc-700 block mb-1 uppercase">画幅比例</span>
                                                                <select
                                                                    value={char.preferredAspectRatio || AspectRatio.PORTRAIT}
                                                                    onChange={(e) => {
                                                                        const newAr = e.target.value as AspectRatio;
                                                                        onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, preferredAspectRatio: newAr } : c));
                                                                    }}
                                                                    className="bg-transparent text-xs text-zinc-500 font-mono outline-none w-full"
                                                                >
                                                                    {Object.values(AspectRatio).map(ar => (
                                                                        <option key={ar} value={ar} className="bg-zinc-900">{ar}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="bg-zinc-900/60 p-4 rounded-3xl border border-zinc-800/40">
                                                                <span className="text-[9px] text-zinc-700 block mb-1 uppercase">渲染尺寸</span>
                                                                <select
                                                                    value={char.preferredImageSize || ImageSize.K4}
                                                                    onChange={(e) => {
                                                                        const newSize = e.target.value as ImageSize;
                                                                        onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, preferredImageSize: newSize } : c));
                                                                    }}
                                                                    className="bg-transparent text-xs text-zinc-500 font-mono outline-none w-full"
                                                                >
                                                                    {Object.values(ImageSize).map(sz => (
                                                                        <option key={sz} value={sz} className="bg-zinc-900">{sz}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="bg-zinc-900/60 p-4 rounded-3xl border border-zinc-800/40 col-span-2">
                                                                <span className="text-[9px] text-zinc-700 block mb-2 uppercase">语音克隆参考 (VOICE ANCHOR)</span>
                                                                <div className="flex items-center gap-3">
                                                                    {char.voiceUrl ? (
                                                                        <div className="flex-1 flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-cine-accent/20">
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <Volume2 size={14} className="text-cine-accent shrink-0" />
                                                                                <span className="text-[10px] text-zinc-400 truncate">语音参考已加载</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, voiceUrl: undefined } : c))}
                                                                                className="text-zinc-600 hover:text-red-500 transition-colors"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                const input = document.createElement('input');
                                                                                input.type = 'file';
                                                                                input.accept = 'audio/*';
                                                                                input.onchange = (e) => {
                                                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                                                    if (file) {
                                                                                        const url = URL.createObjectURL(file);
                                                                                        onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, voiceUrl: url } : c));
                                                                                    }
                                                                                };
                                                                                input.click();
                                                                            }}
                                                                            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 border border-dashed border-zinc-700 rounded-xl py-2 px-3 transition-all text-zinc-500 hover:text-white group"
                                                                        >
                                                                            <Mic size={14} className="group-hover:text-cine-accent" />
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider">上传样本 (WAV/MP3)</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Visual Reference Image for Generation */}
                                                            <div className="bg-zinc-900/60 p-4 rounded-3xl border border-zinc-800/40 col-span-2">
                                                                <span className="text-[9px] text-zinc-700 block mb-2 uppercase">视觉风格参考 (VISUAL ANCHOR)</span>
                                                                <div className="flex items-center gap-3">
                                                                    {char.referenceImageUrl ? (
                                                                        <div className="flex-1 flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-cine-accent/20">
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <img src={char.referenceImageUrl} className="w-8 h-8 rounded object-cover" />
                                                                                <span className="text-[10px] text-zinc-400 truncate">参考图已上传</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, referenceImageUrl: undefined } : c))}
                                                                                className="text-zinc-600 hover:text-red-500 transition-colors"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                const input = document.createElement('input');
                                                                                input.type = 'file';
                                                                                input.accept = 'image/*';
                                                                                input.onchange = async (e) => {
                                                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                                                    if (file) {
                                                                                        const reader = new FileReader();
                                                                                        reader.onload = () => {
                                                                                            const dataUrl = reader.result as string;
                                                                                            onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, referenceImageUrl: dataUrl } : c));
                                                                                        };
                                                                                        reader.readAsDataURL(file);
                                                                                    }
                                                                                };
                                                                                input.click();
                                                                            }}
                                                                            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 border border-dashed border-zinc-700 rounded-xl py-2 px-3 transition-all text-zinc-500 hover:text-white group"
                                                                        >
                                                                            <FileImage size={14} className="group-hover:text-cine-accent" />
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider">上传参考图生图</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="col-span-8 h-[560px]">
                                                    <div className="h-full relative group border border-zinc-800/50 rounded-[40px] bg-zinc-950/90 overflow-hidden flex items-center justify-center shadow-inner">
                                                        {(activeForm.multiViewUrl || activeForm.frontViewUrl) ? (
                                                            <img src={activeForm.multiViewUrl || activeForm.frontViewUrl} className="w-full h-full object-contain p-8 group-hover:scale-105 transition-all duration-1000" alt="Character Reference" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-6 opacity-10">
                                                                <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
                                                                    <Workflow size={48} />
                                                                </div>
                                                                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-center px-10 leading-relaxed italic text-white/50">等待渲染角色全方位参考锚点</span>
                                                            </div>
                                                        )}

                                                        {activeForm.multiViewUrl && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const link = document.createElement('a');
                                                                    link.href = activeForm.multiViewUrl!;
                                                                    link.download = `${char.name}_Reference.png`;
                                                                    link.click();
                                                                }}
                                                                className="absolute top-6 right-8 p-3 bg-black/60 backdrop-blur-md rounded-2xl border border-zinc-800/50 text-cine-accent hover:bg-cine-accent hover:text-black transition-all"
                                                                title="下载参考图"
                                                            >
                                                                <Upload size={18} className="rotate-180" />
                                                            </button>
                                                        )}

                                                        {activeForm.multiViewUrl && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setInpaintTarget({
                                                                        charId: char.id,
                                                                        formId: activeForm.id,
                                                                        url: activeForm.multiViewUrl!,
                                                                        prompt: activeForm.prompt,
                                                                        isMultiview: true,
                                                                        aspectRatio: char.preferredAspectRatio || AspectRatio.WIDE,
                                                                        imageSize: char.preferredImageSize || ImageSize.K4
                                                                    });
                                                                }}
                                                                className="absolute top-6 right-24 p-3 bg-black/60 backdrop-blur-md rounded-2xl border border-zinc-800/50 text-cine-accent hover:bg-white hover:text-black transition-all"
                                                                title="局部重绘"
                                                            >
                                                                <Wand2 size={18} />
                                                            </button>
                                                        )}

                                                        <div className={`absolute inset-x-0 bottom-0 p-8 flex gap-3 transition-all duration-700 ${(activeForm.multiViewUrl || activeForm.frontViewUrl) ? 'translate-y-full group-hover:translate-y-0' : 'translate-y-0'}`}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleGenerateImage(char.id, activeForm.id, 'front'); }}
                                                                disabled={!!isGeneratingImages}
                                                                className="flex-1 bg-white text-black font-black py-5 rounded-[24px] text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
                                                            >
                                                                {isGeneratingImages === activeForm.id ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                                                                <span>渲染正面立绘</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleGenerateImage(char.id, activeForm.id, 'multiview'); }}
                                                                disabled={!!isGeneratingImages}
                                                                className="flex-[1.5] bg-cine-accent text-black font-black py-5 rounded-[24px] text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
                                                            >
                                                                {isGeneratingImages === activeForm.id ? <Loader2 size={14} className="animate-spin" /> : <LayoutGrid size={14} />}
                                                                <span>渲染全方位参考图</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {inpaintTarget && (
                    <InpaintEditor
                        imageUrl={inpaintTarget.url}
                        initialPrompt={inpaintTarget.prompt}
                        aspectRatio={inpaintTarget.aspectRatio}
                        imageSize={inpaintTarget.imageSize}
                        isMultiview={inpaintTarget.isMultiview}
                        onClose={() => setInpaintTarget(null)}
                        onComplete={(newUrl) => {
                            onUpdateCharacters(characters.map(c => c.id === inpaintTarget.charId ? {
                                ...c,
                                forms: c.forms.map(f => f.id === inpaintTarget.formId ? { ...f, [inpaintTarget.isMultiview ? 'multiViewUrl' : 'frontViewUrl']: newUrl } : f)
                            } : c));
                            setInpaintTarget(null);
                        }}
                    />
                )}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
                `
            }} />
        </div>
    );
};

export default CharacterLibrary;
