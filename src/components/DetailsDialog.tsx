import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Asset } from '../types/asset';
import { useDialog } from '../hooks/useDialog';
import { useApp } from '../context/AppContext';
import { assetAbsoluteUrl, assetUrl, assetJson, cssSnippet, githubSourceUrl, htmlSnippet, reactSnippet } from '../lib/paths';
import { fetchSvgText, downloadText } from '../lib/browser';
import { pushToast } from '../lib/toast';
import { formatBytes } from '../lib/format';
import { PLATE_OPTIONS, plateWasAdjusted, resolvePlate, type PlatePreference } from '../lib/plate';
import { LogoPlate } from './LogoImage';
import { CopyButton } from './CopyButton';
import {
  ArrowUpRightIcon,
  CheckIcon,
  CodeIcon,
  DownloadIcon,
  ExternalIcon,
  FileIcon,
  InfoIcon,
  PlusIcon,
  StarIcon,
  XIcon,
} from './Icons';

type Tab = 'html' | 'react' | 'css' | 'json';

const MAX_SOURCE_PREVIEW = 240_000;

export function DetailsDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const open = asset !== null;
  useDialog(open, onClose);
  const { preferences, favorites, selection, t, lang } = useApp();
  const [plate, setPlate] = useState<PlatePreference>(preferences.plate);
  const [tab, setTab] = useState<Tab>('html');
  const [source, setSource] = useState<{ text: string; bytes: number } | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setSource(null);
    setSourceError(null);
  }, [asset]);

  useEffect(() => {
    setPlate(preferences.plate);
  }, [asset, preferences.plate]);

  const snippets = useMemo(
    () =>
      asset
        ? { html: htmlSnippet(asset), react: reactSnippet(asset), css: cssSnippet(asset), json: assetJson(asset) }
        : null,
    [asset],
  );

  if (!asset || !snippets) return null;

  const current = asset;
  const favorite = favorites.isFavorite(asset.id);
  const selected = selection.has(asset.id);
  const resolved = resolvePlate(asset, plate, preferences.theme);
  const adjusted = plate === 'auto' && plateWasAdjusted(asset, preferences.theme);

  async function downloadOriginal() {
    setDownloading(true);
    try {
      const result = await fetchSvgText(assetUrl(current));
      downloadText(result.text, current.filename, 'image/svg+xml');
      pushToast('success', lang === 'zh' ? '已开始下载' : 'Download started', current.filename);
    } catch (error) {
      pushToast('error', lang === 'zh' ? '下载失败' : 'Download failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDownloading(false);
    }
  }

  async function loadSource(): Promise<string> {
    if (source) return source.text;
    try {
      const result = await fetchSvgText(assetUrl(current));
      setSource(result);
      return result.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSourceError(message);
      throw new Error(message);
    }
  }

  async function downloadSource() {
    try {
      const text = await loadSource();
      downloadText(text, `${current.filename.replace(/\.svg$/i, '')}.source.svg`, 'image/svg+xml');
      pushToast('success', `${t('detail.downloadSource')} ✓`);
    } catch (error) {
      pushToast('error', t('common.error'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return createPortal(
    <>
      <div className="dialog" role="presentation">
        <div className="overlay" onClick={onClose} aria-hidden />
        <div
          className="dialog__panel"
          id="bancora-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bancora-dialog-title"
          tabIndex={-1}
        >
          <div className="dialog__preview">
            <div className="dialog__stage">
              <LogoPlate asset={asset} plate={resolved} loading="eager" alt={`${asset.name} logo`} />
            </div>
            <div className="dialog__tools">
              <div className="segmented" role="group" aria-label={t('search.plate')}>
                {PLATE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={plate === option.value}
                    onClick={() => setPlate(option.value)}
                  >
                    {t(`search.plate.${option.value}` as const)}
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 5 }}>
                <button
                  type="button"
                  className="btn btn--sm"
                  aria-pressed={favorite}
                  onClick={() => favorites.toggle(asset.id)}
                >
                  <StarIcon filled={favorite} />
                  {favorite ? t('detail.favorited') : t('detail.favorite')}
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  aria-pressed={selected}
                  onClick={() => selection.toggle(asset.id)}
                >
                  {selected ? <CheckIcon /> : <PlusIcon />}
                  {selected ? t('detail.inBasket') : t('detail.basket')}
                </button>
              </div>
            </div>
            {adjusted ? (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  padding: '8px 12px',
                  borderTop: '1px solid var(--line)',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  lineHeight: 1.55,
                  background: 'var(--surface)',
                }}
              >
                <InfoIcon width={14} height={14} style={{ flex: 'none', marginTop: 1 }} />
                <span>
                  {lang === 'zh'
                    ? '已自动选用对比底板：该 Logo 本身颜色较深，深色主题下直接显示会看不清。原始文件没有被修改。'
                    : 'A contrasting plate was chosen automatically so this dark artwork stays visible in dark mode. The original file is untouched.'}
                </span>
              </div>
            ) : null}
          </div>

          <div className="dialog__details">
            <div className="dialog__head">
              <div style={{ minWidth: 0 }}>
                <h2 className="dialog__title" id="bancora-dialog-title">
                  {asset.name}
                </h2>
                <div className="dialog__sub">
                  <span className="chip">SVG</span>
                  <span className="chip">{formatBytes(asset.fileSize)}</span>
                  {asset.nameStatus === 'tentative' ? <span className="chip chip--warning">{t('card.tentative')}</span> : null}
                  {asset.quality.status !== 'pass' ? <span className="chip chip--danger">{asset.quality.status}</span> : null}
                </div>
              </div>
              <button type="button" className="dialog__close" onClick={onClose} aria-label={t('detail.close')}>
                <XIcon />
              </button>
            </div>

            <div className="dialog__body">
              <div className="action-grid">
                <button type="button" className="btn btn--primary" onClick={downloadOriginal} disabled={downloading}>
                  {downloading ? <span className="spinner" /> : <DownloadIcon />}
                  {downloading ? t('detail.downloading') : t('detail.download')}
                </button>
                <CopyButton value={() => Promise.resolve(assetAbsoluteUrl(current))} label={t('detail.copyUrl')} successMessage={t('common.copied')} />
                <CopyButton value={() => loadSource()} label={t('detail.copySource')} successMessage={t('common.copied')} />
                <button type="button" className="btn btn--sm" onClick={downloadSource}>
                  <FileIcon />
                  {t('detail.downloadSource')}
                </button>
              </div>

              {sourceError ? (
                <div className="alert alert--error" role="alert">
                  <span>{sourceError}</span>
                </div>
              ) : null}
              {source && source.bytes > MAX_SOURCE_PREVIEW ? (
                <div className="alert alert--warning">
                  <span>{t('detail.largeFile')}</span>
                </div>
              ) : null}

              <section>
                <div className="section-label">{t('detail.details')}</div>
                <dl className="spec">
                  <dt>{t('detail.id')}</dt>
                  <dd>{asset.id}</dd>
                  <dt>{t('detail.filename')}</dt>
                  <dd>{asset.filename}</dd>
                  <dt>{t('detail.url')}</dt>
                  <dd>
                    <a href={assetUrl(asset)} target="_blank" rel="noreferrer noopener">
                      {assetAbsoluteUrl(asset)}
                    </a>
                  </dd>
                  <dt>{t('detail.size')}</dt>
                  <dd>{formatBytes(asset.fileSize)}</dd>
                  <dt>{t('detail.viewBox')}</dt>
                  <dd>{asset.viewBox ?? '—'}</dd>
                  <dt>{t('detail.intrinsic')}</dt>
                  <dd>
                    {asset.width ?? '—'} × {asset.height ?? '—'}
                  </dd>
                  <dt>{t('detail.country')}</dt>
                  <dd>{asset.country ?? t('detail.unknown')}</dd>
                  <dt>{t('detail.category')}</dt>
                  <dd>{asset.category ?? t('detail.unknown')}</dd>
                  <dt>{t('detail.website')}</dt>
                  <dd>
                    {asset.website ? (
                      <a href={asset.website} target="_blank" rel="noreferrer noopener">
                        {asset.website}
                      </a>
                    ) : (
                      t('detail.notDocumented')
                    )}
                  </dd>
                  <dt>{t('detail.license')}</dt>
                  <dd>MIT · {t('detail.trademark')}</dd>
                  {asset.source.npmExport ? (
                    <>
                      <dt>{t('detail.npm')}</dt>
                      <dd>{asset.source.npmExport}</dd>
                    </>
                  ) : null}
                </dl>
              </section>

              <section>
                <div className="section-label">{t('detail.snippets')}</div>
                <div className="tabs" role="tablist" aria-label={t('detail.snippets')}>
                  {(
                    [
                      ['html', 'HTML'],
                      ['react', 'React'],
                      ['css', 'CSS'],
                      ['json', 'JSON'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      aria-controls={`panel-${key}`}
                      id={`tab-${key}`}
                      onClick={() => setTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ marginTop: 10 }}>
                  <div className="codeblock">
                    <div className="codeblock__head">
                      <span className="codeblock__lang">{tab === 'react' ? 'tsx' : tab}</span>
                      <CopyButton value={snippets[tab]} label={t('detail.copy')} successMessage={t('common.copied')} variant="ghost" />
                    </div>
                    <pre>
                      <code>{snippets[tab]}</code>
                    </pre>
                  </div>
                </div>
              </section>

              <section>
                <div className="section-label">{t('detail.source')}</div>
                <div className="stack stack--sm">
                  <p style={{ fontSize: '0.78125rem', color: 'var(--muted)', lineHeight: 1.7 }}>{t('detail.sourceNote')}</p>
                  <div className="row" style={{ gap: 6 }}>
                    <a className="btn btn--sm" href={githubSourceUrl(asset)} target="_blank" rel="noreferrer noopener">
                      <ExternalIcon />
                      {t('detail.github')}
                      <ArrowUpRightIcon width={13} height={13} />
                    </a>
                    <a
                      className="btn btn--sm"
                      href="https://github.com/icongo/bank-logos/blob/main/LICENSE"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <CodeIcon />
                      {t('detail.mit')}
                    </a>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
