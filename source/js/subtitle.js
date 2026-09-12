/**
 * 首页副标题（subtitle.js）
 *
 * 每次加载随机取一句。想换词直接改下面这个数组即可；
 * source 为 null 时不显示出处。
 */
(function () {
  const subtitleList = [
    {
      content: '每一幅画里，都有一场无人送行的葬礼。',
      source: null,
    },
    {
      content: '生如夏花之绚烂，死如秋叶之静美。',
      source: '泰戈尔《飞鸟集》',
    },
    {
      content: '美即是永恒的喜悦。',
      source: '济慈《恩底弥翁》',
    },
    {
      content: '人生如逆旅，我亦是行人。',
      source: '苏轼《临江仙·送钱穆父》',
    },
    {
      content: '死去何所道，托体同山阿。',
      source: '陶渊明《拟挽歌辞》',
    },
    {
      content: '我们都身处阴沟，但仍有人仰望星空。',
      source: '王尔德《温德米尔夫人的扇子》',
    },
    {
      content: '此情可待成追忆，只是当时已惘然。',
      source: '李商隐《锦瑟》',
    },
    {
      content: '所谓经典，就是每次重看都换了一副面孔的画。',
      source: null,
    },
    {
      content: '黑暗也是一种颜色，最古老的那一种。',
      source: null,
    },
    {
      content: '艺术所做的，不过是让时间在画布上停住一会儿。',
      source: null,
    },
  ];

  const picked = subtitleList[Math.floor(Math.random() * subtitleList.length)];

  let html = `<p>${picked.content}</p>`.replace('\n', '</p><p>');
  if (picked.source !== null) {
    html += `<p style="text-align: right; margin-right: 1em">——${picked.source}</p>`;
  }
  html = `<i>${html}</i>`;

  const siteSubtitleDiv = document.getElementById('site-subtitle');
  if (siteSubtitleDiv !== null) {
    siteSubtitleDiv.innerHTML = html;
  }
})();
