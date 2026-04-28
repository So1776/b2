// internshiptracker.js
// All internship tracker frontend logic — connects to /api/tracker backend

const API_BASE = "/api/tracker";

// ── Auth helper ──────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("token") || "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`
  };
}

// ── State ────────────────────────────────────────────────────────────────────
let internships  = [];   // full list from server
let editingId    = null; // null = add mode, number = edit mode
let activeFilter = "all";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const tableBody     = document.getElementById("tableBody");
const emptyState    = document.getElementById("emptyState");
const filterInput   = document.getElementById("filterInput");
const modalOverlay  = document.getElementById("modalOverlay");
const modalTitle    = document.getElementById("modalTitle");
const modalClose    = document.getElementById("modalClose");
const cancelBtn     = document.getElementById("cancelBtn");
const saveBtn       = document.getElementById("saveBtn");
const addBtn        = document.getElementById("addBtn");
const fCompany      = document.getElementById("fCompany");
const fRole         = document.getElementById("fRole");
const fLocation     = document.getElementById("fLocation");
const fDate         = document.getElementById("fDate");
const fStatus       = document.getElementById("fStatus");
const fNotes        = document.getElementById("fNotes");
const errCompany    = document.getElementById("errCompany");
const errRole       = document.getElementById("errRole");
const errDate       = document.getElementById("errDate");

// ── API calls ────────────────────────────────────────────────────────────────

async function fetchInternships() {
  try {
    const res = await fetch(API_BASE, { headers: authHeaders() });
    if (res.status === 401) { redirectToLogin(); return; }
    if (!res.ok) throw new Error("Failed to load internships");
    internships = await res.json();
    renderAll();
  } catch (err) {
    console.error(err);
    showToast("Could not load internships. Please refresh.", "error");
  }
}

async function createInternship(data) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  if (res.status === 401) { redirectToLogin(); return; }
  if (!res.ok) throw new Error("Failed to save internship");
  return res.json();
}

async function updateInternship(id, data) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  if (res.status === 401) { redirectToLogin(); return; }
  if (!res.ok) throw new Error("Failed to update internship");
  return res.json();
}

async function deleteInternship(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (res.status === 401) { redirectToLogin(); return; }
  if (!res.ok) throw new Error("Failed to delete internship");
  return res.json();
}

// ── Render ───────────────────────────────────────────────────────────────────

