import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useInspector, type InspectionEntry } from '../hooks/useInspector';
import { formatBytes } from '../lib/format';
import { triggerDownload } from '../lib/browser';
import { pushToast } from '../lib/toast';
import { AlertCircleIcon, AlertIcon, CheckIcon, FileIcon, InfoIcon, ShieldIcon, UploadIcon } from '../components/Icons';
import { LogoImage } from '../components/LogoImage';
import { resolvePlate } from '../lib/plate';
import type { Asset } from '../types/asset';

type Filter = 'all' | 'error' | 'warning' | 'pass';
type Mode = 'repository' | 'upload';

interface ReportRow {
  key: string;
  name: string;
  file: string;
  source: 'repository' | 'upload';
  status: 'pass' | 'warning' | 'error';
  bytes: number;
  sha256: string;
  signature: string | null;
  findings: { code: string; severity: string; message: string }[];
  asset?: Asset;
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

export function InspectorPage() {
  const { assets, loading, t, lang, preferences } = useApp();
  const inspector = useInspector();
  const [mode, setMode] = useState<Mode>('repository');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(606);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [ran, setRan] = useState(false);

  const rows = useMemo<ReportRow[]>(() => {
    const source: InspectionEntry[] = mode === 'repository' ? inspector.entries : inspector.uploads;
    return source.map((entry) => ({
      key: entry.key,
      name: entry.name,
      file: entry.asset?.relativePath ?? entry.name,
      source: entry.source,
      status: entry.analysis.status,
      bytes: entry.analysis.bytes,
      sha256: entry.sha256,
      signature: entry.signature,
      findings: [...entry.analysis.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
      asset: entry.asset,
    }));
  }, [mode, inspector.entries, inspector.uploads]);

  const duplicateGroups = useMemo(() => {
    const byHash = new Map<string, ReportRow[]>();
    for (const row of rows) {
      if (!row.sha256) continue;
      const list = byHash.get(row.sha256) ?? [];
      list.push(row);
      byHash.set(row.sha256, list);
    }
    const exact = [...byHash.values()].filter((group) => group.length > 1);

    const bySignature = new Map<string, ReportRow[]>();
    for (const row of rows) {
      if (!row.signature) continue;
      const list = bySignature.get(row.signature) ?? [];
      list.push(row);
      bySignature.set(row.signature, list);
    }
    const visual = [...bySignature.values()].filter((group) => group.length > 1 && !exact.some((e) => e[0].sha256 === group[0].sha256));

    const byName = new Map<string, ReportRow[]>();
    for (const row of rows) {
      const key = row.file.toLowerCase();
      const list = byName.get(key) ?? [];
      list.push(row);
      byName.set(key, list);
    }
    const conflicts = [...byName.values()].filter((group) => group.length > 1);

    return { exact, visual, conflicts };
  }, [rows]);

  const counts = useMemo(() => {
    const result = { pass: 0, warning: 0, error: 0 };
    for (const row of rows) result[row.status] += 1;
    return result;
  }, [rows]);

  const visibleRows = useMemo(() => (filter === 'all' ? rows : rows.filter((row) => row.status === filter)), [rows, filter]);

  async function runRepositoryScan() {
    if (assets.length === 0) return;
    await inspector.inspectRepository(assets, limit);
    setRan(true);
    pushToast('success', t('inspect.done'), `${Math.min(limit, assets.length)} ${t('common.assets')}`);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const svgs = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml');
    if (svgs.length === 0) {
      pushToast('error', lang === 'zh' ? '没有选择 SVG 文件' : 'No SVG files selected');
      return;
    }
    await inspector.inspectFiles(svgs);
    setMode('upload');
    setRan(true);
    pushToast('success', t('inspect.done'), `${svgs.length} ${lang === 'zh' ? '个文件' : 'files'}`);
  }

  function exportJson() {
    if (rows.length === 0) return;
    const report = {
      generatedAt: new Date().toISOString(),
      source: mode,
      summary: { total: rows.length, ...counts },
      files: rows.map((row) => ({
        file: row.file,
        name: row.name,
        source: row.source,
        status: row.status,
        bytes: row.bytes,
        sha256: row.sha256,
        findings: row.findings,
      })),
      duplicates: {
        exact: duplicateGroups.exact.map((group) => group.map((row) => row.file)),
        visual: duplicateGroups.visual.map((group) => group.map((row) => row.file)),
        filenameConflicts: duplicateGroups.conflicts.map((group) => group.map((row) => row.file)),
      },
    };
    triggerDownload(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), 'bancora-inspection.json');
    pushToast('success', 'JSON ✓');
  }

  function exportCsv() {
    if (rows.length === 0) return;
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = ['file,name,status,bytes,severity,code,message'];
    for (const row of rows) {
      if (row.findings.length === 0) {
        lines.push([escape(row.file), escape(row.name), row.status, String(row.bytes), '', '', ''].join(','));
      } else {
        for (const finding of row.findings) {
          lines.push(
            [escape(row.file), escape(row.name), row.status, String(row.bytes), finding.severity, finding.code, escape(finding.message)].join(','),
          );
        }
      }
    }
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'bancora-inspection.csv');
    pushToast('success', 'CSV ✓');
  }

