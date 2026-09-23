'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ag = require('../scripts/abstract-graph.js');

function spec(overrides) {
  return Object.assign(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    overrides,
  );
}

test('validateSpec accepts a well-formed spec', () => {
  const result = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A', edge: 'e1' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    'en',
  );
  assert.equal(result.errors.length, 0);
});

test('validateSpec rejects duplicate ids and bad links', () => {
  const result = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      links: [['a', 'zz', 'x']],
    },
    'en',
  );
  assert.ok(result.errors.some((item) => item.includes('duplicate')));
  assert.ok(result.errors.some((item) => item.includes('zz')));
});

test('validateSpec warns on overlong CJK label using code points', () => {
  const long = '很长的标签'.repeat(10); // 50 code points
  const result = ag.validateSpec(
    spec({
      nodes: [
        { id: 'a', label: long },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    }),
    'zh-CN',
  );
  assert.ok(result.warnings.some((item) => item.includes('label')));
});

test('validateSpec bounds node count and center presence', () => {
  const two = ag.validateSpec(
    {
      center: 'T',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    },
    'en',
  );
  assert.ok(two.errors.some((item) => item.includes('nodes')));

  const eight = ag.validateSpec(
    { center: 'T', nodes: Array.from({ length: 8 }, (_, i) => ({ id: 'n' + i, label: 'N' })) },
    'en',
  );
  assert.ok(eight.errors.some((item) => item.includes('nodes')));

  const noCenter = ag.validateSpec(
    {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    },
    'en',
  );
  assert.ok(noCenter.errors.some((item) => item.includes('center')));
});

test('validateSpec tolerates malformed links without crashing', () => {
  const ignored = ag.validateSpec(spec({ links: 'oops' }), 'en');
  assert.equal(ignored.errors.length, 0);
  assert.ok(ignored.warnings.some((item) => item.includes('links')));

  const bad = ag.validateSpec(spec({ links: [['a', 'b']] }), 'en');
  assert.ok(bad.errors.some((item) => item.includes('links')));
});

test('layoutRadial puts center in the middle and satellites around it', () => {
  const layout = ag.layoutRadial(spec());
  assert.equal(layout.nodes.length, 4);
  const center = layout.nodes.find((item) => item.isCenter);
  assert.equal(center.x, 80);
  assert.equal(center.y, 50);
  assert.equal(layout.edges.length, 3);
  for (const node of layout.nodes.filter((item) => !item.isCenter)) {
    assert.ok(node.x >= 0 && node.x <= 160);
    assert.ok(node.y >= 0 && node.y <= 100);
  }
});

test('layoutRadial emits link edges with 3-element arrays', () => {
  const layout = ag.layoutRadial(spec({ links: [['a', 'b', 'contrasts']] }));
  assert.equal(layout.edges.filter((edge) => edge.label === 'contrasts').length, 1);
  assert.ok(layout.edges.length >= 4);
});

test('renderFigure escapes HTML and marks language', () => {
  const html = ag.renderFigure(
    spec({
      center: '<T>',
      nodes: [
        { id: 'a', label: 'A & B' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    }),
    'zh-CN',
  );
  assert.ok(html.includes('&lt;T&gt;'));
  assert.ok(html.includes('&amp;'));
  assert.ok(html.includes('lang="zh-CN"'));
  assert.ok(html.includes('图示摘要'));
});

test('renderFigure emits edge labels and link labels', () => {
  const html = ag.renderFigure(
    spec({
      nodes: [
        { id: 'a', label: 'A', edge: 'supports' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      links: [['a', 'b', 'contrasts']],
    }),
    'en',
  );
  assert.ok(html.includes('supports'));
  assert.ok(html.includes('contrasts'));
  assert.ok(html.includes('ag-link-label'));
});

test('validateSpec warns when the center text is too long', () => {
  const result = ag.validateSpec(spec({ center: 'C'.repeat(61) }), 'en');
  assert.ok(result.warnings.some((item) => item.includes('center')));
});

test('charLen counts code points for CJK and emoji', () => {
  assert.equal(ag.charLen('你好'), 2);
  assert.equal(ag.charLen('a👍'), 2);
  assert.equal(ag.charLen('abc'), 3);
});

test('escapeHtml neutralises attribute-breaking characters', () => {
  const escaped = ag.escapeHtml('"><script>alert(1)</script>');
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&quot;'));
  assert.ok(escaped.includes('&lt;script&gt;'));
});

test('validateSpec rejects self links and the reserved center id', () => {
  const self = ag.validateSpec(spec({ links: [['a', 'a', 'x']] }), 'en');
  assert.ok(self.errors.some((item) => item.includes('itself')));

  const reserved = ag.validateSpec(
    spec({
      nodes: [
        { id: '__center__', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    }),
    'en',
  );
  assert.ok(reserved.errors.some((item) => item.includes('reserved')));

  const linkToCenter = ag.validateSpec(spec({ links: [['__center__', 'b', 'x']] }), 'en');
  assert.ok(linkToCenter.errors.some((item) => item.includes('unknown')));
});

test('validateSpec rejects non-string ids and survives null nodes', () => {
  const numeric = ag.validateSpec(
    spec({
      nodes: [
        { id: 1, label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    }),
    'en',
  );
  assert.ok(numeric.errors.some((item) => item.includes('string')));

  const withNull = ag.validateSpec(
    { center: 'T', nodes: [{ id: 'a', label: 'A' }, null, { id: 'c', label: 'C' }] },
    'en',
  );
  assert.ok(withNull.errors.length > 0);
  assert.equal(typeof withNull.errors[0], 'string');
});

test('layoutRadial tolerates malformed nodes and __proto__ ids', () => {
  const layout = ag.layoutRadial({
    center: 'T',
    nodes: [{ id: '__proto__', label: 'A' }, null, { id: 'c', label: 'C' }],
  });
  assert.ok(layout.nodes.length >= 2);
  for (const edge of layout.edges) {
    for (const value of [edge.x1, edge.y1, edge.x2, edge.y2, edge.lx, edge.ly]) {
      assert.ok(Number.isFinite(value), `non-finite coordinate in ${JSON.stringify(edge)}`);
    }
  }
});

test('renderFigure escapes sub, edge labels and the lang attribute', () => {
  const html = ag.renderFigure(
    spec({
      nodes: [
        { id: 'a', label: 'A', sub: '<sub>&', edge: '"quote"' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    }),
    'zh-CN" onload="x',
  );
  assert.ok(html.includes('&lt;sub&gt;&amp;'));
  assert.ok(html.includes('&quot;quote&quot;'));
  assert.ok(!html.includes('onload="x"'));
});

test('captionFor handles zh variants', () => {
  assert.equal(ag.captionFor('zh-CN'), '图示摘要');
  assert.equal(ag.captionFor('zh'), '图示摘要');
  assert.equal(ag.captionFor('en'), 'Graphical Abstract');
  assert.equal(ag.captionFor(undefined), 'Graphical Abstract');
});
