import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

// GitHub Pages cannot rewrite unknown paths, so project builds run with a hash
// router. Everything else is served by a host with an SPA fallback (Cloudflare
// Pages, Vercel, Netlify, nginx) and uses clean paths.
const base = import.meta.env.BASE_URL;
const useHashRouter = import.meta.env.VITE_ROUTER === 'hash';
const basename = useHashRouter ? undefined : base.replace(/\/$/, '') || undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useHashRouter ? (
      <HashRouter>
        <App />
      </HashRouter>
    ) : (
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
);
