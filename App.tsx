
import React, { useState, useEffect, useRef } from 'react';
import { storageService } from './services/storageService';
import { videoBlobStorage } from './services/videoBlobStorage';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CollageEditor } from './components/CollageEditor';
import CharacterLibrary from './components/CharacterLibrary';
import LocationLibrary from './components/LocationLibrary';
import StoryboardLibrary from './components/StoryboardLibrary';
import { TimelineEditor } from './components/TimelineEditor';
import { GlobalProgress } from './components/GlobalProgress';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
    Asset, GeneratedImage, GenerationMode, AspectRatio, ImageSize,
    NodeType, TabType, Character, Location, StoryboardProject,
    ArtStyle, VideoMotionConfig, TimelineData, TimelineClip,
    StoryboardItem, CanvasSession, AppSettings, Project
} from './types';
import {
    generateMultiViewGrid, fileToBase64, enhancePrompt, analyzeAsset,
    ReferenceImageData, ensureApiKey, generateCameraMovement,
    stitchImages, generateVideo, analyzeFrameForVideo, updateGeminiSettings,
    getProviderForModel, resizeImageBase64
} from './services/geminiService';
import { SettingsPanel } from './components/SettingsPanel';
import { VideoMotionPanel } from './components/VideoMotionPanel';
import { CanvasTabs } from './components/CanvasTabs';
import { CanvasPartitionBar } from './components/CanvasPartitionBar';
import { SyncTargetModal } from './components/SyncTargetModal';
import { Button } from './components/Button';
import {
    AlertCircle, X as XIcon, ShieldCheck, PanelLeftClose, PanelLeftOpen,
    CheckCircle, Zap, MonitorPlay, Briefcase, Plus, Archive, ChevronRight, Folder
} from 'lucide-react';
import JSZip from 'jszip';
import NavBar from './components/NavBar';
import DubbingPanel from './components/DubbingPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProjectManager from './components/ProjectManager';
import { useUIStore, useProjectStore, useCharacterStore, useCanvasStore, useLocationStore, useSettingsStore } from './stores';

// --- Constants ---
const DEFAULT_GROUP = '默认分区';

