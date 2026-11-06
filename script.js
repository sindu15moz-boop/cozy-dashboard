(function () {
  "use strict";
  const STORE_KEY = "cozy_productivity_v1";
  let state = { tasks: {}, goals: [] };
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          state.tasks = parsed.tasks || {};
          state.goals = Array.isArray(parsed.goals) ? parsed.goals : [];
        }
      }
    } catch (e) {}
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function todayKey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
  function dateKey(d) { return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const target = item.dataset.page;
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      pages.forEach(p => p.classList.remove("active"));
      document.getElementById("page-" + target).classList.add("active");
      sidebar.classList.remove("open");
      backdrop.classList.remove("active");
      if (target === "weekly") renderWeekly();
      if (target === "monthly") renderMonthly();
      if (target === "goals") renderGoals();
    });
  });
  document.getElementById("mobileToggle").addEventListener("click", () => { sidebar.classList.toggle("open"); backdrop.classList.toggle("active"); });
  backdrop.addEventListener("click", () => { sidebar.classList.remove("open"); backdrop.classList.remove("active"); });
  const todayDateEl = document.getElementById("todayDate");
  const taskList = document.getElementById("taskList");
  function formatDate(d) { return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
  function getTodayTasks() { return state.tasks[todayKey()] || []; }
  function setTodayTasks(list) { state.tasks[todayKey()] = list; save(); }
  function renderDaily() {
    todayDateEl.textContent = formatDate(new Date());
    const tasks = getTodayTasks();
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total ? Math.round((done/total)*100) : 0;
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statDone").textContent = done;
    document.getElementById("statRemain").textContent = total - done;
    document.getElementById("statPct").textContent = pct + "%";
    document.getElementById("dailyProgress").style.width = pct + "%";
    taskList.innerHTML = "";
    if (tasks.length === 0) { taskList.innerHTML = '<div class="empty-state">No tasks yet. Add one above to get started ☕</div>'; return; }
    tasks.forEach(task => {
      const el = document.createElement("div");
      el.className = "task-item" + (task.done ? " done" : "");
      el.innerHTML = `
        <div class="task-check ${task.done ? "checked" : ""}" data-act="toggle" data-id="${task.id}"></div>
        <div class="task-body"><div class="task-text">${escapeHtml(task.title)}</div>
        <div class="task-meta">${task.category ? `<span class="badge cat">${escapeHtml(task.category)}</span>` : ""}${task.priority ? `<span class="badge prio-${task.priority}">${task.priority}</span>` : ""}</div></div>
        <div class="task-actions"><button class="icon-btn" data-act="edit" data-id="${task.id}">✏️</button><button class="icon-btn danger" data-act="del" data-id="${task.id}">🗑️</button></div>`;
      taskList.appendChild(el);
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  document.getElementById("addTaskBtn").addEventListener("click", () => {
    const title = document.getElementById("taskTitle").value.trim();
    if (!title) return;
    const tasks = getTodayTasks();
    tasks.push({ id: uid(), title, done: false, category: document.getElementById("taskCategory").value, priority: document.getElementById("taskPriority").value });
    setTodayTasks(tasks);
    document.getElementById("taskTitle").value = "";
    renderDaily();
  });
  document.getElementById("taskTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("addTaskBtn").click(); });
  taskList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    const tasks = getTodayTasks(), idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    if (act === "toggle") { tasks[idx].done = !tasks[idx].done; setTodayTasks(tasks); renderDaily(); }
    else if (act === "del") { tasks.splice(idx, 1); setTodayTasks(tasks); renderDaily(); }
    else if (act === "edit") { openTaskEdit(tasks[idx]); }
  });
  let editingTaskId = null;
  function openTaskEdit(task) {
    editingTaskId = task.id;
    document.getElementById("editTaskTitle").value = task.title;
    document.getElementById("editTaskCategory").value = task.category || "";
    document.getElementById("editTaskPriority").value = task.priority || "";
    document.getElementById("taskModal").classList.add("active");
  }
  document.getElementById("cancelTaskEdit").addEventListener("click", () => { document.getElementById("taskModal").classList.remove("active"); });
  document.getElementById("saveTaskEdit").addEventListener("click", () => {
    const tasks = getTodayTasks(), t = tasks.find(x => x.id === editingTaskId);
    if (t) { t.title = document.getElementById("editTaskTitle").value.trim() || t.title; t.category = document.getElementById("editTaskCategory").value; t.priority = document.getElementById("editTaskPriority").value; setTodayTasks(tasks); renderDaily(); }
    document.getElementById("taskModal").classList.remove("active");
  });
  function renderWeekly() {
    const grid = document.getElementById("weekGrid"); grid.innerHTML = "";
    const now = new Date(), days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); days.push(d); }
    let totalTasks = 0, totalDone = 0, bestDay = null, bestPct = -1;
    days.forEach(d => {
      const key = dateKey(d), tasks = state.tasks[key] || [], t = tasks.length, done = tasks.filter(x => x.done).length;
      const pct = t ? Math.round((done/t)*100) : 0; totalTasks += t; totalDone += done;
      if (t > 0 && pct > bestPct) { bestPct = pct; bestDay = d; }
      const card = document.createElement("div"); card.className = "day-card" + (key === todayKey() ? " today" : "");
      card.innerHTML = `<div class="day-name">${d.toLocaleDateString("en-US", { weekday: "short" })}</div><div class="day-pct">${pct}%</div><div class="day-count">${done}/${t}</div>`;
      grid.appendChild(card);
    });
    document.getElementById("weekPct").textContent = (totalTasks ? Math.round((totalDone/totalTasks)*100) : 0) + "%";
    document.getElementById("weekDone").textContent = totalDone;
    document.getElementById("weekBest").textContent = bestDay ? bestDay.toLocaleDateString("en-US", { weekday: "long" }) + " (" + bestPct + "%)" : "—";
  }
  let currentMonth = new Date(); currentMonth.setDate(1);
  function renderMonthly() {
    const year = currentMonth.getFullYear(), month = currentMonth.getMonth();
    document.getElementById("monthTitle").textContent = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const grid = document.getElementById("monthGrid"); grid.innerHTML = "";
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => { const el = document.createElement("div"); el.className = "month-dow"; el.textContent = d; grid.appendChild(el); });
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { const el = document.createElement("div"); el.className = "month-cell empty"; grid.appendChild(el); }
    let mTasks = 0, mDone = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day), key = dateKey(d), tasks = state.tasks[key] || [], t = tasks.length, done = tasks.filter(x => x.done).length;
      const pct = t ? Math.round((done/t)*100) : 0; mTasks += t; mDone += done;
      const el = document.createElement("div"); el.className = "month-cell" + (key === todayKey() ? " today" : "") + (t > 0 ? " has-data" : "");
      el.innerHTML = `<div>${day}</div>${t > 0 ? `<div class="cell-pct">${pct}%</div>` : ""}`; grid.appendChild(el);
    }
    const mPct = mTasks ? Math.round((mDone/mTasks)*100) : 0;
    document.getElementById("monthPct").textContent = mPct + "%";
    document.getElementById("monthDone").textContent = mDone;
    document.getElementById("monthIncomplete").textContent = mTasks - mDone;
    document.getElementById("monthProgressBar").style.width = mPct + "%";
    document.getElementById("monthBestWeek").textContent = "—"; 
  }
  document.getElementById("prevMonth").addEventListener("click", () => { currentMonth.setMonth(currentMonth.getMonth() - 1); renderMonthly(); });
  document.getElementById("nextMonth").addEventListener("click", () => { currentMonth.setMonth(currentMonth.getMonth() + 1); renderMonthly(); });
  const goalList = document.getElementById("goalList");
  let editingGoalId = null;
  function renderGoals() {
    goalList.innerHTML = "";
    if (state.goals.length === 0) { goalList.innerHTML = '<div class="card empty-state">No goals yet. Add one to start dreaming big 🌟</div>'; return; }
    state.goals.forEach(g => {
      const card = document.createElement("div"); card.className = "goal-card" + (g.done ? " completed" : "");
      card.innerHTML = `<div class="goal-header"><div class="goal-title">${escapeHtml(g.title)} ${g.done ? "✅" : ""}</div></div>${g.desc ? `<div class="goal-desc">${escapeHtml(g.desc)}</div>` : ""}<div class="goal-meta">${g.target ? `<span>🎯 Target: ${g.target}</span>` : ""}<span>📈 ${g.progress}%</span><span>${g.done ? "✔ Completed" : "⏳ Active"}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${g.progress}%"></div></div><div class="goal-actions"><button class="small ghost" data-goal-act="toggle" data-id="${g.id}">${g.done ? "Reopen" : "Mark Done"}</button><button class="small ghost" data-goal-act="edit" data-id="${g.id}">Edit</button><button class="small danger" data-goal-act="del" data-id="${g.id}">Delete</button></div>`;
      goalList.appendChild(card);
    });
  }
  document.getElementById("addGoalBtn").addEventListener("click", () => {
    editingGoalId = null; document.getElementById("goalModalTitle").textContent = "New Goal";
    document.getElementById("goalTitle").value = ""; document.getElementById("goalDesc").value = "";
    document.getElementById("goalTarget").value = ""; document.getElementById("goalProgress").value = 0;
    document.getElementById("goalModal").classList.add("active");
  });
  document.getElementById("cancelGoal").addEventListener("click", () => { document.getElementById("goalModal").classList.remove("active"); });
  document.getElementById("saveGoal").addEventListener("click", () => {
    const title = document.getElementById("goalTitle").value.trim(); if (!title) return;
    const desc = document.getElementById("goalDesc").value.trim(), target = document.getElementById("goalTarget").value;
    let progress = parseInt(document.getElementById("goalProgress").value, 10) || 0; progress = Math.max(0, Math.min(100, progress));
    if (editingGoalId) { const g = state.goals.find(x => x.id === editingGoalId); if (g) { g.title = title; g.desc = desc; g.target = target; g.progress = progress; } }
    else { state.goals.push({ id: uid(), title, desc, target, progress, done: false }); }
    save(); renderGoals(); document.getElementById("goalModal").classList.remove("active");
  });
  goalList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goal-act]"); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.goalAct, g = state.goals.find(x => x.id === id); if (!g) return;
    if (act === "toggle") { g.done = !g.done; if (g.done) g.progress = 100; save(); renderGoals(); }
    else if (act === "del") { state.goals = state.goals.filter(x => x.id !== id); save(); renderGoals(); }
    else if (act === "edit") { editingGoalId = id; document.getElementById("goalModalTitle").textContent = "Edit Goal"; document.getElementById("goalTitle").value = g.title; document.getElementById("goalDesc").value = g.desc || ""; document.getElementById("goalTarget").value = g.target || ""; document.getElementById("goalProgress").value = g.progress; document.getElementById("goalModal").classList.add("active"); }
  });
  load(); renderDaily(); renderWeekly(); renderMonthly(); renderGoals();
})();