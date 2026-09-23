# Abstract Graph（文章图示化摘要）+ 双语站修复 — Implementation Plan

> **For agentic workers:** 按本计划任务逐项实施。步骤用 checkbox（`- [ ]`）跟踪。
> 本计划由 2026-09-23 会话产出；所有机制已在 `/tmp/blog-build-test` 沙箱副本实测通过。

**Goal:** 修复三处既有缺陷（双语 URL 冲突、两篇 YAML 解析失败、正文根路径链接 404），并为每篇文章增加「简明 + 图示化」的 abstract graph（图示摘要），随文章语言适配。

**Architecture:** 全部改动落在仓库既有扩展点：`scripts/*.js` 过滤器（Hexo 扩展） + `source/css/custom.css`（样式） + 文章 front-matter（图数据）。渲染在构建期完成，输出内联 HTML + SVG，零客户端 JS。

**Tech Stack:** Hexo 8.1.2 / hexo-theme-butterfly 5.7.0 / pnpm 11 / Node 22 / markdown-it；测试用 Node 内置 `node --test`（零新依赖）；截图验证用 Playwright（本机已装，脚本放 `~/Desktop/blog-work/`，不入仓）。

**Spec:** 需求原文：「给每一个文章增加简明+图示化的 abstract graph，要做语言适配」。调查证据与设计论证见本会话（2026-09-23）及 `CONTEXT_FOR_NEXT_AGENT.md`。

## 执行状态（2026-09-23）

- ✅ **Phase 0 完成**（commit `0344133`）：语言前缀 permalink、两处 YAML 修复、content-root 链接补齐、about 页迁移、按页 html lang、语言互链。验证：21 页（13 en + 8 zh）、构建 0 ERROR、全站内链 0 缺失。
- ✅ **Phase 1 完成**（本次提交）：渲染器 + 样式 + 试点数据（abe 中英 / teddy）+ 22 例单测 + CI test 步骤；momus 审查后修复（自链接/保留 id/转义/配置驱动 permalink 等）。截图见 `~/Desktop/blog-work/shots/ag/`（12 张：1440/768/390 × 明/暗 × 中英）。
- ⏳ **Phase 2/3 待用户评审试点后进行**：其余 19 个文件的图数据、全站验证、部署核查。

## Global Constraints

- 站点部署于子路径：`url = https://xieguaiwu.github.io/blog`，`root = /blog/`。任何正文/注入 HTML 中的站内链接必须 root 安全。
- 改 `_config.butterfly.yml` 后必须先 `pnpm run clean`；该文件只允许一个 `inject:` 段。
- 不新增运行时依赖（客户端零 JS、不引入 CDN）；`node --test` 为 devDependency 之外的内置能力，不写进 dependencies。
- 字符串长度校验用码点计数（`[...s].length`），禁止用 `.length` 判断中文标签长度（质量关卡 12）。
- 用户可见文本（图注、语言链接）遵守 ASD-STE100：短句、一词一义（质量关卡 13）。
- 构建后必须执行验证命令并附输出（`verification-before-completion.md` Gate Function），禁止裸声称。
- 不修改 `node_modules/`；不引入 `as any` 类抑制（不适用本仓库，规则记录在案）。
- 提交信息用英文 Conventional Commits（与仓库既有风格一致）；中文内容文件保持 UTF-8。
- 每个任务结束运行一次干净构建（`pnpm run clean && pnpm run build`）。

---

## Phase 0：既有缺陷修复（独立价值，先行）

### Task 0.1: 修复两处 YAML front-matter 解析失败

**Files:**

- Modify: `source/_posts/abe-kobo-box-man.zh-CN.md:6`
- Modify: `source/_posts/public-domain-paintings.md:2`

**Interfaces:**

- Produces: 21 个 post 文件全部可被 js-yaml 解析（后续任务的构建前提）

- [ ] **Step 1: 确认失败现状**

Run:

