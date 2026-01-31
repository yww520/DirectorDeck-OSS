import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Sparkles, Image as ImageIcon, Trash2, Monitor, Workflow, MousePointer2, Send, FileText, ChevronRight, CheckCircle2, Layout, Upload, FileUp, X, Loader2, FileCode, Plus, Save, ChevronDown, FileImage, Mountain, Download, RefreshCw, Wand2 } from 'lucide-react';
import JSZip from 'jszip';
import { Location, LocationForm, ArtStyle, AspectRatio, ImageSize, GeneratedImage } from '../types';
import { generateLocationDesignPrompts, generateLocationImage, parseDocumentToText, generateMultiViewGrid, fileToBase64 } from '../services/geminiService';
import { TranslateButton } from './TranslateButton';
import { InpaintEditor } from './InpaintEditor';

const VIEW_PRESETS = [
    { label: '俯视图', prompt: 'CAMERA VIEW: [Extreme High Angle / Top-down / Bird eye view]. Looking down at the room from the ceiling.' },
    { label: '仰视图', prompt: 'CAMERA VIEW: [Extreme Low Angle / Worms eye view]. Looking up from the floor level.' },
    { label: '侧视图', prompt: 'CAMERA VIEW: [Side profile perspective / Lateral view]. Showing the room from a completely different side wall.' },
    { label: '特写', prompt: 'CAMERA VIEW: [Extreme Close-up / Macro view / Zoomed in]. Focus on a specific small object or texture within the scene.' },
    { label: '全景', prompt: 'CAMERA VIEW: [Super Wide Angle / Panoramic / Establishing Shot]. Capturing the entire environment from a distance.' },
    { label: 'FPV 视角', prompt: 'CAMERA VIEW: [First Person View / FPV / Action Cam]. Immersion perspective as if seeing through someone\'s eyes.' },
    { label: '360° 环绕', prompt: 'CAMERA VIEW: [360 Degree View / Panoramic Orbit]. A wide circular perspective of the entire space.' }
];

interface LocationLibraryProps {
    locations: Location[];
    activeProjectId: string;
    onUpdateLocations: (locs: Location[]) => void;
    images?: GeneratedImage[];
}

