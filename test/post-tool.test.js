'use strict';
// tools/post.mjs 的单元测试（node --test）。断言均为真实失败/成功路径。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let cached;
async function tool() {
  if (!cached) cached = await import('../tools/post.mjs');
  return cached;
}

const SITE = {
  url: 'https://xieguaiwu.github.io/blog',
  defaultLang: 'en',
  languages: ['en', 'zh-CN'],
  categoryMap: { Aesthetics: 'aesthetics', Logic: 'logic' },
  permalink: ':year/:month/:day/:title/',
};

function validData(overrides = {}) {
  return {
    title: 'Sample Post',
    date: '2026-10-04 12:00:00',
    categories: ['Aesthetics'],
    tags: ['art'],
    description: 'A sample description.',
    cover: '/img/bg/art/cover/A1.avif',
    cover_type: 'img',
    lang: 'en',
    ...overrides,
  };
}

function validate(data, body, fileName, opts = {}) {
  return tool().then((t) =>
    t.validatePost({
      data,
      body,
      fileName,
      site: SITE,
      sourceHas: opts.sourceHas || (() => true),
      siblingExists: opts.siblingExists || (() => false),
    }),
  );
}

const GOOD_BODY = '> 📝 **Article Type**: Essay\n\nReal content.';

test('parsePost 解析合法 front-matter', async () => {
  const t = await tool();
  const r = t.parsePost('---\ntitle: "Hi"\ndate: 2026-01-01 10:00:00\n---\nbody', 'x.md');
  assert.equal(r.error, undefined);
  assert.equal(r.data.title, 'Hi');
  assert.equal(r.body, 'body');
});

test('parsePost 对 YAML 语法错误返回 error（hexo 会静默丢弃的那类事故）', async () => {
  const t = await tool();
  const bad = '---\ntitle: "unclosed\ndate: 2026-01-01\n---\nbody';
  const r = t.parsePost(bad, 'bad.md');
  assert.match(r.error, /YAML 解析失败/);
  assert.equal(r.data, undefined);
});

test('parsePost 缺 front-matter 块返回 error', async () => {
  const t = await tool();
  const r = t.parsePost('no front matter here', 'n.md');
  assert.match(r.error, /缺少 front-matter/);
});

test('fileMeta：无后缀=en；.zh-CN 后缀识别；非登记语言不当后缀', async () => {
  const t = await tool();
  assert.deepEqual(t.fileMeta('foo.md', ['en', 'zh-CN'], 'en'), { base: 'foo', lang: 'en' });
  assert.deepEqual(t.fileMeta('foo.zh-CN.md', ['en', 'zh-CN'], 'en'), {
    base: 'foo',
    lang: 'zh-CN',
  });
  // .de 不在 languages 内 → 视为文件名一部分
  assert.deepEqual(t.fileMeta('foo.de.md', ['en', 'zh-CN'], 'en'), { base: 'foo.de', lang: 'en' });
});

test('kebabSlug：ASCII 与变音符归一；纯中文返回空串', async () => {
  const t = await tool();
  assert.equal(t.kebabSlug('H1 Revival Judgment'), 'h1-revival-judgment');
  assert.equal(t.kebabSlug('Abe Kōbō’s The Box Man!'), 'abe-kobo-s-the-box-man');
  assert.equal(t.kebabSlug('中文标题'), '');
});

test('normalizeDate：Date 取墙钟分量，字符串原样', async () => {
  const t = await tool();
  const d = new Date(Date.UTC(2026, 9, 4, 12, 0, 0));
  assert.equal(t.normalizeDate(d), '2026-10-04 12:00:00');
  assert.equal(t.normalizeDate('2024-05-24 17:09:03'), '2024-05-24 17:09:03');
});

test('postUrl：en 走根路径，zh-CN 加前缀', async () => {
  const t = await tool();
  assert.equal(
    t.postUrl('2026-10-04 12:00:00', 'my-post', 'en', SITE),
    'https://xieguaiwu.github.io/blog/2026/10/04/my-post/',
  );
  assert.equal(
    t.postUrl('2026-10-04 12:00:00', 'my-post', 'zh-CN', SITE),
    'https://xieguaiwu.github.io/blog/zh-CN/2026/10/04/my-post/',
  );
});