```bash
cd ~/Desktop/blog && node -e "
const yaml=require('./node_modules/.pnpm/js-yaml@4.3.0/node_modules/js-yaml');const fs=require('fs');
for (const f of fs.readdirSync('source/_posts')) {
  const m=fs.readFileSync('source/_posts/'+f,'utf8').match(/^---\n([\s\S]*?)\n---/);
  try{yaml.load(m[1]);}catch(e){console.log('FAIL',f,'::',e.message.split('\n')[0]);}
}"
```

Expected: 输出 2 行 FAIL（`abe-kobo-box-man.zh-CN.md`、`public-domain-paintings.md`）

- [ ] **Step 2: 修复引号**

`abe-kobo-box-man.zh-CN.md`：`description: ""镜子和…倍增。""` → 外层改单引号：

```yaml
description: '"镜子和男女交媾是可憎的，因为它们使人的数目倍增。"'
```

`public-domain-paintings.md`：title 加双引号：

```yaml
title: 'The Provenance of Sixteen Backgrounds: A Public Domain Painting Inventory'
```

- [ ] **Step 3: 复验**

Run: 同 Step 1 的脚本
Expected: 无 FAIL 输出（21/21 通过）

### Task 0.2: 语言前缀 permalink（修双语 URL 冲突）

**Files:**

- Create: `scripts/lang-permalink.js`（替代 `scripts/fix-lang-slug.js`，删除旧文件）

**Interfaces:**

- Produces: 非默认语言文章路径 = `zh-CN/2024/05/24/<slug>/`；默认语言路径不变

- [ ] **Step 1: 写新过滤器**

```js
/**
 * 多语言文章 permalink：非默认语言加语言前缀。
 *
 * Hexo 8 由文件名推导 slug，故 "post.zh-CN.md" 的 permalink 为
 * "2024/05/24/post.zh-CN/"。本站约定：默认语言（en）留在根路径，
 * 其他语言前缀语言码，得 "zh-CN/2024/05/24/post/"。
 *
 * 注意：旧脚本把后缀直接剥掉，导致 en/zh 写同一路径、构建间语言随机翻转。
 */
'use strict';

hexo.extend.filter.register('post_permalink', function (permalink) {
  if (typeof permalink !== 'string') return permalink;

  const config = this.config;
  const defaultLang = config.language;
  const langs = Array.isArray(config.languages) ? config.languages : [defaultLang];
  const match = permalink.match(/\.([a-z]{2}(?:-[A-Z]{2})?)\/$/);
  if (!match) return permalink;

  const lang = match[1];
  if (lang === defaultLang || !langs.includes(lang)) return permalink;
  return lang + '/' + permalink.replace(/\.([a-z]{2}(?:-[A-Z]{2})?)\/$/, '/');
});
```

- [ ] **Step 2: 删除旧脚本**

Run: `cd ~/Desktop/blog && git rm scripts/fix-lang-slug.js`（新文件 `git add`）

- [ ] **Step 3: 干净构建并断言两套 URL**

Run:

```bash
cd ~/Desktop/blog && pnpm run clean && pnpm run build 2>&1 | tail -3
echo "en posts: $(find public -name index.html | grep -E '^public/20' | grep -v zh-CN | wc -l)"   # 期望 13
echo "zh posts: $(find public -path '*zh-CN*' -name index.html | grep -E 'zh-CN/20' | wc -l)"    # 期望 8
test -f public/zh-CN/2024/05/24/abe-kobo-box-man/index.html && echo "zh abe OK"
test -f public/2024/05/24/abe-kobo-box-man/index.html && echo "en abe OK"
```

Expected: 13 / 8 / 两行 OK

### Task 0.3: 正文根路径链接过滤器

**Files:**

- Create: `scripts/content-root.js`

**Interfaces:**

- Consumes: `config.root`（`/blog/`）
- Produces: 正文与页面 HTML 中的 `href="/x"`、`src="/x"` 补 root 前缀；`root === '/'` 时不生效

- [ ] **Step 1: 写过滤器**

