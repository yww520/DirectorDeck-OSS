import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ArtStyle, AspectRatio, ImageSize, GeneratedImage, VideoMotionConfig, AppSettings } from "../types";

let appSettings: AppSettings = {
  apiKeys: [],
  roles: {
    scriptAnalysis: 'gemini-3-flash',
    imageGeneration: 'gemini-3-pro-image',
    videoGeneration: 'veo-3.1-generate-preview',
    audioGeneration: 'future-audio-model',
    chatAssistant: 'gemini-3-flash'
  },
  customModels: [],
  autoSwitchKey: true
};

// Model to provider mapping - helps decide which API key to use
const MODEL_PROVIDERS: Record<string, string> = {
  'gemini-1.5-pro': 'google',
  'gemini-1.5-pro-latest': 'google',
  'gemini-1.5-flash': 'google',
  'gemini-1.5-flash-latest': 'google',
  'gemini-1.5-flash-001': 'google',
  'gemini-1.5-flash-002': 'google',
  'gemini-1.5-flash-8b': 'google',
  'gemini-2.0-flash-exp': 'google',
  'gemini-2.0-flash-exp-latest': 'google',
  'imagen-3.0-generate-001': 'google',
  'flux-1-dev': 'other',

  // Antigravity / Gemini 3
  'gemini-3-pro-high': 'other',
  'gemini-3-pro-low': 'other',
  'gemini-3-flash': 'other',
  'gemini-3-pro-image': 'other',
  'gemini-2.5-flash': 'other',
  'gemini-2.5-flash-lite': 'other',
  'gemini-2.5-pro': 'other',
  'gemini-2.0-flash': 'other',
  'gemini-2.5-flash-thinking': 'other',
  'claude-sonnet-4-5': 'other',
  'claude-sonnet-4-5-thinking': 'other',
  'claude-opus-4-5-thinking': 'other',
  'claude-3-5-sonnet-latest': 'other',
  'claude-3-5-sonnet-20241022': 'other',

  // Video Generation
  'jimeng_ti2v_v30_pro': 'jimeng',
  'jimeng_ti2v_v30_1080p': 'jimeng',
  'jimeng_ti2v_v30_720p': 'jimeng',
  'jimeng_t2i_v40': 'jimeng',
  'jimeng-video-3.5-pro': 'jimeng-web',
  'jimeng-video-3.5': 'jimeng-web',
  'jimeng-video-3.0-pro': 'jimeng-web',
  'jimeng-video-3.0-fast': 'jimeng-web',
  'jimeng-video-3.0': 'jimeng-web',
  'jimeng-video-veo3': 'jimeng-web',
  'jimeng-video-veo3.1': 'jimeng-web',
  'jimeng-video-sora2': 'jimeng-web',
  'jimeng-4.5': 'jimeng-web',
  'jimeng-4.0': 'jimeng-web',
  'veo-3.1-generate-preview': 'google',
  'luma-ray-v1': 'other',
  'kling-v1-5': 'other',

  // Chat / Assistant
  'grok-2-latest': 'xai',
  'claude-3-haiku': 'anthropic',

  // Audio
  'gpt-4o-audio-preview': 'openai',
  'eleven-labs-v2': 'other',
  'fish-speech-1-4': 'other'
};

export const getProviderForModel = (modelId: string): string => {
  // 1. Check direct mapping (Case-insensitive)
  const exactMatch = Object.entries(MODEL_PROVIDERS).find(([id]) => id.toLowerCase() === modelId.toLowerCase());
  if (exactMatch) return exactMatch[1];

  // 2. Heuristic check based on names
  const mid = modelId.toLowerCase();

  // Specific check for Antigravity (Gemini 3) - These must be 'other' to trigger proxy path
  if (mid.includes('gemini-3')) return 'other';

  // Standard Google
  if (mid.includes('gemini') || mid.includes('veo') || mid.includes('imagen')) return 'google';

  if (mid.includes('jimeng-video') || mid === 'jimeng-4.5' || mid === 'jimeng-4.0') return 'jimeng-web';
  if (mid.includes('jimeng')) return 'jimeng';
  if (mid.includes('gpt') || mid.includes('dall-e')) return 'openai';
  if (mid.includes('claude') || mid.includes('anthropic')) return 'anthropic';
  if (mid.includes('qwen')) return 'qwen';
  if (mid.includes('deepseek')) return 'deepseek';
  if (mid.includes('grok')) return 'xai';

  // Specific check for Antigravity or local proxies often mapped as 'other'
  return 'other';
};

/**
 * Robustly attempts to extract and parse JSON from AI response text
 */
function safeJsonParse(text: string): any {
  if (!text || text.trim() === "") return null;

  let clean = text.trim();

  // 1. Remove markdown code blocks if they exist
  clean = clean.replace(/```json/g, '').replace(/```/g, '').trim();

  // 2. Locate the primary JSON structure (array or object)
  // We look for the absolute first and last occurrence of brackets/braces
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');

  let candidate = clean;

  // Heuristic: Pick the structure that appears to wrap the most content or starts first
  const hasArray = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;
  const hasObject = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;

  if (hasArray && (!hasObject || firstBracket < firstBrace)) {
    candidate = clean.substring(firstBracket, lastBracket + 1);
  } else if (hasObject) {
    candidate = clean.substring(firstBrace, lastBrace + 1);
  }

  // 3. Simple repair for common LLM failures (trailing commas, missing closing brackets)
  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      // Try to fix trailing commas: [1, 2,] -> [1, 2]
      try {
        const fixedCommas = str.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(fixedCommas);
      } catch (inner) {
        // Try to fix truncated JSON by appending closing brackets/braces
        try {
          let balanced = str;
          const stack: string[] = [];
          for (let i = 0; i < balanced.length; i++) {
            const char = balanced[i];
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}' || char === ']') {
              if (stack.length && stack[stack.length - 1] === char) stack.pop();
            }
          }
          while (stack.length) balanced += stack.pop();
          return JSON.parse(balanced.replace(/,\s*([\]}])/g, '$1'));
        } catch (deepInner) {
          throw deepInner;
        }
      }
    }
  };

  try {
    return tryParse(candidate);
  } catch (finalError) {
    console.warn("[JSON Parse] Failed to parse extracted candidate. Raw length:", text.length);
    // If extraction failed, maybe the whole string is meant to be JSON but messy
    try {
      return tryParse(clean);
    } catch (e) {
      throw new Error(`JSON_PARSE_FAILURE: ${text.slice(0, 100)}...`);
    }
  }
}

/**
 * Parses error messages from AI providers/proxies
 */
async function parseAIError(response: Response, defaultPrefix: string = "AI Error"): Promise<string> {
  let text = "";
  try {
    text = await response.text();
    const json = JSON.parse(text);
    return json.message || json.error || json.errmsg || text;
  } catch (e) {
    return text || `${defaultPrefix} (${response.status})`;
  }
}

const getApiKeyConfigForProvider = (provider: string) => {
  // 1. Try to find active key for this provider
  let config = appSettings.apiKeys.find(k => k.isActive && k.provider === provider);

  // 2. Fallback to any key for this provider
  if (!config) {
    config = appSettings.apiKeys.find(k => k.provider === provider);
  }

  return config;
};

let onUsageReported: ((keyId: string) => void) | null = null;

export const updateGeminiSettings = (settings: AppSettings, usageCallback?: (keyId: string) => void) => {
  appSettings = settings;
  if (usageCallback) onUsageReported = usageCallback;
};

// Helper to ensure API key selection for premium models
export const ensureApiKey = async () => {
  // Use settings if configured
  if (appSettings.apiKeys.some(k => k.isActive)) return;

  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
};

// True AI Video Generation (API-based) - Strict Mode
// True AI Video Generation (API-based) - Veo 3.1 Strict
const getMotionDescription = (type?: string, intensity: number = 5) => {
  const level = intensity > 7 ? "dramatic" : (intensity < 4 ? "subtle" : "smooth");
  switch (type) {
    case 'dolly_in': return `${level} dolly in zoom`;
    case 'dolly_out': return `${level} dolly out zoom`;
    case 'pan_left': return `${level} pan left movement`;
    case 'pan_right': return `${level} pan right movement`;
    case 'tilt_up': return `${level} tilt up camera`;
    case 'tilt_down': return `${level} tilt down camera`;
    case 'rotate_cw': return `${level} clockwise rotation`;
    case 'rotate_ccw': return `${level} counter-clockwise rotation`;
    case 'auto':
    default: return "natural cinematic movement";
  }
};

/**
 * Resizes a base64 image to maintain a max dimension, ensuring it fits within API limits (e.g. 5MB)
 * and providing a reasonable input size for video generation.
 */
export const resizeImageBase64 = (base64: string, maxWidth: number = 1024): Promise<string> => {
  // 1. Detect if input is already a data URL or just raw base64
  const isDataUrl = base64.startsWith('data:');
  const inputDataUrl = isDataUrl ? base64 : `data:image/png;base64,${base64}`;

  // If the string is already small (e.g. < 500KB), don't risk re-processing it
  if (base64.length < 500000) {
    console.log("[Resize] Image already small, skipping conversion.");
    return Promise.resolve(inputDataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxWidth && height <= maxWidth) {
        console.log("[Resize] Dimensions within limits, skipping.");
        resolve(inputDataUrl);
        return;
      }

      if (width > height) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      } else {
        width = Math.round((width * maxWidth) / height);
        height = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(inputDataUrl); return; }

      ctx.drawImage(img, 0, 0, width, height);
      // ALWAYS use high-quality JPEG for video generation to ensure max compatibility with AI models
      // Return the FULL data URL for consistency
      const resized = canvas.toDataURL('image/jpeg', 0.92);
      console.log(`[Resize/Format] Prepared as JPEG. From original length ${base64.length} to ${resized.length}`);
      resolve(resized);
    };
    img.onerror = () => {
      console.warn("[Resize] Image load failed, returning original.");
      resolve(inputDataUrl);
    };
    img.src = inputDataUrl;
  });
};

