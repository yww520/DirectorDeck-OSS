import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { translateText } from '../services/geminiService';

interface TranslateButtonProps {
    text: string;
    onTranslate: (newText: string) => void;
    className?: string;
}

export const TranslateButton: React.FC<TranslateButtonProps> = ({ text, onTranslate, className }) => {
    const [isTranslating, setIsTranslating] = useState(false);

    const handleTranslate = async (lang: 'zh' | 'en') => {
        if (!text.trim() || isTranslating) return;
        setIsTranslating(true);
        try {
            const result = await translateText(text, lang);
            onTranslate(result);
        } catch (error) {
            console.error("Translation failed:", error);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <div className={`flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg overflow-hidden ${className}`}>
            <button
                onClick={(e) => { e.stopPropagation(); handleTranslate('zh'); }}
                disabled={isTranslating}
                className="px-3 py-1 text-[11px] font-bold text-zinc-400 hover:text-cine-accent hover:bg-white/5 transition-all border-r border-zinc-800 disabled:opacity-50"
                title="翻译成中文"
            >
                {isTranslating ? <Loader2 size={10} className="animate-spin" /> : "中"}
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); handleTranslate('en'); }}
                disabled={isTranslating}
                className="px-3 py-1 text-[11px] font-bold text-zinc-400 hover:text-cine-accent hover:bg-white/5 transition-all disabled:opacity-50"
                title="Translate to English"
            >
                {isTranslating ? <Loader2 size={10} className="animate-spin" /> : "英"}
            </button>
        </div>
    );
};
