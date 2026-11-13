import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LogoImage } from '../components/LogoImage';
import {
  convertSvg,
  convertBatchToZip,
  clampDimension,
  clampDimensions,
  svgIntrinsicSize,
  MAX_DIMENSION,
  MIN_DIMENSION,
  type OutputFormat,
} from '../lib/convert';
import { assetUrl } from '../lib/paths';
import { fetchSvgText, triggerDownload } from '../lib/browser';
import { pushToast } from '../lib/toast';
import { formatBytes } from '../lib/format';
import { resolvePlate } from '../lib/plate';
import { MAX_SOURCE_BATCH_BYTES, MAX_SOURCE_FILE_BYTES, MAX_SOURCE_FILES } from '../lib/resource-limits';
import { DownloadIcon, UploadIcon, XIcon, ImageIcon, ConvertIcon, CheckIcon } from '../components/Icons';

type Source = {
  key: string;
  label: string;
  sublabel: string;
  text: string;
  bytes: number;
  assetId?: string;
  origin: 'library' | 'upload';
  thumbnail?: string;
  intrinsic: { width: number; height: number };
};


export function ConvertPage() {
  const { assets, loading, t, lang, preferences } = useApp();
  const [sources, setSources] = useState<Source[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [linked, setLinked] = useState(true);
  const [format, setFormat] = useState<OutputFormat>('png');
  const [background, setBackground] = useState<'transparent' | 'custom'>('transparent');
  const [color, setColor] = useState('#ffffff');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; width: number; height: number; bytes: number; format: OutputFormat } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchWorking, setBatchWorking] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchCancelled, setBatchCancelled] = useState(false);
  const batchAbortRef = useRef<AbortController | null>(null);
  const batchRunRef = useRef(0);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    batchRunRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
  }, []);

  const active = sources.find((source) => source.key === activeKey) ?? null;
  const outputDimensions = clampDimensions(width, height);
  const selectedPixels = width * height > 16_777_216;

  const pickerResults = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    if (!query) return assets.filter((asset) => asset.variant !== 'badge').slice(0, 60);
    const scored = assets
      .map((asset) => {
        const name = asset.name.toLowerCase();
        const file = asset.filename.toLowerCase();
        const id = asset.id.toLowerCase();
        let score = -1;
        if (file.startsWith(query) || id.startsWith(query)) score = 0;
        else if (name.startsWith(query)) score = 1;
        else if (file.includes(query) || id.includes(query)) score = 2;
        else if (name.includes(query)) score = 3;
        return { asset, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.asset.filename.localeCompare(b.asset.filename));
    return scored.slice(0, 60).map((entry) => entry.asset);
  }, [assets, pickerQuery]);

  useEffect(() => {
    if (!active) {
      setPreviewUrl(null);
      setResult(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    setResult(null);
    convertSvg(active.text, {
      width: outputDimensions.width,
      height: outputDimensions.height,
      format,
      background: background === 'transparent' ? 'transparent' : color,
      signal: controller.signal,
    })
      .then((converted) => {
        if (cancelled) return;
        setPreviewUrl(converted.dataUrl);
        setResult(converted);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewUrl(null);
        setResult(null);
        setError(err instanceof Error ? err.message : 'Conversion failed.');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, outputDimensions.width, outputDimensions.height, format, background, color]);

  async function addFromLibrary(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    if (sources.some((source) => source.key === asset.id)) {
      setActiveKey(asset.id);
      setPickerOpen(false);
      return;
    }
    try {
      const loaded = await fetchSvgText(assetUrl(asset));
      setSources((current) => [
        ...current,
        {
          key: asset.id,
          label: asset.name,
          sublabel: asset.filename,
          text: loaded.text,
          bytes: loaded.bytes,
          assetId: asset.id,
          origin: 'library',
          thumbnail: assetUrl(asset),
          intrinsic: { width: asset.width ?? 1024, height: asset.height ?? 1024 },
        },
      ]);
      setActiveKey(asset.id);
      setPickerOpen(false);
    } catch (err) {
      pushToast('error', lang === 'zh' ? '无法载入该素材' : 'Could not load that logo', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function addFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length > MAX_SOURCE_FILES) {
      pushToast('error', lang === 'zh' ? `单次最多选择 ${MAX_SOURCE_FILES} 个文件` : `Select at most ${MAX_SOURCE_FILES} files at a time`);
    }
    const list = selected.slice(0, MAX_SOURCE_FILES);
    const added: Source[] = [];
    const existingBytes = sources.reduce((sum, source) => sum + source.bytes, 0);
    for (const [index, file] of list.entries()) {
      if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
        pushToast('error', lang === 'zh' ? `${file.name} 不是 SVG` : `${file.name} is not an SVG`);
        continue;
      }
      if (file.size > MAX_SOURCE_FILE_BYTES) {
        pushToast('error', lang === 'zh' ? `${file.name} 超出大小限制` : `${file.name} is too large`, formatBytes(MAX_SOURCE_FILE_BYTES));
        continue;
      }
      if (sources.length + added.length >= MAX_SOURCE_FILES) {
        pushToast('error', lang === 'zh' ? `素材总数最多为 ${MAX_SOURCE_FILES} 个` : `At most ${MAX_SOURCE_FILES} sources can be loaded`);
        break;
      }
      if (existingBytes + added.reduce((sum, source) => sum + source.bytes, 0) + file.size > MAX_SOURCE_BATCH_BYTES) {
        pushToast('error', lang === 'zh' ? '本批次文件合计超过 32 MiB 限制，后续文件已跳过' : 'The 32 MiB batch limit was reached; remaining files were skipped');
        break;
      }
      const text = await file.text();
      if (!/<svg[\s>]/i.test(text)) {
        pushToast('error', lang === 'zh' ? `${file.name} 不是 SVG 文档` : `${file.name} is not an SVG document`);
        continue;
      }
      const key = `upload:${file.name}:${file.size}:${index}`;
      added.push({
        key,
        label: file.name.replace(/\.svg$/i, ''),
        sublabel: `${formatBytes(file.size)} · ${lang === 'zh' ? '本地文件' : 'local file'}`,
        text,
        bytes: file.size,
        origin: 'upload',
        intrinsic: svgIntrinsicSize(text),
      });
    }
    if (added.length === 0) return;
    setSources((current) => [...current, ...added]);
    setActiveKey(added[0].key);
    pushToast('success', lang === 'zh' ? `已载入 ${added.length} 个 SVG` : `${added.length} SVGs loaded`);
  }

  function updateWidth(value: number) {
    const next = clampDimension(value);
    setWidth(next);
    if (linked && active) {
      setHeight(clampDimension(Math.round((next * active.intrinsic.height) / active.intrinsic.width)));
    }
  }

  async function downloadSingle() {
    if (!active || !result) return;
    const base = active.origin === 'library' && active.assetId ? active.assetId.split('/').pop() : active.label.replace(/\s+/g, '-');
    triggerDownload(result.blob, `${base}-${result.width}x${result.height}.${result.format}`);
    pushToast('success', lang === 'zh' ? '转换完成' : 'Conversion downloaded', `${result.width}×${result.height} ${result.format.toUpperCase()}`);
  }

  async function downloadBatch() {
    if (sources.length === 0 || batchWorking) return;
    setBatchWorking(true);
    setBatchError(null);
    setBatchCancelled(false);
    setBatchProgress({ done: 0, total: sources.length });
    const runId = ++batchRunRef.current;
    const controller = new AbortController();
    batchAbortRef.current = controller;
    try {
      const zip = await convertBatchToZip(
        sources.map((source) => ({ id: source.key.replace(/^upload:/, ''), name: source.label, source: source.text })),
        { width, height, format, background: background === 'transparent' ? 'transparent' : color, signal: controller.signal },
        (done, total) => {
          if (runId === batchRunRef.current) setBatchProgress({ done, total });
        },
      );
      if (controller.signal.aborted || runId !== batchRunRef.current) return;
      triggerDownload(zip.blob, zip.filename);
      pushToast('success', lang === 'zh' ? `已转换 ${zip.count} 个素材` : `Converted ${zip.count} logos`, formatBytes(zip.blob.size));
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        if (runId === batchRunRef.current) setBatchCancelled(true);
      } else if (runId === batchRunRef.current) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setBatchError(message);
        pushToast('error', lang === 'zh' ? '批量转换失败' : 'Batch conversion failed', message);
      }
    } finally {
      if (runId === batchRunRef.current) {
        setBatchWorking(false);
        batchAbortRef.current = null;
      }
    }
  }

  function removeSource(key: string) {
    setSources((current) => current.filter((source) => source.key !== key));
    if (activeKey === key) {
      const next = sources.find((source) => source.key !== key);
      setActiveKey(next?.key ?? null);
    }
  }

  const previewStyle = background === 'transparent' ? undefined : { background: color };

  return (
    <>
      <header className="page-head">
        <div className="shell">
          <span className="label" style={{ color: 'var(--accent)' }}>
            {t('convert.eyebrow')}
          </span>
          <h1 className="page-head__title">{t('convert.title')}</h1>
          <p className="page-head__lede">{t('convert.lede')}</p>
        </div>
      </header>

      <div className="shell">
        <div className="convert-grid">
          <div className="stack">
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">{t('convert.step1')}</h2>
                <span className="chip">
                  {sources.length} {t('convert.loaded')}
                </span>
              </div>
              <div className="panel__body stack">
                <div
                  className="dropzone"
                  data-active={dragging}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void addFiles(event.dataTransfer.files);
                  }}
                >
                  <div className="dropzone__icon">
                    <UploadIcon />
                  </div>
                  <strong>{t('convert.drop')}</strong>
                  <span>{t('convert.dropHint')}</span>
                  <div className="row" style={{ marginTop: 6, justifyContent: 'center' }}>
                    <button type="button" className="btn btn--sm" onClick={() => fileInput.current?.click()}>
                      {t('convert.browse')}
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPickerOpen(true)}>
                      <ImageIcon />
                      {t('convert.fromLibrary')}
                    </button>
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".svg,image/svg+xml"
                    multiple
                    hidden
                    onChange={(event) => {
                      if (event.target.files) void addFiles(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </div>

                {sources.length > 0 ? (
                  <div className="source-list">
                    {sources.map((source) => (
                      <div
                        key={source.key}
                        className="source-item"
                        data-selected={source.key === activeKey}
                        onClick={() => setActiveKey(source.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setActiveKey(source.key);
                          }
                        }}
                      >
                        <div className="source-item__thumb">
                          {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <ImageIcon width={16} height={16} />}
                        </div>
                        <div className="source-item__body">
                          <div className="source-item__name">{source.label}</div>
                          <div className="source-item__meta">{source.sublabel}</div>
                        </div>
                        <button
                          type="button"
                          className="card__action"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeSource(source.key);
                          }}
                          aria-label={`${t('convert.remove')}: ${source.label}`}
                        >
                          <XIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">{t('convert.step2')}</h2>
                <span className="chip">{format.toUpperCase()}</span>
              </div>
              <div className="panel__body">
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="out-format">{t('convert.format')}</label>
                    <select id="out-format" className="select" value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}>
                      <option value="png">PNG — 无损 / 透明</option>
                      <option value="webp">WebP — 更小 / 透明</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="bg-mode">{t('convert.background')}</label>
                    <select
                      id="bg-mode"
                      className="select"
                      value={background}
                      onChange={(event) => setBackground(event.target.value as 'transparent' | 'custom')}
                    >
                      <option value="transparent">{t('convert.transparent')}</option>
                      <option value="custom">{t('convert.solid')}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="out-width">{t('convert.width')}</label>
                    <input
                      id="out-width"
                      className="input"
                      type="number"
                      min={MIN_DIMENSION}
                      max={MAX_DIMENSION}
                      value={width}
                      onChange={(event) => updateWidth(Number(event.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="out-height">{t('convert.height')}</label>
                    <input
                      id="out-height"
                      className="input"
                      type="number"
                      min={MIN_DIMENSION}
                      max={MAX_DIMENSION}
                      value={height}
                      onChange={(event) => {
                        const next = clampDimension(Number(event.target.value));
                        setHeight(next);
                        if (linked && active) {
                          setWidth(clampDimension(Math.round((next * active.intrinsic.width) / active.intrinsic.height)));
                        }
                      }}
                    />
                  </div>
                  {background === 'custom' ? (
                    <div className="field">
                      <label htmlFor="out-color">{t('convert.color')}</label>
                      <div className="row" style={{ gap: 8 }}>
                        <input
                          id="out-color"
                          type="color"
                          value={color}
                          onChange={(event) => setColor(event.target.value)}
                          style={{
                            width: 42,
                            height: 38,
                            padding: 3,
                            border: '1px solid var(--line-strong)',
                            borderRadius: 6,
                            background: 'var(--surface-raised)',
                            flex: 'none',
                          }}
                        />
                        <input className="input" value={color} onChange={(event) => setColor(event.target.value)} aria-label={t('convert.color')} />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={linked}
                      onChange={(event) => {
                        setLinked(event.target.checked);
                        if (event.target.checked && active) {
                          setHeight(clampDimension(Math.round((width * active.intrinsic.height) / active.intrinsic.width)));
                        }
                      }}
                    />
                    {t('convert.lock')}
                  </label>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8, lineHeight: 1.7 }}>{t('convert.notes')}</p>
                {selectedPixels ? <div className="callout" role="note">{lang === 'zh' ? `输出面积上限为 16,777,216 像素，实际尺寸为 ${outputDimensions.width} × ${outputDimensions.height}。` : `Output is capped at 16,777,216 pixels; actual size is ${outputDimensions.width} × ${outputDimensions.height}.`}</div> : null}
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">{t('convert.step3')}</h2>
                {result ? <span className="chip chip--accent">{formatBytes(result.bytes)}</span> : null}
              </div>
              <div className="panel__body stack">
                <div className={`preview-stage${background === 'transparent' ? ' checker' : ''}`} style={previewStyle}>
                  {previewUrl ? (
                    <img src={previewUrl} alt={active ? `${active.label} preview` : 'preview'} />
                  ) : active ? (
                    <div className="muted" style={{ fontSize: '0.8125rem' }}>
                      {error ? t('common.error') : t('common.loading')}
                    </div>
                  ) : (
                    <div className="empty" style={{ border: 0, background: 'transparent', padding: 20 }}>
                      <div className="empty__icon">
                        <ConvertIcon />
                      </div>
                      <h3>{t('convert.noSource')}</h3>
                      <p>{t('convert.noSourceHint')}</p>
                    </div>
                  )}
                </div>

                {batchError ? <div className="alert alert--error" role="alert">{batchError}</div> : null}
                {batchCancelled ? <div className="callout" role="status">{lang === 'zh' ? '批量转换已取消。' : 'Batch conversion cancelled.'}</div> : null}
                {error ? (
                  <div className="alert alert--error" role="alert">
                    <XIcon />
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="stack stack--sm">
                  <button type="button" className="btn btn--primary btn--block" disabled={!result} onClick={downloadSingle}>
                    <DownloadIcon />
                    {t('convert.download')} {format.toUpperCase()}
                  </button>
                  <button type="button" className="btn btn--block" disabled={sources.length === 0 || batchWorking} onClick={downloadBatch}>
                    {batchWorking ? <span className="spinner" /> : <DownloadIcon />}
                    {batchWorking ? `${t('convert.converting')} ${batchProgress.done}/${batchProgress.total}` : `${t('convert.convertAll')} (${sources.length})`}
                  </button>
                  {batchWorking ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => batchAbortRef.current?.abort()}>{lang === 'zh' ? '取消转换' : 'Cancel conversion'}</button> : null}
                  {result ? (
                    <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
                      <span className="mono">
                        {result.width} × {result.height} px
                      </span>
                      <span className="mono">
                        {result.format.toUpperCase()} · {formatBytes(result.bytes)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="callout">
                  <div>
                    <strong>{t('convert.local')}</strong> {t('convert.localNote')}
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">{t('convert.outNotes')}</h2>
              </div>
              <div className="panel__body stack stack--sm">
                <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.75 }}>{t('convert.outNote')}</p>
                <Link className="btn btn--sm" to="/developer">
                  {t('nav.developer')}
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <div className="dialog" role="dialog" aria-modal="true" aria-label={t('convert.picker')} style={{ pointerEvents: 'auto' }}>
          <div className="overlay" onClick={() => setPickerOpen(false)} />
          <div className="dialog__panel" style={{ gridTemplateColumns: '1fr', maxWidth: 680 }}>
            <div className="dialog__head">
              <div>
                <h2 className="dialog__title">{t('convert.picker')}</h2>
                <div className="dialog__sub">
                  <span className="muted" style={{ fontSize: '0.78125rem' }}>
                    {loading ? t('convert.loading') : `${assets.length} ${t('convert.available')}`}
                  </span>
                </div>
              </div>
              <button type="button" className="dialog__close" onClick={() => setPickerOpen(false)} aria-label={t('convert.close')}>
                <XIcon />
              </button>
            </div>
            <div className="dialog__body">
              <input
                className="input"
                placeholder={t('convert.pickerFilter')}
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                aria-label={t('convert.pickerFilter')}
              />
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                <div className="source-list">
                  {pickerResults.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="source-item"
                      onClick={() => void addFromLibrary(asset.id)}
                      style={{ border: '1px solid var(--line)', cursor: 'pointer' }}
                    >
                      <div className="source-item__thumb">
                        <LogoImage asset={asset} plate={resolvePlate(asset, 'auto', preferences.theme)} alt="" />
                      </div>
                      <div className="source-item__body">
                        <div className="source-item__name">{asset.name}</div>
                        <div className="source-item__meta">
                          {asset.filename} · {formatBytes(asset.fileSize)}
                        </div>
                      </div>
                      {sources.some((source) => source.key === asset.id) ? <CheckIcon width={15} height={15} /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
