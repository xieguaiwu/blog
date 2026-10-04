#!/usr/bin/env node
/**
 * post.mjs — 发帖工具：new（建草稿）/ check（校验）/ release（发布）。
 *
 * 约定来源：README §文章 front-matter、CONTEXT_FOR_NEXT_AGENT.md 配置要点。
 * - slug 由文件名推导（Hexo 8 忽略 front-matter slug 字段）。
 * - 双语对 = <slug>.md + <slug>.<lang>.md；非默认语言 URL 前缀由 scripts/lang-permalink.js 生成。
 * - front-matter 用 js-yaml@4 解析（与 hexo-front-matter 同主版本）；
 *   解析失败 = hexo 会静默丢弃 front-matter 的那类事故，本工具判 FAIL。
 * - abstract_graph 校验复用 scripts/abstract-graph.js 的 validateSpec（单一事实源）。
 *
 * 退出码：0 成功；1 校验/操作失败；2 用法错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const { validateSpec } = require('../scripts/abstract-graph.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'source');
const POSTS_DIR = path.join(SOURCE_DIR, '_posts');
const DRAFTS_DIR = path.join(SOURCE_DIR, '_drafts');
const CONFIG_FILE = path.join(ROOT, '_config.yml');

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
const ARTICLE_TYPES = [
  'Research Paper',
  'Literary Analysis',
  'Book Review',
  'Film Review',
  'Personal Essay',
  'Reference',
];
const DEFAULT_TAG_BY_TYPE = {
  'Research Paper': 'research-paper',
  'Literary Analysis': 'literary-analysis',
  'Book Review': 'book-review',
  'Film Review': 'film-review',
  'Personal Essay': 'essay',
  Reference: 'notes',
};
const COVER_RE = /^\/img\/bg\/art\/cover\/[A-D][0-9]+\.avif$/;

// ---------------------------------------------------------------- 纯函数

/** 解析文件名 → { base, lang }。语言后缀必须在 cfg.languages 内才被识别。 */
export function fileMeta(fileName, languages, defaultLang) {
  const base = String(fileName).replace(/\.md$/, '');
  for (const lang of languages) {
    if (lang === defaultLang) continue;
    const suffix = `.${lang}`;
    if (base.endsWith(suffix)) return { base: base.slice(0, -suffix.length), lang };
  }
  return { base, lang: defaultLang };
}

/** 英文标题 → ASCII kebab slug；无法生成（如纯中文）时返回空串。 */
export function kebabSlug(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 文章站内路径（根相对，交给 content-root.js 补 /blog/ 前缀）。 */
export function postPath(dateValue, slug, lang, site) {
  const wall = normalizeDate(dateValue);
  const day = wall.slice(0, 10).split('-');
  const prefix = lang !== site.defaultLang ? `${lang}/` : '';
  return `/${prefix}${day[0]}/${day[1]}/${day[2]}/${slug}/`;
}

/** 文章发布 URL（绝对地址，用于报告与提示）。 */
export function postUrl(dateValue, slug, lang, site) {
  return `${site.url}${postPath(dateValue, slug, lang, site)}`;
}

/** date 字段归一化为 "YYYY-MM-DD HH:MM:SS" 墙钟字符串。 */
export function normalizeDate(value) {
  if (value instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return (
      `${value.getUTCFullYear()}-${p(value.getUTCMonth() + 1)}-${p(value.getUTCDate())} ` +
      `${p(value.getUTCHours())}:${p(value.getUTCMinutes())}:${p(value.getUTCSeconds())}`
    );
  }
  return String(value).trim();
}

/** 解析单篇文章。返回 { data, body } 或 { error }。 */
export function parsePost(raw, label) {
  let text = String(raw);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { error: `${label}: 缺少 front-matter（--- 块）` };
  let data;
  try {
    data = yaml.load(m[1]);
  } catch (e) {
    return { error: `${label}: YAML 解析失败 — ${e.reason || e.message}` };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: `${label}: front-matter 不是键值对象` };
  }
  return { data, body: m[2] };
}

