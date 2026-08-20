/** Tryby preview / live / locked (zmiana w Supabase). */

const SITE_MODES = ['preview', 'live', 'locked'];

function normalizeSiteMode(mode) {
  return SITE_MODES.includes(mode) ? mode : 'preview';
}

function applyTheme(theme) {
  const t = theme === 'blush' ? 'blush' : 'classic';
  document.documentElement.setAttribute('data-theme', t);
}

function enforcePublicSiteMode(settings) {
  const mode = normalizeSiteMode(settings.siteMode);
  applyTheme(settings.theme);

  if (mode === 'locked') {
    showLockedScreen(settings);
    return mode;
  }

  if (mode === 'preview') {
    showPreviewBanner();
  }
  return mode;
}

function showPreviewBanner() {
  if (document.getElementById('site-preview-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'site-preview-banner';
  bar.className = 'site-mode-banner preview';
  bar.innerHTML = '<strong>Podgląd demo</strong> — ta strona nie jest jeszcze opłacona / aktywna. Nie wysyłaj linków gościom.';
  document.body.prepend(bar);
  document.body.classList.add('has-mode-banner');
}

function showLockedScreen(settings) {
  document.body.innerHTML = '';
  document.body.className = 'site-locked-body';
  const email = (CONFIG && CONFIG.agencyContactEmail) || '';
  const phone = (CONFIG && CONFIG.agencyContactPhone) || '';
  const brand = (CONFIG && CONFIG.agencyBrandName) || 'Autor strony';
  const names = settings
    ? `${settings.brideName || ''} & ${settings.groomName || ''}`.trim()
    : '';

  document.body.innerHTML = `
    <div class="site-locked">
      <p class="site-locked-brand">${escapeCtrl(brand)}</p>
      <h1>Strona tymczasowo niedostępna</h1>
      <p>Witryna ślubna${names && names !== '&' ? ` „${escapeCtrl(names)}”` : ''} została wstrzymana.</p>
      <p>Jeśli to pomyłka lub chcesz dokończyć płatność, skontaktuj się z nami:</p>
      <p class="site-locked-contact">
        ${email ? `<a href="mailto:${escapeCtrl(email)}">${escapeCtrl(email)}</a>` : ''}
        ${phone ? `<br><a href="tel:${escapeCtrl(phone.replace(/\s/g, ''))}">${escapeCtrl(phone)}</a>` : ''}
      </p>
    </div>
  `;
}

function escapeCtrl(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function enforceAdminSiteMode(settings) {
  const mode = normalizeSiteMode(settings.siteMode);
  applyTheme(settings.theme);

  if (mode === 'locked') {
    showLockedScreen(settings);
    return mode;
  }

  let badge = document.getElementById('admin-mode-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'admin-mode-badge';
    document.body.appendChild(badge);
  }

  if (mode === 'preview') {
    badge.className = 'admin-mode-badge preview';
    badge.textContent = 'TRYB PODGLĄDU — po opłaceniu włączymy wersję live';
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
  return mode;
}
