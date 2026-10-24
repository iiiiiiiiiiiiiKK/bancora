import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Asset } from '../types/asset';
import { useDialog } from '../hooks/useDialog';
import { useApp } from '../context/AppContext';
import { buildAssetsZip } from '../lib/zip';
import { triggerDownload } from '../lib/browser';
import { pushToast } from '../lib/toast';
import { formatBytes } from '../lib/format';
import { resolvePlate } from '../lib/plate';
import { ArchiveIcon, DownloadIcon, TrashIcon, XIcon } from './Icons';
import { LogoPlate } from './LogoImage';

interface ExportBasketProps {
  assets: Asset[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  open: boolean;
}

/** Batch download centre: review the basket, see per-file progress, export a ZIP. */
export function ExportBasket({ assets, onRemove, onClear, onClose, open }: ExportBasketProps) {
  useDialog(open, onClose);
  const { t, lang, preferences } = useApp();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      setProgress({ done: 0, total: 0, label: '' });
    }
  }, [open]);

  if (!open) return null;

  const totalBytes = assets.reduce((sum, asset) => sum + asset.fileSize, 0);
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  async function startExport() {
    if (assets.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await buildAssetsZip(assets, {
        signal: controller.signal,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      });
      triggerDownload(result.blob, result.filename);
      pushToast(
        'success',
        lang === 'zh' ? `已打包 ${result.files} 个素材` : `Export ready: ${result.files} logos`,
        `${result.filename} · ${formatBytes(result.bytes)}`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        pushToast('info', lang === 'zh' ? '已取消导出' : 'Export cancelled');
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        pushToast('error', lang === 'zh' ? '打包失败' : 'ZIP export failed', message);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return createPortal(
    <div className="dialog" role="presentation">
      <div className="overlay" onClick={onClose} aria-hidden />
      <div className="dialog__panel" id="bancora-dialog" role="dialog" aria-modal="true" aria-labelledby="basket-title" tabIndex={-1}>
        <div className="dialog__preview" style={{ padding: 'var(--s5)' }}>
          <h2 id="basket-title" style={{ fontSize: '1.25rem', marginBottom: 6 }}>
            {t('basket.title')}
          </h2>
          <p style={{ fontSize: '0.84375rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            {assets.length === 0
              ? t('basket.none')
              : `${assets.length} ${t('basket.summary')} · ${formatBytes(totalBytes)}`}
          </p>

          <div className="stack" style={{ marginTop: 20 }}>
            <div>
              <div className="section-label">{t('basket.structure')}</div>
              <pre
                className="mono"
                style={{
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  margin: 0,
                  overflowX: 'auto',
                  color: 'var(--muted-strong)',
                  fontSize: '0.75rem',
                  lineHeight: 1.7,
                }}
              >{`bancora-export/
  logos/          SVG 原始文件
  manifest.json   每个文件的元数据
  README.txt      格式、来源、许可`}</pre>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.7 }}>{t('basket.local')}</p>
          </div>
        </div>

        <div className="dialog__details">
          <div className="dialog__head">
            <div className="section-label" style={{ marginBottom: 0 }}>
              {t('basket.selected')}
            </div>
            <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
              {assets.length > 0 ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onClear} disabled={busy}>
                  <TrashIcon />
                  {t('basket.clear')}
                </button>
              ) : null}
              <button type="button" className="dialog__close" onClick={onClose} aria-label={t('basket.close')} style={{ marginLeft: 0 }}>
                <XIcon />
              </button>
            </div>
          </div>

          <div className="dialog__body">
            {assets.length === 0 ? (
              <div className="empty" style={{ padding: '32px 16px' }}>
                <div className="empty__icon">
                  <ArchiveIcon />
                </div>
                <h3>{t('basket.empty')}</h3>
                <p>{t('basket.emptyHint')}</p>
                <button type="button" className="btn btn--sm" onClick={onClose}>
                  {t('basket.back')}
                </button>
              </div>
            ) : (
              <div className="source-list" style={{ maxHeight: 320 }}>
                {assets.map((asset) => (
                  <div className="source-item" key={asset.id}>
                    <div className="source-item__thumb">
                      <LogoPlate asset={asset} plate={resolvePlate(asset, 'auto', preferences.theme)} alt="" />
                    </div>
                    <div className="source-item__body">
                      <div className="source-item__name">{asset.name}</div>
                      <div className="source-item__meta">
                        {asset.filename} · {formatBytes(asset.fileSize)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="card__action"
                      onClick={() => onRemove(asset.id)}
                      aria-label={`${t('basket.remove')}: ${asset.name}`}
                      disabled={busy}
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error ? (
              <div className="alert alert--error" role="alert">
                <span>{error}</span>
              </div>
            ) : null}

            {busy ? (
              <div className="stack stack--sm" aria-live="polite">
                <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.78125rem' }}>
                  <span>
                    {t('basket.building')} {progress.label}
                  </span>
                  <span className="mono">{percent}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
                </div>
              </div>
            ) : null}

            <div className="stack stack--sm">
              <button type="button" className="btn btn--primary btn--block" disabled={assets.length === 0 || busy} onClick={startExport}>
                {busy ? <span className="spinner" /> : <DownloadIcon />}
                {busy ? t('basket.building') : `${t('basket.download')} (${assets.length})`}
              </button>
              {busy ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => abortRef.current?.abort()}>
                  {t('basket.cancel')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
