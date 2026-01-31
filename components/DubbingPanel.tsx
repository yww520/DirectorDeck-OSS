
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Mic,
    Volume2,
    Play,
    Pause,
    Save,
    Upload,
    Trash2,
    RefreshCcw,
    Wand2,
    ChevronRight,
    Search,
    User,
    Users,
    Smile,
    AlertCircle,
    CheckCircle,
    X as XIcon,
    FileAudio,
    Type,
    BookOpen,
    MessageSquare,
    ChevronDown,
    Settings,
    Music,
    Sliders,
    Filter,
    ArrowRightCircle,
    Sparkles,
    UserCircle2,
    History,
    Download
} from 'lucide-react';
import { Character, Asset, AppSettings, StoryboardProject } from '../types';
import { withRetry } from '../services/apiWrapper';

// 预设音色类型
interface VoicePreset {
    id: string;
    name: string;
    file: string;
    description: string;
    language: 'zh' | 'en';
    gender: 'male' | 'female';
    emoMode: number;
    emotion?: string;
    emoAudio?: string;
    emoWeight?: number;
    emoVectors?: Record<string, number>;
    emoText?: string;
}

interface DubbingPanelProps {
    characters: Character[];
    assets: Asset[];
    storyboardProjects: StoryboardProject[];
    settings: AppSettings;
    onAddAsset: (files: FileList) => void;
    onSaveToTimeline?: (audioUrl: string, label: string, duration: number) => void;
}

