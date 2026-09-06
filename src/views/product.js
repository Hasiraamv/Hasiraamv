import { escapeHtml, formatINR, icon, productCard, etaDates } from '../render.js';

// Group live offers by size and keep the cheapest per size — this is what the size grid
// prices off, and it is why the same product shows a different price per size.
export function groupOffersBySize(offers) {
  const bySize = new Map();
  for (const o of offers) {
    const existing = bySize.get(o.size_label);
    if (!existing || o.landed_price < existing.landed_price) bySize.set(o.size_label, o);
  }
  return bySize;
}

function sizeSortKey(label) {
  const m = /(\d+(\.\d+)?)/.exec(label);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

export function productPage({ product, offers, images, related, selectedSize, env }) {
  const bySize = groupOffersBySize(offers);
  const sizes = [...bySize.keys()].sort((a, b) => sizeSortKey(a) - sizeSortKey(b) || a.localeCompare(b));
  // Default to the size holding the cheapest offer, so the price here matches the price
  // advertised on the listing card the buyer clicked.
  const cheapestSize = offers.length ? offers[0].size_label : sizes[0];
  const activeSize = selectedSize && bySize.has(selectedSize) ? selectedSize : cheapestSize;
  const best = bySize.get(activeSize);
  const sizeOffers = offers.filter((o) => o.size_label === activeSize);
  const underRetail = product.retail_price && best && best.landed_price < product.retail_price;
  const discountPct = underRetail
    ? Math.round(((product.retail_price - best.landed_price) / product.retail_price) * 100)
    : 0;

  const eta = best ? etaDates(best.lead_days_min, best.lead_days_max) : null;
  const hero = images[0];

  return `
<div class="wrap" style="padding-top:16px; padding-bottom:16px; font-size:12px; color:var(--faint); border-bottom:1px solid var(--line);">
  <a href="/c/${escapeHtml(product.category_slug)}" style="color:var(--faint)">${escapeHtml(product.category_name)}</a>
  &nbsp;/&nbsp; <span style="color:var(--text)">${escapeHtml(product.title)}</span>
</div>

<section class="wrap pdp" style="display:grid; grid-template-columns:1.05fr .95fr; gap:52px; padding-top:40px;">

  <div>
    <div style="aspect-ratio:1/1; background:var(--tile); position:relative;">
      ${hero ? `<img src="${escapeHtml(hero.url)}" alt="${escapeHtml(product.title)}" style="width:100%;height:100%;object-fit:cover">` : ''}
      <span class="badge">${icon('check', '#a17c3a', 12)} DUAL AUTHENTICATED</span>
      ${underRetail ? `<span class="badge badge-right badge-under">UNDER RETAIL</span>` : ''}
    </div>
    ${
      images.length > 1
        ? `<div class="grid" style="grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:12px;">
             ${images
               .slice(0, 5)
               .map(
                 (im) =>
                   `<div style="aspect-ratio:1/1; background:var(--tile);"><img src="${escapeHtml(
                     im.url
                   )}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`
               )
               .join('')}
           </div>`
        : ''
    }

    <div class="panel" style="margin-top:22px; padding:22px 24px;">
      <h3 class="serif" style="font-size:20px; margin:0 0 10px;">About this piece</h3>
      <p style="margin:0 0 14px; font-size:14px; line-height:1.7; color:#4a463c;">${escapeHtml(product.description || '')}</p>
      <div style="display:flex; gap:28px; flex-wrap:wrap; font-size:12.5px; color:var(--muted);">
        ${product.sku ? `<span><strong style="color:var(--text)">Style</strong> ${escapeHtml(product.sku)}</span>` : ''}
        ${product.release_year ? `<span><strong style="color:var(--text)">Released</strong> ${product.release_year}</span>` : ''}
        ${product.condition_notes ? `<span><strong style="color:var(--text)">Condition</strong> ${escapeHtml(product.condition_notes)}</span>` : ''}
      </div>
    </div>
  </div>

  <div>
    <span class="tag gold">Sourced from ${escapeHtml(best ? best.ships_from : '—')}</span>
    <h1 class="serif" style="font-size:38px; margin:8px 0; line-height:1.2;">${escapeHtml(product.title)}</h1>

    ${
      best
        ? `
    <div style="display:flex; align-items:flex-end; gap:14px; padding-bottom:20px; border-bottom:1px solid var(--line); flex-wrap:wrap;">
      <div>
        <div style="font-size:11.5px; color:var(--faint); margin-bottom:4px;">Lowest landed price${
          activeSize !== 'One size' ? ` · size ${escapeHtml(activeSize)}` : ''
        }</div>
        <div class="serif" style="font-size:40px; line-height:1;">${formatINR(best.landed_price)}</div>
      </div>
      ${
        underRetail
          ? `<div style="padding-bottom:5px;">
               <span style="font-size:13px; color:var(--faint); text-decoration:line-through;">${formatINR(product.retail_price)}</span>
               <span style="font-size:13px; color:var(--green); font-weight:600; margin-left:8px;">${discountPct}% under retail</span>
             </div>`
          : ''
      }
    </div>

    ${
      sizes.length > 1
        ? `
    <div style="margin-top:22px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
        <span style="font-size:13.5px; font-weight:600;">Select size</span>
      </div>
      <div class="sizes">
        ${sizes
          .map((s) => {
            const o = bySize.get(s);
            return `<a class="size${s === activeSize ? ' active' : ''}" href="?size=${encodeURIComponent(s)}">
              <div class="n">${escapeHtml(s)}</div>
              <div class="p">${formatINR(o.landed_price)}</div>
            </a>`;
          })
          .join('')}
      </div>
    </div>`
        : ''
    }

    <form method="post" action="/cart/add" style="margin-top:22px; display:flex; flex-direction:column; gap:10px;">
      <input type="hidden" name="offer_id" value="${best.id}">
      <button class="btn btn-block" type="submit">Buy now — ${formatINR(best.landed_price)} landed</button>
    </form>

    <div class="panel" style="margin-top:22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--line);">
        <span style="font-size:13.5px; font-weight:600;">Estimated delivery</span>
        <span style="font-size:13.5px; font-weight:600; color:var(--gold);">${eta.from} – ${eta.to}</span>
      </div>
      <div style="padding:18px 20px;">
        <div class="timeline">
          <div class="stage done"><div class="bar"></div><div class="label">Seller ships</div><div class="sub">1–2 days · ${escapeHtml(best.ships_from)}</div></div>
          <div class="stage current"><div class="bar"></div><div class="label">Authentication</div><div class="sub">2–3 days · our facility</div></div>
          <div class="stage"><div class="bar"></div><div class="label">Import &amp; customs</div><div class="sub">${Math.max(
            best.lead_days_min - 8,
            4
          )}–${Math.max(best.lead_days_max - 8, 6)} days</div></div>
          <div class="stage"><div class="bar"></div><div class="label">Last mile</div><div class="sub">2–3 days · to you</div></div>
        </div>
      </div>
    </div>

    <div style="margin-top:16px; border:1px solid var(--line); background:var(--paper-alt); padding:18px 20px;">
      <div style="font-size:13.5px; font-weight:600; margin-bottom:12px;">What's in the ${formatINR(best.landed_price)}</div>
      <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px; color:#5c5748;">
        <div style="display:flex; justify-content:space-between;"><span>Seller price</span><span>${formatINR(best.seller_price)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Import duty &amp; customs clearance</span><span>${formatINR(best.duty)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Dual authentication &amp; certificate</span><span>${formatINR(best.auth_fee)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Insured international shipping</span><span>${formatINR(best.shipping)}</span></div>
        <div style="display:flex; justify-content:space-between; padding-top:9px; border-top:1px solid #ddd5c2; font-weight:600; color:var(--text); font-size:13.5px;"><span>You pay</span><span>${formatINR(best.landed_price)}</span></div>
      </div>
      <div style="font-size:11.5px; color:var(--faint); margin-top:12px; line-height:1.5;">No surprise charges at delivery — duties are paid by us before the parcel enters the country.</div>
    </div>`
        : `<div class="notice" style="margin-top:20px;">No live offers for this piece right now. <a href="/#sourcing">Ask us to source it</a> and we will put it to our seller network.</div>`
    }
  </div>
</section>

${
  sizeOffers.length
    ? `
<section class="section">
  <div class="section-head">
    <div>
      <span class="tag gold">Every offer, side by side</span>
      <h2 class="serif" style="font-size:32px;">${sizeOffers.length} verified seller${
        sizeOffers.length === 1 ? '' : 's'
      } ${activeSize !== 'One size' ? `have this in ${escapeHtml(activeSize)}` : 'have this piece'}</h2>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr><th>Seller</th><th>Condition</th><th>Ships from</th><th>Delivered by</th><th class="num">Landed price</th><th></th></tr>
    </thead>
    <tbody>
      ${sizeOffers
        .map((o, i) => {
          const e = etaDates(o.lead_days_min, o.lead_days_max);
          return `
        <tr${i === 0 ? ' class="best"' : ''}>
          <td data-label="Seller">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:14px;">${escapeHtml(o.seller_name)}</strong>
              ${
                o.kyc_verified
                  ? `<span style="display:inline-flex; align-items:center; gap:4px; background:var(--paper-alt); border:1px solid #ddd5c2; padding:2px 6px; font-size:9.5px; color:var(--gold); font-weight:700;">${icon(
                      'check',
                      '#a17c3a',
                      9
                    )} KYC</span>`
                  : ''
              }
            </div>
            <div style="font-size:11.5px; color:var(--faint); margin-top:3px;">${o.rating} ★ · ${
            o.sales_count
          } sales${o.legit_check ? ' · legit check on file' : ''}</div>
          </td>
          <td data-label="Condition">${escapeHtml(o.condition)}</td>
          <td data-label="Ships from">${escapeHtml(o.ships_from)}</td>
          <td data-label="Delivered by">${e.from} – ${e.to}</td>
          <td data-label="Landed price" class="num">
            <div class="serif" style="font-size:20px;">${formatINR(o.landed_price)}</div>
            ${i === 0 ? '<div style="font-size:11px; color:var(--green); font-weight:600;">Lowest</div>' : ''}
          </td>
          <td class="num">
            <form method="post" action="/cart/add">
              <input type="hidden" name="offer_id" value="${o.id}">
              <button class="btn btn-outline" style="padding:10px 18px; font-size:12.5px;" type="submit">Buy</button>
            </form>
          </td>
        </tr>`;
        })
        .join('')}
    </tbody>
  </table>
</section>`
    : ''
}

<section class="section">
  <div class="dark" style="padding:48px 52px;">
    <div class="grid grid-2" style="gap:52px; align-items:center;">
      <div>
        <span class="tag" style="color:var(--gold-light)">Before it reaches you</span>
        <h2 class="serif" style="font-size:32px; margin:10px 0 14px; line-height:1.2;">This piece gets checked twice and sealed once.</h2>
        <p style="font-size:14.5px; line-height:1.7; color:#b3ab99; margin:0;">
          The seller's legit-check report is already on file. When it reaches our facility our
          authenticator runs an independent 30-point inspection, then seals it with a numbered
          certificate. If it fails, you are refunded before it ever ships.
        </p>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${[
          ['check', '#cba25a', 'Seller legit check — required to list', 'No listing goes live without an authentication report on file'],
          ['clock', '#8b8474', 'In-house inspection — on arrival', '30-point check by our authenticator'],
          ['doc', '#8b8474', 'Certificate issued — before dispatch', 'Numbered and verifiable at /verify'],
        ]
          .map(
            ([ic, col, title, sub]) => `
          <div style="display:flex; gap:14px; align-items:center; border:1px solid var(--line-dark); background:#1c1813; padding:16px 18px;">
            ${icon(ic, col, 17)}
            <div>
              <div style="font-size:13.5px; font-weight:600;">${title}</div>
              <div style="font-size:11.5px; color:#8b8474; margin-top:2px;">${sub}</div>
            </div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </div>
</section>

${
  related.length
    ? `<section class="section">
        <h2 class="serif" style="font-size:30px; margin:0 0 26px;">More in ${escapeHtml(product.category_name)}</h2>
        <div class="card-grid">${related.map(productCard).join('')}</div>
       </section>`
    : ''
}
`;
}
