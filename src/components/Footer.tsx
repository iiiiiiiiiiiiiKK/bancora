import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { withBase } from '../lib/paths';
import { DownloadIcon } from './Icons';
import { AUTHOR_URL, PROJECT_REPO, UPSTREAM_REPO } from '../lib/links';

/**
 * Footer layout:
 *  - desktop: brand block + three link columns
 *  - phone: brand block, then one compact wrapped link list (no tall column stack),
 *    then the legal text. The full three-column sitemap is only shown from 720px up.
 */
export function Footer() {
  const { t, lang } = useApp();
  const zh = lang === 'zh';

  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__top">
          <div className="footer__brand">
            <Link to="/" className="brand" aria-label={zh ? 'Bancora 首页' : 'Bancora home'}>
              <img className="brand__mark" src={withBase('/brand/bancora-mark.svg')} alt="" width={28} height={28} />
              <span className="brand__text">
                <span className="brand__name">Bancora</span>
                <span className="brand__tag">Open Bank Asset Toolkit</span>
              </span>
            </Link>
            <p>
              {zh
                ? 'Every Bank. Every Logo. One Toolkit. 面向开发者的银行品牌素材工具，基于 MIT 许可的开源素材合集。'
                : 'Every Bank. Every Logo. One Toolkit. A developer-first workspace for bank brand assets, built on an open MIT-licensed collection.'}
            </p>
          </div>

          <nav className="footer__links" aria-label={zh ? '页脚导航' : 'Footer navigation'}>
            <Link to="/">{t('nav.explore')}</Link>
            <Link to="/convert">{t('nav.convert')}</Link>
            <Link to="/inspector">{t('nav.inspector')}</Link>
            <Link to="/developer">{t('nav.developer')}</Link>
            <Link to="/about">{t('nav.about')}</Link>
            <a href={withBase('/data/assets.json')} download>
              <DownloadIcon width={12} height={12} />
              JSON
            </a>
            <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener">
              𝕏
            </a>
            <a href={PROJECT_REPO} target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
          </nav>

          <div className="footer__cols">
            <div className="footer__col">
              <h4>{zh ? '工具' : 'Toolkit'}</h4>
              <ul>
                <li>
                  <Link to="/">{t('nav.explore')}</Link>
                </li>
                <li>
                  <Link to="/convert">{t('nav.convert')}</Link>
                </li>
                <li>
                  <Link to="/inspector">{t('nav.inspector')}</Link>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h4>{zh ? '开发' : 'Developers'}</h4>
              <ul>
                <li>
                  <Link to="/developer">{t('nav.developer')}</Link>
                </li>
                <li>
                  <a href={withBase('/data/assets.json')} download>
                    {zh ? '素材索引 JSON' : 'Asset index (JSON)'}
                  </a>
                </li>
                <li>
                  <a href={withBase('/data/audit.json')} download>
                    {zh ? '审计报告 JSON' : 'Audit report (JSON)'}
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h4>{zh ? '项目' : 'Project'}</h4>
              <ul>
                <li>
                  <Link to="/about">{t('nav.about')}</Link>
                </li>
                <li>
                  <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener">
                    {zh ? '作者 𝕏 @0xkillcoin' : 'Author 𝕏 @0xkillcoin'}
                  </a>
                </li>
                <li>
                  <a href={PROJECT_REPO} target="_blank" rel="noreferrer noopener">
                    {zh ? '开源仓库' : 'Source repository'}
                  </a>
                  <a href={UPSTREAM_REPO} target="_blank" rel="noreferrer noopener">
                    {zh ? '上游素材库' : 'Upstream collection'}
                  </a>
                </li>
                <li>
                  <a href="https://www.npmjs.com/package/@icongo/bl" target="_blank" rel="noreferrer noopener">
                    @icongo/bl
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer__legal">
          <p>
            {zh
              ? '所有银行 Logo 与商标归各自权利人所有。Bancora 是独立的素材工具站，与所收录机构无隶属、赞助或背书关系。商业使用前请自行核实素材来源与适用条款。'
              : 'Bank logos and trademarks remain the property of their respective owners. Bancora is an independent resource toolkit and is not affiliated with or endorsed by the listed institutions. Please verify asset sources and applicable usage terms before commercial use.'}
          </p>
          <div className="footer__meta">
            <span>MIT · © 2022 IconGo · Bancora © 2026</span>
            <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener">
              𝕏 @0xkillcoin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
