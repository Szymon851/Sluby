const STORAGE_KEY = 'naszSlub_data';

const DEFAULT_DATA = {
  settings: {
    brideName: 'Anna',
    groomName: 'Michał',
    weddingDate: '2026-09-12T15:00:00',
    venue: 'Pałac w Wilanowie',
    venueAddress: 'ul. Stanisława Kostki Potockiego 10/16, 02-958 Warszawa',
    venueMapUrl: 'https://maps.google.com/?q=Pałac+w+Wilanowie',
    dressCode: 'Elegancki strój wieczorowy. Panowie — garnitur, panie — suknia koktajlowa lub wieczorowa.',
    adminPassword: 'slub2026',
    rsvpDeadline: '2026-08-01',
    contactEmail: 'anna.imichal@example.com',
    contactPhone: '+48 600 123 456',
    story: 'Poznaliśmy się w 2019 roku na koncercie jazzowym. Od pierwszej rozmowy wiedzieliśmy, że to coś wyjątkowego. Po sześciu wspaniałych latach razem, Michał poprosił Annę o rękę podczas wycieczki w Bieszczady. Teraz nie możemy się doczekać, by świętować ten dzień z Wami!',
    accommodation: 'Dla gości z daleka polecamy Hotel Bellotto (5 min spacerem) oraz Apartamenty Królewskie.',
    gifts: 'Wasza obecność to dla nas największy prezent! Jeśli jednak chcecie nas obdarować, będziemy wdzięczni za datek na naszą podróż poślubną.',
    siteUrl: '',
  },
  schedule: [
    { time: '15:00', title: 'Ceremonia', description: 'Ślub kościelny w kaplicy pałacowej' },
    { time: '16:30', title: 'Sesja zdjęciowa', description: 'W ogrodzie pałacowym' },
    { time: '17:30', title: 'Przyjęcie', description: 'Koktajl powitalny w ogrodzie zimowym' },
    { time: '19:00', title: 'Obiad', description: 'Uroczysta kolacja w sali balowej' },
    { time: '21:00', title: 'Pierwszy taniec', description: 'Otwarcie parkietu' },
    { time: '22:00', title: 'Zabawa', description: 'Do białego rana!' },
  ],
  faq: [
    { question: 'Czy mogę przyjść z dzieckiem?', answer: 'Oczywiście! Prosimy jedynie o wcześniejsze zgłoszenie w RSVP, abyśmy mogli przygotować odpowiednie menu.' },
    { question: 'Gdzie mogę zaparkować?', answer: 'Bezpłatny parking dostępny jest na terenie pałacu.' },
    { question: 'Do kiedy muszę potwierdzić obecność?', answer: 'Prosimy o potwierdzenie do terminu podanego na stronie.' },
    { question: 'Czy będzie opcja wegetariańska?', answer: 'Tak! W formularzu RSVP możesz zaznaczyć swoje preferencje dietetyczne.' },
    { question: 'Jaki jest dress code?', answer: 'Elegancki strój wieczorowy. Unikaj bieli — ta kolor zarezerwowany jest dla panny młodej!' },
  ],
  guests: [],
  checklist: [
    { id: 'task-1', text: 'Zarezerwować salę weselną', done: true },
    { id: 'task-2', text: 'Wybrać fotografa', done: true },
    { id: 'task-3', text: 'Wysłać zaproszenia', done: false },
    { id: 'task-4', text: 'Zamówić tort', done: false },
    { id: 'task-5', text: 'Ustalić menu z cateringiem', done: false },
  ],
};

const LOCAL_SESSION_KEY = 'naszSlub_admin';

function generateId(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateSecureCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[arr[i] % chars.length];
  }
  return code;
}

function generateUniqueCode(existingCodes) {
  const codes = new Set((existingCodes || []).map(c => c.toUpperCase()));
  let code;
  do {
    code = generateSecureCode();
  } while (codes.has(code.toUpperCase()));
  return code;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return mergeDefaults(parsed, DEFAULT_DATA);
    }
  } catch (e) {
    console.warn('Błąd odczytu danych lokalnych.', e);
  }
  return structuredClone(DEFAULT_DATA);
}

function mergeDefaults(saved, defaults) {
  const guests = (saved.guests || []).map(normalizeGuest);
  return {
    settings: { ...defaults.settings, ...saved.settings },
    schedule: saved.schedule?.length ? saved.schedule : defaults.schedule,
    faq: saved.faq?.length ? saved.faq : defaults.faq,
    guests,
    checklist: saved.checklist?.length ? saved.checklist : defaults.checklist,
  };
}

