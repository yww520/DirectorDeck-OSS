/**
 * SessionRecoveryPrompt - 会话恢复提示组件
 * 
 * 当检测到可恢复的会话时显示恢复提示
 * 
 * @since 2026-01-13
 */

import React, { memo } from 'react';
import { History, X, RefreshCcw, Trash2 } from 'lucide-react';
import { SessionSnapshot, sessionRecovery } from '../services/sessionRecoveryService';

interface SessionRecoveryPromptProps {
    /** 可恢复的快照 */
    snapshot: SessionSnapshot;
    /** 恢复回调 */
    onRestore: (snapshot: SessionSnapshot) => void;
    /** 忽略回调 */
    onDismiss: () => void;
    /** 删除回调 */
    onDelete: () => void;
}

const SessionRecoveryPrompt: React.FC<SessionRecoveryPromptProps> = memo(({
    snapshot,
    onRestore,
    onDismiss,
    onDelete
}) => {
    const timeAgo = sessionRecovery.formatSnapshotTime(snapshot.timestamp);
    const summary = sessionRecovery.getSnapshotSummary(snapshot);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-6 fade-in duration-300">
            <div className="flex items-start gap-4 px-6 py-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl shadow-2xl max-w-lg">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-cine-accent/20 flex items-center justify-center flex-shrink-0">
                    <History size={24} className="text-cine-accent" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm mb-1">
                        发现未保存的工作
                    </h3>
                    <p className="text-xs text-zinc-400 mb-3">
                        {timeAgo} 的会话 · {summary}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onRestore(snapshot)}
                            className="flex items-center gap-2 px-4 py-2 bg-cine-accent text-black text-xs font-bold rounded-lg hover:bg-cine-accent/90 transition-colors"
                        >
                            <RefreshCcw size={14} />
                            恢复
                        </button>

                        <button
                            onClick={onDismiss}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                            忽略
                        </button>

                        <button
                            onClick={onDelete}
                            className="p-2 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors"
                            title="删除此备份"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Close */}
                <button
                    onClick={onDismiss}
                    className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
});

SessionRecoveryPrompt.displayName = 'SessionRecoveryPrompt';

export { SessionRecoveryPrompt };
export default SessionRecoveryPrompt;
