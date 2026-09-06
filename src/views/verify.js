import { escapeHtml, icon } from '../render.js';

export function verifyPage({ query, code, result }) {
  return `
<section class="section" style="max-width:820px;">
  <span class="tag gold">Certification</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 12px;">Verify a certificate</h2>
  <p class="muted" style="margin:0 0 26px; font-size:15px; line-height:1.7;">
    Every piece we authenticate ships with a numbered certificate. Enter the number to confirm it
    was issued by us and what it covers. For full detail, add the verification code printed inside
    the sealed package.
  </p>

  <form method="get" action="/verify" class="panel" style="padding:24px; margin-bottom:26px;">
    <div class="form-row">
      <div class="field">
        <label for="no">Certificate number</label>
        <input id="no" name="no" value="${escapeHtml(query || '')}" placeholder="MM-26-TYO-SNK-00248-M" required maxlength="30" autocapitalize="characters">
      </div>
      <div class="field">
        <label for="code">Verification code (optional)</label>
        <input id="code" name="code" value="${escapeHtml(code || '')}" placeholder="6 characters" maxlength="10" autocapitalize="characters">
        <span class="hint">Printed inside the sealed package.</span>
      </div>
    </div>
    <button class="btn" type="submit">Verify</button>
  </form>

  ${result ? renderResult(result) : ''}

  <div class="panel" style="padding:24px; margin-top:26px;">
    <h3 class="serif" style="font-size:20px; margin:0 0 12px;">How to read a certificate number</h3>
    <div class="serif" style="font-size:22px; letter-spacing:0.06em; margin-bottom:14px;">MM-26-TYO-SNK-00248-M</div>
    <table class="table" style="background:none;">
      <tbody>
        ${[
          ['MM', 'Issued by us'],
          ['26', 'Year of issue'],
          ['TYO', 'Where the piece was sourced — here, Tokyo'],
          ['SNK', 'Category — sneakers'],
          ['00248', 'Sequence within the year'],
          ['M', 'Check character — a mistyped or invented number fails here'],
        ]
          .map(
            ([k, v]) =>
              `<tr><td data-label="Part" style="width:110px;"><strong>${k}</strong></td><td data-label="Means">${v}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>
</section>`;
}

function renderResult(result) {
  if (!result.ok && result.reason === 'bad_checksum') {
    return `<div class="notice notice-bad">
      <strong>That is not a valid certificate number.</strong>
      It fails the check character, which means it was mistyped or was never issued by us.
      Re-read the number from the card — if it is printed exactly as you entered it, the certificate is not ours.
    </div>`;
  }

  if (!result.ok && result.reason === 'not_found') {
    return `<div class="notice notice-bad">
      <strong>No certificate with that number.</strong>
      The format is right but we have not issued it. Do not treat the piece as authenticated.
      Contact us with photos of the card and the item.
    </div>`;
  }

  if (!result.ok && result.reason === 'revoked') {
    const c = result.cert;
    return `<div class="notice notice-bad">
      <strong>This certificate has been revoked.</strong>
      Issued ${escapeHtml(c.issued_on)} and withdrawn${c.revoked_on ? ` on ${escapeHtml(c.revoked_on)}` : ''}.
      ${c.revoked_reason ? `Reason: ${escapeHtml(c.revoked_reason)}.` : ''}
      A revoked certificate is not proof of authenticity — please contact us.
    </div>`;
  }

  const c = result.cert;
  return `
<div class="notice notice-good" style="display:flex; align-items:center; gap:12px;">
  ${icon('check', '#2f4a34', 18)}
  <div><strong>Valid certificate.</strong> Issued by us on ${escapeHtml(c.issued_on)}.</div>
</div>

<div class="cert-card" style="margin-top:20px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:22px;">
    <div>
      <div class="tag" style="color:var(--gold-light)">Certificate of authentication</div>
      <div class="no serif" style="font-size:26px; letter-spacing:0.08em; margin-top:6px;">${escapeHtml(
        c.certificate_no
      )}</div>
    </div>
    ${icon('shield', '#cba25a', 34)}
  </div>

  <div class="cert-row"><span class="k">Item</span><span>${escapeHtml(c.product_title)}</span></div>
  ${c.size_label && c.size_label !== 'One size' ? `<div class="cert-row"><span class="k">Size</span><span>${escapeHtml(c.size_label)}</span></div>` : ''}
  ${c.condition ? `<div class="cert-row"><span class="k">Condition at inspection</span><span>${escapeHtml(c.condition)}</span></div>` : ''}
  <div class="cert-row"><span class="k">Sourced from</span><span>${escapeHtml(c.sourced_from)}</span></div>
  <div class="cert-row"><span class="k">Inspection</span><span>${c.inspection_points}-point, in-house</span></div>
  <div class="cert-row"><span class="k">Issued</span><span>${escapeHtml(c.issued_on)}</span></div>
  ${
    result.fullDetail
      ? `
  <div class="cert-row"><span class="k">Authenticator</span><span>${escapeHtml(
    c.authenticator_name || c.authenticator_initials || '—'
  )}</span></div>
  ${c.seller_name ? `<div class="cert-row"><span class="k">Seller</span><span>${escapeHtml(c.seller_name)}</span></div>` : ''}
  ${
    c.seller_report_ref
      ? `<div class="cert-row"><span class="k">Seller report</span><span>${escapeHtml(c.seller_report_ref)}</span></div>`
      : ''
  }
  ${c.notes ? `<div class="cert-row"><span class="k">Notes</span><span>${escapeHtml(c.notes)}</span></div>` : ''}`
      : ''
  }
  <div class="cert-row" style="border-bottom:0;"><span class="k">Status</span><span style="color:#a8d0a8;">Valid</span></div>

  ${
    result.fullDetail
      ? `<div style="margin-top:20px;"><a class="btn btn-outline" href="/certificate/${encodeURIComponent(
          c.certificate_no
        )}" style="color:#f2ede2; border-color:#4a4336;">Printable certificate</a></div>`
      : `<p style="font-size:12px; color:#8b8474; margin:18px 0 0; line-height:1.6;">
           Add the verification code from inside the package to see the authenticator, the seller and
           the inspection notes. We never show buyer details here.
         </p>`
  }
</div>

${
  result.lookupCount > 25
    ? `<div class="notice" style="margin-top:16px;">
         This certificate has been looked up ${result.lookupCount} times. That is unusual. If you are
         holding one of several items claiming this number, contact us — a copied number is how a fake
         travels.
       </div>`
    : ''
}`;
}

// Printable card. Kept deliberately plain so it prints cleanly at A5/A4.
export function certificatePage({ cert, siteName }) {
  return `
<section class="section" style="max-width:820px;">
  <div class="no-print" style="margin-bottom:20px; display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
    <a href="/verify">← Verify another</a>
    <button class="btn btn-outline" onclick="window.print()">Print this certificate</button>
  </div>

  <div class="cert-card">
    <div style="text-align:center; padding-bottom:24px; border-bottom:1px solid var(--line-dark);">
      <div class="serif" style="font-size:26px; letter-spacing:0.12em;">${escapeHtml(siteName.toUpperCase())}</div>
      <div class="tag" style="color:var(--gold-light); margin-top:8px;">Certificate of authentication</div>
    </div>

    <div style="text-align:center; padding:28px 0; border-bottom:1px solid var(--line-dark);">
      <div class="serif" style="font-size:30px; letter-spacing:0.1em;">${escapeHtml(cert.certificate_no)}</div>
    </div>

    <div style="padding-top:18px;">
      <div class="cert-row"><span class="k">Item</span><span>${escapeHtml(cert.product_title)}</span></div>
      ${cert.size_label && cert.size_label !== 'One size' ? `<div class="cert-row"><span class="k">Size</span><span>${escapeHtml(cert.size_label)}</span></div>` : ''}
      ${cert.condition ? `<div class="cert-row"><span class="k">Condition</span><span>${escapeHtml(cert.condition)}</span></div>` : ''}
      <div class="cert-row"><span class="k">Sourced from</span><span>${escapeHtml(cert.sourced_from)}</span></div>
      <div class="cert-row"><span class="k">Inspection</span><span>${cert.inspection_points}-point, in-house</span></div>
      <div class="cert-row"><span class="k">Authenticator</span><span>${escapeHtml(
        cert.authenticator_initials || '—'
      )}</span></div>
      <div class="cert-row" style="border-bottom:0;"><span class="k">Issued</span><span>${escapeHtml(cert.issued_on)}</span></div>
    </div>

    <p style="font-size:11.5px; color:#8b8474; line-height:1.7; margin:24px 0 0; border-top:1px solid var(--line-dark); padding-top:18px;">
      This certificate records an independent ${cert.inspection_points}-point inspection carried out by
      ${escapeHtml(siteName)} after the seller's own authentication report. Verify it at any time at
      ${escapeHtml(siteName.toLowerCase())}/verify. If this piece ever fails an independent check, we
      refund it in full.
    </p>
  </div>
</section>`;
}