const LocationLibrary: React.FC<LocationLibraryProps> = ({ locations, activeProjectId, onUpdateLocations, images = [] }) => {
    // Left Chat/Dialog State
    const [newBio, setNewBio] = useState('');
    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
    const [parsingStep, setParsingStep] = useState<string | null>(null);
    const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
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
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
    const [scale, setScale] = useState(0.8);
    const [pan, setPan] = useState({ x: 50, y: 50 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [inpaintTarget, setInpaintTarget] = useState<{ locId: string, formId: string, url: string, prompt: string } | null>(null);
    const [showPresetsForLoc, setShowPresetsForLoc] = useState<string | null>(null);
    const [editingFormId, setEditingFormId] = useState<string | null>(null);
    const [tempFormName, setTempFormName] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [showMultiViewMenu, setShowMultiViewMenu] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // Sync selectedStyle with focused location
    useEffect(() => {
        if (selectedLocId) {
            const loc = locations.find(l => l.id === selectedLocId);
            if (loc?.preferredStyle) {
                setSelectedStyle(loc.preferredStyle);
            }
        }
    }, [selectedLocId, locations]);

    const handleCreatePrompt = async () => {
        if (!newBio.trim()) {
            setParsingStep("❌ 请在文本框中输入场景描述");
            setTimeout(() => setParsingStep(null), 2000);
            return;
        }

        setIsGeneratingPrompts(true);
        setParsingStep("🧠 AI 正在提取剧本场景信息...");

        try {
            const extracted = await generateLocationDesignPrompts(newBio);
            console.log("Extracted Location Data:", extracted);

            if (extracted && extracted.length > 0) {
                const newLocs: Location[] = extracted.map((item, idx) => {
                    const locId = `loc-${Date.now()}-${idx}`;
                    return {
                        id: locId,
                        projectId: activeProjectId,
                        name: item.name || "未命名场景",
                        description: item.description || (newBio.length > 100 ? newBio.slice(0, 100) + "..." : newBio),
                        forms: item.forms.map((f, fIdx) => ({
                            id: `lform-${locId}-${fIdx}`,
                            formName: f.formName || "基础预览",
                            prompt: f.prompt || ""
                        })),
                        preferredStyle: selectedStyle,
                        preferredAspectRatio: selectedAspectRatio
                    };
                });

                onUpdateLocations([...locations, ...newLocs]);

                if (newLocs.length > 0) {
                    setSelectedLocId(newLocs[0].id);
                    setActiveFormIds(prev => ({ ...prev, [newLocs[0].id]: newLocs[0].forms[0].id }));
                }

                setNewBio('');
                setParsingStep(`✅ 解析成功！发现 ${newLocs.length} 个场景`);
                setTimeout(() => setParsingStep(null), 2000);
            } else {
                setParsingStep("⚠️ 无法识别场景信息。请确保文本中有明确的场景描写。");
                setTimeout(() => setParsingStep(null), 4000);
            }
        } catch (error: any) {
            console.error("Critical Front-end Error:", error);
            setParsingStep(`❌ 系统错误: ${error.message || "请求超时"} `);
            setTimeout(() => setParsingStep(null), 5000);
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
                setParsingStep("✅ 剧本内容已读取");
                setTimeout(() => setParsingStep(null), 2000);
            } else if (fileName.endsWith('.docx')) {
                setIsExtractingText(true);
                setParsingStep("📄 正在本地解析 Word 文档...");
                const text = await extractTextFromDocx(file);
                setNewBio(text);
                setIsExtractingText(false);
                setParsingStep("✅ Word 内容已识别，请检查后点击飞机图标提取场景");
                setTimeout(() => setParsingStep(null), 3000);
            } else if (fileName.endsWith('.pdf') || fileName.match(/\.(png|jpg|jpeg)$/)) {
                setIsExtractingText(true);
                const isImage = fileName.match(/\.(png|jpg|jpeg)$/);
                setParsingStep(isImage ? "📸 正在识别场景图片..." : "📡 正在调用 AI 识别 PDF 剧本...");
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const base64 = (reader.result as string).split(',')[1];
                        const text = await parseDocumentToText({
                            mimeType: isImage ? `image/${fileName.split('.').pop()}` : 'application/pdf',
                            data: base64
                        });
                        if (!text || !text.trim()) {
                            throw new Error("未能从文件中提取到有效内容");
                        }
                        setNewBio(prev => prev ? prev + "\n" + text : text);
                        setParsingStep(isImage ? "✅ 图片识别成功" : "✅ PDF 识别成功，请检查后点击飞机图标提取场景");
                        setTimeout(() => setParsingStep(null), 3000);
                    } catch (err: any) {
                        setParsingStep(`❌ 识别失败: ${err.message} `);
                        setTimeout(() => setParsingStep(null), 4000);
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
            setTimeout(() => setParsingStep(null), 3000);
        } finally {
            e.target.value = '';
        }
    };

    const handleGenerateImage = async (locId: string, formId: string) => {
        const loc = locations.find(l => l.id === locId);
        const form = loc?.forms.find(f => f.id === formId);
        if (!loc || !form) return;
        setIsGeneratingImages(formId);
        try {
            // Use user-uploaded reference image, or fall back to base form's generated image
            let refImg = loc.referenceImageUrl;
            if (!refImg) {
                const baseForm = loc.forms[0];
                if (baseForm.id !== formId && baseForm.url) {
                    refImg = baseForm.url;
                }
            }

            const url = await generateLocationImage(
                form.prompt,
                loc.preferredStyle || ArtStyle.KOREAN_WEBTOON,
                loc.preferredAspectRatio || AspectRatio.WIDE,
                ImageSize.K4,
                refImg
            );
            onUpdateLocations(locations.map(l => l.id === locId ? {
                ...l,
                forms: l.forms.map(f => f.id === formId ? { ...f, url: url } : f)
            } : l));
        } catch (error) {
            console.error(error);
        } finally {
            setIsGeneratingImages(null);
        }
    };

    const handleGenerateMultiView = async (locId: string, viewType: 'default' | 'fpv' | '360' = 'default') => {
        const loc = locations.find(l => l.id === locId);
        if (!loc) return;
        setIsGeneratingImages(`multi-${locId}`);
        setShowMultiViewMenu(null);
        try {
            // Find the form that is currently active or use the first one as source of truth
            const activeId = activeFormIds[locId] || loc.forms[0].id;
            const activeForm = loc.forms.find(f => f.id === activeId) || loc.forms[0];
            const basePrompt = activeForm.prompt;

            const result = await generateMultiViewGrid(
                basePrompt,
                2, 2, // 2x2 Grid
                loc.preferredAspectRatio || AspectRatio.WIDE,
                ImageSize.K4,
                [],
                activeForm.url, // Use existing image as visual anchor
                loc.preferredStyle || ArtStyle.KOREAN_WEBTOON,
                viewType === 'default' ? undefined : viewType,
                true // isLocation = true
            );

            const newForms: LocationForm[] = result.slices.map((url, i) => ({
                id: `lform-${locId}-multi-${Date.now()}-${i}`,
                formName: `视角 ${loc.forms.length + i + 1}`,
                prompt: `视角 ${i + 1} - ${basePrompt}`,
                url: url
            }));

            const gridForm: LocationForm = {
                id: `lform-${locId}-grid-${Date.now()}`,
                formName: "多视角全景表",
                prompt: basePrompt,
                url: result.fullImage
            };

            onUpdateLocations(locations.map(l => l.id === locId ? {
                ...l,
                forms: [...l.forms, gridForm, ...newForms]
            } : l));

            setActiveFormIds(prev => ({ ...prev, [locId]: gridForm.id }));
        } catch (error) {
            console.error(error);
        } finally {
            setIsGeneratingImages(null);
        }
    };

    const handleAddNewForm = (locId: string, label?: string, promptSuffix?: string) => {
        const loc = locations.find(l => l.id === locId);
        if (!loc) return;

        const newFormId = `lform-${locId}-${Date.now()}`;
        const newForm: LocationForm = {
            id: newFormId,
            formName: label || `新视角 ${loc.forms.length + 1}`,
            prompt: promptSuffix ? `${promptSuffix}\nLOCATION BASE: ${loc.forms[0].prompt}` : loc.forms[0].prompt
        };

        onUpdateLocations(locations.map(l => l.id === locId ? {
            ...l,
            forms: [...l.forms, newForm]
        } : l));

        setActiveFormIds(prev => ({ ...prev, [locId]: newFormId }));
        setShowPresetsForLoc(null);
    };

    const handleDeleteForm = (locId: string, formId: string) => {
        const loc = locations.find(l => l.id === locId);
        if (!loc || loc.forms.length <= 1) return;

        const newForms = loc.forms.filter(f => f.id !== formId);
        onUpdateLocations(locations.map(l => l.id === locId ? { ...l, forms: newForms } : l));

        if (activeFormIds[locId] === formId) {
            setActiveFormIds(prev => ({ ...prev, [locId]: newForms[0].id }));
        }
    };

    const handleStartRename = (form: LocationForm) => {
        setEditingFormId(form.id);
        setTempFormName(form.formName);
    };

    const handleSaveRename = (locId: string, formId: string) => {
        if (!tempFormName.trim()) {
            setEditingFormId(null);
            return;
        }
        onUpdateLocations(locations.map(l => l.id === locId ? {
            ...l,
            forms: l.forms.map(f => f.id === formId ? { ...f, formName: tempFormName.trim() } : f)
        } : l));
        setEditingFormId(null);
    };

    const handleDelete = (locId: string) => {
        onUpdateLocations(locations.filter(l => l.id !== locId));
        if (selectedLocId === locId) setSelectedLocId(null);
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
        const locId = `regloc - ${Date.now()} `;
        const newLoc: Location = {
            id: locId,
            projectId: activeProjectId,
            name: "新收录场景",
            description: "从生成历史导入的场景设计",
            forms: [{
                id: `lform - ${locId} -0`,
                formName: "初始采样",
                prompt: img.prompt,
                url: img.url
            }],
            preferredStyle: undefined
        };
        onUpdateLocations([...locations, newLoc]);
        setIsImporting(false);
        setTimeout(() => setSelectedLocId(locId), 100);
    };

    const handleDownloadAll = async () => {
        if (locations.length === 0) return;
        setIsDownloading(true);
        try {
            const zip = new JSZip();
            const rootFolder = zip.folder("Scene_Library_Assets");

            let hasImages = false;
            for (const loc of locations) {
                const locFolderName = loc.name.replace(/[<>:"/\\|?*]/g, '_') || loc.id;
                const locFolder = rootFolder?.folder(locFolderName);

                for (const form of loc.forms) {
                    if (form.url) {
                        hasImages = true;
                        try {
                            const fileName = `${form.formName.replace(/[<>:"/\\|?*]/g, '_')}.png`;
                            if (form.url.startsWith('data:')) {
                                const base64Data = form.url.split(',')[1];
                                locFolder?.file(fileName, base64Data, { base64: true });
                            } else {
                                const response = await fetch(form.url);
                                const blob = await response.blob();
                                locFolder?.file(fileName, blob);
                            }
                        } catch (err) {
                            console.error(`Failed to download image for ${loc.name} - ${form.formName}:`, err);
                        }
                    }
                }
            }

            if (!hasImages) {
                alert("没有可下载的场景图片");
                setIsDownloading(false);
                return;
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Scene_Library_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Zipping failed:", error);
            alert("打包下载失败");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex h-full bg-[#050505] text-zinc-100 relative">
            {/* Import Overlay */}
            {isImporting && (
                <div className="absolute inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <ImageIcon className="text-blue-500" />
                            <h2 className="text-xl font-bold uppercase">从画廊收录场景</h2>
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
                                    className="aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-cine-accent cursor-pointer group relative"
                                >
                                    <img src={img.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all group-hover:scale-105" alt="Imported Scene" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-all">
                                        <Plus className="text-white drop-shadow-lg" size={32} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT: Management Panel */}
            <aside className="w-[480px] border-r border-zinc-800 bg-cine-dark flex flex-col z-40 shadow-2xl overflow-hidden">
                {/* Fixed Header */}
                <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-black/40 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cine-accent/10 rounded-2xl flex items-center justify-center border border-cine-accent/20">
                            <Mountain className="text-cine-accent" size={24} />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg tracking-wider uppercase italic">环境场景资产库</h2>
                            <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase opacity-60">Visual Anchor Consistency Lab</p>
                        </div>
                    </div>
                </div>

                {/* Fixed Actions Area */}
                <div className="px-8 pb-4 flex gap-3 mt-4 border-b border-zinc-900/50 shrink-0">
                    <button onClick={() => setIsImporting(true)} className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all group">
                        <ImageIcon size={16} className="text-zinc-500 group-hover:text-cine-accent" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">从画廊导入</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all group">
                        <Upload size={16} className="text-zinc-500 group-hover:text-cine-accent" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">上传剧本提取</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg" />
                </div>

                {/* MAIN SCROLLABLE AREA - ONE SINGLE CONTAINER */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Identification Status */}
                    {parsingStep && (
                        <div className="px-8 pt-4">
                            <div className="bg-cine-accent/5 border border-cine-accent/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
                                {parsingStep.includes('❌') ? <AlertCircle className="text-red-500" size={16} /> : parsingStep.includes('✅') ? <CheckCircle2 className="text-green-500" size={16} /> : <Loader2 className="animate-spin text-cine-accent" size={16} />}
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${parsingStep.includes('❌') ? 'text-red-500' : 'text-cine-accent'} `}>{parsingStep}</span>
                            </div>
                        </div>
                    )}

                    {/* Input & Settings Area */}
                    <div className="p-8 space-y-8">
                        {/* Textarea Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">场景内容描写</span>
                            </div>
                            <div className="relative group/prompt">
                                <textarea
                                    value={newBio}
                                    onChange={(e) => setNewBio(e.target.value)}
                                    placeholder="输入场景描写，提取视觉资产..."
                                    className="w-full h-48 bg-black/40 border border-zinc-800/80 rounded-[32px] p-6 text-[12px] text-zinc-300 focus:border-cine-accent outline-none transition-all placeholder:text-zinc-700 leading-relaxed resize-none custom-scrollbar"
                                />
                                <span className="absolute bottom-6 right-24 text-[10px] text-zinc-600 font-mono">{newBio.length}/2000</span>
                                <TranslateButton
                                    text={newBio}
                                    onTranslate={(val) => setNewBio(val)}
                                    className="absolute bottom-6 right-44 opacity-0 group-hover/prompt:opacity-100 transition-all scale-90"
                                />
                                <button
                                    onClick={handleCreatePrompt}
                                    disabled={isGeneratingPrompts || isExtractingText || !newBio.trim()}
                                    className={`absolute bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-2xl
                                        ${newBio.trim() ? 'bg-cine-accent text-black scale-100' : 'bg-zinc-900 text-zinc-700 scale-95 opacity-50'}
                                    `}
                                >
                                    {isGeneratingPrompts ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                </button>
                            </div>
                        </div>

                        {/* Aspect Ratio & Style Presets */}
                        <div className="space-y-6 pt-2 border-t border-zinc-900/50">
                            <div className="space-y-3 pt-6">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">默认比例 (New Scene)</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(AspectRatio).map(([key, value]) => (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedAspectRatio(value)}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${selectedAspectRatio === value
                                                ? 'bg-cine-accent border-cine-accent text-black'
                                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                                }`}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">视觉风格预设</span>
                                    <button
                                        onClick={() => {
                                            if (!newBio.trim()) return;
                                            const name = newBio.split('\n')[0].slice(0, 10).trim() || "新场景";
                                            const locId = `manual-${Date.now()}`;
                                            onUpdateLocations([...locations, {
                                                id: locId,
                                                projectId: activeProjectId,
                                                name: name,
                                                description: newBio,
                                                forms: [{ id: `lf-${locId}-0`, formName: "基础预览", prompt: newBio }],
                                                preferredStyle: selectedStyle,
                                                preferredAspectRatio: selectedAspectRatio
                                            }]);
                                            setNewBio('');
                                        }}
                                        className="text-[9px] font-bold text-zinc-600 hover:text-cine-accent uppercase tracking-widest"
                                    >
                                        手动创建场景卡
                                    </button>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {Object.entries(ArtStyle).map(([key, value]) => (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedStyle(value)}
                                            className={`relative group p-1 rounded-xl transition-all border-2 ${selectedStyle === value ? 'border-cine-accent bg-cine-accent/5' : 'border-transparent hover:bg-white/5'}`}
                                            title={value}
                                        >
                                            <div className="aspect-square rounded-lg overflow-hidden bg-zinc-900 relative border border-zinc-800">
                                                <img
                                                    src={`/styles/${key}.png`}
                                                    alt={value}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-all"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23111'/%3E%3C/svg%3E`;
                                                    }}
                                                />
                                            </div>
                                            {selectedStyle === value && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-cine-accent rounded-full flex items-center justify-center">
                                                    <CheckCircle2 size={10} className="text-black" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Identified Locations - DIRECT CHILD of the scroll area */}
                    <div className="px-8 pb-12 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 italic">识别到的场景原型 ({locations.length})</span>
                        </div>
                        <div className="space-y-3">
                            {locations.map(loc => (
                                <div
                                    key={loc.id}
                                    onClick={() => setSelectedLocId(loc.id)}
                                    className={`w-full p-4 rounded-[28px] border transition-all cursor-pointer group relative overflow-hidden
                                        ${selectedLocId === loc.id ? 'bg-cine-accent/5 border-cine-accent/40 shadow-lg' : 'bg-zinc-900/20 border-zinc-800/40 hover:border-zinc-700'}
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors overflow-hidden ${selectedLocId === loc.id ? 'bg-cine-accent text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                                                {loc.forms[0]?.url ? <img src={loc.forms[0].url} className="w-full h-full object-cover" /> : <MapPin size={16} />}
                                            </div>
                                            <h3 className={`font-bold text-sm ${selectedLocId === loc.id ? 'text-cine-accent' : 'text-white'}`}>{loc.name}</h3>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 line-clamp-2 italic ml-11">{loc.description}</p>
                                </div>
                            ))}
                            {locations.length === 0 && !isGeneratingPrompts && !isExtractingText && (
                                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-[32px] opacity-40">
                                    <FileCode size={40} className="mb-2" />
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-center">暂无资产，请上传剧本提取</p>
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
                        <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">实时画布</span>
                    </div>
                    <div className="w-[1px] h-4 bg-zinc-800" />
                    <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">画布比例: {Math.round(scale * 100)}%</span>
                    <button
                        onClick={() => { setScale(0.85); setPan({ x: 100, y: 100 }); }}
                        className="p-1 px-3 bg-zinc-900 rounded-md text-[9px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-widest border border-zinc-800"
                    >
                        重置视口
                    </button>
                </div>

                {/* Bundle Download Button (Top Right) */}
                <div className="absolute top-8 right-8 z-30">
                    <button
                        onClick={handleDownloadAll}
                        disabled={locations.length === 0 || isDownloading}
                        className={`group flex items-center gap-3 bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/50 rounded-full px-6 py-3 shadow-3xl ring-1 ring-white/5 hover:bg-zinc-800 hover:border-cine-accent/50 transition-all ${locations.length === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'active:scale-95'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-cine-accent/10 flex items-center justify-center border border-cine-accent/20 group-hover:bg-cine-accent/20 transition-all">
                            {isDownloading ? <Loader2 size={16} className="animate-spin text-cine-accent" /> : <Download size={16} className="text-cine-accent" />}
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{isDownloading ? '正在打包中...' : '一键打包场景库'}</span>
                            <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">Bundle All Scenes (ZIP)</span>
                        </div>
                    </button>
                </div>

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
                            backgroundSize: `${40 * scale}px ${40 * scale} px`,
                            backgroundPosition: `${pan.x}px ${pan.y} px`
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
                        <div className="flex items-start gap-40 pl-40 pt-40 pr-40">
                            {locations.map(loc => {
                                const activeFormId = activeFormIds[loc.id] || loc.forms[0]?.id;
                                const activeForm = loc.forms.find(f => f.id === activeFormId) || loc.forms[0];
                                const isFocused = selectedLocId === loc.id;

                                return (
                                    <div
                                        key={loc.id}
                                        className={`w-[1100px] shrink-0 bg-cine-dark border rounded-[48px] shadow-3xl overflow-hidden pointer-events-auto transition-all
                                            ${isFocused ? 'border-cine-accent shadow-cine-accent/10 scale-100 z-10' : 'border-zinc-800/60 scale-[0.98] opacity-40 grayscale-[0.8]'}
                                        `}
                                        onMouseDown={(e) => { e.stopPropagation(); setSelectedLocId(loc.id); }}
                                    >
                                        {/* Card Header */}
                                        <div className="p-10 border-b border-zinc-800/30 flex items-center justify-between bg-black/40">
                                            <div className="flex items-center gap-10">
                                                <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">{loc.name}</h3>
                                                <div className="flex bg-black/80 p-1.5 rounded-full border border-zinc-800 shadow-2xl items-center relative">
                                                    {loc.forms.map((f, idx) => (
                                                        <div key={f.id} className="group/form relative flex items-center">
                                                            {editingFormId === f.id ? (
                                                                <input
                                                                    autoFocus
                                                                    className="bg-zinc-800 border-none outline-none text-[10px] font-black px-3 py-1.5 rounded-full text-white mx-1 w-24"
                                                                    value={tempFormName}
                                                                    onChange={e => setTempFormName(e.target.value)}
                                                                    onBlur={() => handleSaveRename(loc.id, f.id)}
                                                                    onKeyDown={e => e.key === 'Enter' && handleSaveRename(loc.id, f.id)}
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setActiveFormIds(prev => ({ ...prev, [loc.id]: f.id })); }}
                                                                    onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(f); }}
                                                                    className={`px-6 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all uppercase flex items-center gap-2 ${activeFormId === f.id ? 'bg-cine-accent text-black' : 'text-zinc-600 hover:text-white'}`}
                                                                >
                                                                    {f.formName}
                                                                    {idx > 0 && (
                                                                        <X
                                                                            size={12}
                                                                            className="opacity-0 group-hover/form:opacity-100 hover:text-red-500 ml-1 transition-opacity"
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteForm(loc.id, f.id); }}
                                                                        />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}

                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowPresetsForLoc(showPresetsForLoc === loc.id ? null : loc.id); }}
                                                            className="w-9 h-9 ml-2 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-cine-accent hover:bg-zinc-800 transition-all"
                                                            title="新增视角 (Pad from base view)"
                                                        >
                                                            <Plus size={16} />
                                                        </button>

                                                        {showPresetsForLoc === loc.id && (
                                                            <div className="absolute top-12 left-0 z-[60] bg-zinc-950 border border-zinc-800 rounded-2xl p-2 shadow-4xl w-48 animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="px-3 py-2 border-b border-zinc-900 mb-1">
                                                                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">选择视角预设</span>
                                                                </div>
                                                                {VIEW_PRESETS.map(preset => (
                                                                    <button
                                                                        key={preset.label}
                                                                        onClick={(e) => { e.stopPropagation(); handleAddNewForm(loc.id, preset.label, preset.prompt); }}
                                                                        className="w-full px-3 py-2 text-left text-[11px] font-bold text-zinc-400 hover:bg-cine-accent hover:text-black rounded-lg transition-all flex items-center justify-between group"
                                                                    >
                                                                        {preset.label}
                                                                        <Plus size={12} className="opacity-0 group-hover:opacity-100" />
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleAddNewForm(loc.id); }}
                                                                    className="w-full px-3 py-2 mt-1 border-t border-zinc-900 text-left text-[11px] font-bold text-zinc-500 hover:text-white transition-all italic"
                                                                >
                                                                    + 自定义空白视角
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                {activeForm?.url && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const link = document.createElement('a');
                                                            link.href = activeForm.url!;
                                                            link.download = `${loc.name} -${activeForm.formName}.png`;
                                                            link.click();
                                                        }}
                                                        className="p-4 text-zinc-600 hover:text-cine-accent transition-all"
                                                        title="下载当前场景背景图"
                                                    >
                                                        <Download size={26} />
                                                    </button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }} className="p-4 text-zinc-800 hover:text-red-500 transition-all">
                                                    <Trash2 size={26} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Main Render Section */}
                                        {activeForm && (
                                            <div className="p-12 space-y-12">
                                                <div
                                                    className="relative bg-zinc-950 rounded-[40px] overflow-hidden border border-zinc-800/50 group/img shadow-inner mx-auto"
                                                    style={{ aspectRatio: (loc.preferredAspectRatio || AspectRatio.WIDE).replace(':', '/') }}
                                                >
                                                    {activeForm.url ? (
                                                        <img src={activeForm.url} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105" alt="Scene" />
                                                    ) : (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10">
                                                            <Mountain size={100} />
                                                            <span className="text-xl font-black tracking-[1em] uppercase mt-8 text-white">场景未生成</span>
                                                        </div>
                                                    )}
                                                    {activeForm.url && (
                                                        <div className="absolute top-8 right-8 flex items-center gap-3 z-20">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setInpaintTarget({
                                                                        locId: loc.id,
                                                                        formId: activeForm.id,
                                                                        url: activeForm.url!,
                                                                        prompt: activeForm.prompt
                                                                    });
                                                                }}
                                                                className="p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-cine-accent opacity-0 group-hover/img:opacity-100 transition-all flex items-center gap-2 hover:bg-white hover:text-black hover:border-cine-accent/50 shadow-2xl"
                                                                title="局部重绘"
                                                            >
                                                                <Wand2 size={20} />
                                                                <span className="text-[10px] font-black tracking-widest uppercase">局部重绘</span>
                                                            </button>

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleGenerateImage(loc.id, activeForm.id); }}
                                                                disabled={!!isGeneratingImages}
                                                                className="p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-white opacity-0 group-hover/img:opacity-100 transition-all flex items-center gap-2 hover:bg-cine-accent hover:text-black hover:border-cine-accent/50 shadow-2xl"
                                                                title="重新生成此场景"
                                                            >
                                                                <RefreshCw size={20} className={isGeneratingImages === activeForm.id ? "animate-spin" : ""} />
                                                                <span className="text-[10px] font-black tracking-widest uppercase">重新生图</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-x-0 bottom-0 p-10 flex gap-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleGenerateImage(loc.id, activeForm.id); }}
                                                            disabled={!!isGeneratingImages}
                                                            className={`flex-[2] bg-zinc-100 text-black font-black py-6 rounded-[24px] text-lg uppercase tracking-widest italic shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3
                                                                ${isGeneratingImages === activeForm.id ? 'opacity-50' : ''}
                                                            `}
                                                        >
                                                            {isGeneratingImages === activeForm.id ? (
                                                                <>
                                                                    <Loader2 className="animate-spin" size={24} />
                                                                    <span>正在执行渲染流...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <RefreshCw size={24} />
                                                                    <span>{activeForm.url ? "重新渲染当前视角" : "渲染单图背景"}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <div className="flex-1 relative">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleGenerateMultiView(loc.id); }}
                                                                disabled={!!isGeneratingImages}
                                                                className={`w-full bg-cine-accent text-black font-black py-6 rounded-[24px] text-lg uppercase tracking-widest italic shadow-cine-accent/20 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3
                                                                    ${isGeneratingImages === `multi-${loc.id}` ? 'opacity-50' : ''}
                                                                `}
                                                            >
                                                                {isGeneratingImages === `multi-${loc.id}` ? (
                                                                    <Loader2 className="animate-spin" size={24} />
                                                                ) : (
                                                                    <>
                                                                        <Layout size={24} />
                                                                        <span>生成多视角组</span>
                                                                    </>
                                                                )}
                                                            </button>

                                                            {/* Dropdown Toggle */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setShowMultiViewMenu(showMultiViewMenu === loc.id ? null : loc.id); }}
                                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/10 rounded-full transition-all"
                                                            >
                                                                <ChevronDown size={20} className={`text-black transition-transform duration-300 ${showMultiViewMenu === loc.id ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {showMultiViewMenu === loc.id && (
                                                                <div className="absolute bottom-full left-0 right-0 mb-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-3 shadow-4xl animate-in fade-in slide-in-from-bottom-2 z-[70]">
                                                                    <div className="px-4 py-2 border-b border-zinc-800 mb-2">
                                                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">选择生成模式</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleGenerateMultiView(loc.id, 'default'); }}
                                                                        className="w-full px-4 py-3 text-left text-sm font-bold text-zinc-300 hover:bg-cine-accent hover:text-black rounded-2xl transition-all flex items-center gap-3"
                                                                    >
                                                                        <Layout size={18} />
                                                                        <span>标准智能组 (2x2)</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleGenerateMultiView(loc.id, 'fpv'); }}
                                                                        className="w-full px-4 py-3 text-left text-sm font-bold text-zinc-300 hover:bg-cine-accent hover:text-black rounded-2xl transition-all flex items-center gap-3"
                                                                    >
                                                                        <Monitor size={18} />
                                                                        <span>FPV 第一视角组</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleGenerateMultiView(loc.id, '360'); }}
                                                                        className="w-full px-4 py-3 text-left text-sm font-bold text-zinc-300 hover:bg-cine-accent hover:text-black rounded-2xl transition-all flex items-center gap-3"
                                                                    >
                                                                        <RefreshCw size={18} />
                                                                        <span>360° 环绕视角组</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-12 gap-10">
                                                    <div className="col-span-8">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <Sparkles size={16} className="text-cine-accent" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">视觉定义</span>
                                                        </div>
                                                        <div className="relative group/prompt">
                                                            <textarea
                                                                value={activeForm.prompt}
                                                                onChange={(e) => {
                                                                    const newPrompt = e.target.value;
                                                                    onUpdateLocations(locations.map(l => l.id === loc.id ? {
                                                                        ...l,
                                                                        forms: l.forms.map(f => f.id === activeForm.id ? { ...f, prompt: newPrompt } : f)
                                                                    } : l));
                                                                }}
                                                                className="w-full bg-black/20 text-zinc-400 text-sm leading-relaxed p-6 border border-zinc-800/50 rounded-3xl outline-none focus:border-cine-accent focus:text-zinc-200 transition-all resize-none h-32 custom-scrollbar"
                                                                placeholder="场景视觉提示词..."
                                                            />
                                                            <TranslateButton
                                                                text={activeForm.prompt}
                                                                onTranslate={(val) => {
                                                                    onUpdateLocations(locations.map(l => l.id === loc.id ? {
                                                                        ...l,
                                                                        forms: l.forms.map(f => f.id === activeForm.id ? { ...f, prompt: val } : f)
                                                                    } : l));
                                                                }}
                                                                className="absolute bottom-3 right-3 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-span-4 bg-zinc-900/40 p-8 rounded-[40px] border border-zinc-800/40 space-y-6">
                                                        <span className="text-[10px] font-bold text-zinc-600 uppercase block tracking-widest">场景元属性</span>
                                                        <div className="space-y-4">
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-zinc-500 font-mono">画风</span>
                                                                <span className="text-cine-accent font-bold uppercase">{selectedStyle.split(' ')[0]}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-zinc-500 font-mono">状态</span>
                                                                <span className={`font-bold uppercase ${activeForm.url ? 'text-green-500' : 'text-zinc-600'}`}>
                                                                    {activeForm.url ? '已渲染' : '待渲染'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col gap-2 pt-2">
                                                                <span className="text-zinc-500 font-mono text-xs">图像比例</span>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    {Object.entries(AspectRatio).map(([key, value]) => (
                                                                        <button
                                                                            key={key}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onUpdateLocations(locations.map(l => l.id === loc.id ? { ...l, preferredAspectRatio: value } : l));
                                                                            }}
                                                                            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${(loc.preferredAspectRatio || AspectRatio.WIDE) === value
                                                                                ? 'bg-cine-accent border-cine-accent text-black'
                                                                                : 'bg-black/40 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                                                                }`}
                                                                        >
                                                                            {value}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {/* Visual Reference Image Upload */}
                                                            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/50">
                                                                <span className="text-zinc-500 font-mono text-xs">视觉参考图</span>
                                                                {loc.referenceImageUrl ? (
                                                                    <div className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-cine-accent/20">
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <img src={loc.referenceImageUrl} className="w-10 h-10 rounded object-cover" />
                                                                            <span className="text-[10px] text-zinc-400 truncate">参考图已上传</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); onUpdateLocations(locations.map(l => l.id === loc.id ? { ...l, referenceImageUrl: undefined } : l)); }}
                                                                            className="text-zinc-600 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const input = document.createElement('input');
                                                                            input.type = 'file';
                                                                            input.accept = 'image/*';
                                                                            input.onchange = async (ev) => {
                                                                                const file = (ev.target as HTMLInputElement).files?.[0];
                                                                                if (file) {
                                                                                    const reader = new FileReader();
                                                                                    reader.onload = () => {
                                                                                        const dataUrl = reader.result as string;
                                                                                        onUpdateLocations(locations.map(l => l.id === loc.id ? { ...l, referenceImageUrl: dataUrl } : l));
                                                                                    };
                                                                                    reader.readAsDataURL(file);
                                                                                }
                                                                            };
                                                                            input.click();
                                                                        }}
                                                                        className="flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 border border-dashed border-zinc-700 rounded-xl py-2 px-3 transition-all text-zinc-500 hover:text-white group"
                                                                    >
                                                                        <FileImage size={14} className="group-hover:text-cine-accent" />
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">上传参考图生图</span>
                                                                    </button>
                                                                )}
                                                            </div>

                                                        </div>
                                                        <p className="text-[9px] text-zinc-600 leading-relaxed italic border-t border-zinc-800/50 pt-4 uppercase">
                                                            此背景图会自动作为该场景下所有分镜的视觉基座，确保地点在分镜间的一致性。
                                                        </p>
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
                        onClose={() => setInpaintTarget(null)}
                        onComplete={(newUrl) => {
                            onUpdateLocations(locations.map(l => l.id === inpaintTarget.locId ? {
                                ...l,
                                forms: l.forms.map(f => f.id === inpaintTarget.formId ? { ...f, url: newUrl } : f)
                            } : l));
                            setInpaintTarget(null);
                        }}
                    />
                )}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
`
            }} />
        </div >
    );
};

interface AlertCircleProps {
    className?: string;
    size?: number;
}

const AlertCircle: React.FC<AlertCircleProps> = ({ className, size }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

export default LocationLibrary;
