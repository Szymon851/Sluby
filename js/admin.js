let dashboardInitialized = false;
let sendWizardQueue = [];
let sendWizardIndex = 0;
let currentSendGuest = null;
let currentSendMessage = '';
let isWizardMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  await initApi();
  setupLoginForm();
  configureLoginUI();

  if (await isAdminLoggedIn()) {
    await showDashboard();
  } else {
    showLogin();
  }
});

function setupLoginForm() {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('login-message');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const result = await loginAdmin(email, password);
    if (result.success) {
      await showDashboard();
    } else {
      msg.className = 'form-message error';
      msg.textContent = result.error || 'Logowanie nie powiodło się.';
    }
  });
}

function configureLoginUI() {
  const emailGroup = document.getElementById('login-email-group');
  const modeHint = document.getElementById('login-mode-hint');
  if (isUsingCloud()) {
    emailGroup.style.display = 'block';
    document.getElementById('login-email').required = true;
    modeHint.textContent = 'Zaloguj się kontem utworzonym w Supabase.';
  } else {
    emailGroup.style.display = 'none';
    document.getElementById('login-email').required = false;
    modeHint.textContent = 'Tryb lokalny — wpisz hasło ustawione w panelu Ustawienia.';
  }
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

async function showDashboard() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  const settings = await getSettings();
  const mode = enforceAdminSiteMode(settings);
  if (mode === 'locked') return;

  if (!dashboardInitialized) {
    initNavigation();
    initGuestModal();
    initSendModal();
    initExport();
    initSettingsForm();
    initChecklistAdd();
    initBudgetPanel();
    initSchedulePanel();
    initFaqPanel();
    initVendorPanel();
    initGiftPanel();
    document.getElementById('bulk-send-btn')?.addEventListener('click', startBulkSend);
    dashboardInitialized = true;
  }

  setAdminLoading(true);
  try {
    await refreshAll();
  } finally {
    setAdminLoading(false);
  }
}

function setAdminLoading(on) {
  document.getElementById('dashboard')?.classList.toggle('admin-loading', on);
}

function initNavigation() {
  document.querySelectorAll('.admin-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + panel)?.classList.add('active');
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await logoutAdmin();
    showLogin();
  });
}

async function renderDashboard() {
  const stats = await getGuestStats();
  const settings = await getSettings();

  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-confirmed').textContent = stats.confirmed;
  document.getElementById('stat-declined').textContent = stats.declined;
  document.getElementById('stat-pending').textContent = stats.pending;
  document.getElementById('stat-people').textContent = stats.totalPeople;
  document.getElementById('stat-invitations-sent').textContent = stats.invitationsSent;
  document.getElementById('stat-invitations-pending').textContent = stats.invitationsPending;

  const deadline = new Date(settings.rsvpDeadline);
  const deadlineEl = document.getElementById('rsvp-deadline-info');
  if (deadlineEl && settings.rsvpDeadline) {
    const days = Math.ceil((deadline - Date.now()) / 86400000);
    deadlineEl.textContent = days >= 0
      ? `Termin RSVP: ${deadline.toLocaleDateString('pl-PL')} (za ${days} dni)`
      : `Termin RSVP minął (${deadline.toLocaleDateString('pl-PL')})`;
  }

  await renderOnboarding(settings, stats);
  updateBulkSendButton(stats.invitationsPending);
  await renderRecentResponses();
}