export const generateVideo = async (
  startFrame: GeneratedImage,
  endFrame?: GeneratedImage,
  config?: VideoMotionConfig,
  referenceImages: ReferenceImageData[] = [],
  artStyle?: ArtStyle
): Promise<{ url: string; blob: Blob | null; prompt: string }> => {
  const model = appSettings.roles.videoGeneration || 'veo-3.1-generate-preview';
  const provider = getProviderForModel(model);

  console.log(`[Video-API] Initiating generation with model: ${model}, provider: ${provider}`);

  if (provider === 'jimeng' || provider === 'jimeng-web') {
    return generateJimengVideo(startFrame, endFrame, config, referenceImages, artStyle, model);
  }

  // Google Veo Path
  await ensureApiKey();
  const ai = getClient();

  try {
    let visualDescription = "";

    // IF we have reference images, we should derive a descriptive identity for consistency
    if (referenceImages.length > 0) {
      console.log("[Veo-Consistency] Analyzing references for identity anchors...");
      const analysisModel = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
      const anaParts = referenceImages.map(ref => ({ inlineData: { mimeType: ref.mimeType, data: ref.data } }));
      anaParts.push({ text: "Describe the character's clothing and appearance in detail (colors, hairstyle, accessories) and the environment so a video generator can maintain consistency. Max 30 words." } as any);

      try {
        const anaRes = await ai.models.generateContent({ model: analysisModel, contents: { parts: anaParts } });
        visualDescription = anaRes.text || "";
        console.log("[Veo-Consistency] Derived Identity:", visualDescription);
      } catch (e) {
        console.warn("[Veo-Consistency] Reference analysis failed, using fallback.");
      }
    }

    const sceneContext = config?.customInstruction || startFrame.prompt || "";
    const motionTypeDesc = getMotionDescription(config?.motionType, config?.intensity);
    const motionPrompt = config?.motionPrompt ? `. ACTION: ${config.motionPrompt}` : "";
    const identityIns = visualDescription ? `. SUBJECT: ${visualDescription}` : "";
    const styleDesc = artStyle ? `. STYLE: ${getStyleDescription(artStyle)}` : "";
    const speakingIns = config?.isSpeaking ? ". DIALOGUE: The character is speaking, their mouth is moving naturally and expressively. High focus on lip-sync and facial muscle movement." : "";

    // Final prompt for Veo: Scene -> Style -> Motion -> Subject -> Speaking
    // We prioritize the editable customInstruction if provided.
    const prompt = `Cinematic video of: ${sceneContext}${styleDesc}. ${motionTypeDesc}${motionPrompt}${identityIns}${speakingIns}. High quality, consistent visuals.`;

    console.log("[Veo-API] Final Constructed Prompt:", prompt);

    // Prepare Start Frame
    console.log("[Veo-API] Preparing start frame...");
    let startBase64 = "";
    try {
      let originalBase64 = "";
      let startMime = "image/png";
      if (startFrame.url.startsWith('data:')) {
        const parts = startFrame.url.split(',');
        originalBase64 = parts[1];
        const m = parts[0].match(/data:([^;]+)/);
        if (m) startMime = m[1];
      } else {
        const fetchRes = await fetch(startFrame.url);
        if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
        const startBlob = await fetchRes.blob();
        startMime = startBlob.type;
        originalBase64 = await fileToBase64(new File([startBlob], "start.png"));
        if (originalBase64.includes(',')) originalBase64 = originalBase64.split(',')[1];
      }

      // Resize for Veo compatibility
      const resized = await resizeImageBase64(`data:${startMime};base64,${originalBase64}`, 1024);
      startBase64 = resized.split(',')[1];
    } catch (e: any) {
      console.error("[Veo-API] Start frame error:", e);
      throw new Error(`无法处理起始帧: ${e.message}`);
    }

    // Base request config
    const requestOptions: any = {
      model: model,
      prompt: prompt,
      image: {
        imageBytes: startBase64,
        mimeType: "image/png"
      },
      config: {
        // Veo 3.1 preview config
      }
    };

    // Prepare End Frame (Interpolation)
    if (endFrame) {
      console.log("[Veo-API] End frame detected. Using interpolation mode.");
      let endBase64 = "";
      try {
        let originalEndB64 = "";
        let endMime = "image/png";
        if (endFrame.url.startsWith('data:')) {
          const parts = endFrame.url.split(',');
          originalEndB64 = parts[1];
          const m = parts[0].match(/data:([^;]+)/);
          if (m) endMime = m[1];
        } else {
          const fetchRes = await fetch(endFrame.url);
          if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
          const endBlob = await fetchRes.blob();
          endMime = endBlob.type;
          originalEndB64 = await fileToBase64(new File([endBlob], "end.png"));
          if (originalEndB64.includes(',')) originalEndB64 = originalEndB64.split(',')[1];
        }

        // Resize for Veo compatibility
        const resized = await resizeImageBase64(`data:${endMime};base64,${originalEndB64}`, 1024);
        endBase64 = resized.split(',')[1];
      } catch (e: any) {
        console.error("[Veo-API] End frame error:", e);
        throw new Error(`无法处理结束帧: ${e.message}`);
      }

      // Add last_frame to config
      requestOptions.config.lastFrame = {
        imageBytes: endBase64,
        mimeType: "image/png"
      };
    }

    console.log("[Veo-API] Sending generation request...", requestOptions);

    // 1. Submit Generation Job
    // @ts-ignore - The types might not be updated for generateVideos yet
    let operation = await ai.models.generateVideos(requestOptions);

    console.log("[Veo-API] Job submitted. Operation ID:", operation.name);

    // 2. Poll for Completion
    const pollInterval = 5000; // 5 seconds
    while (!operation.done) {
      console.log("[Veo-API] Task running... waiting 5s.");
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Refresh operation status
      // @ts-ignore
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    console.log("[Veo-API] Task completed. Result:", operation);

    // 3. Handle Errors
    if (operation.error) {
      console.error("[Veo-API] Operation Error:", operation.error);
      throw new Error(`Veo 3.1 Error: ${operation.error.message || JSON.stringify(operation.error)}`);
    }

    // 4. Retrieve Video
    // Try multiple possible paths in the response object
    let videoResource = null;
    if (operation.response) {
      const res = operation.response as any;
      if (res.generatedVideos && res.generatedVideos[0]?.video) {
        videoResource = res.generatedVideos[0].video;
      } else if (res.videos && res.videos[0]) {
        videoResource = res.videos[0];
      } else if (res.video) {
        videoResource = res.video;
      }
    }

    if (videoResource && videoResource.uri) {
      const videoUri = videoResource.uri;
      console.log("[Veo-API] Found Video Resource URI:", videoUri);

      // Download the actual bytes
      const apiKey = (ai as any).apiKey;
      const downloadUrl = videoUri + (videoUri.includes('?') ? '&' : '?') + 'key=' + apiKey;

      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
        const blob = await response.blob();
        return { url: URL.createObjectURL(blob), blob: blob, prompt };
      } catch (e) {
        console.warn("[Veo-API] Blob download failed, using raw URI.");
        return { url: downloadUrl, blob: null, prompt }; // Fallback
      }
    }

    // 5. Handle Specialized Failures (Safety Filters etc.)
    const res = operation.response as any;
    if (res?.raiMediaFilteredReasons) {
      const reasons = res.raiMediaFilteredReasons.join(', ');
      throw new Error(`提示词触发安全策略 (Safety Policy Conflict): 系统认为您的描述可能包含敏感或违规内容，已拒绝生成。建议：修改关键词，避开暴力、血腥或特定敏感词汇。`);
    }

    const diag = operation.response ? JSON.stringify(operation.response).slice(0, 150) : "No response body";
    throw new Error(`Veo 3.1 生成无结果: 可能被系统拦截或模型限制。详情: ${diag}`);

  } catch (error: any) {
    console.error("[Veo-API] Generation Failed:", error);

    // Fallback error messaging
    if (error.message?.includes("Failed to fetch")) {
      throw new Error(`网络连接失败 (Failed to fetch): 无法访问 AI 服务接口。原因可能是：1. 您的网络环境不稳定或需要科学上网；2. 填写的代理地址 (Base URL) 格式错误；3. 代理服务器自身宕机。请检查设置页面的 API 配置。`);
    }
    if (error.message?.includes("404") || error.message?.includes("not found")) {
      throw new Error("Veo 3.1 Model not found or API Key lacks access. (Check whitelist)");
    }
    throw error;
  }
};

const getClient = (provider: string = 'google') => {
  // 1. Try to find right key for this provider
  const activeKeyConfig = getApiKeyConfigForProvider(provider);
  let apiKey = activeKeyConfig?.key;

  // 2. Fallback to environment variables
  if (!apiKey) {
    apiKey =
      process.env.API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_API_KEY ||
      (import.meta as any).env?.VITE_API_KEY ||
      (import.meta as any).env?.GEMINI_API_KEY;
  }

  if (!apiKey) {
    console.warn("[geminiService] No API Key found in settings or environment.");
  }

  // Report usage if key is from our pool
  if (activeKeyConfig && onUsageReported) {
    onUsageReported(activeKeyConfig.id);
  }

  // Support for Custom Base URL (e.g. for proxies or "other" providers)
  const config: any = { apiKey: apiKey || "" };
  if (activeKeyConfig?.baseUrl) {
    // Note: The official Google SDK uses 'baseUrl' or 'apiEndpoint' depending on version
    // We set both to be safe for various implementations/proxies
    config.baseUrl = activeKeyConfig.baseUrl;
    config.apiEndpoint = activeKeyConfig.baseUrl;
    console.log(`[geminiService] Using custom baseUrl: ${activeKeyConfig.baseUrl}`);
  }

  const client = new GoogleGenAI(config);
  // @ts-ignore
  client.apiKey = apiKey; // Store for manual fetch use if needed
  return client;
};

/**
 * Unified AI Content Generation Handler
 * Supports: Google (SDK), OpenAI Compatible (Fetch), Anthropic Compatible (Fetch)
 */