const DubbingPanel = React.memo(({
    characters,
    assets,
    storyboardProjects,
    settings,
    onAddAsset,
    onSaveToTimeline
}: DubbingPanelProps) => {
    // --- State ---
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
    const [text, setText] = useState<string>('');
    const [emoMode, setEmoMode] = useState<number>(2);
    const [emoWeight, setEmoWeight] = useState<number>(0.65);
    const [emotionVectors, setEmotionVectors] = useState({
        happy: 0, angry: 0, sad: 0, fear: 0,
        disgust: 0, depressed: 0, surprise: 0, calm: 0
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Filter/Search State
    const [scriptSearch, setScriptSearch] = useState('');
    const [filterCharacter, setFilterCharacter] = useState<string>('all');

    // Custom Audio State
    const [customVoiceUrl, setCustomVoiceUrl] = useState<string | null>(null);
    const [customVoiceFile, setCustomVoiceFile] = useState<File | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultAudioRef = useRef<HTMLAudioElement>(null);
    const refMediaRef = useRef<HTMLMediaElement>(null);

    // Reference Player State
    const [isRefPlaying, setIsRefPlaying] = useState(false);
    const [refCurrentTime, setRefCurrentTime] = useState(0);
    const [refDuration, setRefDuration] = useState(0);
    const [refFileType, setRefFileType] = useState<'audio' | 'video' | null>(null);

    // 系统预设音色
    const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [presetFilter, setPresetFilter] = useState<'all' | 'zh' | 'en'>('all');

    // 预设音频试听
    const presetAudioRef = useRef<HTMLAudioElement>(null);
    const [isPresetPlaying, setIsPresetPlaying] = useState(false);
    const [presetPlayingId, setPresetPlayingId] = useState<string | null>(null);

    // --- Computed ---
    const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

    const getAvatarUrl = (char: Character) => {
        if (!char.forms || char.forms.length === 0) return null;
        // Try to find the best image in order of preference
        for (const f of char.forms) {
            if (f.frontViewUrl) return f.frontViewUrl;
            if (f.multiViewUrl) return f.multiViewUrl;
        }
        return null;
    };

    // 获取当前选中的预设
    const selectedPreset = voicePresets.find(p => p.id === selectedPresetId);

    // 计算有效的音色URL：优先级 自定义上传 > 预设音色 > 角色音色
    const effectiveVoiceUrl = customVoiceUrl || (selectedPreset?.file) || selectedCharacter?.voiceUrl;

    const allScriptItems = useMemo(() => {
        return storyboardProjects.flatMap(p =>
            p.items.map(item => ({
                ...item,
                projectTitle: p.title,
                projectId: p.id
            }))
        ).filter(item => item.dialogue && item.dialogue.trim() && item.dialogue.trim() !== '-');
    }, [storyboardProjects]);

    const filteredScripts = useMemo(() => {
        return allScriptItems.filter(item => {
            const matchesSearch =
                item.dialogue.toLowerCase().includes(scriptSearch.toLowerCase()) ||
                item.characters.toLowerCase().includes(scriptSearch.toLowerCase());
            const matchesChar = filterCharacter === 'all' || item.characters.includes(filterCharacter);
            return matchesSearch && matchesChar;
        });
    }, [allScriptItems, scriptSearch, filterCharacter]);

    // --- Persistence Keys ---
    const STORAGE_KEY = 'dubbingPanelState';

    // --- Load voice presets on mount ---
    useEffect(() => {
        fetch('/voices/presets.json')
            .then(res => res.json())
            .then(data => {
                if (data.presets) {
                    setVoicePresets(data.presets);
                    console.log('[DubbingPanel] Loaded', data.presets.length, 'voice presets');
                }
            })
            .catch(err => console.warn('[DubbingPanel] Failed to load voice presets:', err));
    }, []);

    // --- Load persisted state on mount ---
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const state = JSON.parse(saved);
                if (state.text) setText(state.text);
                if (state.selectedCharacterId) setSelectedCharacterId(state.selectedCharacterId);
                if (state.selectedPresetId) setSelectedPresetId(state.selectedPresetId);
                if (state.emoMode !== undefined) setEmoMode(state.emoMode);
                if (state.emoWeight !== undefined) setEmoWeight(state.emoWeight);
                if (state.emotionVectors) setEmotionVectors(state.emotionVectors);
                if (state.generatedAudioUrl) setGeneratedAudioUrl(state.generatedAudioUrl);
                console.log('[DubbingPanel] Restored state from localStorage');
            }
        } catch (e) {
            console.warn('[DubbingPanel] Failed to load persisted state:', e);
        }
    }, []);

    // --- Save state to localStorage on change (with debounce to prevent flickers) ---
    const saveStateTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        const stateToSave = {
            text,
            selectedCharacterId,
            selectedPresetId,
            emoMode,
            emoWeight,
            emotionVectors,
            generatedAudioUrl
        };

        if (saveStateTimeoutRef.current) {
            clearTimeout(saveStateTimeoutRef.current);
        }

        saveStateTimeoutRef.current = window.setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
            } catch (e) {
                console.warn('[DubbingPanel] Failed to persist state:', e);
            }
        }, 500);

        return () => {
            if (saveStateTimeoutRef.current) clearTimeout(saveStateTimeoutRef.current);
        };
    }, [text, selectedCharacterId, selectedPresetId, emoMode, emoWeight, emotionVectors, generatedAudioUrl]);

    // --- Effects ---
    useEffect(() => {
        if (resultAudioRef.current) {
            const audio = resultAudioRef.current;
            const updateTime = () => setCurrentTime(audio.currentTime);
            const updateDuration = () => setDuration(audio.duration);
            const onEnded = () => setIsPlaying(false);

            audio.addEventListener('timeupdate', updateTime);
            audio.addEventListener('loadedmetadata', updateDuration);
            audio.addEventListener('ended', onEnded);

            return () => {
                audio.removeEventListener('timeupdate', updateTime);
                audio.removeEventListener('loadedmetadata', updateDuration);
                audio.removeEventListener('ended', onEnded);
            };
        }
    }, [generatedAudioUrl]);

    useEffect(() => {
        if (refMediaRef.current) {
            const media = refMediaRef.current;
            const updateTime = () => setRefCurrentTime(media.currentTime);
            const updateDuration = () => setRefDuration(media.duration);
            const onEnded = () => setIsRefPlaying(false);

            media.addEventListener('timeupdate', updateTime);
            media.addEventListener('loadedmetadata', updateDuration);
            media.addEventListener('ended', onEnded);

            return () => {
                media.removeEventListener('timeupdate', updateTime);
                media.removeEventListener('loadedmetadata', updateDuration);
                media.removeEventListener('ended', onEnded);
            };
        }
    }, [customVoiceUrl]);

    // --- Handlers ---
    const handleSelectScriptLine = (item: any) => {
        setText(item.dialogue);
        // Automatic character selection
        const itemChars = item.characters.split(/[，,、\s]+/).filter(Boolean).map((n: string) => n.trim().toLowerCase());
        const match = characters.find(c => itemChars.some((ic: string) => ic === c.name.toLowerCase()));
        if (match) {
            setSelectedCharacterId(match.id);
            setSelectedPresetId(null);
            setCustomVoiceUrl(null);
            setCustomVoiceFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // 试听预设音频
    const handlePreviewPreset = (preset: VoicePreset, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!presetAudioRef.current) return;

        if (presetPlayingId === preset.id && isPresetPlaying) {
            // 正在播放同一个，暂停
            presetAudioRef.current.pause();
            setIsPresetPlaying(false);
        } else {
            // 播放新的或恢复
            presetAudioRef.current.src = preset.file;
            presetAudioRef.current.play();
            setPresetPlayingId(preset.id);
            setIsPresetPlaying(true);
        }
    };

    const togglePlay = () => {
        if (!resultAudioRef.current) return;
        if (isPlaying) {
            resultAudioRef.current.pause();
        } else {
            resultAudioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleRefPlay = () => {
        if (!refMediaRef.current) return;
        if (isRefPlaying) {
            refMediaRef.current.pause();
        } else {
            refMediaRef.current.play();
        }
        setIsRefPlaying(!isRefPlaying);
    };

    const handleGenerate = async () => {
        if (!text.trim()) { setError("请输入需要生成的台词内容"); return; }
        if (!effectiveVoiceUrl) { setError("缺少参考音频：请先从左侧角色库选择角色，或上传自定义音频文件"); return; }

        setIsGenerating(true);
        setError(null);
        setSuccess(null);
        setGeneratedAudioUrl(null);
        setProgress(0);

        // Simulated start progress to give feedback
        const fakeInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 35) return prev;
                return prev + 1;
            });
        }, 300);

        try {
            const baseUrl = (settings.indexTtsUrl || 'http://127.0.0.1:7860').replace(/\/$/, '');

            // 1. Prepare Voice Reference
            // 1. 获取语音参考 (带重试)
            let voiceBlob;
            try {
                voiceBlob = await withRetry(async () => {
                    const voiceRes = await fetch(effectiveVoiceUrl);
                    if (!voiceRes.ok) throw new Error(`Status: ${voiceRes.status}`);
                    return voiceRes.blob();
                }, { maxRetries: 2, retryDelay: 500 });
            } catch (blobErr) {
                throw new Error("无法提取参考音频，请尝试重新选择角色或刷新页面。");
            }

            // 2. 上传到 Gradio (带重试)
            const formData = new FormData();
            formData.append('files', voiceBlob, 'voice.wav');

            const serverPath = await withRetry(async () => {
                let uploadRes = await fetch(`${baseUrl}/upload`, { method: 'POST', body: formData });
                if (uploadRes.status === 404) {
                    uploadRes = await fetch(`${baseUrl}/gradio_api/upload`, { method: 'POST', body: formData });
                }
                if (!uploadRes.ok) throw new Error(`音频上传失败 (${uploadRes.status})`);
                const uploadData = await uploadRes.json();
                return uploadData[0];
            }, {
                maxRetries: 3,
                retryDelay: 1000,
                onRetry: (attempt, err) => console.warn(`[TTS] 上传重试 ${attempt}:`, err.message)
            });

            // 3. Trigger Generation Call
            const payload = {
                data: [
                    emoMode,
                    { "path": serverPath, "meta": { "_type": "gradio.FileData" } },
                    text,
                    { "path": serverPath, "meta": { "_type": "gradio.FileData" } },
                    emoWeight,
                    emotionVectors.happy, emotionVectors.angry, emotionVectors.sad, emotionVectors.fear,
                    emotionVectors.disgust, emotionVectors.depressed, emotionVectors.surprise, emotionVectors.calm,
                    "", false, 120, true, 0.8, 30, 0.8, 0.0, 3, 10.0, 1500
                ]
            };

            // 3. 触发生成 (带重试)
            let apiUrl = `${baseUrl}/call/gen_antigravity_v1`;
            const event_id = await withRetry(async () => {
                let callRes = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (callRes.status === 404) {
                    apiUrl = `${baseUrl}/gradio_api/call/gen_antigravity_v1`;
                    callRes = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (!callRes.ok) throw new Error(`生成任务启动失败 (${callRes.status})`);
                const data = await callRes.json();
                return data.event_id;
            }, {
                maxRetries: 3,
                retryDelay: 2000,
                onRetry: (attempt, err) => console.warn(`[TTS] 生成请求重试 ${attempt}:`, err.message)
            });

            // 4. Poll Result with SSE Listener Logic + Timeout
            let resultData = null;
            let finalDone = false;
            const statusUrl = `${apiUrl}/${event_id}`;
            const startTime = Date.now();
            const maxWaitTime = 600000; // 10 minutes max

            while (!finalDone && (Date.now() - startTime) < maxWaitTime) {
                try {
                    const statusRes = await fetch(statusUrl, { headers: { 'Accept': 'text/event-stream' } });
                    if (!statusRes.ok) {
                        // Increment progress slowly while waiting
                        setProgress(prev => Math.min(prev + 2, 90));
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }

                    const reader = statusRes.body?.getReader();
                    if (!reader) break;

                    const decoder = new TextDecoder();
                    let buffer = "";

                    try {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || "";

                            for (const line of lines) {
                                // Handle event: lines
                                if (line.startsWith('event:')) {
                                    const eventType = line.slice(6).trim();
                                    if (eventType === 'complete' || eventType === 'error') {
                                        // Next data line will have the result
                                    }
                                }
                                if (line.startsWith('data:')) {
                                    try {
                                        const jsonStr = line.slice(5).trim();
                                        if (!jsonStr) continue;

                                        // Check if it's a plain string path (Windows absolute path)
                                        if (jsonStr.startsWith('"') && (jsonStr.includes(':\\\\') || jsonStr.includes(':/'))) {
                                            try {
                                                const pathStr = JSON.parse(jsonStr);
                                                if (typeof pathStr === 'string' && pathStr.includes('outputs')) {
                                                    console.log('[TTS SSE] Detected path string:', pathStr);
                                                    resultData = pathStr;
                                                    finalDone = true;
                                                    break;
                                                }
                                            } catch { }
                                        }

                                        const msg = JSON.parse(jsonStr);
                                        console.log('[TTS SSE]', msg);

                                        // Handle string result directly
                                        if (typeof msg === 'string' && msg.includes('outputs')) {
                                            console.log('[TTS SSE] Direct string result:', msg);
                                            resultData = msg;
                                            finalDone = true;
                                            break;
                                        }

                                        // Real Progress handling
                                        if (msg.msg === 'progress' || msg.progress_data) {
                                            const pVal = msg.progress_data?.[0]?.value;
                                            if (pVal !== undefined && pVal !== null) {
                                                const realP = Math.round(Number(pVal) * 100);
                                                setProgress(prev => Math.max(prev, Math.min(realP, 95)));
                                            }
                                        }

                                        // Multiple completion detection patterns
                                        if (msg.msg === 'process_completed' || msg.msg === 'complete') {
                                            // Try various data extraction patterns
                                            const extracted = msg.output?.data?.[0]
                                                || msg.output?.[0]
                                                || msg.data?.[0]
                                                || msg.output;

                                            // Handle string path in output
                                            if (typeof extracted === 'string') {
                                                resultData = extracted;
                                                finalDone = true;
                                                break;
                                            } else if (extracted) {
                                                resultData = extracted;
                                                finalDone = true;
                                                break;
                                            }
                                        }

                                        // Check for is_generating: false (some Gradio versions)
                                        if (msg.is_generating === false && msg.output !== undefined) {
                                            const extracted = msg.output?.data?.[0] || msg.output?.[0] || msg.output;
                                            if (extracted) {
                                                resultData = typeof extracted === 'string' ? extracted : extracted;
                                                finalDone = true;
                                                break;
                                            }
                                        }

                                        // Direct output without msg wrapper
                                        if (msg.path || msg.url || msg.name) {
                                            resultData = msg;
                                            finalDone = true;
                                            break;
                                        }

                                        // Array response
                                        if (Array.isArray(msg) && msg.length > 0) {
                                            resultData = msg[0];
                                            finalDone = true;
                                            break;
                                        }
                                    } catch (e) {
                                        // Check if it's a plain unquoted path string
                                        const rawData = line.slice(5).trim();
                                        if (rawData && rawData.includes('outputs') && rawData.includes('.wav')) {
                                            console.log('[TTS SSE] Raw path detected:', rawData);
                                            resultData = rawData;
                                            finalDone = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (finalDone) break;
                        }
                    } finally {
                        reader.cancel();
                    }
                } catch (fetchErr) {
                    console.warn('[TTS] SSE fetch error, retrying...', fetchErr);
                }
                if (finalDone) break;
                // Slow increment while polling
                setProgress(prev => Math.min(prev + 3, 92));
                await new Promise(r => setTimeout(r, 3000));
            }

            if (!resultData) throw new Error("服务器生成超时或返回无效数据");

            clearInterval(fakeInterval);
            setProgress(100);

            // Construct Final URL
            let finalAudioUrl = "";
            const apiPrefix = apiUrl.includes('/gradio_api/') ? '/gradio_api' : '';

            console.log('[TTS] Result data for URL construction:', resultData, typeof resultData);

            if (typeof resultData === 'object' && resultData.url) {
                finalAudioUrl = resultData.url.startsWith('/') ? `${baseUrl}${resultData.url}` : resultData.url;
            } else {
                let path = typeof resultData === 'object' ? (resultData.path || resultData.name) : resultData;

                // Clean up the path if it's a Windows absolute path
                if (typeof path === 'string') {
                    // Remove any surrounding quotes
                    path = path.replace(/^["']|["']$/g, '');

                    // If it's a Windows absolute path (e.g., E:\index-tts-windows\outputs\xxx.wav)
                    // We need to use only the relative part for the Gradio file endpoint
                    if (path.match(/^[A-Za-z]:[\\\/]/)) {
                        // Extract just the outputs/xxx.wav part
                        const outputsMatch = path.match(/outputs[\\\/].+$/i);
                        if (outputsMatch) {
                            path = outputsMatch[0].replace(/\\\\/g, '/');
                        }
                    }
                }

                finalAudioUrl = `${baseUrl}${apiPrefix}/file=${path}`;
            }

            console.log('[TTS] Final audio URL:', finalAudioUrl);

            setGeneratedAudioUrl(finalAudioUrl);
            setSuccess("配音生成完毕！");

        } catch (e: any) {
            setError(e.message);
        } finally {
            clearInterval(fakeInterval);
            setIsGenerating(false);
        }
    };

    const handleSaveAsAsset = async () => {
        if (!generatedAudioUrl) return;
        try {
            const res = await fetch(generatedAudioUrl);
            const blob = await res.blob();
            const file = new File([blob], `audio_${Date.now()}.wav`, { type: 'audio/wav' });
            const dt = new DataTransfer();
            dt.items.add(file);
            onAddAsset(dt.files);
            setSuccess("音频已存入本地媒体库");
        } catch (e) {
            setError("保存到媒体库失败");
        }
    };

    return (
        <div className="flex h-full bg-[#050505] text-zinc-300 overflow-hidden font-sans">
            {/* SCRIPT SIDEBAR */}
            <div className="w-[320px] border-r border-zinc-800/40 bg-[#080808] flex flex-col">
                <div className="p-6 border-b border-zinc-800/20 space-y-4">
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.25em] flex items-center gap-2.5">
                        <History size={14} className="text-cine-accent" />
                        剧本同步流
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={13} />
                        <input
                            type="text"
                            value={scriptSearch}
                            onChange={(e) => setScriptSearch(e.target.value)}
                            placeholder="搜索台词或角色..."
                            className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-xl pl-9 pr-3 py-2.5 text-[11px] outline-none focus:border-zinc-700 transition-colors"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {filteredScripts.length > 0 ? filteredScripts.map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleSelectScriptLine(item)}
                            className="group p-4 bg-zinc-900/40 border border-zinc-800/30 rounded-2xl hover:bg-zinc-800/40 hover:border-zinc-700/50 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black bg-zinc-800/80 text-zinc-500 px-2 py-0.5 rounded tracking-wider">{item.shotNumber || `S${idx + 1}`}</span>
                                <span className="text-[10px] font-bold text-cine-accent group-hover:underline">{item.characters}</span>
                            </div>
                            <p className="text-[11px] line-clamp-3 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity italic">{item.dialogue}</p>
                        </div>
                    )) : (
                        <div className="text-center py-20 opacity-20 flex flex-col items-center gap-3">
                            <BookOpen size={40} strokeWidth={1} />
                            <span className="text-[10px] uppercase font-bold tracking-widest">暂无可用剧本</span>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN WORKSPACE */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                    <div className="max-w-5xl mx-auto space-y-16">

                        {/* Header: Persona & Emotion */}
                        <div className="grid grid-cols-12 gap-12">
                            {/* Persona Selector */}
                            <div className="col-span-12 lg:col-span-7 space-y-10">
                                {/* Character Grid Area */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Users size={16} className="text-cine-accent" />
                                            选择预设角色 (Standard)
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-5">
                                        {characters.map(char => {
                                            const avatar = getAvatarUrl(char);
                                            const isSelected = selectedCharacterId === char.id;
                                            return (
                                                <button
                                                    key={char.id}
                                                    onClick={() => {
                                                        setSelectedCharacterId(char.id);
                                                        setSelectedPresetId(null);
                                                        setCustomVoiceUrl(null);
                                                        setCustomVoiceFile(null);
                                                        setRefFileType(null);
                                                    }}
                                                    className={`flex flex-col items-center gap-2.5 transition-all duration-300 group`}
                                                >
                                                    <div className={`
                                                        relative w-16 h-16 rounded-[24px] border-2 flex items-center justify-center overflow-hidden transition-all
                                                        ${isSelected
                                                            ? 'border-cine-accent bg-cine-accent/10 shadow-[0_0_20px_rgba(201,255,86,0.15)] ring-4 ring-cine-accent/5'
                                                            : 'border-zinc-800/60 bg-zinc-900/50 grayscale opacity-40 hover:grayscale-0 hover:opacity-100'
                                                        }
                                                    `}>
                                                        {avatar ? (
                                                            <img src={avatar} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <UserCircle2 size={32} className="text-zinc-800" />
                                                        )}
                                                        {isSelected && <div className="absolute inset-0 bg-cine-accent/5" />}
                                                    </div>
                                                    <span className={`text-[9px] font-black truncate w-full text-center tracking-[0.15em] px-1 uppercase ${isSelected ? 'text-cine-accent' : 'text-zinc-600'}`}>
                                                        {char.name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* System Voice Presets */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Music size={16} className="text-cine-accent" />
                                            系统预设音色 (System Presets)
                                        </h3>
                                        <div className="flex gap-2">
                                            {(['all', 'zh', 'en'] as const).map(filter => (
                                                <button
                                                    key={filter}
                                                    onClick={() => setPresetFilter(filter)}
                                                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${presetFilter === filter
                                                        ? 'bg-cine-accent/20 border-cine-accent/50 text-cine-accent'
                                                        : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 hover:text-zinc-400'
                                                        }`}
                                                >
                                                    {filter === 'all' ? '全部' : filter === 'zh' ? '中文' : 'ENG'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Hidden audio element for preset preview */}
                                    <audio
                                        ref={presetAudioRef}
                                        onEnded={() => { setIsPresetPlaying(false); setPresetPlayingId(null); }}
                                        onPause={() => setIsPresetPlaying(false)}
                                        hidden
                                    />
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                        {voicePresets
                                            .filter(p => presetFilter === 'all' || p.language === presetFilter)
                                            .map(preset => {
                                                const isSelected = selectedPresetId === preset.id;
                                                const isThisPlaying = presetPlayingId === preset.id && isPresetPlaying;
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => {
                                                            setSelectedPresetId(preset.id);
                                                            setSelectedCharacterId('');
                                                            setCustomVoiceUrl(null);
                                                            setCustomVoiceFile(null);
                                                            setRefFileType(null);
                                                            // 自动应用预设的情感设置
                                                            if (preset.emoMode !== undefined) {
                                                                setEmoMode(preset.emoMode);
                                                            }
                                                            if (preset.emoWeight !== undefined) {
                                                                setEmoWeight(preset.emoWeight);
                                                            }
                                                            if (preset.emoVectors) {
                                                                setEmotionVectors(prev => ({
                                                                    ...prev,
                                                                    ...Object.fromEntries(
                                                                        Object.entries(preset.emoVectors!).map(([k, v]) => [k, v])
                                                                    )
                                                                }));
                                                            }
                                                        }}
                                                        className={`group relative p-3 rounded-2xl border transition-all text-left ${isSelected
                                                            ? 'bg-cine-accent/10 border-cine-accent/50 shadow-[0_0_20px_rgba(201,255,86,0.15)]'
                                                            : 'bg-zinc-900/30 border-zinc-800/40 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                                                            }`}
                                                        title={preset.description}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${preset.gender === 'female'
                                                                ? 'bg-pink-500/20 text-pink-400'
                                                                : 'bg-sky-500/20 text-sky-400'
                                                                }`}>
                                                                {preset.gender === 'female' ? '♀' : '♂'}
                                                            </div>
                                                            <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${preset.language === 'zh'
                                                                ? 'bg-amber-500/20 text-amber-400'
                                                                : 'bg-emerald-500/20 text-emerald-400'
                                                                }`}>
                                                                {preset.language}
                                                            </span>
                                                            {/* Play button */}
                                                            <div
                                                                onClick={(e) => handlePreviewPreset(preset, e)}
                                                                className={`ml-auto w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${isThisPlaying
                                                                    ? 'bg-cine-accent text-black'
                                                                    : 'bg-zinc-800/80 text-zinc-500 hover:bg-cine-accent/30 hover:text-cine-accent'
                                                                    }`}
                                                            >
                                                                {isThisPlaying ? <Pause size={10} /> : <Play size={10} className="ml-0.5" />}
                                                            </div>
                                                        </div>
                                                        <p className={`text-[9px] font-bold truncate ${isSelected ? 'text-cine-accent' : 'text-zinc-400'}`}>
                                                            {preset.name}
                                                        </p>
                                                        {preset.emoMode > 0 && (
                                                            <div className="absolute top-1.5 right-1.5">
                                                                <Sparkles size={10} className="text-cine-accent" />
                                                            </div>
                                                        )}
                                                        {isSelected && (
                                                            <div className="absolute inset-0 rounded-2xl ring-2 ring-cine-accent/30" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                    {selectedPreset && (
                                        <div className="p-4 bg-cine-accent/5 border border-cine-accent/20 rounded-2xl">
                                            <div className="flex items-start gap-4">
                                                <button
                                                    onClick={(e) => handlePreviewPreset(selectedPreset, e)}
                                                    className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all ${presetPlayingId === selectedPreset.id && isPresetPlaying
                                                        ? 'bg-cine-accent text-black'
                                                        : 'bg-cine-accent/20 text-cine-accent hover:bg-cine-accent/40'
                                                        }`}
                                                >
                                                    {presetPlayingId === selectedPreset.id && isPresetPlaying
                                                        ? <Pause size={28} />
                                                        : <Play size={28} className="ml-1" />
                                                    }
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-cine-accent mb-1">{selectedPreset.name}</p>
                                                    <p className="text-[10px] text-zinc-500 line-clamp-2 italic">{selectedPreset.description}</p>
                                                    {selectedPreset.emoMode > 0 && (
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <span className="text-[8px] px-2 py-0.5 bg-cine-accent/20 text-cine-accent rounded uppercase font-black">
                                                                情感模式 {selectedPreset.emoMode}
                                                            </span>
                                                            {selectedPreset.emotion && (
                                                                <span className="text-[8px] text-zinc-600">{selectedPreset.emotion}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Dedicated Reference Upload Area */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Upload size={16} className="text-cine-accent" />
                                            上传自定义参考 (Custom Reference)
                                        </h3>
                                        {customVoiceUrl && (
                                            <button
                                                onClick={() => {
                                                    setCustomVoiceUrl(null);
                                                    setCustomVoiceFile(null);
                                                    setRefFileType(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="text-[9px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                                            >
                                                移除参考
                                            </button>
                                        )}
                                    </div>

                                    {customVoiceUrl ? (
                                        <div className="relative rounded-[40px] border-2 border-dashed border-cine-accent/30 bg-cine-accent/5 p-8 transition-all overflow-hidden">
                                            <div className="flex flex-col md:flex-row gap-8 items-center lg:items-start">
                                                {/* Media Icon/Thumb */}
                                                <div className="relative group/ref shrink-0">
                                                    <div className="w-32 h-32 bg-cine-accent/10 rounded-[32px] flex items-center justify-center border border-cine-accent/20">
                                                        {refFileType === 'video' ? (
                                                            <video
                                                                ref={refMediaRef as any}
                                                                src={customVoiceUrl}
                                                                className="w-full h-full object-cover rounded-[32px]"
                                                                onClick={(e) => { e.stopPropagation(); toggleRefPlay(); }}
                                                            />
                                                        ) : (
                                                            <Mic size={48} className="text-cine-accent" />
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleRefPlay(); }}
                                                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/ref:opacity-100 transition-opacity rounded-[32px]"
                                                        >
                                                            {isRefPlaying ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current ml-1" />}
                                                        </button>
                                                    </div>
                                                    {refFileType === 'audio' && <audio ref={refMediaRef as any} src={customVoiceUrl} hidden />}
                                                </div>

                                                {/* Controls & Name */}
                                                <div className="flex-1 w-full space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-black text-cine-accent uppercase tracking-widest">已加载参考资源</p>
                                                            <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">{customVoiceFile?.name}</p>
                                                        </div>
                                                        <div className="text-[10px] font-mono text-cine-accent/60">
                                                            {refCurrentTime.toFixed(1)}s / {refDuration.toFixed(1)}s
                                                        </div>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div
                                                        className="h-1.5 bg-zinc-950 rounded-full overflow-hidden relative cursor-pointer group/bar"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const p = (e.clientX - rect.left) / rect.width;
                                                            if (refMediaRef.current) refMediaRef.current.currentTime = p * refDuration;
                                                        }}
                                                    >
                                                        <div
                                                            className="h-full bg-cine-accent transition-all duration-150"
                                                            style={{ width: `${(refCurrentTime / refDuration) * 100}%` }}
                                                        />
                                                    </div>

                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 transition-colors"
                                                        >
                                                            更换资源
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="relative rounded-[40px] border-2 border-dashed border-zinc-800/60 bg-zinc-900/20 hover:border-cine-accent/50 hover:bg-zinc-900/40 p-12 cursor-pointer transition-all overflow-hidden flex flex-col items-center gap-4 text-center group">
                                            <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-[24px] flex items-center justify-center text-zinc-600 group-hover:text-cine-accent group-hover:border-cine-accent/50 transition-all">
                                                <Upload size={32} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-black text-white uppercase tracking-widest">点击上传参考音频/视频</p>
                                                <p className="text-[9px] text-zinc-600 font-medium uppercase tracking-[0.2em]">支持 .mp3 .wav .mp4 .mov | 建议小于 10MB</p>
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                className="hidden"
                                                accept="audio/*,video/*"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) {
                                                        setCustomVoiceFile(f);
                                                        setCustomVoiceUrl(URL.createObjectURL(f));
                                                        setRefFileType(f.type.startsWith('video') ? 'video' : 'audio');
                                                        setSelectedCharacterId('');
                                                        setSelectedPresetId(null);
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Emotion Control */}
                            <div className="col-span-12 lg:col-span-5 flex flex-col">
                                <div className="flex items-center border-b border-zinc-900 pb-3">
                                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Smile size={16} className="text-emerald-400" /> 情感维度修饰 (Emotion Blend)
                                    </h3>
                                </div>
                                <div className="flex-1 mt-6 p-8 bg-zinc-900/40 rounded-[40px] border border-zinc-800/40 flex flex-col justify-between">
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 tracking-tighter">
                                                <span>混合灵敏度 (Intensity)</span>
                                                <span className="text-cine-accent">{emoWeight.toFixed(2)}</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.01" value={emoWeight} onChange={(e) => setEmoWeight(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-950 rounded-full appearance-none accent-cine-accent cursor-pointer" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                            {Object.entries(emotionVectors).map(([key, val]) => {
                                                const emotionLabels: Record<string, string> = {
                                                    happy: '开心',
                                                    angry: '愤怒',
                                                    sad: '悲伤',
                                                    fear: '恐惧',
                                                    disgust: '厌恶',
                                                    depressed: '抑郁',
                                                    surprise: '惊讶',
                                                    calm: '平静'
                                                };
                                                return (
                                                    <div key={key} className="space-y-2 grayscale hover:grayscale-0 transition-all">
                                                        <div className="flex justify-between text-[9px] font-black uppercase text-zinc-600 tracking-widest">
                                                            <span>{emotionLabels[key] || key}</span>
                                                            <span>{val}</span>
                                                        </div>
                                                        <input
                                                            type="range" min="0" max="1" step="0.1"
                                                            value={val}
                                                            onChange={(e) => setEmotionVectors(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                                                            className="w-full h-0.5 bg-zinc-800 rounded-full appearance-none accent-zinc-500 cursor-pointer"
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dialogue + Result Side-by-Side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left: Dialogue Input */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <MessageSquare size={16} className="text-rose-400" /> 台词文本输入
                                    </h3>
                                    <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800/50">
                                        {text.length} 字
                                    </div>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-cine-accent/20 to-indigo-500/20 rounded-[32px] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                                    <div className="relative">
                                        <textarea
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            placeholder="在这里输入需要生成的对白..."
                                            className="w-full h-64 bg-[#080808] border border-zinc-800/80 rounded-[32px] p-8 text-xl font-serif font-light outline-none focus:border-cine-accent/40 transition-all resize-none shadow-2xl placeholder:opacity-20 leading-relaxed text-zinc-100"
                                        />
                                        <div className="absolute right-6 bottom-6 flex gap-3">
                                            <button
                                                onClick={() => setText('')}
                                                className="p-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-700 hover:text-rose-400 rounded-2xl transition-all border border-zinc-800/50"
                                                title="清空台词"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button
                                                onClick={handleGenerate}
                                                disabled={isGenerating}
                                                className="px-8 py-3 bg-cine-accent text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:scale-100 shadow-[0_8px_30px_rgba(201,255,86,0.25)]"
                                            >
                                                {isGenerating ? <RefreshCcw size={16} className="animate-spin" /> : <Mic size={16} fill="currentColor" />}
                                                {isGenerating ? '生成中...' : '生成配音'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Progress / Result */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Volume2 size={16} className="text-emerald-400" /> 生成结果
                                    </h3>
                                    {generatedAudioUrl && (
                                        <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <CheckCircle size={12} /> 已完成
                                        </div>
                                    )}
                                </div>

                                <div className={`
                                    relative rounded-[32px] border transition-all overflow-hidden min-h-[256px] flex items-center justify-center
                                    ${isGenerating || generatedAudioUrl
                                        ? 'bg-zinc-900/40 border-zinc-800/50 p-8'
                                        : 'bg-zinc-950/50 border-zinc-900/50 border-dashed'
                                    }
                                `}>
                                    {isGenerating ? (
                                        <div className="flex flex-col items-center gap-8 w-full py-4">
                                            {/* Indeterminate Progress Animation */}
                                            <div className="relative w-full h-1.5 bg-zinc-950 rounded-full border border-zinc-800/50 overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cine-accent/80 to-transparent animate-shimmer rounded-full" />
                                            </div>
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-12 h-12 border-t-2 border-r-2 border-cine-accent rounded-full animate-spin" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Wand2 size={18} className="text-cine-accent animate-pulse" />
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">
                                                    AI 正在推理中...
                                                </span>
                                                <span className="text-[9px] text-zinc-700 font-medium">
                                                    首次生成约需 10-30 秒，相同设置将瞬间完成
                                                </span>
                                            </div>
                                        </div>
                                    ) : generatedAudioUrl ? (
                                        <div className="flex flex-col gap-6 w-full">
                                            <div className="flex items-center gap-6">
                                                <button
                                                    onClick={togglePlay}
                                                    className="w-16 h-16 bg-cine-accent text-black rounded-[20px] flex items-center justify-center hover:scale-105 transition-all shadow-xl active:scale-95 shrink-0"
                                                >
                                                    {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                                                </button>
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{selectedCharacter?.name || 'CUSTOM'}</span>
                                                        <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                                                            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="h-2 bg-black/60 rounded-full overflow-hidden cursor-pointer"
                                                        onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const p = (e.clientX - rect.left) / rect.width;
                                                            if (resultAudioRef.current) resultAudioRef.current.currentTime = p * duration;
                                                        }}
                                                    >
                                                        <div
                                                            className="h-full bg-gradient-to-r from-cine-accent to-emerald-400 transition-all duration-150"
                                                            style={{ width: `${(currentTime / duration) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 justify-end">
                                                <button
                                                    onClick={() => onSaveToTimeline?.(generatedAudioUrl!, text, duration)}
                                                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2 active:scale-95"
                                                >
                                                    <ArrowRightCircle size={14} /> 同步
                                                </button>
                                                <button
                                                    onClick={handleSaveAsAsset}
                                                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2 active:scale-95"
                                                >
                                                    <Save size={14} /> 存入媒体库
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!generatedAudioUrl) return;
                                                        try {
                                                            const res = await fetch(generatedAudioUrl);
                                                            const blob = await res.blob();
                                                            const url = URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `${selectedCharacter?.name || 'audio'}_${Date.now()}.wav`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                            URL.revokeObjectURL(url);
                                                            setSuccess("音频下载成功！");
                                                        } catch (e) {
                                                            setError("下载失败");
                                                        }
                                                    }}
                                                    className="px-5 py-2.5 bg-cine-accent/10 hover:bg-cine-accent/20 text-cine-accent rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-cine-accent/20 flex items-center gap-2 active:scale-95"
                                                >
                                                    <Download size={14} /> 下载
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 text-center opacity-30">
                                            <Volume2 size={40} strokeWidth={1} />
                                            <span className="text-[9px] uppercase font-bold tracking-[0.3em]">等待生成</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {generatedAudioUrl && <audio ref={resultAudioRef} src={generatedAudioUrl} hidden />}

            {/* Float Notifications */}
            {error && (
                <div className="fixed bottom-12 left-12 bg-red-500 text-white px-8 py-4 rounded-3xl flex items-center gap-4 shadow-[0_20px_60px_rgba(239,68,68,0.3)] animate-in fade-in slide-in-from-left-8 duration-500 z-[100] border border-red-400/20">
                    <AlertCircle size={20} />
                    <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg"><XIcon size={16} /></button>
                </div>
            )}
            {success && (
                <div className="fixed bottom-12 left-12 bg-cine-accent text-black px-8 py-4 rounded-3xl flex items-center gap-4 shadow-[0_20px_60px_rgba(201,255,86,0.3)] animate-in fade-in slide-in-from-left-8 duration-500 z-[100] border border-white/10">
                    <CheckCircle size={20} />
                    <span className="text-xs font-black uppercase tracking-widest">{success}</span>
                    <button onClick={() => setSuccess(null)} className="p-1 hover:bg-black/10 rounded-lg"><XIcon size={16} /></button>
                </div>
            )}
        </div>
    );
});

const UserCircles = ({ size, className }: { size: number, className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </svg>
);

export default DubbingPanel;