```js
/**
 * 给正文内的根绝对链接补 config.root。
 *
 * 正文链接不经过主题的 url_for()。本站部署在 /blog/ 子路径下，
 * 写成 "/zh-CN/..." 或 "/img/..." 会 404。本过滤器在渲染后补齐前缀。
 * 若将来站点改为主域名（root = /），本过滤器自动不生效。
 */
'use strict';

hexo.extend.filter.register('after_post_render', function (data) {
  if (!data.content) return data;

  const root = this.config.root || '/';
  if (root === '/') return data;

  // 跳过已带 root 前缀的链接，避免 /blog/blog/...（root 按需转义）
  const prefix = root.replace(/^\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(\\s(?:href|src)=)(["\'])/(?!\\/|' + prefix + ')', 'g');

  // 保护代码块：按 <pre> / <code> 切分，只处理偶数段（非代码段）
  const parts = data.content.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(re, (m, a, b) => a + b + root);
  }
  data.content = parts.join('');
  return data;
});
```

- [ ] **Step 2: 构建并断言**

Run:

```bash
cd ~/Desktop/blog && pnpm run build 2>&1 | tail -2
echo "bare root links: $(grep -rEo '(href|src)="/(zh-CN|img)/' public --include='*.html' | wc -l)"   # 期望 0
echo "prefixed: $(grep -rEo 'href="/blog/zh-CN/' public --include='*.html' | wc -l)"             # 期望 > 0
grep -o 'src="[^"]*structural[^"]*"' public/2026/07/01/china-economic-dilemma/index.html | head -2
```

Expected: `bare root links: 0`；`prefixed` 大于 0；china 配图 src 以 `/blog/img/` 开头

### Task 0.4: about 页迁移 + html lang 按页 + 语言互链

**Files:**

- Move: `source/about/index.zh-CN.md` → `source/zh-CN/about/index.md`
- Create: `scripts/html-lang.js`
- Create: `scripts/lang-alt-link.js`

**Interfaces:**

- Produces: `/zh-CN/about/`；`<html lang>` = 页面语言；文章页出现语言切换链接

- [ ] **Step 1: 迁移 about 中文页**

Run: `cd ~/Desktop/blog && git mv source/about/index.zh-CN.md source/zh-CN/about/index.md`
（front-matter 保持 `lang: zh-CN` / `lang_alt: en` 不变）

- [ ] **Step 2: 写 html-lang 过滤器**

```js
/**
 * 按页面语言改写 <html lang>。主题固定用 config.language（en），
 * 中文页面会被标成 lang="en"，影响可访问性与 SEO。
 */
'use strict';

hexo.extend.filter.register('after_render:html', function (str, locals) {
  const lang = locals && locals.page && locals.page.lang;
  if (!lang || typeof str !== 'string') return str;
  return str.replace(/<html[^>]*>/, function (tag) {
    return tag.replace(/\slang="[^"]*"/, ' lang="' + lang + '"');
  });
});
```

- [ ] **Step 3: 写语言互链过滤器**

```js
/**
 * 文章页语言切换链接：按 base slug + lang 配对查找对侧文章。
 * 注入位置：正文前导提示 blockquote 之后（与图示摘要同锚点）。
 */
'use strict';

const LABELS = { 'zh-CN': '中文版', en: 'English version' };

function stripLang(slug, lang) {
  const suffix = '.' + lang;
  return slug.endsWith(suffix) ? slug.slice(0, -suffix.length) : slug;
}

hexo.extend.filter.register('after_render:html', function (str, locals) {
  const page = locals && locals.page;
  if (!page || page.layout !== 'post' || !page.lang) return str;

  const posts = this.locals.get('posts').toArray();
  const key = stripLang(page.slug, page.lang);
  // p.lang 缺失的单语文章不参与配对（否则 undefined !== 'en' 会误配）
  const counterpart = posts.find(
    (p) => p.lang && p.lang !== page.lang && stripLang(p.slug, p.lang) === key,
  );
  if (!counterpart) return str;

  const label = LABELS[counterpart.lang] || counterpart.lang;
  const html =
    '<p class="lang-alt"><i class="fas fa-language"></i> ' +
    '<a href="' +
    this.config.root +
    counterpart.path +
    '">' +
    label +
    '</a></p>';

  const anchor =
    /(<article[^>]*id="article-container"[^>]*>\s*(?:<div id="post-outdate-notice"[\s\S]*?<\/div>)?)((?:\s*<blockquote>[\s\S]*?<\/blockquote>)*)/;
  if (!anchor.test(str)) return str;
  // 函数式替换：标签文本可能含 $& / $1 等，字符串替换会被展开（标签含 $ 时）
  return str.replace(anchor, (m, a, b) => a + b + html);
});
```