async function callUniversalAI(
  modelId: string,
  provider: string,
  options: {
    systemInstruction?: string,
    contents: any, // Can be string or parts array
    jsonMode?: boolean,
    temperature?: number,
    safetySettings?: any[]
  }
): Promise<{ text: string, raw?: any }> {
  const config = getApiKeyConfigForProvider(provider);
  const apiKey = config?.key || (import.meta as any).env?.VITE_API_KEY || "";
  const baseUrl = config?.baseUrl || "";

  // 1. Google Direct Path (ONLY if NO baseUrl is provided)
  // If baseline Google provider is used without a proxy, use the official SDK.
  if (provider === 'google' && !baseUrl) {
    await ensureApiKey();
    const ai = getClient(provider);
    const result = await ai.models.generateContent({
      model: modelId,
      contents: options.contents,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: options.jsonMode ? "application/json" : undefined,
        temperature: options.temperature,
        safetySettings: options.safetySettings
      }
    });

    if (onUsageReported && config) onUsageReported(config.id);
    return { text: result.text || "", raw: result };
  }

  // 2. OpenAI / Antigravity / Proxy Path
  // If a baseUrl is present, we assume it's an OpenAI-compatible endpoint (like Antigravity).
  if (provider === 'openai' || provider === 'deepseek' || provider === 'xai' || provider === 'other' || provider === 'jimeng' || (provider === 'google' && baseUrl)) {
    let apiEndpoint = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, '');

    // CORS Bypass: If hitting local Antigravity, route through Vite proxy
    if (apiEndpoint.includes('127.0.0.1:8045') || apiEndpoint.includes('localhost:8045')) {
      apiEndpoint = apiEndpoint.replace(/https?:\/\/(127\.0\.0\.1|localhost):8045/, '/antigravity-api');
    }

    // Antigravity local proxy usually ends with /v1
    // We ensure it ends correctly for a fetch call to completions.
    if (!apiEndpoint.toLowerCase().endsWith('/chat/completions')) {
      if (!apiEndpoint.toLowerCase().endsWith('/v1')) {
        apiEndpoint += '/v1';
      }
      apiEndpoint += '/chat/completions';
    }

    // Convert Google-style parts to OpenAI-style messages
    const messages: any[] = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }

    const userParts: any[] = Array.isArray(options.contents.parts) ? options.contents.parts : (typeof options.contents === 'string' ? [{ text: options.contents }] : [{ text: JSON.stringify(options.contents) }]);

    const contentPayload = userParts.map(p => {
      if (p.text) return { type: 'text', text: p.text };
      if (p.inlineData) return {
        type: 'image_url',
        image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` }
      };
      return null;
    }).filter(Boolean);

    messages.push({ role: 'user', content: contentPayload });

    // Handle JSON mode strictly for common proxies
    const requestData: any = {
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7
    };

    if (options.jsonMode) {
      requestData.response_format = { type: "json_object" };
      // Inject explicit instruction to ensure non-compliant models adhere
      const lastMsg = messages[messages.length - 1];
      if (typeof lastMsg.content === 'string') {
        if (!lastMsg.content.includes("JSON")) lastMsg.content += "\n\n(IMPORTANT: Return result as raw JSON only)";
      } else if (Array.isArray(lastMsg.content)) {
        const textPart = lastMsg.content.find((p: any) => p.type === 'text');
        if (textPart && !textPart.text.includes("JSON")) textPart.text += "\n\n(IMPORTANT: Return result as raw JSON only)";
      }
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const err = await response.text();
      let errorMsg = `AI Provider Error (${provider}): ${response.status} - ${err}`;

      if (response.status === 404) {
        errorMsg = `模型未找到 (404): 您当前选用的模型 [${modelId}] 在供应商 [${provider}] 中不存在。请在设置中检查模型名称是否正确，或者该模型是否已被下线。`;
      } else if (response.status === 401) {
        errorMsg = `认证失败 (401): API Key 无效或过期。请检查供应商 [${provider}] 的 API Key 配置是否正确。`;
      }

      throw new Error(errorMsg);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    if (onUsageReported && config) onUsageReported(config.id);
    return { text, raw: data };
  }

  // 3. Anthropic Path
  if (provider === 'anthropic') {
    let apiEndpoint = (baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, '');
    if (!apiEndpoint.toLowerCase().endsWith('/messages')) {
      apiEndpoint += '/messages';
    }

    // Map parts to Anthropic content blocks
    const userParts: any[] = Array.isArray(options.contents.parts) ? options.contents.parts : [{ text: options.contents }];
    const anthropicContent = userParts.map(p => {
      if (p.text) return { type: 'text', text: p.text };
      if (p.inlineData) return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: p.inlineData.mimeType,
          data: p.inlineData.data
        }
      };
      return null;
    }).filter(Boolean);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        system: options.systemInstruction,
        messages: [{ role: 'user', content: anthropicContent }],
        max_tokens: 4096,
        temperature: options.temperature
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    if (onUsageReported && config) onUsageReported(config.id);
    return { text, raw: data };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

// Helper to slice a grid image into individual images
const sliceImageGrid = (base64Data: string, rows: number, cols: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const pieceWidth = Math.floor(w / cols);
      const pieceHeight = Math.floor(h / rows);

      const pieces: string[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = pieceWidth;
      canvas.height = pieceHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("无法获取画布上下文"));
        return;
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, pieceWidth, pieceHeight);
          // Source x, y, w, h -> Dest x, y, w, h
          ctx.drawImage(
            img,
            c * pieceWidth,
            r * pieceHeight,
            pieceWidth,
            pieceHeight,
            0,
            0,
            pieceWidth,
            pieceHeight
          );
          pieces.push(canvas.toDataURL('image/png'));
        }
      }
      resolve(pieces);
    };
    img.onerror = (e) => reject(new Error("无法加载图片进行切片"));
    img.src = base64Data;
  });
};

// Convert AspectRatio enum to string resolution for proxies (Antigravity etc.)
const getResolutionForRatio = (ratio: AspectRatio | string): string => {
  switch (ratio) {
    case AspectRatio.SQUARE: return "1024x1024";
    case AspectRatio.WIDE: return "1280x720";
    case AspectRatio.MOBILE: return "720x1280";
    case AspectRatio.STANDARD: return "1280x960";
    case AspectRatio.PORTRAIT: return "960x1280";
    case AspectRatio.CINEMA: return "1280x544";
    default: return "1024x1024";
  }
};

// Parse aspect ratio string to number
const getAspectRatioValue = (ar: string): number => {
  const [w, h] = ar.split(':').map(Number);
  return w / h;
};

// Helper to stitch multiple images into a grid with specific layout and aspect ratio
export const stitchImages = (
  files: File[],
  layout: '2x2' | '3x3' = '2x2',
  targetAspectRatio: string = '16:9'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (files.length === 0) {
      reject(new Error("No files provided"));
      return;
    }

    const rows = layout === '2x2' ? 2 : 3;
    const cols = layout === '2x2' ? 2 : 3;
    const count = rows * cols;
    const imagesToProcess = files.slice(0, count);

    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;

    imagesToProcess.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          loadedImages[index] = img;
          loadedCount++;
          if (loadedCount === imagesToProcess.length) {
            performStitch();
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    const performStitch = () => {
      const arValue = getAspectRatioValue(targetAspectRatio);
      const canvas = document.createElement('canvas');

      const pieceW = loadedImages[0].width;
      const pieceH = loadedImages[0].height;

      canvas.width = pieceW * cols;
      canvas.height = pieceH * rows;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("No context"));

      loadedImages.forEach((img, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        ctx.drawImage(img, c * pieceW, r * pieceH, pieceW, pieceH);
      });

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
  });
};

/**
 * Specifically parses a document file (PDF, DOCX, TXT) into raw text content
 * for the user to review in the textarea.
 */
export const parseDocumentToText = async (fileData: { mimeType: string, data: string }): Promise<string> => {
  const model = appSettings.roles.scriptAnalysis || 'gemini-1.5-pro';
  const provider = getProviderForModel(model);

  const systemInstruction = `You are an expert script assistant and OCR specialist. 
  TASK: Extract all text from the provided document or image.
  
  IF IT IS A SCRIPT (Text or Image):
  - Extract all dialogue, character names, and scene descriptions verbatim.
  - Maintain the structure of the script.
  - Do not add commentary.

  IF IT IS A CHARACTER DESIGN SHEET / CONCEPT ART:
  - Describe the character's appearance, clothing, colors, and personality markers in detail so it can be used to generate consistent prompts.
  
  Raw text/description only.`;

  try {
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: {
        parts: [
          { inlineData: fileData },
          { text: "Analyze this document/image and extract all relevant script text or character/scene descriptions." }
        ]
      }
    });

    return result.text;
  } catch (error: any) {
    console.error("[DocumentParse] Error:", error);
    throw new Error(`AI识别失败: ${error.message || "未知错误"}`);
  }
};

export interface ReferenceImageData {
  mimeType: string;
  data: string;
}

export const generateMultiViewGrid = async (
  prompt: string,
  gridRows: number, // 2 or 3
  gridCols: number, // 2 or 3
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  referenceImages: ReferenceImageData[] = [],
  contextImage?: string, // New: Previous generation result for continuity
  artStyle?: ArtStyle,
  viewType?: 'default' | 'fpv' | '360',
  isLocation: boolean = false
): Promise<{ fullImage: string, slices: string[] }> => {
  const model = appSettings.roles.imageGeneration || 'gemini-3-pro-image-preview';
  const provider = getProviderForModel(model);

  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;
  const styleDesc = artStyle ? getStyleDescription(artStyle) : 'Professional 2D Anime Illustration';

  const locationStrict = isLocation ? `
    [STRICT LOCATION MODE: NO HUMANS. NO CHARACTERS. NO PEOPLE. ZERO ORGANIC LIFE IN CLOSE-UP. PURE ENVIRONMENT DESIGN ONLY.]` : "";

  let viewSpecificInstruction = "";
  if (viewType === 'fpv') {
    viewSpecificInstruction = `
    FPV (FIRST PERSON VIEW) MODE:
    - Every panel MUST be from a First-Person Perspective (camera is at human eye level).
    - ${isLocation ? 'DO NOT show any hands, feet, or body parts. Focus purely on the environmental perspective as if the viewer is standing in the space.' : 'Include peripheral elements like hands reaching out or lower body/feet in some shots to sell the FPV effect.'}
    - Shots should be immersive and dynamic, simulating a walking path or a human observing details.
    - Diversity: Some shots looking slightly down, some looking straight ahead, some looking around corners.`;
  } else if (viewType === '360') {
    viewSpecificInstruction = `
    360 ORBIT / CIRCULAR VIEW MODE:
    - The panels should collectively represent a 360-degree rotation around the center of the scene.
    - Panel 1: Front view.
    - Panel 2: Right side view.
    - Panel 3: Back view.
    - Panel 4: Left side view.
    - Maintain perfect spatial continuity: the objects and lighting should be consistent as the camera "moves" around the scene.`;
  }

  let finalPrompt = `[CRITICAL DIMENSIONS: ASPECT RATIO ${aspectRatio}]
    [OUTPUT RESOLUTION: ${getResolutionForRatio(aspectRatio)}]
    
    MANDATORY LAYOUT: Create a SEAMLESS ${gridType} COLLAGE containing exactly ${totalViews} DIFFERENT and UNIQUE panels.
    ${locationStrict}
    - The output image MUST be a single image divided into a ${gridRows} (rows) by ${gridCols} (columns) matrix.
    - There must be EXACTLY ${gridRows} horizontal rows and ${gridCols} vertical columns.
    - LAYOUT: ZERO PADDING. ZERO MARGINS. NO WHITE BORDERS. NO THICK BORDERS. NO FRAMES. NO UI ELEMENTS.
    - The grid MUST be tight and seamless, with artwork bleeding directly to the edges of each panel.
    - SEPARATORS: None, or extremely thin 1px black lines.
    - NO LETTERBOXING: The artwork in each panel must fully occupy its rectangular area without top/bottom black or white bars.
    - NO PILLARBOXING: The artwork must fill the full width of each panel.
    - Edge-to-edge rendering is required for a professional look.
    
    Subject Content: "${prompt}"
    ${viewSpecificInstruction}
    
    CINEMATIC VARIETY & FILM FLOW (PREVENT DUPLICATION):
    - Each of the ${totalViews} panels MUST be a UNIQUE composition. DO NOT REPEAT THE SAME ANGLE.
    - DIVERSITY: Each panel must feel like a different frame from a high-quality movie sequence, advancing the action or showing a new detail.
    - ROW-BASED DIVERSITY (MANDATORY):
        * ROW 1 (Panels 1-${gridCols}): Establishing shots, wide angles, showing the environment and full character posture.
        * ROW 2 (Panels ${gridCols + 1}-${gridCols * 2}): Mid-range action shots, showing interaction, movement, and clear expressions.
        * ROW 3 (Panels ${gridCols * 2 + 1}-${gridCols * 3}): Dynamic close-ups, focusing on facial details, hands/props.
        ${gridRows >= 4 ? `* ROW 4 (Remaining): Creative shots, atmospheric details, cinematic bokeh, or dramatic environment highlights.` : ''}
    - SHOT TYPES: Use a mix of High Angle, Low Angle, Dutch Tilt, Over-the-shoulder, and Eye-level shots across the grid.
    - FULL BLEED: Artwork must touch all four edges of its respective panel. NO WHITE MARGINS. NO PADDING.
    
    RATIO DECREE:
    - The overall collage aspect ratio MUST be ${aspectRatio}.
    - Each individual panel MUST be perfectly composed for the correct cinematic framing of this ratio.
    
    Styling Instructions:
    - ${styleDesc} (Maintain this style strictly)
    - HIGH-END CINEMATIC CG RENDER. Physically based rendering (PBR), realistic lighting, volumetric atmosphere.
    - NO 2D outlines, NO sketch lines, NO flat colors, NO illustration style.
    - CINEMATIC DEPTH: Realistic shadows, bloom, raytracing, and high-fidelity textures.
    
    CRITICAL IDENTITY GUIDELINES:
    - IDENTITY PRESERVATION: If a reference image for a CHARACTER is provided, you must maintain their exact face, hair, and clothing. If a reference image for a LOCATION is provided, you must use that exact architecture, materials, and lighting style.
    - PERSPECTIVE FREEDOM: While you must keep the "identity" of characters and places consistent, you MUST NOT replicate the camera angle of the reference images unless explicitly told. 
    - CAMERA DIVERSITY: Use the reference images as "props" and "sets", but move the camera around them freely. Capture the scene from a different lens, height, and orientation for each view.`;

  // If we have context, modify instructions to enforce consistency
  if (contextImage) {
    const contextTypeMsg = isLocation ? "environment style, architectural details, and lighting" : "character design, clothing, lighting, and environment style";
    finalPrompt += `\n\nCONTINUITY INSTRUCTION (Previous Shot Provided):
      - GOAL: VISUAL CONSISTENCY. Keep the same ${contextTypeMsg} as the previous shot.
      - PLOT PROGRESSION: This is a direct sequel. Advance the action naturally. 
      - PERSPECTIVE SHIFT: DO NOT use the same camera angle as the previous shot. Move the camera to show the next beat of the story.`;

    if (referenceImages.length > 0) {
      finalPrompt += `\n\nNEW ACTION INSTRUCTION (Reference Images Provided):
          - ACTION/COMPOSITION: Adopt the composition, camera angle, and character pose from these new reference images.
          - SYNTHESIS: Re-draw the scene using the IDENTITY from the previous shot, but performing the ACTION/LAYOUT of the Reference Images.`;
    }
  } else if (referenceImages.length > 0) {
    // Standard reference usage
    finalPrompt += `\n\nREFERENCE INSTRUCTION (Visual Anchors Provided):
      - CHARACTER CONSISTENCY: Strictly maintain the character's designated clothing, hair, and facial features.
      - ENVIRONMENT CONSISTENCY: Use the provided location references for background identity.
      - TASK: Synthesize these anchor elements into the specific scene and actions described in the prompt while maintaining 100% visual recognition.
      - DYNAMIC CAMERA: Capture these anchors from the specific camera angles defined in the prompt.`;
  }

  const parts: any[] = [];
  parts.push({ text: finalPrompt });

  // Add Context Image First (High priority for consistency)
  if (contextImage) {
    // Clean base64 header if present
    const cleanBase64 = contextImage.includes(',') ? contextImage.split(',')[1] : contextImage;
    parts.push({ text: "CONTEXT IMAGE (PREVIOUS SHOT):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: cleanBase64
      }
    });
  }

  // Add other reference images for multimodal providers
  for (let i = 0; i < referenceImages.length; i++) {
    const ref = referenceImages[i];
    parts.push({ text: `VISUAL ANCHOR REFERENCE #${i + 1} (IDENTITY):` });
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data
      }
    });
  }

  // --- Provider Specific Execution ---
  if (provider === 'jimeng' || provider === 'jimeng-web') {
    return generateJimengImageGrid(finalPrompt, gridRows, gridCols, aspectRatio, imageSize, referenceImages, contextImage, artStyle, model);
  }

  await ensureApiKey();
  const ai = getClient();

  try {
    let fullImageBase64 = '';

    // DEBUG: Log to diagnose path selection
    console.log(`[generateMultiViewGrid] model: "${model}", provider: "${provider}"`);
    console.log(`[generateMultiViewGrid] model includes gemini: ${model.toLowerCase().includes('gemini')}`);


    // 1. Google Path (SDK)
    const apiKeyConfig = getApiKeyConfigForProvider(provider);
    console.log(`[generateMultiViewGrid] apiKeyConfig?.baseUrl: "${apiKeyConfig?.baseUrl}", provider from apiKeyConfig: "${apiKeyConfig?.provider}"`);
    if (provider === 'google' && !apiKeyConfig?.baseUrl) {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: parts
        },
        config: {
          // Both formats for maximum compatibility with different SDK versions
          imageConfig: {
            aspectRatio: aspectRatio,
          },
          // @ts-ignore - some versions use underscore
          aspect_ratio: aspectRatio,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
      });

      const candidate = response.candidates?.[0];
      const responseParts = candidate?.content?.parts || [];

      for (const part of responseParts) {
        if ((part as any).inlineData) {
          fullImageBase64 = `data:image/png;base64,${(part as any).inlineData.data}`;
          break;
        }
      }

      if (!fullImageBase64) {
        const textResponse = responseParts.find(p => p.text)?.text;
        const partsSummary = responseParts.map(p => Object.keys(p)).join(', ');

        let errorMsg = "";
        if (candidate?.finishReason === 'IMAGE_SAFETY') {
          errorMsg = "内容触发安全限制 (IMAGE_SAFETY)。提示：\n1. 简化剧本描述，避免描述敏感动作或词汇\n2. 检查所关联的角色照片是否过于暴露或包含敏感内容\n3. 尝试去除描述中的“写实”或“photo”类词汇";
        } else {
          errorMsg = `未能生成 Grid 图片。返回内容包含: [${partsSummary}]`;
          if (textResponse) {
            errorMsg += `\nAI 返回信息: "${textResponse.substring(0, 150)}..."`;
          }
          if (candidate?.finishReason) {
            errorMsg += `\n终止原因: ${candidate.finishReason}`;
          }
        }
        throw new Error(errorMsg);
      }
    }
    // 2. Other Providers including Antigravity (Fetch via OpenAI compatible protocol)
    // Antigravity proxies Gemini via OpenAI-compatible format but supports generationConfig
    else {
      const apiKey = apiKeyConfig?.key || "";
      const baseUrl = (apiKeyConfig?.baseUrl || "").replace(/\/$/, '');
      let apiEndpoint = baseUrl;
      if (!apiEndpoint.toLowerCase().endsWith('/chat/completions')) {
        apiEndpoint += '/chat/completions';
      }

      const messages = [{
        role: 'user',
        content: parts.map(p => {
          if (p.text) return { type: 'text', text: p.text };
          if (p.inlineData) return {
            type: 'image_url',
            image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` }
          };
          return null;
        }).filter(Boolean)
      }];

      // Build request body - include extra_body for Antigravity compatibility
      const isGeminiModel = model.toLowerCase().includes('gemini');
      const sizeString = getResolutionForRatio(aspectRatio); // e.g. "1280x720" for 16:9

      // Antigravity Method 2: Use model name suffix for aspect ratio
      // e.g. gemini-3-pro-image-16-9 for 16:9, gemini-3-pro-image-4-3 for 4:3
      let effectiveModel = model;
      if (isGeminiModel && model.toLowerCase().includes('image')) {
        // Convert aspect ratio to suffix format: "16:9" -> "-16-9"
        const ratioSuffix = aspectRatio.replace(':', '-'); // "16:9" -> "16-9"

        // Remove any existing ratio suffix from model name
        // Pattern: remove -1-1, -16-9, -4-3, -9-16, -21-9, -3-4 etc at the end
        const cleanModel = model.replace(/-\d+-\d+$/, '');

        // Also remove "(Image X:X)" style suffix if present
        const cleanerModel = cleanModel.replace(/\s*\(Image\s+\d+:\d+\)\s*/gi, '');

        // Add the correct ratio suffix
        effectiveModel = `${cleanerModel}-${ratioSuffix}`;
        console.log(`[Antigravity-Gemini] Model name adjusted: "${model}" -> "${effectiveModel}"`);
      }

      const requestBody: any = {
        model: effectiveModel, // Use adjusted model name with ratio suffix
        messages,
        // Antigravity-specific: use extra_body with size parameter (per official docs)
        // Supported: "1024x1024" (1:1), "1280x720" (16:9), "720x1280" (9:16), etc.
        extra_body: {
          size: sizeString
        },
        // Also include at top level for compatibility with other proxies
        size: sizeString
      };

      // Add generationConfig for additional Gemini compatibility
      if (isGeminiModel) {
        requestBody.generationConfig = {
          responseModalities: ['Image', 'Text'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: imageSize === ImageSize.K4 ? '4K' : (imageSize === ImageSize.K2 ? '2K' : '1K')
          }
        };
        console.log(`[Antigravity-Gemini] Using extra_body.size: "${sizeString}" for aspectRatio: ${aspectRatio}`);
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Provider Error (${provider}): ${response.status} - ${err}`);
      }

      const data = await response.json();

      // Try multiple response formats
      // 1. Gemini-style response (if proxy returns it)
      const candidates = data.candidates || [];
      const responseParts = candidates[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData) {
          fullImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      // 2. OpenAI-style response
      if (!fullImageBase64) {
        const content = data.choices?.[0]?.message?.content || "";
        // Check for inline base64 in text
        const b64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (b64Match) {
          fullImageBase64 = b64Match[0];
        }
        // Check for structured image data
        else if (data.data?.[0]?.url || data.data?.[0]?.b64_json) {
          fullImageBase64 = data.data[0].url || data.data[0].b64_json;
        }
        // Check for image parts in content array
        else if (Array.isArray(data.choices?.[0]?.message?.content)) {
          for (const item of data.choices[0].message.content) {
            if (item.type === 'image_url' && item.image_url?.url) {
              fullImageBase64 = item.image_url.url;
              break;
            }
            if (item.type === 'image' && item.url) {
              fullImageBase64 = item.url;
              break;
            }
          }
        }
      }

      if (fullImageBase64 && !fullImageBase64.startsWith('data:')) {
        if (!fullImageBase64.startsWith('http')) fullImageBase64 = `data:image/png;base64,${fullImageBase64}`;
      }
    }

    if (!fullImageBase64) throw new Error("分镜生成失败：未能从 AI 响应中提取到图像数据。");

    // Slice the single high-res grid into separate base64 images
    const panels = await sliceImageGrid(fullImageBase64, gridRows, gridCols);
    return { fullImage: fullImageBase64, slices: panels };

  } catch (error: any) {
    console.error("Grid generation error:", error);
    if (error.message?.toLowerCase().includes("failed to fetch")) {
      throw new Error(`生成失败: Failed to fetch (无法通联服务器)。\n检测模型: [${model}]\n检测供应商: [${provider}]\n详情建议：1. 检查 API 密钥或代理 Base URL; 2. 检查该模型是否需要开启 VPN; 3. 检查代理软件是否运行正常。`);
    }
    throw error;
  }
};

export const generateCameraMovement = async (
  prompt: string
): Promise<string> => {
  const model = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
  const provider = getProviderForModel(model);

  const systemInstruction = `You are a specialized AI Video prompter assistant. 
    Analyze the scene description and provide a technical Camera Movement Prompt that can be used for video generation models (like Veo or Sora).
    
    Examples:
    - "Slow dolly in, focusing on the character's eyes."
    - "Truck left, following the car at high speed, motion blur."
    - "Crane up establishing the vast landscape."
    - "Handheld camera, shaky footage, chaotic atmosphere."
    
    Output ONLY the camera movement description. Max 15 words. English.`;

  try {
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: { parts: [{ text: `Scene: ${prompt}` }] }
    });
    return result.text || "Static shot, slow zoom.";
  } catch (error) {
    console.error("Camera gen error:", error);
    return "Cinematic movement.";
  }
}

