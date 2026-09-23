/**
 * 多语言文章 permalink：非默认语言加语言前缀。
 *
 * Hexo 8 由文件名推导 slug，故 "post.zh-CN.md" 的 permalink 为
 * "2024/05/24/post.zh-CN/"。本站约定：默认语言（en）留在根路径，
 * 其他语言前缀语言码，得 "zh-CN/2024/05/24/post/"。
 *
 * 注意：旧脚本（fix-lang-slug.js）把后缀直接剥掉，导致 en/zh 写同一路径、
 * 构建间语言随机翻转。设计与验证见 docs/plans/2026-09-23-abstract-graph.md。
 *
 * 语言取自 config.languages；未登记的语言保持原样（宁可不加前缀，也不静默错配）。
 */
'use strict';

/**
 * 给非默认语言文章的 permalink 加语言前缀。
 * @param {string} permalink 形如 "2024/05/24/post.zh-CN/"
 * @param {string} defaultLang 默认语言（config.language）
 * @param {string[]} langs 站点语言列表（config.languages）
 */
function prefixLang(permalink, defaultLang, langs) {
  if (typeof permalink !== 'string') return permalink;
  const list = Array.isArray(langs) ? langs : [defaultLang];

  for (const lang of list) {
    if (!lang || lang === defaultLang) continue;
    const suffix = '.' + lang + '/';
    if (permalink.endsWith(suffix)) {
      return lang + '/' + permalink.slice(0, -suffix.length) + '/';
    }
  }

  return permalink;
}

if (typeof hexo !== 'undefined' && hexo && hexo.extend) {
  hexo.extend.filter.register('post_permalink', function (permalink) {
    return prefixLang(permalink, this.config.language, this.config.languages);
  });
}

module.exports = { prefixLang };