- [ ] **Step 4: 构建并断言**

Run:

```bash
cd ~/Desktop/blog && pnpm run clean && pnpm run build 2>&1 | tail -2
test -f public/zh-CN/about/index.html && echo "zh about OK"
grep -o '<html lang="[^"]*"' public/zh-CN/2024/05/24/abe-kobo-box-man/index.html
grep -o 'lang-alt[^<]*<[^>]*>[^<]*' public/zh-CN/2024/05/24/abe-kobo-box-man/index.html | head -2
grep -c 'lang-alt' public/2024/05/24/abe-kobo-box-man/index.html
```

Expected: `zh about OK`；zh 页 `<html lang="zh-CN"`；zh 页含指向 `/blog/2024/05/24/abe-kobo-box-man/` 的链接；en 页 `lang-alt` 计数 ≥1

### Task 0.5: P0 验证 + 文档同步 + 提交

- [ ] **Step 1: 全量断言**

Run:

```bash
cd ~/Desktop/blog && pnpm run clean && pnpm run build 2>&1 | tee /tmp/p0-build.log | tail -3
echo "ERROR lines: $(grep -c 'ERROR' /tmp/p0-build.log)"      # 期望 0
echo "posts: $(find public -name index.html | grep -E 'public/(zh-CN/)?20' | wc -l)"   # 期望 21
```

Expected: ERROR 0；posts 21

- [ ] **Step 2: 文档同步（关卡 5）**

更新 `README.md`（目录树补 `scripts/lang-permalink.js`、`content-root.js`、`html-lang.js`、`lang-alt-link.js`；front-matter 说明补 `abstract_graph`（P1 后）；中英双语文章说明补「非默认语言页位于 `/{lang}/` 前缀 URL」）、`CONTEXT_FOR_NEXT_AGENT.md`（缺陷修复记录 + 新 URL 结构；同时修正两处已知漂移：`:22` 的「7 篇双版本」应为 8 篇、`:49` 仍引用已迁移的 `source/about/index.zh-CN.md`）。

- [ ] **Step 3: 提交**

```bash
cd ~/Desktop/blog && git add -A && git commit -m "fix(i18n): publish zh-CN posts under language-prefixed permalinks

- lang-permalink.js: non-default-language posts get /{lang}/ prefix
  (old fix-lang-slug.js stripped the suffix and made en/zh collide,
  so the language served at each URL flipped between builds)
- repair YAML front matter of two posts that failed to parse
- content-root.js: prefix root-absolute links in content with config.root
- move zh about page to /zh-CN/about/; per-page html lang; language switch link
- add docs/plans/2026-09-23-abstract-graph.md"
```

---

## Phase 1：Abstract Graph 机制 + 试点

### Task 1.1: 渲染器 + 单元测试

**Files:**

- Create: `scripts/abstract-graph.js`
- Create: `test/abstract-graph.test.js`
- Modify: `package.json`（scripts 增加 `"test": "node --test test/"`）
- Modify: `.github/workflows/pages.yml`（build 前加 test 步骤）

**Interfaces:**

- Produces（module.exports，供测试与其他脚本使用）:
  - `validateSpec(spec, lang) -> { errors: string[], warnings: string[] }`
  - `layoutRadial(spec) -> { nodes: [{id, x, y, isCenter}], edges: [{from, to, label, labelX, labelY}] }`
  - `renderFigure(spec, lang) -> string`（HTML）
  - `escapeHtml(s) -> string`、`charLen(s) -> number`

