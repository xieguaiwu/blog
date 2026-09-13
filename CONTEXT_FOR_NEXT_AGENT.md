# CONTEXT_FOR_NEXT_AGENT.md

> 最后更新：2026-09-13 15:3x

## 项目当前状态

**已上线**：https://xieguaiwu.github.io/blog/ （GitHub Pages，`build_type: workflow`，public）
**仓库**：https://github.com/xieguaiwu/blog （public）

技术栈：**Hexo 8.1.2 + hexo-theme-butterfly 5.7.0**（pnpm）。CI 由 `.github/workflows/pages.yml` 驱动，
push 到 `main` 即自动构建部署（含 `TZ: Asia/Shanghai` 锁定，防本地/CI 日期漂移）。

> ⚠️ **用户名拼写铁律**：GitHub 账户 = `xieguaiwu`（hex `75 61 69` = g-u-**a-i**-w-u）；
> Linux 主机名 = `xieguiawu`（g-u-**i-a**-w-u）。二者终端显示完全一致。
> **任何 URL/remote/owner 拼接前必须 `printf '%s' "$USER" | xxd` 核对**——2026-09-13 因拼错导致
> 404 误判为「仓库损坏」，并错误提议删除仓库（详见 daily/2026-09-13）。

## 已完成的工作（截至 2026-09-13）

### 内容
- **19 篇文章**：12 篇从本地作品转入（docx/tex/网页/豆瓣抓取）+ 2 篇站点说明（开张帖已删）+ 双语变体
- **双语架构**：`language: en`（默认）+ `languages: [en, zh-CN]`；7 篇文章有完整中英双版本
  （`.md` = 英文，`.zh-CN.md` = 中文，同 slug，`lang`/`lang_alt` 字段互链）
- **AI 翻译声明**：每篇译自中文的文章开头有 `> 🤖 **AI Translation Notice**` blockquote
- **发表平台链接**：豆瓣 / Oxford JSS / arXiv 三篇有 `> 📖 **Also published on**` 链接
- **题材标注**：每篇有 `> 📝 **Article Type**`（Research Paper / Literary Analysis / Book Review / Film Review / Personal Essay / Reference）

### 分类与标签（全英文）
- **14 个学科分类**（`category_map`，见 `_config.yml`）：Philosophy of Mind / Political Philosophy /
  Philosophy of Science / Ethics / Aesthetics / Literary Theory / Political Economy / Quantitative Finance /
  Intellectual History / Philosophy of Religion / Logic / Social Theory / Quantitative Linguistics /
  Film and Media Studies
- **标签**：全英文 + 连字符小写（`tag_map` 已英文化）

### 主题与交互
- **引文轮播**（`source/js/subtitle.js`）：全部英文。Cioran（Seahorse 2012 标准译本）/ Kafka
  *The Next Village* / Rilke *The Panther* / Carver *Why Don't You Dance?* / 李贺《南山田中行》（自译）/
  Wilde / Hemingway / Calvino / Cézanne / Faulkner
- **页脚**（`source/js/runtime.js`）：Cioran 引文 + 灵感来源致谢链接 zhdbk3
- **Giscus 评论**：已启用。`repo_id: R_kgDOUYPQRA` / `category_id: DIC_kwDOUYPQRM4DFe7s` / `data-lang: en`。
  前置条件（用户已在网页端完成）：仓库开 Discussions + 装 giscus GitHub App
- **项目进度面板**：`source/js/projects.js` 经 `inject.bottom` 注入，仅在首页渲染 10 个项目卡片
- **友链**：6 条（GitHub / Bilibili / 抖音 / 豆瓣 / Oxford JSS / arXiv），见 `source/_data/link.yml`
- **社交图标**：GitHub / Atom / ISAA
- **艺术背景**：16 套 × 2 版式（桌面 2560×1440 / 竖版 1200×1800），AVIF+JPG，随机切换，窄屏自动换竖版
- **配色**：古金 + 墨；卡片毛玻璃；背景渐变遮罩