export const analyzeAsset = async (
  fileBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  const model = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
  const provider = getProviderForModel(model);

  try {
    // Ensure image is optimized before sending to prevent proxy timeouts or payload limits
    const resizedBase64Full = await resizeImageBase64(`data:${mimeType};base64,${fileBase64}`, 1024);

    // Extract actual mime type and data from the result
    const mimeMatch = resizedBase64Full.match(/data:([^;]+);base64,(.*)/);
    const actualMimeType = mimeMatch ? mimeMatch[1] : mimeType;
    const cleanBase64 = mimeMatch ? mimeMatch[2] : (resizedBase64Full.includes(',') ? resizedBase64Full.split(',')[1] : resizedBase64Full);

    const result = await callUniversalAI(model, provider, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: actualMimeType,
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    return result.text || "无法获取分析结果。";
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
};

export const analyzeFrameForVideo = async (
  fileBase64: string,
  mimeType: string,
  originalPrompt?: string
): Promise<string> => {
  const model = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
  const provider = getProviderForModel(model);

  const systemInstruction = `You are a cinematic analyst. 
  Describe the specific ACTION, CHARACTER EXPRESSION, and COMPOSITION of this exact frame for video generation. 
  Focus on what is happening right now in the picture. 
  Keep it concise and technical. Max 40 words. 
  Output only the English description.`;

  try {
    // Ensure image is optimized before sending to prevent proxy timeouts or payload limits
    const resizedBase64Full = await resizeImageBase64(`data:${mimeType};base64,${fileBase64}`, 1024);

    // Extract actual mime type and data from the result (it might have changed to image/jpeg)
    const mimeMatch = resizedBase64Full.match(/data:([^;]+);base64,(.*)/);
    const actualMimeType = mimeMatch ? mimeMatch[1] : mimeType;
    const cleanBase64 = mimeMatch ? mimeMatch[2] : (resizedBase64Full.includes(',') ? resizedBase64Full.split(',')[1] : resizedBase64Full);

    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: actualMimeType,
              data: cleanBase64
            }
          },
          { text: `Based on this image ${originalPrompt ? `(Context: ${originalPrompt})` : ''}, provide a detailed cinematic description for its motion start.` }
        ]
      }
    });

    return result.text || "Cinematic shot.";
  } catch (error) {
    console.error("Frame analysis error:", error);
    throw error;
  }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  const model = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
  const provider = getProviderForModel(model);

  try {
    const result = await callUniversalAI(model, provider, {
      contents: `You are a film director's assistant. Rewrite the following scene description into a detailed, cinematic image generation prompt. Focus on lighting, camera angle, texture, and mood. Keep it under 100 words. \n\nInput: "${rawPrompt}"`
    });
    return result.text || rawPrompt;
  } catch (error) {
    console.error("Prompt enhancement error:", error);
    return rawPrompt;
  }
};

export const translateText = async (text: string, targetLanguage: 'zh' | 'en'): Promise<string> => {
  const model = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
  const provider = getProviderForModel(model);

  const systemInstruction = targetLanguage === 'zh'
    ? "Translate the following English text to Simplified Chinese. Return ONLY the translated text without any other comments or formatting."
    : "Translate the following Chinese text to English. Return ONLY the translated text without any other comments or formatting.";

  try {
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: { parts: [{ text: text }] }
    });
    return result.text || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
};

export const generateCinematicPrompt = async (
  baseIdea: string,
  referenceImages: ReferenceImageData[] = []
): Promise<string> => {
  const model = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
  const provider = getProviderForModel(model);

  const systemInstruction = `You are a professional Director of Photography assistant.
  Your goal is to ENHANCE the user's existing idea with technical camera keywords, NOT to rewrite or replace their idea.
  
  Analyze the provided images (if any) and the user's text.
  Return a concise, comma-separated list of technical descriptors that can be appended to the prompt to make it look cinematic.
  Include: Camera Angle, Shot Size, Lens Type, Lighting Style.
  
  Format: [Original User Idea] + ", " + [Technical Keywords]
  
  Example Input: "A cyber samurai"
  Example Output: "A cyber samurai, low angle shot, anamorphic lens, neon rim lighting, volumetric fog, high contrast, 85mm"
  
  Do NOT write full sentences. Do NOT describe the subject again if the user already did. Just add the technical sauce.`;

  const contents: any[] = [];

  if (baseIdea.trim()) {
    contents.push({ text: `User Idea: "${baseIdea}"` });
  } else {
    contents.push({ text: `User Idea: Cinematic shot based on references.` });
  }

  // Add references for context
  referenceImages.forEach(ref => {
    contents.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data
      }
    });
  });

  try {
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: { parts: contents },
      temperature: 0.7
    });
    return result.text || baseIdea;
  } catch (error) {
    console.error("Auto-Director error:", error);
    return baseIdea;
  }
};

// --- Jimeng (Volcengine) API Implementation ---

