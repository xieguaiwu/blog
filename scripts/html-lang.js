/**
 * 按页面语言改写 <html lang>。
 *
 * 主题固定用 config.language（en），中文页面会被标成 lang="en"，
 * 影响可访问性与 SEO。本过滤器按 page.lang 改写；缺属性时补上。
 */
'use strict';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setHtmlLang(html, lang) {
  if (!html || !lang || typeof html !== 'string') return html;
  const safe = escapeAttr(lang);

  return html.replace(/<html(?:\s[^>]*)?>/, function (tag) {
    if (/\slang=/.test(tag)) {
      return tag.replace(/\slang=("[^"]*"|'[^']*')/, ' lang="' + safe + '"');
    }
    return tag.replace('<html', '<html lang="' + safe + '"');
  });
}

if (typeof hexo !== 'undefined' && hexo && hexo.extend) {
  hexo.extend.filter.register('after_render:html', function (str, locals) {
    const lang = locals && locals.page && locals.page.lang;
    return setHtmlLang(str, lang);
  });
}

module.exports = { setHtmlLang, escapeAttr };
