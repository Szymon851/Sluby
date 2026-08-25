document.addEventListener('DOMContentLoaded', async () => {
  setPageLoading(true);
  try {
    await initApi();
    const settings = await getSettings();
    const mode = enforcePublicSiteMode(settings);
    if (mode === 'locked') return;

    applyTheme(settings.theme);
    const names = `${settings.brideName} & ${settings.groomName}`;
    setText('nav-logo', names);
    document.title = `Lista inspiracji — ${names}`;
    if (settings.gifts) setText('gifts-page-intro', settings.gifts);

    initGiftsNav();

    const code = new URLSearchParams(window.location.search).get('kod')?.trim() || '';
    wireHomeLinks(code);

    let guest = null;
    if (code) {
      try { guest = await getGuestByCode(code); } catch { /* offline */ }
    }

    const banner = document.getElementById('gifts-guest-banner');
    const hint = document.getElementById('gifts-claim-hint');
    if (guest && banner) {
      banner.hidden = false;
      banner.textContent = `Zalogowany jako zaproszenie: ${guest.name} — możesz zajmować prezenty.`;
      if (hint) hint.hidden = true;
    } else if (hint) {
      hint.hidden = false;
    }

    await renderGiftList(guest);
  } finally {
    setPageLoading(false);
  }
});

function setPageLoading(on) {
  document.body.classList.toggle('page-loading', on);
  const loader = document.getElementById('page-loader');
  if (loader) loader.hidden = !on;
}

function initGiftsNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text != null && text !== '') el.textContent = text;
}

function wireHomeLinks(code) {
  const q = code ? `?kod=${encodeURIComponent(code)}` : '';
  ['gifts-back-home', 'gifts-footer-home'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = 'index.html' + q;
  });
  const rsvp = document.getElementById('gifts-back-rsvp');
  if (rsvp) rsvp.href = 'index.html' + q + '#rsvp';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function renderGiftList(guest) {
  const listEl = document.getElementById('gifts-list');
  const emptyEl = document.getElementById('gifts-empty');
  if (!listEl) return;

  let gifts = [];
  try {
    gifts = await getGifts();
  } catch {
    listEl.innerHTML = '<p class="gifts-empty">Nie udało się wczytać listy. Spróbuj odświeżyć stronę.</p>';
    return;
  }

  if (!gifts.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  listEl.innerHTML = gifts.map(g => {
    const claimed = !!g.claimedByGuestId;
    const mine = guest && g.claimedByGuestId === guest.id;
    let status = '<span class="gift-status available">Wolne</span>';
    if (claimed) {
      status = '<span class="gift-status taken">Zajęte</span>';
    }
    let actions = '';
    if (guest) {
      if (!claimed) {
        actions = `<button type="button" class="btn btn-sm btn-primary" data-claim="${g.id}">Zajmij</button>`;
      } else if (mine) {
        actions = `<button type="button" class="btn btn-sm btn-secondary" data-release="${g.id}">Zrezygnuj</button>`;
      }
    }
    const link = (!claimed && g.url)
      ? `<a href="${escapeHtml(g.url)}" target="_blank" rel="noopener" class="gift-link">Zobacz produkt →</a>`
      : '';
    const notes = g.notes ? `<p class="gift-notes">${escapeHtml(g.notes)}</p>` : '';
    return `
      <article class="gift-card ${claimed ? 'claimed' : ''}">
        <div class="gift-card-body">
          <h2 class="gift-card-title">${escapeHtml(g.name)}</h2>
          ${notes}
          <div class="gift-card-meta">${status}${link}</div>
        </div>
        <div class="gift-card-actions">${actions}</div>
      </article>
    `;
  }).join('');

  listEl.onclick = async (e) => {
    const claimId = e.target.closest('[data-claim]')?.dataset.claim;
    const releaseId = e.target.closest('[data-release]')?.dataset.release;
    if (!guest || (!claimId && !releaseId)) return;
    const btn = e.target.closest('button');
    if (btn) btn.disabled = true;
    try {
      const result = claimId
        ? await claimGift(guest.code, claimId)
        : await releaseGift(guest.code, releaseId);
      if (!result.success) alert(result.error || 'Nie udało się.');
      await renderGiftList(guest);
    } catch {
      alert('Błąd połączenia. Spróbuj ponownie.');
      if (btn) btn.disabled = false;
    }
  };
}
