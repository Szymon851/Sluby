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
    adminPassword: 'zmien-haslo',
    rsvpDeadline: '2026-08-15',
    contactEmail: 'anna.imichal@example.com',
    contactPhone: '+48 600 123 456',
    story: 'Poznaliśmy się w 2019 roku na koncercie jazzowym. Od pierwszej rozmowy wiedzieliśmy, że to coś wyjątkowego. Po sześciu wspaniałych latach razem, Michał poprosił Annę o rękę podczas wycieczki w Bieszczady. Teraz nie możemy się doczekać, by świętować ten dzień z Wami!',
    accommodation: 'Dla gości z daleka polecamy Hotel Bellotto (5 min spacerem) oraz Apartamenty Królewskie.',
    gifts: 'Wasza obecność to dla nas największy prezent! Jeśli jednak chcecie nas obdarować, będziemy wdzięczni za datek na naszą podróż poślubną.',
    giftsBankAccount: '',
    giftsLink: '',
    heroImageUrl: 'img/hero.jpg',
    galleryUrls: '',
    siteUrl: '',
    siteMode: 'preview',
    theme: 'classic',
  },
  schedule: [
    { id: 'sched-1', time: '15:00', title: 'Ceremonia', description: 'Ślub kościelny w kaplicy pałacowej', sortOrder: 1 },
    { id: 'sched-2', time: '16:30', title: 'Sesja zdjęciowa', description: 'W ogrodzie pałacowym', sortOrder: 2 },
    { id: 'sched-3', time: '17:30', title: 'Przyjęcie', description: 'Koktajl powitalny w ogrodzie zimowym', sortOrder: 3 },
    { id: 'sched-4', time: '19:00', title: 'Obiad', description: 'Uroczysta kolacja w sali balowej', sortOrder: 4 },
    { id: 'sched-5', time: '21:00', title: 'Pierwszy taniec', description: 'Otwarcie parkietu', sortOrder: 5 },
    { id: 'sched-6', time: '22:00', title: 'Zabawa', description: 'Do białego rana!', sortOrder: 6 },
  ],
  faq: [
    { id: 'faq-1', question: 'Czy mogę przyjść z dzieckiem?', answer: 'Oczywiście! Prosimy jedynie o wcześniejsze zgłoszenie w RSVP, abyśmy mogli przygotować odpowiednie menu.', sortOrder: 1 },
    { id: 'faq-2', question: 'Gdzie mogę zaparkować?', answer: 'Bezpłatny parking dostępny jest na terenie pałacu.', sortOrder: 2 },
    { id: 'faq-3', question: 'Do kiedy muszę potwierdzić obecność?', answer: 'Prosimy o potwierdzenie do terminu podanego na stronie.', sortOrder: 3 },
    { id: 'faq-4', question: 'Czy będzie opcja wegetariańska?', answer: 'Tak! W formularzu RSVP możesz zaznaczyć swoje preferencje dietetyczne.', sortOrder: 4 },
    { id: 'faq-5', question: 'Jaki jest dress code?', answer: 'Elegancki strój wieczorowy. Unikaj bieli — ta kolor zarezerwowany jest dla panny młodej!', sortOrder: 5 },
  ],
  guests: [],
  checklist: [
    { id: 'task-1', text: 'Zarezerwować salę weselną', done: true },
    { id: 'task-2', text: 'Wybrać fotografa', done: true },
    { id: 'task-3', text: 'Wysłać zaproszenia', done: false },
    { id: 'task-4', text: 'Zamówić tort', done: false },
    { id: 'task-5', text: 'Ustalić menu z cateringiem', done: false },
  ],
  budget: [],
  vendors: [],
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
    schedule: (saved.schedule?.length ? saved.schedule : defaults.schedule).map(normalizeScheduleItem),
    faq: (saved.faq?.length ? saved.faq : defaults.faq).map(normalizeFaqItem),
    guests,
    checklist: saved.checklist?.length ? saved.checklist : defaults.checklist,
    budget: (saved.budget || []).map(normalizeBudgetItem),
    vendors: (saved.vendors || []).map(normalizeVendor),
  };
}

function normalizeScheduleItem(item, index = 0) {
  return {
    id: item.id || ('sched-' + index + '-' + String(item.time || '') + '-' + String(item.title || '').slice(0, 20)).replace(/\s+/g, '-'),
    time: item.time || '',
    title: item.title || '',
    description: item.description || '',
    sortOrder: item.sortOrder ?? item.sort_order ?? index + 1,
  };
}

function normalizeFaqItem(item, index = 0) {
  return {
    id: item.id || ('faq-' + index + '-' + String(item.question || '').slice(0, 24)).replace(/\s+/g, '-'),
    question: item.question || '',
    answer: item.answer || '',
    sortOrder: item.sortOrder ?? item.sort_order ?? index + 1,
  };
}

