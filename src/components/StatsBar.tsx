import { useApp } from '../context/AppContext';
import { formatBytes, formatNumber } from '../lib/format';

/**
 * Hero statistics.
 *
 * Layout: label (small caps) → value (serif, tabular) → caption. All three lines
 * line up across the four cells, so the strip reads as one table instead of four
 * unrelated numbers.
 *
 * Every figure is derived from the generated index — nothing is hard-coded — and
 * the four cells deliberately report four *different* facts (volume, shape,
 * naming, weight) instead of repeating the same count with different wording.
 */
export function StatsBar() {
  const { dataset, assets, t } = useApp();

  const counts = dataset?.meta.counts;
  const total = counts?.total ?? assets.length;
  const documented = counts?.documentedNames ?? assets.filter((a) => a.nameStatus === 'documented').length;
  const variants = counts?.byVariant ?? { plain: 0, rect: 0, badge: 0 };
  const bytes = counts?.totalBytes ?? assets.reduce((sum, a) => sum + a.fileSize, 0);

  const items = [
    {
      label: t('hero.stat.total'),
      value: total ? formatNumber(total) : '—',
      hint: t('hero.stat.totalHint'),
    },
    {
      label: t('hero.stat.variants'),
      value: t('hero.stat.variantsValue')
        .replace('{plain}', formatNumber(variants.plain ?? 0))
        .replace('{rect}', formatNumber(variants.rect ?? 0))
        .replace('{badge}', formatNumber(variants.badge ?? 0)),
      hint: t('hero.stat.variantsHint'),
    },
    {
      label: t('hero.stat.named'),
      value: documented ? formatNumber(documented) : '—',
      hint: t('hero.stat.namedHint').replace('{percent}', total ? `${((documented / total) * 100).toFixed(0)}%` : '—'),
    },
    {
      label: t('hero.stat.size'),
      value: bytes ? formatBytes(bytes) : '—',
      hint: t('hero.stat.sizeHint'),
    },
  ];

  return (
    <dl className="stats" aria-label={t('hero.stat.total')}>
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <dt className="stat__label">{item.label}</dt>
          <dd className="stat__value">{item.value}</dd>
          {item.hint ? <dd className="stat__hint">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
