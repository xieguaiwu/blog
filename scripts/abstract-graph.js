/**
 * Abstract Graph — 每篇文章的简明图示化摘要（图示摘要 / Graphical Abstract）。
 *
 * 数据来源：文章 front-matter 的 `abstract_graph` 字段（逐语言随文）。
 * 渲染：构建期产出内联 HTML + SVG，零客户端 JS；注入点在文章容器内、
 * 前导提示 blockquote 之后（与 scripts/lang-alt-link.js 同锚点）。
 *
 * 坐标空间：画布 160 × 100（与 CSS 的 aspect-ratio: 16 / 10 一致），
 * 等比缩放，故连线、箭头形状不失真。节点用百分比定位（HTML），
 * 连线用 SVG，关系标签用 HTML（可换行、可继承站内字体）。
 *
 * 设计与验证见 docs/plans/2026-09-23-abstract-graph.md。
 */
'use strict';

const CAPTIONS = {
  en: 'Graphical Abstract',
  'zh-CN': '图示摘要',
};

const LIMITS = {
  en: { center: 60, label: 48, sub: 64, edge: 20 },
  zh: { center: 24, label: 20, sub: 26, edge: 10 },
};

// 画布坐标（160 × 100）
const CANVAS = { w: 160, h: 100 };
const CENTER = { x: 80, y: 50 };
// 半径取自实测：节点半宽 16.8（21%）、中心半宽 20.8（26%），
// 需给关系标签留出 ~16 单位的横向净空
const RADIUS = { x: 62, y: 36 };
const BOX = {
  center: { hw: 20.8, hh: 7 },
  node: { hw: 16.8, hh: 6.5 },
};
const LABEL_OFFSET = 7; // 关系标签垂直于连线的偏移量

const CENTER_ID = '__center__';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 码点计数（质量关卡 12：中文标签不能用 .length 判断）。 */
function charLen(value) {
  return [...String(value)].length;
}

function limitsFor(lang) {
  return String(lang || '').startsWith('zh') ? LIMITS.zh : LIMITS.en;
}

function captionFor(lang) {
  return String(lang || '').startsWith('zh') ? CAPTIONS['zh-CN'] : CAPTIONS.en;
}

/**
 * 校验图数据。返回 { errors, warnings }；errors 非空时不渲染。
 */
function validateSpec(spec, lang) {
  const errors = [];
  const warnings = [];

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { errors: ['abstract_graph must be a mapping'], warnings };
  }
  if (!spec.center || !String(spec.center).trim()) {
    errors.push('center is required');
  } else if (charLen(spec.center) > limitsFor(lang).center) {
    warnings.push(`center is ${charLen(spec.center)} chars (limit ${limitsFor(lang).center})`);
  }
  if (spec.layout && spec.layout !== 'radial') {
    warnings.push(`unknown layout "${spec.layout}"; falling back to radial`);
  }

  const nodes = spec.nodes;
  if (!Array.isArray(nodes) || nodes.length < 3 || nodes.length > 7) {
    errors.push('nodes must be an array of 3 to 7 items');
  } else {
    const seen = new Set();
    const limits = limitsFor(lang);
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        errors.push('each node must be a mapping');
        continue;
      }
      if (!node.id) {
        errors.push('node id is required');
      } else if (typeof node.id !== 'string') {
        errors.push(`node id must be a string (got ${typeof node.id})`);
      } else if (node.id === CENTER_ID) {
        errors.push(`node id "${CENTER_ID}" is reserved`);
      } else if (seen.has(node.id)) {
        errors.push(`duplicate node id "${node.id}"`);
      } else {
        seen.add(node.id);
      }
      if (!node.label) {
        errors.push(`node "${node.id || '?'}" label is required`);
      } else if (charLen(node.label) > limits.label) {
        warnings.push(
          `node "${node.id}" label is ${charLen(node.label)} chars (limit ${limits.label})`,
        );
      }
      if (node.sub && charLen(node.sub) > limits.sub) {
        warnings.push(`node "${node.id}" sub is ${charLen(node.sub)} chars (limit ${limits.sub})`);
      }
      if (node.edge && charLen(node.edge) > limits.edge) {
        warnings.push(
          `node "${node.id}" edge label is ${charLen(node.edge)} chars (limit ${limits.edge})`,
        );
      }
    }

    if (spec.links == null) {
      // 可选
    } else if (!Array.isArray(spec.links)) {
      warnings.push('links must be an array of [from, to, label]; ignored');
    } else {
      for (const link of spec.links) {
        if (!Array.isArray(link) || link.length !== 3) {
          errors.push('each item in links must be an array of [from, to, label]');
          continue;
        }
        if (link[0] === link[1]) {
          errors.push(`link cannot point at itself ("${link[0]}")`);
          continue;
        }
        for (const ref of [link[0], link[1]]) {
          if (!seen.has(ref)) errors.push(`link references unknown node "${ref}"`);
        }
      }
    }
  }

  return { errors, warnings };
}

