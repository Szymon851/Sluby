document.addEventListener('DOMContentLoaded', async () => {
  await initApi();
  initNavigation();
  await renderPageContent();
  initCountdown();
  initFAQ();
  initRSVP();
});

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

  document.title = `${settings.brideName} & ${settings.groomName} — Nasz Ślub`;

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

  const mapLink = document.getElementById('venue-map-link');
  if (mapLink && settings.venueMapUrl) mapLink.href = settings.venueMapUrl;

  const emailLink = document.getElementById('contact-email-link');
  if (emailLink) emailLink.href = 'mailto:' + settings.contactEmail;

  const phoneLink = document.getElementById('contact-phone-link');
  if (phoneLink) phoneLink.href = 'tel:' + settings.contactPhone.replace(/\s/g, '');

  renderSchedule(schedule);
  renderFAQ(faq);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text) el.textContent = text;
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

function renderSchedule(schedule) {
  const container = document.getElementById('timeline');
  if (!container) return;
  container.innerHTML = schedule.map(item => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-time">${item.time}</div>
      <div class="timeline-content">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
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

function initRSVP() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  let currentGuest = null;
  const stepCode = document.getElementById('rsvp-step-code');
  const stepForm = document.getElementById('rsvp-step-form');
  const codeInput = document.getElementById('rsvp-code');
  const verifyBtn = document.getElementById('rsvp-verify-btn');
  const backBtn = document.getElementById('rsvp-back-btn');
  const guestNameEl = document.getElementById('rsvp-guest-name');
  const guestInfoEl = document.getElementById('rsvp-guest-info');
  const guestCountSelect = document.getElementById('rsvp-guest-count');
  const attendingSection = document.getElementById('rsvp-attending-section');
  const dietSection = document.getElementById('rsvp-diet-section');
  const message = document.getElementById('rsvp-message');

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

      currentGuest = guest;
      showStep(stepForm);
      hideStep(stepCode);

      guestNameEl.textContent = `Witaj, ${guest.name}!`;
      guestInfoEl.textContent = guest.status !== 'pending'
        ? 'Już wcześniej odpowiedziałeś/aś — możesz zaktualizować swoją odpowiedź.'
        : `Zaproszenie obejmuje maksymalnie ${guest.maxGuests} ${guest.maxGuests === 1 ? 'osobę' : 'osoby'}.`;

      guestCountSelect.innerHTML = '';
      for (let i = 1; i <= guest.maxGuests; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i + (i === 1 ? ' osoba' : i < 5 ? ' osoby' : ' osób');
        guestCountSelect.appendChild(opt);
      }

      if (guest.status === 'confirmed') {
        form.querySelector('input[name="attending"][value="yes"]').checked = true;
        attendingSection.style.display = 'block';
        dietSection.style.display = 'block';
      } else if (guest.status === 'declined') {
        form.querySelector('input[name="attending"][value="no"]').checked = true;
        attendingSection.style.display = 'none';
        dietSection.style.display = 'none';
      }

      guestCountSelect.value = guest.confirmedGuests || 1;
      document.getElementById('rsvp-allergies').value = guest.allergies || '';
      document.getElementById('rsvp-song').value = guest.songRequest || '';
      document.getElementById('rsvp-note').value = guest.message || '';
      document.querySelectorAll('input[name="diet"]').forEach(cb => {
        cb.checked = (guest.diet || []).includes(cb.value);
      });
    } catch (err) {
      showMessage(message, 'error', 'Błąd połączenia. Spróbuj ponownie później.');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Sprawdź kod';
    }
  });

  form.querySelectorAll('input[name="attending"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const attending = radio.value === 'yes';
      attendingSection.style.display = attending ? 'block' : 'none';
      dietSection.style.display = attending ? 'block' : 'none';
    });
  });

  backBtn?.addEventListener('click', () => {
    showStep(stepCode);
    hideStep(stepForm);
    currentGuest = null;
    hideMessage(message);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(message);
    if (!currentGuest) return;

    const attending = form.querySelector('input[name="attending"]:checked')?.value === 'yes';
    const guestCount = attending ? parseInt(guestCountSelect.value, 10) : 0;
    const diet = [];
    form.querySelectorAll('input[name="diet"]:checked').forEach(cb => diet.push(cb.value));

    try {
      const result = await submitRsvp(currentGuest.code, {
        attending,
        guestCount,
        diet,
        allergies: document.getElementById('rsvp-allergies').value.trim(),
        songRequest: document.getElementById('rsvp-song').value.trim(),
        message: document.getElementById('rsvp-note').value.trim(),
      });

      if (result.success) {
        showMessage(message, 'success', attending
          ? `Dziękujemy! Potwierdzono obecność ${guestCount} ${guestCount === 1 ? 'osoby' : 'osób'}. Do zobaczenia!`
          : 'Szkoda, że nie możesz być z nami. Dziękujemy za odpowiedź!');
        currentGuest = result.guest;
      } else {
        showMessage(message, 'error', result.error);
      }
    } catch {
      showMessage(message, 'error', 'Błąd wysyłania odpowiedzi. Spróbuj ponownie.');
    }
  });

  const codeFromUrl = new URLSearchParams(window.location.search).get('kod');
  if (codeFromUrl) codeInput.value = codeFromUrl;
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