- [ ] **Step 1: 写失败测试**

```js
// test/abstract-graph.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ag = require('../scripts/abstract-graph.js');

test('validateSpec accepts a well-formed spec', () => {
  const r = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A', edge: 'e1' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    'en',
  );
  assert.equal(r.errors.length, 0);
});

test('validateSpec rejects duplicate ids and bad links', () => {
  const r = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      links: [['a', 'zz', 'x']],
    },
    'en',
  );
  assert.ok(r.errors.some((e) => e.includes('duplicate')));
  assert.ok(r.errors.some((e) => e.includes('zz')));
});

test('validateSpec warns on overlong CJK label using code points', () => {
  const long = '很长的标签'.repeat(10); // 50 code points
  const r = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: long },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    'zh-CN',
  );
  assert.ok(r.warnings.some((w) => w.includes('label')));
});

test('layoutRadial puts center in the middle and satellites around it', () => {
  const l = ag.layoutRadial({
    center: 'T',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
  });
  assert.equal(l.nodes.length, 4);
  const c = l.nodes.find((n) => n.isCenter);
  assert.equal(c.x, 50);
  assert.equal(c.y, 50);
  assert.equal(l.edges.length, 3);
});

test('renderFigure escapes HTML and marks language', () => {
  const html = ag.renderFigure(
    {
      center: '<T>',
      nodes: [
        { id: 'a', label: 'A & B' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    'zh-CN',
  );
  assert.ok(html.includes('&lt;T&gt;'));
  assert.ok(html.includes('&amp;'));
  assert.ok(html.includes('lang="zh-CN"'));
  assert.ok(html.includes('图示摘要'));
});

test('validateSpec bounds node count and center presence', () => {
  const two = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    },
    'en',
  );
  assert.ok(two.errors.some((e) => e.includes('nodes')));
  const eight = ag.validateSpec(
    { center: 'T', nodes: Array.from({ length: 8 }, (_, i) => ({ id: 'n' + i, label: 'N' })) },
    'en',
  );
  assert.ok(eight.errors.some((e) => e.includes('nodes')));
  const noCenter = ag.validateSpec(
    {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    'en',
  );
  assert.ok(noCenter.errors.some((e) => e.includes('center')));
});

test('validateSpec tolerates malformed links without crashing', () => {
  const r = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      links: 'oops',
    },
    'en',
  );
  assert.equal(r.errors.length, 0);
  const bad = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      links: [['a', 'b']],
    },
    'en',
  );
  assert.ok(bad.errors.some((e) => e.includes('links')));
});

test('layoutRadial emits link edges with 3-element arrays', () => {
  const l = ag.layoutRadial({
    center: 'T',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    links: [['a', 'b', 'contrasts']],
  });
  assert.equal(l.edges.filter((e) => e.label === 'contrasts').length, 1);
  assert.ok(l.edges.length >= 4);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd ~/Desktop/blog && node --test test/ 2>&1 | tail -5`
Expected: FAIL（`Cannot find module '../scripts/abstract-graph.js'`）

- [ ] **Step 3: 写实现**

要点（完整实现按此规格）：

