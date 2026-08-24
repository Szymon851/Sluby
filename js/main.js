document.addEventListener('DOMContentLoaded', async () => {
  setPageLoading(true);
  try {
    await initApi();
    const settings = await getSettings();
    const mode = enforcePublicSiteMode(settings);
    if (mode === 'locked') return;

    initNavigation();
    initFAQ();
    initGalleryLightbox();
    await renderPageContent();
    initCountdown();
    await initRSVP();
    await personalizeFromInviteCode();
    wireGiftsListLink();
  } finally {
    setPageLoading(false);
  }
});

function setPageLoading(on) {
  document.body.classList.toggle('page-loading', on);
  const loader = document.getElementById('page-loader');
  if (loader) loader.hidden = !on;
}

function initNavigation() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => links.classList.remove('open'));
    });
  }
}

async function renderPageContent() {
  const settings = await getSettings();
  const schedule = await getSchedule();
  const faq = await getFaq();

  const title = `${settings.brideName} & ${settings.groomName} — Nasz Ślub`;
  document.title = title;
  setMeta('og-title', title);
  setMeta('og-description', `Zaproszenie na ślub ${settings.brideName} & ${settings.groomName} — ${formatDate(settings.weddingDate)}`);
  setMeta('meta-description', `Zaproszenie na ślub — ${settings.brideName} & ${settings.groomName}`);

  const heroUrl = settings.heroImageUrl || 'img/hero.jpg';
  applyHeroImage(heroUrl);
  setMeta('og-image', resolveAbsoluteUrl(heroUrl));

  setText('hero-bride', settings.brideName);
  setText('hero-groom', settings.groomName);
  setText('nav-logo', `${settings.brideName} & ${settings.groomName}`);
  setText('hero-date', formatWeddingDate(settings.weddingDate));
  setText('hero-venue', settings.venue);
  setText('footer-names', `${settings.brideName} & ${settings.groomName}`);
  setText('footer-date', formatWeddingDate(settings.weddingDate));

  setText('story-text', settings.story);
  setText('venue-name', settings.venue);
  setText('venue-address', settings.venueAddress);
  setText('dress-code-text', settings.dressCode);
  setText('accommodation-text', settings.accommodation);
  setText('gifts-text', settings.gifts);
  setText('rsvp-deadline', formatDate(settings.rsvpDeadline));
  setText('contact-email', settings.contactEmail);
  setText('contact-phone', settings.contactPhone);

  renderGallery(parseGalleryUrls(settings.galleryUrls));
  applyTheme(settings.theme);

  const mapLink = document.getElementById('venue-map-link');
  if (mapLink && settings.venueMapUrl) mapLink.href = settings.venueMapUrl;

  const emailLink = document.getElementById('contact-email-link');
  if (emailLink) emailLink.href = 'mailto:' + settings.contactEmail;

  const phoneLink = document.getElementById('contact-phone-link');
  if (phoneLink) phoneLink.href = 'tel:' + settings.contactPhone.replace(/\s/g, '');

  renderSchedule(schedule);
  renderFAQ(faq);
}

function applyHeroImage(url) {
  const hero = document.getElementById('hero');
  if (!hero || !url) return;
  hero.style.backgroundImage = `linear-gradient(180deg, rgba(61,58,54,0.35) 0%, rgba(250,247,242,0.55) 55%, var(--cream) 100%), url('${url.replace(/'/g, '%27')}')`;
  hero.classList.add('has-photo');
}

function setMeta(id, content) {
  const el = document.getElementById(id);
  if (el && content) el.setAttribute(el.tagName === 'META' && el.name === 'description' ? 'content' : 'content', content);
  if (el) el.content = content;
}

function resolveAbsoluteUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

function parseGalleryUrls(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split('\n').map(s => s.trim()).filter(Boolean);
}

function wireGiftsListLink() {
  const link = document.getElementById('gifts-list-link');
  if (!link) return;
  const code = new URLSearchParams(window.location.search).get('kod')?.trim();
  link.href = code ? `gifts.html?kod=${encodeURIComponent(code)}` : 'gifts.html';
}

function renderGallery(urls) {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  if (!grid) return;

  if (!urls.length) {
    grid.innerHTML = '<p class="gallery-empty" id="gallery-empty" style="color:var(--text-muted);">Zdjęcia pojawią się wkrótce.</p>';
    return;
  }

  grid.innerHTML = urls.map((url, i) => `
    <button type="button" class="gallery-item" data-src="${escapeHtml(url)}" aria-label="Zdjęcie ${i + 1}">
      <img src="${escapeHtml(url)}" alt="Zdjęcie ${i + 1}" loading="lazy">
    </button>
  `).join('');

  grid.querySelectorAll('.gallery-item').forEach(btn => {
    btn.addEventListener('click', () => openLightbox(btn.dataset.src));
  });
}

