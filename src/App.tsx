import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Toaster } from './components/Toaster';
import { ExplorerPage } from './pages/ExplorerPage';
import { ConvertPage } from './pages/ConvertPage';
import { InspectorPage } from './pages/InspectorPage';
import { DeveloperPage } from './pages/DeveloperPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

const TITLES: Record<string, { zh: string; en: string }> = {
  '/': { zh: 'Bancora — 开放银行 Logo 素材工具箱', en: 'Bancora — Open Bank Asset Toolkit' },
  '/convert': { zh: 'SVG 转 PNG / WebP — Bancora', en: 'Convert bank logos to PNG & WebP — Bancora' },
  '/inspector': { zh: '素材质量检查 — Bancora', en: 'Asset inspector — Bancora' },
  '/developer': { zh: '开发者文档 — Bancora', en: 'Developer documentation — Bancora' },
  '/about': { zh: '关于与许可 — Bancora', en: 'About, sources and licence — Bancora' },
};

function RouteEffects() {
  const location = useLocation();
  const { lang } = useApp();

  useEffect(() => {
    const titles = TITLES[location.pathname];
    document.title = titles ? (lang === 'zh' ? titles.zh : titles.en) : 'Bancora';
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, lang]);

  return null;
}

export function App() {
  return (
    <AppProvider>
      <RouteEffects />
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <Header />
      <main id="main" className="page">
        <Routes>
          <Route path="/" element={<ExplorerPage />} />
          <Route path="/convert" element={<ConvertPage />} />
          <Route path="/inspector" element={<InspectorPage />} />
          <Route path="/developer" element={<DeveloperPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/explore" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <Toaster />
    </AppProvider>
  );
}
