let supabaseClient = null;
let store = LocalStore;

function isCloudConfigured() {
  return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

function mapGuestFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    code: row.invite_code,
    group: row.group_name || '',
    maxGuests: row.max_guests,
    status: row.status,
    confirmedGuests: row.confirmed_guests,
    diet: row.diet || [],
    allergies: row.allergies || '',
    message: row.message || '',
    songRequest: row.song_request || '',
    respondedAt: row.responded_at,
    invitationSentAt: row.invitation_sent_at,
  };
}

function mapGuestToDb(g) {
  return {
    name: g.name,
    email: g.email || null,
    phone: g.phone || null,
    invite_code: g.code,
    group_name: g.group || null,
    max_guests: g.maxGuests || 1,
    status: g.status,
    confirmed_guests: g.confirmedGuests ?? 0,
    diet: g.diet || [],
    allergies: g.allergies || '',
    message: g.message || '',
    song_request: g.songRequest || '',
    responded_at: g.respondedAt || null,
    invitation_sent_at: g.invitationSentAt || null,
  };
}

function mapSettingsFromDb(row) {
  if (!row) return {};
  return {
    brideName: row.bride_name,
    groomName: row.groom_name,
    weddingDate: row.wedding_date,
    venue: row.venue || '',
    venueAddress: row.venue_address || '',
    venueMapUrl: row.venue_map_url || '',
    dressCode: row.dress_code || '',
    rsvpDeadline: row.rsvp_deadline || '',
    contactEmail: row.contact_email || '',
    contactPhone: row.contact_phone || '',
    story: row.story || '',
    accommodation: row.accommodation || '',
    gifts: row.gifts || '',
    siteUrl: row.site_url || '',
  };
}

function mapSettingsToDb(s) {
  return {
    bride_name: s.brideName,
    groom_name: s.groomName,
    wedding_date: s.weddingDate,
    venue: s.venue,
    venue_address: s.venueAddress,
    venue_map_url: s.venueMapUrl,
    dress_code: s.dressCode,
    rsvp_deadline: s.rsvpDeadline || null,
    contact_email: s.contactEmail,
    contact_phone: s.contactPhone,
    story: s.story,
    accommodation: s.accommodation,
    gifts: s.gifts,
    site_url: s.siteUrl,
    updated_at: new Date().toISOString(),
  };
}