  useEffect(() => {
    setSelected(null);
  }, [mode, filter]);

  return (
    <>
      <header className="page-head">
        <div className="shell">
          <span className="label" style={{ color: 'var(--accent)' }}>
            {t('inspect.eyebrow')}
          </span>
          <h1 className="page-head__title">{t('inspect.title')}</h1>
          <p className="page-head__lede">{t('inspect.lede')}</p>
        </div>
      </header>

      <div className="shell stack">
        <div className="panel">
          <div className="panel__head">
            <div className="row" style={{ gap: 5 }}>
              <button type="button" className="chip chip--button" aria-pressed={mode === 'repository'} onClick={() => setMode('repository')}>
                {t('inspect.repo')}
              </button>
              <button type="button" className="chip chip--button" aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>
                {t('inspect.uploads')} ({inspector.uploads.length})
              </button>
            </div>
            <div className="row" style={{ gap: 5 }}>
              <button type="button" className="btn btn--sm" onClick={exportJson} disabled={rows.length === 0}>
                <FileIcon />
                {t('inspect.json')}
              </button>
              <button type="button" className="btn btn--sm" onClick={exportCsv} disabled={rows.length === 0}>
                <FileIcon />
                {t('inspect.csv')}
              </button>
            </div>
          </div>
          <div className="panel__body stack">
            {mode === 'repository' ? (
              <>
                <div className="row">
                  <div className="field" style={{ width: 170 }}>
                    <label htmlFor="limit">{t('inspect.limit')}</label>
                    <select id="limit" className="select" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                      <option value={50}>50</option>
                      <option value={150}>150</option>
                      <option value={606}>{lang === 'zh' ? '全部 606 个' : 'All 606'}</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => void runRepositoryScan()}
                    disabled={loading || inspector.running || assets.length === 0}
                  >
                    {inspector.running ? <span className="spinner" /> : <ShieldIcon />}
                    {inspector.running ? `${t('inspect.running')} ${inspector.progress.done}/${inspector.progress.total}` : t('inspect.run')}
                  </button>
                  {ran ? (
                    <p className="muted" style={{ fontSize: '0.75rem', alignSelf: 'center' }}>
                      {lang === 'zh' ? '在浏览器内完成，无需服务器。' : 'Checked in your browser — no server round trips.'}
                    </p>
                  ) : null}
                </div>
                {inspector.running ? (
                  <div className="progress-bar" aria-label={t('inspect.running')}>
                    <div
                      className="progress-bar__fill"
                      style={{ width: `${inspector.progress.total ? (inspector.progress.done / inspector.progress.total) * 100 : 0}%` }}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <label
                className="dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleFiles(event.dataTransfer.files);
                }}
              >
                <div className="dropzone__icon">
                  <UploadIcon />
                </div>
                <strong>{t('inspect.drop')}</strong>
                <span>{t('inspect.dropHint')}</span>
                <input type="file" accept=".svg,image/svg+xml" multiple hidden onChange={(event) => void handleFiles(event.target.files)} />
                <span className="btn btn--sm" style={{ marginTop: 4 }}>
                  {t('inspect.browse')}
                </span>
              </label>
            )}
          </div>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="grid-4">
              <div className="metric">
                <div className="metric__value">{rows.length}</div>
                <div className="metric__label">{t('inspect.checked')}</div>
              </div>
              <div className="metric metric--ok">
                <div className="metric__value">{counts.pass}</div>
                <div className="metric__label">{t('inspect.pass')}</div>
              </div>
              <div className="metric metric--warn">
                <div className="metric__value">{counts.warning}</div>
                <div className="metric__label">{t('inspect.warning')}</div>
              </div>
              <div className="metric metric--bad">
                <div className="metric__value">{counts.error}</div>
                <div className="metric__label">{t('inspect.error')}</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">
                <div className="row" style={{ gap: 4 }}>
                  {(['all', 'error', 'warning', 'pass'] as const).map((value) => (
                    <button key={value} type="button" className="chip chip--button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                      {value === 'all' ? t('inspect.all') : value === 'pass' ? t('inspect.passed') : value === 'error' ? t('inspect.errors') : t('inspect.warnings')}
                      <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{value === 'all' ? rows.length : counts[value]}</span>
                    </button>
                  ))}
                </div>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  {t('inspect.showing')} {visibleRows.length}
                </span>
              </div>

