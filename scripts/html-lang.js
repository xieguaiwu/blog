/**
 * 按页面语言改写 <html lang>。
 *
 * 主题固定用 config.language（en），中文页面会被标成 lang="en"，
 * 影响可访问性与 SEO。本过滤器按 page.lang 改写。
 */
'use strict';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

hexo.extend.filter.register('after_render:html', function (str, locals) {
  const lang = locals && locals.page && locals.page.lang;
  if (!lang || typeof str !== 'string') return str;
  return str.replace(/<html[^>]*>/, function (tag) {
    return tag.replace(/\slang="[^"]*"/, ' lang="' + escapeAttr(lang) + '"');
  });
});
