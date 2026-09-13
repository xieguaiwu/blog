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
      content: '目标和希望会枯萎，但人们自己不会。',
      source: null,
    },
    {
      content: 'The deepest and most organic death is death in solitude, when even light becomes a principle of death.',
      source: 'E.M. Cioran, *On the Heights of Despair*',
    },
    {
      content: 'Life is so astonishingly short. Now in memory it presses together so that I can scarcely comprehend how a young man can decide to ride to the next village without fearing that — quite apart from unhappy accidents — even the time of ordinary, happily passing life is far from sufficient for such a ride.',
      source: 'Franz Kafka, *The Next Village*',
    },
    {
      content: 'like a ritual dance around a center in which a mighty will stands paralyzed',
      source: 'Rainer Maria Rilke, *The Panther*',
    },
    {
      content: 'She kept talking. She told everyone. There was more to it, and she was trying to get it talked out. After a time, she quit trying.',
      source: 'Raymond Carver, *Why Don\'t You Dance?*',
    },
    {
      content: 'Overgrown fields in September — rice spikes branch and fork; / Low-flying fireflies trace the sloping path. / Through rock-veined water, drops onto sand; / Ghost-lights like lacquer dot the pine-bloom.',
      source: 'Li Hao, *Walking in the Southern Mountain Fields* (trans. xieguiawu)',
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
