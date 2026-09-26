/* ========================================
   TASKFLOW — Application Logic
   ======================================== */

(function () {
  'use strict';

  // --- DOM Elements ---
  const taskForm = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const categorySelect = document.getElementById('category-select');
  const prioritySelect = document.getElementById('priority-select');
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const actionsBar = document.getElementById('actions-bar');
  const btnClear = document.getElementById('btn-clear');
  const filterBar = document.getElementById('filter-bar');
  const filterIndicator = document.getElementById('filter-indicator');
  const statPending = document.querySelector('#stat-pending .stat-number');
  const statDone = document.querySelector('#stat-done .stat-number');

  // --- State ---
  let tasks = [];
  let currentFilter = 'all';

  // --- Local Storage ---
  const STORAGE_KEY = 'taskflow_tasks';

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

  // --- Unique ID ---
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // --- Time formatting ---
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

  // --- Category labels ---
  const categoryLabels = {
    personal: '🏠 Personal',
    work: '💼 Work',
    health: '💪 Health',
    learning: '📚 Learning',
  };

  // --- Toast notifications ---
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

  // --- Create task element ---
  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;
    li.setAttribute('role', 'listitem');

    li.innerHTML = `
      <label class="task-checkbox">
        <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark as ${task.completed ? 'pending' : 'complete'}" />
        <span class="checkmark">
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </label>
      <div class="task-content">
        <p class="task-text">${escapeHtml(task.text)}</p>
        <div class="task-meta">
          <span class="task-badge badge-${task.category}">${categoryLabels[task.category] || task.category}</span>
          <span class="priority-dot priority-${task.priority}" title="${task.priority} priority"></span>
          <span class="task-time">${formatTime(task.createdAt)}</span>
        </div>
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

    return li;
  }

  // --- Escape HTML ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Render tasks ---
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

    // Update progress
    updateProgress();
  }

  // --- Filter tasks ---
  function getFilteredTasks() {
    switch (currentFilter) {
      case 'pending':
        return tasks.filter((t) => !t.completed);
      case 'completed':
        return tasks.filter((t) => t.completed);
      default:
        return [...tasks];
    }
  }

  // --- Update stats ---
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

  // --- Progress bar ---
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

  // --- Add task ---
  function addTask(text, category, priority) {
    const task = {
      id: generateId(),
      text: text.trim(),
      category,
      priority,
      completed: false,
      createdAt: Date.now(),
    };

    tasks.unshift(task);
    saveTasks();
    render();
    showToast('Task added!', '✨');
  }

  // --- Toggle task ---
  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
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

  // --- Delete task ---
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

  // --- Edit task ---
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

  // --- Clear completed ---
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

  // --- Filter indicator ---
  function updateFilterIndicator() {
    const activeBtn = filterBar.querySelector('.filter-btn.active');
    if (!activeBtn) return;

    const barRect = filterBar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    filterIndicator.style.width = `${btnRect.width}px`;
    filterIndicator.style.left = `${btnRect.left - barRect.left}px`;
  }

  // --- Event Listeners ---

  // Form submit
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) {
      taskInput.focus();
      return;
    }

    addTask(text, categorySelect.value, prioritySelect.value);
    taskInput.value = '';
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

  // --- Initialize ---
  loadTasks();
  render();

  // Set filter indicator after paint
  requestAnimationFrame(() => {
    updateFilterIndicator();
  });
})();
