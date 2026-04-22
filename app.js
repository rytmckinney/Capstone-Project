'use strict';

/* ============================================================
   ENCRYPTION  (AES-256 via CryptoJS)
   All sensitive data (patients, reminders, check-ins,
   contacts, notes) is encrypted before being written to
   localStorage.  Patient photos are stored as-is because
   they are not considered sensitive per the requirements.
   ============================================================ */
const ENCRYPT_KEY = 'ElderCare_AES256_Capstone2026_K!#9zXqRmT';

function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPT_KEY).toString();
}

function decrypt(cipher) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, ENCRYPT_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
}

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
function storeSave(key, value, encrypted = true) {
  localStorage.setItem(key, encrypted ? encrypt(value) : JSON.stringify(value));
}

function storeLoad(key, defaultVal = null, encrypted = true) {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultVal;
  if (!encrypted) {
    try { return JSON.parse(raw); } catch { return defaultVal; }
  }
  const result = decrypt(raw);
  return result !== null ? result : defaultVal;
}

function storeRemove(key) { localStorage.removeItem(key); }

/* ============================================================
   APP STATE
   ============================================================ */
const state = {
  patientId:            null,
  tab:                  'calendar',
  calYear:              new Date().getFullYear(),
  calMonth:             new Date().getMonth(),
  selectedDate:         null,
  darkMode:             false,
  pendingDelete:        null,
  editingPatientId:     null,
  newPhotoData:         null,
  selectedReminderType: 'medication',
};

/* ============================================================
   PATIENT DATA
   ============================================================ */
function patientsGet()        { return storeLoad('ec_patients', []); }
function patientsSave(list)   { storeSave('ec_patients', list); }

function patientAdd(name, age, room) {
  const list    = patientsGet();
  const patient = { id: 'p' + Date.now(), name, age: +age, room, createdAt: Date.now() };
  list.push(patient);
  patientsSave(list);
  return patient;
}

function patientUpdate(id, name, age, room) {
  const list = patientsGet().map(p => {
    if (p.id !== id) return p;
    return { ...p, name, age: +age, room };
  });
  patientsSave(list);
}

function patientDelete(id) {
  patientsSave(patientsGet().filter(p => p.id !== id));
  ['reminders', 'checkins', 'contacts', 'notes'].forEach(k => storeRemove(`ec_${k}_${id}`));
  const photos = storeLoad('ec_photos', {}, false);
  delete photos[id];
  storeSave('ec_photos', photos, false);
}

function patientPhotoSave(id, data) {
  const photos = storeLoad('ec_photos', {}, false);
  photos[id]   = data;
  storeSave('ec_photos', photos, false);
}
function patientPhotoGet(id) {
  return (storeLoad('ec_photos', {}, false))[id] || null;
}

/* ============================================================
   REMINDERS
   ============================================================ */
function remindersGet(pid)          { return storeLoad(`ec_reminders_${pid}`, {}); }
function remindersSave(pid, data)   { storeSave(`ec_reminders_${pid}`, data); }

function remindersForDate(pid, dk) {
  return remindersGet(pid)[dk] || [];
}

function reminderAdd(pid, dk, type, title, time, notes) {
  const all = remindersGet(pid);
  if (!all[dk]) all[dk] = [];
  const r = { id: 'r' + Date.now(), type, title, time, notes };
  all[dk].push(r);
  remindersSave(pid, all);
  return r;
}

function reminderDelete(pid, dk, rid) {
  const all = remindersGet(pid);
  if (all[dk]) {
    all[dk] = all[dk].filter(r => r.id !== rid);
    if (!all[dk].length) delete all[dk];
  }
  remindersSave(pid, all);
}

/* ============================================================
   CHECK-INS
   ============================================================ */
function checkinsGet(pid)         { return storeLoad(`ec_checkins_${pid}`, []); }
function checkinsSave(pid, data)  { storeSave(`ec_checkins_${pid}`, data); }

function checkinIs(pid, dk) { return checkinsGet(pid).includes(dk); }

function checkinToggle(pid, dk) {
  let list = checkinsGet(pid);
  if (list.includes(dk)) { list = list.filter(d => d !== dk); }
  else                   { list.push(dk); }
  checkinsSave(pid, list);
  return list.includes(dk);
}