function getFiltered() {
  const query = filterInput.value.trim().toLowerCase();
  return internships.filter(item => {
    const matchesStatus = activeFilter === "all" || item.status === activeFilter;
    const matchesSearch = !query ||
      item.company.toLowerCase().includes(query) ||
      item.role.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
}

function renderAll() {
  updateStats();
  renderTable();
}

function renderTable() {
  const rows = getFiltered();
  tableBody.innerHTML = "";

  if (rows.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  rows.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.innerHTML = `
      <td data-label="Company"><strong>${escHtml(item.company)}</strong></td>
      <td data-label="Role">${escHtml(item.role)}</td>
      <td data-label="Location">${escHtml(item.location || "—")}</td>
      <td data-label="Date Applied">${formatDate(item.date_applied)}</td>
      <td data-label="Status">
        <span class="status-badge status-${item.status.toLowerCase()}">${escHtml(item.status)}</span>
      </td>
      <td data-label="Actions" class="actions-col">
        <button class="action-btn edit-btn" data-id="${item.id}" title="Edit">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="action-btn delete-btn" data-id="${item.id}" title="Delete">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Attach row-level listeners
  tableBody.querySelectorAll(".edit-btn").forEach(btn =>
    btn.addEventListener("click", () => openEditModal(Number(btn.dataset.id)))
  );
  tableBody.querySelectorAll(".delete-btn").forEach(btn =>
    btn.addEventListener("click", () => handleDelete(Number(btn.dataset.id)))
  );
}

function updateStats() {
  document.querySelector("#statTotal .stat-num").textContent = internships.length;
  document.getElementById("countApplied").textContent   = internships.filter(i => i.status === "Applied").length;
  document.getElementById("countInterview").textContent = internships.filter(i => i.status === "Interview").length;
  document.getElementById("countOffer").textContent     = internships.filter(i => i.status === "Offer").length;
  document.getElementById("countRejected").textContent  = internships.filter(i => i.status === "Rejected").length;
}

// ── Delete handler ────────────────────────────────────────────────────────────

async function handleDelete(id) {
  const item = internships.find(i => i.id === id);
  if (!item) return;

  const confirmed = confirm(`Remove "${item.company} – ${item.role}" from your tracker? This cannot be undone.`);
  if (!confirmed) return;

  // Optimistic UI: remove row immediately
  const btn = tableBody.querySelector(`.delete-btn[data-id="${id}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  try {
    await deleteInternship(id);
    internships = internships.filter(i => i.id !== id);
    renderAll();
    showToast(`Removed "${item.company}" successfully.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Could not delete the internship. Please try again.", "error");
    // Re-render to restore the row
    renderAll();
  }
}

// ── Modal: open / close / save ────────────────────────────────────────────────

function openAddModal() {
  editingId = null;
  modalTitle.textContent = "Add Internship";
  clearForm();
  fDate.value = new Date().toISOString().split("T")[0]; // default to today
  openModal();
}

function openEditModal(id) {
  const item = internships.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  modalTitle.textContent = "Edit Internship";
  fCompany.value  = item.company      || "";
  fRole.value     = item.role         || "";
  fLocation.value = item.location     || "";
  fDate.value     = item.date_applied || "";
  fStatus.value   = item.status       || "Applied";
  fNotes.value    = item.notes        || "";
  clearErrors();
  openModal();
}

function openModal() {
  modalOverlay.classList.add("active");
  fCompany.focus();
}

function closeModal() {
  modalOverlay.classList.remove("active");
  clearForm();
  editingId = null;
}

function clearForm() {
  fCompany.value = fRole.value = fLocation.value = fDate.value = fNotes.value = "";
  fStatus.value = "Applied";
  clearErrors();
}

function clearErrors() {
  errCompany.textContent = errRole.textContent = errDate.textContent = "";
  fCompany.classList.remove("input-error");
  fRole.classList.remove("input-error");
  fDate.classList.remove("input-error");
}

function validateForm() {
  let valid = true;
  clearErrors();
  if (!fCompany.value.trim()) {
    errCompany.textContent = "Company is required.";
    fCompany.classList.add("input-error");
    valid = false;
  }
  if (!fRole.value.trim()) {
    errRole.textContent = "Role is required.";
    fRole.classList.add("input-error");
    valid = false;
  }
  if (!fDate.value) {
    errDate.textContent = "Date applied is required.";
    fDate.classList.add("input-error");
    valid = false;
  }
  return valid;
}

async function handleSave() {
  if (!validateForm()) return;

  const data = {
    company:      fCompany.value.trim(),
    role:         fRole.value.trim(),
    location:     fLocation.value.trim(),
    date_applied: fDate.value,
    status:       fStatus.value,
    notes:        fNotes.value.trim()
  };

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    if (editingId === null) {
      const created = await createInternship(data);
      internships.unshift(created);
      showToast(`Added "${data.company}" to your tracker.`, "success");
    } else {
      const updated = await updateInternship(editingId, data);
      const idx = internships.findIndex(i => i.id === editingId);
      if (idx !== -1) internships[idx] = updated;
      showToast(`Updated "${data.company}" successfully.`, "success");
    }
    closeModal();
    renderAll();
  } catch (err) {
    console.error(err);
    showToast("Could not save. Please try again.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function redirectToLogin() {
  window.location.href = "/login";
}

// ── Event listeners ──────────────────────────────────────────────────────────

addBtn.addEventListener("click", openAddModal);
modalClose.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
saveBtn.addEventListener("click", handleSave);

// Close modal on overlay click
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("active")) closeModal();
});

// Filter pills
document.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    activeFilter = pill.dataset.status;
    renderTable();
  });
});

// Search input
filterInput.addEventListener("input", renderTable);

// ── Init ─────────────────────────────────────────────────────────────────────

fetchInternships();