import { useApp } from '../context/AppContext';

/** Hero statistics, computed from the loaded index — never hard-coded. */
export function StatsBar() {
  const { dataset, assets, t } = useApp();

  const total = dataset?.meta.counts.total ?? assets.length;
  const svgCount = dataset?.meta.counts.byFormat.svg ?? assets.length;
  const documented = dataset?.meta.counts.documentedNames ?? assets.filter((a) => a.nameStatus === 'documented').length;
  const formatter = new Intl.NumberFormat('en-US');

  const items = [
    { value: total ? formatter.format(total) : '—', label: t('hero.stat.total') },
    { value: svgCount ? formatter.format(svgCount) : '—', label: t('hero.stat.svg') },
    { value: '3', label: t('hero.stat.formats') },
    { value: total ? formatter.format(documented) : '—', label: t('hero.stat.named') },
  ];

  return (
    <div className="hero__stats" aria-label={t('hero.stat.total')}>
      {items.map((item) => (
        <div key={item.label} className="stat">
          <div className="stat__value">{item.value}</div>
          <div className="stat__label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
