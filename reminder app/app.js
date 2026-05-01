/* ================================================================
   PLANNER — Calendar & CRM Application Logic
   ================================================================ */

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────
    const STORAGE_KEY = 'planner_app_data';
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MARKER_LABELS = {
        red: 'Important Work',
        blue: 'Meeting',
        yellow: 'Important Info',
        green: 'Personal',
        purple: 'Follow-up'
    };

    // ── State ──────────────────────────────────────────────
    let state = {
        currentView: 'calendar',
        calendarYear: 2026,
        calendarMonth: 0, // 0-indexed
        selectedDate: null,
        goalsYear: 2026,
        crmView: 'clients',
        data: {
            tasks: {},      // { "2026-01-15": [ { id, text, marker, done } ] }
            goals: {},      // { "2026-01": [ { id, text, done } ] }
            clients: [],    // [ { id, name, email, phone, company, notes } ]
            meetings: [],   // [ { id, clientId, date, time, notes } ]
            businessLogs: [], // [ { id, date, entry } ]
            coldDms: new Array(100).fill(false) // 100 checkboxes
        }
    };

    // ── DOM References ──────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        calendarGrid: $('#calendar-grid'),
        calendarTitle: $('#calendar-month-title'),
        monthPicker: $('#month-picker'),
        dayDetailPanel: $('#day-detail-panel'),
        dayDetailTitle: $('#day-detail-title'),
        taskList: $('#task-list'),
        btnAddTask: $('#btn-add-task'),
        btnPrevMonth: $('#btn-prev-month'),
        btnNextMonth: $('#btn-next-month'),
        btnToday: $('#btn-today'),
        goalsContainer: $('#goals-container'),
        clientList: $('#client-list'),
        meetingList: $('#meeting-list'),
        logList: $('#log-list'),
        modalOverlay: $('#modal-overlay'),
        modal: $('#modal'),
        modalTitle: $('#modal-title'),
        modalBody: $('#modal-body'),
        modalClose: $('#modal-close'),
        toast: $('#toast'),
        toastMessage: $('#toast-message'),
        btnSave: $('#btn-save'),
        btnExport: $('#btn-export'),
        btnImport: $('#btn-import'),
        importFileInput: $('#import-file-input'),
        btnAddClient: $('#btn-add-client'),
        btnAddMeeting: $('#btn-add-meeting'),
        btnAddLog: $('#btn-add-log'),
        coldDmGrid: $('#colddm-grid'),
        dmCheckedCount: $('#dm-checked-count'),
        dmRemainingCount: $('#dm-remaining-count'),
        dmPercent: $('#dm-percent'),
        dmProgressFill: $('#dm-progress-fill'),
        btnResetDms: $('#btn-reset-dms'),
    };

    // ── Utilities ──────────────────────────────────────────────
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    function dateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function monthKey(year, month) {
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    }

    function formatDateNice(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${MONTHS[m - 1]} ${d}, ${y}`;
    }

    function daysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function firstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    function getTodayKey() {
        const now = new Date();
        return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function isToday(year, month, day) {
        const now = new Date();
        return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
    }

    // ── Storage ──────────────────────────────────────────────
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                state.data = {
                    tasks: parsed.tasks || {},
                    goals: parsed.goals || {},
                    clients: parsed.clients || [],
                    meetings: parsed.meetings || [],
                    businessLogs: parsed.businessLogs || [],
                    coldDms: parsed.coldDms || new Array(100).fill(false)
                };
            }
        } catch (e) {
            console.warn('Failed to load data from localStorage', e);
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
        } catch (e) {
            console.error('Failed to save data', e);
        }
    }

    function exportData() {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planner-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully!');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                state.data = {
                    tasks: parsed.tasks || {},
                    goals: parsed.goals || {},
                    clients: parsed.clients || [],
                    meetings: parsed.meetings || [],
                    businessLogs: parsed.businessLogs || [],
                    coldDms: parsed.coldDms || new Array(100).fill(false)
                };
                saveData();
                renderCurrentView();
                showToast('Data imported successfully!');
            } catch (err) {
                showToast('Invalid file format');
            }
        };
        reader.readAsText(file);
    }

    // ── Toast ──────────────────────────────────────────────
    let toastTimeout;
    function showToast(message) {
        dom.toastMessage.textContent = message;
        dom.toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2500);
    }

    // ── Modal ──────────────────────────────────────────────
    function openModal(title, bodyHTML) {
        dom.modalTitle.textContent = title;
        dom.modalBody.innerHTML = bodyHTML;
        dom.modalOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        // Focus first input
        setTimeout(() => {
            const firstInput = dom.modalBody.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    dom.modalClose.addEventListener('click', closeModal);
    dom.modalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dom.modalOverlay.classList.contains('open')) closeModal();
    });

    // ── View Switching ──────────────────────────────────────────────
    function switchView(viewName) {
        state.currentView = viewName;
        $$('.view').forEach(v => v.classList.remove('view-active'));
        $(`#view-${viewName}`).classList.add('view-active');
        $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
        $$('.mobile-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
        renderCurrentView();
    }

    function renderCurrentView() {
        switch (state.currentView) {
            case 'calendar': renderCalendar(); break;
            case 'goals': renderGoals(); break;
            case 'crm': renderCRM(); break;
            case 'colddm': renderColdDMs(); break;
        }
    }

    // Navigation bindings
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    $$('.mobile-nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    // ── Calendar ──────────────────────────────────────────────

    function renderCalendar() {
        renderMonthPicker();
        renderCalendarGrid();
        renderDayDetail();
        dom.calendarTitle.textContent = `${MONTHS[state.calendarMonth]} ${state.calendarYear}`;
    }

    // Year tabs
    $$('#view-calendar .year-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const yr = parseInt(tab.dataset.year);
            state.calendarYear = yr;
            $$('#view-calendar .year-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.year) === yr));
            renderCalendar();
        });
    });

    // Month Picker
    function renderMonthPicker() {
        dom.monthPicker.innerHTML = '';
        MONTHS_SHORT.forEach((m, i) => {
            const pill = document.createElement('button');
            pill.className = 'month-pill' + (i === state.calendarMonth ? ' active' : '');
            pill.textContent = m;

            // Check if month has any tasks
            const mk = monthKey(state.calendarYear, i);
            let hasTasks = false;
            const days = daysInMonth(state.calendarYear, i);
            for (let d = 1; d <= days; d++) {
                const dk = dateKey(state.calendarYear, i, d);
                if (state.data.tasks[dk] && state.data.tasks[dk].length > 0) {
                    hasTasks = true;
                    break;
                }
            }
            if (hasTasks) pill.classList.add('has-tasks');

            pill.addEventListener('click', () => {
                state.calendarMonth = i;
                renderCalendar();
            });
            dom.monthPicker.appendChild(pill);
        });
    }

    // Calendar Grid
    function renderCalendarGrid() {
        const year = state.calendarYear;
        const month = state.calendarMonth;
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);

        dom.calendarGrid.innerHTML = '';

        // Empty cells before
        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            dom.calendarGrid.appendChild(empty);
        }

        // Day cells
        for (let d = 1; d <= totalDays; d++) {
            const dayEl = document.createElement('button');
            dayEl.className = 'calendar-day';
            const dk = dateKey(year, month, d);

            if (isToday(year, month, d)) dayEl.classList.add('today');
            if (state.selectedDate === dk) dayEl.classList.add('selected');

            // Day number
            const numSpan = document.createElement('span');
            numSpan.className = 'day-number';
            numSpan.textContent = d;
            dayEl.appendChild(numSpan);

            // Marker dots
            const markers = document.createElement('div');
            markers.className = 'day-markers';
            const tasks = state.data.tasks[dk] || [];
            const uniqueMarkers = [...new Set(tasks.map(t => t.marker))];
            uniqueMarkers.slice(0, 4).forEach(m => {
                const dot = document.createElement('span');
                dot.className = `day-marker-dot marker-${m}`;
                markers.appendChild(dot);
            });
            dayEl.appendChild(markers);

            dayEl.addEventListener('click', () => {
                state.selectedDate = dk;
                renderCalendar();
            });

            dom.calendarGrid.appendChild(dayEl);
        }
    }

    // Nav buttons
    dom.btnPrevMonth.addEventListener('click', () => {
        state.calendarMonth--;
        if (state.calendarMonth < 0) {
            state.calendarMonth = 11;
            state.calendarYear--;
            if (state.calendarYear < 2026) { state.calendarYear = 2026; state.calendarMonth = 0; }
        }
        $$('#view-calendar .year-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.year) === state.calendarYear));
        renderCalendar();
    });

    dom.btnNextMonth.addEventListener('click', () => {
        state.calendarMonth++;
        if (state.calendarMonth > 11) {
            state.calendarMonth = 0;
            state.calendarYear++;
            if (state.calendarYear > 2027) { state.calendarYear = 2027; state.calendarMonth = 11; }
        }
        $$('#view-calendar .year-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.year) === state.calendarYear));
        renderCalendar();
    });

    dom.btnToday.addEventListener('click', () => {
        const now = new Date();
        const yr = now.getFullYear();
        // Clamp to 2026-2027
        if (yr >= 2026 && yr <= 2027) {
            state.calendarYear = yr;
            state.calendarMonth = now.getMonth();
            state.selectedDate = getTodayKey();
        } else if (yr < 2026) {
            state.calendarYear = 2026;
            state.calendarMonth = 0;
        } else {
            state.calendarYear = 2027;
            state.calendarMonth = 11;
        }
        $$('#view-calendar .year-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.year) === state.calendarYear));
        renderCalendar();
    });

    // ── Day Detail ──────────────────────────────────────────────
    function renderDayDetail() {
        if (!state.selectedDate) {
            dom.dayDetailTitle.textContent = 'Select a Day';
            dom.taskList.innerHTML = '<p class="empty-state">Click on a day to view or add tasks</p>';
            dom.btnAddTask.style.display = 'none';
            return;
        }

        dom.dayDetailTitle.textContent = formatDateNice(state.selectedDate);
        dom.btnAddTask.style.display = 'flex';

        const tasks = state.data.tasks[state.selectedDate] || [];
        if (tasks.length === 0) {
            dom.taskList.innerHTML = '<p class="empty-state">No tasks for this day. Click the + button to add one.</p>';
            return;
        }

        dom.taskList.innerHTML = '';
        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <span class="task-marker" style="background:var(--marker-${task.marker})"></span>
                <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} data-id="${task.id}">
                <span class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
                <div class="task-actions">
                    <button class="task-action-btn edit" data-id="${task.id}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="task-action-btn delete" data-id="${task.id}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
            dom.taskList.appendChild(item);
        });

        // Checkbox toggle
        dom.taskList.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.id;
                const task = (state.data.tasks[state.selectedDate] || []).find(t => t.id === id);
                if (task) {
                    task.done = cb.checked;
                    saveData();
                    renderDayDetail();
                }
            });
        });

        // Edit
        dom.taskList.querySelectorAll('.task-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const task = (state.data.tasks[state.selectedDate] || []).find(t => t.id === btn.dataset.id);
                if (task) openTaskModal(task);
            });
        });

        // Delete
        dom.taskList.querySelectorAll('.task-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                state.data.tasks[state.selectedDate] = (state.data.tasks[state.selectedDate] || []).filter(t => t.id !== id);
                if (state.data.tasks[state.selectedDate].length === 0) delete state.data.tasks[state.selectedDate];
                saveData();
                renderCalendar();
            });
        });
    }

    // ── Task Modal ──────────────────────────────────────────────
    dom.btnAddTask.addEventListener('click', () => openTaskModal(null));

    function openTaskModal(existingTask) {
        const isEdit = !!existingTask;
        const title = isEdit ? 'Edit Task' : 'Add Task';
        const html = `
            <form id="task-form">
                <div class="form-group">
                    <label for="task-text">Task Description</label>
                    <input type="text" class="form-input" id="task-text" placeholder="What needs to be done?" value="${isEdit ? escapeHtml(existingTask.text) : ''}" required>
                </div>
                <div class="form-group">
                    <label>Color Marker</label>
                    <div class="marker-selector" id="marker-selector">
                        ${Object.entries(MARKER_LABELS).map(([key, label]) => `
                            <button type="button" class="marker-option ${(isEdit && existingTask.marker === key) || (!isEdit && key === 'red') ? 'selected' : ''}" data-marker="${key}">
                                <span class="marker-dot-sm" style="background:var(--marker-${key})"></span>
                                ${label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <button type="submit" class="btn-submit">${isEdit ? 'Update Task' : 'Add Task'}</button>
            </form>
        `;
        openModal(title, html);

        // Marker selection
        let selectedMarker = isEdit ? existingTask.marker : 'red';
        dom.modalBody.querySelectorAll('.marker-option').forEach(opt => {
            opt.addEventListener('click', () => {
                dom.modalBody.querySelectorAll('.marker-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedMarker = opt.dataset.marker;
            });
        });

        // Submit
        dom.modalBody.querySelector('#task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = dom.modalBody.querySelector('#task-text').value.trim();
            if (!text) return;

            if (!state.data.tasks[state.selectedDate]) state.data.tasks[state.selectedDate] = [];

            if (isEdit) {
                const task = state.data.tasks[state.selectedDate].find(t => t.id === existingTask.id);
                if (task) {
                    task.text = text;
                    task.marker = selectedMarker;
                }
            } else {
                state.data.tasks[state.selectedDate].push({
                    id: uid(),
                    text,
                    marker: selectedMarker,
                    done: false
                });
            }

            saveData();
            closeModal();
            renderCalendar();
        });
    }

    // ── Monthly Goals ──────────────────────────────────────────────

    function renderGoals() {
        const year = state.goalsYear;
        dom.goalsContainer.innerHTML = '';

        // Update year tabs
        $('#goals-year-2026').classList.toggle('active', year === 2026);
        $('#goals-year-2027').classList.toggle('active', year === 2027);

        MONTHS.forEach((monthName, i) => {
            const mk = monthKey(year, i);
            const goals = state.data.goals[mk] || [];

            const card = document.createElement('div');
            card.className = 'goal-card';

            const totalGoals = goals.length;
            const doneGoals = goals.filter(g => g.done).length;
            const progress = totalGoals > 0 ? (doneGoals / totalGoals * 100) : 0;

            card.innerHTML = `
                <div class="goal-card-header">
                    <span class="goal-month-name">${monthName}</span>
                    <button class="goal-add-btn" data-month="${mk}" title="Add goal">+</button>
                </div>
                <div class="goal-list" id="goal-list-${mk}">
                    ${goals.length === 0 ? '<p class="goal-empty">No goals set</p>' :
                    goals.map(g => `
                            <div class="goal-item">
                                <input type="checkbox" class="task-checkbox" data-mk="${mk}" data-id="${g.id}" ${g.done ? 'checked' : ''}>
                                <span class="goal-text ${g.done ? 'done' : ''}">${escapeHtml(g.text)}</span>
                                <button class="goal-delete-btn" data-mk="${mk}" data-id="${g.id}" title="Delete">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        `).join('')
                }
                </div>
                ${totalGoals > 0 ? `
                    <div class="goal-progress">
                        <div class="goal-progress-bar" style="width:${progress}%"></div>
                    </div>
                ` : ''}
            `;

            dom.goalsContainer.appendChild(card);
        });

        // Bind add goal buttons
        dom.goalsContainer.querySelectorAll('.goal-add-btn').forEach(btn => {
            btn.addEventListener('click', () => openGoalModal(btn.dataset.month));
        });

        // Bind checkboxes
        dom.goalsContainer.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const mk = cb.dataset.mk;
                const id = cb.dataset.id;
                const goal = (state.data.goals[mk] || []).find(g => g.id === id);
                if (goal) {
                    goal.done = cb.checked;
                    saveData();
                    renderGoals();
                }
            });
        });

        // Bind delete buttons
        dom.goalsContainer.querySelectorAll('.goal-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mk = btn.dataset.mk;
                const id = btn.dataset.id;
                state.data.goals[mk] = (state.data.goals[mk] || []).filter(g => g.id !== id);
                if (state.data.goals[mk].length === 0) delete state.data.goals[mk];
                saveData();
                renderGoals();
            });
        });
    }

    // Goal year tab bindings
    $('#goals-year-2026').addEventListener('click', () => { state.goalsYear = 2026; renderGoals(); });
    $('#goals-year-2027').addEventListener('click', () => { state.goalsYear = 2027; renderGoals(); });

    function openGoalModal(mk) {
        const [y, m] = mk.split('-').map(Number);
        const monthName = MONTHS[m - 1];
        const html = `
            <form id="goal-form">
                <div class="form-group">
                    <label for="goal-text">Goal for ${monthName} ${y}</label>
                    <input type="text" class="form-input" id="goal-text" placeholder="What do you want to achieve this month?" required>
                </div>
                <button type="submit" class="btn-submit">Add Goal</button>
            </form>
        `;
        openModal(`${monthName} Goal`, html);

        dom.modalBody.querySelector('#goal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = dom.modalBody.querySelector('#goal-text').value.trim();
            if (!text) return;
            if (!state.data.goals[mk]) state.data.goals[mk] = [];
            state.data.goals[mk].push({ id: uid(), text, done: false });
            saveData();
            closeModal();
            renderGoals();
        });
    }

    // ── CRM ──────────────────────────────────────────────

    function renderCRM() {
        renderCRMTabs();
        switch (state.crmView) {
            case 'clients': renderClients(); break;
            case 'meetings': renderMeetings(); break;
            case 'logs': renderLogs(); break;
        }
    }

    function renderCRMTabs() {
        $$('.crm-tab').forEach(t => t.classList.toggle('active', t.dataset.crmView === state.crmView));
        $$('.crm-content').forEach(c => c.classList.remove('crm-content-active'));
        $(`#crm-${state.crmView}`).classList.add('crm-content-active');
    }

    $$('.crm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.crmView = tab.dataset.crmView;
            renderCRM();
        });
    });

    // ── Clients ──────────────────────────────────────────────
    function renderClients() {
        const clients = state.data.clients;
        if (clients.length === 0) {
            dom.clientList.innerHTML = '<p class="empty-state">No clients added yet. Click "Add Client" to get started.</p>';
            return;
        }

        dom.clientList.innerHTML = '';
        clients.forEach(client => {
            const initials = client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const card = document.createElement('div');
            card.className = 'client-card';
            card.innerHTML = `
                <div class="client-card-header">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="client-avatar">${initials}</div>
                        <div>
                            <div class="client-name">${escapeHtml(client.name)}</div>
                            ${client.company ? `<div class="client-company">${escapeHtml(client.company)}</div>` : ''}
                        </div>
                    </div>
                    <div class="client-card-actions">
                        <button class="card-action-btn edit-client" data-id="${client.id}" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="card-action-btn delete delete-client" data-id="${client.id}" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
                <div class="client-info">
                    ${client.email ? `
                        <div class="client-info-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            ${escapeHtml(client.email)}
                        </div>
                    ` : ''}
                    ${client.phone ? `
                        <div class="client-info-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            ${escapeHtml(client.phone)}
                        </div>
                    ` : ''}
                </div>
                ${client.notes ? `<div class="client-notes">${escapeHtml(client.notes)}</div>` : ''}
            `;
            dom.clientList.appendChild(card);
        });

        // Bind edit
        dom.clientList.querySelectorAll('.edit-client').forEach(btn => {
            btn.addEventListener('click', () => {
                const client = state.data.clients.find(c => c.id === btn.dataset.id);
                if (client) openClientModal(client);
            });
        });

        // Bind delete
        dom.clientList.querySelectorAll('.delete-client').forEach(btn => {
            btn.addEventListener('click', () => {
                state.data.clients = state.data.clients.filter(c => c.id !== btn.dataset.id);
                saveData();
                renderClients();
                showToast('Client deleted');
            });
        });
    }

    dom.btnAddClient.addEventListener('click', () => openClientModal(null));

    function openClientModal(existing) {
        const isEdit = !!existing;
        const html = `
            <form id="client-form">
                <div class="form-group">
                    <label for="c-name">Name *</label>
                    <input type="text" class="form-input" id="c-name" placeholder="Client name" value="${isEdit ? escapeHtml(existing.name) : ''}" required>
                </div>
                <div class="form-group">
                    <label for="c-company">Company</label>
                    <input type="text" class="form-input" id="c-company" placeholder="Company name" value="${isEdit ? escapeHtml(existing.company || '') : ''}">
                </div>
                <div class="form-group">
                    <label for="c-email">Email</label>
                    <input type="email" class="form-input" id="c-email" placeholder="email@example.com" value="${isEdit ? escapeHtml(existing.email || '') : ''}">
                </div>
                <div class="form-group">
                    <label for="c-phone">Phone</label>
                    <input type="tel" class="form-input" id="c-phone" placeholder="+1 234 567 890" value="${isEdit ? escapeHtml(existing.phone || '') : ''}">
                </div>
                <div class="form-group">
                    <label for="c-notes">Notes</label>
                    <textarea class="form-textarea" id="c-notes" placeholder="Any notes about this client...">${isEdit ? escapeHtml(existing.notes || '') : ''}</textarea>
                </div>
                <button type="submit" class="btn-submit">${isEdit ? 'Update Client' : 'Add Client'}</button>
            </form>
        `;
        openModal(isEdit ? 'Edit Client' : 'Add Client', html);

        dom.modalBody.querySelector('#client-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                id: isEdit ? existing.id : uid(),
                name: dom.modalBody.querySelector('#c-name').value.trim(),
                company: dom.modalBody.querySelector('#c-company').value.trim(),
                email: dom.modalBody.querySelector('#c-email').value.trim(),
                phone: dom.modalBody.querySelector('#c-phone').value.trim(),
                notes: dom.modalBody.querySelector('#c-notes').value.trim()
            };

            if (isEdit) {
                const idx = state.data.clients.findIndex(c => c.id === existing.id);
                if (idx !== -1) state.data.clients[idx] = data;
            } else {
                state.data.clients.push(data);
            }

            saveData();
            closeModal();
            renderClients();
            showToast(isEdit ? 'Client updated' : 'Client added');
        });
    }

    // ── Meetings ──────────────────────────────────────────────
    function renderMeetings() {
        const meetings = state.data.meetings;
        if (meetings.length === 0) {
            dom.meetingList.innerHTML = '<p class="empty-state">No meetings logged yet.</p>';
            return;
        }

        // Sort by date descending
        const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
        dom.meetingList.innerHTML = '';

        sorted.forEach(mtg => {
            const client = state.data.clients.find(c => c.id === mtg.clientId);
            const card = document.createElement('div');
            card.className = 'meeting-card';
            card.innerHTML = `
                <div class="meeting-date">${mtg.date}${mtg.time ? ' at ' + mtg.time : ''}</div>
                <div class="meeting-client-name">${client ? escapeHtml(client.name) : 'Unknown Client'}</div>
                ${mtg.notes ? `<div class="meeting-notes">${escapeHtml(mtg.notes)}</div>` : ''}
                <div class="meeting-card-actions">
                    <button class="card-action-btn edit-meeting" data-id="${mtg.id}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="card-action-btn delete delete-meeting" data-id="${mtg.id}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
            dom.meetingList.appendChild(card);
        });

        dom.meetingList.querySelectorAll('.edit-meeting').forEach(btn => {
            btn.addEventListener('click', () => {
                const mtg = state.data.meetings.find(m => m.id === btn.dataset.id);
                if (mtg) openMeetingModal(mtg);
            });
        });

        dom.meetingList.querySelectorAll('.delete-meeting').forEach(btn => {
            btn.addEventListener('click', () => {
                state.data.meetings = state.data.meetings.filter(m => m.id !== btn.dataset.id);
                saveData();
                renderMeetings();
                showToast('Meeting deleted');
            });
        });
    }

    dom.btnAddMeeting.addEventListener('click', () => openMeetingModal(null));

    function openMeetingModal(existing) {
        const isEdit = !!existing;
        const clientOptions = state.data.clients.map(c =>
            `<option value="${c.id}" ${isEdit && existing.clientId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
        ).join('');

        if (state.data.clients.length === 0) {
            showToast('Add a client first before logging a meeting.');
            return;
        }

        const html = `
            <form id="meeting-form">
                <div class="form-group">
                    <label for="m-client">Client *</label>
                    <select class="form-select" id="m-client" required>
                        <option value="">Select a client</option>
                        ${clientOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="m-date">Date *</label>
                    <input type="date" class="form-input" id="m-date" value="${isEdit ? existing.date : ''}" required>
                </div>
                <div class="form-group">
                    <label for="m-time">Time</label>
                    <input type="time" class="form-input" id="m-time" value="${isEdit ? (existing.time || '') : ''}">
                </div>
                <div class="form-group">
                    <label for="m-notes">Notes</label>
                    <textarea class="form-textarea" id="m-notes" placeholder="Meeting notes...">${isEdit ? escapeHtml(existing.notes || '') : ''}</textarea>
                </div>
                <button type="submit" class="btn-submit">${isEdit ? 'Update Meeting' : 'Log Meeting'}</button>
            </form>
        `;
        openModal(isEdit ? 'Edit Meeting' : 'Log Meeting', html);

        dom.modalBody.querySelector('#meeting-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                id: isEdit ? existing.id : uid(),
                clientId: dom.modalBody.querySelector('#m-client').value,
                date: dom.modalBody.querySelector('#m-date').value,
                time: dom.modalBody.querySelector('#m-time').value,
                notes: dom.modalBody.querySelector('#m-notes').value.trim()
            };

            if (isEdit) {
                const idx = state.data.meetings.findIndex(m => m.id === existing.id);
                if (idx !== -1) state.data.meetings[idx] = data;
            } else {
                state.data.meetings.push(data);
            }

            saveData();
            closeModal();
            renderMeetings();
            showToast(isEdit ? 'Meeting updated' : 'Meeting logged');
        });
    }

    // ── Business Logs ──────────────────────────────────────────────
    function renderLogs() {
        const logs = state.data.businessLogs;
        if (logs.length === 0) {
            dom.logList.innerHTML = '<p class="empty-state">No business logs yet.</p>';
            return;
        }

        const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
        dom.logList.innerHTML = '';

        sorted.forEach(log => {
            const card = document.createElement('div');
            card.className = 'log-card';
            card.innerHTML = `
                <div class="log-date">${log.date}</div>
                <div class="log-entry">${escapeHtml(log.entry)}</div>
                <div class="log-card-actions">
                    <button class="card-action-btn edit-log" data-id="${log.id}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="card-action-btn delete delete-log" data-id="${log.id}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
            dom.logList.appendChild(card);
        });

        dom.logList.querySelectorAll('.edit-log').forEach(btn => {
            btn.addEventListener('click', () => {
                const log = state.data.businessLogs.find(l => l.id === btn.dataset.id);
                if (log) openLogModal(log);
            });
        });

        dom.logList.querySelectorAll('.delete-log').forEach(btn => {
            btn.addEventListener('click', () => {
                state.data.businessLogs = state.data.businessLogs.filter(l => l.id !== btn.dataset.id);
                saveData();
                renderLogs();
                showToast('Log entry deleted');
            });
        });
    }

    dom.btnAddLog.addEventListener('click', () => openLogModal(null));

    function openLogModal(existing) {
        const isEdit = !!existing;
        const today = new Date().toISOString().split('T')[0];
        const html = `
            <form id="log-form">
                <div class="form-group">
                    <label for="l-date">Date</label>
                    <input type="date" class="form-input" id="l-date" value="${isEdit ? existing.date : today}" required>
                </div>
                <div class="form-group">
                    <label for="l-entry">Log Entry</label>
                    <textarea class="form-textarea" id="l-entry" placeholder="What happened today in your business?" style="min-height:140px" required>${isEdit ? escapeHtml(existing.entry) : ''}</textarea>
                </div>
                <button type="submit" class="btn-submit">${isEdit ? 'Update Entry' : 'Add Entry'}</button>
            </form>
        `;
        openModal(isEdit ? 'Edit Log Entry' : 'New Business Log', html);

        dom.modalBody.querySelector('#log-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                id: isEdit ? existing.id : uid(),
                date: dom.modalBody.querySelector('#l-date').value,
                entry: dom.modalBody.querySelector('#l-entry').value.trim()
            };

            if (isEdit) {
                const idx = state.data.businessLogs.findIndex(l => l.id === existing.id);
                if (idx !== -1) state.data.businessLogs[idx] = data;
            } else {
                state.data.businessLogs.push(data);
            }

            saveData();
            closeModal();
            renderLogs();
            showToast(isEdit ? 'Entry updated' : 'Entry added');
        });
    }

    // ── Cold DM Tracker ──────────────────────────────────────────────

    function renderColdDMs() {
        const dms = state.data.coldDms;
        if (!dms || dms.length !== 100) {
            state.data.coldDms = new Array(100).fill(false);
        }

        const checked = state.data.coldDms.filter(Boolean).length;
        const remaining = 100 - checked;
        const percent = checked;

        dom.dmCheckedCount.textContent = checked;
        dom.dmRemainingCount.textContent = remaining;
        dom.dmPercent.textContent = percent + '%';
        dom.dmProgressFill.style.width = percent + '%';

        // Color the progress bar based on progress
        if (percent >= 100) {
            dom.dmProgressFill.style.background = 'linear-gradient(90deg, #30d158, #34c759)';
        } else if (percent >= 50) {
            dom.dmProgressFill.style.background = 'linear-gradient(90deg, #0a84ff, #5e5ce6)';
        } else {
            dom.dmProgressFill.style.background = 'linear-gradient(90deg, #0a84ff, #409cff)';
        }

        dom.coldDmGrid.innerHTML = '';
        state.data.coldDms.forEach((isChecked, i) => {
            const item = document.createElement('label');
            item.className = 'colddm-item' + (isChecked ? ' checked' : '');
            item.innerHTML = `
                <input type="checkbox" class="colddm-checkbox" data-index="${i}" ${isChecked ? 'checked' : ''}>
                <span class="colddm-number">${i + 1}</span>
            `;
            dom.coldDmGrid.appendChild(item);
        });

        // Bind checkboxes
        dom.coldDmGrid.querySelectorAll('.colddm-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.index);
                state.data.coldDms[idx] = cb.checked;
                saveData();
                renderColdDMs();
            });
        });
    }

    dom.btnResetDms.addEventListener('click', () => {
        if (confirm('Reset all 100 Cold DM checkboxes? This cannot be undone.')) {
            state.data.coldDms = new Array(100).fill(false);
            saveData();
            renderColdDMs();
            showToast('Cold DM tracker reset!');
        }
    });

    // ── Save / Export / Import ──────────────────────────────────────────────
    dom.btnSave.addEventListener('click', () => {
        saveData();
        showToast('✓ All data saved successfully!');
    });

    dom.btnExport.addEventListener('click', exportData);

    dom.btnImport.addEventListener('click', () => {
        dom.importFileInput.click();
    });

    dom.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importData(file);
        e.target.value = ''; // reset
    });

    // ── Escape HTML ──────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Initialize ──────────────────────────────────────────────
    function init() {
        loadData();

        // Set current date if within 2026-2027
        const now = new Date();
        const yr = now.getFullYear();
        if (yr >= 2026 && yr <= 2027) {
            state.calendarYear = yr;
            state.calendarMonth = now.getMonth();
        }

        renderCalendar();

        // Auto-save every 30 seconds
        setInterval(saveData, 30000);
    }

    init();
})();