async function renderOnboarding(settings, stats) {
  const list = document.getElementById('onboarding-list');
  const box = document.getElementById('onboarding-box');
  if (!list || !box) return;

  const giftCount = (await getGifts().catch(() => [])).length;
  const checks = [
    { ok: !!(settings.brideName && settings.groomName && settings.weddingDate), text: 'Imiona i data ślubu w Ustawieniach' },
    { ok: !!(settings.heroImageUrl), text: 'Zdjęcie hero (plik w img/ lub URL)' },
    { ok: !!(settings.siteUrl), text: 'Adres strony (siteUrl) — potrzebny do linków w zaproszeniach' },
    { ok: !!(settings.gifts || giftCount), text: 'Informacja o prezentach / lista' },
    { ok: stats.total > 0, text: 'Dodano pierwszego gościa' },
    { ok: normalizeSiteMode(settings.siteMode) === 'live', text: 'Strona w trybie live (ustawia wdrażający w Supabase)' },
  ];

  const pending = checks.filter(c => !c.ok).length;
  if (pending === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  list.innerHTML = checks.map(c =>
    `<li class="${c.ok ? 'done' : ''}">${c.ok ? '✓' : '○'} ${c.text}</li>`
  ).join('');
}

function updateBulkSendButton(pendingCount) {
  const btn = document.getElementById('bulk-send-btn');
  if (!btn) return;
  btn.textContent = pendingCount > 0
    ? `Wyślij do wszystkich (${pendingCount})`
    : 'Wszyscy zaproszeni';
  btn.disabled = pendingCount === 0;
}

async function renderRecentResponses() {
  const container = document.getElementById('recent-responses');
  if (!container) return;

  const guests = (await getGuests())
    .filter(g => g.respondedAt)
    .sort((a, b) => new Date(b.respondedAt) - new Date(a.respondedAt))
    .slice(0, 5);

  container.innerHTML = guests.length === 0
    ? '<p style="color: var(--text-muted);">Brak odpowiedzi na razie.</p>'
    : guests.map(g => `
      <div class="recent-row">
        <div>
          <strong>${escapeHtml(g.name)}</strong>
          <span class="badge badge-${g.status}">${statusLabel(g.status)}</span>
        </div>
        <span class="recent-date">${formatRelativeDate(g.respondedAt)}</span>
      </div>
    `).join('');
}

async function renderGuestTable(filter = '') {
  const tbody = document.getElementById('guests-table-body');
  if (!tbody) return;

  let guests = await getGuests();
  if (filter) {
    const q = filter.toLowerCase();
    guests = guests.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      g.group.toLowerCase().includes(q)
    );
  }

  tbody.innerHTML = guests.map(g => `
    <tr class="${hasInvitationBeenSent(g) ? 'row-invited' : ''}">
      <td><strong>${escapeHtml(g.name)}</strong></td>
      <td>${escapeHtml(g.email) || '—'}</td>
      <td>${escapeHtml(g.phone) || '—'}</td>
      <td><code class="code-tag">${escapeHtml(g.code)}</code></td>
      <td>${invitationBadge(g)}</td>
      <td><span class="badge badge-${g.status}">${statusLabel(g.status)}</span></td>
      <td>${g.status === 'confirmed' ? attendingCount(g) : '—'}</td>
      <td class="table-actions">
        <button type="button" data-action="send" data-id="${g.id}">Wyślij</button>
        <button type="button" data-action="edit" data-id="${g.id}">Edytuj</button>
        <button type="button" data-action="delete" data-id="${g.id}">Usuń</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'send') openSendForGuest(btn.dataset.id);
      if (action === 'edit') openGuestModal(btn.dataset.id);
      if (action === 'delete') deleteGuestConfirm(btn.dataset.id);
    });
  });
}

function invitationBadge(g) {
  if (hasInvitationBeenSent(g)) {
    return `<span class="badge badge-confirmed" title="${formatRelativeDate(g.invitationSentAt)}">Wysłane</span>`;
  }
  return '<span class="badge badge-pending">Nie wysłane</span>';
}

async function renderChecklist() {
  const container = document.getElementById('checklist');
  if (!container) return;

  const items = await getChecklist();
  container.innerHTML = items.map(item => `
    <div class="checklist-item ${item.done ? 'done' : ''}">
      <input type="checkbox" id="${item.id}" ${item.done ? 'checked' : ''} data-id="${item.id}">
      <label for="${item.id}">${escapeHtml(item.text)}</label>
      <button type="button" data-delete="${item.id}" class="checklist-delete" aria-label="Usuń">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', async () => {
      await toggleChecklistItem(cb.dataset.id);
      await renderChecklist();
      await renderDashboard();
    });
  });

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteChecklistItem(btn.dataset.delete);
      await renderChecklist();
    });
  });
}

function initChecklistAdd() {
  document.getElementById('checklist-add-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('checklist-new');
    const text = input.value.trim();
    if (text) {
      await addChecklistItem(text);
      input.value = '';
      await renderChecklist();
    }
  });
}

function dietLabel(key) {
  return {
    standard: 'Standardowe', vegetarian: 'Wegetariańskie', vegan: 'Wegańskie',
    glutenFree: 'Bezglutenowe', kids: 'Menu dla dziecka', other: 'Inne',
  }[key] || key;
}