const CloudStore = {
  isCloud: () => true,

  async init() {
    if (typeof supabase === 'undefined') {
      console.error('Biblioteka Supabase nie załadowana.');
      return false;
    }
    supabaseClient = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    return true;
  },

  isAdminLoggedIn() {
    return !!supabaseClient;
  },

  async checkAdminSession() {
    const { data } = await supabaseClient.auth.getSession();
    return !!data.session;
  },

  async loginAdmin(email, password) {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: 'Nieprawidłowy email lub hasło.' };
    return { success: true };
  },

  async logoutAdmin() {
    await supabaseClient.auth.signOut();
  },

  async getSettings() {
    const { data, error } = await supabaseClient.from('wedding_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    return mapSettingsFromDb(data);
  },

  async updateSettings(newSettings) {
    const payload = mapSettingsToDb(newSettings);
    const { error } = await supabaseClient.from('wedding_settings').update(payload).eq('id', 1);
    if (error) throw error;
    return this.getSettings();
  },

  async getGuests() {
    const { data, error } = await supabaseClient.from('guests').select('*').order('name');
    if (error) throw error;
    return (data || []).map(mapGuestFromDb);
  },

  async getGuestByCode(code) {
    const { data, error } = await supabaseClient.rpc('get_guest_by_code', { p_code: code.trim() });
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      maxGuests: data.maxGuests,
      status: data.status,
      confirmedGuests: data.confirmedGuests,
      diet: data.diet || [],
      allergies: data.allergies || '',
      message: data.message || '',
      songRequest: data.songRequest || '',
    };
  },

  async getGuestById(id) {
    const { data, error } = await supabaseClient.from('guests').select('*').eq('id', id).single();
    if (error) return null;
    return mapGuestFromDb(data);
  },

  async addGuest(guest) {
    const existing = await this.getGuests();
    const code = guest.code || generateUniqueCode(existing.map(g => g.code));
    const payload = {
      name: guest.name,
      email: guest.email || null,
      phone: guest.phone || null,
      invite_code: code,
      group_name: guest.group || null,
      max_guests: guest.maxGuests || 1,
      status: 'pending',
      confirmed_guests: 0,
      diet: [],
    };

    const { data, error } = await supabaseClient.from('guests').insert(payload).select().single();
    if (error) throw error;
    return mapGuestFromDb(data);
  },

  async updateGuest(id, updates) {
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email || null;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
    if (updates.code !== undefined) dbUpdates.invite_code = updates.code;
    if (updates.group !== undefined) dbUpdates.group_name = updates.group || null;
    if (updates.maxGuests !== undefined) dbUpdates.max_guests = updates.maxGuests;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.confirmedGuests !== undefined) dbUpdates.confirmed_guests = updates.confirmedGuests;
    if (updates.diet !== undefined) dbUpdates.diet = updates.diet;
    if (updates.allergies !== undefined) dbUpdates.allergies = updates.allergies;
    if (updates.message !== undefined) dbUpdates.message = updates.message;
    if (updates.songRequest !== undefined) dbUpdates.song_request = updates.songRequest;
    if (updates.respondedAt !== undefined) dbUpdates.responded_at = updates.respondedAt;
    if (updates.invitationSentAt !== undefined) dbUpdates.invitation_sent_at = updates.invitationSentAt;

    const { data, error } = await supabaseClient.from('guests').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return mapGuestFromDb(data);
  },

  async deleteGuest(id) {
    const { error } = await supabaseClient.from('guests').delete().eq('id', id);
    if (error) throw error;
  },

  async markInvitationSent(id) {
    return this.updateGuest(id, { invitationSentAt: new Date().toISOString() });
  },

  async submitRsvp(code, rsvpData) {
    const { data, error } = await supabaseClient.rpc('submit_rsvp', {
      p_code: code.trim(),
      p_attending: rsvpData.attending,
      p_guest_count: rsvpData.guestCount,
      p_diet: rsvpData.diet || [],
      p_allergies: rsvpData.allergies || '',
      p_message: rsvpData.message || '',
      p_song_request: rsvpData.songRequest || '',
    });
    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || 'Błąd RSVP.' };
    const guest = await this.getGuestByCode(code);
    return { success: true, guest };
  },

  async getSchedule() {
    const { data, error } = await supabaseClient.from('schedule_items').select('*').order('sort_order');
    if (error) throw error;
    return (data || []).map(r => ({ time: r.time, title: r.title, description: r.description }));
  },

  async getFaq() {
    const { data, error } = await supabaseClient.from('faq_items').select('*').order('sort_order');
    if (error) throw error;
    return (data || []).map(r => ({ question: r.question, answer: r.answer }));
  },

  async getChecklist() {
    const { data, error } = await supabaseClient.from('checklist_items').select('*').order('sort_order');
    if (error) throw error;
    return (data || []).map(r => ({ id: r.id, text: r.text, done: r.done }));
  },

  async addChecklistItem(text) {
    const items = await this.getChecklist();
    const { data, error } = await supabaseClient.from('checklist_items')
      .insert({ text, done: false, sort_order: items.length + 1 })
      .select().single();
    if (error) throw error;
    return { id: data.id, text: data.text, done: data.done };
  },

  async toggleChecklistItem(id) {
    const { data: current } = await supabaseClient.from('checklist_items').select('done').eq('id', id).single();
    const { data, error } = await supabaseClient.from('checklist_items')
      .update({ done: !current.done }).eq('id', id).select().single();
    if (error) throw error;
    return { id: data.id, text: data.text, done: data.done };
  },

  async deleteChecklistItem(id) {
    const { error } = await supabaseClient.from('checklist_items').delete().eq('id', id);
    if (error) throw error;
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
    return LocalStore.getDietSummary.call({ getGuests: () => this.getGuests() });
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
    throw new Error('Reset danych dostępny tylko w trybie lokalnym.');
  },
};

CloudStore.getDietSummary = async function () {
  const guests = (await this.getGuests()).filter(g => g.status === 'confirmed');
  const summary = { standard: 0, vegetarian: 0, vegan: 0, glutenFree: 0, kids: 0, other: 0 };
  guests.forEach(g => {
    const count = g.confirmedGuests || 1;
    if (!g.diet || g.diet.length === 0) summary.standard += count;
    else g.diet.forEach(d => { if (summary[d] !== undefined) summary[d] += count; else summary.other += count; });
  });
  return summary;
};

