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

  if (!dashboardInitialized) {
    initNavigation();
    initGuestModal();
    initSendModal();
    initExport();
    initSettingsForm();
    initChecklistAdd();
    document.getElementById('bulk-send-btn')?.addEventListener('click', startBulkSend);
    dashboardInitialized = true;
  }

  await refreshAll();
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
  const daysLeft = Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));
  const deadlineEl = document.getElementById('rsvp-deadline-info');
  if (deadlineEl) {
    deadlineEl.textContent = daysLeft > 0
      ? `Do terminu RSVP pozostało ${daysLeft} dni.`
      : 'Termin RSVP minął.';
  }

  updateBulkSendButton(stats.invitationsPending);
  await renderRecentResponses();
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
      <td>${g.status === 'confirmed' ? g.confirmedGuests : '—'}</td>
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

async function renderDietSummary() {
  const summary = await getDietSummary();
  const labels = {
    standard: 'Standardowe', vegetarian: 'Wegetariańskie', vegan: 'Wegańskie',
    glutenFree: 'Bezglutenowe', kids: 'Menu dla dzieci', other: 'Inne',
  };

  const container = document.getElementById('diet-summary');
  if (!container) return;

  container.innerHTML = Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `
      <div class="diet-card">
        <div class="diet-count">${count}</div>
        <div class="diet-name">${labels[key] || key}</div>
      </div>
    `).join('') || '<p style="color:var(--text-muted);">Brak potwierdzonych gości z informacją o diecie.</p>';

  const allergiesContainer = document.getElementById('allergies-list');
  if (allergiesContainer) {
    const withAllergies = (await getGuests()).filter(g => g.status === 'confirmed' && g.allergies);
    allergiesContainer.innerHTML = withAllergies.length
      ? withAllergies.map(g => `
          <div class="recent-row">
            <strong>${escapeHtml(g.name)}</strong>
            <span style="color:var(--text-muted);"> — ${escapeHtml(g.allergies)}</span>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);">Brak zgłoszonych alergii.</p>';
  }
}

const SETTINGS_FIELDS = [
  'brideName', 'groomName', 'weddingDate', 'venue', 'venueAddress',
  'venueMapUrl', 'dressCode', 'rsvpDeadline', 'contactEmail', 'contactPhone',
  'story', 'accommodation', 'gifts', 'siteUrl',
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
    if (!isUsingCloud()) {
      const pw = form.querySelector('[name="adminPassword"]');
      if (pw?.value) data.adminPassword = pw.value;
    }
    try {
      await updateSettings(data);
      msg.className = 'form-message success';
      msg.textContent = 'Ustawienia zapisane!';
      setTimeout(() => { msg.className = 'form-message'; }, 3000);
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