const generateJimengImageGrid = async (
  prompt: string,
  gridRows: number,
  gridCols: number,
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  referenceImages: ReferenceImageData[] = [],
  contextImage?: string,
  artStyle?: ArtStyle,
  modelId: string = 'jimeng_t2i_v40'
): Promise<{ fullImage: string, slices: string[] }> => {
  const provider = getProviderForModel(modelId);
  const config = getApiKeyConfigForProvider(provider);
  if (!config) throw new Error(`请在设置中配置 ${provider === 'jimeng-web' ? '即梦 Web (网页版)' : '即梦 AI (Jimeng)'} API Key`);

  const styleDesc = artStyle ? getStyleDescription(artStyle) : 'High quality anime illustration';
  const gridType = `${gridRows}x${gridCols}`;
  const totalViews = gridRows * gridCols;

  const fullPrompt = prompt; // Use unified prompt

  const baseUrl = config.baseUrl || "/jimeng-api";

  // Choose endpoint and headers based on provider type
  let apiEndpoint = "";
  const headers: any = { "Content-Type": "application/json" };

  if (provider === 'jimeng-web') {
    // Reverse-engineered API endpoint (iptag/jimeng-api style)
    apiEndpoint = `${baseUrl.replace(/\/$/, '')}/v1/images/generations`;
    headers["Authorization"] = `Bearer ${config.key}`;
  } else {
    // Official Volcengine API proxy
    apiEndpoint = `${baseUrl.replace(/\/$/, '')}/v2/image_generation`;
    if (config.key.startsWith('sk-')) {
      headers["Authorization"] = `Bearer ${config.key}`;
    } else {
      headers["X-Access-Key"] = config.key;
      if (config.secretKey) headers["X-Secret-Key"] = config.secretKey;
    }
  }

  try {
    const payload: any = {
      model: modelId,
      model_id: modelId,
      prompt: `[ASPECT RATIO ${aspectRatio}] ${fullPrompt}`, // Use user-selected ratio in prompt for Jimeng
      aspect_ratio: aspectRatio,
      ratio: aspectRatio,
      size: getResolutionForRatio(aspectRatio),
      image_number: 1,
      image_url: referenceImages.length > 0 ? (referenceImages[0].data.startsWith('data:') ? referenceImages[0].data : `data:${referenceImages[0].mimeType};base64,${referenceImages[0].data}`) : undefined
    };

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`即梦 AI (${provider}) 生成失败: ${await parseAIError(response)}`);
    }

    const data = await response.json();

    // Check for error fields in JSON even if response.ok is true (for proxies/reverse APIs)
    const errorMsg = data.error || data.message || data.errmsg || (data.code && data.code !== 10000 ? data.message : null) || (data.ret && data.ret !== '0' ? data.errmsg : null);
    if (errorMsg) {
      throw new Error(`即梦 AI (${provider}) 返回错误: ${errorMsg}`);
    }

    // Support both Volcengine and Jimeng-Web response formats
    const imageData = data.data?.[0]?.url || data.data?.[0]?.base64 || data.data?.[0]?.b64_json;

    if (!imageData) {
      console.error("Jimeng unexpected response structure:", data);
      throw new Error("即梦 AI 未返回图片数据，请检查 Session ID 是否有效。");
    }

    const fullImageBase64 = imageData.startsWith('data:') ? imageData :
      (imageData.startsWith('http') ? imageData : `data:image/png;base64,${imageData}`);

    const panels = await sliceImageGrid(fullImageBase64, gridRows, gridCols);

    if (onUsageReported) onUsageReported(config.id);

    return { fullImage: fullImageBase64, slices: panels };
  } catch (error: any) {
    console.error("Jimeng Image Grid Error:", error);
    if (error.message?.includes("Failed to fetch")) {
      throw new Error(`即梦 AI (${provider}) 连接失败: Failed to fetch。\n请求地址: ${apiEndpoint}\n原因建议：1. 检查 API 地址是否正确；2. 浏览器 CORS 限制；3. 网络连接问题。`);
    }
    throw error;
  }
};

const generateJimengVideo = async (
  startFrame: GeneratedImage,
  endFrame?: GeneratedImage,
  config?: VideoMotionConfig,
  referenceImages: ReferenceImageData[] = [],
  artStyle?: ArtStyle,
  modelId: string = 'jimeng_ti2v_v30_pro'
): Promise<{ url: string; blob: Blob | null; prompt: string }> => {
  const provider = getProviderForModel(modelId);
  const apiKeyConfig = getApiKeyConfigForProvider(provider);
  if (!apiKeyConfig) throw new Error(`请在设置中配置 ${provider === 'jimeng-web' ? '即梦 Web (网页版)' : '即梦 AI (Jimeng)'} API Key`);

  const baseUrl = apiKeyConfig.baseUrl || "/jimeng-api";

  // Decide endpoint and headers
  let apiEndpoint = "";
  const headers: any = { "Content-Type": "application/json" };

  if (provider === 'jimeng-web') {
    apiEndpoint = `${baseUrl.replace(/\/$/, '')}/v1/videos/generations`;
    headers["Authorization"] = `Bearer ${apiKeyConfig.key}`;
  } else {
    apiEndpoint = `${baseUrl.replace(/\/$/, '')}/v2/video_generation`;
    if (apiKeyConfig.key.startsWith('sk-')) {
      headers["Authorization"] = `Bearer ${apiKeyConfig.key}`;
    } else {
      headers["X-Access-Key"] = apiKeyConfig.key;
      if (apiKeyConfig.secretKey) headers["X-Secret-Key"] = apiKeyConfig.secretKey;
    }
  }

  // Prepare images
  let startBase64 = "";
  if (startFrame.url.startsWith('data:')) {
    startBase64 = startFrame.url.split(',')[1];
  } else if (!startFrame.url || startFrame.url === "") {
    throw new Error("当前分镜尚未渲染底图 (Base Image is empty)。\n请先点击界面上的 'RENDER SEQUENCE' 生成图片，再基于生成的图片启动镜头推演。");
  } else {
    try {
      const fetchRes = await fetch(startFrame.url);
      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
      const startBlob = await fetchRes.blob();
      startBase64 = await fileToBase64(new File([startBlob], "start.png"));
    } catch (e) {
      throw new Error("无法读取底图文件。");
    }
  }
  const startResizedFull = await resizeImageBase64(startBase64);
  const startCleanB64 = startResizedFull.includes(',') ? startResizedFull.split(',')[1] : startResizedFull;
  const startFullUri = startResizedFull.startsWith('data:') ? startResizedFull : `data:image/jpeg;base64,${startResizedFull}`;

  let endCleanB64 = "";
  let endFullUri = "";
  if (endFrame) {
    let endBase64 = "";
    if (endFrame.url.startsWith('data:')) {
      endBase64 = endFrame.url.split(',')[1];
    } else {
      const fetchRes = await fetch(endFrame.url);
      const endBlob = await fetchRes.blob();
      endBase64 = await fileToBase64(new File([endBlob], "end.png"));
    }
    const endResizedFull = await resizeImageBase64(endBase64);
    endCleanB64 = endResizedFull.includes(',') ? endResizedFull.split(',')[1] : endResizedFull;
    endFullUri = endResizedFull.startsWith('data:') ? endResizedFull : `data:image/jpeg;base64,${endResizedFull}`;
  }

  let visualDescription = "";
  if (referenceImages.length > 0) {
    const analysisModel = appSettings.roles.chatAssistant || 'gemini-2.0-flash-exp';
    const ai = getClient('google'); // Always use Google for analysis if possible
    const anaParts = referenceImages.map(ref => ({ inlineData: { mimeType: ref.mimeType, data: ref.data } }));
    anaParts.push({ text: "Describe the character's clothing and appearance in detail (colors, hairstyle, accessories) and the environment so a video generator can maintain consistency. Use neutral, objective language and avoid any violent or sensitive terms. Max 30 words." } as any);

    try {
      const anaRes = await ai.models.generateContent({ model: analysisModel, contents: { parts: anaParts } });
      visualDescription = (anaRes.text || "").trim();
    } catch (e) {
      console.warn("[Jimeng-Consistency] Reference analysis failed.");
    }
  }

  let videoPrompt = (startFrame.prompt || '').trim();
  const gridTerms = [/2x2/gi, /3x3/gi, /collage/gi, /grid/gi, /split/gi, /matrix/gi, /panels/gi, /multiple views/gi];
  gridTerms.forEach(term => { videoPrompt = videoPrompt.replace(term, ""); });

  const motionDesc = getMotionDescription(config?.motionType, config?.intensity);
  const movementIns = config?.motionPrompt ? `. ACTION: ${config.motionPrompt}` : "";
  const identityIns = visualDescription ? `. SUBJECT: ${visualDescription}` : "";
  const styleDesc = artStyle ? `. STYLE: ${getStyleDescription(artStyle)}` : "";
  const speakingIns = config?.isSpeaking ? ". DIALOGUE: The character is speaking naturally." : "";

  let finalBasePrompt = videoPrompt;
  if (config?.customInstruction && config.customInstruction.trim()) {
    const custom = config.customInstruction.trim();
    // If the custom instruction already contains a good portion of the video prompt, 
    // or if it's long, treat it as the replacement prompt to avoid doubling.
    if (custom.toLowerCase().includes(videoPrompt.toLowerCase()) || custom.length > videoPrompt.length * 0.5) {
      finalBasePrompt = custom;
    } else {
      finalBasePrompt = `${videoPrompt} ${custom}`;
    }
  }

  const finalPrompt = `${finalBasePrompt}${styleDesc}. ${motionDesc}${movementIns}${identityIns}${speakingIns}`.trim();

  // Submit Job
  const payload: any = {
    model: modelId,
    model_id: modelId,
    prompt: finalPrompt,
    image_base64: startCleanB64,
    end_image_base64: endCleanB64 || undefined,
    duration: config?.duration || 5, // Default to 5 as per jimeng-api
    aspect_ratio: startFrame.aspectRatio || "16:9",
    // Compatibility with jimeng-api
    filePaths: [startFullUri],
    ratio: startFrame.aspectRatio || "16:9"
  };

  if (endCleanB64) {
    payload.filePaths.push(endFullUri);
  }

  // Pass additional consistency anchors if provided
  if (referenceImages && referenceImages.length > 0) {
    referenceImages.forEach(ref => {
      payload.filePaths.push(`data:${ref.mimeType};base64,${ref.data}`);
    });
  }

  // If using Web API, the payload might need direct URL or multipart if uploading, 
  // but jimeng-api usually handles base64 in the body for its OpenAI-like endpoint.
  // Actually, jimeng-api's /v1/videos/generations might expect an 'image' field (base64).
  // Compatibility with older proxy logic if needed
  if (provider === 'jimeng-web') {
    payload.image = startCleanB64;
  }

  const subRes = await fetch(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!subRes.ok) {
    throw new Error(`即梦视频提交失败 (${provider}): ${await parseAIError(subRes)}`);
  }

  const subData = await subRes.json();

  // Check for error fields in JSON even if subRes.ok is true
  const subErrorMsg = subData.error || subData.message || subData.errmsg || (subData.code && subData.code !== 10000 ? subData.message : null) || (subData.ret && subData.ret !== '0' ? subData.errmsg : null);
  if (subErrorMsg) {
    throw new Error(`即梦视频提交失败 (${provider}): ${subErrorMsg}`);
  }

  // Handling different response structures
  // Check if it's already a final result (Synchronous response from jimeng-api)
  const syncUrl = subData.video_url || subData.url || subData.data?.[0]?.url || subData.data?.[0]?.video_url || subData.data?.url;
  if (syncUrl) {
    console.log("[Jimeng-Video] Received direct video URL (Synchronous response)");
    const finalSyncUrl = syncUrl.startsWith('http') ? syncUrl : `${apiEndpoint.split('/v1')[0]}${syncUrl.startsWith('/') ? '' : '/'}${syncUrl}`;

    try {
      // Still try to download the blob for persistent storage
      const videoFetch = await fetch(finalSyncUrl);
      if (videoFetch.ok) {
        const videoBlob = await videoFetch.blob();
        console.log(`[Jimeng-Video] Sucessfully downloaded synchronous video blob: ${videoBlob.size} bytes`);
        return { url: finalSyncUrl, blob: videoBlob } as any;
      }
    } catch (e: any) {
      console.warn("[Jimeng-Video] Failed to download video blob for persistence:", e);
    }
    return { url: finalSyncUrl, blob: null, prompt: finalPrompt } as any;
  }

  let taskId = "";
  if (provider === 'jimeng-web') {
    // jimeng-api usually returns id or task_id if asynchronous, but it's often synchronous
    taskId = subData.id || subData.task_id || subData.data?.task_id || subData.data?.id;
  } else {
    taskId = subData.task_id || subData.data?.task_id;
  }

  if (!taskId) {
    console.error("Jimeng Video Submission unexpected response structure:", subData);
    throw new Error("即梦未返回任务 ID 或视频链接，请检查 Session ID 是否过期或频率过快。");
  }

  // 2. Poll for results
  // jimeng-api status endpoint is usually /v1/videos/generations/{id} or /v1/tasks/{id}
  // Let's assume /v2/tasks/{id} for the proxy we use, or we can use the jimeng-api native one if configured.
  // If baseUrl is pointing to our local jimeng_proxy.py, it should handle both.
  const pollEndpoint = provider === 'jimeng-web'
    ? `${baseUrl.replace(/\/$/, '')}/v1/videos/generations/${taskId}`
    : `${baseUrl.replace(/\/$/, '')}/v2/tasks/${taskId}`;

  let videoUrl = "";
  while (true) {
    await new Promise(r => setTimeout(r, 5000));
    const checkRes = await fetch(pollEndpoint, { headers });
    const checkData = await checkRes.json();

    const status = checkData.status || checkData.data?.status || (checkData.data?.[0]?.url ? 'success' : 'processing');
    if (status === 'success' || status === 'completed' || status === 'done' || (typeof status === 'number' && status === 10)) {
      videoUrl = checkData.video_url || checkData.url || checkData.data?.[0]?.url || checkData.data?.[0]?.video_url || checkData.data?.url;
      if (!videoUrl) {
        // Fallback if status is success but url shifted
        videoUrl = checkData.data?.video_url || checkData.data?.url;
      }
      break;
    } else if (status === 'failed' || status === 'error' || (typeof status === 'number' && status === 30)) {
      throw new Error(`即梦视频生成失败: ${checkData.error_message || checkData.message || "未知错误"}`);
    }
    console.log(`[Jimeng-Video] Task ${taskId} status: ${status}`);
  }

  // Reporting usage could be added here if the callback was provided

  const finalVideoUrl = videoUrl.startsWith('http') ? videoUrl : `${baseUrl.replace(/\/$/, '')}${videoUrl}`;

  try {
    const videoFetch = await fetch(finalVideoUrl);
    if (!videoFetch.ok) throw new Error(`Video download failed: ${videoFetch.status}`);
    const videoBlob = await videoFetch.blob();
    return { url: URL.createObjectURL(videoBlob), blob: videoBlob, prompt: finalPrompt } as any;
  } catch (e: any) {
    return { url: finalVideoUrl, blob: null, prompt: finalPrompt } as any;
  }
};

