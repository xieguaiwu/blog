/**
 * 文章页语言切换链接：按 base slug + lang 配对查找对侧文章。
 *
 * 注入位置：正文前导提示 blockquote 之后（与图示摘要同锚点）。
 * 优先级 11：晚于 abstract-graph（默认 10），保证链接排在图示摘要之前。
 */
'use strict';

const LABELS = { 'zh-CN': '中文版', en: 'English version' };

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripLang(slug, lang) {
  const suffix = '.' + lang;
  return String(slug).endsWith(suffix) ? String(slug).slice(0, -suffix.length) : String(slug);
}

function renderLangLink(label, href) {
  return (
    '<p class="lang-alt"><i class="fas fa-language"></i> ' +
    '<a href="' +
    escapeHtml(encodeURI(href)) +
    '">' +
    escapeHtml(label) +
    '</a></p>'
  );
}

if (typeof hexo !== 'undefined' && hexo && hexo.extend) {
  hexo.extend.filter.register(
    'after_render:html',
    function (str, locals) {
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
      const html = renderLangLink(label, this.config.root + counterpart.path);

      const anchor =
        /(<article[^>]*id="article-container"[^>]*>\s*(?:<div id="post-outdate-notice"[^>]*><\/div>)?)((?:\s*<blockquote>[\s\S]*?<\/blockquote>)*)/;
      if (!anchor.test(str)) return str;
      // 函数式替换：避免标签文本中的 $& / $1 被展开
      return str.replace(anchor, (m, a, b) => a + b + html);
    },
    11,
  );
}

module.exports = { stripLang, renderLangLink };
