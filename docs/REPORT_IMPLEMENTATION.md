# Bancora — report implementation update

本轮已按架构审查报告落地风险修复，并完成回归验证。

## 已完成

- **GitHub Pages 子路径**：应用资产统一通过 `BASE_URL` / `assetUrl()` 构造；Inspector、转换器和导出流程不再拼接根路径。
- **运行时数据边界**：`useDataset` 在进入全局状态前校验 `assets.json` 的根结构、枚举、嵌套字段、唯一性和 `meta.counts` 聚合值；错误会显示带路径的加载信息。
- **偏好持久化**：`normalizePreferences` 对主题、语言、画板和紧凑网格逐字段白名单化，损坏的 localStorage 值回退默认值。
- **Inspector 资源上限**：上传检查限制为 200 个 SVG、单文件 2 MiB、批次 32 MiB；超限文件生成 `FILE_TOO_LARGE` 发现项而不读取其内容。仓库扫描支持 AbortSignal 和取消按钮。
- **转换器资源和取消**：画布总面积限制为 16,777,216 像素；Image 解码、`toBlob`、FileReader 和批量 ZIP 压缩均响应取消，组件卸载会终止陈旧任务。
- **ZIP 导出**：导出使用 JSZip 流式 API，取消时暂停流并清空 chunk，避免关闭对话框后仍继续生成或更新旧 UI。
- **E2E 可复现性**：`npm run test:e2e` 自动执行生产构建、启动有路径边界检查的静态服务器、等待就绪、运行 Chrome 检查并清理服务；`test:e2e:raw` 保留手动服务器模式。
- **CI**：GitHub Pages workflow 增加 typecheck、完整单元测试、root-host build 和生产 E2E 门禁，再执行 Pages build。

## 验证结果

- `npm run typecheck`：通过。
- `npm run test`：15 个测试文件、106 个测试通过。
- `npm run assets:validate`：606 条素材，10/10 检查通过。
- `npm run build:pages`：通过并生成 `404.html`、`.nojekyll`。
- `npm run test:e2e`：38/38 浏览器检查通过。

## 保留限制

- 浏览器运行时校验能验证数据形状和聚合关系，文件字节、SHA-256 与结构新鲜度仍由 `assets:validate` 在构建/CI 阶段负责。
- E2E 使用本机 Chrome 和本地静态服务，不替代真实 GitHub Pages/CDN 部署探针。
- Inspector 的视觉重复签名是结构候选，不代表品牌身份或法律归属判断。