/** 从盒子中心沿 (dx, dy) 方向射出，返回盒子边界外 gap 处的点。 */
function boxExit(cx, cy, tx, ty, hw, hh, gap) {
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: cx, y: cy };
  const ux = dx / len;
  const uy = dy / len;
  const tX = ux === 0 ? Infinity : Math.abs(hw / ux);
  const tY = uy === 0 ? Infinity : Math.abs(hh / uy);
  const t = Math.min(tX, tY) + gap;
  return { x: cx + ux * t, y: cy + uy * t };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * 辐射布局：中心节点 + 环上卫星节点。
 * 返回 { nodes: [{id, x, y, isCenter}], edges: [{from, to, label, x1, y1, x2, y2, lx, ly}] }
 */
function layoutRadial(spec) {
  const input = (Array.isArray(spec.nodes) ? spec.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node) && node.id != null)
    .map((node) => Object.assign({}, node, { id: String(node.id) }));
  const nodes = [{ id: CENTER_ID, x: CENTER.x, y: CENTER.y, isCenter: true }];
  const edges = [];
  const byId = Object.create(null);

  input.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(input.length, 1);
    const x = CENTER.x + RADIUS.x * Math.cos(angle);
    const y = CENTER.y + RADIUS.y * Math.sin(angle);
    byId[node.id] = { x, y };
    nodes.push({ id: node.id, x: round2(x), y: round2(y), isCenter: false });

    const start = boxExit(CENTER.x, CENTER.y, x, y, BOX.center.hw, BOX.center.hh, 2);
    const end = boxExit(x, y, CENTER.x, CENTER.y, BOX.node.hw, BOX.node.hh, 2);
    // 标签放在连线中点、再垂直偏移：既不压住连线与箭头，也不碰节点框
    const midX = CENTER.x + (x - CENTER.x) * 0.5;
    const midY = CENTER.y + (y - CENTER.y) * 0.5;
    const dirX = x - CENTER.x;
    const dirY = y - CENTER.y;
    const dirLen = Math.hypot(dirX, dirY) || 1;
    edges.push({
      from: CENTER_ID,
      to: node.id,
      label: node.edge || '',
      x1: round2(start.x),
      y1: round2(start.y),
      x2: round2(end.x),
      y2: round2(end.y),
      lx: round2(midX + (-dirY / dirLen) * LABEL_OFFSET),
      ly: round2(midY + (dirX / dirLen) * LABEL_OFFSET),
    });
  });

  if (Array.isArray(spec.links)) {
    for (const link of spec.links) {
      if (!Array.isArray(link) || link.length !== 3) continue;
      const a = byId[link[0]];
      const b = byId[link[1]];
      if (!a || !b) continue;
      const start = boxExit(a.x, a.y, b.x, b.y, BOX.node.hw, BOX.node.hh, 2);
      const end = boxExit(b.x, b.y, a.x, a.y, BOX.node.hw, BOX.node.hh, 2);
      edges.push({
        from: link[0],
        to: link[1],
        label: link[2] || '',
        x1: round2(start.x),
        y1: round2(start.y),
        x2: round2(end.x),
        y2: round2(end.y),
        lx: round2((a.x + b.x) / 2),
        ly: round2((a.y + b.y) / 2),
      });
    }
  }

  return { nodes, edges };
}

function pct(value, total) {
  return round2((value / total) * 100) + '%';
}