test('validatePost：全合规 → 零错误零警告', async () => {
  const r = await validate(validData(), GOOD_BODY, 'sample.md');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validatePost：坏 category 报错并列出可用值', async () => {
  const r = await validate(validData({ categories: ['Nope'] }), GOOD_BODY, 'sample.md');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /category_map/);
  assert.match(r.errors[0], /Aesthetics/);
});

test('validatePost：缺 title / 坏 date 均报错', async () => {
  const r1 = await validate(validData({ title: '  ' }), GOOD_BODY, 'sample.md');
  assert.ok(r1.errors.some((e) => /title/.test(e)));
  const r2 = await validate(validData({ date: 'not-a-date' }), GOOD_BODY, 'sample.md');
  assert.ok(r2.errors.some((e) => /date 格式无效/.test(e)));
});

test('validatePost：cover 文件不存在报错', async () => {
  const r = await validate(validData(), GOOD_BODY, 'sample.md', { sourceHas: () => false });
  assert.ok(r.errors.some((e) => /cover 文件不存在/.test(e)));
});

test('validatePost：lang 与文件名不一致报错', async () => {
  const r = await validate(validData({ lang: 'zh-CN' }), GOOD_BODY, 'sample.md');
  assert.ok(r.errors.some((e) => /与文件名语言/.test(e)));
});

test('validatePost：坏 tags / 缺 description 降为警告', async () => {
  const r = await validate(
    validData({ tags: ['My Tag'], description: undefined }),
    GOOD_BODY,
    'sample.md',
  );
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /tag "My Tag"/.test(w)));
  assert.ok(r.warnings.some((w) => /description/.test(w)));
});

test('validatePost：abstract_graph 结构非法报错（复用 validateSpec）', async () => {
  const r = await validate(
    validData({
      abstract_graph: {
        center: 'c',
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      },
    }),
    GOOD_BODY,
    'sample.md',
  );
  assert.ok(r.errors.some((e) => /abstract_graph/.test(e)));
  assert.match(
    r.errors.find((e) => /abstract_graph/.test(e)),
    /3 to 7/,
  );
});

test('validatePost：双语对英文版缺翻译声明 → 警告；占位正文 → 警告', async () => {
  const r = await validate(
    validData(),
    '> 📝 **Article Type**: Essay\n\nTODO: draft content.',
    'sample.md',
    {
      siblingExists: (n) => n === 'sample.zh-CN.md',
    },
  );
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /AI Translation Notice/.test(w)));
  assert.ok(r.warnings.some((w) => /占位正文/.test(w)));
});

test('validatePost：zh 变体缺英文对侧 → 警告；zh 侧不检查 Article Type', async () => {
  const zhBody = '中文正文，无 Article Type 标注。';
  const r = await validate(validData({ lang: 'zh-CN' }), zhBody, 'sample.zh-CN.md');
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /缺英文对侧/.test(w)));
  assert.ok(!r.warnings.some((w) => /Article Type/.test(w)));
});

test('buildPostFile 往返：产物可被 parsePost 解析且通过完整校验', async () => {
  const t = await tool();
  const file = t.buildPostFile({
    title: 'T: with colon & "quotes"',
    date: '2026-10-04 15:00:00',
    categories: ['Logic'],
    tags: ['essay'],
    description: 'Desc: 含冒号与 "引号"。',
    cover: '/img/bg/art/cover/A1.avif',
    lang: 'en',
    lang_alt: 'zh-CN',
    articleType: 'Personal Essay',
    notice: true,
    zhPath: '/zh-CN/2026/10/04/t-with-colon-quotes/',
  });
  const parsed = t.parsePost(file, 'generated.md');
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.data.title, 'T: with colon & "quotes"');
  assert.equal(parsed.data.date, '2026-10-04 15:00:00');
  assert.deepEqual(parsed.data.categories, ['Logic']);
  assert.match(parsed.body, /AI Translation Notice/);
  // notice 链接必须是根相对路径（存量 7 篇风格；绝对地址会在本地预览跳去线上站）
  assert.match(parsed.body, /\[here\]\(\/zh-CN\/2026\/10\/04\/t-with-colon-quotes\/\)/);
  const r = t.validatePost({
    ...parsed,
    fileName: 't-with-colon-quotes.md',
    site: SITE,
    sourceHas: () => true,
    siblingExists: () => false, // 占位草稿阶段对侧尚未创建
  });
  assert.deepEqual(r.errors, []);
  // 占位正文必须触发警告（防止未改正文就发布）
  assert.ok(r.warnings.some((w) => /占位正文/.test(w)));
});