const App: React.FC = () => {
    // --- State ---
    const [assets, setAssets] = useState<Asset[]>([]);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [canvasSessions, setCanvasSessions] = useState<CanvasSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>('');
    const [activeSessionGroup, setActiveSessionGroup] = useState<string>(DEFAULT_GROUP);

    // Project Management
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string>('');
    const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

    // Selection State
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [isShiftSelection, setIsShiftSelection] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);

    // Generation Settings
    const [mode, setMode] = useState<GenerationMode>(GenerationMode.GRID_2x2);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
    const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
    const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.CG_GAME_ART);
    const [prompt, setPrompt] = useState<string>('');

    // Processing Flags
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStep, setGenerationStep] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // UI State
    const [isCollageEditorOpen, setIsCollageEditorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('canvas');
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(360);
    const [isResizingRight, setIsResizingRight] = useState(false);

    // Zustand UI store 同步
    const storeSetActiveTab = useUIStore(state => state.setActiveTab);
    const storeOpenSettings = useUIStore(state => state.openSettings);
    const storeCloseSettings = useUIStore(state => state.closeSettings);
    const storeSetProjectManager = useUIStore(state => state.isProjectManagerOpen);
    const storeToggleProjectManager = useUIStore(state => state.toggleProjectManager);

    // 当 activeTab 变化时，同步到 Zustand store
    useEffect(() => {
        storeSetActiveTab(activeTab);
    }, [activeTab, storeSetActiveTab]);

    // 当 isSettingsOpen 变化时，同步到 Zustand store
    useEffect(() => {
        if (isSettingsOpen) {
            storeOpenSettings();
        } else {
            storeCloseSettings();
        }
    }, [isSettingsOpen, storeOpenSettings, storeCloseSettings]);

    // 当 isProjectManagerOpen 变化时，同步到 Zustand store
    useEffect(() => {
        // 只在状态不一致时同步，避免循环
        if (isProjectManagerOpen !== storeSetProjectManager) {
            storeToggleProjectManager();
        }
    }, [isProjectManagerOpen]);

    // Business Data
    const [characters, setCharacters] = useState<Character[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [storyboardProjects, setStoryboardProjects] = useState<StoryboardProject[]>([]);
    const [pendingStoryboardItem, setPendingStoryboardItem] = useState<StoryboardItem | null>(null);

    // Zustand Data Store 镜像同步
    // 这些 store 作为 App useState 的镜像，供其他组件直接读取
    const storeSetCurrentProject = useProjectStore(state => state.setCurrentProject);
    const storeSetCharacters = useCharacterStore(state => state.setCharacters);
    const storeSetNodes = useCanvasStore(state => state.setNodes);
    const storeSetCurrentSession = useCanvasStore(state => state.setCurrentSession);

    // 当 projects 变化时，同步到 Zustand store
    useEffect(() => {
        useProjectStore.setState({ projects });
    }, [projects]);

    // 当 activeProjectId 变化时，同步到 Zustand store
    useEffect(() => {
        storeSetCurrentProject(activeProjectId || null);
    }, [activeProjectId, storeSetCurrentProject]);

    // 当 characters 变化时，同步到 Zustand store
    useEffect(() => {
        storeSetCharacters(characters);
    }, [characters, storeSetCharacters]);

    // 当 images 变化时，同步到 Zustand canvasStore
    useEffect(() => {
        storeSetNodes(images);
    }, [images, storeSetNodes]);

    // --- Clipboard State for Cut/Copy/Paste ---
    const [clipboard, setClipboard] = useState<{ nodes: GeneratedImage[]; isCut: boolean } | null>(null);

    // --- Right Sidebar Resize Handlers ---
    const startResizingRight = React.useCallback((e: React.MouseEvent) => {
        setIsResizingRight(true);
        e.preventDefault();
    }, []);

    const stopResizingRight = React.useCallback(() => {
        setIsResizingRight(false);
    }, []);

    const resizeRight = React.useCallback((e: MouseEvent) => {
        if (isResizingRight) {
            const newWidth = window.innerWidth - e.clientX;
            // Limit width between 300px and 800px or 40% of screen
            const maxWidth = Math.min(800, window.innerWidth * 0.45);
            if (newWidth >= 320 && newWidth <= maxWidth) {
                setRightSidebarWidth(newWidth);
            }
        }
    }, [isResizingRight]);

    useEffect(() => {
        if (isResizingRight) {
            window.addEventListener('mousemove', resizeRight);
            window.addEventListener('mouseup', stopResizingRight);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resizeRight);
            window.removeEventListener('mouseup', stopResizingRight);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', resizeRight);
            window.removeEventListener('mouseup', stopResizingRight);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizingRight, resizeRight, stopResizingRight]);

    const handleCopy = React.useCallback(() => {
        if (selectedImageIds.length === 0) return;
        const selectedNodes = images.filter(img => selectedImageIds.some(sid => sid.split(':')[0] === img.id));
        if (selectedNodes.length > 0) {
            setClipboard({ nodes: selectedNodes.map(n => ({ ...n })), isCut: false });
            setSuccess(`已复制 ${selectedNodes.length} 个镜头模块`);
        }
    }, [selectedImageIds, images, setSuccess]);

    const handleCut = React.useCallback(() => {
        if (selectedImageIds.length === 0) return;
        const selectedNodes = images.filter(img => selectedImageIds.some(sid => sid.split(':')[0] === img.id));
        if (selectedNodes.length > 0) {
            setClipboard({ nodes: selectedNodes.map(n => ({ ...n })), isCut: true });
            setSuccess(`已剪切 ${selectedNodes.length} 个镜头模块`);
        }
    }, [selectedImageIds, images, setSuccess]);

    const handlePaste = React.useCallback(() => {
        if (!clipboard || clipboard.nodes.length === 0) return;

        if (clipboard.isCut) {
            // Cut logic: Move existing nodes to current session and group
            const nodeIdsToMove = new Set(clipboard.nodes.map(n => n.id));
            setImages(prev => prev.map(img => {
                if (nodeIdsToMove.has(img.id)) {
                    return {
                        ...img,
                        sessionId: activeSessionId,
                        group: activeSessionGroup
                    };
                }
                return img;
            }));
            setClipboard(null); // Clear clipboard after cut-paste
            setSuccess(`已移动 ${clipboard.nodes.length} 个镜头模块到当前分镜分区`);
        } else {
            // Copy logic: Create new nodes with new IDs
            const idMap = new Map<string, string>();
            const newNodes = clipboard.nodes.map(node => {
                const newId = crypto.randomUUID();
                idMap.set(node.id, newId);
                return {
                    ...node,
                    id: newId,
                    sessionId: activeSessionId,
                    group: activeSessionGroup,
                    timestamp: Date.now(),
                    position: {
                        x: (node.position?.x || 0) + 50,
                        y: (node.position?.y || 0) + 50
                    }
                };
            });

            // Fix parent linkages for new nodes (chain maintenance)
            const finalNodes = newNodes.map(node => {
                if (node.parentId && idMap.has(node.parentId)) {
                    return { ...node, parentId: idMap.get(node.parentId) };
                }
                return node;
            });

            setImages(prev => [...prev, ...finalNodes]);
            setSuccess(`已复制 ${clipboard.nodes.length} 个镜头模块到当前分镜分区`);
        }
    }, [clipboard, activeSessionId, activeSessionGroup, setImages, setSuccess]);

    // --- Global Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only process canvas shortcuts when clipboard tools or inputs aren't focused
            if (activeTab !== 'canvas') return;
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

            if (cmdOrCtrl) {
                if (e.key.toLowerCase() === 'c') {
                    handleCopy();
                } else if (e.key.toLowerCase() === 'x') {
                    handleCut();
                } else if (e.key.toLowerCase() === 'v') {
                    handlePaste();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, handleCopy, handleCut, handlePaste]);

    // 当 canvasSessions 变化时，同步到 Zustand canvasStore
    useEffect(() => {
        useCanvasStore.setState({ sessions: canvasSessions });
    }, [canvasSessions]);

    // 当 activeSessionId 变化时，同步到 Zustand canvasStore
    useEffect(() => {
        storeSetCurrentSession(activeSessionId || null);
    }, [activeSessionId, storeSetCurrentSession]);

    // 当 locations 变化时，同步到 Zustand locationStore
    const storeSetLocations = useLocationStore(state => state.setLocations);
    useEffect(() => {
        storeSetLocations(locations);
    }, [locations, storeSetLocations]);


    const [isInitialized, setIsInitialized] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [isRefiningVideoPrompt, setIsRefiningVideoPrompt] = useState(false);

    const [videoMotionConfig, setVideoMotionConfig] = useState<VideoMotionConfig>({
        intensity: 5,
        motionType: 'auto',
        duration: 4,
        selectedCharacterIds: [],
        selectedLocationIds: [],
        isSpeaking: false
    });

    const [timelineData, setTimelineData] = useState<TimelineData>({
        tracks: [
            { id: 'v1', name: '视频主轨道', type: 'video', clips: [] },
            { id: 'v2', name: '覆盖层', type: 'video', clips: [] },
            { id: 'a1', name: '背景音乐', type: 'audio', clips: [] },
            { id: 'a2', name: '音效/配音', type: 'audio', clips: [] },
            { id: 's1', name: '字幕', type: 'subtitle', clips: [] },
        ],
        totalDuration: 60,
        fps: 30
    });

    const [appSettings, setAppSettings] = useState<AppSettings>({
        apiKeys: [],
        roles: {
            scriptAnalysis: 'claude-sonnet-4-5',
            imageGeneration: 'gemini-3-pro-image',
            videoGeneration: 'veo-3.1-generate-preview',
            audioGeneration: 'future-audio-model',
            chatAssistant: 'gemini-3-flash'
        },
        customModels: [],
        autoSwitchKey: true,
        indexTtsUrl: 'http://127.0.0.1:7860'
    });

    // 当 appSettings 变化时，同步到 Zustand settingsStore
    const storeUpdateSettings = useSettingsStore(state => state.updateSettings);
    useEffect(() => {
        storeUpdateSettings(appSettings);
    }, [appSettings, storeUpdateSettings]);

    // Partition Groups (Sub-partitions within the project)
    const sessionGroupNames = React.useMemo(() => {
        const groups = new Set<string>();

        // 1. From session metadata
        if (canvasSessions) {
            canvasSessions.forEach(s => {
                if (!s) return;
                // Normalize and add from groups list
                if (s.groups) {
                    s.groups.forEach(g => {
                        if (g && typeof g === 'string') {
                            const trimmed = g.trim();
                            if (trimmed && trimmed !== '默认') groups.add(trimmed);
                        }
                    });
                }
                // Also legacy single group
                if (s.group && typeof s.group === 'string') {
                    const trimmed = s.group.trim();
                    if (trimmed && trimmed !== '默认') groups.add(trimmed);
                }
            });
        }

        // 2. From image tags
        if (images) {
            images.forEach(img => {
                if (img && img.group && typeof img.group === 'string') {
                    const trimmed = img.group.trim();
                    if (trimmed) groups.add(trimmed);
                }
            });
        }

        // 3. Always include the active group to prevent it from disappearing
        if (activeSessionGroup && typeof activeSessionGroup === 'string') {
            groups.add(activeSessionGroup.trim());
        }

        // If no groups found, return default
        if (groups.size === 0) return [DEFAULT_GROUP];

        // Unique and sorted list
        return Array.from(groups).sort();
    }, [canvasSessions, images, activeSessionGroup]);

    // --- Computed ---
    const activeImages = React.useMemo(() => {
        const safeImages = images || [];
        return safeImages.filter(img => {
            if (!img) return false;

            // An image belongs to the current view if:
            // (a) It matches the active session AND active partition
            const matchesActiveSession = img.sessionId === activeSessionId;
            const matchesActiveGroup = (img.group || '默认分区') === activeSessionGroup;

            if (matchesActiveSession && matchesActiveGroup) return true;

            // (b) OR (Migration) it belongs to a LEGACY session that was associated with this partition
            const belongsToLegacySession = canvasSessions.find(s =>
                s.id === img.sessionId && (s.group || '默认分区') === activeSessionGroup
            );

            return !!belongsToLegacySession;
        });
    }, [images, activeSessionId, activeSessionGroup, canvasSessions]);

    const activeImage = React.useMemo(() =>
        images.find(i => selectedImageIds[0]?.split(':')[0] === i.id),
        [images, selectedImageIds]);

    const isSelectionVideoReady = React.useMemo(() => {
        if (selectedImageIds.length === 0) return false;
        const startId = selectedImageIds[0];
        const [startMainId, startSliceIdx] = startId.split(':');
        const startNode = images.find(i => i.id === startMainId);
        if (!startNode) return false;

        if (startSliceIdx !== undefined && startNode.slices) {
            const idx = parseInt(startSliceIdx);
            return !!startNode.slices[idx];
        }
        return !!startNode.url;
    }, [images, selectedImageIds]);

    const activeAsset = React.useMemo(() =>
        assets.find(a => a.id === selectedAssetId),
        [assets, selectedAssetId]);

    const activeDisplayUrl = React.useMemo(() => {
        if (selectedAssetId) return activeAsset?.previewUrl;
        if (!activeImage) return undefined;
        const sliceIdx = selectedImageIds[0]?.split(':')[1];
        if (sliceIdx !== undefined && activeImage.slices) return activeImage.slices[parseInt(sliceIdx)];
        return activeImage.url;
    }, [selectedAssetId, activeAsset, activeImage, selectedImageIds]);

    // For horizontal workflow: root nodes stack vertically (Y increases), children extend horizontally (X increases)
    const getNextChainStartY = React.useCallback(() => {
        const sessionImages = images.filter(img => img.sessionId === activeSessionId);
        if (sessionImages.length === 0) return 100;
        // Find the maximum Y position among root nodes (nodes without parentId in this session)
        const rootNodes = sessionImages.filter(img => !img.parentId);
        if (rootNodes.length === 0) return 100;
        const maxY = Math.max(...rootNodes.map(img => img.position?.y || 0));
        return maxY + 500; // Stack below with 500px gap
    }, [images, activeSessionId]);

    // --- Data Persistence ---
    useEffect(() => {
        const loadInitialData = async () => {
            // --- EMERGENCY STORAGE CLEANUP ---
            // Purge large legacy keys from localStorage that are now in IndexedDB.
            // This prevents QuotaExceededError during startup.
            const purgeKeys = [
                'director-deck-characters',
                'director-deck-canvas',
                'director-deck-projects',
                'director-deck-locations',
                'director_deck_session_recovery',
                'dubbingPanelState'
            ];
            purgeKeys.forEach(key => {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        console.log(`[Storage] Purging legacy key from localStorage: ${key} (${Math.round(data.length / 1024)} KB)`);
                        localStorage.removeItem(key);
                    }
                } catch (e) { /* ignore cleanup errors */ }
            });

            // Also purge API cache keys
            try {
                const apiCacheKeys: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('api_cache_') || key.startsWith('qwenNewNodes'))) {
                        apiCacheKeys.push(key);
                    }
                }
                apiCacheKeys.forEach(k => localStorage.removeItem(k));
                if (apiCacheKeys.length > 0) console.log(`[Storage] Purged ${apiCacheKeys.length} legacy cache keys from localStorage`);
            } catch (e) { }

            try {
                // Initialize core storage (IndexedDB)
                await storageService.init();

                // 1. Load Projects
                let allProjects = await storageService.getAllProjects();
                const settings = await storageService.getSettings() as any;

                // 2. Migration & Data Rescue: Scan for legacy data if needed
                if (allProjects.length === 0) {
                    console.log("[Storage] No projects found. Checking for stranded data to migrate...");
                    const defaultProject: Project = {
                        id: 'default_project',
                        name: '默认项目',
                        description: '从旧版本迁移的项目',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        status: 'active'
                    };

                    // Check for any stranded items in IDB stores that aren't project-linked
                    const [assets, images, chars, locs, storys, sessions, oldTimeline] = await Promise.all([
                        storageService.getAllItems<Asset>('assets'),
                        storageService.getAllItems<GeneratedImage>('images'),
                        storageService.getAllItems<Character>('characters'),
                        storageService.getAllItems<Location>('locations'),
                        storageService.getAllItems<StoryboardProject>('storyboard_projects'),
                        storageService.getSessions(),
                        storageService.getAllItems<any>('timeline')
                    ]);

                    // If we found some data, link it to the default project
                    if (assets.length > 0 || images.length > 0 || chars.length > 0 || locs.length > 0) {
                        console.log("[Storage] Migrating legacy data to default project...");

                        // Fix sessions
                        let migratedSessions = sessions;
                        if (migratedSessions.length === 0) {
                            migratedSessions = [{ id: 'default', projectId: defaultProject.id, name: '主工作区', createdAt: Date.now() }];
                        } else {
                            migratedSessions = migratedSessions.map(s => ({ ...s, projectId: defaultProject.id }));
                        }

                        const validSessionIds = new Set(migratedSessions.map(s => s.id));
                        const fallbackSessionId = migratedSessions[0].id;

                        // Fix images assignment
                        const migratedImages = images.map(img => ({
                            ...img,
                            projectId: defaultProject.id,
                            sessionId: (img.sessionId && validSessionIds.has(img.sessionId)) ? img.sessionId : fallbackSessionId
                        }));

                        await Promise.all([
                            storageService.saveProjects([defaultProject]),
                            storageService.saveItemsForProject('assets', assets, defaultProject.id),
                            storageService.saveItemsForProject('images', migratedImages, defaultProject.id),
                            storageService.saveItemsForProject('characters', chars, defaultProject.id),
                            storageService.saveItemsForProject('locations', locs, defaultProject.id),
                            storageService.saveItemsForProject('storyboard_projects', storys, defaultProject.id),
                            storageService.saveSessions(migratedSessions, defaultProject.id),
                            oldTimeline.length > 0 ? storageService.saveTimeline({ ...oldTimeline[0], projectId: defaultProject.id }) : Promise.resolve()
                        ]);

                        allProjects = [defaultProject];
                    } else {
                        // Truly empty, create empty default project
                        await storageService.saveProjects([defaultProject]);
                        allProjects = [defaultProject];
                    }
                }

                setProjects(allProjects);

                // 3. Determine Active Project & Settings
                const initialProjectId = settings?.activeProjectId || (allProjects.length > 0 ? allProjects[0].id : 'default_project');

                // 4. Load Global Settings First
                if (settings?.appSettings) {
                    console.log("[Storage] Restoring app settings from db:", settings.appSettings.apiKeys?.length, "keys");
                    setAppSettings(settings.appSettings);
                    updateGeminiSettings(settings.appSettings);
                }

                if (settings?.activeSessionGroup) {
                    console.log("[Storage] Restoring active group:", settings.activeSessionGroup);
                    setActiveSessionGroup(settings.activeSessionGroup);
                }

                setActiveProjectId(initialProjectId);

                // 5. Load Active Project Data
                await loadProjectData(initialProjectId, settings);

                setIsInitialized(true);
            } catch (error) {
                console.error("Critical Storage Initialization Error:", error);

                // If it's a quota error, we failed despite purge - try extreme measure
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    console.error("[Storage] FATAL: Quota still exceeded after partial purge. Resetting settings...");
                    localStorage.removeItem('director-deck-settings');
                }

                setError(`应用初始化失败: ${error instanceof Error ? error.message : String(error)}`);
                setIsInitialized(true);
            }
        };

        loadInitialData();
    }, []);

    const loadProjectData = async (projectId: string, settings?: any) => {
        console.log(`[Storage] Loading data for project: ${projectId}`);
        try {
            let [
                savedAssets, savedImages, savedCharacters, savedLocations,
                savedProjects, savedSessions, savedTimeline
            ] = await Promise.all([
                storageService.getItemsForProject<Asset>('assets', projectId),
                storageService.getItemsForProject<GeneratedImage>('images', projectId),
                storageService.getItemsForProject<Character>('characters', projectId),
                storageService.getItemsForProject<Location>('locations', projectId),
                storageService.getItemsForProject<StoryboardProject>('storyboard_projects', projectId),
                storageService.getSessions(projectId),
                storageService.getTimeline(projectId)
            ]);

            // --- EMERGENCY FALLBACK ---
            // If it's the default project and we found nothing, try a blind scan of the entire DB
            if (projectId === 'default_project' && (savedImages || []).length === 0) {
                console.warn("[Storage] Default project empty? Performing blind data sweep...");
                const [blindImages, blindAssets, blindSessions, blindStorys] = await Promise.all([
                    storageService.getAllItems<GeneratedImage>('images'),
                    storageService.getAllItems<Asset>('assets'),
                    storageService.getSessions(),
                    storageService.getAllItems<StoryboardProject>('storyboard_projects')
                ]);

                if (blindImages.length > 0) {
                    console.log(`[Storage] Rescue mission success! Found ${blindImages.length} lost images.`);
                    savedImages = blindImages;
                    savedAssets = blindAssets.length > 0 ? blindAssets : savedAssets;
                    savedSessions = blindSessions.length > 0 ? blindSessions : savedSessions;
                    savedProjects = blindStorys.length > 0 ? blindStorys : savedProjects;
                }
            }

            console.log(`[Storage] Data loaded: ${(savedImages || []).length} images, ${(savedAssets || []).length} assets`);

            // Create object URLs for blobs
            const processedAssets = (savedAssets || []).map(asset => {
                try {
                    const file = asset.file as any;
                    if (file && (file instanceof Blob || file instanceof File)) {
                        return { ...asset, previewUrl: URL.createObjectURL(file) };
                    }
                    console.warn("[Storage] Asset file is not a Blob:", asset.id);
                    return asset;
                } catch (e) {
                    console.warn("[Storage] Failed to create object URL for asset:", asset.id, e);
                    return asset;
                }
            });

            // Restore video blobs from IndexedDB storage
            let videoBlobs = new Map<string, Blob>();
            try {
                await videoBlobStorage.init();
                videoBlobs = await videoBlobStorage.getVideosByProject(projectId);
                console.log(`[Storage] Restored ${videoBlobs.size} video blobs from IndexedDB`);
            } catch (e) {
                console.warn('[Storage] Failed to load video blobs:', e);
            }

            const processedImages = (savedImages || []).map(img => {
                try {
                    // Check if node should have a video (either type 'video' or 'render' with video data)
                    const nodeHasVideo = img.nodeType === 'video' || (img.nodeType === 'render' && (img.videoBlob || videoBlobs.has(img.id)));

                    if (nodeHasVideo) {
                        const blob = (videoBlobs.get(img.id) || img.videoBlob) as any;
                        if (blob && (blob instanceof Blob || blob instanceof File)) {
                            return { ...img, videoBlob: blob, videoUrl: URL.createObjectURL(blob) };
                        }
                    }
                    return img;
                } catch (e) {
                    console.warn("[Storage] Failed to restore video for image:", img.id, e);
                    return img;
                }
            });

            setAssets(processedAssets);
            setImages(processedImages);
            setCharacters(savedCharacters || []);
            setLocations(savedLocations || []);
            setStoryboardProjects(savedProjects || []);

            if (savedTimeline) {
                setTimelineData(savedTimeline as any);
            } else {
                // Reset timeline for new project
                setTimelineData({
                    id: crypto.randomUUID(),
                    projectId,
                    tracks: [
                        { id: 'v1', name: '视频主轨道', type: 'video', clips: [] },
                        { id: 'v2', name: '覆盖层', type: 'video', clips: [] },
                        { id: 'a1', name: '背景音乐', type: 'audio', clips: [] },
                        { id: 'a2', name: '音效/配音', type: 'audio', clips: [] },
                        { id: 's1', name: '字幕', type: 'subtitle', clips: [] },
                    ],
                    totalDuration: 60,
                    fps: 30
                });
            }

            let sessions = (savedSessions || []).filter(s => s && s.projectId === projectId);
            if (sessions.length === 0) {
                // For the default project, we prioritize the ID 'default' to match legacy data
                const defaultId = projectId === 'default_project' ? 'default' : ('default_' + projectId);
                sessions = [{ id: defaultId, projectId, name: '主工作区', createdAt: Date.now() }];
            }
            setCanvasSessions(sessions);

            // Set initial session
            if (sessions.length > 0) {
                const targetSessionId = settings?.activeSessionId;
                const exists = sessions.some(s => s.id === targetSessionId);
                setActiveSessionId(exists ? targetSessionId : sessions[0].id);
            }
        } catch (error) {
            console.error("Error loading project data:", error);
        }
    };

    // Save effects - with debounce for settings to prevent flickering
    // --- DEBOUNCED PERSISTENCE ---
    const assetsSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (assetsSaveTimeoutRef.current) clearTimeout(assetsSaveTimeoutRef.current);
        assetsSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveItemsForProject('assets', assets, activeProjectId);
        }, 800);
        return () => { if (assetsSaveTimeoutRef.current) clearTimeout(assetsSaveTimeoutRef.current); };
    }, [assets, isInitialized, activeProjectId]);

    const imagesSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (imagesSaveTimeoutRef.current) clearTimeout(imagesSaveTimeoutRef.current);
        imagesSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveItemsForProject('images', images, activeProjectId);
        }, 1000); // Images can be large, save less frequently
        return () => { if (imagesSaveTimeoutRef.current) clearTimeout(imagesSaveTimeoutRef.current); };
    }, [images, isInitialized, activeProjectId]);

    const charactersSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (charactersSaveTimeoutRef.current) clearTimeout(charactersSaveTimeoutRef.current);
        charactersSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveItemsForProject('characters', characters, activeProjectId);
        }, 500);
        return () => { if (charactersSaveTimeoutRef.current) clearTimeout(charactersSaveTimeoutRef.current); };
    }, [characters, isInitialized, activeProjectId]);

    const locationsSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (locationsSaveTimeoutRef.current) clearTimeout(locationsSaveTimeoutRef.current);
        locationsSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveItemsForProject('locations', locations, activeProjectId);
        }, 500);
        return () => { if (locationsSaveTimeoutRef.current) clearTimeout(locationsSaveTimeoutRef.current); };
    }, [locations, isInitialized, activeProjectId]);

    const storyboardSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (storyboardSaveTimeoutRef.current) clearTimeout(storyboardSaveTimeoutRef.current);
        storyboardSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveItemsForProject('storyboard_projects', storyboardProjects, activeProjectId);
        }, 600);
        return () => { if (storyboardSaveTimeoutRef.current) clearTimeout(storyboardSaveTimeoutRef.current); };
    }, [storyboardProjects, isInitialized, activeProjectId]);

    const sessionsSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (sessionsSaveTimeoutRef.current) clearTimeout(sessionsSaveTimeoutRef.current);
        sessionsSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveSessions(canvasSessions, activeProjectId);
        }, 400);
        return () => { if (sessionsSaveTimeoutRef.current) clearTimeout(sessionsSaveTimeoutRef.current); };
    }, [canvasSessions, isInitialized, activeProjectId]);

    const timelineSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isInitialized || !activeProjectId) return;
        if (timelineSaveTimeoutRef.current) clearTimeout(timelineSaveTimeoutRef.current);
        timelineSaveTimeoutRef.current = window.setTimeout(() => {
            storageService.saveTimeline(timelineData);
        }, 700);
        return () => { if (timelineSaveTimeoutRef.current) clearTimeout(timelineSaveTimeoutRef.current); };
    }, [timelineData, isInitialized, activeProjectId]);

    // Debounced settings save to prevent flickering during rapid updates
    const settingsSaveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        // CRITICAL GUARD: Never save settings until we are fully initialized and have valid projects
        if (!isInitialized || !activeProjectId || projects.length === 0) return;

        if (settingsSaveTimeoutRef.current) {
            clearTimeout(settingsSaveTimeoutRef.current);
        }
        settingsSaveTimeoutRef.current = window.setTimeout(() => {
            console.log("[Storage] Saving global settings and project pointer...");
            storageService.saveSettings({
                mode,
                aspectRatio,
                imageSize,
                artStyle,
                activeSessionId,
                activeSessionGroup,
                appSettings,
                activeProjectId
            });
        }, 1000); // Higher delay for safety
        return () => {
            if (settingsSaveTimeoutRef.current) clearTimeout(settingsSaveTimeoutRef.current);
        };
    }, [mode, aspectRatio, imageSize, artStyle, activeSessionId, activeSessionGroup, appSettings, activeProjectId, isInitialized, projects.length]);

    // Debounced Gemini settings update
    const geminiSettingsTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (geminiSettingsTimeoutRef.current) {
            clearTimeout(geminiSettingsTimeoutRef.current);
        }
        geminiSettingsTimeoutRef.current = window.setTimeout(() => {
            updateGeminiSettings(appSettings);
        }, 200);
        return () => {
            if (geminiSettingsTimeoutRef.current) clearTimeout(geminiSettingsTimeoutRef.current);
        };
    }, [appSettings]);

    // Listen for Qwen node creation events from Canvas
    useEffect(() => {
        const handleQwenNodeCreated = (event: CustomEvent<GeneratedImage>) => {
            const newNode = event.detail;
            console.log('[App] Qwen node created:', newNode.id);
            setImages(prev => [...prev, newNode]);
            setSuccess('Qwen 编辑已创建新的变体节点');
        };

        window.addEventListener('qwen-node-created', handleQwenNodeCreated as EventListener);
        return () => {
            window.removeEventListener('qwen-node-created', handleQwenNodeCreated as EventListener);
        };
    }, []);

    // --- Project Handlers ---
    const handleCreateProject = async (name: string, description: string) => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            name,
            description,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'active'
        };
        const updatedProjects = [...projects, newProject];
        setProjects(updatedProjects);
        await storageService.saveProjects(updatedProjects);
        await handleSwitchProject(newProject.id);
        setIsProjectManagerOpen(false);
        setSuccess(`项目 "${name}" 创建成功`);
    };

    const handleSwitchProject = async (projectId: string) => {
        if (projectId === activeProjectId) return;

        setIsInitialized(false); // Show loading
        setActiveProjectId(projectId);

        // Reload all data for new project
        const [
            savedAssets, savedImages, savedCharacters, savedLocations,
            savedProjects, savedSessions, savedTimeline
        ] = await Promise.all([
            storageService.getItemsForProject<Asset>('assets', projectId),
            storageService.getItemsForProject<GeneratedImage>('images', projectId),
            storageService.getItemsForProject<Character>('characters', projectId),
            storageService.getItemsForProject<Location>('locations', projectId),
            storageService.getItemsForProject<StoryboardProject>('storyboard_projects', projectId),
            storageService.getSessions(projectId),
            storageService.getTimeline(projectId)
        ]);

        const processedAssets = (savedAssets || []).map(asset => ({
            ...asset,
            previewUrl: URL.createObjectURL(asset.file)
        }));

        // Restore video blobs from IndexedDB storage
        let videoBlobs: Map<string, Blob>;
        try {
            await videoBlobStorage.init();
            videoBlobs = await videoBlobStorage.getVideosByProject(projectId);
            console.log(`[Storage] Restored ${videoBlobs.size} video blobs for project ${projectId}`);
        } catch (e) {
            console.warn('[Storage] Failed to load video blobs:', e);
            videoBlobs = new Map();
        }

        const processedImages = (savedImages || []).map(img => {
            if (img.nodeType === 'video') {
                const blob = videoBlobs.get(img.id) || img.videoBlob;
                if (blob) {
                    return { ...img, videoBlob: blob, videoUrl: URL.createObjectURL(blob) };
                }
            }
            return img;
        });

        setAssets(processedAssets);
        setImages(processedImages);
        setCharacters(savedCharacters || []);
        setLocations(savedLocations || []);
        setStoryboardProjects(savedProjects || []);

        if (savedTimeline) {
            setTimelineData(savedTimeline as any);
        } else {
            setTimelineData({
                id: crypto.randomUUID(),
                projectId,
                tracks: [
                    { id: 'v1', name: '视频主轨道', type: 'video', clips: [] },
                    { id: 'v2', name: '覆盖层', type: 'video', clips: [] },
                    { id: 'a1', name: '背景音乐', type: 'audio', clips: [] },
                    { id: 'a2', name: '音效/配音', type: 'audio', clips: [] },
                    { id: 's1', name: '字幕', type: 'subtitle', clips: [] },
                ],
                totalDuration: 60,
                fps: 30
            });
        }

        const projectSessions = (savedSessions || []).filter(s => s.projectId === projectId);
        if (projectSessions.length > 0) {
            setCanvasSessions(projectSessions);
            setActiveSessionId(projectSessions[0].id);
        } else {
            const newSession = { id: 'default_' + projectId, projectId, name: '主工作区', createdAt: Date.now() };
            setCanvasSessions([newSession]);
            setActiveSessionId(newSession.id);
        }

        setIsInitialized(true);
    };

    const handleArchiveProject = async (projectId: string) => {
        const updatedProjects = projects.map(p =>
            p.id === projectId ? { ...p, status: 'archived' as const, updatedAt: Date.now() } : p
        );
        setProjects(updatedProjects);
        await storageService.saveProjects(updatedProjects);
        setSuccess("项目已存档");
    };

    const handleDeleteProject = async (projectId: string) => {
        if (projects.length <= 1) {
            setError("至少需要保留一个项目");
            return;
        }
        if (!window.confirm("确定要删除该项目吗？所有相关素材都将被清除。")) return;

        const updatedProjects = projects.filter(p => p.id !== projectId);
        setProjects(updatedProjects);
        await storageService.deleteProject(projectId);

        if (activeProjectId === projectId) {
            await handleSwitchProject(updatedProjects[0].id);
        }
        setSuccess("项目已删除");
    };

    const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
        const updatedProjects = projects.map(p =>
            p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p
        );
        setProjects(updatedProjects);
        await storageService.saveProjects(updatedProjects);
    };

    // --- Handlers ---
    const handleAddAsset = (files: FileList) => {
        Array.from(files).forEach((file) => {
            const url = URL.createObjectURL(file);
            const newAsset: Asset = { id: crypto.randomUUID(), projectId: activeProjectId, file, previewUrl: url, type: file.type.startsWith('video') ? 'video' : 'image' };
            setAssets(prev => [...prev, newAsset]);
        });
    };

    const handleCreateCollage = async (files: File[], layout: '2x2' | '3x3', targetAr: string) => {
        setIsCollageEditorOpen(false);
        setGenerationStep("正在优化拼贴素材...");
        setIsGenerating(true);
        try {
            const stitchedBase64 = await stitchImages(files, layout, targetAr);
            const res = await fetch(stitchedBase64);
            const blob = await res.blob();
            const file = new File([blob], `collage_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url = URL.createObjectURL(file);
            setAssets(prev => [{ id: crypto.randomUUID(), projectId: activeProjectId, file, previewUrl: url, type: 'image' }, ...prev]);
        } catch (e: any) {
            setError("拼贴失败: " + e.message);
        } finally {
            setIsGenerating(false);
            setGenerationStep("");
        }
    };

    const handleSelectImage = React.useCallback((image: GeneratedImage, isMulti: boolean, sliceIndex?: number) => {
        const id = sliceIndex !== undefined ? `${image.id}:${sliceIndex}` : image.id;
        setSelectedAssetId(undefined);
        if (isMulti) {
            setSelectedImageIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else {
            setSelectedImageIds([id]);
        }
        setIsShiftSelection(isMulti);
        setAnalysisResult('');
        if (!isMulti) {
            setVideoMotionConfig(prev => ({
                ...prev,
                customInstruction: image.cameraDescription || image.prompt || '',
                isSpeaking: !!image.dialogue
            }));
        }
    }, []);

    const handleSelectMultiple = React.useCallback((ids: string[]) => {
        setSelectedImageIds(ids);
        setSelectedAssetId(undefined);
    }, []);

    const handleUpdateNodePosition = React.useCallback((id: string, x: number, y: number) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, position: { x, y } } : img));
    }, []);

    const handleUpdateNodeData = React.useCallback((id: string, data: Partial<GeneratedImage>) => {
        console.log(`[App] Updating node ${id}:`, data);
        setImages(prev => prev.map(img => img.id === id ? { ...img, ...data } : img));
    }, []);

    const handleLinkNodes = React.useCallback((sourceId: string, targetId: string) => {
        setImages(prev => prev.map(img => img.id === targetId ? { ...img, parentId: sourceId } : img));
    }, []);

    const handleDeleteImage = React.useCallback((id: string) => {
        setImages(prev => prev.filter(i => i.id !== id));
    }, []);


    const handleSyncStoryboardItem = (item: StoryboardItem) => {
        setPendingStoryboardItem(item);
        setIsSyncModalOpen(true);
    };

    const confirmSyncToSession = React.useCallback((sessionId: string) => {
        if (!pendingStoryboardItem) return;

        // --- Automatic Recognition Logic ---
        // 1. Identify Characters (Aggressive search in all text fields)
        const rawCharText = (pendingStoryboardItem.characters || '').toLowerCase();
        const rawDescText = (pendingStoryboardItem.description || '').toLowerCase();
        const rawPromptText = (pendingStoryboardItem.aiPrompt || '').toLowerCase();
        const fullSearchSpace = rawCharText + " " + rawDescText + " " + rawPromptText;

        const matchedCharFormIds = characters
            .filter(c => {
                const libName = c.name.toLowerCase().replace(/[（）()\[\]【】]/g, '').trim();
                if (!libName || libName.length < 1) return false;

                // Check if name exists in any field
                if (fullSearchSpace.includes(libName)) return true;

                // Check for partial name match if name is long (e.g. "Hero A" matches "Hero")
                if (libName.length > 2 && rawCharText.includes(libName.substring(0, 3))) return true;

                return false;
            })
            .map(c => c.forms[0]?.id)
            .filter(Boolean) as string[];

        // 2. Identify Locations
        const rawLocText = (pendingStoryboardItem.location || '').toLowerCase();
        const matchedLocFormIds = locations
            .filter(l => {
                const libName = l.name.toLowerCase().trim();
                if (!libName || libName.length < 1 || libName === '未知场景') return false;
                return rawLocText.includes(libName) || rawDescText.includes(libName);
            })
            .map(l => l.forms[0]?.id)
            .filter(Boolean) as string[];
        // ------------------------------------

        const newNode: GeneratedImage = {
            id: crypto.randomUUID(),
            projectId: activeProjectId,
            url: undefined as any, // Intentionally undefined to avoid empty src flickering
            prompt: pendingStoryboardItem.aiPrompt || '',
            textData: pendingStoryboardItem.aiPrompt || '',
            nodeType: 'prompt',
            // Horizontal workflow: root nodes stack vertically with fixed X, increasing Y
            position: { x: 150, y: getNextChainStartY() },
            aspectRatio: aspectRatio,
            timestamp: Date.now(),
            sessionId,
            dialogue: pendingStoryboardItem.dialogue,
            cameraDescription: pendingStoryboardItem.shotNumber || '分镜',
            customLabel: pendingStoryboardItem.shotNumber,
            selectedCharacterIds: matchedCharFormIds,
            selectedLocationIds: matchedLocFormIds,
            group: activeSessionGroup // Ensure it goes into the current partition
        };
        setImages(prev => [...prev, newNode]);
        setIsSyncModalOpen(false);
        setPendingStoryboardItem(null);

        // Find the group this session belongs to and switch to it
        const targetSession = canvasSessions.find(s => s.id === sessionId);
        if (targetSession?.group) {
            setActiveSessionGroup(targetSession.group);
        }

        setActiveSessionId(sessionId);
        setActiveTab('canvas');
        setSuccess(`分镜 ${pendingStoryboardItem.shotNumber} 已同步至画布 (已识别 ${matchedCharFormIds.length} 角色, ${matchedLocFormIds.length} 场景)`);
    }, [pendingStoryboardItem, aspectRatio, activeSessionId, getNextChainStartY, setImages, setIsSyncModalOpen, setPendingStoryboardItem, setActiveSessionId, setActiveSessionGroup, setActiveTab, setSuccess, characters, locations, canvasSessions]);

    const handleAutoAlign = React.useCallback(() => {
        setImages(prev => {
            // Use the same logic as activeImages to determine what's currently "on the canvas"
            const currentSessionImages = prev.filter(img => {
                if (!img) return false;
                const matchesActiveSession = img.sessionId === activeSessionId;
                const matchesActiveGroup = (img.group || '默认分区') === activeSessionGroup;
                if (matchesActiveSession && matchesActiveGroup) return true;

                const belongsToLegacySession = canvasSessions.find(s =>
                    s.id === img.sessionId && (s.group || '默认分区') === activeSessionGroup
                );
                return !!belongsToLegacySession;
            });
            const otherImages = prev.filter(img => !currentSessionImages.includes(img));

            if (currentSessionImages.length === 0) return prev;

            // Robust root detection: A root is an image with no parent, or a parent that isn't in this session
            const currentSessionImageIds = new Set(currentSessionImages.map(img => img.id));
            const roots = currentSessionImages.filter(img => !img.parentId || !currentSessionImageIds.has(img.parentId));
            const children = currentSessionImages.filter(img => img.parentId && currentSessionImageIds.has(img.parentId));

            console.log(`[AutoAlign] Aligning ${currentSessionImages.length} images (${roots.length} roots, ${children.length} children)`);

            // Sort roots by timestamp to maintain storyboard order
            roots.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            // Horizontal workflow: roots vertically stacked, children extend to the right in a clear pipeline
            const horizontalGap = 200; // Increased gap for large storyboard grids
            const rowHeight = 800;     // Substantially increased height to avoid vertical overlap
            const newImagesMap = new Map<string, GeneratedImage>();

            // Helper to get the actual display width of a node
            const getNodeWidth = (img: GeneratedImage) => img.width || (img.nodeType === 'video' ? 420 : 340);

            roots.forEach((root, rootIndex) => {
                const rootX = 150;
                const rootY = 150 + rootIndex * rowHeight;
                const rootWidth = getNodeWidth(root);

                const updatedRoot = { ...root, position: { x: rootX, y: rootY } };
                newImagesMap.set(root.id, updatedRoot);

                // Recursively place children in horizontal chains
                // Returns the furthest Right-Hand-Side (RHS) position reached by this entire branch
                const placeChildren = (pid: string, parentX: number, parentWidth: number, currentY: number): number => {
                    const directChildren = children.filter(c => c.parentId === pid);
                    directChildren.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                    let currentRHSForLevel = parentX + parentWidth;
                    directChildren.forEach(child => {
                        const childX = currentRHSForLevel + horizontalGap;
                        const childWidth = getNodeWidth(child);

                        const updatedChild = { ...child, position: { x: childX, y: currentY } };
                        newImagesMap.set(child.id, updatedChild);

                        // Recurse: Place grandchildren and find the boundary of this child's branch
                        const branchRHS = placeChildren(child.id, childX, childWidth, currentY);

                        // Next sibling starts after the furthest node in the previous sibling's branch
                        currentRHSForLevel = branchRHS;
                    });

                    return currentRHSForLevel;
                };

                // Execute recursion for the root's children
                placeChildren(root.id, rootX, rootWidth, rootY);
            });

            // FALLBACK: Handle orphan or loop-detected nodes by placing them below the main area
            const totalRootsHeight = roots.length * rowHeight;
            let fallbackCount = 0;
            currentSessionImages.forEach(img => {
                if (!newImagesMap.has(img.id)) {
                    const fallbackX = 150 + (fallbackCount % 8) * 450;
                    const fallbackY = 150 + totalRootsHeight + Math.floor(fallbackCount / 8) * rowHeight;
                    newImagesMap.set(img.id, { ...img, position: { x: fallbackX, y: fallbackY } });
                    fallbackCount++;
                }
            });

            const updatedCurrentSession = currentSessionImages.map(img => newImagesMap.get(img.id)!);
            return [...otherImages, ...updatedCurrentSession];
        });
        setSuccess("已完成工作流节点自动排版");
    }, [activeSessionId, activeProjectId, setImages, setSuccess]);

    const handleSaveAudioToTimeline = React.useCallback((url: string, label: string, duration: number) => {
        const nodeId = crypto.randomUUID();
        const audioNode: GeneratedImage = {
            id: nodeId,
            projectId: activeProjectId,
            url: undefined as any, // Intentionally undefined to avoid empty src flickering
            videoUrl: url,
            prompt: label,
            aspectRatio: '1:1',
            timestamp: Date.now(),
            nodeType: 'audio',
            isSyncedToEditor: true,
            customLabel: label,
            sessionId: activeSessionId,
            group: activeSessionGroup // Ensure audio nodes are correctly assigned to session/group
        };
        setImages(prev => [...prev, audioNode]);

        const newClip: TimelineClip = {
            id: crypto.randomUUID(),
            nodeId,
            startTime: 0,
            duration: duration || 5,
            trimStart: 0,
            trackId: 'a2'
        };

        setTimelineData(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => t.id === 'a2' ? { ...t, clips: [...t.clips, newClip] } : t)
        }));
        setSuccess("配音素材已同步到时间轴");
    }, [setImages, setTimelineData, setSuccess]);

    const handleCreateSession = React.useCallback((name: string, group?: string) => {
        const targetGroup = group || activeSessionGroup || '默认分区';
        const newSession: CanvasSession = {
            id: crypto.randomUUID(),
            projectId: activeProjectId,
            name,
            group: '默认', // Default folder-level group
            groups: ['默认分区'], // Initialize with at least one partition
            createdAt: Date.now()
        };
        setCanvasSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        setActiveSessionGroup('默认分区');
        return newSession.id;
    }, [activeProjectId]);

    const handleDeleteSession = React.useCallback((id: string) => {
        if (id === 'default' || canvasSessions.length <= 1) return;
        setCanvasSessions(prev => prev.filter(s => s.id !== id));
        setImages(prev => prev.filter(img => img.sessionId !== id));
        if (activeSessionId === id) {
            setActiveSessionId(canvasSessions.find(s => s.id !== id)?.id || 'default');
        }
    }, [canvasSessions, activeSessionId, setCanvasSessions, setImages, setActiveSessionId]);

    const handleRenameSession = React.useCallback((id: string, newName: string) => {
        setCanvasSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    }, [setCanvasSessions]);

    const handleSelectGroup = React.useCallback((name: string) => {
        setActiveSessionGroup(name);
        // We stay in the same session, just change the node filter
    }, []);

    const handleCreateGroup = React.useCallback((name: string) => {
        // Add requested partition name to the active session's groups list
        setCanvasSessions(prev => prev.map(s =>
            s.id === activeSessionId
                ? { ...s, groups: Array.from(new Set([...(s.groups || ['默认分区']), name])) }
                : s
        ));
        setActiveSessionGroup(name);
    }, [activeSessionId]);

    const handleRenameGroup = React.useCallback((oldName: string, newName: string) => {
        const cleanOld = oldName.trim();
        const cleanNew = newName.trim();
        if (!cleanNew || cleanOld === cleanNew) return;

        console.log(`[Partition] Aggressive Rename: "${cleanOld}" -> "${cleanNew}"`);

        // 1. Target sessions (update the list of partitions)
        setCanvasSessions(prev => (prev || []).map(s => {
            if (!s) return s;
            const hasLegacyMatch = s.group && s.group.trim() === cleanOld;
            const currentGroups = s.groups || [DEFAULT_GROUP];
            const updatedGroups = currentGroups.map(g =>
                (g && g.trim() === cleanOld) ? cleanNew : g
            );

            // If we are renaming the default one and it wasn't explicitly in the list, ensure the new name is there
            if (cleanOld === DEFAULT_GROUP && !updatedGroups.some(g => g.trim() === cleanNew)) {
                updatedGroups.push(cleanNew);
            }

            return {
                ...s,
                group: hasLegacyMatch ? cleanNew : s.group,
                groups: Array.from(new Set(updatedGroups.filter(g => g && g.trim() !== cleanOld)))
            };
        }));

        // 2. Target images (universal replacement)
        setImages(prev => (prev || []).map(img => {
            if (!img) return img;
            // Catch both explicit matches and implicit "default" matches
            const currentGroup = (img.group || DEFAULT_GROUP).trim();
            if (currentGroup === cleanOld) {
                return { ...img, group: cleanNew };
            }
            return img;
        }));

        // 3. Target UI state
        setActiveSessionGroup(prev => {
            const current = (prev || DEFAULT_GROUP).trim();
            return current === cleanOld ? cleanNew : prev;
        });

        setSuccess(`分区名称已从 "${cleanOld}" 修改为 "${cleanNew}"`);
    }, [DEFAULT_GROUP, setCanvasSessions, setImages, setSuccess]);

    const handleDeleteGroup = React.useCallback((name: string) => {
        if (sessionGroupNames.length <= 1) return;
        if (!window.confirm(`确定要删除分区 "${name}" 吗？该分区下的所有创作内容也会被删除。`)) return;

        // Remove from session metadata
        setCanvasSessions(prev => prev.map(s =>
            s.id === activeSessionId
                ? { ...s, groups: (s.groups || []).filter(g => g !== name) }
                : s
        ));
        // Remove nodes from this partition
        setImages(prev => prev.filter(img =>
            !(img.sessionId === activeSessionId && (img.group || '默认分区') === name)
        ));

        if (activeSessionGroup === name) {
            const fallbackGroup = sessionGroupNames.find(g => g !== name) || '默认分区';
            setActiveSessionGroup(fallbackGroup);
        }
    }, [activeSessionId, activeSessionGroup, sessionGroupNames]);

    const handleGenerateFromNode = React.useCallback(async (node: GeneratedImage) => {
        if (!node.textData?.trim()) return;
        setIsGenerating(true);
        setGenerationStep("正在智能生成分镜...");

        // Use CURRENT sidebar ratio for generation (user expectation)
        const targetRatio = aspectRatio;
        const gridDim = mode === GenerationMode.GRID_4x4 ? 4 : (mode === GenerationMode.GRID_3x3 ? 3 : 2);

        try {
            // Collect reference images from selected characters and locations
            const referenceImages: ReferenceImageData[] = [];

            // Add character reference images
            if (node.selectedCharacterIds && node.selectedCharacterIds.length > 0) {
                for (const charFormId of node.selectedCharacterIds) {
                    // Find the character form with this ID
                    for (const character of characters) {
                        const form = character.forms.find(f => f.id === charFormId);
                        if (form && (form.frontViewUrl || form.multiViewUrl)) {
                            const imageUrl = form.frontViewUrl || form.multiViewUrl;
                            if (imageUrl) {
                                // Extract base64 data from data URL or fetch from URL
                                if (imageUrl.startsWith('data:')) {
                                    const [header, data] = imageUrl.split(',');
                                    const mimeMatch = header.match(/data:([^;]+)/);
                                    referenceImages.push({
                                        mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
                                        data: data
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Add location reference images
            if (node.selectedLocationIds && node.selectedLocationIds.length > 0) {
                for (const locFormId of node.selectedLocationIds) {
                    // Find the location form with this ID
                    for (const location of locations) {
                        const form = location.forms.find(f => f.id === locFormId);
                        if (form && form.url) {
                            const imageUrl = form.url;
                            // Extract base64 data from data URL
                            if (imageUrl.startsWith('data:')) {
                                const [header, data] = imageUrl.split(',');
                                const mimeMatch = header.match(/data:([^;]+)/);
                                referenceImages.push({
                                    mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
                                    data: data
                                });
                            }
                        }
                    }
                }
            }

            console.log(`[Generate] Using ${referenceImages.length} reference images (${node.selectedCharacterIds?.length || 0} characters, ${node.selectedLocationIds?.length || 0} locations)`);

            const finalResult = await generateMultiViewGrid(node.textData, gridDim, gridDim, targetRatio, imageSize, referenceImages, undefined, artStyle);
            const renderNode: GeneratedImage = {
                id: crypto.randomUUID(),
                projectId: activeProjectId,
                url: finalResult.fullImage,
                prompt: node.textData,
                textData: node.textData,
                aspectRatio: targetRatio,
                timestamp: Date.now(),
                nodeType: 'render',
                parentId: node.id,
                // Horizontal workflow: new node appears to the RIGHT of parent
                position: { x: (node.position?.x || 0) + 420, y: node.position?.y || 0 },
                slices: finalResult.slices,
                sessionId: activeSessionId,
                group: activeSessionGroup, // Save active partition
                customLabel: node.customLabel,
                cameraDescription: node.cameraDescription,
                modelId: appSettings.roles.imageGeneration,
                provider: getProviderForModel(appSettings.roles.imageGeneration)
            };
            setImages(prev => [...prev, renderNode]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
            setGenerationStep("");
        }
    }, [aspectRatio, imageSize, artStyle, mode, activeSessionId, characters, locations, activeProjectId, setImages, setError, setIsGenerating, setGenerationStep]);

    const handleAnalyzeSelection = async (instr: string) => {
        const asset = assets.find(a => a.id === selectedAssetId);
        const img = images.find(i => i.id === selectedImageIds[0]?.split(':')[0]);
        if (!asset && !img) return;
        setIsAnalyzing(true);
        try {
            const data = asset ? await fileToBase64(asset.file) : img!.url.split(',')[1];
            const mime = asset ? asset.file.type : 'image/png';
            const res = await analyzeAsset(data, mime, instr);
            setAnalysisResult(res);
        } catch (e: any) { setError(e.message); }
        finally { setIsAnalyzing(false); }
    };

    const handleGenerateVideo = async () => {
        if (selectedImageIds.length === 0) return;

        // 1. Determine Start and End Frames
        const startId = selectedImageIds[0];
        const [startMainId, startSliceIdx] = startId.split(':');
        const startNode = images.find(i => i.id === startMainId);
        if (!startNode) return;

        let startFrame = { ...startNode };
        if (startSliceIdx !== undefined && startNode.slices) {
            const idx = parseInt(startSliceIdx);
            if (!isNaN(idx) && startNode.slices[idx]) {
                startFrame.url = startNode.slices[idx];
            }
        }

        if (!startFrame.url || startFrame.url === "") {
            setError("无法生成视频：所选起始帧尚未渲染图片。请先点击模块中的 'RENDER SEQUENCE' 生成底图后再试。");
            return;
        }

        let endFrame: GeneratedImage | undefined = undefined;
        if (selectedImageIds.length > 1) {
            const endId = selectedImageIds[1];
            const [endMainId, endSliceIdx] = endId.split(':');
            const endNode = images.find(i => i.id === endMainId);
            if (endNode) {
                endFrame = { ...endNode };
                if (endSliceIdx !== undefined && endNode.slices) {
                    const idx = parseInt(endSliceIdx);
                    if (!isNaN(idx) && endNode.slices[idx]) {
                        endFrame.url = endNode.slices[idx];
                    }
                }
            }
        }

        setIsGeneratingVideo(true);
        setGenerationStep("VE 引擎正在通过物理模拟生成动态镜头...");

        try {
            // 2. Collect reference images from the BASE node (consistency anchors)
            const referenceImages: ReferenceImageData[] = [];

            // Add references from the source node
            const sourceNode = startNode;
            if (sourceNode.selectedCharacterIds && sourceNode.selectedCharacterIds.length > 0) {
                for (const charFormId of sourceNode.selectedCharacterIds) {
                    for (const character of characters) {
                        const form = character.forms.find(f => f.id === charFormId);
                        const imageUrl = form?.frontViewUrl || form?.multiViewUrl;
                        if (imageUrl?.startsWith('data:')) {
                            const [header, data] = imageUrl.split(',');
                            const mimeMatch = header.match(/data:([^;]+)/);
                            referenceImages.push({ mimeType: mimeMatch ? mimeMatch[1] : 'image/png', data });
                        }
                    }
                }
            }

            if (sourceNode.selectedLocationIds && sourceNode.selectedLocationIds.length > 0) {
                for (const locFormId of sourceNode.selectedLocationIds) {
                    for (const location of locations) {
                        const form = location.forms.find(f => f.id === locFormId);
                        const imageUrl = form?.url;
                        if (imageUrl?.startsWith('data:')) {
                            const [header, data] = imageUrl.split(',');
                            const mimeMatch = header.match(/data:([^;]+)/);
                            referenceImages.push({ mimeType: mimeMatch ? mimeMatch[1] : 'image/png', data });
                        }
                    }
                }
            }

            console.log(`[Video-Gen] Using ${referenceImages.length} consistency anchors for generation.`);

            const res = await generateVideo(startFrame, endFrame, videoMotionConfig, referenceImages, artStyle) as any;
            const videoNodeId = crypto.randomUUID();
            const videoNode: GeneratedImage = {
                id: videoNodeId,
                projectId: activeProjectId,
                url: '',
                videoUrl: res.url,
                videoBlob: res.blob,
                aspectRatio: startFrame.aspectRatio,
                prompt: res.prompt,
                nodeType: 'video',
                parentId: startFrame.id,
                position: { x: (startFrame.position?.x || 0) + 450, y: startFrame.position?.y || 0 },
                timestamp: Date.now(),
                sessionId: activeSessionId,
                group: startFrame.group || activeSessionGroup,
                customLabel: startFrame.customLabel,
                cameraDescription: startFrame.cameraDescription,
                modelId: appSettings.roles.videoGeneration,
                provider: getProviderForModel(appSettings.roles.videoGeneration)
            };
            setImages(prev => [...prev, videoNode]);

            // Persist video blob to IndexedDB for recovery after refresh
            if (res.blob) {
                videoBlobStorage.saveVideoBlob(videoNodeId, activeProjectId, res.blob)
                    .then(() => console.log(`[Video-Gen] Video blob saved to IndexedDB: ${videoNodeId}`))
                    .catch(e => console.warn('[Video-Gen] Failed to save video blob:', e));
            }

            setSuccess("动态视频生成成功！");
        } catch (e: any) { setError(e.message); }
        finally { setIsGeneratingVideo(false); setGenerationStep(""); }
    };

    const handleRefineVideoPrompt = async () => {
        const selection = selectedImageIds[0] || '';
        const [mainId, sliceIdx] = selection.split(':');
        const frame = images.find(i => i.id === mainId);
        if (!frame) return;

        setIsRefiningVideoPrompt(true);
        try {
            let targetUrl = frame.url;
            if (sliceIdx !== undefined && frame.slices) {
                targetUrl = frame.slices[parseInt(sliceIdx)];
            }

            if (!targetUrl) throw new Error("无法获取所选画面的图片地址");

            let base64Data = "";
            let mimeType = "image/png";

            // Support both data URLs and regular URLs (blob/http)
            if (targetUrl.startsWith('data:')) {
                const parts = targetUrl.split(',');
                base64Data = parts[1];
                const mimeMatch = parts[0].match(/data:([^;]+)/);
                if (mimeMatch) mimeType = mimeMatch[1];
            } else {
                // Fetch and convert to base64
                const res = await fetch(targetUrl);
                const blob = await res.blob();
                mimeType = blob.type;
                base64Data = await fileToBase64(new File([blob], "refine_target.png"));
                if (base64Data.includes(',')) base64Data = base64Data.split(',')[1];
            }

            // High-Res images can cause network reset on proxy; resize before sending
            const resizedBase64Full = await resizeImageBase64(`data:${mimeType};base64,${base64Data}`, 1024);
            const cleanResizedBase64 = resizedBase64Full.split(',')[1];

            const res = await analyzeFrameForVideo(cleanResizedBase64, mimeType, frame.prompt);
            setVideoMotionConfig(prev => ({ ...prev, customInstruction: res }));
            setSuccess("AI 画面分析完成，已自动填充运镜提示词");
        } catch (e: any) {
            console.error("[Refine] Error:", e);
            setError(`画面分析失败: ${e.message}`);
        }
        finally { setIsRefiningVideoPrompt(false); }
    };

    const handleAddToCharacters = (name: string, bio: string, forms: any[]) => {
        const newChar: Character = {
            id: crypto.randomUUID(),
            projectId: activeProjectId,
            name,
            bio,
            forms: forms.map(f => ({
                id: crypto.randomUUID(),
                formName: f.formName,
                prompt: f.prompt,
                frontViewUrl: f.frontViewUrl,
                multiViewUrl: f.multiViewUrl
            }))
        };
        setCharacters(prev => [...prev, newChar]);
        setSuccess(`已添加到角色库: ${name}`);
    };

    const handleDownloadBatch = React.useCallback(async () => {
        setGenerationStep("正在生成素材压缩包...");
        setIsGenerating(true);
        try {
            const zip = new JSZip();

            // Create folders for better organization if there are many items
            const imgFolder = zip.folder("images");
            const vidFolder = zip.folder("videos");
            const sliceFolderRoot = zip.folder("slices");

            for (const img of activeImages) {
                const shortId = img.id.slice(0, 8);
                const label = img.customLabel || img.cameraDescription || `shot_${shortId}`;
                const safeLabel = label.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);

                // 1. Download Main Image
                if (img.url) {
                    if (img.url.startsWith('data:')) {
                        const [header, data] = img.url.split(',');
                        const ext = header.includes('png') ? 'png' : 'jpg';
                        imgFolder?.file(`${safeLabel}.${ext}`, data, { base64: true });
                    } else {
                        try {
                            const res = await fetch(img.url);
                            const blob = await res.blob();
                            const ext = blob.type.split('/')[1] || 'png';
                            imgFolder?.file(`${safeLabel}.${ext}`, blob);
                        } catch (e) {
                            console.warn(`Failed to fetch image for ${img.id}:`, e);
                        }
                    }
                }

                // 2. Download Video
                if (img.videoBlob || img.videoUrl) {
                    if (img.videoBlob) {
                        vidFolder?.file(`${safeLabel}.mp4`, img.videoBlob);
                    } else if (img.videoUrl) {
                        try {
                            const res = await fetch(img.videoUrl);
                            vidFolder?.file(`${safeLabel}.mp4`, await res.blob());
                        } catch (e) {
                            console.warn(`Failed to fetch video for ${img.id}:`, e);
                        }
                    }
                }

                // 3. Download Slices
                if (img.slices && img.slices.length > 0) {
                    const itemSliceFolder = sliceFolderRoot?.folder(safeLabel);
                    for (let i = 0; i < img.slices.length; i++) {
                        const sliceUrl = img.slices[i];
                        if (sliceUrl.startsWith('data:')) {
                            const [header, data] = sliceUrl.split(',');
                            const ext = header.includes('png') ? 'png' : 'jpg';
                            itemSliceFolder?.file(`slice_${i + 1}.${ext}`, data, { base64: true });
                        } else {
                            try {
                                const res = await fetch(sliceUrl);
                                const blob = await res.blob();
                                const ext = blob.type.split('/')[1] || 'png';
                                itemSliceFolder?.file(`slice_${i + 1}.${ext}`, blob);
                            } catch (e) {
                                console.warn(`Failed to fetch slice ${i} for ${img.id}:`, e);
                            }
                        }
                    }
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const projectName = projects.find(p => p.id === activeProjectId)?.name || 'project';
            a.download = `${projectName}_assets_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setSuccess("打包下载完成！");
        } catch (err: any) {
            console.error("Zip generation error:", err);
            setError("打包下载失败: " + err.message);
        } finally {
            setIsGenerating(false);
            setGenerationStep("");
        }
    }, [activeImages, activeProjectId, projects, setSuccess, setError, setIsGenerating, setGenerationStep]);



    const [showResetBackdoor, setShowResetBackdoor] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isInitialized) setShowResetBackdoor(true);
        }, 7000);
        return () => clearTimeout(timer);
    }, [isInitialized]);

    // Loading State
    if (!isInitialized) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black">
                <div className="w-full max-w-md flex flex-col items-center">
                    <div className="relative scale-125 mb-10">
                        <div className="w-16 h-16 border-t-2 border-r-2 border-transparent border-t-cine-accent border-r-cine-accent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><div className="w-2 h-2 bg-cine-accent rounded-full shadow-[0_0_15px_#c9ff56]"></div></div>
                    </div>
                    <div className="tracking-[0.3em] text-[10px] uppercase font-bold animate-pulse text-zinc-600 mb-8">LOADING CINEMATIC DECK...</div>

                    {showResetBackdoor && (
                        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <p className="text-xs text-zinc-500 text-center max-w-xs leading-relaxed">
                                如果启动时间过长，可能是本地存储数据冲突导致。您可以尝试重置所有数据。
                            </p>
                            <button
                                onClick={() => {
                                    if (window.confirm("确定要清除所有本地数据并尝试重置吗？这将清空所有项目！")) {
                                        import('./stores').then(m => m.clearAllStores());
                                        window.location.reload();
                                    }
                                }}
                                className="px-6 py-2 bg-red-950/30 border border-red-500/50 text-red-500 text-xs font-bold rounded-lg hover:bg-red-900/40 transition-all uppercase tracking-widest"
                            >
                                强制重置数据并重新启动
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary componentName="DirectorDeck 应用核心">
            <div className="flex flex-col h-screen w-screen overflow-hidden bg-cine-black text-zinc-400 font-sans selection:bg-cine-accent/30 selection:text-white">
                <header className="h-16 flex-shrink-0 border-b border-cine-border bg-cine-black z-50 flex items-center justify-between px-8">
                    <div className="flex items-center gap-6">
                        <h1 className="text-white text-sm font-bold tracking-[0.2em] uppercase font-mono flex items-center gap-3">
                            <div className="relative"><span className="block w-3 h-3 bg-cine-accent rounded-[1px]"></span></div>
                            dierctordeck3.0
                        </h1>

                        <div className="h-6 w-px bg-zinc-800 mx-2"></div>

                        {/* Project Indicator/Selector */}
                        <button
                            onClick={() => setIsProjectManagerOpen(true)}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-all group"
                        >
                            <Briefcase size={14} className="text-zinc-500 group-hover:text-cine-accent transition-colors" />
                            <span className="text-xs font-bold text-zinc-300 group-hover:text-white truncate max-w-[120px]">
                                {projects.find(p => p.id === activeProjectId)?.name || '选择项目'}
                            </span>
                            <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        {activeTab === 'canvas' && (
                            <button onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} className={`p-2 rounded-md transition-colors ${isLeftSidebarOpen ? 'text-zinc-500 hover:text-white' : 'text-cine-accent bg-cine-accent/10'}`}>
                                {isLeftSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                            </button>
                        )}
                    </div>
                    <div className="flex-1 max-w-4xl mx-auto flex justify-center px-4"><NavBar activeTab={activeTab} onTabChange={setActiveTab} onToggleSettings={() => setIsSettingsOpen(true)} /></div>
                    <div className="flex items-center gap-4 w-48 justify-end">
                        <div className="flex items-center gap-2 py-1.5 px-3 bg-zinc-900/50 border border-zinc-800 rounded-full"><ShieldCheck size={14} className="text-cine-accent" /><span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">PRO v3.0</span></div>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden relative">
                    <CollageEditor isOpen={isCollageEditorOpen} onClose={() => setIsCollageEditorOpen(false)} onSave={handleCreateCollage} defaultAspectRatio={aspectRatio} />

                    {isProjectManagerOpen && (
                        <ProjectManager
                            projects={projects}
                            activeProjectId={activeProjectId}
                            onSwitch={handleSwitchProject}
                            onCreate={handleCreateProject}
                            onArchive={handleArchiveProject}
                            onDelete={handleDeleteProject}
                            onUpdate={handleUpdateProject}
                            onClose={() => setIsProjectManagerOpen(false)}
                        />
                    )}

                    {/* Main Viewport Controller (Back to Conditional Rendering) */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT SIDEBAR (Canvas only) */}
                        {activeTab === 'canvas' && (
                            <aside className={`flex-shrink-0 flex flex-col border-r border-zinc-800 bg-[#09090b] z-20 transition-[width,opacity] duration-300 ${isLeftSidebarOpen ? 'w-[340px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'}`}>
                                <div className="flex-1 flex flex-col p-4 gap-7 overflow-y-scroll custom-scrollbar bg-black" style={{ scrollbarGutter: 'stable' }}>
                                    <div className="flex-1 pb-10">
                                        <DirectorDeck
                                            mode={mode}
                                            setMode={setMode}
                                            aspectRatio={aspectRatio}
                                            setAspectRatio={setAspectRatio}
                                            imageSize={imageSize}
                                            setImageSize={setImageSize}
                                            artStyle={artStyle}
                                            setArtStyle={setArtStyle}
                                            isGenerating={isGenerating}
                                            onResetCanvas={async () => {
                                                if (!window.confirm("CRITICAL: 确定要重置【全部】功能区吗？\n\n这将全面清空：\n1. 创作画布 (所有节点)\n2. 角色库 (所有设定)\n3. 场景库 (所有背景)\n4. 分镜库 (所有分镜表)\n5. 时间轴 (所有已编排剪辑)\n6. 素材库 (所有上传文件)\n\n此操作不可撤销，确定清空本项目所有数据？")) return;

                                                setIsGenerating(true);
                                                setGenerationStep("正在执行全功能区重置...");

                                                try {
                                                    // 1. Clear All Main States
                                                    setImages([]);
                                                    setCharacters([]);
                                                    setLocations([]);
                                                    setStoryboardProjects([]);
                                                    setAssets([]);

                                                    // 2. Reset Timeline to default empty structure
                                                    setTimelineData({
                                                        id: crypto.randomUUID(),
                                                        projectId: activeProjectId,
                                                        tracks: [
                                                            { id: 'v1', name: '视频主轨道', type: 'video', clips: [] },
                                                            { id: 'v2', name: '覆盖层', type: 'video', clips: [] },
                                                            { id: 'a1', name: '背景音乐', type: 'audio', clips: [] },
                                                            { id: 'a2', name: '音效/配音', type: 'audio', clips: [] },
                                                            { id: 's1', name: '字幕', type: 'subtitle', clips: [] },
                                                        ],
                                                        totalDuration: 60,
                                                        fps: 30
                                                    });

                                                    // 3. Reset Sessions
                                                    const defaultId = activeProjectId === 'default_project' ? 'default' : ('default_' + activeProjectId);
                                                    const sessions = [{ id: defaultId, projectId: activeProjectId, name: '主工作区', createdAt: Date.now() }];
                                                    setCanvasSessions(sessions);
                                                    setActiveSessionId(defaultId);

                                                    // 4. Cleanup binary storage
                                                    await videoBlobStorage.init();
                                                    await videoBlobStorage.deleteProjectVideos(activeProjectId);

                                                    setSuccess("项目全功能区已重置：画布、角色、场景、分镜及时间轴已清空。");
                                                } catch (e: any) {
                                                    setError("重置失败: " + e.message);
                                                } finally {
                                                    setIsGenerating(false);
                                                    setGenerationStep("");
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </aside>
                        )}

                        {/* MAIN CONTENT AREA */}
                        <main className="flex-1 relative bg-cine-black flex flex-col min-w-0">
                            {activeTab === 'canvas' && (
                                <div className="flex-1 flex flex-col overflow-hidden relative">
                                    <CanvasPartitionBar
                                        groups={sessionGroupNames}
                                        activeGroup={activeSessionGroup}
                                        onSelectGroup={handleSelectGroup}
                                        onCreateGroup={handleCreateGroup}
                                        onDeleteGroup={handleDeleteGroup}
                                        onRenameGroup={handleRenameGroup}
                                        defaultGroupName={DEFAULT_GROUP}
                                    />

                                    <div className="flex-1 relative flex overflow-hidden">
                                        <ErrorBoundary componentName="画布">
                                            <Canvas
                                                images={activeImages}
                                                characters={characters}
                                                locations={locations}
                                                assets={assets}
                                                onSelect={handleSelectImage}
                                                onSelectMultiple={handleSelectMultiple}
                                                selectedIds={selectedImageIds}
                                                onDelete={handleDeleteImage}
                                                onUpdateNodePosition={handleUpdateNodePosition}
                                                onUpdateNodeData={handleUpdateNodeData}
                                                onLinkNodes={handleLinkNodes}
                                                onGenerateFromNode={handleGenerateFromNode}
                                                onAutoAlign={handleAutoAlign}
                                                onDownloadAll={handleDownloadBatch}
                                            />
                                        </ErrorBoundary>
                                        {isGenerating && (
                                            <div className="absolute inset-0 bg-cine-black/95 z-50 flex flex-col items-center justify-center space-y-8">
                                                <div className="w-16 h-16 border-t-2 border-cine-accent rounded-full animate-spin"></div>
                                                <p className="text-white font-mono uppercase tracking-widest">{generationStep}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'characters' && <div className="absolute inset-0 z-30"><ErrorBoundary componentName="角色库"><CharacterLibrary characters={characters} activeProjectId={activeProjectId} onUpdateCharacters={setCharacters} images={images} /></ErrorBoundary></div>}
                            {activeTab === 'locations' && <div className="absolute inset-0 z-30"><ErrorBoundary componentName="场景库"><LocationLibrary locations={locations} activeProjectId={activeProjectId} onUpdateLocations={setLocations} images={images} /></ErrorBoundary></div>}
                            {activeTab === 'storyboard' && <div className="absolute inset-0 z-30"><ErrorBoundary componentName="分镜库"><StoryboardLibrary projects={storyboardProjects} activeProjectId={activeProjectId} onUpdateProjects={setStoryboardProjects} onSyncToCanvas={handleSyncStoryboardItem} characters={characters} locations={locations} onImageGenerated={(img) => setImages(prev => [...prev, img])} generatedImages={images} /></ErrorBoundary></div>}
                            {activeTab === 'editor' && <div className="absolute inset-0 z-30"><ErrorBoundary componentName="时间轴编辑器"><TimelineEditor images={images} timelineData={timelineData} onUpdateTimeline={setTimelineData} projectName={projects.find(p => p.id === activeProjectId)?.name} /></ErrorBoundary></div>}

                            {/* DubbingPanel - Always mounted, hidden with CSS to preserve state */}
                            <div className={`absolute inset-0 z-30 ${activeTab === 'dubbing' ? '' : 'hidden'}`}>
                                <ErrorBoundary componentName="配音面板">
                                    <DubbingPanel
                                        characters={characters}
                                        assets={assets}
                                        storyboardProjects={storyboardProjects}
                                        settings={appSettings}
                                        onAddAsset={handleAddAsset}
                                        onSaveToTimeline={(url, label, dur) => { handleSaveAudioToTimeline(url, label, dur); setActiveTab('editor'); }}
                                    />
                                </ErrorBoundary>
                            </div>

                            {/* Notifications */}
                            {error && (
                                <div className="absolute bottom-8 left-8 right-8 md:right-auto md:max-w-2xl z-[100] bg-red-950/90 border border-red-500/40 text-red-200 p-4 rounded-xl text-xs flex gap-3 shadow-2xl backdrop-blur-md items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold mb-1 text-red-400">系统错误 (ERROR)</p>
                                        <div className="opacity-90 leading-relaxed break-all max-h-[40vh] overflow-y-auto custom-scrollbar">{error}</div>
                                    </div>
                                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg flex-shrink-0 self-start transition-colors">
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            )}
                            {success && (
                                <div className="absolute bottom-8 left-8 right-8 md:right-auto md:max-w-xl z-[100] bg-cine-accent/10 border border-cine-accent/30 text-cine-accent p-4 rounded-xl text-xs flex gap-3 shadow-2xl backdrop-blur-md items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-bold mb-1">执行成功 (SUCCESS)</p>
                                        <div className="opacity-90 leading-relaxed">{success}</div>
                                    </div>
                                    <button onClick={() => setSuccess(null)} className="p-1 hover:bg-black/20 rounded-lg flex-shrink-0 self-start transition-colors">
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            )}
                        </main>

                        {/* RIGHT SIDEBAR (Canvas specific) */}
                        {activeTab === 'canvas' && (
                            <>
                                {/* Resize Handle */}
                                <div
                                    onMouseDown={startResizingRight}
                                    className={`w-1.5 h-full cursor-col-resize z-[60] flex-shrink-0 transition-colors duration-200 border-l border-cine-border active:bg-cine-accent hover:bg-cine-accent/40 group ${isResizingRight ? 'bg-cine-accent pointer-events-auto' : ''}`}
                                >
                                    <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-0.5 h-8 bg-white/20 rounded-full"></div>
                                    </div>
                                </div>

                                <aside
                                    className="bg-cine-dark z-20 flex-shrink-0 overflow-y-scroll custom-scrollbar"
                                    style={{ width: `${rightSidebarWidth}px`, scrollbarGutter: 'stable' }}
                                >
                                    {selectedImageIds.length > 0 && isSelectionVideoReady ? (
                                        <VideoMotionPanel config={videoMotionConfig} onChange={setVideoMotionConfig} onGenerate={handleGenerateVideo} isGenerating={isGeneratingVideo} isRefining={isRefiningVideoPrompt} onRefinePrompt={handleRefineVideoPrompt} selectedCount={selectedImageIds.length} hasSourceInfo={!!activeImage?.sourceShotId} sourceContext={activeImage?.cameraDescription || activeImage?.prompt || ''} characters={characters} locations={locations} />
                                    ) : selectedImageIds.length > 0 && activeImage?.nodeType === 'prompt' ? (
                                        <div className="p-8 space-y-6">
                                            <div className="p-5 bg-cine-accent/5 border border-cine-accent/20 rounded-xl space-y-3">
                                                <div className="flex items-center gap-2 text-cine-accent">
                                                    <MonitorPlay size={16} />
                                                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">待生成分镜 (AWAITING RENDER)</span>
                                                </div>
                                                <p className="text-[10px] text-zinc-400 leading-relaxed italic font-mono">
                                                    当前分镜尚未渲染底图。即梦 AI 视频引擎需要以单张或多张生成的图片作为物理参考进行“镜头推演”。
                                                </p>
                                                <div className="pt-2 border-t border-cine-accent/10 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-cine-accent animate-pulse" />
                                                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">请先生成序列图片</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="accent"
                                                className="w-full h-14 text-[11px] uppercase font-black tracking-[0.3em] shadow-2xl active:scale-95 transition-all"
                                                onClick={() => handleGenerateFromNode(activeImage!)}
                                            >
                                                <Zap size={18} className="mr-3 fill-black" /> 立即渲染序列
                                            </Button>
                                            <p className="text-center text-[8px] text-zinc-600 uppercase tracking-widest leading-loose">
                                                RENDER SEQUENCE 结束后<br />即可解锁视频推演控制台
                                            </p>
                                        </div>
                                    ) : selectedImageIds.length > 0 ? (
                                        <Inspector selectedImage={activeImage} selectedAsset={activeAsset} displayUrlOverride={activeDisplayUrl} onClose={() => setSelectedImageIds([])} onAnalyze={handleAnalyzeSelection} isAnalyzing={isAnalyzing} analysisResult={analysisResult} onSaveToCharacters={handleAddToCharacters} onUpdateImage={(newUrl) => setImages(prev => prev.map(img => img.id === activeImage?.id ? { ...img, url: newUrl } : img))} />
                                    ) : (
                                        <div className="p-8 text-center text-zinc-600 mt-20 font-mono italic">CHOOSE AN ELEMENT TO INSPECT</div>
                                    )}
                                </aside>
                            </>
                        )}
                    </div>
                </div >

                <SyncTargetModal isOpen={isSyncModalOpen} onClose={() => { setIsSyncModalOpen(false); setPendingStoryboardItem(null); }} sessions={canvasSessions} onSelect={confirmSyncToSession} onCreateAndSelect={(name) => { const id = handleCreateSession(name); confirmSyncToSession(id); }} itemName={pendingStoryboardItem?.shotNumber || '未知分镜'} />
                {isSettingsOpen && <SettingsPanel settings={appSettings} onUpdateSettings={setAppSettings} onClose={() => setIsSettingsOpen(false)} />}

                {/* Global Progress Bar */}
                <GlobalProgress />

                {/* Offline Status Indicator */}
                <OfflineIndicator />
            </div >
        </ErrorBoundary >
    );
};

export default App;