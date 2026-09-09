import { escapeHtml, formatINR, icon, productCard, etaDates, STOCK_LABELS } from '../render.js';

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

// YouTube/Vimeo links embed as an iframe; anything else is treated as a direct video file
// (e.g. an R2-hosted .mp4) and played inline.
function videoEmbed(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) {
    return `<iframe src="https://www.youtube.com/embed/${yt[1]}" title="Product video" style="width:100%; aspect-ratio:16/9; border:0; display:block;" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return `<iframe src="https://player.vimeo.com/video/${vimeo[1]}" title="Product video" style="width:100%; aspect-ratio:16/9; border:0; display:block;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }
  return `<video controls preload="metadata" style="width:100%; aspect-ratio:16/9; background:#000; display:block;"><source src="${escapeHtml(url)}"></video>`;
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

  return `
<div class="wrap" style="padding-top:16px; padding-bottom:16px; font-size:12px; color:var(--faint); border-bottom:1px solid var(--line);">
  <a href="/c/${escapeHtml(product.category_slug)}" style="color:var(--faint)">${escapeHtml(product.category_name)}</a>
  &nbsp;/&nbsp; <span style="color:var(--text)">${escapeHtml(product.title)}</span>
</div>

<section class="wrap pdp" style="display:grid; grid-template-columns:1.05fr .95fr; gap:52px; padding-top:40px;">

  <div class="pdp-media">
    <div class="pdp-gallery" data-gallery>
      <div class="pdp-gallery-main" style="aspect-ratio:1/1; background:var(--tile); position:relative; overflow:hidden;">
        ${
          images.length
            ? images
                .map(
                  (im, i) =>
                    `<img src="${escapeHtml(im.url)}" alt="${escapeHtml(product.title)}" class="pdp-slide"
                       data-slide="${i}" style="position:absolute; inset:0; width:100%; height:100%;
                       object-fit:cover; opacity:${i === 0 ? 1 : 0}; transition:opacity .25s;">`
                )
                .join('')
            : ''
        }
        <span class="badge">${icon('check', '#6a5735', 12)} DUAL AUTHENTICATED</span>
        ${underRetail ? `<span class="badge badge-right badge-under">UNDER RETAIL</span>` : ''}
        ${
          images.length > 1
            ? `
        <button type="button" class="pdp-nav pdp-nav-prev" data-nav="prev" aria-label="Previous photo"
          style="position:absolute; left:10px; top:50%; transform:translateY(-50%); width:34px; height:34px;
          border:none; border-radius:50%; background:rgba(20,18,14,.55); color:#fff; display:flex;
          align-items:center; justify-content:center; cursor:pointer;">${icon('chevron', 'currentColor', 18)}</button>
        <button type="button" class="pdp-nav pdp-nav-next" data-nav="next" aria-label="Next photo"
          style="position:absolute; right:10px; top:50%; transform:translateY(-50%); width:34px; height:34px;
          border:none; border-radius:50%; background:rgba(20,18,14,.55); color:#fff; display:flex;
          align-items:center; justify-content:center; cursor:pointer;"><span style="display:block; transform:rotate(180deg);">${icon(
            'chevron',
            'currentColor',
            18
          )}</span></button>
        <div class="pdp-counter" data-counter style="position:absolute; right:12px; bottom:12px; font-size:11px;
          font-weight:600; color:#fff; background:rgba(20,18,14,.55); padding:4px 9px; border-radius:20px;">1 / ${
            images.length
          }</div>`
            : ''
        }
      </div>
      ${
        images.length > 1
          ? `<div class="pdp-thumbs" style="display:flex; gap:9px; margin-top:12px; overflow-x:auto; padding-bottom:2px;">
               ${images
                 .map(
                   (im, i) =>
                     `<button type="button" class="pdp-thumb${i === 0 ? ' active' : ''}" data-thumb="${i}"
                        aria-label="Photo ${i + 1} of ${images.length}"
                        style="position:relative; flex:none; width:60px; aspect-ratio:1/1; padding:0; cursor:pointer;
                        background:var(--tile); border:2px solid ${i === 0 ? 'var(--gold)' : 'var(--line)'};">
                        <img src="${escapeHtml(im.url)}" alt="" style="width:100%; height:100%; object-fit:cover; display:block;">
                        <span style="position:absolute; left:3px; bottom:2px; font-size:9px; font-weight:700; color:#fff;
                          text-shadow:0 1px 2px rgba(0,0,0,.7);">${i + 1}</span>
                      </button>`
                 )
                 .join('')}
             </div>`
          : ''
      }
    </div>
    ${
      product.video_url
        ? `<div style="margin-top:12px; border:1px solid var(--line);">${videoEmbed(product.video_url)}</div>`
        : ''
    }

    <div class="panel" style="margin-top:22px; padding:22px 24px;">
      <h3 class="serif" style="font-size:20px; margin:0 0 10px;">About this piece</h3>
      <p class="pdp-copy" style="margin:0 0 14px; font-size:14px; line-height:1.7; color:var(--text);">${escapeHtml(product.description || '')}</p>
      ${
        product.details
          ? `<div style="margin:0 0 14px; padding-top:14px; border-top:1px solid var(--line);">
               <h4 style="font-size:12.5px; font-weight:600; margin:0 0 8px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted);">Details</h4>
               <p class="pdp-copy" style="margin:0; font-size:13.5px; line-height:1.75; color:var(--text); white-space:pre-line;">${escapeHtml(product.details)}</p>
             </div>`
          : ''
      }
      <div style="display:flex; gap:28px; flex-wrap:wrap; font-size:12.5px; color:var(--muted);">
        ${product.sku ? `<span><strong style="color:var(--text)">Style</strong> ${escapeHtml(product.sku)}</span>` : ''}
        ${product.release_year ? `<span><strong style="color:var(--text)">Released</strong> ${product.release_year}</span>` : ''}
        ${product.condition_notes ? `<span><strong style="color:var(--text)">Condition</strong> ${escapeHtml(product.condition_notes)}</span>` : ''}
      </div>
    </div>
  </div>
  ${
    images.length > 1
      ? `<script>
  (function () {
    var galleries = document.querySelectorAll('[data-gallery]');
    galleries.forEach(function (gallery) {
      if (gallery.dataset.wired) return;
      gallery.dataset.wired = '1';
      var slides = gallery.querySelectorAll('.pdp-slide');
      var thumbs = gallery.querySelectorAll('.pdp-thumb');
      var counter = gallery.querySelector('[data-counter]');
      var i = 0;
      function show(n) {
        i = (n + slides.length) % slides.length;
        slides.forEach(function (s, idx) { s.style.opacity = idx === i ? '1' : '0'; });
        thumbs.forEach(function (t, idx) {
          t.style.borderColor = idx === i ? 'var(--gold)' : 'var(--line)';
          t.classList.toggle('active', idx === i);
        });
        if (counter) counter.textContent = (i + 1) + ' / ' + slides.length;
      }
      gallery.querySelectorAll('[data-nav]').forEach(function (btn) {
        btn.addEventListener('click', function () { show(i + (btn.dataset.nav === 'next' ? 1 : -1)); });
      });
      thumbs.forEach(function (t) {
        t.addEventListener('click', function () { show(Number(t.dataset.thumb)); });
      });
      gallery.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') show(i + 1);
        if (e.key === 'ArrowLeft') show(i - 1);
      });
      var main = gallery.querySelector('.pdp-gallery-main');
      var touchX = null;
      main.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
      main.addEventListener('touchend', function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
        touchX = null;
      });
    });
  })();
</script>`
      : ''
  }

  <div class="pdp-info">
    <span class="tag gold">Imported &amp; authenticated</span>
    ${
      product.gender && product.gender !== 'unisex'
        ? `<span class="tag muted" style="margin-left:8px;">${product.gender === 'men' ? "Men's" : "Women's"}</span>`
        : ''
    }
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
        ${best.stock_label && STOCK_LABELS[best.stock_label] ? `<div style="font-size:11px; color:var(--oxblood); font-weight:700; margin-top:4px;">${STOCK_LABELS[best.stock_label]}</div>` : ''}
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
            return `<a class="size${s === activeSize ? ' active' : ''}" href="?size=${encodeURIComponent(s)}"${s === activeSize ? ' aria-current="true"' : ''} aria-label="Size ${escapeHtml(s)}, ${formatINR(o.landed_price)}">
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
          <div class="stage done"><div class="bar"></div><div class="label">Sourced</div><div class="sub">Reserved for you</div></div>
          <div class="stage current"><div class="bar"></div><div class="label">Authentication</div><div class="sub">Checked and sealed</div></div>
          <div class="stage"><div class="bar"></div><div class="label">Imported</div><div class="sub">Duties paid for you</div></div>
          <div class="stage"><div class="bar"></div><div class="label">Delivered</div><div class="sub">To your door</div></div>
        </div>
      </div>
    </div>

    <div style="margin-top:16px; border:1px solid var(--line); background:var(--paper-alt); padding:18px 20px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        ${icon('check', '#3f5f45', 16)}
        <span style="font-size:13.5px; font-weight:600;">${formatINR(best.landed_price)} is everything</span>
      </div>
      <div style="font-size:12.5px; color:#5c5748; line-height:1.65;">
        The listed price includes import duty, customs clearance, dual authentication with a numbered
        certificate, and insured delivery to your door. Nothing further is payable when it arrives.
      </div>
      <p class="refund-note" style="font-size:12px; color:var(--muted); line-height:1.6; margin:12px 0 0; padding-top:12px; border-top:1px solid #d6d0c5;">
        <strong>On refunds:</strong> if this piece is not authentic, damaged, or not as described,
        you get the full ${formatINR(best.landed_price)} back — duty and freight included, no
        deductions. If you simply change your mind, ${formatINR(
          best.duty + best.shipping
        )} of this price is import duty and freight, paid to customs on arrival and not
        reclaimable, so a change-of-mind refund would be ${formatINR(
          best.landed_price - best.duty - best.shipping
        )}.
        <a href="/returns">Full returns policy</a>.
      </p>
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
      <tr><th>Seller</th><th>Condition</th><th>Delivered by</th><th class="num">Price</th><th></th></tr>
    </thead>
    <tbody>
      ${sizeOffers
        .map((o, i) => {
          const e = etaDates(o.lead_days_min, o.lead_days_max);
          // Sellers are shown anonymously. Their names identify the dealers we buy from —
          // publishing them hands our sourcing network to anyone who reads the page, and
          // several of them are named after the city they trade in. A piece we imported
          // ourselves has no dealer to anonymise, so it says so plainly instead.
          const inhouse = o.sourced_by === 'inhouse';
          const label = inhouse ? 'Inhaus — sourced by us' : `Verified seller ${String.fromCharCode(65 + i)}`;
          return `
        <tr${i === 0 ? ' class="best"' : ''}>
          <td data-label="Seller">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:14px;">${label}</strong>
              ${
                inhouse
                  ? `<span style="display:inline-flex; align-items:center; gap:4px; background:var(--ink); border:1px solid var(--ink); padding:2px 6px; font-size:9.5px; color:var(--gold-light); font-weight:700;">NO MIDDLEMAN</span>`
                  : o.kyc_verified
                  ? `<span style="display:inline-flex; align-items:center; gap:4px; background:var(--paper-alt); border:1px solid #d6d0c5; padding:2px 6px; font-size:9.5px; color:var(--gold); font-weight:700;">${icon(
                      'check',
                      '#6a5735',
                      9
                    )} KYC</span>`
                  : ''
              }
            </div>
            <div style="font-size:11.5px; color:var(--faint); margin-top:3px;">${
              o.completed_sales > 0
                ? `${o.completed_sales} completed sale${o.completed_sales === 1 ? '' : 's'} through us`
                : 'New to the marketplace'
            }${o.legit_check ? ' · authentication report on file' : ''}</div>
          </td>
          <td data-label="Condition">${escapeHtml(o.condition)}</td>
          <td data-label="Delivered by">${e.from} – ${e.to}</td>
          <td data-label="Landed price" class="num">
            <div class="serif" style="font-size:20px;">${formatINR(o.landed_price)}</div>
            ${i === 0 ? '<div style="font-size:11px; color:var(--green); font-weight:600;">Lowest</div>' : ''}
            ${o.stock_label && STOCK_LABELS[o.stock_label] ? `<div style="font-size:10.5px; color:var(--oxblood); font-weight:700; margin-top:2px;">${STOCK_LABELS[o.stock_label]}</div>` : ''}
          </td>
          <td class="num">
            <form method="post" action="/cart/add">
              <input type="hidden" name="offer_id" value="${o.id}">
              <button class="btn btn-outline" style="padding:10px 18px; font-size:12.5px;" type="submit" aria-label="Buy from ${label} for ${formatINR(o.landed_price)} landed">Buy</button>
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
          ['check', '#b4935a', 'Seller legit check — required to list', 'No listing goes live without an authentication report on file'],
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