1. 常量：`CAPTIONS = { en: 'Graphical Abstract', 'zh-CN': '图示摘要' }`；`LAYOUTS = ['radial']`。
2. `validateSpec`：节点 3–7 个；`id` 非空且唯一；`label` 必填，长度上限 en 48 / 其他 20（码点），超限进 warnings；`links` 引用的 id 必须存在（否则 errors）；`layout` 非 `radial` 进 warnings。
3. `layoutRadial`：坐标空间 160 × 100（与 CSS `aspect-ratio: 16/10` 等比，避免 `preserveAspectRatio="none"` 导致箭头/描边拉伸）。中心 `(80, 50)`；卫星 i 的角度 `θ = -90° + i*360/n`，`x = 80 + 62*cos θ`，`y = 50 + 36*sin θ`；节点框按实测半宽估计（中心 20.8×7，卫星 16.8×6.5），连线两端用射线-盒交点裁到框外 +2 单位；关系标签放在连线中点、再沿垂直方向偏移 7 单位（实测调参：原 54 半径/无偏移会被节点框裁切）。`links` 额外连线，标签取弦中点。
4. `renderFigure`：输出
   `<figure class="ag" data-layout="radial" lang="{escapeHtml(lang)}"><div class="ag-canvas">` +
   `<svg class="ag-edges" viewBox="0 0 160 100" aria-hidden="true">`（含 `<defs><marker id="ag-arrow" markerWidth="2.4" markerHeight="2.4">`；箭头尺寸以 stroke-width 为单位，2.4 实测约 16px）+
   节点 `<div class="ag-node [ag-center]" style="--x:{x}%;--y:{y}%">`（`label` + 可选 `sub`）+
   边标签 `<span class="ag-edge-label" style="--x:..%;--y:..%">` +
   `</div><figcaption>{caption}</figcaption></figure>`；全部文本经 `escapeHtml`（含 lang 属性值）。
5. 过滤器（文件底部，Node 测试环境下跳过）：

```js
if (typeof hexo !== 'undefined' && hexo && hexo.extend) {
  hexo.extend.filter.register('after_render:html', function (str, locals) {
    const page = locals && locals.page;
    // 守卫是承重的：default-page.pug 也会输出 #article-container
    if (!page || page.layout !== 'post' || !page.abstract_graph) return str;
    const spec = page.abstract_graph;
    const lang = page.lang || this.config.language;
    const check = validateSpec(spec, lang);
    check.errors.forEach((e) => hexo.log.warn('[abstract-graph] %s: %s', page.slug, e));
    check.warnings.forEach((w) => hexo.log.warn('[abstract-graph] %s: %s', page.slug, w));
    if (check.errors.length) return str;
    const anchor =
      /(<article[^>]*id="article-container"[^>]*>\s*(?:<div id="post-outdate-notice"[\s\S]*?<\/div>)?)((?:\s*<blockquote>[\s\S]*?<\/blockquote>)*)/;
    if (!anchor.test(str)) return str;
    return str.replace(anchor, (m, a, b) => a + b + renderFigure(spec, lang));
  });
}
module.exports = { validateSpec, layoutRadial, renderFigure, escapeHtml, charLen };
```

6. 锚点语义（已实测，记录以免误改）：
   - 无前导 blockquote 的文章（如 teddy）→ 图直接接在 outdate 通知 div 之后；
   - 前导 blockquote 为 epigraph 而非提示块时，图同样插在其后（可接受）；
   - `page.content` 为空时不会匹配到 `<article>` 之外的区域，最差情况不注入；
   - index / 普通页面由 `layout !== 'post'` 挡住。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd ~/Desktop/blog && node --test test/ 2>&1 | tail -6`
Expected: `pass 5` / `fail 0`

- [ ] **Step 5: CI 加 test 步骤**

`.github/workflows/pages.yml` 在 `Install dependencies` 与 `Build site` 之间插入：

```yaml
- name: Test
  run: pnpm test
