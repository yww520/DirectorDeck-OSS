import React from 'react';
import { AlertTriangle, RefreshCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    componentName?: string;
    onError?: (error: Error, errorInfo: React.ErrorInfo, componentName?: string) => void;
    allowRetry?: boolean;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    showDetails: boolean;
}

/**
 * ErrorBoundary - 错误边界组件
 * 用于捕获子组件中的 JavaScript 错误，防止整个应用崩溃。
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state = {
        hasError: false,
        error: null as Error | null,
        errorInfo: null as React.ErrorInfo | null,
        showDetails: false,
    };

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error(
            `[ErrorBoundary] ${this.props.componentName || '组件'} 发生错误:`,
            error,
            errorInfo
        );
        this.setState({ errorInfo });
        if (this.props.onError) {
            this.props.onError(error, errorInfo, this.props.componentName);
        }
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
        });
    };

    toggleDetails = (): void => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 border border-red-500/30 rounded-xl m-2 min-h-[200px]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-red-400">
                                {this.props.componentName ? `${this.props.componentName}加载出错` : '组件加载出错'}
                            </h3>
                            <p className="text-sm text-zinc-500">请尝试刷新或联系开发者</p>
                        </div>
                    </div>

                    <div className="w-full max-w-md bg-zinc-950/50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-zinc-400 font-mono break-all">
                            {this.state.error?.message || '未知错误'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {this.props.allowRetry !== false && (
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                重试
                            </button>
                        )}

                        <button
                            onClick={this.toggleDetails}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                        >
                            {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {this.state.showDetails ? '隐藏详情' : '查看详情'}
                        </button>
                    </div>

                    {this.state.showDetails && this.state.errorInfo && (
                        <div className="w-full mt-4 p-3 bg-zinc-950 rounded-lg overflow-auto max-h-[200px]">
                            <pre className="text-xs text-zinc-500 font-mono whitespace-pre-wrap">
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

interface SimpleErrorBoundaryProps {
    children: React.ReactNode;
    fallbackText?: string;
}

interface SimpleErrorBoundaryState {
    hasError: boolean;
}

export class SimpleErrorBoundary extends React.Component<SimpleErrorBoundaryProps, SimpleErrorBoundaryState> {
    state = { hasError: false };

    static getDerivedStateFromError(): SimpleErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[SimpleErrorBoundary]', error, errorInfo);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="p-2 text-xs text-red-400 bg-red-950/30 rounded">
                    {this.props.fallbackText || '加载失败'}
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
