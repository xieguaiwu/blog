/**
 * 首页副标题（subtitle.js）
 *
 * 每次加载随机取一句。想换词直接改下面这个数组即可；
 * source 为 null 时不显示出处。
 */
(function () {
  const subtitleList = [
    {
      content: 'Every portrait that is painted with feeling is a portrait of the artist, not of the sitter.',
      source: 'Oscar Wilde',
    },
    {
      content: 'The world breaks everyone and afterward many are strong at the broken places.',
      source: 'Ernest Hemingway, *A Farewell to Arms*',
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
      content: 'A classic is a book that has never finished saying what it has to say.',
      source: 'Italo Calvino, *Why Read the Classics?*',
    },
    {
      content: 'Color is the place where our brain and the universe meet.',
      source: 'Paul Cézanne',
    },
    {
      content: 'The aim of every artist is to arrest motion, which is life, by artificial means and hold it fixed.',
      source: 'William Faulkner',
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
