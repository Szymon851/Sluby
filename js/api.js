let supabaseClient = null;
let store = LocalStore;

function isCloudConfigured() {
  return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

function mapGuestFromDb(row) {
  if (!row) return null;
  return normalizeGuest({
    id: row.id,
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    invite_code: row.invite_code,
    group_name: row.group_name || '',
    max_guests: row.max_guests,
    status: row.status,
    confirmed_guests: row.confirmed_guests,
    diet: row.diet || [],
    allergies: row.allergies || '',
    message: row.message || '',
    guest_people: row.guest_people || row.people || [],
    responded_at: row.responded_at,
    invitation_sent_at: row.invitation_sent_at,
  });
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
    giftsBankAccount: row.gifts_bank_account || '',
    giftsLink: row.gifts_link || '',
    heroImageUrl: row.hero_image_url || 'img/hero.jpg',
    galleryUrls: row.gallery_urls || '',
    siteUrl: row.site_url || '',
    siteMode: row.site_mode || 'preview',
    theme: row.theme || 'classic',
  };
}

function mapSettingsToDb(s) {
  const row = {
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
    gifts_bank_account: s.giftsBankAccount || '',
    gifts_link: s.giftsLink || '',
    hero_image_url: s.heroImageUrl || '',
    gallery_urls: s.galleryUrls || '',
    site_url: s.siteUrl,
    theme: s.theme === 'blush' ? 'blush' : 'classic',
    updated_at: new Date().toISOString(),
  };
  return row;
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
    const current = await this.getSettings();
    const incoming = { ...newSettings };
    delete incoming.siteMode;
    const merged = { ...current, ...incoming, siteMode: current.siteMode };
    const payload = mapSettingsToDb(merged);
    const { error } = await supabaseClient.from('wedding_settings').update(payload).eq('id', 1);
    if (error) throw error;
    return this.getSettings();
  },

  async getGuests() {
    const { data, error } = await supabaseClient
      .from('guests')
      .select('*, guest_people(*)')
      .order('name');
    if (error) throw error;
    return (data || []).map(mapGuestFromDb);
  },

  async getGuestByCode(code) {
    const { data, error } = await supabaseClient.rpc('get_guest_by_code', { p_code: code.trim() });
    if (error) throw error;
    if (!data) return null;
    return normalizeGuest({
      id: data.id,
      name: data.name,
      invite_code: data.code,
      max_guests: data.maxGuests,
      status: data.status,
      confirmed_guests: data.confirmedGuests,
      message: data.message || '',
      people: data.people || [],
    });
  },

  async getGuestById(id) {
    const { data, error } = await supabaseClient
      .from('guests')
      .select('*, guest_people(*)')
      .eq('id', id)
      .single();
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

    const { data, error } = await supabaseClient.from('guests').insert(payload).select('*, guest_people(*)').single();
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
    if (updates.respondedAt !== undefined) dbUpdates.responded_at = updates.respondedAt;
    if (updates.invitationSentAt !== undefined) dbUpdates.invitation_sent_at = updates.invitationSentAt;

    const { data, error } = await supabaseClient.from('guests').update(dbUpdates).eq('id', id).select('*, guest_people(*)').single();
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
      p_people: rsvpData.people || [],
      p_message: rsvpData.message || '',
    });
    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || 'Błąd RSVP.' };
    const guest = await this.getGuestByCode(code);
    return { success: true, guest };
  },

  async getSchedule() {
    const { data, error } = await supabaseClient.from('schedule_items').select('*');
    if (error) throw error;
    return sortScheduleByTime((data || []).map((r, i) => normalizeScheduleItem({
      id: r.id, time: r.time, title: r.title, description: r.description, sort_order: r.sort_order,
    }, i)));
  },

  async addScheduleItem(item) {
    const existing = await this.getSchedule();
    const { data, error } = await supabaseClient.from('schedule_items').insert({
      time: item.time,
      title: item.title,
      description: item.description || '',
      sort_order: existing.length + 1,
    }).select().single();
    if (error) throw error;
    return normalizeScheduleItem(data);
  },

  async updateScheduleItem(id, updates) {
    const db = {};
    if (updates.time !== undefined) db.time = updates.time;
    if (updates.title !== undefined) db.title = updates.title;
    if (updates.description !== undefined) db.description = updates.description;
    if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
    const { data, error } = await supabaseClient.from('schedule_items').update(db).eq('id', id).select().single();
    if (error) throw error;
    return normalizeScheduleItem(data);
  },

  async deleteScheduleItem(id) {
    const { error } = await supabaseClient.from('schedule_items').delete().eq('id', id);
    if (error) throw error;
  },

  async getFaq() {
    const { data, error } = await supabaseClient.from('faq_items').select('*').order('sort_order');
    if (error) throw error;
    return (data || []).map((r, i) => normalizeFaqItem({
      id: r.id, question: r.question, answer: r.answer, sort_order: r.sort_order,
    }, i));
  },

  async addFaqItem(item) {
    const existing = await this.getFaq();
    const { data, error } = await supabaseClient.from('faq_items').insert({
      question: item.question,
      answer: item.answer,
      sort_order: item.sortOrder ?? existing.length + 1,
    }).select().single();
    if (error) throw error;
    return normalizeFaqItem(data);
  },

  async updateFaqItem(id, updates) {
    const db = {};
    if (updates.question !== undefined) db.question = updates.question;
    if (updates.answer !== undefined) db.answer = updates.answer;
    if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
    const { data, error } = await supabaseClient.from('faq_items').update(db).eq('id', id).select().single();
    if (error) throw error;
    return normalizeFaqItem(data);
  },

  async deleteFaqItem(id) {
    const { error } = await supabaseClient.from('faq_items').delete().eq('id', id);
    if (error) throw error;
  },

  async reorderFaqItems(orderedIds) {
    await Promise.all(orderedIds.map((id, i) =>
      supabaseClient.from('faq_items').update({ sort_order: i + 1 }).eq('id', id)
    ));
  },

  async getVendors() {
    const { data, error } = await supabaseClient.from('vendors').select('*').order('name');
    if (error) throw error;
    return (data || []).map(normalizeVendor);
  },

  async addVendor(vendor) {
    const { data, error } = await supabaseClient.from('vendors').insert({
      name: vendor.name,
      role: vendor.role || '',
      phone: vendor.phone || null,
      email: vendor.email || null,
      notes: vendor.notes || '',
      contract_date: vendor.contractDate || null,
    }).select().single();
    if (error) throw error;
    return normalizeVendor(data);
  },

  async updateVendor(id, updates) {
    const db = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.role !== undefined) db.role = updates.role;
    if (updates.phone !== undefined) db.phone = updates.phone || null;
    if (updates.email !== undefined) db.email = updates.email || null;
    if (updates.notes !== undefined) db.notes = updates.notes;
    if (updates.contractDate !== undefined) db.contract_date = updates.contractDate || null;
    const { data, error } = await supabaseClient.from('vendors').update(db).eq('id', id).select().single();
    if (error) throw error;
    return normalizeVendor(data);
  },

  async deleteVendor(id) {
    const { error } = await supabaseClient.from('vendors').delete().eq('id', id);
    if (error) throw error;
  },

  async getChecklist() {
    const { data, error } = await supabaseClient.from('checklist_items').select('*').order('sort_order');
    if (error) throw error;
    return (data || []).map((r, i) => normalizeChecklistItem(r, i));
  },

  async addChecklistItem(text, linkPanel = '') {
    const items = await this.getChecklist();
    const { data, error } = await supabaseClient.from('checklist_items')
      .insert({
        text,
        done: false,
        sort_order: items.length + 1,
        link_panel: linkPanel || '',
      })
      .select().single();
    if (error) throw error;
    return normalizeChecklistItem(data);
  },

  async updateChecklistItem(id, updates) {
    const db = {};
    if (updates.text !== undefined) db.text = updates.text;
    if (updates.linkPanel !== undefined) db.link_panel = updates.linkPanel || '';
    if (updates.done !== undefined) db.done = !!updates.done;
    if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
    const { data, error } = await supabaseClient.from('checklist_items')
      .update(db).eq('id', id).select().single();
    if (error) throw error;
    return normalizeChecklistItem(data);
  },

  async toggleChecklistItem(id) {
    const { data: current } = await supabaseClient.from('checklist_items').select('done').eq('id', id).single();
    const { data, error } = await supabaseClient.from('checklist_items')
      .update({ done: !current.done }).eq('id', id).select().single();
    if (error) throw error;
    return normalizeChecklistItem(data);
  },

  async deleteChecklistItem(id) {
    const { error } = await supabaseClient.from('checklist_items').delete().eq('id', id);
    if (error) throw error;
  },

  async reorderChecklistItems(orderedIds) {
    await Promise.all(orderedIds.map((id, i) =>
      supabaseClient.from('checklist_items').update({ sort_order: i + 1 }).eq('id', id)
    ));
  },

  async getBudgetItems() {
    const { data, error } = await supabaseClient
      .from('budget_items')
      .select('*, budget_payments(*)')
      .order('sort_order');
    if (error) throw error;
    return (data || []).map(row => normalizeBudgetItem({
      id: row.id,
      category: row.category,
      name: row.name,
      estimated: row.estimated_cost,
      contracted: row.contracted_cost,
      notes: row.notes,
      sortOrder: row.sort_order,
      payments: (row.budget_payments || []).map(p => ({
        id: p.id,
        label: p.label,
        amount: p.amount,
        dueDate: p.due_date,
        isPaid: p.is_paid,
        paidAt: p.paid_at,
        notes: p.notes,
      })),
    }));
  },

  async addBudgetItem(item) {
    const existing = await this.getBudgetItems();
    const { data, error } = await supabaseClient.from('budget_items').insert({
      category: item.category || 'Inne',
      name: item.name,
      estimated_cost: item.estimated || 0,
      contracted_cost: item.contracted || 0,
      notes: item.notes || '',
      sort_order: existing.length + 1,
    }).select().single();
    if (error) throw error;
    return normalizeBudgetItem({
      id: data.id,
      category: data.category,
      name: data.name,
      estimated: data.estimated_cost,
      contracted: data.contracted_cost,
      notes: data.notes,
      sortOrder: data.sort_order,
      payments: [],
    });
  },

  async updateBudgetItem(id, updates) {
    const db = {};
    if (updates.category !== undefined) db.category = updates.category;
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.estimated !== undefined) db.estimated_cost = updates.estimated;
    if (updates.contracted !== undefined) db.contracted_cost = updates.contracted;
    if (updates.notes !== undefined) db.notes = updates.notes;
    const { error } = await supabaseClient.from('budget_items').update(db).eq('id', id);
    if (error) throw error;
    const items = await this.getBudgetItems();
    return items.find(i => i.id === id) || null;
  },

  async deleteBudgetItem(id) {
    const { error } = await supabaseClient.from('budget_items').delete().eq('id', id);
    if (error) throw error;
  },

  async addBudgetPayment(itemId, payment) {
    const { data, error } = await supabaseClient.from('budget_payments').insert({
      budget_item_id: itemId,
      label: payment.label || 'Rata',
      amount: payment.amount || 0,
      due_date: payment.dueDate || null,
      is_paid: !!payment.isPaid,
      paid_at: payment.isPaid ? (payment.paidAt || new Date().toISOString().slice(0, 10)) : null,
      notes: payment.notes || '',
    }).select().single();
    if (error) throw error;
    return normalizePayment({
      id: data.id,
      label: data.label,
      amount: data.amount,
      dueDate: data.due_date,
      isPaid: data.is_paid,
      paidAt: data.paid_at,
      notes: data.notes,
    });
  },

  async updateBudgetPayment(itemId, paymentId, updates) {
    const db = {};
    if (updates.label !== undefined) db.label = updates.label;
    if (updates.amount !== undefined) db.amount = updates.amount;
    if (updates.dueDate !== undefined) db.due_date = updates.dueDate || null;
    if (updates.notes !== undefined) db.notes = updates.notes;
    if (updates.isPaid !== undefined) {
      db.is_paid = updates.isPaid;
      db.paid_at = updates.isPaid
        ? (updates.paidAt || new Date().toISOString().slice(0, 10))
        : null;
    }
    const { data, error } = await supabaseClient.from('budget_payments')
      .update(db).eq('id', paymentId).eq('budget_item_id', itemId).select().single();
    if (error) throw error;
    return normalizePayment({
      id: data.id,
      label: data.label,
      amount: data.amount,
      dueDate: data.due_date,
      isPaid: data.is_paid,
      paidAt: data.paid_at,
      notes: data.notes,
    });
  },

  async deleteBudgetPayment(itemId, paymentId) {
    const { error } = await supabaseClient.from('budget_payments')
      .delete().eq('id', paymentId).eq('budget_item_id', itemId);
    if (error) throw error;
  },

  async seedBudgetDefaults() {
    return LocalStore.seedBudgetDefaults.call(this);
  },

  async getGifts() {
    const { data, error } = await supabaseClient.rpc('get_gifts');
    if (error) throw error;
    return (data || []).map(normalizeGiftItem);
  },

  async addGift(item) {
    const payload = {
      name: item.name,
      url: item.url || '',
      notes: item.notes || '',
      sort_order: item.sortOrder ?? 0,
    };
    const { data, error } = await supabaseClient.from('gift_items').insert(payload).select().single();
    if (error) throw error;
    return normalizeGiftItem(data);
  },

  async updateGift(id, updates) {
    const db = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.url !== undefined) db.url = updates.url;
    if (updates.notes !== undefined) db.notes = updates.notes;
    if (updates.sortOrder !== undefined) db.sort_order = updates.sortOrder;
    if (updates.claimedByGuestId === null) {
      db.claimed_by_guest_id = null;
      db.claimed_at = null;
    }
    const { data, error } = await supabaseClient.from('gift_items').update(db).eq('id', id).select().single();
    if (error) throw error;
    return normalizeGiftItem(data);
  },

  async deleteGift(id) {
    const { error } = await supabaseClient.from('gift_items').delete().eq('id', id);
    if (error) throw error;
  },

  async claimGift(code, giftId) {
    const { data, error } = await supabaseClient.rpc('claim_gift', {
      p_code: code.trim(),
      p_gift_id: giftId,
    });
    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || 'Nie udało się zająć prezentu.' };
    return { success: true };
  },

  async releaseGift(code, giftId) {
    const { data, error } = await supabaseClient.rpc('release_gift', {
      p_code: code.trim(),
      p_gift_id: giftId,
    });
    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || 'Nie udało się zwolnić prezentu.' };
    return { success: true };
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
    throw new Error('Reset danych dostępny tylko w trybie lokalnym.');
  },
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
async function addScheduleItem(i) { return store.addScheduleItem(i); }
async function updateScheduleItem(id, u) { return store.updateScheduleItem(id, u); }
async function deleteScheduleItem(id) { return store.deleteScheduleItem(id); }
async function getFaq() { return store.getFaq(); }
async function addFaqItem(i) { return store.addFaqItem(i); }
async function updateFaqItem(id, u) { return store.updateFaqItem(id, u); }
async function deleteFaqItem(id) { return store.deleteFaqItem(id); }
async function reorderFaqItems(ids) { return store.reorderFaqItems(ids); }
async function getVendors() { return store.getVendors(); }
async function addVendor(v) { return store.addVendor(v); }
async function updateVendor(id, u) { return store.updateVendor(id, u); }
async function deleteVendor(id) { return store.deleteVendor(id); }
async function getChecklist() { return store.getChecklist(); }
async function addChecklistItem(t, linkPanel) { return store.addChecklistItem(t, linkPanel); }
async function updateChecklistItem(id, u) { return store.updateChecklistItem(id, u); }
async function toggleChecklistItem(id) { return store.toggleChecklistItem(id); }
async function deleteChecklistItem(id) { return store.deleteChecklistItem(id); }
async function reorderChecklistItems(ids) { return store.reorderChecklistItems(ids); }
async function getGuestStats() { return store.getGuestStats(); }
async function getDietSummary() { return store.getDietSummary(); }
async function exportGuestsCSV() { return store.exportGuestsCSV(); }
async function exportBudgetCSV() { return store.exportBudgetCSV(); }
async function resetData() { return store.resetData(); }

