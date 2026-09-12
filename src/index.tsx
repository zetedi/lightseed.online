
import './utils/polyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("%c .seed Network Active ", "background: #059669; color: #fff; border-radius: 4px; padding: 4px; font-weight: bold;");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// CACHES THIS SHELL HAS OUTGROWN (ring 2026-09-12). A runtime cache is never touched by the
// precache sweep, so a named one we retire sits on the reader's disk until they clear it by
// hand. map-tiles v1 admitted opaque responses and served them as tiles for thirty days; the
// new cache has a new name, and the old one goes back to the reader here. One line, every
// surface, once per load — deleting a cache that is already gone is free.
const RETIRED_CACHES = ['map-tiles'];
try { RETIRED_CACHES.forEach(name => caches?.delete?.(name)?.catch?.(() => {})); } catch { /* no cache storage here */ }

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
