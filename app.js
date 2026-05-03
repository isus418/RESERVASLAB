// =========================================================
// app.js — lógica principal de Reservas Lab
// =========================================================
import { LAB_USERS, ROOMS, SCHEDULE, FIREBASE_CONFIG } from './config.js';

// ---------- Modo: Firebase si está configurado, si no localStorage ----------
const FIREBASE_CONFIGURED = !String(FIREBASE_CONFIG.apiKey).includes("REEMPLAZAR");
let FIREBASE_OK = false;   // se vuelve true solo si Firebase logra cargar

let db = null;          // referencia a Firebase (si aplica)
let dbRef = null;       // helpers
let onValueFn = null;
let setFn = null;
let removeFn = null;

if (FIREBASE_CONFIGURED) {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getDatabase, ref, onValue, set, remove } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    const app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    dbRef = (path) => ref(db, path);
    onValueFn = onValue; setFn = set; removeFn = remove;
    FIREBASE_OK = true;
  } catch (e) {
    console.error("Firebase no se pudo inicializar, usando modo local:", e);
    FIREBASE_OK = false;
  }
}

// ---------- Estado global ----------
let currentUser = "";
let currentDate = todayISO();
let reservations = {}; // { "YYYY-MM-DD": { "ROOMID_HHMM": { user, ts } } }