function initGalleryLightbox() {
  const box = document.getElementById('lightbox');
  document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
  box?.addEventListener('click', (e) => {
    if (e.target === box) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function openLightbox(src) {
  const box = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (!box || !img) return;
  img.src = src;
  box.hidden = false;
}

function closeLightbox() {
  const box = document.getElementById('lightbox');
  if (box) box.hidden = true;
}

/** Powitanie: gość lub para. */
function isCoupleGuestName(name) {
  return /\s+(i|&|oraz)\s+/i.test(name || '');
}

function formatGuestWelcome(name) {
  if (!name) return '';
  if (isCoupleGuestName(name)) return `Drodzy ${name}`;
  return `Witaj, ${name}`;
}

function applyGuestPersonalization(guest) {
  const welcome = document.getElementById('hero-guest-welcome');
  const cta = document.getElementById('hero-rsvp-cta');
  const storyIntro = document.getElementById('story-intro');
  if (!guest || !welcome) return;

  const couple = isCoupleGuestName(guest.name);
  welcome.hidden = false;
  welcome.textContent = couple
    ? `Zaproszenie specjalnie dla Was — ${guest.name}`
    : `Zaproszenie specjalnie dla Ciebie — ${guest.name}`;

  if (cta) cta.hidden = false;

  if (storyIntro) {
    storyIntro.hidden = false;
    storyIntro.textContent = couple
      ? `Cieszymy się, że będziecie z nami, ${guest.name}.`
      : `Cieszymy się, że będziesz z nami, ${guest.name.split(' ')[0]}.`;
  }

  document.body.classList.add('personalized');
  document.title = `${guest.name} — zaproszenie`;
}

/** Personalizacja z ?kod=. */
async function personalizeFromInviteCode() {
  const code = new URLSearchParams(window.location.search).get('kod');
  if (!code) return;

  try {
    const guest = await getGuestByCode(code.trim());
    if (!guest) return;
    applyGuestPersonalization(guest);
  } catch (e) {
    console.warn('Nie udało się wczytać zaproszenia.', e);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text != null && text !== '') el.textContent = text;
}

function formatWeddingDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isRsvpDeadlinePassed(deadline) {
  if (!deadline) return false;
  const end = new Date(deadline);
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

function renderSchedule(schedule) {
  const container = document.getElementById('timeline');
  if (!container) return;
  container.innerHTML = schedule.map(item => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-time">${escapeHtml(item.time)}</div>
      <div class="timeline-content">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || '')}</p>
      </div>
    </div>
  `).join('');
}

function renderFAQ(faq) {
  const container = document.getElementById('faq-list');
  if (!container) return;
  container.innerHTML = faq.map(item => `
    <div class="faq-item">
      <button class="faq-question" type="button">${escapeHtml(item.question)}</button>
      <div class="faq-answer"><p>${escapeHtml(item.answer)}</p></div>
    </div>
  `).join('');
}

function initFAQ() {
  document.getElementById('faq-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq-question');
    if (btn) btn.closest('.faq-item').classList.toggle('open');
  });
}

function initCountdown() {
  getSettings().then(settings => {
    const weddingDate = new Date(settings.weddingDate).getTime();

    function update() {
      const diff = weddingDate - Date.now();
      if (diff <= 0) return setCountdown(0, 0, 0, 0);
      setCountdown(
        Math.floor(diff / 86400000),
        Math.floor((diff % 86400000) / 3600000),
        Math.floor((diff % 3600000) / 60000),
        Math.floor((diff % 60000) / 1000)
      );
    }

    function setCountdown(d, h, m, s) {
      setText('countdown-days', d);
      setText('countdown-hours', h);
      setText('countdown-minutes', m);
      setText('countdown-seconds', s);
    }

    update();
    setInterval(update, 1000);
  });
}

async function initRSVP() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  let currentGuest = null;
  const settings = await getSettings();
  const deadlinePassed = isRsvpDeadlinePassed(settings.rsvpDeadline);
  const closedBox = document.getElementById('rsvp-closed');
  if (closedBox) closedBox.hidden = !deadlinePassed;

  const stepCode = document.getElementById('rsvp-step-code');
  const stepForm = document.getElementById('rsvp-step-form');
  const stepThanks = document.getElementById('rsvp-step-thanks');
  const codeInput = document.getElementById('rsvp-code');
  const verifyBtn = document.getElementById('rsvp-verify-btn');
  const backBtn = document.getElementById('rsvp-back-btn');
  const editBtn = document.getElementById('rsvp-edit-btn');
  const guestNameEl = document.getElementById('rsvp-guest-name');
  const guestInfoEl = document.getElementById('rsvp-guest-info');
  const guestCountSelect = document.getElementById('rsvp-guest-count');
  const attendingSection = document.getElementById('rsvp-attending-section');
  const peopleList = document.getElementById('rsvp-people-list');
  const message = document.getElementById('rsvp-message');

  function hideAllSteps() {
    hideStep(stepCode);
    hideStep(stepForm);
    hideStep(stepThanks);
  }

  function dietOptions(selected) {
    const opts = [
      ['', 'Standardowe'],
      ['vegetarian', 'Wegetariańskie'],
      ['vegan', 'Wegańskie'],
      ['glutenFree', 'Bezglutenowe'],
      ['kids', 'Menu dla dziecka'],
    ];
    return opts.map(([v, l]) =>
      `<option value="${v}" ${selected === v ? 'selected' : ''}>${l}</option>`
    ).join('');
  }

  function renderPeopleFields(count, existing) {
    const list = existing || [];
    let html = '';
    for (let i = 0; i < count; i++) {
      const p = list[i] || {};
      const defaultName = i === 0 && !p.name ? (currentGuest?.name || '') : (p.name || '');
      const wantSong = !!(p.songArtist || p.songTitle);
      html += `
        <div class="rsvp-person-card">
          <p class="rsvp-person-label">Osoba ${i + 1}</p>
          <div class="form-group">
            <label>Imię i nazwisko</label>
            <input type="text" class="rsvp-person-name" value="${escapeHtml(defaultName)}" required>
          </div>
          <div class="form-group">
            <label>Dieta</label>
            <select class="rsvp-person-diet">${dietOptions(p.diet || '')}</select>
          </div>
          <div class="form-group">
            <label>Alergie i nietolerancje</label>
            <input type="text" class="rsvp-person-allergies" value="${escapeHtml(p.allergies || '')}" placeholder="np. orzechy, laktoza">
          </div>
          <div class="form-group">
            <label class="checkbox-item">
              <input type="checkbox" class="rsvp-person-want-song" ${wantSong ? 'checked' : ''}>
              Chcę dedykować piosenkę
            </label>
            <div class="rsvp-person-song-fields" ${wantSong ? '' : 'hidden'}>
              <div class="form-row">
                <input type="text" class="rsvp-person-song-artist" placeholder="Wykonawca" value="${escapeHtml(p.songArtist || '')}">
                <input type="text" class="rsvp-person-song-title" placeholder="Tytuł" value="${escapeHtml(p.songTitle || '')}">
              </div>
            </div>
          </div>
        </div>
      `;
    }
    peopleList.innerHTML = html;
  }

  function collectPeople() {
    return [...peopleList.querySelectorAll('.rsvp-person-card')].map(card => {
      const wantSong = card.querySelector('.rsvp-person-want-song')?.checked;
      return {
        name: card.querySelector('.rsvp-person-name').value.trim(),
        diet: card.querySelector('.rsvp-person-diet').value,
        allergies: card.querySelector('.rsvp-person-allergies').value.trim(),
        songArtist: wantSong ? card.querySelector('.rsvp-person-song-artist').value.trim() : '',
        songTitle: wantSong ? card.querySelector('.rsvp-person-song-title').value.trim() : '',
      };
    });
  }

  function showThanks(guest) {
    hideAllSteps();
    showStep(stepThanks);
    const body = document.getElementById('rsvp-thanks-body');
    const n = attendingCount(guest);
    if (guest.status === 'confirmed') {
      body.innerHTML = `<h3>Dziękujemy!</h3>
        <p>Potwierdziliśmy obecność ${n} ${n === 1 ? 'osoby' : 'osób'}. Do zobaczenia na ślubie.</p>`;
    } else {
      body.innerHTML = `<h3>Dziękujemy za odpowiedź</h3>
        <p>Szkoda, że się nie uda — będziemy o Was myśleć w ten dzień.</p>`;
    }
    if (editBtn) {
      editBtn.hidden = deadlinePassed;
      if (!deadlinePassed) {
        body.innerHTML += `<p class="rsvp-edit-hint">Do ${formatDate(settings.rsvpDeadline)} możesz jeszcze zmienić zgłoszenie.</p>`;
      }
    }
  }

  function fillForm(guest) {
    guestNameEl.textContent = formatGuestWelcome(guest.name) + '!';
    guestInfoEl.textContent = `Zaproszenie obejmuje maksymalnie ${guest.maxGuests} ${guest.maxGuests === 1 ? 'osobę' : 'osoby'}.`;

    guestCountSelect.innerHTML = '';
    for (let i = 1; i <= guest.maxGuests; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i + (i === 1 ? ' osoba' : i < 5 ? ' osoby' : ' osób');
      guestCountSelect.appendChild(opt);
    }

    const attending = guest.status !== 'declined';
    form.querySelector('input[name="attending"][value="' + (attending ? 'yes' : 'no') + '"]').checked = true;
    attendingSection.style.display = attending ? 'block' : 'none';

    const people = (guest.people || []).filter(p => p.attending);
    const count = people.length || (guest.confirmedGuests || 1);
    guestCountSelect.value = String(Math.min(Math.max(count, 1), guest.maxGuests));
    renderPeopleFields(parseInt(guestCountSelect.value, 10), people);
    document.getElementById('rsvp-note').value = guest.message || '';
  }

  function openGuest(guest, forceEdit) {
    if (deadlinePassed && guest.status === 'pending') {
      showMessage(message, 'info', 'Termin RSVP minął. Skontaktuj się z parą młodą, jeśli potrzebujesz pomocy.');
      return;
    }

    currentGuest = guest;
    applyGuestPersonalization(guest);

    if (!forceEdit && guest.status !== 'pending') {
      showThanks(guest);
      return;
    }

    hideAllSteps();
    showStep(stepForm);
    fillForm(guest);
  }

  guestCountSelect?.addEventListener('change', () => {
    const n = parseInt(guestCountSelect.value, 10) || 1;
    renderPeopleFields(n, collectPeople());
  });

  peopleList?.addEventListener('change', (e) => {
    if (!e.target.classList.contains('rsvp-person-want-song')) return;
    const fields = e.target.closest('.rsvp-person-card')?.querySelector('.rsvp-person-song-fields');
    if (fields) fields.hidden = !e.target.checked;
  });

  verifyBtn?.addEventListener('click', async () => {
    hideMessage(message);
    const code = codeInput.value.trim();
    if (!code) {
      showMessage(message, 'error', 'Wpisz kod z zaproszenia.');
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Sprawdzam...';

    try {
      const guest = await getGuestByCode(code);
      if (!guest) {
        showMessage(message, 'error', 'Nie znaleziono zaproszenia o podanym kodzie.');
        return;
      }
      openGuest(guest, false);
    } catch (err) {
      showMessage(message, 'error', 'Błąd połączenia. Spróbuj ponownie później.');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Sprawdź kod';
    }
  });

  form.querySelectorAll('input[name="attending"]').forEach(radio => {
    radio.addEventListener('change', () => {
      attendingSection.style.display = radio.value === 'yes' ? 'block' : 'none';
    });
  });

  backBtn?.addEventListener('click', () => {
    hideAllSteps();
    showStep(stepCode);
    currentGuest = null;
    hideMessage(message);
  });

  editBtn?.addEventListener('click', () => {
    if (currentGuest) openGuest(currentGuest, true);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(message);
    if (!currentGuest) return;

    if (deadlinePassed && currentGuest.status === 'pending') {
      showMessage(message, 'error', 'Termin RSVP minął.');
      return;
    }

    const attending = form.querySelector('input[name="attending"]:checked')?.value === 'yes';
    const people = attending ? collectPeople() : [];
    if (attending && people.some(p => !p.name)) {
      showMessage(message, 'error', 'Uzupełnij imię każdej osoby.');
      return;
    }

    try {
      const result = await submitRsvp(currentGuest.code, {
        attending,
        people,
        message: document.getElementById('rsvp-note').value.trim(),
      });

      if (result.success) {
        currentGuest = result.guest;
        showThanks(currentGuest);
      } else {
        showMessage(message, 'error', result.error);
      }
    } catch {
      showMessage(message, 'error', 'Błąd wysyłania odpowiedzi. Spróbuj ponownie.');
    }
  });

  const codeFromUrl = new URLSearchParams(window.location.search).get('kod');
  if (codeFromUrl) {
    codeInput.value = codeFromUrl;
    verifyBtn?.click();
  }
}

function showStep(el) { el?.classList.add('active'); }
function hideStep(el) { el?.classList.remove('active'); }

function showMessage(el, type, text) {
  if (!el) return;
  el.className = 'form-message ' + type;
  el.textContent = text;
}

function hideMessage(el) {
  if (!el) return;
  el.className = 'form-message';
  el.textContent = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