### 关于页
- `source/about/index.md`（英文）+ `source/about/index.zh-CN.md`（中文），含 lang_alt 互链

## 遗留问题 / 待办

- [ ] **博客侧反向启发未做**：可把 GitHub 主页的维特根斯坦语录（`A whole mythology is deposited in our language.`）
      加入引文轮播；About 页可加「Aesthetical Preference」（Fallen Angel / K.Sunnerberg / Monokai-Pro / Sway）
      与「Tools」（Fedora / Vim / Neovim / Sublime / Obsidian）两节
- [ ] **`~/prompt_boilerplates` 无 remote**：translate_assist.md v1.4.0（双向翻译 + 引文标准）commit `a85754e`
      仅本地，需配 remote 或手动同步
- [ ] **引文轮播中三句自撰语录**（`source: null` 的「每一幅画里…」「目标和希望会枯萎…」等）待用户确认是否保留
- [ ] **`public-domain-paintings` 文章**：正文为中文，已有 zh-CN 变体，但英文版是否需润色待确认

## 配置要点（改配置前必读）

- **`_config.butterfly.yml` 只有一个 `inject:` 段**（约 line 1091）。新增注入必须**追加到已有段**，
  不能在文件顶部另起一个 `inject:`——YAML 重复 key 会导致 `hexo clean` 直接 FATAL。
- **`category_map` / `tag_map` 的 key 必须是英文**，与文章 front-matter 中的 `categories` / `tags` 值一致。
- **`inject` 不经过 `url_for()`**：子目录部署下需 `scripts/inject-root.js` 在生成前补 `config.root`。
- **文章 front-matter 可选字段**：`lang` / `lang_alt` / `slug` / `cover_type`。

## 本地开发

```bash
cd ~/Desktop/blog
pnpm install
pnpm run server     # http://localhost:4000/blog/
pnpm run build      # 静态输出到 public/
pnpm run clean      # 清缓存（改配置后必须先 clean 再 build）
```

> 站点 `url` 配的是 `https://xieguaiwu.github.io/blog`，所以本地预览地址带 `/blog/` 前缀。

## 背景生成管线（仓库外）

工作目录 `~/Desktop/blog-work/`（未纳入版本控制）：

| 文件 | 用途 |
| :--- | :--- |
| `win_art_inventory.tsv` | Windows 艺术素材全量清单（412 行） |
| `prep_plates.py` | 归一化为画板（长边 ≤ 3200px，sRGB） |
| `gen_backgrounds.py` | 16 套拼贴生成（A/B/C/D 四样式，含桌面与竖版） |
| `export_web.py` | 导出 AVIF/JPG + 封面 + favicon + 头像 + OG 图 |
| `shoot.py` | Playwright 多视口截图验证 |
| `patch.py` | 精确字符串替换工具 |

## 已知环境问题

- **pi 会话 cwd 可能失效**：本会话的原始 cwd 是 `~/.local/share/Trash/files/blog`（已被 trash），
  导致 `bash` 工具全程报 "Working directory does not exist"，只能用带 `cwd` 参数的 subagent 或 read/edit 工具。
  **重启 pi 会话即可恢复**。
- 快速 subagent（`quick`，30s 超时）在此环境常常超时；复杂任务用 `hephaestus`（600-900s）。

## 远程资源

- Windows 主机 `win`（192.168.1.4，用户 `Wang Ziyan`）：艺术素材来源，链路实测通（ping / 22 / scp ~13 MB/s）。
- GitHub 主页仓库 `xieguaiwu/xieguaiwu`：已追加 `## Writing & Research` 节（博客 + 论文链接）与标签行，
  原有 Languages / Aesthetical Preference / Tools 三节完整保留。

## 知识图谱

- graphify-out/：不存在（本项目规模小，未建）。

## 最后更新时间

2026-09-13 15:3x