async function getBudgetItems() { return store.getBudgetItems(); }
async function addBudgetItem(item) { return store.addBudgetItem(item); }
async function updateBudgetItem(id, u) { return store.updateBudgetItem(id, u); }
async function deleteBudgetItem(id) { return store.deleteBudgetItem(id); }
async function addBudgetPayment(itemId, p) { return store.addBudgetPayment(itemId, p); }
async function updateBudgetPayment(itemId, paymentId, u) { return store.updateBudgetPayment(itemId, paymentId, u); }
async function deleteBudgetPayment(itemId, paymentId) { return store.deleteBudgetPayment(itemId, paymentId); }
async function seedBudgetDefaults() { return store.seedBudgetDefaults(); }

async function getGifts() { return store.getGifts(); }
async function addGift(item) { return store.addGift(item); }
async function updateGift(id, u) { return store.updateGift(id, u); }
async function deleteGift(id) { return store.deleteGift(id); }
async function claimGift(code, giftId) { return store.claimGift(code, giftId); }
async function releaseGift(code, giftId) { return store.releaseGift(code, giftId); }

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
  const couple = /\s+(i|&|oraz)\s+/i.test(guest.name || '');
  const greeting = couple ? `Drodzy ${guest.name}!` : `Cześć ${guest.name.split(' ')[0]}!`;
  const inviteLine = couple
    ? `Zapraszamy Was na nasz ślub — ${settings.brideName} & ${settings.groomName}.`
    : `Zapraszamy Cię na nasz ślub — ${settings.brideName} & ${settings.groomName}.`;
  return (
    `${greeting}\n\n` +
    `${inviteLine}\n\n` +
    `Kliknij link, aby zobaczyć spersonalizowane zaproszenie i potwierdzić obecność:\n${url}\n\n` +
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