```

### Task 1.2: 样式

**Files:**

- Modify: `source/css/custom.css`（文件末尾追加一节）

- [ ] **Step 1: 追加样式**

要点：

- `.ag`：卡片式外框（沿用 `--art-border-light/dark`、`--art-card-*` 变量）、圆角 14px、上下留白 1.5rem/2rem。
- `.ag-canvas`：`position: relative; aspect-ratio: 16 / 10;`。
- `.ag-edges`：绝对铺满；`.ag-edges path { stroke: rgba(176,141,87,.55); fill: none; }`（暗色下 `.75`）。
- `.ag-node`：绝对定位 `left: var(--x); top: var(--y); transform: translate(-50%,-50%); width: 22%;`；背景用半透明墨色/宣纸色；`border: 1px solid rgba(176,141,87,.35)`；圆角 10px；内边距 .5rem .6rem；字号 `clamp(12px, 0.72rem + 0.2vw, 14px)`；行高 zh 1.55 / en 1.35（用 `.ag[lang^="zh"]` 区分）；`overflow-wrap: anywhere`。
- `.ag-center`：宽 26%；金色描边（`#b08d57`）；字号略大。
- `.ag-edge-label`：绝对定位到 `var(--x)/var(--y)`；`transform: translate(-50%,-50%)`；小号字 `.66rem`；`max-width: 12%` + 允许换行（长标签如 "compared systems" 会折行，避免被节点框裁切）；背景色遮住穿过的连线。
- `.ag figcaption`：居中、`.78rem`、金色、`letter-spacing: .08em`。
- `[data-theme='dark']` 变体：节点背景 `rgba(22,20,18,.88)`，文字 `#e8e0d2`。
- `@media (max-width: 768px)`：`.ag-canvas { aspect-ratio: auto; }`；`.ag-edges { display: none; }`；`.ag-node, .ag-center { position: static; width: auto; transform: none; margin: .4rem 0; }`；`.ag-edge-label { position: static; display: inline-block; max-width: none; }`（堆叠时标签成行内 chip，必须解除 12% 限宽，否则 CJK 标签会被拆行）；`.ag-link-label { display: none; }`。
- `@media print { .ag { break-inside: avoid; } }`。

- [ ] **Step 2: 构建并确认 CSS 进入产物**

Run: `cd ~/Desktop/blog && pnpm run build >/dev/null 2>&1 && grep -c '\.ag-canvas' public/css/custom.css`
Expected: ≥1

### Task 1.3: 试点数据（abe 中英 + teddy）

**Files:**

- Modify: `source/_posts/abe-kobo-box-man.md`（front-matter 追加）
- Modify: `source/_posts/abe-kobo-box-man.zh-CN.md`
- Modify: `source/_posts/teddy-paper.md`

**内容规则（逐篇核对原文；只用文章自身术语，不新增论断；标签 en ≤ 40 字符 / zh ≤ 16 字）：**

abe（en）草稿：

```yaml
abstract_graph:
  layout: radial
  center: 'Fiction as a time-space parallel to reality, capable of subverting it'
  nodes:
    - id: motif
      label: 'Metamorphosis motif'
      sub: 'traced from Crab Cactus (1949)'
      edge: 'genealogy'
    - id: face
      label: 'The face'
      sub: 'boundary of consciousness and reality'
      edge: 'key concept'
    - id: conversion
      label: 'Spirit conversion vs bodily transformation'
      edge: 'distinction'
    - id: structure
      label: '22 chapters + 2 clippings'
      sub: 'layered narrators, pseudo-identity'
      edge: 'structure'
    - id: forces
      label: 'Upward force / downward force'
      edge: 'dialectic'
```

abe（zh）草稿：

```yaml
abstract_graph:
  layout: radial
  center: '虚构：与现实并行、并孕育颠覆现实力量的时空'
  nodes:
    - id: motif
      label: '变形思想'
      sub: '溯源《蟹甲木》(1949)'
      edge: '溯源'
    - id: face
      label: '脸'
      sub: '意识与现实的边界'
      edge: '核心概念'
    - id: conversion
      label: '精神转换 ≠ 物理变形'
      edge: '区分'
    - id: structure
      label: '22 章 + 2 篇报道'
      sub: '叙述者与伪身份'
      edge: '结构'
    - id: forces
      label: '向上的力量 / 向下的力量'
      edge: '辩证法'
```

teddy（en）草稿（依 Results/Discussion 核对）：

```yaml
abstract_graph:
  layout: radial
  center: 'SMT and LLM translations differ systematically'
  nodes:
    - id: design
      label: 'Multi-genre source texts'
      sub: 'EN→ZH and ZH→EN'
      edge: 'design'
    - id: systems
      label: 'SMT + six LLMs'
      edge: 'compared systems'
    - id: features
      label: 'Lexical diversity, length, sentiment, stylometry'
      edge: 'features'
    - id: methods
      label: 'Mixed-effects models + SVM (98%)'
      edge: 'methods'
    - id: sttr
      label: 'STTR is the robust signature'
      sub: 'd = +2.83, β = +0.27'
      edge: 'finding'
    - id: fragility
      label: 'Effects vanish under source control'
      edge: 'caveat'
```

