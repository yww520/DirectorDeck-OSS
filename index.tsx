import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clearAllStores } from './stores';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Emergency backdoor
(window as any).clearAllStores = clearAllStores;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary componentName="DirectorDeck 全局入口">
    <App />
  </ErrorBoundary>
);