async function renderDietSummary() {
  const summary = await getDietSummary();
  const guests = await getGuests();
  const peopleRows = flattenPeople(guests.filter(g => g.status === 'confirmed'));

  const container = document.getElementById('diet-summary');
  if (container) {
    container.innerHTML = Object.entries(summary)
      .filter(([, v]) => v.count > 0)
      .map(([key, v]) => `
        <details class="diet-card">
          <summary>
            <div class="diet-count">${v.count}</div>
            <div class="diet-name">${dietLabel(key)}</div>
          </summary>
          <ul class="diet-names">${v.names.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        </details>
      `).join('') || '<p style="color:var(--text-muted);">Brak potwierdzonych gości z informacją o diecie.</p>';
  }

  const allergiesContainer = document.getElementById('allergies-list');
  if (allergiesContainer) {
    const withAllergies = peopleRows.filter(({ person }) => person.allergies);
    allergiesContainer.innerHTML = withAllergies.length
      ? withAllergies.map(({ person }) => `
          <div class="recent-row">
            <strong>${escapeHtml(person.name)}</strong>
            <span style="color:var(--text-muted);"> — ${escapeHtml(person.allergies)}</span>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);">Brak zgłoszonych alergii.</p>';
  }
}

async function renderSongsList() {
  const el = document.getElementById('songs-list');
  if (!el) return;
  const songs = flattenPeople(await getGuests())
    .filter(({ person }) => person.songTitle || person.songArtist);
  el.innerHTML = songs.length
    ? songs.map(({ person }) => {
        const track = personSong(person);
        return `<div class="recent-row"><strong>${escapeHtml(person.name)}</strong><span> — ${escapeHtml(track)}</span></div>`;
      }).join('')
    : '<p style="color:var(--text-muted);">Brak próśb o piosenkę.</p>';
}

async function renderMessagesList() {
  const el = document.getElementById('messages-list');
  if (!el) return;
  const msgs = (await getGuests()).filter(g => g.message);
  el.innerHTML = msgs.length
    ? msgs.map(g => `
        <div class="message-card">
          <strong>${escapeHtml(g.name)}</strong>
          <p>${escapeHtml(g.message)}</p>
        </div>
      `).join('')
    : '<p style="color:var(--text-muted);">Brak wiadomości.</p>';
}

const SETTINGS_FIELDS = [
  'brideName', 'groomName', 'weddingDate', 'venue', 'venueAddress',
  'venueMapUrl', 'dressCode', 'rsvpDeadline', 'contactEmail', 'contactPhone',
  'story', 'accommodation', 'gifts', 'giftsLink',
  'heroImageUrl', 'galleryUrls', 'theme', 'siteUrl',
];

function initSettingsForm() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const pwGroup = document.getElementById('admin-password-group');
  const resetGroup = document.getElementById('reset-data-group');
  if (pwGroup) pwGroup.style.display = isUsingCloud() ? 'none' : 'block';
  if (resetGroup) resetGroup.style.display = isUsingCloud() ? 'none' : 'block';

  populateSettingsForm();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('settings-message');
    const data = {};
    SETTINGS_FIELDS.forEach(field => {
      const input = form.querySelector(`[name="${field}"]`);
      if (input) {
        let val = input.value;
        if (field === 'weddingDate' && val && val.length === 10) val += 'T15:00:00';
        data[field] = val;
      }
    });

    // Walidacja: RSVP przed datą ślubu
    if (data.rsvpDeadline && data.weddingDate) {
      const rsvp = new Date(data.rsvpDeadline);
      const wedding = new Date(data.weddingDate);
      if (rsvp > wedding) {
        msg.className = 'form-message error';
        msg.textContent = 'Termin RSVP nie może być po dacie ślubu.';
        return;
      }
    }

    if (!isUsingCloud()) {
      const pw = form.querySelector('[name="adminPassword"]');
      if (pw?.value) data.adminPassword = pw.value;
    }
    try {
      await updateSettings(data);
      applyTheme(data.theme);
      msg.className = 'form-message success';
      msg.textContent = 'Ustawienia zapisane!';
      setTimeout(() => { msg.className = 'form-message'; }, 3000);
      await renderOnboarding(await getSettings(), await getGuestStats());
    } catch (err) {
      msg.className = 'form-message error';
      msg.textContent = 'Błąd zapisu: ' + err.message;
    }
  });
}

async function populateSettingsForm() {
  const settings = await getSettings();
  const form = document.getElementById('settings-form');
  if (!form) return;

  applyTheme(settings.theme);

  SETTINGS_FIELDS.forEach(field => {
    const input = form.querySelector(`[name="${field}"]`);
    if (!input) return;
    let val = settings[field] || '';
    if (field === 'weddingDate' && val) val = val.slice(0, 16);
    if (field === 'rsvpDeadline' && val) val = val.slice(0, 10);
    input.value = val;
  });
}

function initGuestModal() {
  document.getElementById('add-guest-btn')?.addEventListener('click', () => openGuestModal());
  document.getElementById('guest-modal-cancel')?.addEventListener('click', closeGuestModal);
  document.getElementById('regenerate-code-btn')?.addEventListener('click', async () => {
    const guests = await getGuests();
    document.getElementById('guest-code').value = generateUniqueCode(guests.map(g => g.code));
  });

  document.getElementById('guest-search')?.addEventListener('input', (e) => {
    renderGuestTable(e.target.value);
  });

  document.getElementById('guest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('guest-edit-id').value;
    const guestData = {
      name: document.getElementById('guest-name').value.trim(),
      email: document.getElementById('guest-email').value.trim(),
      phone: document.getElementById('guest-phone').value.trim(),
      code: document.getElementById('guest-code').value.trim().toUpperCase(),
      group: document.getElementById('guest-group').value.trim(),
      maxGuests: parseInt(document.getElementById('guest-max').value, 10) || 1,
    };
    if (!guestData.name) return;

    try {
      if (id) await updateGuest(id, guestData);
      else await addGuest(guestData);
      closeGuestModal();
      await refreshAll();
    } catch (err) {
      alert('Błąd: ' + err.message);
    }
  });
}

async function openGuestModal(id) {
  const modal = document.getElementById('guest-modal');
  document.getElementById('guest-form').reset();
  document.getElementById('guest-edit-id').value = '';
  document.getElementById('guest-code').readOnly = false;

  if (id) {
    const guest = await getGuestById(id);
    if (guest) {
      document.getElementById('guest-modal-title').textContent = 'Edytuj gościa';
      document.getElementById('guest-edit-id').value = guest.id;
      document.getElementById('guest-name').value = guest.name;
      document.getElementById('guest-email').value = guest.email;
      document.getElementById('guest-phone').value = guest.phone;
      document.getElementById('guest-code').value = guest.code;
      document.getElementById('guest-code').readOnly = true;
      document.getElementById('guest-group').value = guest.group;
      document.getElementById('guest-max').value = guest.maxGuests;
    }
  } else {
    document.getElementById('guest-modal-title').textContent = 'Dodaj gościa';
    const guests = await getGuests();
    document.getElementById('guest-code').value = generateUniqueCode(guests.map(g => g.code));
    document.getElementById('guest-code').readOnly = true;
  }

  modal.classList.add('open');
}

function closeGuestModal() {
  document.getElementById('guest-modal')?.classList.remove('open');
}

async function deleteGuestConfirm(id) {
  const guest = await getGuestById(id);
  if (guest && confirm(`Czy na pewno usunąć gościa "${guest.name}"?`)) {
    await deleteGuest(id);
    await refreshAll();
  }
}

/* ===== Wysyłka zaproszeń ===== */

function initSendModal() {
  document.getElementById('send-modal-close')?.addEventListener('click', closeSendModal);
  document.getElementById('send-modal-skip')?.addEventListener('click', () => advanceWizard(false));
  document.getElementById('send-mark-sent')?.addEventListener('click', () => advanceWizard(true));
  document.getElementById('send-via-whatsapp')?.addEventListener('click', () => openChannel('whatsapp'));
  document.getElementById('send-via-sms')?.addEventListener('click', () => openChannel('sms'));
  document.getElementById('send-via-email')?.addEventListener('click', () => openChannel('email'));
  document.getElementById('send-via-copy')?.addEventListener('click', () => openChannel('copy'));
}

async function openSendForGuest(guestId) {
  const guest = await getGuestById(guestId);
  if (!guest) return;

  if (hasInvitationBeenSent(guest)) {
    const date = formatRelativeDate(guest.invitationSentAt);
    if (!confirm(`${guest.name} ma już wysłane zaproszenie (${date}). Wysłać ponownie?`)) return;
  }

  sendWizardQueue = [];
  isWizardMode = false;
  await showSendModal(guest);
}

async function startBulkSend() {
  const settings = await getSettings();
  if (normalizeSiteMode(settings.siteMode) === 'preview') {
    if (!confirm('Strona jest w trybie PODGLĄDU.\nGoście zobaczą baner „demo”. Na serio wysyłać zaproszenia dopiero po trybie live.\n\nKontynuować mimo to?')) {
      return;
    }
  }

  const guests = await getGuests();
  sendWizardQueue = getUnsentGuests(guests);

  if (sendWizardQueue.length === 0) {
    alert('Wszyscy goście mają już wysłane zaproszenia.');
    return;
  }

  if (!confirm(`Wysłać zaproszenia do ${sendWizardQueue.length} gości?\n\nPrzejdziesz przez każdą osobę po kolei. Osoby z już wysłanym zaproszeniem zostaną pominięte.`)) {
    return;
  }

  isWizardMode = true;
  sendWizardIndex = 0;
  await showSendModal(sendWizardQueue[0]);
}

async function showSendModal(guest) {
  currentSendGuest = guest;
  currentSendMessage = await buildInviteMessage(guest);

  const modal = document.getElementById('send-modal');
  document.getElementById('send-modal-title').textContent = `Zaproszenie — ${guest.name}`;
  document.getElementById('send-message-preview').value = currentSendMessage;

  const progress = document.getElementById('send-modal-progress');
  const skipBtn = document.getElementById('send-modal-skip');
  const warning = document.getElementById('send-modal-warning');

  if (isWizardMode) {
    progress.textContent = `Gość ${sendWizardIndex + 1} z ${sendWizardQueue.length}`;
    progress.style.display = 'block';
    skipBtn.style.display = 'inline-flex';
  } else {
    progress.style.display = 'none';
    skipBtn.style.display = 'none';
  }

  if (hasInvitationBeenSent(guest) && !isWizardMode) {
    warning.className = 'form-message info';
    warning.textContent = `Uwaga: zaproszenie wysłano ${formatRelativeDate(guest.invitationSentAt)}.`;
  } else {
    warning.className = 'form-message';
    warning.textContent = '';
  }

  document.getElementById('send-via-whatsapp').disabled = !guest.phone;
  document.getElementById('send-via-sms').disabled = !guest.phone;
  document.getElementById('send-via-email').disabled = !guest.email;

  modal.classList.add('open');
}

function closeSendModal() {
  document.getElementById('send-modal')?.classList.remove('open');
  currentSendGuest = null;
  sendWizardQueue = [];
  isWizardMode = false;
}

async function openChannel(channel) {
  if (!currentSendGuest) return;
  const guest = currentSendGuest;
  const message = currentSendMessage;

  if (channel === 'whatsapp') {
    const url = getWhatsAppUrl(guest.phone, message);
    if (url) window.open(url, '_blank');
    else alert('Brak numeru telefonu — dodaj go w edycji gościa.');
  } else if (channel === 'sms') {
    window.location.href = getSmsUrl(guest.phone, message);
  } else if (channel === 'email') {
    const url = getEmailUrl(guest.email, guest, message);
    if (url) window.location.href = url;
    else alert('Brak adresu e-mail — dodaj go w edycji gościa.');
  } else if (channel === 'copy') {
    try {
      await navigator.clipboard.writeText(message);
      alert('Wiadomość skopiowana! Wklej ją w wybranym komunikatorze.');
    } catch {
      prompt('Skopiuj wiadomość:', message);
    }
  }
}

async function advanceWizard(markSent) {
  if (!currentSendGuest) return;

  if (markSent) {
    await markInvitationSent(currentSendGuest.id);
  }

  if (isWizardMode) {
    sendWizardIndex++;
    if (sendWizardIndex < sendWizardQueue.length) {
      await refreshAll();
      await showSendModal(sendWizardQueue[sendWizardIndex]);
    } else {
      closeSendModal();
      await refreshAll();
      alert(markSent ? 'Zakończono wysyłanie zaproszeń!' : 'Wizard zakończony.');
    }
  } else {
    if (markSent) {
      closeSendModal();
      await refreshAll();
    } else {
      closeSendModal();
    }
  }
}

function initExport() {
  document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
    const csv = await exportGuestsCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goscie-slub.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('reset-data-btn')?.addEventListener('click', async () => {
    if (!isUsingCloud() && confirm('Czy na pewno zresetować wszystkie dane do domyślnych?')) {
      await resetData();
      await refreshAll();
      alert('Dane zresetowane.');
    }
  });
}

async function refreshAll() {
  await renderDashboard();
  await renderGuestTable(document.getElementById('guest-search')?.value || '');
  await renderChecklist();
  await renderDietSummary();
  await renderSongsList();
  await renderMessagesList();
  await renderBudget();
  await renderScheduleAdmin();
  await renderFaqAdmin();
  await renderVendors();
  await renderGiftsAdmin();
}

function formatMoney(n) {
  return (Number(n) || 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' zł';
}

function budgetPaidTotal(item) {
  return (item.payments || []).filter(p => p.isPaid).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function budgetRemaining(item) {
  const base = Number(item.contracted) || Number(item.estimated) || 0;
  return Math.max(0, base - budgetPaidTotal(item));
}

function paymentStatusClass(p) {
  if (p.isPaid) return 'paid';
  if (p.dueDate && new Date(p.dueDate) < new Date(new Date().toDateString())) return 'overdue';
  return 'pending';
}

function paymentStatusLabel(p) {
  if (p.isPaid) return 'Zapłacone';
  if (p.dueDate && new Date(p.dueDate) < new Date(new Date().toDateString())) return 'Po terminie';
  return 'Oczekuje';
}

let budgetExpanded = new Set();

function initBudgetPanel() {
  document.getElementById('budget-add-item-btn')?.addEventListener('click', () => openBudgetItemModal());
  document.getElementById('budget-export-btn')?.addEventListener('click', async () => {
    try {
      const csv = await exportBudgetCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'budzet-wesela.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert('Eksport nieudany: ' + (err.message || err));
    }
  });
  document.getElementById('budget-seed-btn')?.addEventListener('click', async () => {
    try {
      const before = (await getBudgetItems()).length;
      await seedBudgetDefaults();
      const after = (await getBudgetItems()).length;
      if (after === before && before > 0) {
        alert('Przykładowe pozycje są już na liście. Dodaj nowe ręcznie.');
      }
      await renderBudget();
    } catch (err) {
      alert('Nie udało się dodać przykładów. Sprawdź, czy uruchomiłeś supabase/budget.sql.\n' + (err.message || ''));
    }
  });
  document.getElementById('budget-category-filter')?.addEventListener('change', () => renderBudget());
  document.getElementById('budget-item-cancel')?.addEventListener('click', () => closeModal('budget-item-modal'));
  document.getElementById('budget-payment-cancel')?.addEventListener('click', () => closeModal('budget-payment-modal'));

  document.getElementById('budget-item-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('budget-item-edit-id').value;
    const payload = {
      category: document.getElementById('budget-item-category').value.trim(),
      name: document.getElementById('budget-item-name').value.trim(),
      estimated: parseFloat(document.getElementById('budget-item-estimated').value) || 0,
      contracted: parseFloat(document.getElementById('budget-item-contracted').value) || 0,
      notes: document.getElementById('budget-item-notes').value.trim(),
    };
    if (id) await updateBudgetItem(id, payload);
    else await addBudgetItem(payload);
    closeModal('budget-item-modal');
    await renderBudget();
  });

  document.getElementById('budget-payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = document.getElementById('budget-payment-item-id').value;
    const paymentId = document.getElementById('budget-payment-edit-id').value;
    const payload = {
      label: document.getElementById('budget-payment-label').value.trim(),
      amount: parseFloat(document.getElementById('budget-payment-amount').value) || 0,
      dueDate: document.getElementById('budget-payment-due').value || null,
      isPaid: document.getElementById('budget-payment-paid').checked,
      notes: document.getElementById('budget-payment-notes').value.trim(),
    };
    if (paymentId) await updateBudgetPayment(itemId, paymentId, payload);
    else await addBudgetPayment(itemId, payload);
    budgetExpanded.add(itemId);
    closeModal('budget-payment-modal');
    await renderBudget();
  });
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function openBudgetItemModal(item) {
  document.getElementById('budget-item-modal-title').textContent = item ? 'Edytuj pozycję' : 'Dodaj pozycję';
  document.getElementById('budget-item-edit-id').value = item?.id || '';
  document.getElementById('budget-item-category').value = item?.category || '';
  document.getElementById('budget-item-name').value = item?.name || '';
  document.getElementById('budget-item-estimated').value = item?.estimated ?? 0;
  document.getElementById('budget-item-contracted').value = item?.contracted ?? 0;
  document.getElementById('budget-item-notes').value = item?.notes || '';
  openModal('budget-item-modal');
}

function openBudgetPaymentModal(itemId, payment) {
  document.getElementById('budget-payment-modal-title').textContent = payment ? 'Edytuj ratę' : 'Dodaj ratę';
  document.getElementById('budget-payment-item-id').value = itemId;
  document.getElementById('budget-payment-edit-id').value = payment?.id || '';
  document.getElementById('budget-payment-label').value = payment?.label || '';
  document.getElementById('budget-payment-amount').value = payment?.amount ?? '';
  document.getElementById('budget-payment-due').value = payment?.dueDate || '';
  document.getElementById('budget-payment-paid').checked = !!payment?.isPaid;
  document.getElementById('budget-payment-notes').value = payment?.notes || '';
  openModal('budget-payment-modal');
}

async function renderBudget() {
  const tbody = document.getElementById('budget-table-body');
  if (!tbody) return;

  let items = [];
  try {
    items = await getBudgetItems();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted);padding:24px;">
      Brak tabel budżetu w bazie. Uruchom plik <code>supabase/budget.sql</code> w SQL Editorze Supabase.
    </td></tr>`;
    return;
  }

  const filter = document.getElementById('budget-category-filter')?.value || '';
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
  const filterSelect = document.getElementById('budget-category-filter');
  if (filterSelect) {
    const current = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Wszystkie kategorie</option>' +
      categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    filterSelect.value = categories.includes(current) ? current : '';
  }

  const datalist = document.getElementById('budget-categories-list');
  if (datalist) {
    const defaults = ['Sala', 'Catering', 'Fotograf', 'Muzyka', 'Dekoracje', 'Ubrania', 'Pierścienie', 'Transport', 'Inne'];
    const all = [...new Set([...defaults, ...categories])];
    datalist.innerHTML = all.map(c => `<option value="${escapeHtml(c)}">`).join('');
  }

  const visible = filter ? items.filter(i => i.category === filter) : items;

  const sumEst = items.reduce((s, i) => s + (Number(i.estimated) || 0), 0);
  const sumCon = items.reduce((s, i) => s + (Number(i.contracted) || Number(i.estimated) || 0), 0);
  const sumPaid = items.reduce((s, i) => s + budgetPaidTotal(i), 0);
  const sumRem = Math.max(0, sumCon - sumPaid);

  setBudgetStat('budget-stat-estimated', formatMoney(sumEst));
  setBudgetStat('budget-stat-contracted', formatMoney(sumCon));
  setBudgetStat('budget-stat-paid', formatMoney(sumPaid));
  setBudgetStat('budget-stat-remaining', formatMoney(sumRem));

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted);padding:24px;">
      Brak pozycji. Kliknij „+ Pozycja” lub „Dodaj przykładowe”.
    </td></tr>`;
  } else {
    tbody.innerHTML = visible.map(item => {
      const paid = budgetPaidTotal(item);
      const rem = budgetRemaining(item);
      const open = budgetExpanded.has(item.id);
      const payments = (item.payments || []).slice().sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
      return `
        <tr class="budget-row ${open ? 'expanded' : ''}" data-id="${item.id}">
          <td><button type="button" class="budget-expand" data-action="toggle" data-id="${item.id}" aria-label="Raty">${open ? '▾' : '▸'}</button></td>
          <td>${escapeHtml(item.category)}</td>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.notes ? `<div class="budget-notes">${escapeHtml(item.notes)}</div>` : ''}
          </td>
          <td class="num">${formatMoney(item.estimated)}</td>
          <td class="num">${formatMoney(item.contracted)}</td>
          <td class="num">${formatMoney(paid)}</td>
          <td class="num ${rem > 0 ? 'budget-due' : ''}">${formatMoney(rem)}</td>
          <td class="actions">
            <button type="button" class="btn btn-sm btn-secondary" data-action="add-pay" data-id="${item.id}">+ Rata</button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="edit-item" data-id="${item.id}">Edytuj</button>
            <button type="button" class="btn btn-sm btn-danger" data-action="del-item" data-id="${item.id}">Usuń</button>
          </td>
        </tr>
        <tr class="budget-payments-row ${open ? 'open' : ''}" data-parent="${item.id}">
          <td colspan="8">
            ${payments.length ? `
              <table class="budget-payments-table">
                <thead>
                  <tr><th>Opis</th><th>Kwota</th><th>Termin</th><th>Status</th><th>Notatki</th><th></th></tr>
                </thead>
                <tbody>
                  ${payments.map(p => `
                    <tr class="pay-${paymentStatusClass(p)}">
                      <td>${escapeHtml(p.label)}</td>
                      <td class="num">${formatMoney(p.amount)}</td>
                      <td>${p.dueDate ? formatRelativeDate(p.dueDate) : '—'}</td>
                      <td>
                        <label class="pay-check">
                          <input type="checkbox" data-action="toggle-pay" data-item="${item.id}" data-pay="${p.id}" ${p.isPaid ? 'checked' : ''}>
                          <span class="badge badge-${p.isPaid ? 'confirmed' : paymentStatusClass(p) === 'overdue' ? 'declined' : 'pending'}">${paymentStatusLabel(p)}</span>
                        </label>
                      </td>
                      <td>${escapeHtml(p.notes || '')}</td>
                      <td class="actions">
                        <button type="button" class="btn btn-sm btn-secondary" data-action="edit-pay" data-item="${item.id}" data-pay="${p.id}">Edytuj</button>
                        <button type="button" class="btn btn-sm btn-danger" data-action="del-pay" data-item="${item.id}" data-pay="${p.id}">Usuń</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="budget-empty-pays">Brak rat — dodaj zaliczkę, ratę lub saldo.</p>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  tbody.querySelectorAll('button[data-action], input[data-action]').forEach(el => {
    const handler = async () => {
      const action = el.dataset.action;
      const id = el.dataset.id;
      const itemId = el.dataset.item;
      const payId = el.dataset.pay;
      const item = items.find(i => i.id === (id || itemId));

      if (action === 'toggle') {
        if (budgetExpanded.has(id)) budgetExpanded.delete(id);
        else budgetExpanded.add(id);
        await renderBudget();
      }
      if (action === 'edit-item' && item) openBudgetItemModal(item);
      if (action === 'add-pay') openBudgetPaymentModal(id);
      if (action === 'del-item' && confirm('Usunąć pozycję wraz z ratami?')) {
        await deleteBudgetItem(id);
        await renderBudget();
      }
      if (action === 'edit-pay' && item) {
        const pay = (item.payments || []).find(p => p.id === payId);
        if (pay) openBudgetPaymentModal(itemId, pay);
      }
      if (action === 'del-pay' && confirm('Usunąć tę ratę?')) {
        await deleteBudgetPayment(itemId, payId);
        await renderBudget();
      }
      if (action === 'toggle-pay') {
        await updateBudgetPayment(itemId, payId, { isPaid: el.checked });
        await renderBudget();
      }
    };
    if (el.tagName === 'INPUT') el.addEventListener('change', handler);
    else el.addEventListener('click', handler);
  });

  renderBudgetUpcoming(items);
}