/**
 * Qwen-Image-Edit Implementation via local proxy
 */
// Helper to convert blob/url to base64 with timeout
const imageUrlToBase64 = async (url: string, timeoutMs: number = 10000): Promise<string> => {
  console.log("[imageUrlToBase64] Starting conversion for:", url.substring(0, 50) + "...");

  if (url.startsWith('data:')) {
    console.log("[imageUrlToBase64] Already base64, returning as-is");
    return url;
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`URL 转 Base64 超时 (${timeoutMs}ms)`)), timeoutMs);
  });

  const conversionPromise = (async () => {
    try {
      console.log("[imageUrlToBase64] Fetching URL...");
      const response = await fetch(url);
      console.log("[imageUrlToBase64] Fetch complete, status:", response.status);

      const blob = await response.blob();
      console.log("[imageUrlToBase64] Blob created, size:", blob.size);

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log("[imageUrlToBase64] FileReader complete");
          resolve(reader.result as string);
        };
        reader.onerror = (e) => {
          console.error("[imageUrlToBase64] FileReader error:", e);
          reject(e);
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("[imageUrlToBase64] Conversion failed:", e);
      throw e;
    }
  })();

  try {
    return await Promise.race([conversionPromise, timeoutPromise]);
  } catch (e) {
    console.error("[imageUrlToBase64] Failed with error:", e);
    // 如果转换失败，直接返回原始 URL，让代理端处理
    return url;
  }
};

export const generateQwenImageEdit = async (
  imageUrl: string,
  prompt: string,
  modelId: string = 'qwen-image-edit-plus'
): Promise<string> => {
  console.log("[Qwen Edit] Starting edit request...");
  console.log("[Qwen Edit] Input imageUrl type:", imageUrl.substring(0, 30) + "...");
  console.log("[Qwen Edit] Prompt:", prompt.substring(0, 50) + "...");

  const config = getApiKeyConfigForProvider('qwen');
  if (!config) throw new Error('未配置 Qwen (DashScope) API Key');

  const proxyUrl = 'http://127.0.0.1:8046/v2/qwen_image_edit';

  // Ensure we send base64 if it is a local blob/file
  console.log("[Qwen Edit] Converting to base64 if needed...");
  const processedUrl = (imageUrl.startsWith('blob:') || imageUrl.startsWith('http://localhost'))
    ? await imageUrlToBase64(imageUrl)
    : imageUrl;
  console.log("[Qwen Edit] Processed URL type:", processedUrl.substring(0, 30) + "...");

  try {
    console.log("[Qwen Edit] Sending request to proxy:", proxyUrl);
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`
      },
      body: JSON.stringify({
        model: modelId,
        image_url: processedUrl,
        prompt: prompt
      })
    });

    console.log("[Qwen Edit] Proxy response status:", response.status);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Qwen 编辑失败: ${response.status} - ${err}`);
    }

    const data = await response.json();
    console.log("[Qwen Edit] Proxy response data keys:", Object.keys(data));

    if (data.error) throw new Error(`Qwen 返回错误: ${data.error}`);

    const resultUrl = data.data?.[0]?.url;
    if (!resultUrl) throw new Error("Qwen 未能返回有效图片地址");

    console.log("[Qwen Edit] Success! Result URL:", resultUrl.substring(0, 50) + "...");
    if (onUsageReported) onUsageReported(config.id);
    return resultUrl;
  } catch (error: any) {
    console.error("Qwen Edit Error:", error);
    throw error;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const cleanJsonString = (str: string) => {
  try {
    // Remove markdown code blocks if present
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
  } catch (e) {
    return str;
  }
};

export const generateCharacterDesignPrompts = async (bio: string, fileData?: { mimeType: string, data: string }): Promise<{ characterName: string, characterBio: string, forms: { formName: string, prompt: string }[] }[]> => {
  const model = appSettings.roles.scriptAnalysis || 'gemini-3-flash';
  const provider = getProviderForModel(model);

  const systemInstruction = `TASK: Character Analysis and Visual Design.
  Analyze the provided script document or text and extract the MAIN characters. 

  STRICT JSON RULES:
  1. Return ONLY a raw JSON array.
  2. NO CHAT, NO EXPLANATION, NO "Here is the JSON...".
  3. Format example: [{"characterName": "名字", "characterBio": "简介", "forms": [{"formName": "形态", "prompt": "English Prompt"}]}]

  For each character:
  - characterName: Simplified Chinese name.
  - characterBio: Concise 2-sentence Chinese summary.
  - forms: List of visual forms.
    - formName: Chinese name.
    - prompt: Detailed English image prompt (focus on appearance).
  
  If no characters are found, return [].`;

  try {
    const parts: any[] = [];
    if (fileData) {
      parts.push({
        inlineData: fileData,
        text: "SOURCE SCRIPT ATTACHED. Please analyze characters from this document."
      } as any);
    }

    if (bio.trim()) {
      parts.push({ text: `INPUT TEXT / CHARACTER DESCRIPTION:\n${bio}` });
    }

    console.log("[Extraction] Starting character extraction for bio length:", bio.length);
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: { parts },
      jsonMode: true,
      temperature: 0, // Force determinism for schema adherence
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ]
    });

    const text = result.text || "";
    console.log("[Extraction] Raw Response:", text);

    if (!text || text.trim() === "") {
      console.warn("[Extraction] Empty response from AI");
      return [];
    }

    let parsed: any;
    try {
      parsed = safeJsonParse(text);
    } catch (e: any) {
      console.warn("[Extraction] All JSON parse attempts failed.");
      const snippet = text.slice(0, 100).replace(/\n/g, ' ') + "...";
      throw new Error(`AI 返回格式不正确 (JSON_ERROR)。解析失败片段: [ ${snippet} ]。可能原因: 模型输出包含干扰文本、回复被截断或模型能力不足。`);
    }

    // Handle case where AI wraps the array in an object (e.g. { "characters": [...] })
    let characterArray: any[] = [];
    if (Array.isArray(parsed)) {
      characterArray = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const potentialArray = parsed.characters || parsed.results || parsed.data || Object.values(parsed).find(v => Array.isArray(v));
      if (Array.isArray(potentialArray)) {
        characterArray = potentialArray;
      } else if (parsed.characterName || parsed.name) {
        characterArray = [parsed];
      }
    }

    if (characterArray.length === 0) {
      console.warn("[Extraction] No characters found in parsed JSON array");
      return [];
    }

    return characterArray.map((c: any) => {
      const name = c.characterName || c.name || "未知角色";
      const bio = c.characterBio || c.bio || "剧本角色设定";

      let forms = [];
      if (Array.isArray(c.forms)) {
        forms = c.forms.map((f: any) => ({
          formName: typeof f === 'string' ? f : (f.formName || f.name || f.view || "常规形态"),
          prompt: typeof f === 'string' ? "" : (f.prompt || f.description || "")
        }));
      } else {
        forms = [{ formName: "基础形态", prompt: c.prompt || c.description || "" }];
      }

      return { characterName: name, characterBio: bio, forms };
    });
  } catch (error: any) {
    console.error("[Extraction] Character extraction error:", error);
    // Throw descriptive error so the UI can show it
    throw new Error(error.message || "AI 提取服务异常，请检查网络或更换模型重试");
  }
};

const getStyleDescription = (artStyle: ArtStyle): string => {
  switch (artStyle) {
    case ArtStyle.STUDIO_GHIBLI:
      return "Studio Ghibli style, Hayao Miyazaki aesthetic. Warm, hand-drawn look, gouache painted textures, nostalgic and peaceful atmosphere.";
    case ArtStyle.MAKOTO_SHINKAI:
      return "Makoto Shinkai aesthetic. Clean and precise line-art, beautiful visuals, vibrant colors, cinematic lighting, high-end digital painting.";
    case ArtStyle.MODERN_SHONEN:
      return "Modern Shonen anime (ufotable style). Sharp lines, high contrast, dynamic digital effects, dramatic lighting, sophisticated cel-shading.";
    case ArtStyle.RETRO_90S:
      return "90s retro anime aesthetic. Grainy cel-shading, traditional hand-painted look, vintage color palette, nostalgic 1990s feel.";
    case ArtStyle.CHINESE_MANHUA:
      return "Premium Chinese Manhua aesthetic. High-detail digital painting, elegant character designs, blending traditional silk textures with modern cinematic rendering.";
    case ArtStyle.YAO_LI_GUOFENG:
      return "Yao Li illustration style (尧立国风). A blend of delicate Gongbi line work and Zhang Daqian's splashed ink-and-color (泼墨泼彩) on vintage rice paper. Features translucent malachite green, azurite blue, and soft cinnabar accents with shimmering golden outlines (描金). The atmosphere is poetic, ethereal, and majestic, with vibrant but clean color washes and spiritual energy. High-end traditional Chinese aesthetic.";
    case ArtStyle.CYBERPUNK_ANIME:
      return "Cyberpunk anime aesthetic. Neon-lit reflections, mechanical details, gritty industrial textures, sharp high-tech line-art with glow effects.";
    case ArtStyle.CG_GAME_ART:
      return "Triple-A CG Game Art. Realistic skin textures, subsurface scattering, dramatic volumetric lighting, Raytraced reflections, Unreal Engine 5 aesthetic, Octane Render quality, cinematic depth of field, 8k resolution, hyper-detailed.";
    case ArtStyle.REALISTIC:
      return "Photorealistic, cinematic realism, East Asian / Chinese face and features, 8k resolution, highly detailed skin textures, realistic lighting and shadows, movie-like atmosphere, professional photography quality.";
    case ArtStyle.KOREAN_WEBTOON:
      return "Premium Korean Webtoon. Sleek line-art, luxury digital gradients, high-end commercial illustration style with soft cinematic lighting.";
    default:
      return "Triple-A CG Game Art. Realistic skin textures, subsurface scattering, dramatic volumetric lighting, Raytraced reflections, Unreal Engine 5 aesthetic, Octane Render quality, cinematic depth of field, 8k resolution, hyper-detailed.";
  }
};