CloudStore.isAdminLoggedIn = async function () {
  return this.checkAdminSession();
};

async function initApi() {
  if (isCloudConfigured()) {
    store = CloudStore;
    await store.init();
  } else {
    store = LocalStore;
    await store.init();
  }
  return store.isCloud();
}

function isUsingCloud() {
  return store.isCloud();
}

async function loginAdmin(email, password) {
  if (store.isCloud()) return store.loginAdmin(email, password);
  return store.loginAdmin(email, password);
}

async function logoutAdmin() { return store.logoutAdmin(); }
async function isAdminLoggedIn() {
  if (store.isCloud()) return store.checkAdminSession();
  return store.isAdminLoggedIn();
}
async function getSettings() { return store.getSettings(); }
async function updateSettings(s) { return store.updateSettings(s); }
async function getGuests() { return store.getGuests(); }
async function getGuestByCode(c) { return store.getGuestByCode(c); }
async function getGuestById(id) { return store.getGuestById(id); }
async function addGuest(g) { return store.addGuest(g); }
async function updateGuest(id, u) { return store.updateGuest(id, u); }
async function deleteGuest(id) { return store.deleteGuest(id); }
async function markInvitationSent(id) { return store.markInvitationSent(id); }
async function submitRsvp(c, d) { return store.submitRsvp(c, d); }
async function getSchedule() { return store.getSchedule(); }
async function getFaq() { return store.getFaq(); }
async function getChecklist() { return store.getChecklist(); }
async function addChecklistItem(t) { return store.addChecklistItem(t); }
async function toggleChecklistItem(id) { return store.toggleChecklistItem(id); }
async function deleteChecklistItem(id) { return store.deleteChecklistItem(id); }
async function getGuestStats() { return store.getGuestStats(); }
async function getDietSummary() { return store.getDietSummary(); }
async function exportGuestsCSV() { return store.exportGuestsCSV(); }
async function resetData() { return store.resetData(); }

function getInviteUrl(code) {
  return resolveSiteBaseUrl().then(base =>
    (base || '') + 'index.html?kod=' + encodeURIComponent(code)
  );
}

async function resolveSiteBaseUrl() {
  const settings = await getSettings();
  if (settings.siteUrl) {
    return settings.siteUrl.replace(/\/?$/, '/');
  }
  const path = window.location.pathname.replace(/admin\.html$/, '').replace(/[^/]+$/, '');
  const basePath = path.endsWith('/') ? path : path + '/';
  if (window.location.protocol === 'file:') return '';
  return window.location.origin + basePath;
}

async function buildInviteMessage(guest) {
  const settings = await getSettings();
  const base = await resolveSiteBaseUrl();
  const url = (base || '') + 'index.html?kod=' + encodeURIComponent(guest.code);
  const firstName = guest.name.split(' ')[0];
  return (
    `Cześć ${firstName}!\n\n` +
    `Zapraszamy Cię na nasz ślub — ${settings.brideName} & ${settings.groomName}.\n\n` +
    `Kliknij link, aby zobaczyć szczegóły i potwierdzić obecność:\n${url}\n\n` +
    `Do zobaczenia!`
  );
}

function normalizePhone(phone) {
  if (!phone) return '';
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+48' + p.slice(1);
  if (/^\d{9}$/.test(p)) p = '+48' + p;
  return p.replace('+', '');
}

function getWhatsAppUrl(phone, message) {
  const p = normalizePhone(phone);
  if (!p) return null;
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(message);
}

function getSmsUrl(phone, message) {
  const p = normalizePhone(phone);
  if (!p) return 'sms:?body=' + encodeURIComponent(message);
  return 'sms:+' + p + '?body=' + encodeURIComponent(message);
}

function getEmailUrl(email, guest, message) {
  if (!email) return null;
  const subject = encodeURIComponent('Zaproszenie na ślub');
  return 'mailto:' + email + '?subject=' + subject + '&body=' + encodeURIComponent(message);
}

function hasInvitationBeenSent(guest) {
  return !!guest.invitationSentAt;
}

function getUnsentGuests(guests) {
  return guests.filter(g => !hasInvitationBeenSent(g));
}