function setBudgetStat(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderBudgetUpcoming(items) {
  const container = document.getElementById('budget-upcoming');
  if (!container) return;

  const upcoming = items.flatMap(item =>
    (item.payments || [])
      .filter(p => !p.isPaid)
      .map(p => ({ ...p, itemName: item.name, category: item.category }))
  ).sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));

  if (!upcoming.length) {
    container.innerHTML = '<p style="color:var(--text-muted);">Brak zaplanowanych niezapłaconych rat.</p>';
    return;
  }

  container.innerHTML = upcoming.slice(0, 12).map(p => `
    <div class="recent-row budget-upcoming-row ${paymentStatusClass(p)}">
      <div>
        <strong>${escapeHtml(p.label)}</strong>
        <span style="color:var(--text-muted);"> — ${escapeHtml(p.itemName)} (${escapeHtml(p.category)})</span>
      </div>
      <div class="budget-upcoming-meta">
        <span>${formatMoney(p.amount)}</span>
        <span class="badge badge-${paymentStatusClass(p) === 'overdue' ? 'declined' : 'pending'}">
          ${p.dueDate ? formatRelativeDate(p.dueDate) : 'bez terminu'}
        </span>
      </div>
    </div>
  `).join('');
}

function initSchedulePanel() {
  document.getElementById('schedule-add-btn')?.addEventListener('click', () => openScheduleModal());
  document.getElementById('schedule-cancel')?.addEventListener('click', () => closeModal('schedule-modal'));
  document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('schedule-edit-id').value;
    const payload = {
      time: document.getElementById('schedule-time').value.trim(),
      title: document.getElementById('schedule-title').value.trim(),
      description: document.getElementById('schedule-desc').value.trim(),
      sortOrder: parseInt(document.getElementById('schedule-order').value, 10) || 1,
    };
    if (id) await updateScheduleItem(id, payload);
    else await addScheduleItem(payload);
    closeModal('schedule-modal');
    await renderScheduleAdmin();
  });
}