test('loadSite：真实 _config.yml 可解析且契约字段齐全', async () => {
  const t = await tool();
  const site = t.loadSite();
  assert.ok(Object.keys(site.categoryMap).length >= 14, 'category_map 至少 14 类');
  assert.ok('Aesthetics' in site.categoryMap && 'Film and Media Studies' in site.categoryMap);
  assert.deepEqual(site.languages, ['en', 'zh-CN']);
  assert.equal(site.defaultLang, 'en');
  assert.match(site.url, /\/blog$/);
  assert.equal(site.permalink, ':year/:month/:day/:title/');
});

test('真实存量文章全量校验：错误仅允许已知的 Philosophy of Language 一条', async () => {
  const t = await tool();
  const site = t.loadSite();
  const postsDir = path.join(__dirname, '..', 'source', '_posts');
  const names = new Set(fs.readdirSync(postsDir).filter((f) => f.endsWith('.md')));
  const errors = [];
  for (const name of names) {
    const parsed = t.parsePost(fs.readFileSync(path.join(postsDir, name), 'utf8'), name);
    if (parsed.error) {
      errors.push(`${name}: ${parsed.error}`);
      continue;
    }
    const r = t.validatePost({
      ...parsed,
      fileName: name,
      site,
      sourceHas: (p) =>
        fs.existsSync(path.join(__dirname, '..', 'source', String(p).replace(/^\//, ''))),
      siblingExists: (n) => names.has(n),
    });
    r.errors.forEach((e) => errors.push(`${name}: ${e}`));
  }
  // 存量错误钉在已知的 1 条分类漂移上：
  // 修复后 errors 变空 → 通过；出现任何新错误 → 失败。
  assert.ok(errors.length <= 1, `预期 ≤1 条存量错误，实际 ${errors.length}: ${errors.join(' | ')}`);
  if (errors.length === 1) {
    assert.match(errors[0], /Philosophy of Language/);
  }
});

test('rollback：验证失败后草稿原样移回（发布安全网）', async () => {
  const t = await tool();
  const fs2 = require('node:fs');
  const os = require('node:os');
  const dir = fs2.mkdtempSync(path.join(os.tmpdir(), 'post-tool-rollback-'));
  const draft = path.join(dir, 'a.md');
  const target = path.join(dir, 'b.md');
  fs2.writeFileSync(draft, 'x');
  fs2.renameSync(draft, target); // 模拟 release 已移动
  t.rollback([{ from: draft, to: target }]);
  assert.equal(fs2.existsSync(target), false, '目标位置应已清空');
  assert.equal(fs2.readFileSync(draft, 'utf8'), 'x', '文件应回到原位置且内容不变');
  fs2.rmSync(dir, { recursive: true, force: true });
});

test('rollback：目标已存在时不覆盖（防误伤）', async () => {
  const t = await tool();
  const fs2 = require('node:fs');
  const os = require('node:os');
  const dir = fs2.mkdtempSync(path.join(os.tmpdir(), 'post-tool-rollback2-'));
  const from = path.join(dir, 'from.md');
  const to = path.join(dir, 'to.md');
  fs2.writeFileSync(from, 'draft-side');
  fs2.writeFileSync(to, 'posts-side');
  t.rollback([{ from, to }]);
  assert.equal(fs2.readFileSync(to, 'utf8'), 'posts-side', 'posts 侧已存在时不得被覆盖');
  assert.equal(fs2.readFileSync(from, 'utf8'), 'draft-side', 'draft 侧文件保持原样');
  fs2.rmSync(dir, { recursive: true, force: true });
});
