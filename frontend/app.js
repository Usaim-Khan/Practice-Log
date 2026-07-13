const API = 'http://127.0.0.1:8000';

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  topics: [],
  problems: [],
  attempts: [],
  currentView: 'dashboard',
  modal: { type: null, mode: null, id: null },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  checkDB();
  loadAll();
});

async function loadAll() {
  await Promise.all([loadTopics(), loadProblems(), loadAttempts()]);
  renderDashboard();
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function checkDB() {
  const el = document.getElementById('db-status');
  try {
    await api('GET', '/health/db');
    el.className = 'db-status ok';
    el.innerHTML = '<span class="status-dot"></span><span class="status-text">DB Connected</span>';
  } catch {
    el.className = 'db-status error';
    el.innerHTML = '<span class="status-dot"></span><span class="status-text">DB Error</span>';
  }
}

// ─── Data loaders ─────────────────────────────────────────────────────────────
async function loadTopics() {
  try {
    state.topics = await api('GET', '/topics');
    updateBadge('topics-count', state.topics.length);
  } catch { state.topics = []; }
}
async function loadProblems() {
  try {
    state.problems = await api('GET', '/problems');
    updateBadge('problems-count', state.problems.length);
  } catch { state.problems = []; }
}
async function loadAttempts() {
  try {
    state.attempts = await api('GET', '/attempts');
    updateBadge('attempts-count', state.attempts.length);
  } catch { state.attempts = []; }
}

function updateBadge(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function showView(view) {
  state.currentView = view;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById(`nav-${view}`).classList.add('active');

  const titles = { dashboard: 'Dashboard', topics: 'Topics', problems: 'Problems', attempts: 'Attempts' };
  document.getElementById('topbar-title').textContent = titles[view];

  const actionBtn = document.getElementById('topbar-action-btn');
  const actionLabel = document.getElementById('topbar-action-label');
  if (view === 'dashboard') {
    actionBtn.style.display = 'none';
  } else {
    actionBtn.style.display = 'inline-flex';
    actionLabel.textContent = { topics: 'Add Topic', problems: 'Add Problem', attempts: 'Log Attempt' }[view];
  }

  if (view === 'topics') renderTopics();
  if (view === 'problems') renderProblems();
  if (view === 'attempts') renderAttempts();
  if (view === 'dashboard') renderDashboard();

  // close sidebar on mobile
  if (window.innerWidth < 680) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  document.getElementById('dash-topics-count').textContent = state.topics.length;
  document.getElementById('dash-problems-count').textContent = state.problems.length;
  document.getElementById('dash-attempts-count').textContent = state.attempts.length;
  const completed = state.attempts.filter(a => a.status === 'completed').length;
  document.getElementById('dash-completed-count').textContent = completed;

  const list = document.getElementById('recent-attempts-list');
  const recent = [...state.attempts].reverse().slice(0, 6);
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No attempts yet. Start by adding a topic!</p></div>`;
    return;
  }
  list.innerHTML = recent.map(a => {
    const prob = state.problems.find(p => p.id === a.problem_id);
    const topic = prob ? state.topics.find(t => t.id === prob.topic_id) : null;
    const date = new Date(a.attempted_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    return `
      <div class="recent-item">
        <div class="recent-item-info">
          <div class="recent-item-name">${prob ? esc(prob.name) : 'Unknown Problem'}</div>
          <div class="recent-item-meta">${topic ? esc(topic.name) : ''} &middot; ${date}</div>
        </div>
        ${badgeHtml(a.status)}
      </div>`;
  }).join('');
}

// ─── Topics ───────────────────────────────────────────────────────────────────
function renderTopics(filter = '') {
  const list = document.getElementById('topics-list');
  const items = state.topics.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>${filter ? 'No topics match your search.' : 'No topics yet. Click "Add Topic" to create one.'}</p></div>`;
    return;
  }

  list.innerHTML = items.map(t => {
    const probCount = state.problems.filter(p => p.topic_id === t.id).length;
    return `
      <div class="card" id="topic-card-${t.id}">
        <div class="card-title">${esc(t.name)}</div>
        <div class="card-meta">${probCount} problem${probCount !== 1 ? 's' : ''}</div>
        <div class="card-actions">
          <button class="btn-icon view" title="View problems" onclick="viewTopicProblems(${t.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="btn-icon edit" title="Edit topic" onclick="openEditTopic(${t.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon delete" title="Delete topic" onclick="confirmDelete('topic', ${t.id}, '${esc(t.name)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function filterTopics() {
  renderTopics(document.getElementById('topics-search').value);
}

function viewTopicProblems(topicId) {
  document.getElementById('problems-topic-filter').value = topicId;
  showView('problems');
}

// ─── Problems ─────────────────────────────────────────────────────────────────
function renderProblems() {
  // Populate topic filter
  const sel = document.getElementById('problems-topic-filter');
  const current = sel.value;
  sel.innerHTML = `<option value="">All Topics</option>` +
    state.topics.map(t => `<option value="${t.id}" ${String(t.id) === current ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

  filterProblems();
}

function filterProblems() {
  const search = document.getElementById('problems-search').value.toLowerCase();
  const topicId = document.getElementById('problems-topic-filter').value;
  const list = document.getElementById('problems-list');

  const items = state.problems.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search);
    const matchTopic = !topicId || String(p.topic_id) === topicId;
    return matchSearch && matchTopic;
  });

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🧩</div><p>No problems found.</p></div>`;
    return;
  }

  list.innerHTML = items.map(p => {
    const topic = state.topics.find(t => t.id === p.topic_id);
    const attCount = state.attempts.filter(a => a.problem_id === p.id).length;
    const lastAtt = state.attempts.filter(a => a.problem_id === p.id).at(-1);
    return `
      <div class="card" id="problem-card-${p.id}">
        <div class="card-title">${esc(p.name)}</div>
        <div class="card-meta">📚 ${topic ? esc(topic.name) : 'Unknown'} &middot; ${attCount} attempt${attCount !== 1 ? 's' : ''}</div>
        ${lastAtt ? badgeHtml(lastAtt.status) : ''}
        <div class="card-actions">
          <button class="btn-icon view" title="View attempts" onclick="viewProblemAttempts(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="btn-icon edit" title="Edit problem" onclick="openEditProblem(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon delete" title="Delete problem" onclick="confirmDelete('problem', ${p.id}, '${esc(p.name)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function viewProblemAttempts(probId) {
  document.getElementById('attempts-search').value = '';
  document.getElementById('attempts-status-filter').value = '';
  showView('attempts');
  // highlight that problem - filter by searching problem name
  const prob = state.problems.find(p => p.id === probId);
  if (prob) document.getElementById('attempts-search').value = prob.name;
  filterAttempts();
}

// ─── Attempts ─────────────────────────────────────────────────────────────────
function renderAttempts() { filterAttempts(); }

function filterAttempts() {
  const search = document.getElementById('attempts-search').value.toLowerCase();
  const statusFilter = document.getElementById('attempts-status-filter').value;
  const tbody = document.getElementById('attempts-tbody');

  const items = state.attempts.filter(a => {
    const prob = state.problems.find(p => p.id === a.problem_id);
    const matchSearch = !search || (prob && prob.name.toLowerCase().includes(search)) || (a.notes && a.notes.toLowerCase().includes(search));
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No attempts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...items].reverse().map(a => {
    const prob = state.problems.find(p => p.id === a.problem_id);
    const topic = prob ? state.topics.find(t => t.id === prob.topic_id) : null;
    const date = new Date(a.attempted_at).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `
      <tr>
        <td style="font-weight:600">${prob ? esc(prob.name) : '#' + a.problem_id}</td>
        <td><span style="color:var(--text2)">${topic ? esc(topic.name) : '—'}</span></td>
        <td>${badgeHtml(a.status)}</td>
        <td class="notes-cell" title="${esc(a.notes || '')}">${a.notes ? esc(a.notes) : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="color:var(--text2);white-space:nowrap">${date}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn-icon edit" title="Edit attempt" onclick="openEditAttempt(${a.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon delete" title="Delete attempt" onclick="confirmDelete('attempt', ${a.id}, 'this attempt')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal').classList.add('open');
  setTimeout(() => {
    const first = document.querySelector('#modal-body input, #modal-body select, #modal-body textarea');
    if (first) first.focus();
  }, 50);
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal').classList.remove('open');
  state.modal = { type: null, mode: null, id: null };
}

// ─── Create/Edit – Topics ─────────────────────────────────────────────────────
function openCreateModal() {
  const v = state.currentView;
  if (v === 'topics') openCreateTopic();
  else if (v === 'problems') openCreateProblem();
  else if (v === 'attempts') openCreateAttempt();
}

function openCreateTopic() {
  state.modal = { type: 'topic', mode: 'create' };
  openModal('Add New Topic', `
    <div class="form-group">
      <label for="topic-name-input">Topic Name</label>
      <input id="topic-name-input" class="form-control" type="text" placeholder="e.g. Dynamic Programming" maxlength="100"/>
    </div>`);
}
function openEditTopic(id) {
  const t = state.topics.find(x => x.id === id);
  if (!t) return;
  state.modal = { type: 'topic', mode: 'edit', id };
  openModal('Edit Topic', `
    <div class="form-group">
      <label for="topic-name-input">Topic Name</label>
      <input id="topic-name-input" class="form-control" type="text" value="${esc(t.name)}" maxlength="100"/>
    </div>`);
}

// ─── Create/Edit – Problems ───────────────────────────────────────────────────
function openCreateProblem() {
  state.modal = { type: 'problem', mode: 'create' };
  openModal('Add New Problem', `
    <div class="form-group">
      <label for="prob-name-input">Problem Name</label>
      <input id="prob-name-input" class="form-control" type="text" placeholder="e.g. Two Sum" maxlength="100"/>
    </div>
    <div class="form-group">
      <label for="prob-topic-input">Topic</label>
      <select id="prob-topic-input" class="form-control">
        <option value="">— Select a topic —</option>
        ${state.topics.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
      </select>
    </div>`);
}
function openEditProblem(id) {
  const p = state.problems.find(x => x.id === id);
  if (!p) return;
  state.modal = { type: 'problem', mode: 'edit', id };
  openModal('Edit Problem', `
    <div class="form-group">
      <label for="prob-name-input">Problem Name</label>
      <input id="prob-name-input" class="form-control" type="text" value="${esc(p.name)}" maxlength="100"/>
    </div>
    <div class="form-group">
      <label for="prob-topic-input">Topic</label>
      <select id="prob-topic-input" class="form-control">
        <option value="">— Select a topic —</option>
        ${state.topics.map(t => `<option value="${t.id}" ${t.id === p.topic_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
    </div>`);
}

// ─── Create/Edit – Attempts ───────────────────────────────────────────────────
function openCreateAttempt() {
  state.modal = { type: 'attempt', mode: 'create' };
  openModal('Log Attempt', attemptFormHtml());
}
function openEditAttempt(id) {
  const a = state.attempts.find(x => x.id === id);
  if (!a) return;
  state.modal = { type: 'attempt', mode: 'edit', id };
  openModal('Edit Attempt', attemptFormHtml(a));
}
function attemptFormHtml(a = null) {
  return `
    <div class="form-group">
      <label for="att-problem-input">Problem</label>
      <select id="att-problem-input" class="form-control">
        <option value="">— Select a problem —</option>
        ${state.problems.map(p => {
          const topic = state.topics.find(t => t.id === p.topic_id);
          return `<option value="${p.id}" ${a && a.problem_id === p.id ? 'selected' : ''}>${esc(p.name)}${topic ? ' (' + esc(topic.name) + ')' : ''}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="att-status-input">Status</label>
      <select id="att-status-input" class="form-control">
        <option value="completed" ${a && a.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
        <option value="attempted" ${a && a.status === 'attempted' ? 'selected' : ''}>🔄 Attempted</option>
        <option value="failed" ${a && a.status === 'failed' ? 'selected' : ''}>❌ Failed</option>
      </select>
    </div>
    <div class="form-group">
      <label for="att-notes-input">Notes (optional)</label>
      <textarea id="att-notes-input" class="form-control" placeholder="What did you learn? Any key insights...">${a && a.notes ? esc(a.notes) : ''}</textarea>
    </div>`;
}

// ─── Modal Submit ─────────────────────────────────────────────────────────────
async function handleModalSubmit() {
  const { type, mode, id } = state.modal;
  const btn = document.getElementById('modal-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (type === 'topic') {
      const name = document.getElementById('topic-name-input').value.trim();
      if (name.length < 3) { showToast('Topic name must be at least 3 characters.', 'error'); return; }
      if (mode === 'create') await api('POST', '/topics', { name });
      else await api('PUT', `/topics/${id}`, { name });
      await loadTopics();
      if (state.currentView === 'topics') renderTopics();

    } else if (type === 'problem') {
      const name = document.getElementById('prob-name-input').value.trim();
      const topic_id = parseInt(document.getElementById('prob-topic-input').value);
      if (name.length < 3) { showToast('Problem name must be at least 3 characters.', 'error'); return; }
      if (!topic_id) { showToast('Please select a topic.', 'error'); return; }
      if (mode === 'create') await api('POST', '/problems', { name, topic_id });
      else await api('PUT', `/problems/${id}`, { name, topic_id });
      await loadProblems();
      if (state.currentView === 'problems') renderProblems();

    } else if (type === 'attempt') {
      const problem_id = parseInt(document.getElementById('att-problem-input').value);
      const status = document.getElementById('att-status-input').value;
      const notes = document.getElementById('att-notes-input').value.trim() || null;
      if (!problem_id) { showToast('Please select a problem.', 'error'); return; }
      if (mode === 'create') await api('POST', '/attempts', { problem_id, status, notes });
      else await api('PUT', `/attempts/${id}`, { problem_id, status, notes });
      await loadAttempts();
      if (state.currentView === 'attempts') renderAttempts();
    }

    closeModal();
    renderDashboard();
    showToast(mode === 'create' ? 'Created successfully!' : 'Updated successfully!', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function confirmDelete(type, id, name) {
  const messages = { topic: `Delete topic "${name}"? This will fail if it has problems.`, problem: `Delete problem "${name}"? This will fail if it has attempts.`, attempt: `Delete ${name}?` };
  document.getElementById('confirm-message').textContent = messages[type] || 'Are you sure?';
  document.getElementById('confirm-overlay').classList.add('open');
  document.getElementById('confirm-modal').classList.add('open');

  document.getElementById('confirm-ok-btn').onclick = () => doDelete(type, id);
}
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  document.getElementById('confirm-modal').classList.remove('open');
}
async function doDelete(type, id) {
  closeConfirm();
  try {
    await api('DELETE', `/${type}s/${id}`);
    if (type === 'topic') { await loadTopics(); if (state.currentView === 'topics') renderTopics(); }
    else if (type === 'problem') { await loadProblems(); if (state.currentView === 'problems') renderProblems(); }
    else { await loadAttempts(); if (state.currentView === 'attempts') renderAttempts(); }
    renderDashboard();
    showToast('Deleted successfully.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${esc(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function badgeHtml(status) {
  const labels = { completed: '✅ Completed', attempted: '🔄 Attempted', failed: '❌ Failed' };
  return `<span class="badge ${status}">${labels[status] || status}</span>`;
}
