/**
 * Fix permalink for multi-language posts (.zh-CN.md).
 *
 * Hexo 8's post processor derives slug from filename, so "post.zh-CN.md"
 * gets slug "post.zh-CN" and permalink "/yyyy/mm/dd/post.zh-CN/".
 * This filter strips the ".{lang}" suffix from the permalink for
 * non-default language posts, producing "/yyyy/mm/dd/post/".
 */
hexo.extend.filter.register('post_permalink', function(permalink) {
  if (typeof permalink !== 'string') return permalink;

  const hexoLang = this.config.language;
  // Match a trailing .{lang} segment in the last path component
  // e.g. "/2024/12/01/post.zh-CN/" → "/2024/12/01/post/"
  const langSuffixPattern = /\.([a-z]{2}(?:-[A-Z]{2})?)\/$/;
  const match = permalink.match(langSuffixPattern);

  if (match && match[1] !== hexoLang) {
    return permalink.replace(langSuffixPattern, '/');
  }

  return permalink;
});
