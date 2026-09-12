/**
 * 让 Butterfly 的 inject 资源在子目录部署下也能加载。
 *
 * 背景：主题的 `inject.head` / `inject.bottom` 是原样输出的 HTML 字符串，
 * 不经过 Hexo 的 `url_for()`。本站部署在子路径（url 为
 * https://xieguaiwu.github.io/blog，故 root = /blog/）下，
 * 写成 "/css/custom.css" 这样的根绝对路径会 404。
 *
 * 做法：生成前把 inject 里的根绝对路径补上 config.root。
 * 若将来改成用户主页（root = /），本过滤器自动不生效。
 */
hexo.extend.filter.register('before_generate', function () {
  var root = hexo.config.root || '/'
  if (root === '/') return

  var theme = hexo.theme.config
  if (!theme || !theme.inject) return

  // 只改写 href="/x" 与 src="/x"，跳过 "//" 开头的协议相对地址
  function fix(html) {
    if (typeof html !== 'string') return html
    return html.replace(/(\s(?:href|src)=)(["'])\/(?!\/)/g, '$1$2' + root)
  }

  function fixAll(group) {
    if (Array.isArray(group)) return group.map(fix)
    return fix(group)
  }

  theme.inject.head = fixAll(theme.inject.head)
  theme.inject.bottom = fixAll(theme.inject.bottom)
})