/* ============================================================
   CONTACTS
   ============================================================ */
function contactsGet(pid)        { return storeLoad(`ec_contacts_${pid}`, []); }
function contactsSave(pid, data) { storeSave(`ec_contacts_${pid}`, data); }

function contactAdd(pid, name, relationship, phone, email, address) {
  const list = contactsGet(pid);
  const c    = { id: 'c' + Date.now(), name, relationship, phone, email, address };
  list.push(c);
  contactsSave(pid, list);
  return c;
}
function contactDelete(pid, cid) {
  contactsSave(pid, contactsGet(pid).filter(c => c.id !== cid));
}

/* ============================================================
   NOTES
   ============================================================ */
function notesGet(pid)        { return storeLoad(`ec_notes_${pid}`, []); }
function notesSave(pid, data) { storeSave(`ec_notes_${pid}`, data); }

function noteAdd(pid, date, title, content) {
  const list = notesGet(pid);
  const n    = { id: 'n' + Date.now(), date, title, content, createdAt: Date.now() };
  list.unshift(n);
  notesSave(pid, list);
  return n;
}
function noteDelete(pid, nid) {
  notesSave(pid, notesGet(pid).filter(n => n.id !== nid));
}

/* ============================================================
   UTILITIES
   ============================================================ */
function makeDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateDisplay(dk) {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatDateShort(dk) {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Compress an image to a max size using canvas */
function compressImage(dataUrl, maxSize = 200, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
      else        { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(w);
      canvas.height = Math.round(h);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

/* ============================================================
   MODAL MANAGEMENT
   ============================================================ */
function modalOpen(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); }
}
function modalClose(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
}

/* ============================================================
   THEME
   ============================================================ */
function themeApply(dark) {
  state.darkMode = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  storeSave('ec_settings', { darkMode: dark }, false);
}
function themeToggle() { themeApply(!state.darkMode); }

/* ============================================================
   PAGE NAVIGATION
   ============================================================ */
function showHome() {
  document.getElementById('page-home').classList.add('active');
  document.getElementById('page-dashboard').classList.remove('active');
  state.patientId = null;
  renderPatients();
}

function showDashboard(patientId) {
  const patient = patientsGet().find(p => p.id === patientId);
  if (!patient) { showHome(); return; }

  state.patientId = patientId;
  state.tab       = 'calendar';
  state.calYear   = new Date().getFullYear();
  state.calMonth  = new Date().getMonth();

  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-dashboard').classList.add('active');

  renderPatientHeader(patient);
  switchTab('calendar');
}

function switchTab(tabName) {
  state.tab = tabName;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabName}`);
  });

  if      (tabName === 'calendar') renderCalendar();
  else if (tabName === 'contacts') renderContacts();
  else if (tabName === 'notes')    renderNotes();
}

/* ============================================================
   RENDER: PATIENT LIST (Home)
   ============================================================ */
function renderPatients() {
  const grid     = document.getElementById('patient-grid');
  const empty    = document.getElementById('empty-patients');
  const patients = patientsGet();

  grid.innerHTML = '';

  if (!patients.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  patients.forEach(p => {
    const photo  = patientPhotoGet(p.id);
    const card   = document.createElement('div');
    card.className = 'patient-card';
    card.innerHTML = `
      <div class="patient-card-edit">
        <button class="icon-btn patient-card-edit-btn"
          data-action="edit-patient" data-id="${p.id}" data-name="${escapeHtml(p.name)}"
          title="Edit patient" aria-label="Edit patient">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19.5 3 20l.5-4L16.5 3.5z"/></svg>
        </button>
      </div>
      <div class="patient-card-avatar">
        ${photo
          ? `<img src="${photo}" alt="${escapeHtml(p.name)}" />`
          : `<span>${initials(p.name)}</span>`}
      </div>
      <div class="patient-card-name">${escapeHtml(p.name)}</div>
      <div class="patient-card-info">
        <span class="patient-card-badge">Age ${p.age}</span>
        <span class="patient-card-badge">Room ${escapeHtml(p.room)}</span>
      </div>
      <div class="patient-card-actions">
        <button class="btn btn-primary"
          data-action="open-patient" data-id="${p.id}">Open Dashboard</button>
        <button class="btn btn-ghost"
          style="color:var(--danger);border-color:var(--danger)"
          data-action="delete-patient" data-id="${p.id}"
          data-name="${escapeHtml(p.name)}">Delete</button>
      </div>`;
    grid.appendChild(card);
  });
}

function renderPatientHeader(patient) {
  const photo = patientPhotoGet(patient.id);
  document.getElementById('patient-header').innerHTML = `
    <div class="patient-header-avatar">
      ${photo
        ? `<img src="${photo}" alt="${escapeHtml(patient.name)}" />`
        : `<span>${initials(patient.name)}</span>`}
    </div>
    <div>
      <div class="patient-header-name">${escapeHtml(patient.name)}</div>
      <div class="patient-header-meta">Age ${patient.age} · Room ${escapeHtml(patient.room)}</div>
    </div>`;
}

/* ============================================================
   RENDER: CALENDAR
   ============================================================ */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function renderCalendar() {
  const pid   = state.patientId;
  const year  = state.calYear;
  const month = state.calMonth;

  document.getElementById('cal-month-label').textContent = `${MONTH_NAMES[month]} ${year}`;

  const allReminders = remindersGet(pid);
  const checkins     = checkinsGet(pid);
  const grid         = document.getElementById('calendar-grid');
  const today        = new Date();
  const todayKey     = makeDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  grid.innerHTML = '';

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const prevMonthDays  = new Date(year, month, 0).getDate();

  // Padding from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'cal-day other-month';
    cell.innerHTML = `<span class="cal-day-num">${prevMonthDays - i}</span>`;
    grid.appendChild(cell);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dk           = makeDateKey(year, month, d);
    const dayReminders = allReminders[dk] || [];
    const types        = [...new Set(dayReminders.map(r => r.type))];
    const isCheckedIn  = checkins.includes(dk);
    const isToday      = dk === todayKey;

    let dotsHtml = '';
    if (types.includes('medication'))  dotsHtml += '<span class="cal-dot dot-medication"></span>';
    if (types.includes('appointment')) dotsHtml += '<span class="cal-dot dot-appointment"></span>';
    if (types.includes('task'))        dotsHtml += '<span class="cal-dot dot-task"></span>';
    if (isCheckedIn)                   dotsHtml += '<span class="cal-dot dot-checkin"></span>';

    const cell = document.createElement('div');
    cell.className = `cal-day${isToday ? ' today' : ''}`;
    cell.dataset.date = dk;
    cell.innerHTML = `
      <span class="cal-day-num">${d}</span>
      ${dotsHtml ? `<div class="cal-day-dots">${dotsHtml}</div>` : ''}`;
    cell.addEventListener('click', () => openDayModal(dk));
    grid.appendChild(cell);
  }

  // Padding for next month
  const totalCells = firstDayOfWeek + daysInMonth;
  const remainder  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainder; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day other-month';
    cell.innerHTML = `<span class="cal-day-num">${i}</span>`;
    grid.appendChild(cell);
  }
}

/* ============================================================
   DAY DETAIL MODAL
   ============================================================ */
function openDayModal(dk) {
  state.selectedDate         = dk;
  state.selectedReminderType = 'medication';

  document.getElementById('day-detail-title').textContent = formatDateDisplay(dk);

  // Sync check-in toggle
  document.getElementById('checkin-checkbox').checked = checkinIs(state.patientId, dk);

  // Reset type tabs to medication
  document.querySelectorAll('.type-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.type === 'medication');
  });

  // Clear add-reminder form
  document.getElementById('input-reminder-title').value = '';
  document.getElementById('input-reminder-time').value  = '';
  document.getElementById('input-reminder-notes').value = '';

  renderDayReminders();
  modalOpen('modal-day-detail');
}

function renderDayReminders() {
  const pid       = state.patientId;
  const dk        = state.selectedDate;
  const reminders = remindersForDate(pid, dk);
  const list      = document.getElementById('day-reminders-list');
  const noMsg     = document.getElementById('no-day-reminders');

  list.innerHTML = '';

  if (!reminders.length) {
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  const icons = {
    medication: '<img class="reminder-item-icon-img" src="icons/medicine.png" alt="Medication" />',
    appointment: '<img class="reminder-item-icon-img" src="icons/stethoscope.png" alt="Appointment" />',
    task: '<img class="reminder-item-icon-img" src="icons/clipboard.png" alt="Task" />',
  };
  const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

  reminders.forEach(r => {
    const meta = [r.time ? formatTime(r.time) : '', r.notes].filter(Boolean).join(' · ');
    const item = document.createElement('div');
    item.className = `reminder-item type-${r.type}`;
    item.innerHTML = `
      <span class="reminder-item-icon">${icons[r.type] || '📌'}</span>
      <div class="reminder-item-info">
        <div class="reminder-item-title">${escapeHtml(r.title)}</div>
        ${meta ? `<div class="reminder-item-meta">${escapeHtml(meta)}</div>` : ''}
      </div>
      <button class="icon-btn" style="color:var(--danger);width:34px;height:34px"
        data-action="delete-reminder" data-id="${r.id}" title="Delete reminder">
        ${trashSvg}
      </button>`;
    list.appendChild(item);
  });
}

/* ============================================================
   RENDER: EMERGENCY CONTACTS
   ============================================================ */
function renderContacts() {
  const pid      = state.patientId;
  const contacts = contactsGet(pid);
  const list     = document.getElementById('contacts-list');
  const empty    = document.getElementById('empty-contacts');

  list.innerHTML = '';

  if (!contacts.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  const phoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.5 19.79 19.79 0 0 1 1.61 2.82 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.59a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16"/></svg>`;
  const mailSvg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  const pinSvg   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

  contacts.forEach(c => {
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.innerHTML = `
      <div class="contact-card-header">
        <div>
          <div class="contact-name">${escapeHtml(c.name)}</div>
          <span class="contact-relationship">${escapeHtml(c.relationship)}</span>
        </div>
        <button class="icon-btn" style="color:var(--danger)"
          data-action="delete-contact" data-id="${c.id}" title="Delete contact">
          ${trashSvg}
        </button>
      </div>
      <div class="contact-details">
        ${c.phone ? `<div class="contact-detail-row">${phoneSvg}<a href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a></div>` : ''}
        ${c.email ? `<div class="contact-detail-row">${mailSvg}<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></div>` : ''}
        ${c.address ? `<div class="contact-detail-row">${pinSvg}<span>${escapeHtml(c.address)}</span></div>` : ''}
      </div>`;
    list.appendChild(card);
  });
}

/* ============================================================
   RENDER: NOTES
   ============================================================ */
function renderNotes() {
  const pid   = state.patientId;
  const notes = notesGet(pid);
  const list  = document.getElementById('notes-list');
  const empty = document.getElementById('empty-notes');

  list.innerHTML = '';

  if (!notes.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  const calSvg   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  notes.forEach(n => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-card-header">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-card-meta">
          <span class="note-date-badge">${calSvg} ${formatDateShort(n.date)}</span>
          <button class="icon-btn" style="color:var(--danger);width:34px;height:34px"
            data-action="delete-note" data-id="${n.id}" title="Delete note">
            ${trashSvg}
          </button>
        </div>
      </div>
      <div class="note-content">${escapeHtml(n.content)}</div>
      <div class="note-created">Added ${new Date(n.createdAt).toLocaleString()}</div>`;
    list.appendChild(card);
  });
}

/* ============================================================
   CONFIRM DELETE
   ============================================================ */
function confirmDelete(message, callback) {
  document.getElementById('delete-confirm-msg').textContent = message;
  state.pendingDelete = callback;
  modalOpen('modal-confirm-delete');
}

/* ============================================================
   EVENT: Global delegation for data-action buttons
   ============================================================ */
document.addEventListener('click', e => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const { action, id, name } = target.dataset;

  switch (action) {
    case 'open-patient':
      showDashboard(id);
      break;

    case 'delete-patient':
      confirmDelete(
        `Delete patient "${name}"? All their data will be permanently removed.`,
        () => { patientDelete(id); renderPatients(); }
      );
      break;

    case 'edit-patient': {
      const patient = patientsGet().find(p => p.id === id);
      if (!patient) return;
      state.editingPatientId = id;
      state.newPhotoData = null;
      document.getElementById('modal-patient-title').textContent = 'Edit Patient';
      document.getElementById('input-patient-name').value = patient.name;
      document.getElementById('input-patient-age').value  = patient.age;
      document.getElementById('input-patient-room').value = patient.room;
      document.getElementById('patient-photo-input').value = '';

      const photo = patientPhotoGet(id);
      const imgEl = document.getElementById('avatar-img');
      const initEl = document.getElementById('avatar-initials');
      if (photo) {
        imgEl.src = photo;
        imgEl.style.display = 'block';
        initEl.style.display = 'none';
      } else {
        initEl.textContent = initials(patient.name);
        initEl.style.display = '';
        imgEl.style.display = 'none';
        imgEl.src = '';
      }
      modalOpen('modal-add-patient');
      break;
    }

    case 'delete-reminder':
      confirmDelete('Delete this reminder?', () => {
        reminderDelete(state.patientId, state.selectedDate, id);
        renderDayReminders();
        renderCalendar();
      });
      break;

    case 'delete-contact':
      confirmDelete('Delete this emergency contact?', () => {
        contactDelete(state.patientId, id);
        renderContacts();
      });
      break;

    case 'delete-note':
      confirmDelete('Delete this note?', () => {
        noteDelete(state.patientId, id);
        renderNotes();
      });
      break;
  }
});

/* ============================================================
   EVENT: Close modals via data-close or clicking backdrop
   ============================================================ */
document.addEventListener('click', e => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) { modalClose(closeBtn.dataset.close); return; }

  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('open')) {
    e.target.classList.remove('open');
    e.target.setAttribute('aria-hidden', 'true');
  }
});

/* Escape key closes any open modal */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
  }
});

/* ============================================================
   EVENT: Theme toggles
   ============================================================ */
document.getElementById('theme-toggle').addEventListener('click', themeToggle);
document.getElementById('theme-toggle-dash').addEventListener('click', themeToggle);

/* ============================================================
   EVENT: Back button
   ============================================================ */
document.getElementById('btn-back').addEventListener('click', showHome);

/* ============================================================
   EVENT: Tab navigation
   ============================================================ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ============================================================
   EVENT: Calendar navigation
   ============================================================ */
document.getElementById('cal-prev').addEventListener('click', () => {
  if (state.calMonth === 0) { state.calMonth = 11; state.calYear--; }
  else state.calMonth--;
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  if (state.calMonth === 11) { state.calMonth = 0; state.calYear++; }
  else state.calMonth++;
  renderCalendar();
});

/* ============================================================
   EVENT: Add Patient modal
   ============================================================ */
document.getElementById('btn-add-patient').addEventListener('click', () => {
  state.editingPatientId = null;
  state.newPhotoData = null;
  document.getElementById('modal-patient-title').textContent = 'Add New Patient';
  document.getElementById('input-patient-name').value  = '';
  document.getElementById('input-patient-age').value   = '';
  document.getElementById('input-patient-room').value  = '';
  document.getElementById('patient-photo-input').value = '';

  const initEl = document.getElementById('avatar-initials');
  const imgEl  = document.getElementById('avatar-img');
  initEl.textContent = '?';
  initEl.style.display = '';
  imgEl.style.display  = 'none';
  imgEl.src            = '';

  modalOpen('modal-add-patient');
});

// Click on the avatar preview circle also triggers file picker
document.getElementById('avatar-preview').addEventListener('click', () => {
  document.getElementById('patient-photo-input').click();
});

// Live initials update as caretaker types the patient's name
document.getElementById('input-patient-name').addEventListener('input', e => {
  if (!state.newPhotoData) {
    const val = e.target.value.trim();
    document.getElementById('avatar-initials').textContent = val ? initials(val) : '?';
  }
});

// Photo file chosen — compress and preview
document.getElementById('patient-photo-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result, 220, 0.82);
    state.newPhotoData = compressed;

    const imgEl  = document.getElementById('avatar-img');
    const initEl = document.getElementById('avatar-initials');
    imgEl.src           = compressed;
    imgEl.style.display = 'block';
    initEl.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// Save patient
document.getElementById('btn-save-patient').addEventListener('click', () => {
  const name = document.getElementById('input-patient-name').value.trim();
  const age  = document.getElementById('input-patient-age').value.trim();
  const room = document.getElementById('input-patient-room').value.trim();

  if (!name || !age || !room) {
    alert('Please fill in all required fields (Name, Age, Room #).');
    return;
  }
  if (isNaN(+age) || +age < 1 || +age > 120) {
    alert('Please enter a valid age between 1 and 120.');
    return;
  }

  if (state.editingPatientId) {
    patientUpdate(state.editingPatientId, name, age, room);
    if (state.newPhotoData) patientPhotoSave(state.editingPatientId, state.newPhotoData);
  } else {
    const patient = patientAdd(name, age, room);
    if (state.newPhotoData) patientPhotoSave(patient.id, state.newPhotoData);
  }

  state.editingPatientId = null;
  state.newPhotoData = null;
  document.getElementById('modal-patient-title').textContent = 'Add New Patient';
  modalClose('modal-add-patient');
  renderPatients();
});

/* ============================================================
   EVENT: Reminder type tab selection (inside day modal)
   ============================================================ */
document.querySelectorAll('.type-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    state.selectedReminderType = btn.dataset.type;
    document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ============================================================
   EVENT: Check-in toggle
   ============================================================ */
document.getElementById('checkin-checkbox').addEventListener('change', () => {
  checkinToggle(state.patientId, state.selectedDate);
  renderCalendar();
});

/* ============================================================
   EVENT: Add reminder (inside day modal)
   ============================================================ */
document.getElementById('btn-add-reminder').addEventListener('click', () => {
  const title = document.getElementById('input-reminder-title').value.trim();
  const time  = document.getElementById('input-reminder-time').value;
  const notes = document.getElementById('input-reminder-notes').value.trim();

  if (!title) {
    alert('Please enter a title for the reminder.');
    return;
  }

  reminderAdd(state.patientId, state.selectedDate, state.selectedReminderType, title, time, notes);

  // Clear the form but keep the modal open
  document.getElementById('input-reminder-title').value = '';
  document.getElementById('input-reminder-time').value  = '';
  document.getElementById('input-reminder-notes').value = '';

  renderDayReminders();
  renderCalendar();
});

/* ============================================================
   EVENT: Add Contact modal
   ============================================================ */
document.getElementById('btn-add-contact').addEventListener('click', () => {
  ['input-contact-name','input-contact-relationship','input-contact-phone',
   'input-contact-email','input-contact-address'].forEach(id => {
    document.getElementById(id).value = '';
  });
  modalOpen('modal-add-contact');
});

// Save contact
document.getElementById('btn-save-contact').addEventListener('click', () => {
  const name    = document.getElementById('input-contact-name').value.trim();
  const rel     = document.getElementById('input-contact-relationship').value.trim();
  const phone   = document.getElementById('input-contact-phone').value.trim();
  const email   = document.getElementById('input-contact-email').value.trim();
  const address = document.getElementById('input-contact-address').value.trim();

  if (!name || !rel || !phone) {
    alert('Please fill in Name, Relationship, and Phone Number.');
    return;
  }

  contactAdd(state.patientId, name, rel, phone, email, address);
  modalClose('modal-add-contact');
  renderContacts();
});

/* ============================================================
   EVENT: Add Note modal
   ============================================================ */
document.getElementById('btn-add-note').addEventListener('click', () => {
  const today = new Date();
  document.getElementById('input-note-date').value = makeDateKey(
    today.getFullYear(), today.getMonth(), today.getDate()
  );
  document.getElementById('input-note-title').value   = '';
  document.getElementById('input-note-content').value = '';
  modalOpen('modal-add-note');
});

// Save note
document.getElementById('btn-save-note').addEventListener('click', () => {
  const date    = document.getElementById('input-note-date').value;
  const title   = document.getElementById('input-note-title').value.trim();
  const content = document.getElementById('input-note-content').value.trim();

  if (!date || !title || !content) {
    alert('Please fill in all required fields (Date, Title, Notes).');
    return;
  }

  noteAdd(state.patientId, date, title, content);
  modalClose('modal-add-note');
  renderNotes();
});

/* ============================================================
   EVENT: Confirm delete button
   ============================================================ */
document.getElementById('btn-confirm-delete').addEventListener('click', () => {
  if (state.pendingDelete) {
    state.pendingDelete();
    state.pendingDelete = null;
  }
  modalClose('modal-confirm-delete');
});

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
  const settings = storeLoad('ec_settings', { darkMode: false }, false);
  themeApply(settings.darkMode || false);
  renderPatients();
}

init();
