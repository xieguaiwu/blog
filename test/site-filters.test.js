'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { prefixLang } = require('../scripts/lang-permalink.js');
const { rewriteContent } = require('../scripts/content-root.js');
const { setHtmlLang } = require('../scripts/html-lang.js');
const { stripLang, renderLangLink } = require('../scripts/lang-alt-link.js');

test('prefixLang adds the prefix for non-default languages only', () => {
  assert.equal(
    prefixLang('2024/05/24/post.zh-CN/', 'en', ['en', 'zh-CN']),
    'zh-CN/2024/05/24/post/',
  );
  assert.equal(prefixLang('2024/05/24/post/', 'en', ['en', 'zh-CN']), '2024/05/24/post/');
  // 未登记的语言保持原样（宁可不加前缀，也不静默错配）
  assert.equal(prefixLang('2024/05/24/post.ja/', 'en', ['en', 'zh-CN']), '2024/05/24/post.ja/');
  // 默认语言不加前缀
  assert.equal(prefixLang('2024/05/24/post.en/', 'en', ['en', 'zh-CN']), '2024/05/24/post.en/');
  assert.equal(prefixLang(null, 'en', ['en']), null);
});

test('rewriteContent prefixes bare root links only', () => {
  assert.equal(
    rewriteContent('<a href="/zh-CN/x/">x</a>', '/blog/'),
    '<a href="/blog/zh-CN/x/">x</a>',
  );
  assert.equal(rewriteContent('<img src="/img/a.png">', '/blog/'), '<img src="/blog/img/a.png">');
  // 已带 root 前缀：不动
  assert.equal(rewriteContent('<a href="/blog/x/">x</a>', '/blog/'), '<a href="/blog/x/">x</a>');
  assert.equal(rewriteContent('<a href="/blog">x</a>', '/blog/'), '<a href="/blog">x</a>');
  // 协议相对地址：不动
  assert.equal(rewriteContent('<a href="//cdn/x">x</a>', '/blog/'), '<a href="//cdn/x">x</a>');
  // 代码块内：不动
  assert.equal(rewriteContent('<code>href="/x"</code>', '/blog/'), '<code>href="/x"</code>');
  assert.equal(
    rewriteContent('<pre>src="/y"</pre><a href="/z">z</a>', '/blog/'),
    '<pre>src="/y"</pre><a href="/blog/z">z</a>',
  );
  // root = / 时整体不生效
  assert.equal(rewriteContent('<a href="/x">x</a>', '/'), '<a href="/x">x</a>');
});

test('setHtmlLang rewrites or adds the lang attribute', () => {
  assert.equal(
    setHtmlLang('<html lang="en" data-theme="light">', 'zh-CN'),
    '<html lang="zh-CN" data-theme="light">',
  );
  assert.equal(setHtmlLang('<html>', 'zh-CN'), '<html lang="zh-CN">');
  assert.equal(setHtmlLang('<html data-x="1">', 'zh-CN'), '<html lang="zh-CN" data-x="1">');
  assert.equal(setHtmlLang('<p>no html tag</p>', 'zh-CN'), '<p>no html tag</p>');
  // 不误伤 <htmlfoo>
  assert.equal(setHtmlLang('<htmlfoo>', 'zh-CN'), '<htmlfoo>');
});

test('stripLang pairs bilingual posts by filename slug', () => {
  assert.equal(stripLang('post.zh-CN', 'zh-CN'), 'post');
  assert.equal(stripLang('post', 'en'), 'post');
  assert.equal(stripLang('post.zh-CN.zh-CN', 'zh-CN'), 'post.zh-CN');
});

test('renderLangLink encodes the href and escapes both fields', () => {
  const ok = renderLangLink('中文版', '/blog/zh-CN/a b/');
  assert.ok(ok.includes('href="/blog/zh-CN/a%20b/"'));
  assert.ok(ok.includes('>中文版</a>'));

  const evil = renderLangLink('<script>', '"/><script>');
  assert.ok(!evil.includes('<script>'));
  assert.ok(!evil.includes('"/><'));
});