- [ ] **Step 1: 回填三处数据（先逐篇通读，按上述草稿核对/修正）**
- [ ] **Step 2: 构建，确认无校验告警、figure 出现**

Run:

```bash
cd ~/Desktop/blog && pnpm run clean && pnpm run build 2>&1 | grep -c 'abstract-graph'
grep -c 'figure class="ag"' public/2024/05/24/abe-kobo-box-man/index.html public/zh-CN/2024/05/24/abe-kobo-box-man/index.html public/2026/06/25/teddy-paper/index.html
```

Expected: 告警计数 0；三处各 1

### Task 1.4: 试点验证（构建断言 + 截图）

- [ ] **Step 1: 写截图脚本**

`~/Desktop/blog-work/shoot_ag.py`：复用 `shoot.py` 的服务方式（symlink `public` 到 `/tmp/bgserve/blog`、端口 8099、chromium-1228），对下列 12 张截图：
`abe-en` / `abe-zh` / `teddy-en` × 视口 1440×900、768×1024、390×844 × 主题 light/dark（按组合裁剪为 12–18 张），输出到 `~/Desktop/blog-work/shots/ag/`。

- [ ] **Step 2: 跑截图并检查**

Run: `python3 ~/Desktop/blog-work/shoot_ag.py`
Expected: 全部截图生成；脚本打印 console error 为空

- [ ] **Step 3: 人工核对**（标签换行、连线不穿字、移动端堆叠、暗色对比度）

### Task 1.5: 审查与评审包

- [ ] **Step 1: momus 审查**（计划改动全集：P0 四个脚本 + 渲染器 + CSS + 单测；重点：注入锚点鲁棒性、XSS 转义、CI 影响、边界）
- [ ] **Step 2: 修复审查发现项并复跑 Task 1.4 断言**
- [ ] **Step 3: 提交**：`feat(abstract-graph): add per-article graphical abstracts with language adaptation`
- [ ] **Step 4: 准备用户评审包**（截图 + 说明 + 待确认项），交用户评审后进入 Phase 2

---

## Phase 2：全量内容（用户评审试点后）

- [ ] 为其余 19 个 post 文件逐篇产出 `abstract_graph`（同 Task 1.3 规则；双语对两侧分别产出）
- [ ] 每批 4–6 篇：构建 → 校验告警清零 → 抽查 HTML
- [ ] 提交（每批一个 commit）

## Phase 3：收尾

- [ ] 全站验证：21/21 文章含图；两语言 URL 可访问；无 404 链接（抽查 AI 声明/配图/about）
- [ ] 更新 `README.md`（front-matter 新字段、脚本清单、特性列表）、`CONTEXT_FOR_NEXT_AGENT.md`（状态 + 遗留）
- [ ] push origin main → 等 CI → 线上核查（en/zh URL、图渲染、语言链接）
- [ ] 更新 `docs/plans/` 勾选状态与 `docs/abstract-graph.md`（可选）

---

## Self-Review（三查）

1. **Spec 覆盖**：需求「每篇文章图示化摘要 + 语言适配」→ Task 1.1–1.3 + Phase 2 覆盖；「调查/修复」→ Phase 0 覆盖。无缺口。
2. **占位符扫描**：无 TBD；Task 1.1 Step 3 为规格化描述（含完整接口与关键实现要点），Task 1.2 为样式规格——两处均给出可执行细节，非「适当处理」式空指令。
3. **类型一致性**：`validateSpec / layoutRadial / renderFigure / escapeHtml / charLen` 在测试与实现中同名同签名；`abstract_graph.{layout,center,nodes[],links[]}` 在数据、渲染器、校验器中一致。
