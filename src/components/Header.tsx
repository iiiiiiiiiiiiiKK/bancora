import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { GithubIcon, MenuIcon, MoonIcon, StarIcon, SunIcon, XIcon } from './Icons';
import { withBase } from '../lib/paths';

const AUTHOR_URL = 'https://x.com/0xkillcoin';

const LINKS = [
  { to: '/', labelKey: 'nav.explore', end: true },
  { to: '/convert', labelKey: 'nav.convert' },
  { to: '/inspector', labelKey: 'nav.inspector' },
  { to: '/developer', labelKey: 'nav.developer' },
  { to: '/about', labelKey: 'nav.about' },
] as const;

export function Header() {
  const { preferences, toggleTheme, toggleLang, favorites, t, lang } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header className="header">
      <div className="shell header__inner">
        <Link to="/" className="brand" aria-label={lang === 'zh' ? 'Bancora 首页' : 'Bancora home'}>
          <img className="brand__mark" src={withBase('/brand/bancora-mark.svg')} alt="" width={28} height={28} />
          <span className="brand__text">
            <span className="brand__name">Bancora</span>
            <span className="brand__tag">Open Bank Asset Toolkit</span>
          </span>
        </Link>

        <nav className="nav" aria-label={lang === 'zh' ? '主导航' : 'Primary'}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={'end' in link ? link.end : false}
              className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="header__actions">
          <Link to="/?favorites=1" className="icon-btn basket-btn" aria-label={`${t('nav.favorites')}: ${favorites.favorites.length}`}>
            <StarIcon filled={favorites.favorites.length > 0} />
            {favorites.favorites.length > 0 ? (
              <span className="count-badge" aria-hidden>
                {favorites.favorites.length > 99 ? '99+' : favorites.favorites.length}
              </span>
            ) : null}
          </Link>

          <a
            className="icon-btn x-link"
            href={AUTHOR_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t('nav.author')}
            title="@0xkillcoin on X"
          >
            <span aria-hidden>𝕏</span>
          </a>

          <button
            type="button"
            className="icon-btn"
            onClick={toggleLang}
            aria-label={t('nav.lang')}
            title={lang === 'zh' ? 'English' : '中文'}
          >
            <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
              {lang === 'zh' ? 'EN' : '中'}
            </span>
          </button>

          <a
            className="icon-btn header__github"
            href="https://github.com/icongo/bank-logos"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={lang === 'zh' ? '上游素材仓库（新窗口打开）' : 'Upstream repository on GitHub (opens in a new tab)'}
            title={lang === 'zh' ? '上游素材仓库' : 'Upstream repository'}
          >
            <GithubIcon />
          </a>

          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={preferences.theme === 'dark' ? t('nav.theme.toLight') : t('nav.theme.toDark')}
            title={preferences.theme === 'dark' ? t('nav.theme.toLight') : t('nav.theme.toDark')}
          >
            {preferences.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            type="button"
            className="icon-btn menu-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {menuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <div className="mobile-nav" id="mobile-navigation" data-open={menuOpen}>
        <div className="shell mobile-nav__inner">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={'end' in link ? link.end : false}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {t(link.labelKey)}
              <span aria-hidden>→</span>
            </NavLink>
          ))}
          <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener">
            {lang === 'zh' ? '作者 𝕏' : 'Author on 𝕏'}
            <span aria-hidden>↗</span>
          </a>
          <a href="https://github.com/icongo/bank-logos" target="_blank" rel="noreferrer noopener">
            GitHub
            <span aria-hidden>↗</span>
          </a>
          <button type="button" className="mobile-nav__toggle" onClick={toggleLang}>
            {lang === 'zh' ? '语言 / English' : 'Language / 中文'}
            <span aria-hidden>⇄</span>
          </button>
          <p className="mobile-nav__meta">
            {lang === 'zh'
              ? `本机已收藏 ${favorites.favorites.length} 个素材。`
              : `${favorites.favorites.length} favourite${favorites.favorites.length === 1 ? '' : 's'} saved on this device.`}
          </p>
        </div>
      </div>
    </header>
  );
}
