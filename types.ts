export type TabType = 'canvas' | 'characters' | 'locations' | 'storyboard' | 'editor' | 'dubbing';

export interface CanvasSession {
  id: string;
  projectId: string; // New: Reference to the project it belongs to
  name: string;
  group?: string; // Parent group/folder for the session
  groups?: string[]; // New: Sub-partitions (shots) within this session
  createdAt: number;
}

export enum ArtStyle {
  STUDIO_GHIBLI = '吉卜力 (宫崎骏)',
  MAKOTO_SHINKAI = '新海诚 (绚丽光影)',
  MODERN_SHONEN = '现代少年漫 (ufotable)',
  RETRO_90S = '90年代复古番',
  KOREAN_WEBTOON = '韩漫精绘 (Webtoon)',
  CHINESE_MANHUA = '巅峰国漫 (精细线稿)',
  YAO_LI_GUOFENG = '尧立国风 (水墨描金)',
  CYBERPUNK_ANIME = '赛博朋克 (霓虹/金属)',
  CG_GAME_ART = 'CG游戏风格 (超清写实)',
  REALISTIC = '真人风格 (影视写实)'
}

export interface CharacterForm {
  id: string;
  formName: string;
  prompt: string;
  frontViewUrl?: string;
  multiViewUrl?: string;
}

export interface Character {
  id: string;
  projectId: string; // New: Reference to the project it belongs to
  name: string;
  bio: string;
  forms: CharacterForm[];
  preferredStyle?: ArtStyle;
  preferredAspectRatio?: AspectRatio;
  preferredImageSize?: ImageSize;
  voiceUrl?: string;
  referenceImageUrl?: string; // User-uploaded reference image for generation
}

export interface LocationForm {
  id: string;
  formName: string; // e.g. "Day", "Night", "Inside", "Outside"
  prompt: string;
  url?: string;
}

export interface Location {
  id: string;
  projectId: string; // New: Reference to the project it belongs to
  name: string;
  description: string;
  forms: LocationForm[];
  preferredStyle?: ArtStyle;
  preferredAspectRatio?: AspectRatio;
  referenceImageUrl?: string; // User-uploaded reference image for generation
}

export interface StoryboardItem {
  id: string;
  shotNumber: string;
  description: string;
  cameraAngle: string;
  movement: string;
  location: string;
  characters: string;
  dialogue: string;
  sfx: string;
  aiPrompt: string;
  shotType?: string;
  action?: string;
  lighting?: string;
  duration?: number;
  audioDescription?: string;
}

export interface StoryboardProject {
  id: string;
  projectId: string; // New: Reference to the project it belongs to
  title: string;
  scriptContent: string;
  items: StoryboardItem[];
  createdAt?: number;
}

export enum AspectRatio {
  SQUARE = '1:1',
  STANDARD = '4:3',
  PORTRAIT = '3:4',
  WIDE = '16:9',
  MOBILE = '9:16',
  CINEMA = '21:9'
}

export enum ImageSize {
  SD = '480P',
  HD = '720P',
  FHD = '1080P',
  K2 = '2K',
  K4 = '4K'
}

export enum GenerationMode {
  GRID_2x2 = '2x2 分镜 (4视图)',
  GRID_3x3 = '3x3 分镜 (9视图)',
  GRID_4x4 = '4x4 分镜 (16视图)'
}

export type NodeType = 'prompt' | 'asset_group' | 'render' | 'slice' | 'video' | 'audio';

export interface VideoMotionConfig {
  intensity: number; // 1-10
  motionType: 'auto' | 'dolly_in' | 'dolly_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'rotate_cw' | 'rotate_ccw' | 'custom';
  motionPrompt?: string; // New: API compatible motion prompt
  customInstruction?: string;
  duration: number; // in seconds
  isLoop?: boolean;
  selectedCharacterIds?: string[];
  selectedLocationIds?: string[];
  isSpeaking?: boolean; // New: To indicate character mouth movement
}

export interface GeneratedImage {
  id: string;
  url: string;
  fullGridUrl?: string;
  videoUrl?: string; // New: Path/URL to the generated video
  prompt: string;
  aspectRatio: string;
  timestamp: number;

  // Node Graph Properties
  nodeType: NodeType;
  parentId?: string;
  position?: { x: number; y: number };
  projectId: string; // New: Reference to the project it belongs to
  sessionId?: string; // Reference to the canvas it belongs to

  // Video Generation Context
  motionConfig?: VideoMotionConfig;
  sourceShotId?: string; // Connection back to the storyboard shot
  endFrameId?: string; // For multi-frame Gen, ID of the target image node
  isSyncedToEditor?: boolean; // New: Flag for editor resource strip

  // Specific data containers
  assetIds?: string[];
  textData?: string;
  cameraDescription?: string;
  selectedCharacterIds?: string[];
  selectedLocationIds?: string[];
  customLabel?: string;
  slices?: string[];
  videoBlob?: Blob; // Stored video data for persistence
  dialogue?: string; // New: Dialogue content from storyboard
  modelId?: string; // New: Track which model generated this
  provider?: string; // New: Track which provider generated this
  width?: number; // New: Custom node width for resizing
  group?: string; // New: Partition/shot label within the session
}

export interface Asset {
  id: string;
  projectId: string; // New: Reference to the project it belongs to
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  analysis?: string;
}

export type InspectorTab = 'details' | 'analysis';

export interface TimelineClip {
  id: string;
  nodeId: string; // Reference to the GeneratedImage source
  startTime: number; // Position on timeline in seconds
  duration: number; // Display duration (affected by trimming)
  trimStart: number; // Offset from start of source video
  trackId: string;

  // Transformation & Style
  opacity?: number;
  volume?: number;
  playbackRate?: number;

  // Effects
  filters?: string[];
  customLabel?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle';
  clips: TimelineClip[];

  // Track state
  isMuted?: boolean;
  isLocked?: boolean;
  isVisible?: boolean;
}

export interface TimelineData {
  id: string; // New: To allow multiple timelines or project association
  projectId: string; // New: Reference to the project it belongs to
  tracks: TimelineTrack[];
  totalDuration: number;
  fps: number; // Standardize for frame-accurate editing
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  coverUrl?: string;
  createdAt: number;
  updatedAt: number;
  status: ProjectStatus;
}

export interface ApiKeyConfig {
  id: string;
  provider: 'google' | 'anthropic' | 'openai' | 'deepseek' | 'xai' | 'jimeng' | 'jimeng-web' | 'qwen' | 'other';
  key: string;
  secretKey?: string; // For Volcengine/Jimeng AK/SK
  baseUrl?: string;
  label: string;
  isActive: boolean;
  usageCount: number;
  lastUsed?: number;
}

export interface AppSettings {
  apiKeys: ApiKeyConfig[];
  roles: {
    scriptAnalysis: string; // Model for parsing script
    imageGeneration: string; // Model for generating images
    videoGeneration: string; // Model for video motion
    audioGeneration: string; // Model for audio (placeholder or future)
    chatAssistant: string; // Model for prompt enhancement/chat
  };
  customModels: string[];
  autoSwitchKey: boolean;
  indexTtsUrl?: string;
}