const els = {
  userSelect: document.getElementById("userSelect"),
  myBtn: document.getElementById("myReservationsBtn"),
  myCount: document.getElementById("myCount"),
  prevDay: document.getElementById("prevDay"),
  nextDay: document.getElementById("nextDay"),
  todayBtn: document.getElementById("todayBtn"),
  datePicker: document.getElementById("datePicker"),
  dateWeekday: document.getElementById("dateWeekday"),
  dateFull: document.getElementById("dateFull"),
  gridHeader: document.getElementById("gridHeader"),
  gridBody: document.getElementById("gridBody"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalText: document.getElementById("modalText"),
  modalMeta: document.getElementById("modalMeta"),
  modalConfirm: document.getElementById("modalConfirm"),
  modalCancel: document.getElementById("modalCancel"),
  drawer: document.getElementById("drawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  drawerBody: document.getElementById("drawerBody"),
  drawerClose: document.getElementById("drawerClose"),
  toast: document.getElementById("toast"),
  connState: document.getElementById("connState"),
  connText: document.getElementById("connText"),
};

// ---------- Helpers de fecha/hora ----------
function todayISO() {
  const d = new Date();
  return ymd(d);
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftDay(iso, delta) {
  const d = parseISO(iso); d.setDate(d.getDate() + delta);
  return ymd(d);
}
function buildSlots() {
  const out = [];
  const total = (SCHEDULE.endHour - SCHEDULE.startHour) * (60 / SCHEDULE.slotMinutes);
  for (let i = 0; i < total; i++) {
    const minutes = SCHEDULE.startHour * 60 + i * SCHEDULE.slotMinutes;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    out.push({
      key: `${String(h).padStart(2,"0")}${String(m).padStart(2,"0")}`,
      label: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`,
      hour: h, minute: m
    });
  }
  return out;
}
const SLOTS = buildSlots();

function slotEndLabel(slot) {
  const total = slot.hour * 60 + slot.minute + SCHEDULE.slotMinutes;
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function fmtFullDate(iso) {
  const d = parseISO(iso);
  const wd = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][d.getDay()];
  const mo = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][d.getMonth()];
  return { weekday: wd, full: `${d.getDate()} ${mo} ${d.getFullYear()}` };
}

function isPastSlot(dateISO, slot) {
  const now = new Date();
  const slotEnd = new Date(parseISO(dateISO));
  slotEnd.setHours(slot.hour, slot.minute + SCHEDULE.slotMinutes, 0, 0);
  return slotEnd <= now;
}

// ---------- UI: poblar usuarios ----------
function renderUserOptions() {
  els.userSelect.innerHTML = '<option value="">— Selecciona tu nombre —</option>' +
    LAB_USERS.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");

  // recordar último usuario
  const remembered = localStorage.getItem("lab_reservas_user");
  if (remembered && LAB_USERS.includes(remembered)) {
    els.userSelect.value = remembered;
    setUser(remembered);
  }
}

function setUser(name) {
  currentUser = name;
  if (name) localStorage.setItem("lab_reservas_user", name);
  els.myBtn.disabled = !name;
  els.myBtn.title = name ? "Ver mis reservas" : "Selecciona tu nombre primero";
  renderGrid();
  updateMyCount();
}

// ---------- UI: header de salas ----------
function renderHeader() {
  els.gridHeader.innerHTML = '<th class="time-col">Hora</th>' +
    ROOMS.map(r => `<th class="room-col"><span class="room-num">${escapeHtml(r.name)}</span></th>`).join("");
}

// ---------- UI: cuerpo del grid ----------
function renderGrid() {
  const dayData = reservations[currentDate] || {};
  const rows = SLOTS.map(slot => {
    const isHourMark = slot.minute === 0;
    const past = isPastSlot(currentDate, slot);
    const cells = ROOMS.map(room => {
      const key = `${room.id}_${slot.key}`;
      const rsv = dayData[key];
      let cls = "cell";
      let label = "";
      if (past && !rsv) cls += " past";
      if (rsv) {
        if (rsv.user === currentUser) { cls += " mine"; label = "Tuya"; }
        else { cls += " taken"; label = rsv.user; }
      }
      return `<td class="${cls}" data-room="${room.id}" data-slot="${slot.key}">${
        rsv ? `<span class="cell-label">${escapeHtml(label)}</span>` : ""
      }</td>`;
    }).join("");
    return `<tr class="${isHourMark ? "hour-mark" : ""}">
      <td class="time-col">${slot.label}</td>${cells}
    </tr>`;
  }).join("");
  els.gridBody.innerHTML = rows;

  // Listeners
  els.gridBody.querySelectorAll(".cell").forEach(cell => {
    cell.addEventListener("click", onCellClick);
  });
}

// ---------- UI: fecha ----------
function renderDate() {
  const { weekday, full } = fmtFullDate(currentDate);
  els.dateWeekday.textContent = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  els.dateFull.textContent = full;
  els.datePicker.value = currentDate;
}

// ---------- Click en celda ----------
function onCellClick(e) {
  const cell = e.currentTarget;
  const roomId = cell.dataset.room;
  const slotKey = cell.dataset.slot;
  const slot = SLOTS.find(s => s.key === slotKey);
  const room = ROOMS.find(r => r.id === roomId);
  const dayData = reservations[currentDate] || {};
  const key = `${roomId}_${slotKey}`;
  const rsv = dayData[key];

  if (!currentUser) {
    toast("Selecciona tu nombre primero", "error");
    els.userSelect.focus();
    return;
  }

  if (isPastSlot(currentDate, slot) && !rsv) {
    toast("Ese horario ya pasó", "error");
    return;
  }

  if (rsv && rsv.user === currentUser) {
    // cancelar
    openModal({
      title: "Cancelar reserva",
      text: "¿Quieres liberar este bloque?",
      meta: metaRows(room, slot),
      confirmText: "Liberar",
      danger: true,
      action: () => removeReservation(currentDate, key)
    });
  } else if (rsv) {
    toast(`Reservada por ${rsv.user}`, "error");
  } else {
    openModal({
      title: "Confirmar reserva",
      text: "Vas a reservar este bloque.",
      meta: metaRows(room, slot),
      confirmText: "Reservar",
      action: () => addReservation(currentDate, key, currentUser)
    });
  }
}

function metaRows(room, slot) {
  const { weekday, full } = fmtFullDate(currentDate);
  return [
    ["Sala", room.name],
    ["Fecha", `${weekday} ${full}`],
    ["Bloque", `${slot.label} – ${slotEndLabel(slot)}`]
  ];
}

// ---------- Modal ----------
let pendingAction = null;
function openModal({ title, text, meta, confirmText, action, danger }) {
  els.modalTitle.textContent = title;
  els.modalText.textContent = text;
  els.modalMeta.innerHTML = meta.map(([k,v]) =>
    `<div class="meta-row"><span class="meta-key">${k}</span><span class="meta-val">${escapeHtml(v)}</span></div>`
  ).join("");
  els.modalConfirm.textContent = confirmText;
  els.modal.querySelector(".modal-card").classList.toggle("delete", !!danger);
  els.modal.hidden = false;
  pendingAction = action;
  els.modalConfirm.focus();
}
function closeModal() {
  els.modal.hidden = true;
  pendingAction = null;
}
els.modalCancel.addEventListener("click", closeModal);
els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });
els.modalConfirm.addEventListener("click", () => {
  if (pendingAction) pendingAction();
  closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(); closeDrawer(); }
});

// ---------- CRUD reservas ----------
function addReservation(dateISO, key, user) {
  // Comprobación local anti-colisión
  const existing = (reservations[dateISO] || {})[key];
  if (existing) { toast("Ya está ocupada (otra persona la reservó)", "error"); return; }

  const data = { user, ts: Date.now() };
  if (FIREBASE_OK && db) {
    setFn(dbRef(`reservations/${dateISO}/${key}`), data)
      .then(() => toast("Reservado", "success"))
      .catch(err => { console.error(err); toast("Error al reservar", "error"); });
  } else {
    reservations[dateISO] = reservations[dateISO] || {};
    reservations[dateISO][key] = data;
    saveLocal();
    renderGrid();
    updateMyCount();
    toast("Reservado", "success");
  }
}
function removeReservation(dateISO, key) {
  if (FIREBASE_OK && db) {
    removeFn(dbRef(`reservations/${dateISO}/${key}`))
      .then(() => toast("Liberado", "success"))
      .catch(err => { console.error(err); toast("Error al liberar", "error"); });
  } else {
    if (reservations[dateISO]) {
      delete reservations[dateISO][key];
      saveLocal();
    }
    renderGrid();
    updateMyCount();
    renderDrawer(); // por si está abierto
    toast("Liberado", "success");
  }
}

// ---------- Persistencia local (modo fallback) ----------
function saveLocal() {
  localStorage.setItem("lab_reservas_data", JSON.stringify(reservations));
}
function loadLocal() {
  try {
    reservations = JSON.parse(localStorage.getItem("lab_reservas_data") || "{}");
  } catch { reservations = {}; }
}

// ---------- Sincronización Firebase ----------
function startSync() {
  if (FIREBASE_OK && db) {
    setConn("conectando…", "");
    onValueFn(dbRef("reservations"), (snap) => {
      reservations = snap.val() || {};
      renderGrid();
      updateMyCount();
      if (els.drawer.hidden === false) renderDrawer();
      setConn("en línea", "online");
    }, (err) => {
      console.error(err);
      setConn("sin conexión", "offline");
    });
  } else {
    loadLocal();
    setConn("modo local", "offline");
  }
}
function setConn(text, state) {
  els.connText.textContent = text;
  els.connState.classList.remove("online","offline");
  if (state) els.connState.classList.add(state);
}

// ---------- "Mis reservas" ----------
function getMyReservations() {
  const out = [];
  for (const date of Object.keys(reservations)) {
    for (const key of Object.keys(reservations[date])) {
      const r = reservations[date][key];
      if (r && r.user === currentUser) {
        const [roomId, slotKey] = key.split("_");
        const room = ROOMS.find(x => x.id === roomId);
        const slot = SLOTS.find(s => s.key === slotKey);
        if (!room || !slot) continue;
        out.push({ date, key, room, slot });
      }
    }
  }
  // ordenar por fecha + hora
  out.sort((a,b) => (a.date+a.slot.key).localeCompare(b.date+b.slot.key));
  return out;
}
function updateMyCount() {
  if (!currentUser) { els.myCount.textContent = "0"; return; }
  // Solo cuento reservas vigentes (hoy o futuras)
  const today = todayISO();
  const list = getMyReservations().filter(r => r.date >= today);
  els.myCount.textContent = list.length;
}

function openDrawer() {
  if (!currentUser) { toast("Selecciona tu nombre primero", "error"); return; }
  els.drawer.hidden = false;
  els.drawerBackdrop.hidden = false;
  renderDrawer();
}
function closeDrawer() {
  els.drawer.hidden = true;
  els.drawerBackdrop.hidden = true;
}
els.myBtn.addEventListener("click", openDrawer);
els.drawerClose.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);

function renderDrawer() {
  const all = getMyReservations();
  const today = todayISO();
  const upcoming = all.filter(r => r.date >= today);
  const past = all.filter(r => r.date < today);

  if (all.length === 0) {
    els.drawerBody.innerHTML = `
      <div class="res-empty">
        <div class="empty-mark">∅</div>
        <div>Aún no has reservado nada.</div>
        <div style="margin-top:6px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-mute)">Toca un bloque libre para empezar</div>
      </div>`;
    return;
  }

  const groupByDate = (list) => {
    const m = new Map();
    for (const r of list) {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date).push(r);
    }
    return m;
  };

  const renderGroup = (title, list, allowDelete=true) => {
    if (list.length === 0) return "";
    const grouped = groupByDate(list);
    let html = `<div class="res-group">
      <div class="res-group-head"><span>${title}</span><span class="group-count">${list.length}</span></div>`;
    for (const [date, items] of grouped) {
      const { weekday, full } = fmtFullDate(date);
      html += `<div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-mute);margin:10px 0 6px;">${weekday} · ${full}</div>`;
      for (const r of items) {
        html += `<div class="res-item">
          <div class="res-item-left">
            <span class="res-room">${escapeHtml(r.room.name)}</span>
            <span class="res-time">${r.slot.label} – ${slotEndLabel(r.slot)}</span>
          </div>
          ${allowDelete ? `<button class="res-del-btn" data-date="${r.date}" data-key="${r.key}">Liberar</button>` : ""}
        </div>`;
      }
    }
    html += `</div>`;
    return html;
  };

  els.drawerBody.innerHTML =
    renderGroup("Próximas", upcoming, true) +
    renderGroup("Pasadas", past, false);

  els.drawerBody.querySelectorAll(".res-del-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.date, k = btn.dataset.key;
      const [roomId, slotKey] = k.split("_");
      const room = ROOMS.find(r => r.id === roomId);
      const slot = SLOTS.find(s => s.key === slotKey);
      const { weekday, full } = fmtFullDate(d);
      // Reusar modal con confirmación
      els.modalTitle.textContent = "Liberar reserva";
      els.modalText.textContent = "¿Confirmas que quieres liberar este bloque?";
      els.modalMeta.innerHTML = [
        ["Sala", room.name],
        ["Fecha", `${weekday} ${full}`],
        ["Bloque", `${slot.label} – ${slotEndLabel(slot)}`]
      ].map(([key,val]) => `<div class="meta-row"><span class="meta-key">${key}</span><span class="meta-val">${escapeHtml(val)}</span></div>`).join("");
      els.modalConfirm.textContent = "Liberar";
      els.modal.querySelector(".modal-card").classList.add("delete");
      els.modal.hidden = false;
      pendingAction = () => removeReservation(d, k);
      els.modalConfirm.focus();
    });
  });
}

// ---------- Toast ----------
let toastTimer = null;
function toast(msg, type) {
  els.toast.textContent = msg;
  els.toast.className = "toast" + (type ? ` ${type}` : "");
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2200);
}

// ---------- escape ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// ---------- Eventos de fecha ----------
els.prevDay.addEventListener("click", () => { currentDate = shiftDay(currentDate, -1); renderDate(); renderGrid(); });
els.nextDay.addEventListener("click", () => { currentDate = shiftDay(currentDate, +1); renderDate(); renderGrid(); });
els.todayBtn.addEventListener("click", () => { currentDate = todayISO(); renderDate(); renderGrid(); });
els.datePicker.addEventListener("change", (e) => {
  if (e.target.value) { currentDate = e.target.value; renderDate(); renderGrid(); }
});

// Selector de usuario
els.userSelect.addEventListener("change", (e) => setUser(e.target.value));

// Atajos de teclado: ← →
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea")) return;
  if (e.key === "ArrowLeft") els.prevDay.click();
  if (e.key === "ArrowRight") els.nextDay.click();
});

// ---------- Init ----------
renderHeader();
renderUserOptions();
renderDate();
renderGrid();
startSync();
