# CONTEXT_FOR_NEXT_AGENT.md

> 最后更新：2026-09-13 02:5x

## 项目当前状态

`~/Desktop/blog` 已从 **AstroPaper v6（Astro 6 + Tailwind）** 就地换成
**Hexo 8.1.2 + hexo-theme-butterfly 5.7.0**（pnpm）。站点可构建、可预览、随机背景生效。

原 Astro 项目整体在回收站（`gio trash`），需要时可从 `~/.local/share/Trash/files/blog` 取回。

## 最后一次完成的工作

- **框架替换**：按 zhdbk3/zhdbk3.github.io 的结构重建（`_config.yml` / `_config.butterfly.yml` /
  `source/` / `scaffolds/` / `scripts/`），`pnpm install` 通过（10.7s）。
- **艺术背景**：从 Windows `D:\THEMOON\艺术`（实测 412 文件 / 9.7 GB）挑选 43 件母本，加上本机
  `~/Pictures/Isle of Death.jpg`，合成为 **16 套 × 2 版式**（桌面 2560×1440 / 竖版 1200×1800），
  导出 AVIF + JPG 双格式，共 17 MB。四样式：A 单幅满铺 / B 主画+细节拼贴 / C 三联祭坛画 / D 层叠蒙太奇。
- **主题调校**：配色改古金+墨；卡片毛玻璃；背景渐变遮罩；导航半透明；作者头像 / favicon / 文章封面 / OG 图
  均由画作裁切生成。
- **两处真 bug 修复**：① Butterfly 的 `inject` 不经过 `url_for()`，子目录部署下 `/css/custom.css`
  等全部 404 → 新增 `scripts/inject-root.js` 在生成前补 `config.root`；② `fonts.css` 里的绝对字体路径
  改相对路径 `../fonts/`。
- **清场**：移除 giscus 评论（原指向 zhdbk3 的 repo，会把评论发到他那儿）、去掉不存在的「相册」菜单项、
  替换副标题语录与关于页、友链清空为模板。
- **验证**：`pnpm run build` 通过；Playwright 截图 6 张（桌面浅色/深色、移动端、文章页、关于页、归档页），
  控制台 **0 错误**；随机背景与窄屏竖版切换均已实测生效。

## 遗留问题 / 待办

- [ ] **GitHub 仓库尚未创建**：`github.com/xieguaiwu/blog` 返回 404（已实测）。本地已 `git init` +
      首次提交，但**未推送**。需用户决定：建公开仓库并推送 / 改用别的仓库名 / 先不动。
- [ ] **站点标识待定**：标题暂用 `xieguaiwu's Blog`、副标题空、关于页「关于我」一节是占位。
- [ ] **评论系统关闭中**：要启用 Giscus 需自建仓库开 Discussions + 装 giscus App，再回填
      `_config.butterfly.yml` 的 `repo / repo_id / category_id`。
- [ ] **友链为空**：`source/_data/link.yml` 只有模板注释。
- [ ] **B.AI / 站点统计**：`busuanzi` 保留开启。注意本地预览会显示**全站聚合**数字（7.9M 那种），
      属机制而非故障；真实域名下显示本站真实计数。

## 背景生成管线（仓库外）

工作目录 `~/Desktop/blog-work/`（未纳入版本控制）：

| 文件 | 用途 |
| :--- | :--- |
| `win_art_inventory.tsv` | Windows 艺术素材全量清单（412 行） |
| `prep_plates.py` | 归一化为画板（长边 ≤ 3200px，sRGB） |
| `gen_backgrounds.py` | 16 套拼贴生成（A/B/C/D 四样式，含桌面与竖版） |
| `export_web.py` | 导出 AVIF/JPG + 封面 + favicon + 头像 + OG 图 |
| `shoot.py` | Playwright 多视口截图验证 |
| `patch.py` | 精确字符串替换工具（本次 `edit` 工具失效时的替代） |

## 已知环境问题

- 本会话 `edit` 工具报 ENOENT：pi 进程的工作目录曾是 `~/Desktop/blog`，该目录被 `gio trash`
  删除后 inode 失效。**重启 pi 会话即可恢复**；期间用 `blog-work/patch.py` 做精确替换。

## 远程资源

- Windows 主机 `win`（192.168.1.4，用户 `Wang Ziyan`）：艺术素材来源，链路实测通（ping / 22 / scp ~13 MB/s）。

## 知识图谱

- graphify-out/：不存在（本项目规模小，未建）。

## 最后更新时间

2026-09-13 02:5x
