
import React, { useState } from 'react';
import { X, Key, Plus, Trash2, CheckCircle2, AlertCircle, Settings as SettingsIcon, Activity, Database } from 'lucide-react';
import { AppSettings, ApiKeyConfig } from '../types';

interface SettingsPanelProps {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdateSettings, onClose }) => {
    const [newKey, setNewKey] = useState('');
    const [newSecretKey, setNewSecretKey] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newBaseUrl, setNewBaseUrl] = useState('');
    const [customInputModes, setCustomInputModes] = useState<Record<string, boolean>>({});
    const [newProvider, setNewProvider] = useState<ApiKeyConfig['provider']>('google');
    const [localTtsUrl, setLocalTtsUrl] = useState(settings.indexTtsUrl || 'http://127.0.0.1:7860');

    const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
    const [editKeyBuffer, setEditKeyBuffer] = useState<Partial<ApiKeyConfig>>({});

    const handleStartEdit = (key: ApiKeyConfig) => {
        setEditingKeyId(key.id);
        setEditKeyBuffer({ ...key });
    };

    const handleSaveEdit = () => {
        if (!editingKeyId || !editKeyBuffer.key) return;
        onUpdateSettings({
            ...settings,
            apiKeys: settings.apiKeys.map(k => k.id === editingKeyId ? { ...k, ...editKeyBuffer } as ApiKeyConfig : k)
        });
        setEditingKeyId(null);
        setEditKeyBuffer({});
    };

    const handleCancelEdit = () => {
        setEditingKeyId(null);
        setEditKeyBuffer({});
    };


    // Safety: Ensure roles exists
    const safeRoles = settings?.roles || {
        scriptAnalysis: 'gemini-1.5-flash',
        imageGeneration: 'imagen-3.0-generate-001',
        videoGeneration: 'veo-3.1-generate-preview',
        audioGeneration: 'future-audio-model',
        chatAssistant: 'gemini-2.0-flash-exp'
    };

    const handleAddKey = () => {
        if (!newKey.trim()) return;
        const keyConfig: ApiKeyConfig = {
            id: crypto.randomUUID(),
            provider: newProvider,
            key: newKey.trim(),
            secretKey: newProvider === 'jimeng' ? newSecretKey.trim() : undefined,
            baseUrl: newBaseUrl.trim() || undefined,
            label: newLabel.trim() || `${newProvider.toUpperCase()} Key ${settings.apiKeys.length + 1}`,
            isActive: settings.apiKeys.length === 0,
            usageCount: 0
        };

        onUpdateSettings({
            ...settings,
            apiKeys: [...settings.apiKeys, keyConfig]
        });
        setNewKey('');
        setNewSecretKey('');
        setNewLabel('');
        setNewBaseUrl('');
    };

    const handleRemoveKey = (id: string) => {
        onUpdateSettings({
            ...settings,
            apiKeys: settings.apiKeys.filter(k => k.id !== id)
        });
    };

    const handleToggleKey = (id: string) => {
        onUpdateSettings({
            ...settings,
            apiKeys: settings.apiKeys.map(k => ({
                ...k,
                isActive: k.id === id
            }))
        });
    };

    const handleRoleChange = (role: keyof AppSettings['roles'], model: string) => {
        if (model === 'CUSTOM_MANUAL') {
            setCustomInputModes(prev => ({ ...prev, [role]: true }));
            return;
        }

        onUpdateSettings({
            ...settings,
            roles: {
                ...settings.roles,
                [role]: model
            }
        });
    };

    const toggleManualMode = (role: string, isManual: boolean) => {
        setCustomInputModes(prev => ({ ...prev, [role]: isManual }));
    };

    const totalUsage = settings.apiKeys.reduce((acc, k) => acc + (k.usageCount || 0), 0);

    const modelOptions = {
        script: [
            { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Google 官方)', provider: 'google' },
            { id: 'claude-sonnet-4-5', name: 'Antigravity: Claude 4.5 Sonnet (推荐)', provider: 'other' },
            { id: 'claude-opus-4-5-thinking', name: 'Antigravity: Claude 4.5 Opus (思维链/最强)', provider: 'other' },
            { id: 'gemini-3-pro-high', name: 'Antigravity: Gemini 3 Pro High', provider: 'other' },
            { id: 'gemini-3-pro-low', name: 'Antigravity: Gemini 3 Pro Low', provider: 'other' },
            { id: 'gemini-3-flash', name: 'Antigravity: Gemini 3 Flash', provider: 'other' },
            { id: 'gemini-2.5-pro', name: 'Antigravity: Gemini 2.5 Pro', provider: 'other' },
            { id: 'gemini-2.5-flash-thinking', name: 'Antigravity: Gemini 2.5 Flash (Thinking)', provider: 'other' },
            { id: 'gemini-2.5-flash', name: 'Antigravity: Gemini 2.5 Flash', provider: 'other' },
            { id: 'gemini-2.5-flash-lite', name: 'Antigravity: Gemini 2.5 Flash Lite', provider: 'other' },
            { id: 'deepseek-chat', name: 'DeepSeek V3 (官方)', provider: 'deepseek' },
        ],
        image: [
            { id: 'jimeng-4.5', name: '即梦 Web: jimeng-4.5', provider: 'jimeng-web' },
            { id: 'jimeng-4.0', name: '即梦 Web: jimeng-4.0', provider: 'jimeng-web' },
            { id: 'jimeng_t2i_v40', name: '即梦 AI 图片生成 4.0', provider: 'jimeng' },
            { id: 'imagen-3.0-generate-001', name: 'Google Imagen 3.0', provider: 'google' },
            { id: 'gemini-3-pro-image', name: 'Antigravity: Gemini 3 Pro (Image 1:1)', provider: 'other' },
            { id: 'qwen-image-edit-plus', name: 'Qwen-Image Edit Plus', provider: 'qwen' },
            { id: 'flux-1-dev', name: 'FLUX.1 [dev]', provider: 'other' }
        ],
        video: [
            { id: 'jimeng-video-3.5-pro', name: '即梦 Web: 视频 3.5 Pro (音画同出)', provider: 'jimeng-web' },
            { id: 'jimeng-video-3.5', name: '即梦 Web: 视频 3.5 (推荐)', provider: 'jimeng-web' },
            { id: 'jimeng-video-3.0-pro', name: '即梦 Web: 视频 3.0 Pro (画质超清)', provider: 'jimeng-web' },
            { id: 'jimeng-video-3.0-fast', name: '即梦 Web: 视频 3.0 Fast (极速生成)', provider: 'jimeng-web' },
            { id: 'jimeng-video-3.0', name: '即梦 Web: 视频 3.0 (运镜精准)', provider: 'jimeng-web' },
            { id: 'jimeng-video-3.5-pro', name: '即梦 AI: 视频 3.5 Pro (官方 API)', provider: 'jimeng' },
            { id: 'jimeng_ti2v_v30_pro', name: '即梦 AI: 视频 3.0 Pro (官方 API)', provider: 'jimeng' },
            { id: 'jimeng_ti2v_v30_1080p', name: '即梦 AI: 视频 3.0 1080P (官方 API)', provider: 'jimeng' },
            { id: 'jimeng-video-sora2', name: '即梦 Sora 2.0 (国际站)', provider: 'jimeng-web' },
            { id: 'jimeng-video-veo3.1', name: '即梦 Veo 3.1 (国际站)', provider: 'jimeng-web' },
            { id: 'veo-3.1-generate-preview', name: 'Google Veo 3.1', provider: 'google' },
            { id: 'luma-ray-v1', name: 'Luma Ray', provider: 'other' },
            { id: 'kling-v1-5', name: 'Kling v1.5', provider: 'other' }
        ],
        chat: [
            { id: 'claude-sonnet-4-5', name: 'Antigravity: Claude 4.5 Sonnet', provider: 'other' },
            { id: 'claude-opus-4-5-thinking', name: 'Antigravity: Claude 4.5 Opus (Thinking)', provider: 'other' },
            { id: 'gemini-3-pro-high', name: 'Antigravity: Gemini 3 Pro High', provider: 'other' },
            { id: 'gemini-3-flash', name: 'Antigravity: Gemini 3 Flash', provider: 'other' },
            { id: 'gemini-2.5-flash-thinking', name: 'Antigravity: Gemini 2.5 Flash (Thinking)', provider: 'other' },
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', provider: 'google' },
            { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
        ],
        audio: [
            { id: 'gpt-4o-audio-preview', name: 'GPT-4o Audio', provider: 'openai' },
            { id: 'eleven-labs-v2', name: 'ElevenLabs Multilingual v2', provider: 'other' },
            { id: 'antigravity-local', name: 'Antigravity (本地网关)', provider: 'other' }
        ]
    };

    const renderRoleSelector = (role: keyof AppSettings['roles'], label: string, detail: string, options: { id: string, name: string, provider: string }[]) => {
        const isManual = customInputModes[role];

        return (
            <div className="space-y-3">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                    {label} <span>{detail}</span>
                </label>

                {isManual ? (
                    <div className="flex gap-2 duration-300">
                        <input
                            type="text"
                            value={safeRoles[role]}
                            onChange={(e) => handleRoleChange(role, e.target.value)}
                            placeholder="输入自定义模型 ID (e.g. gpt-4o-mini)"
                            className="flex-1 bg-zinc-800/80 border border-cine-accent/50 rounded-2xl px-5 py-4 text-white font-mono text-sm focus:outline-none focus:border-cine-accent shadow-[0_0_15px_rgba(201,255,86,0.1)]"
                            autoFocus
                        />
                        <button
                            onClick={() => toggleManualMode(role, false)}
                            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-colors text-xs"
                        >
                            取消
                        </button>
                    </div>
                ) : (
                    <div className="relative group">
                        <select
                            value={safeRoles[role]}
                            onChange={(e) => handleRoleChange(role, e.target.value)}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-cine-accent transition-all appearance-none cursor-pointer hover:bg-zinc-800/80"
                        >
                            <optgroup label="预设模型 (PRESETS)">
                                {options.map(m => <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>)}
                            </optgroup>
                            <option value="CUSTOM_MANUAL" className="text-cine-accent font-bold">+ 手动输入模型 ID (MANUAL ENTRY)...</option>
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-cine-accent transition-colors">
                            <Plus size={16} />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cine-accent/10 rounded-xl">
                            <SettingsIcon size={24} className="text-cine-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">全局设置 (SYSTEM SETTINGS)</h2>
                            <p className="text-zinc-500 text-sm">配置多平台 API 密钥池与职能模型映射</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    {/* API Pool Section */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <Key size={20} className="text-cine-accent" />
                                <span>API 密钥池 (MULTI-PROVIDER POOL)</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-[11px] text-zinc-400">
                                <Activity size={12} />
                                <span>总调用次数: {totalUsage}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {settings.apiKeys.map((key) => (
                                <div
                                    key={key.id}
                                    onDoubleClick={() => !editingKeyId && handleStartEdit(key)}
                                    className={`group p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between ${key.isActive
                                        ? 'bg-cine-accent/5 border-cine-accent/30'
                                        : 'bg-zinc-800/20 border-zinc-800/50 hover:border-zinc-700'
                                        }`}
                                >
                                    <div className="flex-1 flex items-center gap-4">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleKey(key.id); }}
                                            className={`p-2 flex-shrink-0 rounded-xl transition-all ${key.isActive ? 'bg-cine-accent text-black scale-110 shadow-lg shadow-cine-accent/20' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            <CheckCircle2 size={18} />
                                        </button>

                                        {editingKeyId === key.id ? (
                                            <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-2">
                                                    <input
                                                        className="flex-1 bg-zinc-900 border border-cine-accent/50 rounded-lg px-2 py-1 text-xs text-white"
                                                        value={editKeyBuffer.label || ''}
                                                        onChange={(e) => setEditKeyBuffer({ ...editKeyBuffer, label: e.target.value })}
                                                        placeholder="备注"
                                                    />
                                                    <input
                                                        className="flex-1 bg-zinc-900 border border-cine-accent/50 rounded-lg px-2 py-1 text-xs text-white"
                                                        value={editKeyBuffer.key || ''}
                                                        onChange={(e) => setEditKeyBuffer({ ...editKeyBuffer, key: e.target.value })}
                                                        placeholder="Key / AK"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    {key.provider === 'jimeng' && (
                                                        <input
                                                            className="flex-1 bg-zinc-900 border border-cine-accent/50 rounded-lg px-2 py-1 text-xs text-white"
                                                            value={editKeyBuffer.secretKey || ''}
                                                            onChange={(e) => setEditKeyBuffer({ ...editKeyBuffer, secretKey: e.target.value })}
                                                            placeholder="Secret Key (SK)"
                                                        />
                                                    )}
                                                    <input
                                                        className="flex-1 bg-zinc-900 border border-cine-accent/50 rounded-lg px-2 py-1 text-xs text-white"
                                                        value={editKeyBuffer.baseUrl || ''}
                                                        onChange={(e) => setEditKeyBuffer({ ...editKeyBuffer, baseUrl: e.target.value })}
                                                        placeholder="Base URL"
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-2 pt-1">
                                                    <button onClick={handleCancelEdit} className="text-[10px] text-zinc-500 hover:text-white px-2 py-1">取消</button>
                                                    <button onClick={handleSaveEdit} className="text-[10px] bg-cine-accent text-black px-3 py-1 rounded font-bold">保存修改</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-bold text-sm truncate">{key.label}</span>
                                                    <span className="flex-shrink-0 text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">
                                                        {key.provider}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                    <span className="text-zinc-500 text-xs font-mono" title={key.provider === 'jimeng' ? 'Access Key' : (key.provider === 'jimeng-web' ? 'Session ID' : 'API Key')}>
                                                        {key.provider === 'jimeng' ? 'AK:' : (key.provider === 'jimeng-web' ? 'SID:' : '')}{key.key.substring(0, 10)}•••
                                                    </span>
                                                    {key.secretKey && (
                                                        <span className="text-zinc-500 text-xs font-mono" title="Secret Key">
                                                            SK:{key.secretKey.substring(0, 6)}•••
                                                        </span>
                                                    )}
                                                    {key.baseUrl && (
                                                        <span className="text-[10px] text-zinc-600 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800 font-mono truncate max-w-[120px]" title={key.baseUrl}>
                                                            {key.baseUrl.replace(/^https?:\/\//, '')}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-1 text-zinc-600 text-[10px]">
                                                        <span>已用 {key.usageCount || 0} 次</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {!editingKeyId && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveKey(key.id); }}
                                            className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Key Input */}
                        <div className="p-5 bg-zinc-800/10 rounded-2xl border border-zinc-800/50 space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <select
                                    value={newProvider}
                                    onChange={(e) => setNewProvider(e.target.value as any)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cine-accent"
                                >
                                    <option value="other">Antigravity / 代理 (Recommended)</option>
                                    <option value="openai">OpenAI (官方)</option>
                                    <option value="xai">xAI / Grok (官方)</option>
                                    <option value="google">Google Gemini (官方 Key)</option>
                                    <option value="anthropic">Anthropic Claude (官方 Key)</option>
                                    <option value="deepseek">DeepSeek (官方)</option>
                                    <option value="qwen">Qwen / 阿里 (DashScope)</option>
                                    <option value="jimeng">即梦 AI (官方 API)</option>
                                    <option value="jimeng-web">即梦 Web (网页版 Cookie)</option>
                                    <option value="other">自定义 (OpenAI 兼容接口)</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="密钥备注 (例如: 备用Key)"
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cine-accent"
                                />
                                <input
                                    type="password"
                                    placeholder={newProvider === 'jimeng' ? "在此输入 Access Key (AK)" : (newProvider === 'jimeng-web' ? "在此输入 Session ID" : (newProvider === 'qwen' ? "在此输入 DashScope API Key" : "在此输入 API Key"))}
                                    title={newProvider === 'jimeng' ? "在此输入 Access Key (AK)" : (newProvider === 'jimeng-web' ? "在此输入 Session ID" : (newProvider === 'qwen' ? "在此输入 DashScope API Key" : "在此输入 API Key"))}
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cine-accent"
                                />
                                {newProvider === 'jimeng' && (
                                    <input
                                        type="password"
                                        placeholder="在此输入 Secret Key (SK)"
                                        title="在此输入 Secret Key (SK)"
                                        value={newSecretKey}
                                        onChange={(e) => setNewSecretKey(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cine-accent"
                                    />
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <input
                                    type="text"
                                    placeholder="代理地址 / Base URL (可选，若不填则使用官方默认地址)"
                                    title="代理地址 (Endpoint URL, 可选)"
                                    value={newBaseUrl}
                                    onChange={(e) => setNewBaseUrl(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cine-accent w-full font-mono"
                                />
                                {newProvider === 'other' && (
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] text-cine-accent/70 font-bold">
                                            💡 Antigravity 默认地址: http://127.0.0.1:8045/v1
                                        </p>
                                        <button
                                            onClick={() => setNewBaseUrl('http://127.0.0.1:8045/v1')}
                                            className="text-[9px] bg-cine-accent/20 hover:bg-cine-accent/40 text-cine-accent px-2 py-0.5 rounded border border-cine-accent/30 transition-colors"
                                        >
                                            一键填入 (AUTO-FILL)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddKey}
                                    disabled={!newKey.trim()}
                                    className="bg-cine-accent hover:bg-cine-accent-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold px-8 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cine-accent/10"
                                >
                                    <Plus size={18} />
                                    保存在密钥池
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Granular Model Mapping */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Database size={20} className="text-cine-accent" />
                            <span>职能模型映射 (ROLE-BASED MODEL MAPPING)</span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                            {renderRoleSelector('scriptAnalysis', '脚本解析与拆表', 'SCRIPT PARSING', modelOptions.script)}
                            {renderRoleSelector('imageGeneration', '分镜画面生图', 'STORYBOARD RENDER', modelOptions.image)}
                            {renderRoleSelector('videoGeneration', '动态视频生成', 'VIDEO MOTION', modelOptions.video)}
                            {renderRoleSelector('chatAssistant', 'AI 创作助手', 'CREATIVE ASSISTANT', modelOptions.chat)}
                            {renderRoleSelector('audioGeneration', '配音与音效', 'AUDIO GEN', modelOptions.audio)}
                        </div>
                    </section>

                    {/* Local Services Configuration */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Activity size={20} className="text-cine-accent" />
                            <span>本地服务配置 (LOCAL SERVICE CONFIG)</span>
                        </div>

                        <div className="p-5 bg-zinc-800/20 rounded-2xl border border-zinc-800/50 space-y-4">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                                    IndexTTS 本地服务地址 <span>LOCAL TTS API URL</span>
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={localTtsUrl}
                                        onChange={(e) => setLocalTtsUrl(e.target.value)}
                                        onBlur={() => onUpdateSettings({ ...settings, indexTtsUrl: localTtsUrl })}
                                        placeholder="http://127.0.0.1:7860"
                                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cine-accent font-mono"
                                    />
                                    <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${settings.indexTtsUrl ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                                        <div className={`w-2 h-2 rounded-full ${settings.indexTtsUrl ? 'bg-green-500' : 'bg-red-500'}`} />
                                        {settings.indexTtsUrl ? 'SERVICE ACTIVE' : 'NO SERVICE'}
                                    </div>
                                </div>
                                <p className="text-[10px] text-zinc-600 italic">
                                    提示: 请确保在本地电脑上运行了 `uv run webui.py` 并保持服务开启。
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Tips */}
                    <div className="p-5 bg-cine-accent/5 border border-cine-accent/20 rounded-2xl flex gap-4">
                        <AlertCircle size={22} className="text-cine-accent shrink-0 mt-1" />
                        <div className="text-xs text-zinc-400 leading-relaxed">
                            <span className="text-cine-accent font-bold block mb-1">混合模型工作流 (HYBRID AI WORKFLOW):</span>
                            • 建议使用 <b>Claude-3.5</b> 进行剧本解析，其结构化能力更强。<br />
                            • 生图推荐 <b>Gemini-3-Pro</b> 或 <b>FLUX</b>，可根据您的 API 额度灵活切换。<br />
                            • 视频当前锁定为 <b>Google Veo</b>，其他模型（如 Sora, Kling）将随 API 开放逐步上线。
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={() => {
                            onUpdateSettings({ ...settings, indexTtsUrl: localTtsUrl });
                            onClose();
                        }}
                        className="bg-cine-accent hover:bg-cine-accent-hover text-black font-black px-12 py-4 rounded-2xl transition-all shadow-[0_8px_30px_rgba(201,255,86,0.3)] transform hover:-translate-y-1 active:scale-95"
                    >
                        完成同步配置 (SAVE CHANGES)
                    </button>
                </div>
            </div >
        </div >
    );
};