export const generateCharacterImage = async (
  designPrompt: string,
  view: 'front' | 'multiview',
  artStyle: ArtStyle = ArtStyle.CG_GAME_ART,
  aspectRatio: AspectRatio = AspectRatio.PORTRAIT, // Default portrait for characters
  imageSize: ImageSize = ImageSize.K4,
  referenceImage?: string
): Promise<string> => {
  const model = appSettings.roles.imageGeneration || 'jimeng_t2i_v40';
  const provider = getProviderForModel(model);

  const styleDesc = getStyleDescription(artStyle);

  const viewInstruction = view === 'front'
    ? "VIEW: Front-facing full body shot, neutral pose, looking directly at camera."
    : "VIEW: A professional character reference sheet in a WIDE (16:9) aspect ratio. Horizontal Layout: (Left) Enlarged face close-up for facial details, (Middle) Full-body front view, (Right) Full-body back view. Neatly arranged side-by-side with no overlapping.";

  const finalPrompt = `
    Character Description: ${designPrompt}
    ${viewInstruction}
    
    STRICT REQUIREMENTS:
    - BACKGROUND: PURE SOLID WHITE (#FFFFFF). NO GRAY, NO OBJECTS, NO TEXTURES, NO GRADIENTS.
    - VISUAL QUALITY: Masterpiece, high-end CG render, cinematic lighting, subsurface scattering, extreme detail, ${imageSize}.
    - NO TEXT, NO LABELS, NO ANNOTATIONS.
  `;

  if (provider === 'jimeng' || model.includes('jimeng')) {
    // For Jimeng, we merge the reference image if it exists
    const refArray: ReferenceImageData[] = referenceImage ? [{
      mimeType: 'image/png',
      data: referenceImage.includes(',') ? referenceImage.split(',')[1] : referenceImage
    }] : [];
    const res = await generateJimengImageGrid(finalPrompt, 1, 1, view === 'multiview' ? AspectRatio.WIDE : aspectRatio, imageSize, refArray, undefined, artStyle, model);
    return res.fullImage;
  }

  await ensureApiKey();
  const ai = getClient(provider);

  const genericFinalPrompt = `
    ${finalPrompt}
    ${styleDesc}
    - Ratio: ${view === 'multiview' ? '16:9' : aspectRatio}.
  `;


  try {
    const parts: any[] = [];
    if (referenceImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: referenceImage.includes(',') ? referenceImage.split(',')[1] : referenceImage
        }
      });
      parts.push({ text: "CONTINUITY REFERENCE: This is the SAME character. Maintain the EXACT hairstyle, face shape, and outfit details as shown in this reference image." });
    }
    parts.push({ text: finalPrompt });

    let resultUrl = '';

    // 1. Google Path (SDK)
    const apiKeyConfig = getApiKeyConfigForProvider(provider);
    if (provider === 'google' && !apiKeyConfig?.baseUrl) {
      const ai = getClient(provider);
      const response = await ai.models.generateContent({
        model,
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: view === 'multiview' ? AspectRatio.WIDE : aspectRatio
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
          resultUrl = `data:image/png;base64,${(part as any).inlineData.data}`;
          break;
        }
      }
    }
    // 2. Other Providers (Fetch via OpenAI compatible protocol)
    else {
      const apiKeyConfig = getApiKeyConfigForProvider(provider);
      const apiKey = apiKeyConfig?.key || "";
      const baseUrl = (apiKeyConfig?.baseUrl || "").replace(/\/$/, '');
      let apiEndpoint = baseUrl;
      if (!apiEndpoint.toLowerCase().endsWith('/chat/completions')) {
        apiEndpoint += '/chat/completions';
      }

      const isGeminiModel = model.toLowerCase().includes('gemini');
      const targetAspectRatio = view === 'multiview' ? AspectRatio.WIDE : aspectRatio;
      const sizeString = getResolutionForRatio(targetAspectRatio);

      // Antigravity Aspect Ratio Support: Adjust model name with suffix
      let effectiveModel = model;
      if (isGeminiModel && model.toLowerCase().includes('image')) {
        const ratioSuffix = targetAspectRatio.replace(':', '-');
        const cleanModel = model.replace(/-\d+-\d+$/, '').replace(/\s*\(Image\s+\d+:\d+\)\s*/gi, '');
        effectiveModel = `${cleanModel}-${ratioSuffix}`;
        console.log(`[Antigravity-Gemini] Character Model adjusted: "${model}" -> "${effectiveModel}"`);
      }

      const messages = [{
        role: 'user',
        content: parts.map(p => {
          if (p.text) return { type: 'text', text: p.text };
          if (p.inlineData) return {
            type: 'image_url',
            image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` }
          };
          return null;
        }).filter(Boolean)
      }];

      const requestBody: any = {
        model: effectiveModel,
        messages,
        size: sizeString,
        extra_body: { size: sizeString }
      };

      // Add generationConfig for additional Gemini compatibility
      if (isGeminiModel) {
        requestBody.generationConfig = {
          responseModalities: ['Image', 'Text'],
          imageConfig: {
            aspectRatio: targetAspectRatio,
            imageSize: imageSize === ImageSize.K4 ? '4K' : (imageSize === ImageSize.K2 ? '2K' : '1K')
          }
        };
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Provider Error (${provider}): ${response.status} - ${err}`);
      }

      const data = await response.json();
      // Extract image from various potential return formats
      const content = data.choices?.[0]?.message?.content || "";

      // Check for base64 in content (often proxies return it in the text or as a specialized field)
      const b64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (b64Match) {
        resultUrl = b64Match[0];
      } else if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
        // Some models return images via tool calls
        const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
        resultUrl = args.image || args.url || args.b64_json;
      } else {
        // Check for DALL-E style response even on chat endpoint
        resultUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
      }

      if (resultUrl && !resultUrl.startsWith('data:')) {
        if (resultUrl.startsWith('http')) { /* standard URL */ }
        else resultUrl = `data:image/png;base64,${resultUrl}`;
      }
    }

    if (!resultUrl) throw new Error("生图失败：未能从 AI 响应中提取到图像数据。请检查模型是否支持生图。");
    return resultUrl;
  } catch (error: any) {
    console.error("Character image gen error:", error);
    if (error.message?.toLowerCase().includes("failed to fetch")) {
      throw new Error(`生成失败: Failed to fetch (请检查网络环境)。\n检测模型: [${model}]\n检测供应商: [${provider}]\n若使用 Jimeng 请尝试刷新，若使用 Google 请确保 VPN 已正确配置。`);
    }
    throw error;
  }
};

export const inpaintImage = async (
  originalImage: string,
  maskImage: string,
  prompt: string,
  artStyle: ArtStyle = ArtStyle.CG_GAME_ART,
  aspectRatio: AspectRatio = AspectRatio.WIDE,
  imageSize: ImageSize = ImageSize.K4,
  isMultiview: boolean = false
): Promise<string> => {
  // Use image generation model from settings, fallback to gemini-3-pro-image
  const model = appSettings.roles.imageGeneration || 'gemini-3-pro-image';
  const provider = getProviderForModel(model);

  await ensureApiKey();
  const apiKeyConfig = getApiKeyConfigForProvider(provider);
  const styleDesc = getStyleDescription(artStyle);

  // Ensure images are base64
  let originalBase64 = originalImage;
  if (originalImage.startsWith('http') || originalImage.startsWith('blob:')) {
    try {
      originalBase64 = await imageUrlToBase64(originalImage);
    } catch (e) {
      console.error("[Inpaint] Failed to convert original image to base64:", e);
    }
  }

  const contextNote = isMultiview
    ? "CONTEXT: This is a professional CHARACTER REFERENCE SHEET / MULTI-VIEW GRID. You MUST keep the layout, three-view structure, and all other views EXACTLY as they are. ONLY modify the masked area while maintaining the identity and style of the existing character views."
    : "CONTEXT: Maintain exact composition and layout of the original image.";

  const finalPrompt = `
    TASK: Partial Repaint (Inpainting)
    ${contextNote}
    Target Modification: ${prompt}
    ${styleDesc}
    
    INSTRUCTION: Repaint ONLY the area indicated by the white mask in the mask image provided. 
    Maintain consistent style, lighting, and textures with the rest of the original image.
    The new content in the masked area should be: ${prompt}
    
    STRICT REQUIREMENTS:
    - ASPECT RATIO: MUST BE ${aspectRatio}. 
    - LAYOUT: DO NOT ZOOM, DO NOT CROP, DO NOT CHANGE CAMERA ANGLE.
    - NO TEXT, NO LABELS, NO UI ELEMENTS.
    - IMAGE QUALITY: Masterpiece, High Definition, sharp details.
  `;

  try {
    let resultUrl = '';

    // 1. Jimeng Path (Special handling for Jimeng T2I/I2I)
    if (provider === 'jimeng' || provider === 'jimeng-web' || model.toLowerCase().includes('jimeng')) {
      console.log("[Inpaint] Using Jimeng specific path");
      const refArray: ReferenceImageData[] = [{
        mimeType: 'image/png',
        data: originalBase64.includes(',') ? originalBase64.split(',')[1] : originalBase64
      }];

      const jimengPrompt = `[INPAINT MODE] ${finalPrompt}`;

      const res = await generateJimengImageGrid(
        jimengPrompt,
        1, 1,
        aspectRatio,
        imageSize,
        refArray,
        undefined,
        artStyle,
        model
      );
      return res.fullImage;
    }

    // 2. Google Path (SDK) - No baseUrl
    if (provider === 'google' && !apiKeyConfig?.baseUrl) {
      const ai = getClient(provider);
      const parts: any[] = [
        {
          inlineData: {
            mimeType: 'image/png',
            data: originalBase64.includes(',') ? originalBase64.split(',')[1] : originalBase64
          }
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: maskImage.includes(',') ? maskImage.split(',')[1] : maskImage
          }
        },
        { text: finalPrompt }
      ];

      const response = await ai.models.generateContent({
        model,
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
          resultUrl = `data:image/png;base64,${(part as any).inlineData.data}`;
          break;
        }
      }
    }
    // 3. Other Providers (Fetch/Proxy Path - Antigravity etc.)
    else {
      const apiKey = apiKeyConfig?.key || "";
      let baseUrl = (apiKeyConfig?.baseUrl || "").replace(/\/$/, '');

      if (baseUrl.includes('127.0.0.1:8045') || baseUrl.includes('localhost:8045')) {
        baseUrl = baseUrl.replace(/https?:\/\/(127\.0\.0\.1|localhost):8045/, '/antigravity-api');
      }

      let apiEndpoint = baseUrl;
      if (!apiEndpoint.toLowerCase().endsWith('/chat/completions') && !apiEndpoint.toLowerCase().endsWith('/images/generations')) {
        if (!apiEndpoint.toLowerCase().endsWith('/v1')) apiEndpoint += '/v1';
        apiEndpoint += '/chat/completions';
      }

      const isGeminiModel = model.toLowerCase().includes('gemini');
      const sizeString = getResolutionForRatio(aspectRatio);

      let effectiveModel = model;
      if (isGeminiModel && model.toLowerCase().includes('image')) {
        const ratioSuffix = aspectRatio.replace(':', '-');
        const cleanModel = model.replace(/-\d+-\d+$/, '').replace(/\s*\(Image\s+\d+:\d+\)\s*/gi, '');
        effectiveModel = `${cleanModel}-${ratioSuffix}`;
        console.log(`[Antigravity-Gemini] Inpaint Model adjusted: "${model}" -> "${effectiveModel}"`);
      }

      const messages = [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: originalBase64.startsWith('data:') ? originalBase64 : `data:image/png;base64,${originalBase64}` }
          },
          {
            type: 'image_url',
            image_url: { url: maskImage.startsWith('data:') ? maskImage : `data:image/png;base64,${maskImage}` }
          },
          { type: 'text', text: finalPrompt }
        ]
      }];

      const requestBody: any = {
        model: effectiveModel,
        messages,
        temperature: 0.7,
        size: sizeString,
        extra_body: { size: sizeString }
      };

      if (isGeminiModel) {
        requestBody.generationConfig = {
          responseModalities: ['Image', 'Text'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: imageSize === ImageSize.K4 ? '4K' : '2K'
          }
        };
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Provider Error (${provider}): ${response.status} - ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      const b64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (b64Match) {
        resultUrl = b64Match[0];
      } else if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
        const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
        resultUrl = args.image || args.url || args.b64_json;
      } else {
        resultUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
      }

      if (resultUrl && !resultUrl.startsWith('data:')) {
        if (!resultUrl.startsWith('http')) {
          resultUrl = `data:image/png;base64,${resultUrl}`;
        }
      }
    }

    if (!resultUrl) throw new Error("局部重绘失败：未能获取生成图像。");
    return resultUrl;
  } catch (error) {
    console.error("Inpainting error:", error);
    throw error;
  }
};

