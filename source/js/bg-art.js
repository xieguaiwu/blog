/**
 * 艺术背景增强（bg-art.js）
 *
 * Butterfly 主题已在 layout.pug 里实现了「每次加载从 background 数组随机取一张」。
 * 本脚本只做两件主题不负责的事：
 *   1. 窄屏（<= 768px）切换到竖版变体（`-m`），避免宽幅拼贴被 cover 裁掉主体；
 *   2. 把本次选中的背景名写进 #web_bg 的 data 属性，便于排查。
 */
(function () {
  var NARROW = 768;
  var EXT = /\.(avif|jpe?g|webp|png)$/i;

  function mark() {
    var bg = document.getElementById('web_bg');
    if (!bg) return;

    var match = (bg.style.backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
    if (!match) return;

    var url = match[1];
    var wantMobile = window.innerWidth <= NARROW;
    var isMobile = /-m\.(avif|jpe?g|webp|png)$/i.test(url);

    if (wantMobile && !isMobile) {
      url = url.replace(EXT, '-m$&');
    } else if (!wantMobile && isMobile) {
      url = url.replace(/-m(\.(avif|jpe?g|webp|png))$/i, '$1');
    }

    bg.style.backgroundImage = 'url("' + url + '")';
    bg.dataset.bgArt = url.split('/').pop();
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(mark, 0);
  });

  var timer = null;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(mark, 200);
  });
})();
