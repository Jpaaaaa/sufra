import React from 'react';
import ReactDOM from 'react-dom/client';
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import './i18n';
import App from './App';
import './globals.css';
import { applyStoredUiScale } from './lib/uiScale';

applyStoredUiScale();

// Enable HTML5 drag-and-drop on touch devices (tablets, all-in-one screens)
polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
});
// iOS Safari: allow non-passive touchmove for polyfill
if (typeof window !== 'undefined') {
  window.addEventListener('touchmove', () => {}, { passive: false });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