              {duplicateGroups.exact.length + duplicateGroups.visual.length + duplicateGroups.conflicts.length > 0 ? (
                <div style={{ borderBottom: '1px solid var(--line)', padding: '14px 14px 0' }}>
                  <div className="section-label">{t('inspect.dupes')}</div>
                  <div className="stack stack--sm" style={{ paddingBottom: 14 }}>
                    {duplicateGroups.exact.length > 0 ? (
                      <div className="alert alert--warning" role="note">
                        <div>
                          <strong>
                            {duplicateGroups.exact.length} {t('inspect.identical')}
                          </strong>
                          <div style={{ marginTop: 3, fontSize: '0.75rem', wordBreak: 'break-word' }}>
                            {duplicateGroups.exact.map((group) => group.map((row) => row.file).join(' = ')).join(' · ')}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {duplicateGroups.visual.length > 0 ? (
                      <div className="alert alert--info" role="note">
                        <div>
                          <strong>
                            {duplicateGroups.visual.length} {t('inspect.visual')}
                          </strong>
                          <div style={{ marginTop: 3, fontSize: '0.75rem', wordBreak: 'break-word' }}>
                            {duplicateGroups.visual.map((group) => group.map((row) => row.file).join(' ≈ ')).join(' · ')}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {duplicateGroups.conflicts.length > 0 ? (
                      <div className="alert alert--error" role="note">
                        <div>
                          <strong>
                            {duplicateGroups.conflicts.length} {t('inspect.conflict')}
                          </strong>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 78 }}>{t('inspect.status')}</th>
                      <th>{t('inspect.file')}</th>
                      <th style={{ width: 80 }}>{t('inspect.size')}</th>
                      <th style={{ width: 130 }}>{t('inspect.findings')}</th>
                      <th style={{ width: 72 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <StatusChip status={row.status} label={row.status === 'pass' ? t('inspect.pass') : row.status === 'warning' ? t('inspect.warning') : t('inspect.error')} />
                        </td>
                        <td>
                          <div className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                            <span className="thumb">
                              {row.asset ? (
                                <LogoImage asset={row.asset} plate={resolvePlate(row.asset, 'auto', preferences.theme)} alt="" />
                              ) : (
                                <FileIcon width={13} height={13} />
                              )}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span className="table__file" style={{ display: 'block' }}>
                                {row.file}
                              </span>
                              <span style={{ fontSize: '0.65625rem', color: 'var(--muted)' }}>{row.name}</span>
                            </span>
                          </div>
                        </td>
                        <td className="mono">{formatBytes(row.bytes)}</td>
                        <td>
                          {row.findings.length === 0 ? (
                            <span className="muted">—</span>
                          ) : (
                            <span style={{ fontSize: '0.71875rem' }}>{row.findings.map((f) => f.code).join(', ')}</span>
                          )}
                        </td>
                        <td>
                          {row.findings.length > 0 ? (
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(row)}>
                              {t('inspect.details')}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="callout callout--warn">
              <div>
                <strong>{lang === 'zh' ? '只检查结构，不判断身份。' : 'Checks structure, not identity.'}</strong> {t('inspect.note')}
              </div>
            </div>
          </>
        ) : (
          <div className="empty">
            <div className="empty__icon">
              <ShieldIcon />
            </div>
            <h3>{t('inspect.empty')}</h3>
            <p>{t('inspect.emptyHint')}</p>
          </div>
        )}
      </div>

      {selected ? (
        <div className="dialog" style={{ pointerEvents: 'auto' }} role="dialog" aria-modal="true" aria-label={selected.file}>
          <div className="overlay" onClick={() => setSelected(null)} />
          <div className="dialog__panel" style={{ gridTemplateColumns: '1fr', maxWidth: 600 }}>
            <div className="dialog__head">
              <div style={{ minWidth: 0 }}>
                <h2 className="dialog__title" style={{ fontSize: '1.0625rem' }}>
                  {selected.name}
                </h2>
                <div className="dialog__sub">
                  <span className="mono" style={{ fontSize: '0.71875rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                    {selected.file}
                  </span>
                </div>
              </div>
              <button type="button" className="dialog__close" onClick={() => setSelected(null)} aria-label={t('inspect.close')}>
                ×
              </button>
            </div>
            <div className="dialog__body">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.findings.map((finding, index) => (
                  <li key={`${finding.code}-${index}`} className="card-plain" style={{ padding: 11 }}>
                    <div className="row" style={{ gap: 7, marginBottom: 4 }}>
                      <SeverityChip severity={finding.severity} />
                      <span className="mono" style={{ fontSize: '0.71875rem' }}>
                        {finding.code}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78125rem', color: 'var(--muted-strong)', margin: 0, lineHeight: 1.6 }}>{finding.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatusChip({ status, label }: { status: 'pass' | 'warning' | 'error'; label: string }) {
  if (status === 'pass')
    return (
      <span className="chip chip--accent">
        <CheckIcon width={11} height={11} /> {label}
      </span>
    );
  if (status === 'warning')
    return (
      <span className="chip chip--warning">
        <AlertIcon width={11} height={11} /> {label}
      </span>
    );
  return (
    <span className="chip chip--danger">
      <AlertCircleIcon width={11} height={11} /> {label}
    </span>
  );
}

function SeverityChip({ severity }: { severity: string }) {
  if (severity === 'error')
    return (
      <span className="chip chip--danger">
        <AlertCircleIcon width={11} height={11} /> Error
      </span>
    );
  if (severity === 'warning')
    return (
      <span className="chip chip--warning">
        <AlertIcon width={11} height={11} /> Warning
      </span>
    );
  return (
    <span className="chip">
      <InfoIcon width={11} height={11} /> Info
    </span>
  );
}