function openScheduleModal(item) {
  document.getElementById('schedule-modal-title').textContent = item ? 'Edytuj pozycję' : 'Dodaj pozycję';
  document.getElementById('schedule-edit-id').value = item?.id || '';
  document.getElementById('schedule-time').value = item?.time || '';
  document.getElementById('schedule-title').value = item?.title || '';
  document.getElementById('schedule-desc').value = item?.description || '';
  document.getElementById('schedule-order').value = item?.sortOrder ?? 1;
  openModal('schedule-modal');
}

async function renderScheduleAdmin() {
  const tbody = document.getElementById('schedule-table-body');
  if (!tbody) return;
  const items = await getSchedule();
  tbody.innerHTML = items.length ? items.map(item => `
    <tr>
      <td>${escapeHtml(item.time)}</td>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${escapeHtml(item.description || '')}</td>
      <td>${item.sortOrder}</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit" data-id="${item.id}">Edytuj</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="del" data-id="${item.id}">Usuń</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5" style="color:var(--text-muted);padding:20px;">Brak pozycji.</td></tr>';

  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = items.find(i => i.id === btn.dataset.id);
      if (btn.dataset.action === 'edit' && item) openScheduleModal(item);
      if (btn.dataset.action === 'del' && confirm('Usunąć tę pozycję?')) {
        await deleteScheduleItem(btn.dataset.id);
        await renderScheduleAdmin();
      }
    });
  });
}

function initFaqPanel() {
  document.getElementById('faq-add-btn')?.addEventListener('click', () => openFaqModal());
  document.getElementById('faq-cancel')?.addEventListener('click', () => closeModal('faq-modal'));
  document.getElementById('faq-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('faq-edit-id').value;
    const payload = {
      question: document.getElementById('faq-question').value.trim(),
      answer: document.getElementById('faq-answer').value.trim(),
      sortOrder: parseInt(document.getElementById('faq-order').value, 10) || 1,
    };
    if (id) await updateFaqItem(id, payload);
    else await addFaqItem(payload);
    closeModal('faq-modal');
    await renderFaqAdmin();
  });
}

function openFaqModal(item) {
  document.getElementById('faq-modal-title').textContent = item ? 'Edytuj pytanie' : 'Dodaj pytanie';
  document.getElementById('faq-edit-id').value = item?.id || '';
  document.getElementById('faq-question').value = item?.question || '';
  document.getElementById('faq-answer').value = item?.answer || '';
  document.getElementById('faq-order').value = item?.sortOrder ?? 1;
  openModal('faq-modal');
}

async function renderFaqAdmin() {
  const tbody = document.getElementById('faq-table-body');
  if (!tbody) return;
  const items = await getFaq();
  tbody.innerHTML = items.length ? items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.question)}</strong></td>
      <td>${escapeHtml(item.answer)}</td>
      <td>${item.sortOrder}</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit" data-id="${item.id}">Edytuj</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="del" data-id="${item.id}">Usuń</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--text-muted);padding:20px;">Brak pytań.</td></tr>';

  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = items.find(i => i.id === btn.dataset.id);
      if (btn.dataset.action === 'edit' && item) openFaqModal(item);
      if (btn.dataset.action === 'del' && confirm('Usunąć to pytanie?')) {
        await deleteFaqItem(btn.dataset.id);
        await renderFaqAdmin();
      }
    });
  });
}

function initVendorPanel() {
  document.getElementById('vendor-add-btn')?.addEventListener('click', () => openVendorModal());
  document.getElementById('vendor-cancel')?.addEventListener('click', () => closeModal('vendor-modal'));
  document.getElementById('vendor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vendor-edit-id').value;
    const payload = {
      name: document.getElementById('vendor-name').value.trim(),
      role: document.getElementById('vendor-role').value.trim(),
      phone: document.getElementById('vendor-phone').value.trim(),
      email: document.getElementById('vendor-email').value.trim(),
      contractDate: document.getElementById('vendor-contract').value || '',
      notes: document.getElementById('vendor-notes').value.trim(),
    };
    try {
      if (id) await updateVendor(id, payload);
      else await addVendor(payload);
      closeModal('vendor-modal');
      await renderVendors();
    } catch (err) {
      alert('Błąd: ' + (err.message || err) + '\nUruchom supabase/vendors.sql jeśli tabela nie istnieje.');
    }
  });
}

function openVendorModal(item) {
  document.getElementById('vendor-modal-title').textContent = item ? 'Edytuj dostawcę' : 'Dodaj dostawcę';
  document.getElementById('vendor-edit-id').value = item?.id || '';
  document.getElementById('vendor-name').value = item?.name || '';
  document.getElementById('vendor-role').value = item?.role || '';
  document.getElementById('vendor-phone').value = item?.phone || '';
  document.getElementById('vendor-email').value = item?.email || '';
  document.getElementById('vendor-contract').value = item?.contractDate || '';
  document.getElementById('vendor-notes').value = item?.notes || '';
  openModal('vendor-modal');
}

async function renderVendors() {
  const tbody = document.getElementById('vendors-table-body');
  if (!tbody) return;
  let items = [];
  try {
    items = await getVendors();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted);padding:20px;">
      Brak tabeli dostawców. Uruchom <code>supabase/vendors.sql</code>.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = items.length ? items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong>
        ${item.notes ? `<div class="budget-notes">${escapeHtml(item.notes)}</div>` : ''}
      </td>
      <td>${escapeHtml(item.role)}</td>
      <td>${escapeHtml(item.phone)}</td>
      <td>${escapeHtml(item.email)}</td>
      <td>${item.contractDate ? formatRelativeDate(item.contractDate) : '—'}</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit" data-id="${item.id}">Edytuj</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="del" data-id="${item.id}">Usuń</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6" style="color:var(--text-muted);padding:20px;">Brak dostawców.</td></tr>';

  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = items.find(i => i.id === btn.dataset.id);
      if (btn.dataset.action === 'edit' && item) openVendorModal(item);
      if (btn.dataset.action === 'del' && confirm('Usunąć dostawcę?')) {
        await deleteVendor(btn.dataset.id);
        await renderVendors();
      }
    });
  });
}

function initGiftPanel() {
  document.getElementById('gift-add-btn')?.addEventListener('click', () => openGiftModal());
  document.getElementById('gift-cancel')?.addEventListener('click', () => closeModal('gift-modal'));
  document.getElementById('gift-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('gift-edit-id').value;
    const payload = {
      name: document.getElementById('gift-name').value.trim(),
      url: document.getElementById('gift-url').value.trim(),
      notes: document.getElementById('gift-notes').value.trim(),
      sortOrder: parseInt(document.getElementById('gift-sort').value, 10) || 0,
    };
    try {
      if (id) await updateGift(id, payload);
      else await addGift(payload);
      closeModal('gift-modal');
      await renderGiftsAdmin();
    } catch (err) {
      alert('Błąd: ' + (err.message || err) + '\nUruchom supabase/gifts.sql jeśli tabela nie istnieje.');
    }
  });
}

function openGiftModal(item) {
  document.getElementById('gift-modal-title').textContent = item ? 'Edytuj prezent' : 'Dodaj prezent';
  document.getElementById('gift-edit-id').value = item?.id || '';
  document.getElementById('gift-name').value = item?.name || '';
  document.getElementById('gift-url').value = item?.url || '';
  document.getElementById('gift-notes').value = item?.notes || '';
  document.getElementById('gift-sort').value = item?.sortOrder ?? 0;
  openModal('gift-modal');
}

async function renderGiftsAdmin() {
  const tbody = document.getElementById('gifts-table-body');
  if (!tbody) return;
  let items = [];
  try {
    items = await getGifts();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);padding:20px;">
      Brak tabeli prezentów. Uruchom <code>supabase/gifts.sql</code>.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = items.length ? items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong>
        ${item.notes ? `<div class="budget-notes">${escapeHtml(item.notes)}</div>` : ''}
      </td>
      <td>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Link</a>` : '—'}</td>
      <td>${item.claimedByGuestId
        ? `<span class="badge badge-confirmed">Zajęte</span> ${escapeHtml(item.claimerName || '')}`
        : '<span class="badge badge-pending">Wolne</span>'}</td>
      <td>${item.sortOrder}</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit" data-id="${item.id}">Edytuj</button>
        ${item.claimedByGuestId
          ? `<button type="button" class="btn btn-sm btn-secondary" data-action="clear" data-id="${item.id}">Zwolnij</button>`
          : ''}
        <button type="button" class="btn btn-sm btn-danger" data-action="del" data-id="${item.id}">Usuń</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5" style="color:var(--text-muted);padding:20px;">Brak prezentów na liście.</td></tr>';

  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = items.find(i => i.id === btn.dataset.id);
      if (btn.dataset.action === 'edit' && item) openGiftModal(item);
      if (btn.dataset.action === 'clear' && item && confirm('Zwolnić ten prezent?')) {
        await updateGift(item.id, { claimedByGuestId: null });
        await renderGiftsAdmin();
      }
      if (btn.dataset.action === 'del' && confirm('Usunąć prezent z listy?')) {
        await deleteGift(btn.dataset.id);
        await renderGiftsAdmin();
      }
    });
  });
}

function statusLabel(status) {
  return { confirmed: 'Potwierdzone', declined: 'Odmowa', pending: 'Oczekujące' }[status] || status;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
