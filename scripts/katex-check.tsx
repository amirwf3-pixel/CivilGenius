
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
(globalThis as unknown as { window: unknown }).window = {
  location: { hash: '#/beam' },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};
import('../src/pages/Advisor').then(({ MathText }) => {
  const text =
    'ظرفیت خمشی طبق مبحث نهم:\nMu = φ·As·fy·(d − a/2)\nکه در آن a = As·fy / (0.85·fc·b) و φ = 0.9 است.\nAs ≥ Mu / (0.9·fy·0.9d) → $As = 1250 mm²$';
  const html = renderToString(h(MathText, { text }));
  console.log('katex spans  :', (html.match(/class="katex"/g) ?? []).length);
  console.log('katex-error  :', html.includes('katex-error'));
});


