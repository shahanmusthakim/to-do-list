/* ========================================
   TASKFLOW — Application Logic
   Features: Coins & Streaks, Recurring Tasks, Progress Tasks
   ======================================== */

(function () {
  'use strict';

  // --- DOM Elements ---
  const taskForm = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const categorySelect = document.getElementById('category-select');
  const prioritySelect = document.getElementById('priority-select');
  const recurrenceSelect = document.getElementById('recurrence-select');
  const deadlineInput = document.getElementById('deadline-input');
  const progressToggle = document.getElementById('progress-toggle');
  const progressStepsGroup = document.getElementById('progress-steps-group');
  const progressStepsInput = document.getElementById('progress-steps-input');
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const actionsBar = document.getElementById('actions-bar');
  const btnClear = document.getElementById('btn-clear');
  const filterBar = document.getElementById('filter-bar');
  const filterIndicator = document.getElementById('filter-indicator');
  const statPending = document.querySelector('#stat-pending .stat-number');
  const statDone = document.querySelector('#stat-done .stat-number');
  const statStreak = document.querySelector('#stat-streak .stat-number');
  const statCoins = document.querySelector('#stat-coins .stat-number');
  const streakBanner = document.getElementById('streak-banner');
  const streakDays = document.getElementById('streak-days');
  const streakMsg = document.getElementById('streak-msg');

  // Coin dialog
  const coinDialog = document.getElementById('coin-dialog');
  const coinDialogTitle = document.getElementById('coin-dialog-title');
  const coinDialogSubtitle = document.getElementById('coin-dialog-subtitle');
  const coinDialogBreakdown = document.getElementById('coin-dialog-breakdown');
  const coinDialogClose = document.getElementById('coin-dialog-close');
  const coinBurst = document.getElementById('coin-burst');

  // --- State ---
  let tasks = [];
  let currentFilter = 'all';

  // --- Storage Keys ---
  const STORAGE_KEY = 'taskflow_tasks';
  const COIN_KEY = 'taskflow_coins';
  const STREAK_KEY = 'taskflow_streak';

  // --- Coin Config ---
  const COIN_REWARDS = {
    low: 5,
    medium: 10,
    high: 20,
    bonusDeadline: 15,     // Extra coins for completing before deadline
    streakMultiplier: 0.5, // Extra % coins per streak day (e.g. 5-day streak = +250%)
    maxStreakMultiplier: 5, // Cap at 5x
    progressStep: 2,       // Coins per progress step
  };

  // =============================================
  // LOCAL STORAGE
  // =============================================

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      tasks = stored ? JSON.parse(stored) : [];
    } catch {
      tasks = [];
    }
  }

  function saveCoins(coins) {
    localStorage.setItem(COIN_KEY, JSON.stringify(coins));
  }

  function loadCoins() {
    try {
      const stored = localStorage.getItem(COIN_KEY);
      return stored ? JSON.parse(stored) : 0;
    } catch {
      return 0;
    }
  }

  function saveStreak(streakData) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
  }

  function loadStreak() {
    try {
      const stored = localStorage.getItem(STREAK_KEY);
      return stored ? JSON.parse(stored) : { count: 0, lastDate: null };
    } catch {
      return { count: 0, lastDate: null };
    }
  }

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getToday() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDeadline(deadline) {
    const d = new Date(deadline);
    const now = new Date();
    const diffMs = d - now;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) {
      const overHrs = Math.abs(diffHrs);
      if (overHrs < 24) return `Overdue ${overHrs}h`;
      return `Overdue ${Math.abs(diffDays)}d`;
    }
    if (diffHrs < 1) return 'Due soon';
    if (diffHrs < 24) return `${diffHrs}h left`;
    if (diffDays < 7) return `${diffDays}d left`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isOverdue(deadline) {
    return deadline && new Date(deadline) < new Date();
  }

  function isBeforeDeadline(deadline) {
    return deadline && new Date(deadline) > new Date();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const categoryLabels = {
    personal: '🏠 Personal',
    work: '💼 Work',
    health: '💪 Health',
    learning: '📚 Learning',
  };

  // =============================================
  // STREAK SYSTEM
  // =============================================

  function checkAndUpdateStreak() {
    const streak = loadStreak();
    const today = getToday();

    // Check if streak is broken (missed yesterday)
    if (streak.lastDate) {
      const lastDate = new Date(streak.lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / 86400000);

      if (diffDays > 1) {
        // Streak broken!
        streak.count = 0;
        streak.lastDate = null;
        saveStreak(streak);
      }
    }

    return streak;
  }

  function recordStreakCompletion() {
    const streak = loadStreak();
    const today = getToday();

    if (streak.lastDate === today) {
      // Already completed a task today, streak already counted
      return streak;
    }

    // Check if this continues the streak (yesterday or fresh start)
    if (streak.lastDate) {
      const lastDate = new Date(streak.lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / 86400000);

      if (diffDays === 1) {
        streak.count += 1; // Continue streak
      } else if (diffDays > 1) {
        streak.count = 1; // Restart
      }
    } else {
      streak.count = 1; // First day
    }

    streak.lastDate = today;
    saveStreak(streak);
    return streak;
  }

  function updateStreakDisplay() {
    const streak = checkAndUpdateStreak();

    animateNumber(statStreak, streak.count);

    if (streak.count > 0) {
      streakBanner.style.display = 'flex';
      streakDays.textContent = `${streak.count} day streak!`;

      if (streak.lastDate === getToday()) {
        streakMsg.textContent = "You're on fire today! Keep it up! 🔥";
      } else {
        streakMsg.textContent = "Complete a task today to keep your streak!";
      }
    } else {
      streakBanner.style.display = 'none';
    }
  }

  // =============================================
  // COIN SYSTEM
  // =============================================

  function addCoins(amount) {
    let coins = loadCoins();
    coins += amount;
    saveCoins(coins);
    animateNumber(statCoins, coins);
    return coins;
  }

  function calculateReward(task) {
    const reward = { base: 0, deadline: 0, streak: 0, total: 0, breakdown: [] };

    // Base reward by priority
    reward.base = COIN_REWARDS[task.priority] || COIN_REWARDS.medium;
    reward.breakdown.push({ label: `${task.priority} priority task`, value: reward.base });

    // Deadline bonus
    if (task.deadline && isBeforeDeadline(task.deadline)) {
      reward.deadline = COIN_REWARDS.bonusDeadline;
      reward.breakdown.push({ label: '⏰ Before deadline bonus', value: reward.deadline });
    }

    // Streak multiplier
    const streak = loadStreak();
    if (streak.count > 0) {
      const multiplier = Math.min(streak.count * COIN_REWARDS.streakMultiplier, COIN_REWARDS.maxStreakMultiplier);
      const baseTotal = reward.base + reward.deadline;
      reward.streak = Math.floor(baseTotal * multiplier);
      if (reward.streak > 0) {
        reward.breakdown.push({ label: `🔥 ${streak.count}-day streak bonus`, value: reward.streak });
      }
    }

    reward.total = reward.base + reward.deadline + reward.streak;
    return reward;
  }

  function showCoinReward(reward, taskText) {
    coinDialogTitle.textContent = `+${reward.total} Coins!`;
    coinDialogSubtitle.textContent = `"${taskText}" completed!`;

    // Breakdown
    coinDialogBreakdown.innerHTML = '';
    reward.breakdown.forEach(item => {
      const div = document.createElement('div');
      div.className = 'coin-breakdown-item';
      div.innerHTML = `
        <span class="coin-breakdown-label">${item.label}</span>
        <span class="coin-breakdown-value">+${item.value}</span>
      `;
      coinDialogBreakdown.appendChild(div);
    });

    // Burst particles
    coinBurst.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('div');
      particle.className = 'coin-particle';
      particle.textContent = '🪙';
      particle.style.left = `${40 + Math.random() * 20}%`;
      particle.style.top = `${30 + Math.random() * 20}%`;
      particle.style.setProperty('--px', `${(Math.random() - 0.5) * 200}px`);
      particle.style.setProperty('--py', `${(Math.random() - 0.5) * 200}px`);
      particle.style.animationDelay = `${i * 0.05}s`;
      coinBurst.appendChild(particle);
    }

    coinDialog.showModal();
  }

  coinDialogClose.addEventListener('click', () => {
    coinDialog.close();
  });

  coinDialog.addEventListener('click', (e) => {
    if (e.target === coinDialog) {
      coinDialog.close();
    }
  });

  // =============================================
  // RECURRING TASK SYSTEM
  // =============================================

  function checkRecurringTasks() {
    const today = getToday();
    let needsSave = false;

    tasks.forEach(task => {
      if (!task.recurrence || task.recurrence === 'none') return;
      if (!task.completed) return;

      const completedDate = new Date(task.completedAt).toISOString().slice(0, 10);
      const shouldReset = shouldRecur(task, completedDate, today);

      if (shouldReset) {
        task.completed = false;
        task.completedAt = null;

        // Reset progress if it's a progress task
        if (task.isProgressTask) {
          task.progressCurrent = 0;
        }

        needsSave = true;
      }
    });

    if (needsSave) {
      saveTasks();
    }
  }

  function shouldRecur(task, completedDate, today) {
    if (completedDate === today) return false; // Don't reset on same day

    if (task.recurrence === 'daily') {
      return true; // Reset if completed on a previous day
    }

    if (task.recurrence === 'weekly') {
      const completed = new Date(completedDate);
      const now = new Date(today);
      const diffDays = Math.floor((now - completed) / 86400000);
      return diffDays >= 7;
    }

    return false;
  }

  // =============================================
  // TOAST NOTIFICATIONS
  // =============================================

  function showToast(message, icon = '✅') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 2500);
  }

  // =============================================
  // TASK ELEMENT RENDERING
  // =============================================

  function createTaskElement(task) {
    const li = document.createElement('li');
    const classes = ['task-item'];
    if (task.completed) classes.push('completed');
    if (task.recurrence && task.recurrence !== 'none') classes.push('is-recurring');
    if (!task.completed && isOverdue(task.deadline)) classes.push('is-overdue');
    li.className = classes.join(' ');
    li.dataset.id = task.id;
    li.setAttribute('role', 'listitem');

    // Build meta badges
    let metaHtml = `
      <span class="task-badge badge-${task.category}">${categoryLabels[task.category] || task.category}</span>
      <span class="priority-dot priority-${task.priority}" title="${task.priority} priority"></span>
    `;

    // Recurrence badge
    if (task.recurrence && task.recurrence !== 'none') {
      const recLabel = task.recurrence === 'daily' ? '🔄 Daily' : '📅 Weekly';
      metaHtml += `<span class="recurrence-badge rec-${task.recurrence}">${recLabel}</span>`;
    }

    // Deadline badge
    if (task.deadline) {
      const overdue = !task.completed && isOverdue(task.deadline);
      const bonusEarned = task.completed && task.deadlineBonusEarned;
      let deadlineClass = 'deadline-badge';
      if (overdue) deadlineClass += ' overdue';
      if (bonusEarned) deadlineClass += ' bonus-earned';
      metaHtml += `<span class="${deadlineClass}">⏰ ${formatDeadline(task.deadline)}</span>`;
    }

    // Coin reward badge
    const coinValue = COIN_REWARDS[task.priority] || COIN_REWARDS.medium;
    metaHtml += `<span class="coin-badge">🪙 ${coinValue}</span>`;

    metaHtml += `<span class="task-time">${formatTime(task.createdAt)}</span>`;

    // Progress bar HTML
    let progressHtml = '';
    if (task.isProgressTask) {
      const percent = Math.round((task.progressCurrent / task.progressTotal) * 100);
      const fillClass = percent >= 100 ? 'task-progress-fill complete' : 'task-progress-fill';
      progressHtml = `
        <div class="task-progress-bar">
          <div class="task-progress-header">
            <span class="task-progress-label">${task.progressCurrent} / ${task.progressTotal} steps</span>
            <span class="task-progress-percent">${percent}%</span>
          </div>
          <div class="task-progress-track">
            <div class="${fillClass}" style="width: ${percent}%"></div>
          </div>
          ${!task.completed ? `
          <div class="task-progress-actions">
            <button class="btn-progress-step btn-progress-inc" ${task.progressCurrent >= task.progressTotal ? 'disabled' : ''}>+ Step</button>
            <button class="btn-progress-step btn-progress-dec" ${task.progressCurrent <= 0 ? 'disabled' : ''}>- Step</button>
          </div>
          ` : ''}
        </div>
      `;
    }

    li.innerHTML = `
      <label class="task-checkbox">
        <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark as ${task.completed ? 'pending' : 'complete'}" ${task.isProgressTask && !task.completed && task.progressCurrent < task.progressTotal ? 'disabled title="Complete all steps first"' : ''} />
        <span class="checkmark">
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </label>
      <div class="task-content">
        <p class="task-text">${escapeHtml(task.text)}</p>
        <div class="task-meta">${metaHtml}</div>
        ${progressHtml}
      </div>
      <div class="task-actions">
        <button class="btn-action btn-edit" title="Edit task" aria-label="Edit task">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="btn-action btn-delete" title="Delete task" aria-label="Delete task">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M6 4V3h4v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    // Checkbox event
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Delete event
    const btnDelete = li.querySelector('.btn-delete');
    btnDelete.addEventListener('click', () => deleteTask(task.id));

    // Edit event
    const btnEdit = li.querySelector('.btn-edit');
    btnEdit.addEventListener('click', () => editTask(task.id, li));

    // Progress step events
    if (task.isProgressTask && !task.completed) {
      const btnInc = li.querySelector('.btn-progress-inc');
      const btnDec = li.querySelector('.btn-progress-dec');

      if (btnInc) {
        btnInc.addEventListener('click', () => incrementProgress(task.id));
      }
      if (btnDec) {
        btnDec.addEventListener('click', () => decrementProgress(task.id));
      }
    }

    return li;
  }

  // =============================================
  // RENDER
  // =============================================

  function render() {
    const filtered = getFilteredTasks();

    taskList.innerHTML = '';

    filtered.forEach((task, index) => {
      const el = createTaskElement(task);
      el.style.animationDelay = `${index * 0.04}s`;
      taskList.appendChild(el);
    });

    // Show/hide empty state
    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

    // Update stats
    updateStats();

    // Show/hide clear button
    const completedCount = tasks.filter((t) => t.completed).length;
    actionsBar.style.display = completedCount > 0 ? 'flex' : 'none';

    // Update overall progress
    updateProgress();

    // Update coins display
    const coins = loadCoins();
    animateNumber(statCoins, coins);

    // Update streak display
    updateStreakDisplay();
  }

  function getFilteredTasks() {
    switch (currentFilter) {
      case 'pending':
        return tasks.filter((t) => !t.completed);
      case 'completed':
        return tasks.filter((t) => t.completed);
      case 'recurring':
        return tasks.filter((t) => t.recurrence && t.recurrence !== 'none');
      default:
        return [...tasks];
    }
  }

  function updateStats() {
    const pending = tasks.filter((t) => !t.completed).length;
    const done = tasks.filter((t) => t.completed).length;

    animateNumber(statPending, pending);
    animateNumber(statDone, done);
  }

  function animateNumber(el, target) {
    const current = parseInt(el.textContent, 10) || 0;
    if (current === target) return;

    el.textContent = target;
    el.style.transform = 'scale(1.3)';
    el.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
    }, 150);
  }

  function updateProgress() {
    let container = document.querySelector('.progress-container');

    if (tasks.length === 0) {
      if (container) container.remove();
      return;
    }

    if (!container) {
      container = document.createElement('div');
      container.className = 'progress-container';
      container.innerHTML = `
        <div class="progress-header">
          <span class="progress-label">Progress</span>
          <span class="progress-percent">0%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
      `;
      taskList.parentNode.insertBefore(container, taskList);
    }

    const done = tasks.filter((t) => t.completed).length;
    const percent = Math.round((done / tasks.length) * 100);
    container.querySelector('.progress-percent').textContent = `${percent}%`;
    container.querySelector('.progress-fill').style.width = `${percent}%`;
  }

  // =============================================
  // TASK ACTIONS
  // =============================================

  function addTask(text, category, priority, recurrence, deadline, isProgressTask, progressTotal) {
    const task = {
      id: generateId(),
      text: text.trim(),
      category,
      priority,
      completed: false,
      createdAt: Date.now(),
      recurrence: recurrence || 'none',
      deadline: deadline || null,
      deadlineBonusEarned: false,
      isProgressTask: isProgressTask || false,
      progressCurrent: 0,
      progressTotal: progressTotal || 0,
      completedAt: null,
    };

    tasks.unshift(task);
    saveTasks();
    render();
    showToast('Task added!', '✨');
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // If it's a progress task that isn't fully progressed, don't allow completion
    if (task.isProgressTask && !task.completed && task.progressCurrent < task.progressTotal) {
      showToast('Complete all steps first!', '⚠️');
      return;
    }

    task.completed = !task.completed;

    if (task.completed) {
      task.completedAt = Date.now();

      // Check deadline bonus
      if (task.deadline && isBeforeDeadline(task.deadline)) {
        task.deadlineBonusEarned = true;
      }

      // Calculate and award coins
      const reward = calculateReward(task);
      addCoins(reward.total);

      // Update streak
      recordStreakCompletion();

      // Show reward dialog
      showCoinReward(reward, task.text.length > 30 ? task.text.substring(0, 30) + '…' : task.text);
    } else {
      task.completedAt = null;
      task.deadlineBonusEarned = false;
    }

    saveTasks();

    const el = taskList.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('completing');
      el.addEventListener('animationend', () => {
        render();
      }, { once: true });
    } else {
      render();
    }

    showToast(
      task.completed ? 'Task completed! 🎉' : 'Task reopened',
      task.completed ? '🎉' : '🔄'
    );
  }

  function deleteTask(id) {
    const el = taskList.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('removing');
      el.addEventListener('animationend', () => {
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks();
        render();
      }, { once: true });
    } else {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      render();
    }

    showToast('Task deleted', '🗑️');
  }

  function editTask(id, li) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const textEl = li.querySelector('.task-text');
    const original = task.text;

    // Replace text with an input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.maxLength = 200;
    input.style.cssText = `
      flex: 1;
      background: rgba(124,58,237,0.1);
      border: 1px solid rgba(124,58,237,0.4);
      border-radius: 8px;
      color: #f1eef8;
      font-family: inherit;
      font-size: 0.95rem;
      padding: 6px 12px;
      outline: none;
      width: 100%;
    `;

    textEl.replaceWith(input);
    input.focus();
    input.select();

    function save() {
      const val = input.value.trim();
      if (val && val !== original) {
        task.text = val;
        saveTasks();
        showToast('Task updated', '✏️');
      }
      render();
    }

    input.addEventListener('blur', save, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        input.value = original;
        input.blur();
      }
    });
  }

  // =============================================
  // PROGRESS TASK ACTIONS
  // =============================================

  function incrementProgress(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !task.isProgressTask) return;
    if (task.progressCurrent >= task.progressTotal) return;

    task.progressCurrent += 1;

    // Award coins for each step
    addCoins(COIN_REWARDS.progressStep);
    showToast(`+${COIN_REWARDS.progressStep} coins for step progress!`, '🪙');

    // Auto-complete if all steps done
    if (task.progressCurrent >= task.progressTotal) {
      showToast('All steps complete! You can now mark this task done.', '🎯');
    }

    saveTasks();
    render();
  }

  function decrementProgress(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !task.isProgressTask) return;
    if (task.progressCurrent <= 0) return;

    task.progressCurrent -= 1;
    saveTasks();
    render();
  }

  // =============================================
  // CLEAR COMPLETED
  // =============================================

  function clearCompleted() {
    const completedEls = taskList.querySelectorAll('.task-item.completed');
    let animCount = 0;

    if (completedEls.length === 0) return;

    completedEls.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('removing');
        animCount++;
        el.addEventListener('animationend', () => {
          animCount--;
          if (animCount === 0) {
            tasks = tasks.filter((t) => !t.completed);
            saveTasks();
            render();
          }
        }, { once: true });
      }, i * 60);
    });

    showToast('Completed tasks cleared', '🧹');
  }

  // =============================================
  // FILTER INDICATOR
  // =============================================

  function updateFilterIndicator() {
    const activeBtn = filterBar.querySelector('.filter-btn.active');
    if (!activeBtn) return;

    const barRect = filterBar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    filterIndicator.style.width = `${btnRect.width}px`;
    filterIndicator.style.left = `${btnRect.left - barRect.left}px`;
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================

  // Progress toggle
  progressToggle.addEventListener('change', () => {
    progressStepsGroup.style.display = progressToggle.checked ? 'block' : 'none';
  });

  // Form submit
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) {
      taskInput.focus();
      return;
    }

    const recurrence = recurrenceSelect.value;
    const deadline = deadlineInput.value || null;
    const isProgressTask = progressToggle.checked;
    const progressTotal = isProgressTask ? Math.max(2, Math.min(100, parseInt(progressStepsInput.value, 10) || 5)) : 0;

    addTask(
      text,
      categorySelect.value,
      prioritySelect.value,
      recurrence,
      deadline,
      isProgressTask,
      progressTotal
    );

    // Reset form
    taskInput.value = '';
    deadlineInput.value = '';
    progressToggle.checked = false;
    progressStepsGroup.style.display = 'none';
    progressStepsInput.value = '5';
    recurrenceSelect.value = 'none';
    taskInput.focus();
  });

  // Filters
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;

    updateFilterIndicator();
    render();
  });

  // Clear completed
  btnClear.addEventListener('click', clearCompleted);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Focus input with "/"
    if (e.key === '/' && document.activeElement !== taskInput) {
      e.preventDefault();
      taskInput.focus();
    }
  });

  // Resize handler for filter indicator
  window.addEventListener('resize', updateFilterIndicator);

  // =============================================
  // INITIALIZE
  // =============================================

  loadTasks();

  // Check recurring tasks on load
  checkRecurringTasks();

  render();

  // Set filter indicator after paint
  requestAnimationFrame(() => {
    updateFilterIndicator();
  });
})();
