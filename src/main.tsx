import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// After a deploy, an already-open tab still points at the previous build's
// hashed chunk files (e.g. ThreeBackground-Ccb6pABC.js), which no longer exist,
// so the next lazy import fails and ErrorBoundary shows "Something went wrong".
// Vite fires `vite:preloadError` for exactly that failure — reload once to pick
// up the new build. The sessionStorage timestamp stops a genuinely broken chunk
// (or being offline) from causing a reload loop: a second failure within 10s is
// left to ErrorBoundary.
const CHUNK_RELOAD_KEY = 'gg_chunk_reload_at';
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return; // sessionStorage unavailable — can't guard against a loop, so don't reload
  }
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
