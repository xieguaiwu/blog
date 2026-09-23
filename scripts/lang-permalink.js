/**
 * 多语言文章 permalink：非默认语言加语言前缀。
 *
 * Hexo 8 由文件名推导 slug，故 "post.zh-CN.md" 的 permalink 为
 * "2024/05/24/post.zh-CN/"。本站约定：默认语言（en）留在根路径，
 * 其他语言前缀语言码，得 "zh-CN/2024/05/24/post/"。
 *
 * 注意：旧脚本（fix-lang-slug.js）把后缀直接剥掉，导致 en/zh 写同一路径、
 * 构建间语言随机翻转。设计与验证见 docs/plans/2026-09-23-abstract-graph.md。
 */
'use strict';

hexo.extend.filter.register('post_permalink', function (permalink) {
  if (typeof permalink !== 'string') return permalink;

  const config = this.config;
  const defaultLang = config.language;
  const langs = Array.isArray(config.languages) ? config.languages : [defaultLang];

  // 匹配末段路径的 ".{lang}/" 后缀（如 "2024/05/24/post.zh-CN/"）
  const match = permalink.match(/\.([a-z]{2}(?:-[A-Z]{2})?)\/$/);
  if (!match) return permalink;

  const lang = match[1];
  if (lang === defaultLang || !langs.includes(lang)) return permalink;

  return lang + '/' + permalink.replace(/\.([a-z]{2}(?:-[A-Z]{2})?)\/$/, '/');
});
