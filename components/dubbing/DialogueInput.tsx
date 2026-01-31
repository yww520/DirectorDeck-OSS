/**
 * DialogueInput - 台词输入区
 * 
 * 文本输入和生成按钮
 */

import React from 'react';
import { MessageSquare, Trash2, Mic, RefreshCcw } from 'lucide-react';

interface DialogueInputProps {
    /** 台词文本 */
    text: string;
    /** 文本变更回调 */
    onTextChange: (text: string) => void;
    /** 生成回调 */
    onGenerate: () => void;
    /** 是否正在生成 */
    isGenerating: boolean;
}

const DialogueInput: React.FC<DialogueInputProps> = React.memo(({
    text,
    onTextChange,
    onGenerate,
    isGenerating
}) => {
    return (
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
                        onChange={(e) => onTextChange(e.target.value)}
                        placeholder="在这里输入需要生成的对白..."
                        className="w-full h-64 bg-[#080808] border border-zinc-800/80 rounded-[32px] p-8 text-xl font-serif font-light outline-none focus:border-cine-accent/40 transition-all resize-none shadow-2xl placeholder:opacity-20 leading-relaxed text-zinc-100"
                    />
                    <div className="absolute right-6 bottom-6 flex gap-3">
                        <button
                            onClick={() => onTextChange('')}
                            className="p-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-700 hover:text-rose-400 rounded-2xl transition-all border border-zinc-800/50"
                            title="清空台词"
                        >
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={onGenerate}
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
    );
});

DialogueInput.displayName = 'DialogueInput';

export default DialogueInput;