/**
 * 渲染图示摘要为 HTML 字符串。
 */
function renderFigure(spec, lang) {
  const layout = layoutRadial(spec);
  const input = Array.isArray(spec.nodes) ? spec.nodes : [];
  const byId = Object.create(null);
  input.forEach((node) => {
    if (node && typeof node === 'object' && node.id != null) byId[String(node.id)] = node;
  });

  const edgePaths = layout.edges
    .map(
      (edge) =>
        `<path d="M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}" marker-end="url(#ag-arrow)"/>`,
    )
    .join('');

  const centerNode = layout.nodes.find((item) => item.isCenter);
  const centerHtml =
    `<div class="ag-node ag-center" style="--x:${pct(centerNode.x, CANVAS.w)};--y:${pct(centerNode.y, CANVAS.h)}">` +
    `<span class="ag-label">${escapeHtml(spec.center)}</span></div>`;

  const satellites = layout.nodes.filter((item) => !item.isCenter);
  const satelliteHtml = satellites
    .map((item) => {
      const node = byId[item.id] || {};
      const edge = layout.edges.find((e) => e.from === CENTER_ID && e.to === item.id);
      const labelHtml =
        edge && edge.label
          ? `<span class="ag-edge-label" style="--x:${pct(edge.lx, CANVAS.w)};--y:${pct(edge.ly, CANVAS.h)}">${escapeHtml(edge.label)}</span>`
          : '';
      const subHtml = node.sub ? `<span class="ag-sub">${escapeHtml(node.sub)}</span>` : '';
      return (
        labelHtml +
        `<div class="ag-node" style="--x:${pct(item.x, CANVAS.w)};--y:${pct(item.y, CANVAS.h)}">` +
        `<span class="ag-label">${escapeHtml(node.label)}</span>${subHtml}</div>`
      );
    })
    .join('');

  const linkLabels = layout.edges
    .filter((edge) => edge.from !== CENTER_ID)
    .map((edge) =>
      edge.label
        ? `<span class="ag-edge-label ag-link-label" style="--x:${pct(edge.lx, CANVAS.w)};--y:${pct(edge.ly, CANVAS.h)}">${escapeHtml(edge.label)}</span>`
        : '',
    )
    .join('');

  return (
    `<figure class="ag" data-layout="radial" lang="${escapeHtml(lang)}">` +
    `<div class="ag-canvas">` +
    `<svg class="ag-edges" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" aria-hidden="true">` +
    `<defs><marker id="ag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="2.4" markerHeight="2.4" orient="auto">` +
    `<path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>` +
    edgePaths +
    `</svg>` +
    centerHtml +
    satelliteHtml +
    linkLabels +
    `</div>` +
    `<figcaption>${escapeHtml(captionFor(lang))}</figcaption>` +
    `</figure>`
  );
}

// Node 单元测试环境下没有 hexo 全局，仅导出纯函数。
if (typeof hexo !== 'undefined' && hexo && hexo.extend) {
  hexo.extend.filter.register('after_render:html', function (str, locals) {
    const page = locals && locals.page;
    // 守卫是承重的：default-page.pug 也会输出 #article-container
    if (!page || page.layout !== 'post' || !page.abstract_graph) return str;

    const spec = page.abstract_graph;
    const lang = page.lang || this.config.language;
    const check = validateSpec(spec, lang);
    check.errors.forEach((item) => hexo.log.warn('[abstract-graph] %s: %s', page.slug, item));
    check.warnings.forEach((item) => hexo.log.warn('[abstract-graph] %s: %s', page.slug, item));
    if (check.errors.length) return str;

    const anchor =
      /(<article[^>]*id="article-container"[^>]*>\s*(?:<div id="post-outdate-notice"[^>]*><\/div>)?)((?:\s*<blockquote>[\s\S]*?<\/blockquote>)*)/;
    if (!anchor.test(str)) return str;
    // 函数式替换：避免标签文本中的 $& / $1 被展开
    return str.replace(anchor, (m, a, b) => a + b + renderFigure(spec, lang));
  });
}

module.exports = { validateSpec, layoutRadial, renderFigure, escapeHtml, charLen, captionFor };
