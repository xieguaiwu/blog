# xieguaiwu's Blog

**已上线**：<https://xieguaiwu.github.io/blog/>

用 **Hexo 8 + Butterfly 5.7** 搭建的个人博客。版式与配置参考
[zhdbk3/zhdbk3.github.io](https://github.com/zhdbk3/zhdbk3.github.io)（MIT），
配色与背景按自己的口味重做。

灵感来源：[zhdbk3.github.io](https://zhdbk3.github.io/) — 着火的冰块nya 的小家

## 特色

- **艺术混搭背景**：16 套由公有领域画作合成的拼贴，每次加载随机切换一张；窄屏自动改用竖版变体。
- **古金 + 墨配色**：卡片半透明毛玻璃，让背景画作透出来；渐变遮罩保证文字始终可读。
- **中英双语**：默认英文，文章可带 `.zh-CN.md` 中文变体（`lang` / `lang_alt` 互链）。
- **Giscus 评论**：基于 GitHub Discussions。
- **项目进度面板**：首页嵌入的活跃项目卡片。
- **学科分类**：14 个英文学术分类（Philosophy of Mind / Political Philosophy / Aesthetics / …）。
- 本地搜索、RSS、站点统计、暗色模式（18:00–06:00 自动切换）。
- KaTeX 数学公式、文章注音（front-matter 加 `ruby: true`）。
- GitHub Actions 自动构建并发布到 GitHub Pages。

## 目录

```
.
├── _config.yml                 # Hexo 主配置（站点信息、URL、渲染器）
├── _config.butterfly.yml       # 主题配置（背景数组、配色、菜单、社交链接）
├── scripts/
│   ├── inject-root.js          # 修正子目录部署下的 inject 资源路径
│   └── ruby.js                 # 注音功能
├── source/
│   ├── _posts/                 # 文章（.md = 英文，.zh-CN.md = 中文变体）
│   ├── _data/link.yml          # 友链
│   ├── _data/projects.yml      # 项目面板数据
│   ├── about/  tags/  categories/  link/  projects/
│   ├── css/
│   │   ├── custom.css          # 背景遮罩、卡片毛玻璃、可读性调整
│   │   └── fonts.css
│   ├── js/
│   │   ├── bg-art.js           # 窄屏切换竖版背景
│   │   ├── subtitle.js         # 首页副标题（英文引文随机轮播）
│   │   ├── runtime.js          # 建站时长 + 页脚致谢
│   │   ├── projects.js         # 首页项目进度面板
│   │   └── quotes.js           # 直角引号切换
│   └── img/bg/art/             # 32 张背景（16 套 × 桌面/竖版，各含 avif+jpg）
├── docs/backgrounds.md         # 背景素材来源与生成管线
├── CONTEXT_FOR_NEXT_AGENT.md   # 项目状态与配置要点（改配置前必读）
└── .github/workflows/pages.yml # 自动部署
```

## 文章 front-matter

```yaml
---
title: "..."
date: 2026-01-01 00:00:00
categories: [Aesthetics]      # 必须是 14 个英文学科分类之一
tags: [art, painting]         # 全英文小写连字符
description: "..."
cover: /img/bg/art/cover/A1.avif
cover_type: img
lang: en                      # 本文语言
lang_alt: zh-CN               # 对侧语言（可选）
slug: my-post                 # 双版本共用，保证互链一致
---

> 🤖 **AI Translation Notice**: ...（译自中文的文章）
> 📝 **Article Type**: Research Paper
> 📖 **Also published on**: [平台](url)
```

## 本地开发

```bash
pnpm install
pnpm run server     # http://localhost:4000/blog/
pnpm run build      # 静态输出到 public/
pnpm run clean      # 清缓存
pnpm run format     # Prettier 格式化
```

> 站点 `url` 配的是 `https://xieguaiwu.github.io/blog`，所以本地预览地址带 `/blog/` 前缀。

## 换背景

1. 图片放进 `source/img/bg/art/`。
2. 在 `_config.butterfly.yml` 的 `background:` 数组里加一行。

数组 = 每次加载随机取一张；改成单个字符串 = 固定使用该张。
竖版变体按 `名字-m.avif` 命名，`bg-art.js` 会自动切换。
生成管线见 [docs/backgrounds.md](docs/backgrounds.md)。

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并发布到 GitHub Pages。
仓库 Settings → Pages → Source 为 **GitHub Actions**（已配置）。

## 改配置的两个陷阱

1. **`_config.butterfly.yml` 只能有一个 `inject:` 段**。新增注入要追加到已有段（约 line 1091），
   另起一个会让 `hexo clean` 直接 FATAL（YAML 重复 key）。
2. **改配置后必须先 `pnpm run clean`**，否则旧缓存可能掩盖问题。

> ⚠️ GitHub 账户名是 `xieguaiwu`（g-u-**a-i**-w-u），Linux 主机名是 `xieguiawu`（g-u-**i-a**-w-u）。
> 两者终端显示一致——拼接 URL 前用 `printf '%s' "$USER" | xxd` 核对。

## 许可

- 文章与 `source/about/`：CC BY-NC-SA 4.0
- 站点代码：MIT
- 背景画作：公有领域（不属本项目所有，详见 [docs/backgrounds.md](docs/backgrounds.md)）

## 致谢

- [Hexo](https://hexo.io/) · [Butterfly](https://butterfly.js.org/)（MIT）
- 框架与自定义样式的思路来自 [zhdbk3 的小家](https://zhdbk3.github.io/)（MIT）