export const generateLocationDesignPrompts = async (script: string, fileData?: { mimeType: string, data: string }): Promise<{ name: string, description: string, forms: { formName: string, prompt: string }[] }[]> => {
  const model = appSettings.roles.scriptAnalysis || 'gemini-3-flash';
  const provider = getProviderForModel(model);

  const systemInstruction = `TASK: Environment/Location Analysis for Script.
  Analyze the provided script document or text and extract the KEY locations/environments. 

  STRICT JSON RULES:
  1. Return ONLY a raw JSON array.
  2. NO CHAT, NO EXPLANATION, NO "Here is the JSON...".
  3. Format example: [{"name": "场景名", "description": "简介", "forms": [{"formName": "描述", "prompt": "Detailed English Scene Prompt"}]}]

  For each location:
  - name: Simplified Chinese name (e.g. "秦王宫寝殿").
  - description: Concise 2-sentence Chinese summary of the atmosphere and key features.
  - forms: List of visual variations or base preview.
    - formName: Chinese name (e.g. "白昼", "深夜", "战火中").
    - prompt: Richly detailed English image prompt focusing on architecture, lighting, texture, and mood.
  
  If no locations are found, return [].`;

  try {
    const parts: any[] = [];
    if (fileData) {
      parts.push({
        inlineData: fileData,
        text: "SOURCE SCRIPT ATTACHED. Please analyze locations from this document."
      } as any);
    }

    if (script.trim()) {
      parts.push({ text: `INPUT TEXT / SCENE DESCRIPTION:\n${script}` });
    }

    console.log("[Extraction] Starting location extraction for script length:", script.length);
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: { parts },
      jsonMode: true,
      temperature: 0,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ]
    });

    const text = result.text || "";
    console.log("[Extraction] Location Raw Response:", text);

    if (!text || text.trim() === "") {
      console.warn("[Extraction] Empty response from AI for locations");
      return [];
    }

    let parsed: any;
    try {
      parsed = safeJsonParse(text);
    } catch (e: any) {
      console.warn("[Extraction] Location JSON parse failed.");
      const snippet = text.slice(0, 100).replace(/\n/g, ' ') + "...";
      throw new Error(`AI 返回场景格式不正确 (JSON_ERROR)。解析失败片段: [ ${snippet} ]。`);
    }

    // Flexible extraction: find the array anywhere in the response
    let locationArray: any[] = [];
    if (Array.isArray(parsed)) {
      locationArray = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const potentialArray = parsed.locations || parsed.results || parsed.scenes || parsed.data || Object.values(parsed).find(v => Array.isArray(v));
      if (Array.isArray(potentialArray)) {
        locationArray = potentialArray;
      } else if (parsed.name || parsed.locationName) {
        locationArray = [parsed];
      }
    }

    if (locationArray.length === 0) {
      console.warn("[Extraction] No locations found in parsed JSON");
      return [];
    }

    return locationArray.map((l: any) => {
      const name = l.name || l.locationName || "未知场景";
      const description = l.description || "剧本提及场景";

      let forms = [];
      if (Array.isArray(l.forms)) {
        forms = l.forms.map((f: any) => ({
          formName: typeof f === 'string' ? f : (f.formName || f.name || "基础预览"),
          prompt: typeof f === 'string' ? "" : (f.prompt || f.description || "")
        }));
      } else {
        forms = [{ formName: "基础预览", prompt: l.prompt || l.description || "" }];
      }

      return { name, description, forms };
    });
  } catch (error: any) {
    console.error("[Extraction] Location extraction error:", error);
    throw new Error(error.message || "场景提取服务异常");
  }
};

export const generateLocationImage = async (
  designPrompt: string,
  artStyle: ArtStyle = ArtStyle.CG_GAME_ART,
  aspectRatio: AspectRatio = AspectRatio.WIDE,
  imageSize: ImageSize = ImageSize.K4,
  referenceImage?: string
): Promise<string> => {
  const model = appSettings.roles.imageGeneration || 'jimeng_t2i_v40';
  const provider = getProviderForModel(model);

  if (provider === 'jimeng' || model.includes('jimeng')) {
    const res = await generateJimengImageGrid(designPrompt, 1, 1, aspectRatio, imageSize, [], undefined, artStyle, model);
    return res.fullImage;
  }

  await ensureApiKey();
  const ai = getClient(provider);

  const styleDesc = getStyleDescription(artStyle);

  const finalPrompt = `
    Environment Description: ${designPrompt}
    ${styleDesc}
    
    STRICT REQUIREMENTS:
    - BACKGROUND: FOCUS ON ENVIRONMENT DESIGN. NO CHARACTERS.
    - VISUAL QUALITY: Masterpiece, high-end CG render, Unreal Engine 5 landscape style, cinematic volumetric weather effects, 8k detail.
    - LIGHTING: Global illumination, atmospheric scattering, dramatic shadows.
    - NO 2D OUTLINES, NO FLAT COLORS, NO COMIC STYLE.
    - Ratio: ${aspectRatio}.
  `;


  try {
    const parts: any[] = [];
    if (referenceImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: referenceImage.includes(',') ? referenceImage.split(',')[1] : referenceImage
        }
      });
      parts.push({ text: "CONTINUITY REFERENCE: This image shows the location for IDENTIFICATION. Maintain the architectural style, color palette, and key features of this place EXACTLY, but you MUST capture it from a DIFFERENT camera angle or focal length as described in the prompt. Use this as a 'set' to film in, not a picture to copy." });
    }
    parts.push({ text: finalPrompt });

    let resultUrl = '';

    // 1. Google Path (SDK)
    const apiKeyConfig = getApiKeyConfigForProvider(provider);
    if (provider === 'google' && !apiKeyConfig?.baseUrl) {
      const ai = getClient(provider);
      const response = await ai.models.generateContent({
        model,
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
          resultUrl = `data:image/png;base64,${(part as any).inlineData.data}`;
          break;
        }
      }
    }
    // 2. Other Providers (Fetch via OpenAI compatible protocol)
    else {
      const apiKeyConfig = getApiKeyConfigForProvider(provider);
      const apiKey = apiKeyConfig?.key || "";
      const baseUrl = (apiKeyConfig?.baseUrl || "").replace(/\/$/, '');
      let apiEndpoint = baseUrl;
      if (!apiEndpoint.toLowerCase().endsWith('/chat/completions')) {
        apiEndpoint += '/chat/completions';
      }

      const isGeminiModel = model.toLowerCase().includes('gemini');
      const sizeString = getResolutionForRatio(aspectRatio);

      // Antigravity Aspect Ratio Support: Adjust model name with suffix
      let effectiveModel = model;
      if (isGeminiModel && model.toLowerCase().includes('image')) {
        const ratioSuffix = aspectRatio.replace(':', '-');
        const cleanModel = model.replace(/-\d+-\d+$/, '').replace(/\s*\(Image\s+\d+:\d+\)\s*/gi, '');
        effectiveModel = `${cleanModel}-${ratioSuffix}`;
        console.log(`[Antigravity-Gemini] Location Model adjusted: "${model}" -> "${effectiveModel}"`);
      }

      const messages = [{
        role: 'user',
        content: parts.map(p => {
          if (p.text) return { type: 'text', text: p.text };
          if (p.inlineData) return {
            type: 'image_url',
            image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` }
          };
          return null;
        }).filter(Boolean)
      }];

      const requestBody: any = {
        model: effectiveModel,
        messages,
        size: sizeString,
        extra_body: { size: sizeString }
      };

      // Add generationConfig for additional Gemini compatibility
      if (isGeminiModel) {
        requestBody.generationConfig = {
          responseModalities: ['Image', 'Text'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: imageSize === ImageSize.K4 ? '4K' : '2K'
          }
        };
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Provider Error (${provider}): ${response.status} - ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const b64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (b64Match) {
        resultUrl = b64Match[0];
      } else {
        resultUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
      }

      if (resultUrl && !resultUrl.startsWith('data:')) {
        if (!resultUrl.startsWith('http')) resultUrl = `data:image/png;base64,${resultUrl}`;
      }
    }

    if (!resultUrl) throw new Error("生图失败：未能从 AI 响应中提取到图像数据。");
    return resultUrl;
  } catch (error: any) {
    console.error("Location image gen error:", error);
    if (error.message?.includes("Failed to fetch")) {
      throw new Error(`生成失败: Failed to fetch。\n检测模型: [${model}]\n检测供应商: [${provider}]\n原因建议检查网络连接情况。`);
    }
    throw error;
  }
};

export const parseScriptToStoryboard = async (scriptText: string, fileData?: { mimeType: string, data: string }): Promise<any[]> => {
  const model = appSettings.roles.scriptAnalysis || 'gemini-3-flash';
  const provider = getProviderForModel(model);

  const systemInstruction = `You are a visionary Film Director and Director of Photography (DoP). Your task is to transform a script into a high-fidelity, production-ready storyboard breakdown with EXTREME granularity and CINEMATIC precision.

STRUCTURE DIRECTIVES (CRITICAL):
For each shot, the description and action should follow this specific textual pattern for maximum clarity:
- SHOT TYPE: Use square brackets at the start, e.g., "[中景]", "[特写]".
- CHARACTER DETAILS: When a character appears, include their name followed by visual details in parentheses, e.g., "秦始皇 (乌黑长发披肩，俊秀面孔)".
- LIGHTING & VIBE: Use the prefix "[光影]" for lighting and atmosphere descriptions.

JSON SCHEMA (Output a JSON ARRAY):
[{
  "shotNumber": "编号 (e.g., Sc01-01)",
  "shotType": "镜头类型 (e.g., 中景, 特写, 全景)",
  "description": "场景环境描述 (简体中文). e.g., '奢华幽暗的南宋皇宫寝殿，巨大的龙纹雕花床。'",
  "action": "动作描写 (简体中文). MUST include character details in parentheses, e.g., '秦始皇 (乌黑长发披肩) 坐在床上。'",
  "lighting": "光影效果 (简体中文). e.g., '烛光摇曳，戏剧性阴影，压抑孤寂的氛围。'",
  "cameraAngle": "角度 (e.g., 平视, 俯视)",
  "movement": "运镜 (e.g., 固定, 推, 拉)",
  "location": "场景地点名",
  "characters": "人物名 (多个用逗号隔开)",
  "dialogue": "台词",
  "sfx": "音效",
  "duration": 4,
  "audioDescription": "BGM/氛围语描述",
  "aiPrompt": "Cinematic English prompt. Combine EVERYTHING: [Shot Type], [Camera Angle], [Location Description], [Character Visuals + Action], [Lighting/Vibe]. Use descriptive, artistic English."
}]

EXECUTION:
1. POV & SUBJECTIVE: If POV, set cameraAngle to "主观视角(POV)".
2. GRANULARITY: Every distinct movement or significant beat must be its own shot.
3. ATOMIC DIALOGUE: One speaker per shot.
4. VISUAL RICHNESS: Be specific about textures, colors, and lighting.`;

  const parts: any[] = [];

  if (fileData) {
    parts.push({ text: "--- DETACHED DOCUMENT START ---" });
    parts.push({ inlineData: fileData });
    parts.push({ text: "--- DETACHED DOCUMENT END ---" });
    parts.push({ text: "The above attachment is the source script. Extract its content now." });
  }

  if (scriptText.trim()) {
    parts.push({ text: `RAW TEXT INPUT:\n${scriptText}` });
  }

  if (parts.length === 0) return [];

  try {
    const result = await callUniversalAI(model, provider, {
      systemInstruction,
      contents: { parts: parts },
      jsonMode: true,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ]
    });

    let content = result.text || "[]";
    console.log("Elite Parser [v2.0] Response:", content);

    // Try direct parse first (since we requested application/json)
    try {
      const directParsed = JSON.parse(content);
      return Array.isArray(directParsed) ? directParsed : [];
    } catch (e) {
      // Fallback: Use Regex if AI added conversational text despite json-mode
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const innerParsed = JSON.parse(jsonMatch[0]);
          return Array.isArray(innerParsed) ? innerParsed : [];
        } catch (innerE) {
          console.error("Inner Parsing Failed:", jsonMatch[0]);
          throw new Error("AI 返回了非标准格式的数据，无法解析分镜表。");
        }
      }
      throw new Error("AI 响应中未包含有效的分镜 JSON 数组。");
    }
  } catch (error: any) {
    console.error("Critical Board-Parse Failure:", error);
    if (error.message?.includes("provider")) {
      throw new Error(`供应商错误: 模型 [${model}] 不支持当前的分析任务，请在设置中更换。`);
    }
    throw error;
  }
};