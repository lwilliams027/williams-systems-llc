/* Small, dependency-free charts for the dashboard home.
   Every chart is plain SVG/HTML sized by CSS, and each bar or point carries
   a <title> so the exact number is one hover away. */
import { gsap } from 'gsap';
import { el, REDUCED } from './util.js';

const nice = (max) => {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= max);
};

/** Vertical bars: [{ label, value }] */
export function barChart(data, { format = String, empty = 'Nothing yet' } = {}) {
  const W = 560, H = 220, L = 44, B = 26, T = 12;
  const max = nice(Math.max(0, ...data.map((d) => d.value)));
  const bw = (W - L) / data.length;
  const svg = el('svg', { class: 'chart-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': data.map((d) => `${d.label}: ${format(d.value)}`).join(', ') });
  svg.append(el('defs', { html: '<linearGradient id="barG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9BFF"/><stop offset="1" stop-color="#A06BFF"/></linearGradient>' }));
  for (let i = 0; i <= 4; i++) {
    const y = T + ((H - B - T) * i) / 4;
    svg.append(el('line', { x1: L, x2: W, y1: y, y2: y, class: 'chart-grid' }));
    svg.append(el('text', { x: L - 8, y: y + 4, class: 'chart-axis', 'text-anchor': 'end', text: shortNum(max - (max * i) / 4, format) }));
  }
  data.forEach((d, i) => {
    const h = ((H - B - T) * d.value) / max;
    const x = L + i * bw + bw * 0.2;
    const bar = el('rect', { x, y: H - B - h, width: bw * 0.6, height: Math.max(h, d.value ? 2 : 0), rx: 5, fill: 'url(#barG)', class: 'chart-bar' },
      el('title', { text: `${d.label}: ${format(d.value)}` }));
    svg.append(bar);
    svg.append(el('text', { x: x + bw * 0.3, y: H - 8, class: 'chart-axis', 'text-anchor': 'middle', text: d.label }));
  });
  if (!REDUCED) gsap.from(svg.querySelectorAll('.chart-bar'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, stagger: 0.05, ease: 'power3.out' });
  const wrap = el('div', { class: 'chart' }, svg);
  if (!data.some((d) => d.value)) wrap.append(el('p', { class: 'chart-empty', text: empty }));
  return wrap;
}

/** Line + area: [{ label, value }] */
export function lineChart(data, { format = String, empty = 'Nothing yet' } = {}) {
  const W = 560, H = 220, L = 34, B = 26, T = 14;
  const max = nice(Math.max(0, ...data.map((d) => d.value)));
  const step = (W - L - 12) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => [L + 6 + i * step, T + (H - B - T) * (1 - d.value / max)]);
  const svg = el('svg', { class: 'chart-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': data.map((d) => `${d.label}: ${format(d.value)}`).join(', ') });
  svg.append(el('defs', { html: '<linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9BFF" stop-opacity=".35"/><stop offset="1" stop-color="#2E9BFF" stop-opacity="0"/></linearGradient>' }));
  for (let i = 0; i <= 4; i++) {
    const y = T + ((H - B - T) * i) / 4;
    svg.append(el('line', { x1: L, x2: W, y1: y, y2: y, class: 'chart-grid' }));
    svg.append(el('text', { x: L - 8, y: y + 4, class: 'chart-axis', 'text-anchor': 'end', text: shortNum(max - (max * i) / 4, format) }));
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  svg.append(el('path', { d: `${line}L${pts.at(-1)[0]},${H - B}L${pts[0][0]},${H - B}Z`, fill: 'url(#areaG)', class: 'chart-area' }));
  const path = el('path', { d: line, class: 'chart-line' });
  svg.append(path);
  pts.forEach((p, i) => {
    svg.append(el('circle', { cx: p[0], cy: p[1], r: 4, class: 'chart-dot' }, el('title', { text: `${data[i].label}: ${format(data[i].value)}` })));
    if (data.length <= 12 && (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1)) {
      svg.append(el('text', { x: p[0], y: H - 8, class: 'chart-axis', 'text-anchor': 'middle', text: data[i].label }));
    }
  });
  if (!REDUCED) {
    const len = path.getTotalLength?.() || 1000;
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' });
    gsap.from(svg.querySelector('.chart-area'), { autoAlpha: 0, duration: 1, delay: 0.3 });
  }
  const wrap = el('div', { class: 'chart' }, svg);
  if (!data.some((d) => d.value)) wrap.append(el('p', { class: 'chart-empty', text: empty }));
  return wrap;
}

/** Donut with a legend: [{ label, value, color }] */
export function donut(data, { center = '', sub = '', format = String } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70, C = 2 * Math.PI * R;
  const svg = el('svg', { class: 'donut-svg', viewBox: '0 0 200 200', role: 'img', 'aria-label': data.map((d) => `${d.label}: ${format(d.value)}`).join(', ') });
  svg.append(el('circle', { cx: 100, cy: 100, r: R, class: 'donut-track' }));
  let off = 0;
  for (const d of data) {
    if (!d.value) continue;
    const len = (d.value / total) * C;
    const seg = el('circle', {
      cx: 100, cy: 100, r: R, fill: 'none', stroke: d.color, 'stroke-width': 22,
      'stroke-dasharray': `${Math.max(len - 2, 0.5)} ${C}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 100 100)', class: 'donut-seg',
    }, el('title', { text: `${d.label}: ${format(d.value)}` }));
    svg.append(seg);
    off += len;
  }
  svg.append(el('text', { x: 100, y: 100, class: 'donut-num', 'text-anchor': 'middle', text: center }));
  svg.append(el('text', { x: 100, y: 122, class: 'donut-sub', 'text-anchor': 'middle', text: sub }));
  if (!REDUCED) gsap.from(svg.querySelectorAll('.donut-seg'), { strokeDasharray: `0 ${C}`, duration: 0.9, stagger: 0.08, ease: 'power2.out' });
  return el('div', { class: 'donut' }, svg,
    el('ul', { class: 'donut-legend' }, data.map((d) => el('li', {},
      el('i', { style: { background: d.color } }), el('span', { text: d.label }), el('b', { text: format(d.value) })))));
}

/** Horizontal bars (a funnel): [{ label, value, sub }] */
export function hBars(data, { format = String } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const list = el('ul', { class: 'hbars' }, data.map((d) => el('li', {},
    el('div', { class: 'hbar-top' }, el('span', { text: d.label }), el('b', { text: format(d.value) })),
    el('div', { class: 'hbar-track' }, el('div', { class: 'hbar-fill', style: { width: `${(d.value / max) * 100}%` } })),
    d.sub ? el('small', { text: d.sub }) : null)));
  if (!REDUCED) gsap.from(list.querySelectorAll('.hbar-fill'), { width: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
  return list;
}

function shortNum(n, format) {
  const s = format(n);
  return s.length > 6 && n >= 1000 ? format === String ? `${Math.round(n / 100) / 10}k` : `$${Math.round(n / 100) / 10}k` : s;
}
