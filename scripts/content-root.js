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
