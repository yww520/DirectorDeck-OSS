/**
 * OfflineIndicator - 离线状态指示器
 * 
 * 监听网络状态，在断开连接时显示友好提示
 * 
 * @since 2026-01-13
 */

import React, { useState, useEffect, memo } from 'react';
import { WifiOff, Wifi, RefreshCcw } from 'lucide-react';

interface OfflineIndicatorProps {
    /** 是否显示重连按钮 */
    showRetryButton?: boolean;
    /** 自定义离线消息 */
    offlineMessage?: string;
    /** 重连回调 */
    onRetry?: () => void;
    /** 状态变化回调 */
    onStatusChange?: (isOnline: boolean) => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = memo(({
    showRetryButton = true,
    offlineMessage = '网络连接已断开',
    onRetry,
    onStatusChange
}) => {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [showReconnected, setShowReconnected] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            onStatusChange?.(true);

            // 如果之前离线过，显示已重连提示
            if (wasOffline) {
                setShowReconnected(true);
                setTimeout(() => setShowReconnected(false), 3000);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
            onStatusChange?.(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [onStatusChange, wasOffline]);

    const handleRetry = () => {
        // 尝试通过请求检测网络
        fetch('/favicon.ico', { cache: 'no-store' })
            .then(() => {
                setIsOnline(true);
                onStatusChange?.(true);
            })
            .catch(() => {
                // 仍然离线
            });
        onRetry?.();
    };

    // 在线且没有显示重连提示时不渲染
    if (isOnline && !showReconnected) {
        return null;
    }

    // 重连成功提示
    if (showReconnected) {
        return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                        <Wifi size={16} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-emerald-400">网络已恢复</p>
                        <p className="text-[10px] text-emerald-400/60">现在可以继续使用所有功能</p>
                    </div>
                </div>
            </div>
        );
    }

    // 离线提示
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-4 px-5 py-3 bg-rose-500/20 backdrop-blur-xl border border-rose-500/30 rounded-2xl shadow-2xl">
                <div className="w-10 h-10 rounded-full bg-rose-500/30 flex items-center justify-center animate-pulse">
                    <WifiOff size={20} className="text-rose-400" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-bold text-rose-400">{offlineMessage}</p>
                    <p className="text-[10px] text-rose-400/60">部分功能可能无法使用</p>
                </div>
                {showRetryButton && (
                    <button
                        onClick={handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/30 hover:bg-rose-500/50 text-rose-300 rounded-xl transition-colors text-xs font-bold"
                    >
                        <RefreshCcw size={14} />
                        重试
                    </button>
                )}
            </div>
        </div>
    );
});

OfflineIndicator.displayName = 'OfflineIndicator';

export { OfflineIndicator };
export default OfflineIndicator;
