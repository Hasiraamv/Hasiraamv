import { escapeHtml, productCard } from '../render.js';

function chip(label, params, current) {
  const qs = new URLSearchParams(params).toString();
  const href = qs ? `?${qs}` : '?';
  const isActive = Object.entries(params).every(([k, v]) => String(current[k] || '') === String(v));
  return `<a class="chip${isActive ? ' active' : ''}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

export function categoryPage({ category, products, filters, total }) {
  const name = category ? category.name : 'Everything';
  const blurb = category ? category.blurb : 'Every live listing across all categories.';
  const base = {};
  if (filters.sort) base.sort = filters.sort;

  return `
<section class="section">
  <div class="section-head">
    <div>
      <span class="tag gold">${total} listing${total === 1 ? '' : 's'}</span>
      <h2 class="serif">${escapeHtml(name)}</h2>
      ${blurb ? `<p class="muted" style="margin:8px 0 0; max-width:520px; font-size:14px;">${escapeHtml(blurb)}</p>` : ''}
    </div>
  </div>

  <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:28px; padding-bottom:22px; border-bottom:1px solid var(--line);">
    <span class="tag muted" style="margin-right:4px;">Price</span>
    ${chip('All', { ...base }, filters)}
    ${chip('Under ₹25,000', { ...base, max: 25000 }, filters)}
    ${chip('Under ₹50,000', { ...base, max: 50000 }, filters)}
    ${chip('Under ₹1,00,000', { ...base, max: 100000 }, filters)}
    ${chip('Under retail', { ...base, under_retail: 1 }, filters)}
    <span style="width:1px; height:22px; background:var(--line); margin:0 6px;"></span>
    <span class="tag muted" style="margin-right:4px;">Arrives</span>
    ${chip('Within 2 weeks', { ...base, lead: 14 }, filters)}
    ${chip('Within 3 weeks', { ...base, lead: 21 }, filters)}
  </div>

  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; flex-wrap:wrap; gap:12px;">
    <span class="muted" style="font-size:13px;">Prices shown are landed — duties, authentication and insured shipping included.</span>
    <div class="chips">
      ${chip('Newest', { ...filters, sort: 'new' }, filters)}
      ${chip('Lowest price', { ...filters, sort: 'price_asc' }, filters)}
      ${chip('Fastest arrival', { ...filters, sort: 'fastest' }, filters)}
    </div>
  </div>

  ${
    products.length
      ? `<div class="card-grid">${products.map(productCard).join('')}</div>`
      : `<div class="notice">No listings match those filters yet. <a href="?">Clear filters</a>, or <a href="/#sourcing">ask us to source it</a>.</div>`
  }
</section>`;
}
