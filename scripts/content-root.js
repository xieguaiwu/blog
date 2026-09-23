/**
 * 给正文内的根绝对链接补 config.root。
 *
 * 正文链接不经过主题的 url_for()。本站部署在 /blog/ 子路径下，
 * 写成 "/zh-CN/..." 或 "/img/..." 会 404。本过滤器在渲染后补齐前缀。
 * 若将来站点改为主域名（root = /），本过滤器自动不生效。
 *
 * 跳过三类：协议相对地址（"//"）、已带 root 前缀的地址、<pre>/<code> 内的代码。
 */
'use strict';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteContent(html, root) {
  if (!html || !root || root === '/') return html;

  const bare = root.replace(/^\//, '').replace(/\/$/, ''); // "/blog/" → "blog"
  const skip = escapeRegExp(bare) + '(?:\\/|["\'\\s>]|$)';
  const re = new RegExp('(\\s(?:href|src)=)(["\'])/(?!\\/|' + skip + ')', 'g');

  // 保护代码块：按 <pre> / <code> 切分，只处理偶数段（非代码段）
  const parts = html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(re, (m, attr, quote) => attr + quote + root);
  }
  return parts.join('');
}

if (typeof hexo !== 'undefined' && hexo && hexo.extend) {
  hexo.extend.filter.register('after_post_render', function (data) {
    if (!data.content) return data;
    data.content = rewriteContent(data.content, this.config.root || '/');
    return data;
  });
}

module.exports = { rewriteContent };
