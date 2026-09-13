(function () {
  const WEBSITE_BIRTH_TIME = new Date('2026-9-13 00:00');

  /**
   * 计算指定时刻到现在的时间间隔，并格式化成字符串
   * @param time {Date} 起始时刻
   * @returns {string} 格式化的字符串
   */
  function getFormattedInterval(time) {
    // 计算各单位上的数字
    let intervalSeconds = Math.floor((new Date() - time) / 1000);
    let years = Math.floor(intervalSeconds / 31536000);
    let days = Math.floor((intervalSeconds / 86400) % 365);
    let hours = Math.floor((intervalSeconds / 3600) % 24);
    let minutes = Math.floor((intervalSeconds / 60) % 60);
    let seconds = Math.floor(intervalSeconds % 60);

    // 在时分秒前补 0
    hours = hours.toString().padStart(2, '0');
    minutes = minutes.toString().padStart(2, '0');
    seconds = seconds.toString().padStart(2, '0');

    // 格式化成时间字符串
    let result = `${days} 天 ${hours}:${minutes}:${seconds}`;
    if (years > 0) {
      result = `${years} 年 ` + result;
    }

    return result;
  }

  // 在页脚插入需要的元素
  document.getElementsByClassName('footer-other')[0].innerHTML +=
    '<div>本站已运行 <span id="website-runtime"></span></div>' +
    '"The deepest and most organic death is death in solitude, when even light becomes a principle of death." — E.M. Cioran' +
    '<div style="margin-top:0.3rem;font-size:0.75rem;color:#666;">Inspired by <a href="https://zhdbk3.github.io/" style="color:#B08D57;" target="_blank" rel="noopener">zhdbk3</a> &middot; Framework &amp; configuration reference</div>';

  // 每秒刷新
  setInterval(() => {
    document.getElementById('website-runtime').innerText = getFormattedInterval(WEBSITE_BIRTH_TIME);
  }, 1000);
})();