/**
 * 校验一篇文章。
 * @param {object} p
 * @param {object} p.data       front-matter
 * @param {string} p.body       正文
 * @param {string} p.fileName   文件名（含 .md）
 * @param {object} p.site       loadSite() 结果
 * @param {function} p.sourceHas  (root相对路径) => 文件是否存在于 source/
 * @param {function} p.siblingExists (其他语言文件名) => 是否存在
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validatePost({ data, body, fileName, site, sourceHas, siblingExists }) {
  const errors = [];
  const warnings = [];
  const meta = fileMeta(fileName, site.languages, site.defaultLang);

  // title
  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('title 缺失或为空');
  }

  // date
  if (data.date == null) {
    errors.push('date 缺失');
  } else {
    const wall = normalizeDate(data.date);
    if (!DATE_RE.test(wall)) errors.push(`date 格式无效: "${wall}"`);
  }

  // categories ∈ category_map
  const validCats = Object.keys(site.categoryMap);
  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    errors.push('categories 缺失或为空');
  } else {
    for (const c of data.categories) {
      if (!validCats.includes(c)) {
        errors.push(`category "${c}" 不在 category_map（可用: ${validCats.join(', ')}）`);
      }
    }
  }

  // tags
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    warnings.push('tags 缺失或为空');
  } else {
    for (const t of data.tags) {
      if (typeof t !== 'string' || !KEBAB_RE.test(t)) {
        warnings.push(`tag "${t}" 非小写连字符格式`);
      }
    }
  }

  // description
  if (typeof data.description !== 'string' || !data.description.trim()) {
    warnings.push('description 缺失（影响列表摘要与 SEO）');
  }

  // lang 与文件名一致
  const fileLang = meta.lang;
  if (data.lang == null) {
    warnings.push(`缺 lang（按文件名视为 ${fileLang}）`);
  } else if (data.lang !== fileLang) {
    errors.push(`lang "${data.lang}" 与文件名语言 "${fileLang}" 不一致`);
  }

  // cover
  if (data.cover != null) {
    if (typeof data.cover !== 'string' || !COVER_RE.test(data.cover)) {
      warnings.push(
        `cover 格式异常: ${JSON.stringify(data.cover)}（约定 /img/bg/art/cover/<名>.avif）`,
      );
    } else if (sourceHas && !sourceHas(data.cover)) {
      errors.push(`cover 文件不存在: source${data.cover}`);
    }
    if (data.cover_type !== 'img') warnings.push('有 cover 时应设 cover_type: img');
  }

  // 双语配对
  const siblings = site.languages
    .filter((l) => l !== site.defaultLang)
    .map((l) => (fileLang === site.defaultLang ? `${meta.base}.${l}.md` : `${meta.base}.md`));
  const hasSibling = siblings.some((n) => siblingExists && siblingExists(n));
  if (fileLang !== site.defaultLang && !hasSibling) {
    warnings.push(`中文变体缺英文对侧 ${meta.base}.md（语言切换链接将缺失）`);
  }
  if (hasSibling && fileLang === site.defaultLang && !/AI Translation Notice/.test(body)) {
    warnings.push('双语对的英文版缺 AI Translation Notice（若英文为原创可忽略）');
  }

  // Article Type 仅约束默认语言侧（zh 变体惯例不带）
  if (fileLang === site.defaultLang && !/> 📝 \*\*Article Type\*\*:/.test(body)) {
    warnings.push('缺 Article Type 标注（> 📝）');
  }
  if (/TODO: draft content/.test(body)) warnings.push('占位正文未替换（TODO: draft content）');

  // abstract_graph —— 复用构建期同一校验器
  if (data.abstract_graph != null) {
    try {
      const check = validateSpec(data.abstract_graph, fileLang);
      check.errors.forEach((e) => errors.push(`abstract_graph: ${e}`));
      check.warnings.forEach((w) => warnings.push(`abstract_graph: ${w}`));
    } catch (e) {
      errors.push(`abstract_graph 结构异常: ${e.message}`);
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------- 配置

/** 读取 _config.yml → site 上下文。解析失败抛错（check/new/release 均依赖）。 */
export function loadSite(file = CONFIG_FILE) {
  const cfg = yaml.load(fs.readFileSync(file, 'utf8'));
  if (!cfg || typeof cfg !== 'object') throw new Error('_config.yml 解析为空');
  if (!cfg.category_map || typeof cfg.category_map !== 'object') {
    throw new Error('_config.yml 缺 category_map');
  }
  return {
    url: String(cfg.url || '').replace(/\/+$/, ''),
    defaultLang: cfg.language || 'en',
    languages:
      Array.isArray(cfg.languages) && cfg.languages.length ? cfg.languages : [cfg.language || 'en'],
    categoryMap: cfg.category_map,
    permalink: cfg.permalink || ':year/:month/:day/:title/',
  };
}

