/**
 * EmotionBlender - 情感混合控制器
 * 
 * 控制 TTS 生成的情感参数
 */

import React from 'react';
import { Smile } from 'lucide-react';
import { EmotionVectors } from './types';

interface EmotionBlenderProps {
    /** 情感权重 */
    emoWeight: number;
    /** 情感权重变更回调 */
    onEmoWeightChange: (weight: number) => void;
    /** 情感向量 */
    emotionVectors: EmotionVectors;
    /** 情感向量变更回调 */
    onEmotionChange: (key: keyof EmotionVectors, value: number) => void;
}

const EMOTION_LABELS: Record<keyof EmotionVectors, string> = {
    happy: '开心',
    angry: '愤怒',
    sad: '悲伤',
    fear: '恐惧',
    disgust: '厌恶',
    depressed: '抑郁',
    surprise: '惊讶',
    calm: '平静'
};

const EmotionBlender: React.FC<EmotionBlenderProps> = React.memo(({
    emoWeight,
    onEmoWeightChange,
    emotionVectors,
    onEmotionChange
}) => {
    return (
        <div className="col-span-12 lg:col-span-5 flex flex-col">
            <div className="flex items-center border-b border-zinc-900 pb-3">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Smile size={16} className="text-emerald-400" /> 情感维度修饰 (Emotion Blend)
                </h3>
            </div>
            <div className="flex-1 mt-6 p-8 bg-zinc-900/40 rounded-[40px] border border-zinc-800/40 flex flex-col justify-between">
                <div className="space-y-6">
                    {/* Intensity Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 tracking-tighter">
                            <span>混合灵敏度 (Intensity)</span>
                            <span className="text-cine-accent">{emoWeight.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={emoWeight}
                            onChange={(e) => onEmoWeightChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-zinc-950 rounded-full appearance-none accent-cine-accent cursor-pointer"
                        />
                    </div>

                    {/* Emotion Vectors Grid */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        {(Object.entries(emotionVectors) as [keyof EmotionVectors, number][]).map(([key, val]) => (
                            <div key={key} className="space-y-2 grayscale hover:grayscale-0 transition-all">
                                <div className="flex justify-between text-[9px] font-black uppercase text-zinc-600 tracking-widest">
                                    <span>{EMOTION_LABELS[key] || key}</span>
                                    <span>{val}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={val}
                                    onChange={(e) => onEmotionChange(key, parseFloat(e.target.value))}
                                    className="w-full h-0.5 bg-zinc-800 rounded-full appearance-none accent-zinc-500 cursor-pointer"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});

EmotionBlender.displayName = 'EmotionBlender';

export default EmotionBlender;
