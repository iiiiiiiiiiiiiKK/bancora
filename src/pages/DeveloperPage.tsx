import { useApp } from '../context/AppContext';
import { formatBytes, formatDateTime, formatNumber } from '../lib/format';
import { withBase } from '../lib/paths';
import { CopyButton } from '../components/CopyButton';

const SECTIONS = [
  { id: 'overview', label: '概览' },
  { id: 'structure', label: '目录结构' },
  { id: 'schema', label: '数据字段' },
  { id: 'usage', label: 'HTML / React' },
  { id: 'json', label: 'JSON 导出' },
  { id: 'urls', label: '资源地址' },
  { id: 'npm', label: '@icongo/bl' },
  { id: 'local', label: '本地运行' },
  { id: 'contributing', label: '贡献素材' },
  { id: 'conversion', label: '转换说明' },
  { id: 'licence', label: '许可与商标' },
];

export function DeveloperPage() {
  const { dataset, assets, lang } = useApp();
  const meta = dataset?.meta;
  const example = assets.find((asset) => asset.id === 'logos/abchina-rect') ?? assets[0];
  const url = example ? withBase(example.publicPath) : '/logos/example.svg';

  const snippet = example
    ? {
        html: `<img
  src="${url}"
  alt="${example.name}"
  width="240"
  height="240"
  loading="lazy"
  decoding="async"
/>`,
        react: `import type { ImgHTMLAttributes } from "react";

// 把 SVG 复制到你的 public/ 目录；下面是本站的地址。
const src = "${url}";

export function BankBadge(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={src}
      alt="${example.name}"
      width={240}
      height={240}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}`,
      }
    : { html: '', react: '' };

  const zh = lang === 'zh';

  return (
    <>
      <header className="page-head">
        <div className="shell">
          <span className="label" style={{ color: 'var(--accent)' }}>
            {zh ? '开发者文档' : 'Developer documentation'}
          </span>
          <h1 className="page-head__title">{zh ? '几分钟内接入 Bancora 素材。' : 'Integrate Bancora assets in minutes.'}</h1>
          <p className="page-head__lede">
            {zh
              ? '静态、MIT 许可的 SVG 集合，附带自动生成的 JSON 索引。无需密钥、无需注册、无构建期依赖。下面所有地址都会自动适配部署路径。'
              : 'A static, MIT-licensed SVG collection with a generated JSON index. No key, no account, no build-time dependency. Every URL below resolves against this deployment.'}
          </p>
        </div>
      </header>

      <div className="shell docs">
        <nav className="docs__nav" aria-label={zh ? '文档目录' : 'Documentation sections'}>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="docs__body">
          <section id="overview" className="doc-section">
            <h2>{zh ? '概览' : 'Overview'}</h2>
            <p>
              {zh ? (
                <>
                  Bancora 是 <a href="https://github.com/icongo/bank-logos">icongo/bank-logos</a>{' '}
                  合集的可浏览前端。该合集以 MIT 许可发布 SVG 银行标识；本站增加了搜索、批量导出、位图转换和结构检查，全部在浏览器内完成。
                </>
              ) : (
                <>
                  Bancora is a browsable front end for the <a href="https://github.com/icongo/bank-logos">icongo/bank-logos</a> collection: a
                  set of SVG bank marks published under the MIT licence. The site adds search, bulk export, raster conversion and structural
                  inspection entirely in the browser.
                </>
              )}
            </p>
            {meta ? (
              <div className="grid-3" style={{ margin: '16px 0' }}>
                <div className="metric">
                  <div className="metric__value">{formatNumber(meta.counts.total)}</div>
                  <div className="metric__label">已收录 SVG</div>
                </div>
                <div className="metric">
                  <div className="metric__value">{formatNumber(meta.counts.documentedNames)}</div>
                  <div className="metric__label">上游有文档的名称</div>
                </div>
                <div className="metric">
                  <div className="metric__value">{formatBytes(meta.counts.totalBytes)}</div>
                  <div className="metric__label">原始文件总大小</div>
                </div>
              </div>
            ) : null}
            <div className="callout">
              <div>
                <strong>纯静态。</strong> 站点只包含 HTML、CSS、JS 和 SVG；没有服务端运行时、数据库或付费 API。完整元数据是一个可下载的 JSON 文件。
              </div>
            </div>
          </section>

          <section id="structure" className="doc-section">
            <h2>{zh ? '目录结构' : 'Directory structure'}</h2>
            <pre className="codeblock" style={{ padding: 16 }}>{`bancora/
├─ public/
│  ├─ logos/           ${meta?.counts.byCollection.logos ?? 422} 个 SVG，主合集
│  ├─ other/           ${meta?.counts.byCollection.other ?? 184} 个 SVG，补充合集
│  ├─ data/
│  │  ├─ assets.json   完整索引（元数据 + 结构检查）
│  │  └─ audit.json    重复、冲突与质量汇总
│  └─ brand/           Bancora 标识、字标与分享图
├─ scripts/
│  ├─ scan-assets.mjs      扫描 public/，分析 SVG，生成索引与审计
│  └─ validate-assets.mjs  索引与文件不一致时直接失败
├─ shared/
│  └─ svg-analysis.mjs     结构与墨色分析（脚本与浏览器共用）
├─ src/                    React + TypeScript 应用
└─ docs/                   审计报告、数据结构、开发与测试文档`}</pre>
          </section>

          <section id="schema" className="doc-section">
            <h2>{zh ? '数据字段' : 'Data fields'}</h2>
            <p>
              索引由脚本生成，不手工编辑。上游没有发布的字段一律为 <code>null</code>，界面显示为「上游未提供」，绝不根据图形猜测。
            </p>
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>类型</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['id', 'string', '稳定标识，例如 logos/abchina-rect，全局唯一'],
                      ['name', 'string', '上游文档提供的中文名称'],
                      ['nameStatus', 'documented | tentative', 'tentative 表示名称来自文件名，界面会标注'],
                      ['aliases', 'string[]', '同一银行的不同版本用于检索的别名'],
                      ['filename', 'string', '原始文件名（含扩展名）'],
                      ['relativePath', 'string', '相对于 public/ 的路径'],
                      ['publicPath', 'string', '站点绝对路径，例如 /logos/abchina-rect.svg'],
                      ['collection', 'logos | other', '所属上游目录'],
                      ['variant', 'plain | rect | badge', '命名约定的版本，不是品牌分类'],
                      ['format', 'svg', '当前仅发布 SVG'],
                      ['fileSize', 'number', '字节数'],
                      ['sha256', 'string', '内容哈希，用于检测重复'],
                      ['viewBox', 'string | null', '根节点 viewBox 原文'],
                      ['width / height', 'number | null', '声明或由 viewBox 推导的尺寸'],
                      ['country / category', 'null', '上游未提供，刻意留空'],
                      ['website', 'string | null', '上游 README 链接的官网'],
                      ['source', 'object', '上游仓库、合集、npm 组件名'],
                      ['license', 'object', '仓库为 MIT；商标授权固定为 unknown'],
                      ['ink', 'object', '根据填充色估算的墨色，仅用于选择预览底板'],
                      ['quality', 'object', '结构状态与问题代码'],
                    ].map(([field, type, notes]) => (
                      <tr key={field}>
                        <td className="mono">{field}</td>
                        <td className="mono" style={{ color: 'var(--muted)' }}>
                          {type}
                        </td>
                        <td>{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ marginTop: 12 }}>
              完整说明见仓库中的 <code>docs/DATA_SCHEMA.md</code>。
            </p>
          </section>

          <section id="usage" className="doc-section">
            <h2>{zh ? 'HTML & React' : 'HTML & React'}</h2>
            <p>按公开路径引用即可。下面两段代码直接取自本站真实文件：</p>
            <div className="codeblock">
              <div className="codeblock__head">
                <span className="codeblock__lang">html</span>
                <CopyButton value={snippet.html} label="复制" variant="ghost" />
              </div>
              <pre>
                <code>{snippet.html}</code>
              </pre>
            </div>
            <div className="codeblock" style={{ marginTop: 10 }}>
              <div className="codeblock__head">
                <span className="codeblock__lang">tsx</span>
                <CopyButton value={snippet.react} label="复制" variant="ghost" />
              </div>
              <pre>
                <code>{snippet.react}</code>
              </pre>
            </div>
            <p>
              建议用 <code>&lt;img&gt;</code> 而不是内联 SVG：既能避免不可信标记进入文档树，也能利用浏览器缓存，单个文件损坏时不会拖垮整页。
            </p>
          </section>

          <section id="json" className="doc-section">
            <h2>{zh ? 'JSON 导出' : 'JSON export'}</h2>
            <p>完整索引由磁盘文件生成，因此不会与站点实际提供的素材脱节。</p>
            <div className="row">
              <a className="btn btn--sm" href={withBase('/data/assets.json')} download>
                下载 assets.json
              </a>
              <a className="btn btn--sm" href={withBase('/data/audit.json')} download>
                下载 audit.json
              </a>
              {meta ? <span className="mono muted">生成于 {formatDateTime(meta.generatedAt)}</span> : null}
            </div>
            <div className="codeblock" style={{ marginTop: 10 }}>
              <div className="codeblock__head">
                <span className="codeblock__lang">json</span>
              </div>
              <pre>
                <code>{`{
  "meta": { "schemaVersion": 1, "generatedAt": "...", "counts": { ... } },
  "assets": [
    {
      "id": "logos/abchina-rect",
      "name": "中国农业银行",
      "nameStatus": "documented",
      "publicPath": "/logos/abchina-rect.svg",
      "viewBox": "0 0 1024 1024",
      "country": null,
      "license": { "code": "MIT", "trademark": "unknown" }
    }
  ]
}`}</code>
              </pre>
            </div>
          </section>

          <section id="urls" className="doc-section">
            <h2>{zh ? '资源地址规则' : 'Asset URL rules'}</h2>
            <ul>
              <li>
                <strong>站点地址</strong> — <code>{withBase('/logos/&lt;file&gt;.svg')}</code>，用于 HTML 和 CSS，会自动包含部署子路径。
              </li>
              <li>
                <strong>仓库路径</strong> — <code>logos/&lt;file&gt;.svg</code> 或 <code>other/&lt;file&gt;.svg</code>，用于把文件复制进自己的项目。
              </li>
              <li>
                <strong>上游源码</strong> —{' '}
                <code>https://github.com/icongo/bank-logos/blob/main/&lt;collection&gt;/&lt;file&gt;.svg</code>，仅用于溯源，不要当作 CDN 热链。
              </li>
              <li>
                <code>other/</code> 里的文件名包含非 ASCII 字符，手工拼接地址时务必 URL 编码。
              </li>
            </ul>
          </section>

          <section id="npm" className="doc-section">
            <h2>{zh ? '@icongo/bl 兼容性' : '@icongo/bl compatibility'}</h2>
            <p>
              上游的 React 组件单独发布为 <a href="https://www.npmjs.com/package/@icongo/bl">@icongo/bl</a>。Bancora 不 fork、不改名、不重新发布该包，也不修改它的公开 API。
            </p>
            <div className="codeblock">
              <div className="codeblock__head">
                <span className="codeblock__lang">tsx</span>
                <CopyButton
                  value={`import { BLAbchina } from '@icongo/bl';\nimport { BLBankcomm } from '@icongo/bl/lib/BLBankcomm';\nimport data from '@icongo/bl/data.json';\nimport names from '@icongo/bl/names.json';`}
                  label="复制"
                  variant="ghost"
                />
              </div>
              <pre>
                <code>{`import { BLAbchina } from '@icongo/bl';
import { BLBankcomm } from '@icongo/bl/lib/BLBankcomm';
import data from '@icongo/bl/data.json';
import names from '@icongo/bl/names.json';`}</code>
              </pre>
            </div>
            <p>
              {meta?.npm.version
                ? `索引已与 @icongo/bl@${meta.npm.version} 交叉核对：${formatNumber(meta.npm.mapped)} / ${formatNumber(meta.counts.total)} 个素材能对应到已发布的组件名，其余 ${formatNumber(meta.counts.total - meta.npm.mapped)} 个只存在于 other/。`
                : '当前构建没有组件映射信息。'}{' '}
              组件名会显示在详情面板的「npm 组件」一栏，仅作为便利索引，不代表未来版本一定保持同名。
            </p>
            <div className="callout callout--warn">
              <div>
                <strong>不是同一个产品。</strong> <code>@icongo/bl</code> 是上游组件库，Bancora 是独立的网站工具。安装其中一个不会安装另一个，Bancora 也没有发布任何 npm 包。
              </div>
            </div>
          </section>

          <section id="local" className="doc-section">
            <h2>{zh ? '本地运行' : 'Run locally'}</h2>
            <pre className="codeblock" style={{ padding: 16 }}>{`npm install
npm run assets:validate   # 确认索引与 public/ 一致
npm run dev               # http://localhost:5173

npm run test              # 单元测试
npm run build             # 生产构建输出到 dist/`}</pre>
            <p>
              需要 Node.js 20+。技术栈是 Vite + React 18 + TypeScript。新增或删除 SVG 后，运行 <code>npm run assets:scan</code> 重新生成索引与审计报告。
            </p>
          </section>

          <section id="contributing" className="doc-section">
            <h2>{zh ? '贡献素材' : 'Contributing a logo'}</h2>
            <ol>
              <li>
                把 SVG 放进 <code>public/logos/</code>（主合集）或 <code>public/other/</code>（补充合集）。
              </li>
              <li>
                沿用上游命名：<code>slug.svg</code> 为标识，<code>slug-rect.svg</code> 为横版组合。
              </li>
              <li>
                运行 <code>npm run assets:scan</code>，再跑 <code>npm run assets:validate</code> 和 <code>npm run test</code>。
              </li>
              <li>在「质量检查」页面确认新文件没有结构错误。</li>
              <li>在 Pull Request 中说明素材来源与许可依据。不要添加无法引用的国家、类别或商标声明。</li>
            </ol>
          </section>

          <section id="conversion" className="doc-section">
            <h2>{zh ? '转换说明' : 'Conversion behaviour'}</h2>
            <ul>
              <li>SVG 由浏览器 <code>&lt;img&gt;</code> 解码到 canvas，不会解析进当前文档。</li>
              <li>渲染前会移除脚本、事件属性、<code>foreignObject</code> 和外部引用。</li>
              <li>按 <code>contain</code> 缩放，保持原始比例，绝不拉伸。</li>
              <li>尺寸限制 8–4096 px；编码失败会明确报错，不会静默回退。</li>
              <li>批量转换在浏览器内逐个执行，结果附带 JSON 清单。</li>
            </ul>
          </section>

          <section id="licence" className="doc-section">
            <h2>{zh ? '许可与商标' : 'Licence & trademarks'}</h2>
            <p>
              素材合集与本站代码均以 MIT 许可发布，© 2022 IconGo。MIT 覆盖的是文件本身，不覆盖文件中出现的银行商标。
            </p>
            <p>
              Bancora 是独立工具，与任何所列机构都没有隶属、赞助或背书关系。商业使用前请核实来源、品牌规范与适用条款。
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