function normalizeGuest(g) {
  return {
    id: g.id,
    name: g.name || '',
    email: g.email || '',
    phone: g.phone || '',
    code: g.code || g.invite_code || '',
    group: g.group || g.group_name || '',
    maxGuests: g.maxGuests ?? g.max_guests ?? 1,
    status: g.status || 'pending',
    confirmedGuests: g.confirmedGuests ?? g.confirmed_guests ?? 0,
    diet: g.diet || [],
    allergies: g.allergies || '',
    message: g.message || '',
    songRequest: g.songRequest || g.song_request || '',
    respondedAt: g.respondedAt || g.responded_at || null,
    invitationSentAt: g.invitationSentAt || g.invitation_sent_at || null,
  };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const LocalStore = {
  isCloud: () => false,

  async init() { return true; },

  isAdminLoggedIn() {
    return sessionStorage.getItem(LOCAL_SESSION_KEY) === 'true';
  },

  async loginAdmin(email, password) {
    const settings = loadData().settings;
    if (password === settings.adminPassword) {
      sessionStorage.setItem(LOCAL_SESSION_KEY, 'true');
      return { success: true };
    }
    return { success: false, error: 'Nieprawidłowe hasło.' };
  },

  async logoutAdmin() {
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
  },

  async getSettings() {
    return loadData().settings;
  },

  async updateSettings(newSettings) {
    const data = loadData();
    data.settings = { ...data.settings, ...newSettings };
    saveData(data);
    return data.settings;
  },

  async getGuests() {
    return loadData().guests.map(normalizeGuest);
  },

  async getGuestByCode(code) {
    const guests = await this.getGuests();
    return guests.find(g => g.code.toUpperCase() === code.toUpperCase()) || null;
  },

  async getGuestById(id) {
    const guests = await this.getGuests();
    return guests.find(g => g.id === id) || null;
  },

  async addGuest(guest) {
    const data = loadData();
    const existingCodes = data.guests.map(g => g.code);
    const newGuest = normalizeGuest({
      id: generateId('guest'),
      name: guest.name,
      email: guest.email || '',
      phone: guest.phone || '',
      code: guest.code || generateUniqueCode(existingCodes),
      group: guest.group || '',
      maxGuests: guest.maxGuests || 1,
      status: 'pending',
      confirmedGuests: 0,
      diet: [],
      allergies: '',
      message: '',
      songRequest: '',
      respondedAt: null,
      invitationSentAt: null,
    });
    data.guests.push(newGuest);
    saveData(data);
    return newGuest;
  },

  async updateGuest(id, updates) {
    const data = loadData();
    const idx = data.guests.findIndex(g => g.id === id);
    if (idx === -1) return null;
    data.guests[idx] = normalizeGuest({ ...data.guests[idx], ...updates });
    saveData(data);
    return data.guests[idx];
  },

  async deleteGuest(id) {
    const data = loadData();
    data.guests = data.guests.filter(g => g.id !== id);
    saveData(data);
  },

  async markInvitationSent(id) {
    return this.updateGuest(id, { invitationSentAt: new Date().toISOString() });
  },

  async submitRsvp(code, rsvpData) {
    const guest = await this.getGuestByCode(code);
    if (!guest) return { success: false, error: 'Nieprawidłowy kod zaproszenia.' };

    await this.updateGuest(guest.id, {
      status: rsvpData.attending ? 'confirmed' : 'declined',
      confirmedGuests: rsvpData.attending ? rsvpData.guestCount : 0,
      diet: rsvpData.diet || [],
      allergies: rsvpData.allergies || '',
      message: rsvpData.message || '',
      songRequest: rsvpData.songRequest || '',
      respondedAt: new Date().toISOString(),
    });

    return { success: true, guest: await this.getGuestById(guest.id) };
  },

  async getSchedule() {
    return loadData().schedule;
  },

  async getFaq() {
    return loadData().faq;
  },

  async getChecklist() {
    return loadData().checklist;
  },

  async addChecklistItem(text) {
    const data = loadData();
    const item = { id: generateId('task'), text, done: false };
    data.checklist.push(item);
    saveData(data);
    return item;
  },

  async toggleChecklistItem(id) {
    const data = loadData();
    const item = data.checklist.find(t => t.id === id);
    if (item) {
      item.done = !item.done;
      saveData(data);
    }
    return item;
  },

  async deleteChecklistItem(id) {
    const data = loadData();
    data.checklist = data.checklist.filter(t => t.id !== id);
    saveData(data);
  },

  async getGuestStats() {
    const guests = await this.getGuests();
    const confirmed = guests.filter(g => g.status === 'confirmed');
    const declined = guests.filter(g => g.status === 'declined');
    const pending = guests.filter(g => g.status === 'pending');
    const invited = guests.filter(g => g.invitationSentAt);
    return {
      total: guests.length,
      confirmed: confirmed.length,
      declined: declined.length,
      pending: pending.length,
      totalPeople: confirmed.reduce((sum, g) => sum + g.confirmedGuests, 0),
      invitationsSent: invited.length,
      invitationsPending: guests.length - invited.length,
    };
  },

  async getDietSummary() {
    const guests = (await this.getGuests()).filter(g => g.status === 'confirmed');
    const summary = { standard: 0, vegetarian: 0, vegan: 0, glutenFree: 0, kids: 0, other: 0 };
    guests.forEach(g => {
      const count = g.confirmedGuests || 1;
      if (!g.diet || g.diet.length === 0) {
        summary.standard += count;
      } else {
        g.diet.forEach(d => {
          if (summary[d] !== undefined) summary[d] += count;
          else summary.other += count;
        });
      }
    });
    return summary;
  },

  async exportGuestsCSV() {
    const guests = await this.getGuests();
    const headers = ['Imię i nazwisko', 'Email', 'Telefon', 'Kod', 'Grupa', 'Status', 'Zaproszenie wysłane', 'Liczba osób', 'Dieta', 'Alergie', 'Wiadomość', 'Data odpowiedzi'];
    const rows = guests.map(g => [
      g.name, g.email, g.phone, g.code, g.group,
      g.status === 'confirmed' ? 'Potwierdzone' : g.status === 'declined' ? 'Odmowa' : 'Oczekujące',
      g.invitationSentAt ? new Date(g.invitationSentAt).toLocaleDateString('pl-PL') : 'Nie',
      g.confirmedGuests, (g.diet || []).join(', '), g.allergies, g.message,
      g.respondedAt ? new Date(g.respondedAt).toLocaleDateString('pl-PL') : '',
    ]);
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  },

  async resetData() {
    localStorage.removeItem(STORAGE_KEY);
    return loadData();
  },
};
