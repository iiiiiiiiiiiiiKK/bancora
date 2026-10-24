import { useApp } from '../context/AppContext';

/**
 * Hero statistics.
 *
 * Layout: label (small caps) → value (serif, tabular) → caption. All three lines
 * line up across the four cells, so the strip reads as one table instead of four
 * unrelated numbers. Values are computed from the loaded index — never hard-coded.
 */
export function StatsBar() {
  const { dataset, assets, t } = useApp();

  const total = dataset?.meta.counts.total ?? assets.length;
  const svgCount = dataset?.meta.counts.byFormat.svg ?? assets.length;
  const documented = dataset?.meta.counts.documentedNames ?? assets.filter((a) => a.nameStatus === 'documented').length;
  const formatter = new Intl.NumberFormat('en-US');

  const items = [
    { label: t('hero.stat.total'), value: total ? formatter.format(total) : '—', hint: t('hero.stat.totalHint') },
    { label: t('hero.stat.svg'), value: svgCount ? formatter.format(svgCount) : '—', hint: t('hero.stat.svgHint') },
    { label: t('hero.stat.formats'), value: '3', hint: t('hero.stat.formatsHint') },
    { label: t('hero.stat.named'), value: total ? formatter.format(documented) : '—', hint: t('hero.stat.namedHint') },
  ];

  return (
    <dl className="stats" aria-label={t('hero.stat.total')}>
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <dt className="stat__label">{item.label}</dt>
          <dd className="stat__value">{item.value}</dd>
          <dd className="stat__hint">{item.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