function normalizeVendor(v) {
  return {
    id: v.id,
    name: v.name || '',
    role: v.role || '',
    phone: v.phone || '',
    email: v.email || '',
    notes: v.notes || '',
    contractDate: v.contractDate || v.contract_date || '',
  };
}

/** Statystyki / dieta / CSV — wspólne dla Local i Cloud. */
async function computeGuestStats(getGuestsFn) {
  const guests = await getGuestsFn();
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
}

async function computeDietSummary(getGuestsFn) {
  const guests = (await getGuestsFn()).filter(g => g.status === 'confirmed');
  const summary = { standard: 0, vegetarian: 0, vegan: 0, glutenFree: 0, kids: 0, other: 0 };
  guests.forEach(g => {
    const count = g.confirmedGuests || 1;
    if (!g.diet || g.diet.length === 0) summary.standard += count;
    else g.diet.forEach(d => {
      if (summary[d] !== undefined) summary[d] += count;
      else summary.other += count;
    });
  });
  return summary;
}

function buildGuestsCSV(guests) {
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
}

function buildBudgetCSV(items) {
  const headers = ['Kategoria', 'Pozycja', 'Szacunek', 'Umowa', 'Zapłacono', 'Pozostało', 'Notatki', 'Raty'];
  const rows = items.map(item => {
    const paid = (item.payments || []).filter(p => p.isPaid).reduce((s, p) => s + Number(p.amount || 0), 0);
    const base = Number(item.contracted) || Number(item.estimated) || 0;
    const pays = (item.payments || []).map(p =>
      `${p.label}: ${p.amount} (${p.isPaid ? 'zapłacone' : (p.dueDate || 'bez terminu')})`
    ).join(' | ');
    return [
      item.category, item.name, item.estimated, item.contracted, paid,
      Math.max(0, base - paid), item.notes, pays,
    ];
  });
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function normalizePayment(p) {
  return {
    id: p.id,
    label: p.label || 'Rata',
    amount: Number(p.amount) || 0,
    dueDate: p.dueDate || p.due_date || null,
    isPaid: !!(p.isPaid ?? p.is_paid),
    paidAt: p.paidAt || p.paid_at || null,
    notes: p.notes || '',
  };
}

function normalizeBudgetItem(item) {
  return {
    id: item.id,
    category: item.category || 'Inne',
    name: item.name || '',
    estimated: Number(item.estimated ?? item.estimated_cost) || 0,
    contracted: Number(item.contracted ?? item.contracted_cost) || 0,
    notes: item.notes || '',
    sortOrder: item.sortOrder ?? item.sort_order ?? 0,
    payments: (item.payments || []).map(normalizePayment),
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
    const incoming = { ...newSettings };
    delete incoming.siteMode;
    data.settings = { ...data.settings, ...incoming };
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
    return loadData().schedule.map(normalizeScheduleItem).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async addScheduleItem(item) {
    const data = loadData();
    const row = normalizeScheduleItem({
      id: generateId('sched'),
      ...item,
      sortOrder: item.sortOrder ?? data.schedule.length + 1,
    });
    data.schedule.push(row);
    saveData(data);
    return row;
  },

  async updateScheduleItem(id, updates) {
    const data = loadData();
    const idx = data.schedule.findIndex(s => s.id === id);
    if (idx === -1) return null;
    data.schedule[idx] = normalizeScheduleItem({ ...data.schedule[idx], ...updates });
    saveData(data);
    return data.schedule[idx];
  },

  async deleteScheduleItem(id) {
    const data = loadData();
    data.schedule = data.schedule.filter(s => s.id !== id);
    saveData(data);
  },

  async getFaq() {
    return loadData().faq.map(normalizeFaqItem).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async addFaqItem(item) {
    const data = loadData();
    const row = normalizeFaqItem({
      id: generateId('faq'),
      ...item,
      sortOrder: item.sortOrder ?? data.faq.length + 1,
    });
    data.faq.push(row);
    saveData(data);
    return row;
  },

  async updateFaqItem(id, updates) {
    const data = loadData();
    const idx = data.faq.findIndex(f => f.id === id);
    if (idx === -1) return null;
    data.faq[idx] = normalizeFaqItem({ ...data.faq[idx], ...updates });
    saveData(data);
    return data.faq[idx];
  },

  async deleteFaqItem(id) {
    const data = loadData();
    data.faq = data.faq.filter(f => f.id !== id);
    saveData(data);
  },

  async getVendors() {
    return loadData().vendors.map(normalizeVendor);
  },

  async addVendor(vendor) {
    const data = loadData();
    const row = normalizeVendor({ id: generateId('vendor'), ...vendor });
    data.vendors.push(row);
    saveData(data);
    return row;
  },

  async updateVendor(id, updates) {
    const data = loadData();
    const idx = data.vendors.findIndex(v => v.id === id);
    if (idx === -1) return null;
    data.vendors[idx] = normalizeVendor({ ...data.vendors[idx], ...updates });
    saveData(data);
    return data.vendors[idx];
  },

  async deleteVendor(id) {
    const data = loadData();
    data.vendors = data.vendors.filter(v => v.id !== id);
    saveData(data);
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

  async getBudgetItems() {
    return loadData().budget.map(normalizeBudgetItem);
  },

  async addBudgetItem(item) {
    const data = loadData();
    const row = normalizeBudgetItem({
      id: generateId('budget'),
      category: item.category,
      name: item.name,
      estimated: item.estimated || 0,
      contracted: item.contracted || 0,
      notes: item.notes || '',
      sortOrder: data.budget.length + 1,
      payments: item.payments || [],
    });
    data.budget.push(row);
    saveData(data);
    return row;
  },

  async updateBudgetItem(id, updates) {
    const data = loadData();
    const idx = data.budget.findIndex(b => b.id === id);
    if (idx === -1) return null;
    data.budget[idx] = normalizeBudgetItem({ ...data.budget[idx], ...updates });
    saveData(data);
    return data.budget[idx];
  },

  async deleteBudgetItem(id) {
    const data = loadData();
    data.budget = data.budget.filter(b => b.id !== id);
    saveData(data);
  },

  async addBudgetPayment(itemId, payment) {
    const data = loadData();
    const item = data.budget.find(b => b.id === itemId);
    if (!item) return null;
    if (!item.payments) item.payments = [];
    const row = normalizePayment({
      id: generateId('pay'),
      label: payment.label,
      amount: payment.amount,
      dueDate: payment.dueDate || null,
      isPaid: !!payment.isPaid,
      paidAt: payment.isPaid ? (payment.paidAt || new Date().toISOString().slice(0, 10)) : null,
      notes: payment.notes || '',
    });
    item.payments.push(row);
    saveData(data);
    return row;
  },

  async updateBudgetPayment(itemId, paymentId, updates) {
    const data = loadData();
    const item = data.budget.find(b => b.id === itemId);
    if (!item) return null;
    const idx = (item.payments || []).findIndex(p => p.id === paymentId);
    if (idx === -1) return null;
    const merged = { ...item.payments[idx], ...updates };
    if (updates.isPaid === true && !merged.paidAt) {
      merged.paidAt = new Date().toISOString().slice(0, 10);
    }
    if (updates.isPaid === false) merged.paidAt = null;
    item.payments[idx] = normalizePayment(merged);
    saveData(data);
    return item.payments[idx];
  },

  async deleteBudgetPayment(itemId, paymentId) {
    const data = loadData();
    const item = data.budget.find(b => b.id === itemId);
    if (!item) return;
    item.payments = (item.payments || []).filter(p => p.id !== paymentId);
    saveData(data);
  },

  async seedBudgetDefaults() {
    if ((await this.getBudgetItems()).length > 0) return this.getBudgetItems();
    const samples = [
      { category: 'Sala', name: 'Wynajem sali', estimated: 15000, contracted: 15000, payments: [
        { label: 'Zaliczka', amount: 5000, dueDate: '2026-03-01', isPaid: true },
        { label: 'Saldo', amount: 10000, dueDate: '2026-08-15', isPaid: false },
      ]},
      { category: 'Catering', name: 'Menu weselne', estimated: 25000, contracted: 0, payments: [] },
      { category: 'Fotograf', name: 'Pakiet foto + video', estimated: 8000, contracted: 7500, payments: [
        { label: 'Zaliczka', amount: 2500, dueDate: '2026-04-01', isPaid: true },
        { label: 'II rata', amount: 2500, dueDate: '2026-07-01', isPaid: false },
        { label: 'Saldo', amount: 2500, dueDate: '2026-09-10', isPaid: false },
      ]},
      { category: 'Muzyka', name: 'DJ / zespół', estimated: 5000, contracted: 0, payments: [] },
      { category: 'Dekoracje', name: 'Kwiaty i dekoracje', estimated: 4000, contracted: 0, payments: [] },
    ];
    for (const s of samples) {
      const item = await this.addBudgetItem(s);
      for (const p of s.payments) await this.addBudgetPayment(item.id, p);
    }
    return this.getBudgetItems();
  },

  async getGuestStats() {
    return computeGuestStats(() => this.getGuests());
  },

  async getDietSummary() {
    return computeDietSummary(() => this.getGuests());
  },

  async exportGuestsCSV() {
    return buildGuestsCSV(await this.getGuests());
  },

  async exportBudgetCSV() {
    return buildBudgetCSV(await this.getBudgetItems());
  },

  async resetData() {
    localStorage.removeItem(STORAGE_KEY);
    return loadData();
  },
};