// ---------------------------------------------------------------- 文章文件

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
}

/** 集合视图：posts + drafts 全部文件名（跨目录配对检测用）。 */
function allPostNames() {
  return new Set([...listMd(POSTS_DIR), ...listMd(DRAFTS_DIR)]);
}

function sourceHas(rootRel) {
  return fs.existsSync(path.join(SOURCE_DIR, String(rootRel).replace(/^\//, '')));
}

function buildContext(site, fileName) {
  const names = allPostNames();
  return {
    fileName,
    site,
    sourceHas,
    siblingExists: (n) => names.has(n),
  };
}

function checkOneFile(absPath, site) {
  const rel = path.relative(ROOT, absPath);
  const fileName = path.basename(absPath);
  const parsed = parsePost(fs.readFileSync(absPath, 'utf8'), rel);
  if (parsed.error) return { rel, errors: [parsed.error.replace(`${rel}: `, '')], warnings: [] };
  return { rel, ...validatePost({ ...parsed, ...buildContext(site, fileName) }) };
}

// ---------------------------------------------------------------- 模板

/** 生成文章文件全文（front-matter + body）。字符串一律 JSON.stringify 保证 YAML 合法。 */
export function buildPostFile({
  title,
  date,
  categories,
  tags,
  description,
  cover,
  lang,
  lang_alt,
  articleType,
  notice,
  zhPath,
}) {
  const lines = ['---', `title: ${JSON.stringify(title)}`, `date: ${JSON.stringify(date)}`];
  lines.push(`categories: [${categories.map((c) => JSON.stringify(c)).join(', ')}]`);
  if (tags && tags.length) lines.push(`tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`);
  if (description) lines.push(`description: ${JSON.stringify(description)}`);
  lines.push(`cover: ${cover}`, 'cover_type: img');
  lines.push(`lang: ${lang}`);
  if (lang_alt) lines.push(`lang_alt: ${lang_alt}`);
  lines.push('---', '');

  const body = [];
  if (notice) {
    body.push(
      `> 🤖 **AI Translation Notice**: This article was originally written in Chinese and translated to English by AI. The original Chinese version is available [here](${zhPath}). Some nuances may differ from human translation.`,
      '',
    );
  }
  body.push(
    `> 📝 **Article Type**: ${articleType}`,
    '',
    '<!-- 正文从此开始。 -->',
    '',
    'TODO: draft content.',
    '',
  );
  return lines.join('\n') + '\n' + body.join('\n');
}

// ---------------------------------------------------------------- 命令实现

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function usage() {
  console.log(
    [
      '用法: pnpm run post <命令> [参数]',
      '',
      '命令:',
      '  new      建草稿到 source/_drafts/',
      '    必填: --title <题> --category <分类[,分类]>',
      '    可选: --slug --tags <t1,t2> --desc <描述> --type <类型>',
      '           --cover <A1|/img/...> --date "YYYY-MM-DD HH:MM:SS"',
      '           --zh            同时建中文变体 <slug>.zh-CN.md',
      '           --title-zh <题> 中文标题（缺省同 --title）',
      '           --notice        英文版带 AI Translation Notice',
      '',
      '  check    校验 front-matter（缺省校验全部文章与草稿）',
      '    用法: check [文件...]',
      '',
      '  release  草稿转正并验证（test+build），打印发布 URL',
      '    用法: release <slug> [--push]   --push 才 git 提交推送',
      '',
      `Article Type 可选值: ${ARTICLE_TYPES.join(' / ')}`,
    ].join('\n'),
  );
  process.exit(2);
}

function parseArgs(argv) {
  const booleanFlags = new Set(['zh', 'notice', 'push', 'help']);
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (booleanFlags.has(key)) {
        opts[key] = true;
      } else {
        const val = argv[++i];
        if (val === undefined) usage();
        opts[key] = val;
      }
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

function nowInShanghai() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function cmdNew(opts) {
  const site = loadSite();
  if (!opts.title) fail('缺 --title');
  if (!opts.category) fail('缺 --category');

  const slug = opts.slug || kebabSlug(opts.title);
  if (!slug) fail('--title 无法生成 ASCII slug，请显式给 --slug');
  if (!KEBAB_RE.test(slug)) fail(`--slug 须为小写连字符格式: ${slug}`);

  const categories = String(opts.category)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const validCats = Object.keys(site.categoryMap);
  for (const c of categories) {
    if (!validCats.includes(c))
      fail(`category "${c}" 不在 category_map（可用: ${validCats.join(', ')}）`);
  }

  const type = opts.type || 'Personal Essay';
  if (!ARTICLE_TYPES.includes(type)) {
    fail(`--type 无效: ${type}（可用: ${ARTICLE_TYPES.join(' / ')}）`);
  }
  const tags = opts.tags
    ? String(opts.tags)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [DEFAULT_TAG_BY_TYPE[type]];
  for (const t of tags) {
    if (!KEBAB_RE.test(t)) fail(`tag "${t}" 须为小写连字符格式`);
  }

  const date = opts.date || nowInShanghai();
  if (!DATE_RE.test(date)) fail(`--date 格式无效: ${date}`);

  let cover = opts.cover || 'A1';
  if (!cover.startsWith('/')) cover = `/img/bg/art/cover/${cover}.avif`;
  if (!COVER_RE.test(cover)) fail(`cover 格式无效: ${cover}`);
  if (!sourceHas(cover)) fail(`cover 文件不存在: source${cover}`);

  const zhLang = site.languages.find((l) => l !== site.defaultLang);
  const wantZh = Boolean(opts.zh && zhLang);
  if (opts.notice && !wantZh) console.log('[WARN] --notice 需配合 --zh（需中文对侧 URL），已忽略');
  const enName = `${slug}.md`;
  const zhName = wantZh ? `${slug}.${zhLang}.md` : null;
  for (const n of [enName, zhName]) {
    if (!n) continue;
    if (fs.existsSync(path.join(POSTS_DIR, n)) || fs.existsSync(path.join(DRAFTS_DIR, n))) {
      fail(`文件已存在: ${n}（posts 或 drafts）`);
    }
  }

  const zhPath = postPath(date, slug, zhLang || site.defaultLang, site);
  const enFile = buildPostFile({
    title: opts.title,
    date,
    categories,
    tags,
    description: opts.desc,
    cover,
    lang: site.defaultLang,
    lang_alt: wantZh ? zhLang : null,
    articleType: type,
    notice: Boolean(opts.notice && wantZh),
    zhPath,
  });

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(DRAFTS_DIR, enName), enFile);
  console.log(`[OK] 建草稿 source/_drafts/${enName}`);

  if (wantZh) {
    const zhFile = buildPostFile({
      title: opts['title-zh'] || opts.title,
      date,
      categories,
      tags,
      description: undefined,
      cover,
      lang: zhLang,
      lang_alt: site.defaultLang,
      articleType: type,
      notice: false,
      zhPath,
    });
    fs.writeFileSync(path.join(DRAFTS_DIR, zhName), zhFile);
    console.log(`[OK] 建草稿 source/_drafts/${zhName}`);
  }

  console.log('[提示] 下一步: pnpm run post -- check  |  pnpm run post -- release ' + slug);
  console.log('[提示] 正文占位 TODO 需替换；abstract_graph 建议参照既有文章 front-matter 添加。');
}

function cmdCheck(opts) {
  const site = loadSite();
  let files;
  if (opts._.length) {
    files = opts._.map((f) => path.resolve(f));
  } else {
    files = [
      ...listMd(POSTS_DIR).map((f) => path.join(POSTS_DIR, f)),
      ...listMd(DRAFTS_DIR).map((f) => path.join(DRAFTS_DIR, f)),
    ];
  }
  if (!files.length) fail('没有可校验的文件');

  let errFiles = 0;
  let warnCount = 0;
  for (const abs of files) {
    if (!fs.existsSync(abs)) {
      console.log(`[FAIL] ${abs}\n  E: 文件不存在`);
      errFiles++;
      continue;
    }
    const r = checkOneFile(abs, site);
    const status = r.errors.length ? 'FAIL' : r.warnings.length ? 'WARN' : 'OK';
    console.log(`[${status}] ${r.rel}`);
    r.errors.forEach((e) => {
      console.log(`  E: ${e}`);
      errFiles++;
    });
    r.warnings.forEach((w) => console.log(`  W: ${w}`));
    warnCount += r.warnings.length;
  }
  console.log(`[摘要] 文件 ${files.length} · 错误 ${errFiles} · 警告 ${warnCount}`);
  process.exit(errFiles ? 1 : 0);
}

/** 回滚：把 moved 列表中的文件从 to（已转正位置）移回 from（草稿位置）。
 *  仅当 to 在、from 不在时执行，不覆盖任何一侧。 */
export function rollback(moved) {
  for (const { from, to } of moved) {
    if (fs.existsSync(to) && !fs.existsSync(from)) fs.renameSync(to, from);
  }
}

function runPnpm(args) {
  const r = spawnSync('pnpm', args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return r.status === 0;
}

function cmdRelease(opts) {
  const site = loadSite();
  const slug = opts._[0];
  if (!slug) {
    console.error('[FAIL] 用法: release <slug> [--push]');
    process.exit(2);
  }
  if (!KEBAB_RE.test(slug)) fail(`slug 须为小写连字符格式: ${slug}`);

  const names = site.languages.map((l) =>
    l === site.defaultLang ? `${slug}.md` : `${slug}.${l}.md`,
  );
  const draftPaths = names.map((n) => path.join(DRAFTS_DIR, n)).filter((p) => fs.existsSync(p));
  if (!draftPaths.length) {
    const avail = listMd(DRAFTS_DIR);
    fail(
      `_drafts 中没有 ${slug}.md${avail.length ? `（现有草稿: ${avail.join(', ')}）` : '（无草稿）'}`,
    );
  }

  // 预检：校验 + 目标不冲突，全部通过后才移动
  for (const p of draftPaths) {
    const r = checkOneFile(p, site);
    if (r.errors.length) {
      console.log(`[FAIL] ${r.rel}`);
      r.errors.forEach((e) => console.log(`  E: ${e}`));
      fail('草稿校验未通过，未做任何移动');
    }
    const target = path.join(POSTS_DIR, path.basename(p));
    if (fs.existsSync(target)) fail(`目标已存在: source/_posts/${path.basename(p)}`);
  }

  const moved = [];
  for (const p of draftPaths) {
    const target = path.join(POSTS_DIR, path.basename(p));
    fs.renameSync(p, target);
    moved.push({ from: p, to: target });
  }

  if (!runPnpm(['test'])) {
    rollback(moved);
    fail('pnpm test 未通过，草稿已回滚到 _drafts');
  }
  if (!runPnpm(['run', 'build'])) {
    rollback(moved);
    fail('pnpm build 未通过，草稿已回滚到 _drafts');
  }

  const rels = moved.map((m) => path.relative(ROOT, m.to));
  console.log(`[OK] 发布就绪: ${rels.join(' + ')}`);
  for (const m of moved) {
    const name = path.basename(m.to);
    const meta = fileMeta(name, site.languages, site.defaultLang);
    const parsed = parsePost(fs.readFileSync(m.to, 'utf8'), name);
    const date = parsed.data ? normalizeDate(parsed.data.date) : '';
    console.log(`  ${meta.lang}: ${postUrl(date, slug, meta.lang, site)}`);
  }
  if (site.permalink !== ':year/:month/:day/:title/') {
    console.log(`[WARN] permalink 非默认模式（${site.permalink}），以上 URL 为近似`);
  }

  if (opts.push) {
    const g1 = spawnSync('git', ['add', ...rels], { cwd: ROOT, stdio: 'inherit' });
    if (g1.status !== 0) fail('git add 失败，文件已转正但未提交（手动: git add + commit + push）');
    const g2 = spawnSync('git', ['commit', '-m', `content: publish ${slug}`], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (g2.status !== 0) fail('git commit 失败（手动: git commit + push）');
    const g3 = spawnSync('git', ['push', 'origin', 'main'], { cwd: ROOT, stdio: 'inherit' });
    if (g3.status !== 0) fail('git push 失败（手动: git push origin main）');
    console.log('[OK] 已推送。CI: gh run list --workflow=pages.yml');
  } else {
    console.log(`[提示] 未推送。确认后执行: git add ${rels.join(' ')} && git commit && git push`);
  }
}

// ---------------------------------------------------------------- 入口

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') usage();
  const opts = parseArgs(rest);
  if (opts.help) usage();
  switch (cmd) {
    case 'new':
      return cmdNew(opts);
    case 'check':
      return cmdCheck(opts);
    case 'release':
      return cmdRelease(opts);
    default:
      console.error(`[FAIL] 未知命令: ${cmd}`);
      usage();
  }
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) main(process.argv.slice(2));
