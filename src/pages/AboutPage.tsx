import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatBytes, formatDateTime, formatNumber, percent } from '../lib/format';
import { withBase } from '../lib/paths';
import { LogoPlate } from '../components/LogoImage';
import { resolvePlate } from '../lib/plate';

const PALETTE = [
  { name: 'Navy ink', hex: '#0B1A26', use: '主文字、主按钮' },
  { name: 'Paper', hex: '#F1F3F5', use: '页面背景' },
  { name: 'Deep teal', hex: '#0C6B5B', use: '强调色、链接、焦点' },
  { name: 'Slate', hex: '#5B6C7A', use: '次要文字' },
  { name: 'Hairline', hex: '#E2E7EC', use: '边框与分隔线' },
  { name: 'Night', hex: '#090E13', use: '深色模式背景' },
];

export function AboutPage() {
  const { dataset, assets, lang, preferences } = useApp();
  const [sample, setSample] = useState(0);
  const meta = dataset?.meta;
  const zh = lang === 'zh';

  const previews = useMemo(() => assets.filter((asset) => asset.collection === 'logos' && asset.variant === 'plain').slice(0, 6), [assets]);
  const current = previews[sample % Math.max(1, previews.length)];
  const plate = resolvePlate(current, 'auto', preferences.theme);

  return (
    <>
      <header className="page-head">
        <div className="shell">
          <span className="label" style={{ color: 'var(--accent)' }}>
            {zh ? '关于 Bancora' : 'About Bancora'}
          </span>
          <h1 className="page-head__title">{zh ? '一个独立工具，服务一份开放的素材合集。' : 'An independent toolkit for a shared open collection.'}</h1>
          <p className="page-head__lede">
            {zh
              ? 'Bancora 把 MIT 许可的 icongo/bank-logos 合集变成可用的素材工作流：搜索、预览、批量导出、位图转换和结构检查，无需账号，也没有服务端。'
              : 'Bancora turns the MIT-licensed icongo/bank-logos collection into a working asset workflow: search, preview, bulk export, raster conversion and structural checks — no account, no server.'}
          </p>
        </div>
      </header>

      <div className="shell stack" style={{ gap: 40 }}>
        <section className="about-hero">
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: 10 }}>Every Bank. Every Logo. One Toolkit.</h2>
            <p style={{ color: 'var(--muted-strong)', lineHeight: 1.8, marginBottom: 14 }}>
              {zh
                ? '金融团队反复重建同一个小工具：找到银行标识、确认文件可用、导出合适尺寸、接入项目。Bancora 把这些步骤合成一个静态站点。素材保持上游原样，工具只增加结构、元数据和可靠的导出路。'
                : 'Fintech teams keep rebuilding the same small utility: find a bank mark, check the file, export it at the right size, ship it. Bancora consolidates that into one static site. The assets stay exactly as published upstream; the toolkit adds structure, metadata and a reliable export path.'}
            </p>
            <ul style={{ color: 'var(--muted-strong)', lineHeight: 1.9, paddingLeft: 20, fontSize: '0.90625rem' }}>
              <li>{zh ? '无需注册，不做追踪，本地文件不上传。' : 'No account, no tracking, no uploads.'}</li>
              <li>{zh ? '页面上的每个统计数字都来自真实索引。' : 'Every statistic comes from the shipped index.'}</li>
              <li>{zh ? '未知的元数据保持未知，不编造。' : 'Unknown metadata stays unknown.'}</li>
            </ul>
          </div>
          <div className="brand-plate">
            <img src={withBase('/brand/bancora-logo.svg')} alt="Bancora wordmark" />
          </div>
        </section>

        {meta ? (
          <section>
            <h2 style={{ fontSize: '1.375rem', marginBottom: 14 }}>{zh ? '合集数据' : 'The collection in numbers'}</h2>
            <div className="grid-4">
              <div className="metric">
                <div className="metric__value">{formatNumber(meta.counts.total)}</div>
                <div className="metric__label">{zh ? '已收录 SVG' : 'Indexed SVG files'}</div>
              </div>
              <div className="metric">
                <div className="metric__value">{formatNumber(meta.counts.documentedNames)}</div>
                <div className="metric__label">
                  {zh ? '有文档的名称' : 'Documented names'} ({percent(meta.counts.documentedNames, meta.counts.total)})
                </div>
              </div>
              <div className="metric">
                <div className="metric__value">{formatBytes(meta.counts.totalBytes)}</div>
                <div className="metric__label">{zh ? '原始文件总大小' : 'Total source size'}</div>
              </div>
              <div className="metric">
                <div className="metric__value">{meta.quality.pass}</div>
                <div className="metric__label">{zh ? '通过结构检查' : 'Passing structural checks'}</div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>
              {zh ? '索引生成于' : 'Index generated'} {formatDateTime(meta.generatedAt)} · logos/ {meta.counts.byCollection.logos ?? 0} · other/{' '}
              {meta.counts.byCollection.other ?? 0}
            </p>
          </section>
        ) : null}

        <section>
          <h2 style={{ fontSize: '1.375rem', marginBottom: 10 }}>{zh ? '品牌体系' : 'Brand system'}</h2>
          <p style={{ color: 'var(--muted-strong)', maxWidth: '68ch', lineHeight: 1.8, marginBottom: 16 }}>
            {zh
              ? 'Bancora 的视觉刻意保持安静：冷白纸面、深海军墨色，单一深青强调色。衬线标题只用于建立编辑感，界面其余部分保持工具应有的克制。Logo 底板会自动匹配素材本身的颜色，让银行标识始终是页面上最醒目的元素。'
              : 'Bancora’s identity is deliberately quiet: cool paper, navy ink and a single deep-teal accent. The serif is reserved for editorial headings; everything else stays tool-like. Logo plates adapt to each mark’s own colours so the bank artwork remains the loudest element on the page.'}
          </p>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="swatches">
              {PALETTE.map((swatch) => (
                <div className="swatch" key={swatch.hex}>
                  <div className="swatch__chip" style={{ background: swatch.hex }} />
                  <div className="swatch__meta">
                    <div className="swatch__name">{swatch.name}</div>
                    <div className="swatch__hex">{swatch.hex}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.65625rem', marginTop: 2 }}>{swatch.use}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="stack stack--sm">
              <div className="card-plain">
                <h3>{zh ? '品牌素材' : 'Logo assets'}</h3>
                <p>{zh ? '原始 SVG 标识、横向字标，以及 1200×630 分享图。' : 'Original SVG mark, horizontal lockup and a 1200×630 social image.'}</p>
                <div className="row" style={{ marginTop: 10 }}>
                  <a className="btn btn--sm" href={withBase('/brand/bancora-mark.svg')} download>
                    {zh ? '图标' : 'Mark'}
                  </a>
                  <a className="btn btn--sm" href={withBase('/brand/bancora-logo.svg')} download>
                    {zh ? '字标' : 'Wordmark'}
                  </a>
                  <a className="btn btn--sm" href={withBase('/brand/og-bancora.png')} download>
                    {zh ? '分享图' : 'Social image'}
                  </a>
                </div>
              </div>
              {current ? (
                <div className="card-plain">
                  <div className="section-label">{zh ? '真实素材预览' : 'Real asset preview'}</div>
                  <div className="plate" data-plate={plate} style={{ height: 130 }}>
                    <LogoPlate asset={current} plate={plate} alt={`${current.name} preview`} />
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: '0.8125rem' }}>{current.name}</span>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSample((value) => value + 1)}>
                      {zh ? '下一个' : 'Next'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid-2">
          <div className="card-plain">
            <h3>{zh ? '数据来源' : 'Data sources'}</h3>
            <p>
              {zh
                ? '所有图形和中文名称来自 github.com/icongo/bank-logos；组件名与已发布的 @icongo/bl 包交叉核对。国家、类别、SWIFT/BIC 和商标授权上游并未发布，因此数据集中不包含这些字段。'
                : 'All artwork and documented names come from github.com/icongo/bank-logos; component names are cross-checked with the published @icongo/bl package. Country, category, SWIFT/BIC and trademark permission are not published upstream and are therefore absent.'}
            </p>
          </div>
          <div className="card-plain">
            <h3>{zh ? '「暂定名」是什么意思' : 'What “tentative” means'}</h3>
            <p>
              {zh
                ? 'other/ 中的文件只有中文文件名，上游 README 没有说明。Bancora 从文件名推导展示名称并标注为暂定名——它只是图形的标签，不代表已确认的机构身份。'
                : 'Files in other/ are only named in Chinese and are not described upstream. Bancora derives a display name from the file name and flags it as tentative; it labels the artwork, not a confirmed institution.'}
            </p>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.375rem', marginBottom: 12 }}>{zh ? '许可与免责声明' : 'Licence & disclaimer'}</h2>
          <div className="stack stack--sm">
            <div className="callout">
              <div>
                <strong>{zh ? 'MIT 许可。' : 'MIT licence.'}</strong>{' '}
                {zh ? '仓库代码与 SVG 文件以 MIT 许可发布，Copyright © 2022 IconGo。全文见 ' : 'Code and SVG files are MIT licensed, © 2022 IconGo. Full text: '}
                <a href={withBase('/LICENSE.txt')}>LICENSE.txt</a>。
              </div>
            </div>
            <div className="callout callout--warn">
              <div>
                <strong>{zh ? '商标另计。' : 'Trademarks are separate.'}</strong>{' '}
                {zh
                  ? '所有银行 Logo 与商标归各自权利人所有。Bancora 是独立的素材工具站，与所列机构无隶属、赞助或背书关系。商业使用前请核实来源与适用条款。通过结构检查不等于获得商标使用许可。'
                  : 'Bank logos and trademarks remain the property of their respective owners. Bancora is an independent resource toolkit and is not affiliated with or endorsed by the listed institutions. Verify sources and usage terms before commercial use. A passing check is not a licence to use a mark.'}
              </div>
            </div>
          </div>
        </section>

        <section className="grid-3">
          <div className="card-plain">
            <h3>{zh ? '技术栈' : 'Built on'}</h3>
            <p>React 18 · TypeScript · Vite · JSZip · Canvas API</p>
          </div>
          <div className="card-plain">
            <h3>{zh ? '隐私' : 'Privacy'}</h3>
            <p>{zh ? '无统计、无 Cookie、无服务端。收藏与偏好保存在 localStorage，上传文件不会离开当前标签页。' : 'No analytics, cookies or server. Favourites live in localStorage; uploads never leave the tab.'}</p>
          </div>
          <div className="card-plain">
            <h3>{zh ? '作者' : 'Author'}</h3>
            <p>
              <a href="https://x.com/0xkillcoin" target="_blank" rel="noreferrer noopener">
                𝕏 @0xkillcoin
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
