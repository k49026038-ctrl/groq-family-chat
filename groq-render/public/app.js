/**
 * GroqChat AI — Main Frontend Application Logic
 */

(function () {
  'use strict';

  // --- Constants & Defaults ---
  const STORAGE_KEYS = {
    API_KEY: 'groq_api_key',
    CHATS: 'groq_chat_sessions_v2',
    ACTIVE_CHAT: 'groq_active_chat_id',
    SETTINGS: 'groq_chat_settings_v2',
    SELECTED_MODEL: 'groq_selected_model'
  };

  const PERSONAS = {
    default: {
      name: 'Универсальный помощник',
      icon: '🧠',
      system: 'Ты — полезный, вежливый, умный и точный искусственный интеллект-ассистент на базе ультрабыстрого инференса Groq. Всегда отвечай структурированно, содержательно и на естественном русском языке. Когда пользователь просит написать код, создать веб-страницу (HTML/CSS/JS), скрипт (Python, Bash), таблицу (CSV) или документ (Markdown), ВСЕГДА оформляй его в отдельный блок с указанием языка и имени файла (например: ```html:index.html, ```python:main.py, ```markdown:отчет.md, ```csv:data.csv), чтобы пользователь мог сразу запустить или скачать этот файл в 1 клик.'
    },
    coder: {
      name: 'Senior Fullstack разработчик',
      icon: '💻',
      system: 'Ты — Senior Fullstack архитектор и ведущий инженер программного обеспечения. Пиши надежный, современный, безопасный и чистый код (Python, JS/TS, Go, Rust, SQL, Docker). Всегда объясняй архитектурные решения и краевые случаи. Код оформляй блоками с указанием языка.'
    },
    copywriter: {
      name: 'Креативный копирайтер и редактор',
      icon: '✍️',
      system: 'Ты — первоклассный креативный копирайтер и контент-стратег. Ты создаешь яркие, цепляющие тексты, посты, слоганы и сценарии. Твой слог живой, убедительный, лаконичный и свободный от канцеляризмов и штампов.'
    },
    analyst: {
      name: 'Глубокий аналитик и фактчекер',
      icon: '🔬',
      system: 'Ты — ведущий системный аналитик и фактчекер. Проводи глубокий критический анализ задач, раскладывай аргументы за и против, строй логические причинно-следственные связи и формулируй четкие выводы.'
    },
    translator: {
      name: 'Профессиональный переводчик',
      icon: '🌐',
      system: 'Ты — профессиональный переводчик высочайшего класса. Переводи между языками с безупречным чувством стиля, сохраняя оригинальную тональность, идиомы, культурный контекст и терминологию.'
    },
    custom: {
      name: 'Свой системный промт',
      icon: '✏️',
      system: ''
    }
  };

  const DEFAULT_MODELS = [
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B',
      badge: 'Ультраскорость & Ум',
      context: '32k',
      speed: '~700+ т/сек',
      description: 'Молниеносный отклик на чистом русском: идеально для семьи, рецептов, учебы и советов'
    },
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT-OSS 120B',
      badge: 'Флагман 120B',
      context: '64k',
      speed: '~350 т/сек',
      description: 'Массивная модель на 120 млрд параметров: глубокие знания, подробные ответы и логика'
    },
    {
      id: 'openai/gpt-oss-20b',
      name: 'GPT-OSS 20B',
      badge: 'Компактный GPT',
      context: '32k',
      speed: '~600 т/сек',
      description: 'Быстрые и точные ответы на повседневные вопросы'
    },
    {
      id: 'allam-2-7b',
      name: 'Allam 2 7B',
      badge: 'Мультиязычный 7B',
      context: '8k',
      speed: '~800 т/сек',
      description: 'Легкая и быстрая модель'
    }
  ];

  // --- Safe Storage (prevents Safari Private Browsing crashes) ---
  const memoryStore = {};
  const storage = {
    getItem(key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const val = window.localStorage.getItem(key);
          if (val !== null) return val;
        }
      } catch (e) {}
      return memoryStore[key] || null;
    },
    setItem(key, value) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (e) {}
      memoryStore[key] = String(value);
    },
    removeItem(key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (e) {}
      delete memoryStore[key];
    }
  };

  // Safe clipboard copy helper for iOS Safari
  function safeCopyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    }
    return fallbackCopyText(text);
  }

  function fallbackCopyText(text) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful ? Promise.resolve() : Promise.reject();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // --- State ---
  let state = {
    apiKey: storage.getItem(STORAGE_KEYS.API_KEY) || '',
    hasEnvKey: false,
    currentModel: storage.getItem(STORAGE_KEYS.SELECTED_MODEL) || 'qwen/qwen3.8-27b',
    models: [...DEFAULT_MODELS],
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      persona: 'default',
      customPrompt: ''
    },
    chats: [],
    activeChatId: null,
    isGenerating: false,
    abortController: null,
    searchQuery: ''
  };

  // Load saved settings
  try {
    const savedSettings = JSON.parse(storage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
    state.settings = { ...state.settings, ...savedSettings };
  } catch (e) {}

  // Load chats
  try {
    const savedChats = JSON.parse(storage.getItem(STORAGE_KEYS.CHATS) || '[]');
    state.chats = Array.isArray(savedChats) ? savedChats : [];
  } catch (e) {
    state.chats = [];
  }

  // Active chat ID
  state.activeChatId = storage.getItem(STORAGE_KEYS.ACTIVE_CHAT) || (state.chats[0]?.id || null);

  // --- DOM Elements ---
  const el = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    openSidebarBtn: document.getElementById('openSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    searchChatsInput: document.getElementById('searchChatsInput'),
    historyList: document.getElementById('historyList'),
    sidebarKeyStatus: document.getElementById('sidebarKeyStatus'),
    sidebarDot: document.getElementById('sidebarDot'),
    sidebarKeyText: document.getElementById('sidebarKeyText'),

    // Topbar
    openModelPickerBtn: document.getElementById('openModelPickerBtn'),
    activeModelName: document.getElementById('activeModelName'),
    activeModelBadge: document.getElementById('activeModelBadge'),
    openPersonaModalBtn: document.getElementById('openPersonaModalBtn'),
    activePersonaIcon: document.getElementById('activePersonaIcon'),
    activePersonaLabel: document.getElementById('activePersonaLabel'),
    headerKeyBtn: document.getElementById('headerKeyBtn'),
    headerKeyDot: document.getElementById('headerKeyDot'),
    headerKeyLabel: document.getElementById('headerKeyLabel'),
    exportChatBtn: document.getElementById('exportChatBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),

    // Chat container
    chatScrollArea: document.getElementById('chatScrollArea'),
    welcomeContainer: document.getElementById('welcomeContainer'),
    welcomeKeyCard: document.getElementById('welcomeKeyCard'),
    welcomeKeyInput: document.getElementById('welcomeKeyInput'),
    welcomeSaveKeyBtn: document.getElementById('welcomeSaveKeyBtn'),
    startersGrid: document.getElementById('startersGrid'),
    messagesList: document.getElementById('messagesList'),

    // Input dock
    chatInput: document.getElementById('chatInput'),
    inputPersonaChip: document.getElementById('inputPersonaChip'),
    inputPersonaIcon: document.getElementById('inputPersonaIcon'),
    inputPersonaText: document.getElementById('inputPersonaText'),
    sendBtn: document.getElementById('sendBtn'),
    stopGenerationBtn: document.getElementById('stopGenerationBtn'),
    liveSpeedometer: document.getElementById('liveSpeedometer'),
    liveTokensPerSec: document.getElementById('liveTokensPerSec'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    modalApiKeyInput: document.getElementById('modalApiKeyInput'),
    toggleKeyVisibilityBtn: document.getElementById('toggleKeyVisibilityBtn'),
    keyValidationBadge: document.getElementById('keyValidationBadge'),
    testKeyBtn: document.getElementById('testKeyBtn'),
    clearKeyBtn: document.getElementById('clearKeyBtn'),
    modalModelSelect: document.getElementById('modalModelSelect'),
    modalPersonaSelect: document.getElementById('modalPersonaSelect'),
    customPromptGroup: document.getElementById('customPromptGroup'),
    modalCustomPrompt: document.getElementById('modalCustomPrompt'),
    modalTempSlider: document.getElementById('modalTempSlider'),
    tempValueBadge: document.getElementById('tempValueBadge'),
    modalMaxTokensSlider: document.getElementById('modalMaxTokensSlider'),
    maxTokensValueBadge: document.getElementById('maxTokensValueBadge'),

    // Model Picker Modal
    modelPickerModal: document.getElementById('modelPickerModal'),
    closeModelPickerBtn: document.getElementById('closeModelPickerBtn'),
    modelSearchInput: document.getElementById('modelSearchInput'),
    modalModelsList: document.getElementById('modalModelsList'),

    // Export Modal
    exportModal: document.getElementById('exportModal'),
    closeExportModalBtn: document.getElementById('closeExportModalBtn'),
    exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    copyAllTextBtn: document.getElementById('copyAllTextBtn'),

    // Toasts
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Helper: Show Toast Notification ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success'
      ? `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    toast.innerHTML = `${icon}<span>${message}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  // --- Check Backend Status ---
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        state.hasEnvKey = !!data.hasEnvKey;
        updateKeyStatusUI();
      }
    } catch (e) {
      console.warn('Status check failed:', e);
    }
  }

  // --- Key Status UI Update ---
  function updateKeyStatusUI() {
    const isConfigured = !!(state.apiKey || state.hasEnvKey);

    if (isConfigured) {
      el.sidebarDot.className = 'status-dot active';
      el.sidebarKeyText.textContent = state.hasEnvKey ? 'ИИ готов к работе' : 'Ключ подключен';

      el.headerKeyBtn.className = 'key-pill-btn configured';
      el.headerKeyDot.className = 'status-dot active';
      el.headerKeyLabel.textContent = state.hasEnvKey ? 'ИИ активен для всех' : 'Groq API активен';

      if (el.welcomeKeyCard) {
        el.welcomeKeyCard.style.display = 'none';
      }
    } else {
      el.sidebarDot.className = 'status-dot missing';
      el.sidebarKeyText.textContent = 'Ключ не настроен';

      el.headerKeyBtn.className = 'key-pill-btn missing';
      el.headerKeyDot.className = 'status-dot missing';
      el.headerKeyLabel.textContent = 'Указать ключ Groq';

      if (el.welcomeKeyCard) {
        el.welcomeKeyCard.style.display = 'block';
      }
    }
  }

  // --- Fetch Models from Groq API ---
  async function loadModels() {
    try {
      const headers = {};
      if (state.apiKey) {
        headers['x-groq-api-key'] = state.apiKey;
      }
      const res = await fetch('/api/models', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          state.models = data.models;
          renderModelPickerList();
          populateSettingsModelSelect();
        }
      }
    } catch (e) {
      console.warn('Failed to load live models:', e);
    }
    updateModelHeaderUI();
  }

  function updateModelHeaderUI() {
    const found = state.models.find(m => m.id === state.currentModel) || {
      name: state.currentModel,
      context: '128k'
    };
    el.activeModelName.textContent = found.name || state.currentModel;
    el.activeModelBadge.textContent = found.context || '128k';
  }

  function populateSettingsModelSelect() {
    el.modalModelSelect.innerHTML = '';
    state.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.context || '128k'})`;
      if (m.id === state.currentModel) opt.selected = true;
      el.modalModelSelect.appendChild(opt);
    });
  }

  function renderModelPickerList(filterText = '') {
    const list = el.modalModelsList;
    list.innerHTML = '';
    const q = filterText.toLowerCase().trim();

    const filtered = state.models.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Модели не найдены</div>';
      return;
    }

    filtered.forEach(m => {
      const item = document.createElement('div');
      item.className = `model-option-card ${m.id === state.currentModel ? 'active' : ''}`;
      item.innerHTML = `
        <div class="model-opt-info">
          <div class="model-opt-title-row">
            <span class="model-opt-name">${escapeHtml(m.name || m.id)}</span>
            ${m.badge ? `<span class="brand-badge">${escapeHtml(m.badge)}</span>` : ''}
          </div>
          <div class="model-opt-desc">${escapeHtml(m.description || '')}</div>
          <div class="model-opt-badges">
            <span class="model-sub-badge">Контекст: ${m.context || '128k'}</span>
            <span class="model-sub-badge speed">⚡ ${m.speed || 'Высокая'}</span>
          </div>
        </div>
        ${m.id === state.currentModel ? `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--groq-orange);">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ` : ''}
      `;
      item.addEventListener('click', () => {
        selectModel(m.id);
        closeModal(el.modelPickerModal);
      });
      list.appendChild(item);
    });
  }

  function selectModel(modelId) {
    state.currentModel = modelId;
    storage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
    updateModelHeaderUI();
    populateSettingsModelSelect();
    showToast(`Выбрана модель: ${modelId}`, 'info');
  }

  // --- Persona UI Update ---
  function updatePersonaUI() {
    const current = PERSONAS[state.settings.persona] || PERSONAS.default;
    el.activePersonaIcon.textContent = current.icon;
    el.activePersonaLabel.textContent = current.name;
    el.inputPersonaIcon.textContent = current.icon;
    el.inputPersonaText.textContent = current.name;

    el.modalPersonaSelect.value = state.settings.persona;
    if (state.settings.persona === 'custom') {
      el.customPromptGroup.style.display = 'flex';
      el.modalCustomPrompt.value = state.settings.customPrompt || '';
    } else {
      el.customPromptGroup.style.display = 'none';
    }
  }

  // --- Chat Management ---
  function getActiveChat() {
    return state.chats.find(c => c.id === state.activeChatId) || null;
  }

  function createNewChat() {
    const newChat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: 'Новый диалог',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    state.chats.unshift(newChat);
    state.activeChatId = newChat.id;
    saveChats();
    renderSidebarChats();
    renderActiveChat();
    if (window.innerWidth <= 768) closeSidebar();
    el.chatInput.focus();
  }

  function deleteChat(chatId, e) {
    if (e) e.stopPropagation();
    if (!confirm('Удалить этот диалог?')) return;

    state.chats = state.chats.filter(c => c.id !== chatId);
    if (state.activeChatId === chatId) {
      state.activeChatId = state.chats[0]?.id || null;
    }
    saveChats();
    renderSidebarChats();
    renderActiveChat();
    showToast('Диалог удален', 'info');
  }

  function renameChat(chatId, e) {
    if (e) e.stopPropagation();
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    const newTitle = prompt('Введите новое название диалога:', chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      chat.updatedAt = Date.now();
      saveChats();
      renderSidebarChats();
    }
  }

  function saveChats() {
    storage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(state.chats));
    if (state.activeChatId) {
      storage.setItem(STORAGE_KEYS.ACTIVE_CHAT, state.activeChatId);
    }
  }

  function renderSidebarChats() {
    const list = el.historyList;
    list.innerHTML = '';

    const q = state.searchQuery.toLowerCase().trim();
    const filtered = state.chats.filter(c =>
      !q || (c.title || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-history">${q ? 'Ничего не найдено' : 'История пуста. Начните новый диалог!'}</div>`;
      return;
    }

    filtered.forEach(chat => {
      const item = document.createElement('div');
      item.className = `history-item ${chat.id === state.activeChatId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="history-title-wrap">
          <svg class="history-chat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="history-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
        </div>
        <div class="history-actions">
          <button class="history-action-btn edit" title="Переименовать">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="history-action-btn delete" title="Удалить">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      item.querySelector('.history-title-wrap').addEventListener('click', () => {
        state.activeChatId = chat.id;
        saveChats();
        renderSidebarChats();
        renderActiveChat();
        if (window.innerWidth <= 768) closeSidebar();
      });

      item.querySelector('.history-action-btn.edit').addEventListener('click', (e) => renameChat(chat.id, e));
      item.querySelector('.history-action-btn.delete').addEventListener('click', (e) => deleteChat(chat.id, e));

      list.appendChild(item);
    });
  }

  // --- Render Active Chat Messages ---
  function renderActiveChat() {
    const chat = getActiveChat();
    const hasMessages = chat && chat.messages && chat.messages.length > 0;

    if (!hasMessages) {
      el.welcomeContainer.style.display = 'flex';
      el.messagesList.style.display = 'none';
      el.messagesList.innerHTML = '';
      return;
    }

    el.welcomeContainer.style.display = 'none';
    el.messagesList.style.display = 'flex';
    el.messagesList.innerHTML = '';

    chat.messages.forEach((msg, index) => {
      appendMessageToDOM(msg, index, false);
    });

    scrollToBottom();
  }

  function appendMessageToDOM(msg, index, shouldScroll = true) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;
    row.id = `msg-row-${index}`;

    if (msg.role === 'user') {
      row.innerHTML = `
        <div class="message-content-wrap">
          <div class="message-bubble">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
          <div class="message-footer">
            <div class="message-actions-bar">
              <button class="msg-btn copy-msg-btn" data-text="${encodeURIComponent(msg.content)}" title="Скопировать">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Копировать
              </button>
              <button class="msg-btn edit-msg-btn" data-index="${index}" title="Редактировать">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                Изменить
              </button>
            </div>
          </div>
        </div>
        <div class="message-avatar user">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      `;
    } else {
      // Assistant message
      const stats = msg.stats || {};
      const renderedHtml = window.renderMarkdown ? window.renderMarkdown(msg.content) : escapeHtml(msg.content);

      row.innerHTML = `
        <div class="message-avatar assistant">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z"/>
          </svg>
        </div>
        <div class="message-content-wrap" style="width: 100%;">
          <div class="message-bubble assistant-text">${renderedHtml}</div>
          <div class="message-footer">
            <div class="message-stats-wrap">
              ${stats.speed ? `
                <span class="speed-metric">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z"/></svg>
                  ${stats.speed}
                </span>
              ` : ''}
              ${stats.duration ? `<span class="stat-item">⏱️ ${stats.duration}</span>` : ''}
              ${stats.model ? `<span class="stat-item">${stats.model}</span>` : ''}
            </div>
            <div class="message-actions-bar">
              <div class="msg-dropdown">
                <button class="msg-btn msg-download-toggle-btn" title="Скачать ответ целиком как файл">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <span>Скачать ответ ▾</span>
                </button>
                <div class="msg-dropdown-menu">
                  <button class="dropdown-item download-msg-md" data-text="${encodeURIComponent(msg.content)}">
                    <span>📄 Скачать Markdown (.md)</span>
                  </button>
                  <button class="dropdown-item download-msg-html" data-text="${encodeURIComponent(msg.content)}">
                    <span>🌐 Скачать Веб-страницу (.html)</span>
                  </button>
                  <button class="dropdown-item download-msg-txt" data-text="${encodeURIComponent(msg.content)}">
                    <span>📝 Скачать Текст (.txt)</span>
                  </button>
                </div>
              </div>

              <button class="msg-btn copy-msg-btn" data-text="${encodeURIComponent(msg.content)}" title="Скопировать ответ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Копировать
              </button>
              <button class="msg-btn regen-msg-btn" data-index="${index}" title="Сгенерировать заново">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Повторить
              </button>
            </div>
          </div>
        </div>
      `;
    }

    attachMessageEventListeners(row);
    el.messagesList.appendChild(row);

    if (shouldScroll) {
      scrollToBottom();
    }
  }

  // --- Code Preview Modal Elements ---
  let currentPreviewCode = '';
  let currentPreviewFilename = 'preview.html';
  let currentPreviewMime = 'text/html;charset=utf-8';

  function openLiveCodePreview(code, type, filename = '') {
    currentPreviewCode = code;
    currentPreviewFilename = filename || (type === 'svg' ? 'image.svg' : 'preview.html');
    currentPreviewMime = type === 'svg' ? 'image/svg+xml;charset=utf-8' : 'text/html;charset=utf-8';

    const modal = document.getElementById('codePreviewModal');
    const iframe = document.getElementById('previewIframe');
    const title = document.getElementById('previewModalTitle');

    title.textContent = type === 'svg' ? 'Интерактивный просмотр SVG' : 'Интерактивный просмотр веб-страницы';

    if (type === 'svg') {
      iframe.srcdoc = `<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0;background:#0d0f17;">${code}</body></html>`;
    } else {
      iframe.srcdoc = code;
    }

    openModal(modal);
  }

  function attachMessageEventListeners(row) {
    // Copy message button
    row.querySelectorAll('.copy-msg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = decodeURIComponent(btn.getAttribute('data-text') || '');
        safeCopyText(text).then(() => {
          showToast('Текст скопирован в буфер!', 'success');
        }).catch(() => {
          showToast('Не удалось скопировать', 'error');
        });
      });
    });

    // Code copy buttons inside rendered markdown
    row.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        safeCopyText(code).then(() => {
          btn.classList.add('copied');
          const span = btn.querySelector('.copy-text');
          if (span) span.textContent = 'Скопировано! ✓';
          setTimeout(() => {
            btn.classList.remove('copied');
            if (span) span.textContent = 'Копировать';
          }, 2000);
        }).catch(() => {
          showToast('Не удалось скопировать код', 'error');
        });
      });
    });

    // Single file download buttons inside code blocks
    row.querySelectorAll('.download-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        const filename = decodeURIComponent(btn.getAttribute('data-filename') || 'file.txt');
        const mime = decodeURIComponent(btn.getAttribute('data-mime') || 'text/plain;charset=utf-8');
        downloadFile(code, filename, mime);
        showToast(`Файл "${filename}" скачан на устройство!`, 'success');
      });
    });

    // Interactive Preview buttons inside code blocks (HTML, SVG)
    row.querySelectorAll('.preview-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        const type = btn.getAttribute('data-type') || 'html';
        const parentHeader = btn.closest('.code-block-header');
        const nameBadge = parentHeader ? parentHeader.querySelector('.code-filename-badge') : null;
        const filename = nameBadge ? nameBadge.textContent.replace(/^📄\s*/, '').trim() : '';
        openLiveCodePreview(code, type, filename);
      });
    });

    // Download whole response dropdown toggle
    row.querySelectorAll('.msg-download-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = btn.parentElement.querySelector('.msg-dropdown-menu');
        document.querySelectorAll('.msg-dropdown-menu.open').forEach(m => {
          if (m !== menu) m.classList.remove('open');
        });
        menu.classList.toggle('open');
      });
    });

    // Download response as Markdown (.md)
    row.querySelectorAll('.download-msg-md').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = decodeURIComponent(btn.getAttribute('data-text') || '');
        const filename = `otvet_${Date.now()}.md`;
        downloadFile(text, filename, 'text/markdown;charset=utf-8');
        showToast(`Файл "${filename}" скачан!`, 'success');
        btn.closest('.msg-dropdown-menu').classList.remove('open');
      });
    });

    // Download response as HTML page (.html)
    row.querySelectorAll('.download-msg-html').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = decodeURIComponent(btn.getAttribute('data-text') || '');
        const rendered = window.renderMarkdown ? window.renderMarkdown(text) : escapeHtml(text);
        const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ответ ИИ</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      line-height: 1.65;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 20px;
      color: #1e293b;
      background: #f8fafc;
    }
    h1, h2, h3, h4 { color: #0f172a; margin-top: 1.4em; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 14px; }
    code { font-family: monospace; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #f55036; padding: 6px 16px; margin: 16px 0; background: #fff1ee; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
    th { background: #e2e8f0; font-weight: 600; }
    a { color: #f55036; text-decoration: underline; }
  </style>
</head>
<body>
${rendered}
</body>
</html>`;
        const filename = `dokument_${Date.now()}.html`;
        downloadFile(fullHtml, filename, 'text/html;charset=utf-8');
        showToast(`HTML-файл "${filename}" скачан!`, 'success');
        btn.closest('.msg-dropdown-menu').classList.remove('open');
      });
    });

    // Download response as Plain Text (.txt)
    row.querySelectorAll('.download-msg-txt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = decodeURIComponent(btn.getAttribute('data-text') || '');
        const filename = `zametka_${Date.now()}.txt`;
        downloadFile(text, filename, 'text/plain;charset=utf-8');
        showToast(`Текстовый файл "${filename}" скачан!`, 'success');
        btn.closest('.msg-dropdown-menu').classList.remove('open');
      });
    });

    // Edit user message
    row.querySelectorAll('.edit-msg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const chat = getActiveChat();
        if (!chat || !chat.messages[idx]) return;

        el.chatInput.value = chat.messages[idx].content;
        autoResizeTextarea();
        el.chatInput.focus();

        chat.messages = chat.messages.slice(0, idx);
        saveChats();
        renderActiveChat();
      });
    });

    // Regenerate
    row.querySelectorAll('.regen-msg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const chat = getActiveChat();
        if (!chat) return;

        const userMsgIdx = idx - 1;
        if (userMsgIdx >= 0 && chat.messages[userMsgIdx]?.role === 'user') {
          chat.messages = chat.messages.slice(0, userMsgIdx + 1);
          saveChats();
          renderActiveChat();
          generateAssistantResponse(chat);
        }
      });
    });
  }

  function scrollToBottom() {
    el.chatScrollArea.scrollTop = el.chatScrollArea.scrollHeight;
  }

  // --- Send Message & Stream Response ---
  async function handleSendMessage(userPromptText = null) {
    if (state.isGenerating) return;

    const text = (userPromptText !== null ? userPromptText : el.chatInput.value).trim();
    if (!text) return;

    // Check API Key
    if (!state.apiKey && !state.hasEnvKey) {
      openModal(el.settingsModal);
      showToast('Пожалуйста, укажите Groq API ключ для отправки сообщений', 'error');
      return;
    }

    let chat = getActiveChat();
    if (!chat) {
      createNewChat();
      chat = getActiveChat();
    }

    // Auto title if first message
    if (chat.messages.length === 0) {
      chat.title = text.length > 35 ? text.substring(0, 35) + '...' : text;
      renderSidebarChats();
    }

    // Add user message
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    chat.messages.push(userMsg);
    chat.updatedAt = Date.now();
    saveChats();

    // Render user message
    el.welcomeContainer.style.display = 'none';
    el.messagesList.style.display = 'flex';
    appendMessageToDOM(userMsg, chat.messages.length - 1);

    // Clear input
    el.chatInput.value = '';
    autoResizeTextarea();

    // Trigger Assistant Generation
    await generateAssistantResponse(chat);
  }

  async function generateAssistantResponse(chat) {
    state.isGenerating = true;
    updateGeneratingUI(true);

    // Create placeholder assistant message element in DOM
    const assistantIndex = chat.messages.length;
    const placeholderMsg = {
      role: 'assistant',
      content: '',
      stats: null
    };

    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.id = `msg-row-${assistantIndex}`;
    row.innerHTML = `
      <div class="message-avatar assistant">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z"/>
        </svg>
      </div>
      <div class="message-content-wrap" style="width: 100%;">
        <div class="message-bubble assistant-text">
          <span class="streaming-content"></span><span class="streaming-cursor"></span>
        </div>
        <div class="message-footer">
          <div class="message-stats-wrap">
            <span class="speed-metric live-card-metric" style="display:none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z"/></svg>
              <span class="live-card-speed">0 т/сек</span>
            </span>
          </div>
        </div>
      </div>
    `;
    el.messagesList.appendChild(row);
    scrollToBottom();

    const streamContentSpan = row.querySelector('.streaming-content');
    const streamCursorSpan = row.querySelector('.streaming-cursor');
    const liveCardMetric = row.querySelector('.live-card-metric');
    const liveCardSpeed = row.querySelector('.live-card-speed');

    // Build payload messages including system prompt
    const systemPromptText = state.settings.persona === 'custom'
      ? (state.settings.customPrompt || PERSONAS.default.system)
      : (PERSONAS[state.settings.persona]?.system || PERSONAS.default.system);

    const apiMessages = [
      { role: 'system', content: systemPromptText },
      ...chat.messages.map(m => ({ role: m.role, content: m.content }))
    ];

    let fullAssistantText = '';
    const startTime = performance.now();
    let firstTokenTime = null;
    let tokenEstimate = 0;

    state.abortController = new AbortController();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (state.apiKey) headers['x-groq-api-key'] = state.apiKey;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: state.currentModel,
          messages: apiMessages,
          temperature: state.settings.temperature,
          max_tokens: state.settings.maxTokens,
          stream: true
        }),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        let errData;
        try {
          errData = await response.json();
        } catch (e) {
          errData = { error: { message: `Ошибка сервера (${response.status})` } };
        }
        throw new Error(errData?.error?.message || 'Не удалось получить ответ от Groq');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('event: error')) {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error.message || 'Ошибка API Groq');
              }

              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (!firstTokenTime) firstTokenTime = performance.now();
                fullAssistantText += delta;
                tokenEstimate += Math.max(1, Math.round(delta.length / 3.5));

                // Update text during stream
                streamContentSpan.textContent = fullAssistantText;

                // Speed calculation
                const elapsedSec = (performance.now() - startTime) / 1000;
                if (elapsedSec > 0.1) {
                  const currentSpeed = Math.round(tokenEstimate / elapsedSec);
                  el.liveSpeedometer.style.display = 'inline-flex';
                  el.liveTokensPerSec.textContent = `${currentSpeed} т/сек`;

                  if (liveCardMetric) {
                    liveCardMetric.style.display = 'inline-flex';
                    liveCardSpeed.textContent = `${currentSpeed} т/сек`;
                  }
                }

                scrollToBottom();
              }
            } catch (err) {
              if (err.message && !err.message.includes('JSON')) {
                throw err;
              }
            }
          }
        }
      }

      // Stream completed cleanly
      const totalDurationSec = ((performance.now() - startTime) / 1000);
      const finalTokensPerSec = totalDurationSec > 0 ? Math.round(tokenEstimate / totalDurationSec) : 0;

      const finalStats = {
        speed: `${finalTokensPerSec} т/сек`,
        duration: `${totalDurationSec.toFixed(1)}с`,
        tokens: tokenEstimate,
        model: state.currentModel
      };

      // Save assistant message to chat state
      placeholderMsg.content = fullAssistantText;
      placeholderMsg.stats = finalStats;
      chat.messages.push(placeholderMsg);
      chat.updatedAt = Date.now();
      saveChats();

      // Replace temporary stream bubble with final formatted markdown
      row.remove();
      appendMessageToDOM(placeholderMsg, chat.messages.length - 1, true);

    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('Генерация остановлена', 'info');
        if (fullAssistantText) {
          placeholderMsg.content = fullAssistantText + ' *(Остановлено)*';
          placeholderMsg.stats = { speed: '—', duration: 'остановлено', model: state.currentModel };
          chat.messages.push(placeholderMsg);
          saveChats();
          row.remove();
          appendMessageToDOM(placeholderMsg, chat.messages.length - 1, true);
        } else {
          row.remove();
        }
      } else {
        console.error('Generation error:', err);
        showToast(err.message, 'error');
        streamCursorSpan.remove();
        streamContentSpan.innerHTML = `<span style="color:var(--accent-rose);">❌ ${escapeHtml(err.message)}</span>`;
      }
    } finally {
      state.isGenerating = false;
      state.abortController = null;
      updateGeneratingUI(false);
    }
  }

  function updateGeneratingUI(isGenerating) {
    if (isGenerating) {
      el.sendBtn.style.display = 'none';
      el.stopGenerationBtn.style.display = 'flex';
    } else {
      el.sendBtn.style.display = 'flex';
      el.stopGenerationBtn.style.display = 'none';
      el.liveSpeedometer.style.display = 'none';
    }
  }

  // --- Auto-resize Textarea ---
  function autoResizeTextarea() {
    const area = el.chatInput;
    area.style.height = 'auto';
    area.style.height = Math.min(area.scrollHeight, 200) + 'px';
  }

  // --- Escape HTML helper ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Modal Management ---
  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
  }

  // --- Export Functions ---
  function exportChatAsMarkdown() {
    const chat = getActiveChat();
    if (!chat || chat.messages.length === 0) {
      showToast('Нет сообщений для экспорта', 'info');
      return;
    }

    let md = `# ${chat.title}\n\n`;
    md += `*Дата: ${new Date(chat.createdAt).toLocaleString('ru-RU')}*\n`;
    md += `*Модель: ${state.currentModel}*\n\n---\n\n`;

    chat.messages.forEach(m => {
      const roleName = m.role === 'user' ? '👤 Пользователь' : '🤖 Groq AI';
      md += `### ${roleName}\n\n${m.content}\n\n`;
      if (m.stats && m.stats.speed) {
        md += `> *${m.stats.speed} • ${m.stats.duration || ''} • ${m.stats.model || ''}*\n\n`;
      }
      md += `---\n\n`;
    });

    downloadFile(md, `${sanitizeFilename(chat.title)}.md`, 'text/markdown;charset=utf-8');
    showToast('Markdown успешно скачан!', 'success');
  }

  function exportChatAsJson() {
    const chat = getActiveChat();
    if (!chat) {
      showToast('Нет диалога для экспорта', 'info');
      return;
    }

    const json = JSON.stringify(chat, null, 2);
    downloadFile(json, `${sanitizeFilename(chat.title)}.json`, 'application/json;charset=utf-8');
    showToast('JSON успешно скачан!', 'success');
  }

  function copyAllChatText() {
    const chat = getActiveChat();
    if (!chat || chat.messages.length === 0) {
      showToast('Нет сообщений для копирования', 'info');
      return;
    }

    let text = `${chat.title}\n\n`;
    chat.messages.forEach(m => {
      const roleName = m.role === 'user' ? 'Пользователь' : 'Groq AI';
      text += `[${roleName}]:\n${m.content}\n\n`;
    });

    safeCopyText(text).then(() => {
      showToast('Все сообщения скопированы в буфер!', 'success');
    }).catch(() => {
      showToast('Не удалось скопировать', 'error');
    });
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function sanitizeFilename(name) {
    return (name || 'dialog').replace(/[^a-zа-яё0-9_-]/gi, '_').substring(0, 50);
  }

  // --- Mobile Sidebar Controls ---
  function openSidebar() {
    el.sidebar.classList.add('open');
    el.sidebarOverlay.classList.add('open');
  }

  function closeSidebar() {
    el.sidebar.classList.remove('open');
    el.sidebarOverlay.classList.remove('open');
  }

  // --- Event Listeners Initialization ---
  function initEvents() {
    // Mobile sidebar
    el.openSidebarBtn.addEventListener('click', openSidebar);
    el.closeSidebarBtn.addEventListener('click', closeSidebar);
    el.sidebarOverlay.addEventListener('click', closeSidebar);

    // New chat
    el.newChatBtn.addEventListener('click', createNewChat);

    // Search chats
    el.searchChatsInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderSidebarChats();
    });

    // Key button in topbar & sidebar -> open settings modal directly on key tab
    function openKeyTabSettings() {
      openModal(el.settingsModal);
      switchModalTab('tab-key');
    }
    el.headerKeyBtn.addEventListener('click', openKeyTabSettings);
    el.sidebarKeyStatus.addEventListener('click', openKeyTabSettings);

    // Welcome Screen Quick Key Save
    el.welcomeSaveKeyBtn.addEventListener('click', async () => {
      const val = el.welcomeKeyInput.value.trim();
      if (!val) {
        showToast('Введите ключ Groq', 'error');
        return;
      }
      el.welcomeSaveKeyBtn.textContent = 'Проверка...';
      el.welcomeSaveKeyBtn.disabled = true;

      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: val })
        });
        const data = await res.json();
        if (data.success) {
          state.apiKey = val;
          storage.setItem(STORAGE_KEYS.API_KEY, val);
          el.modalApiKeyInput.value = val;
          updateKeyStatusUI();
          showToast('Ключ Groq успешно подключен!', 'success');
          loadModels();
        } else {
          showToast(data.error || 'Неверный API ключ', 'error');
        }
      } catch (err) {
        showToast('Ошибка проверки ключа: ' + err.message, 'error');
      } finally {
        el.welcomeSaveKeyBtn.textContent = 'Подключить';
        el.welcomeSaveKeyBtn.disabled = false;
      }
    });

    // Starter Prompt Cards
    el.startersGrid.querySelectorAll('.starter-card').forEach(card => {
      card.addEventListener('click', () => {
        const promptText = card.getAttribute('data-prompt');
        if (promptText) {
          handleSendMessage(promptText);
        }
      });
    });

    // Input Textarea
    el.chatInput.addEventListener('input', autoResizeTextarea);
    el.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Send Button
    el.sendBtn.addEventListener('click', () => handleSendMessage());

    // Stop Button
    el.stopGenerationBtn.addEventListener('click', () => {
      if (state.abortController) {
        state.abortController.abort();
      }
    });

    // Model Picker Modal
    el.openModelPickerBtn.addEventListener('click', () => {
      renderModelPickerList();
      openModal(el.modelPickerModal);
    });
    el.closeModelPickerBtn.addEventListener('click', () => closeModal(el.modelPickerModal));
    el.modelPickerModal.addEventListener('click', (e) => {
      if (e.target === el.modelPickerModal) closeModal(el.modelPickerModal);
    });

    el.modelSearchInput.addEventListener('input', (e) => {
      renderModelPickerList(e.target.value);
    });

    // Settings Modal
    el.openSettingsBtn.addEventListener('click', () => openModal(el.settingsModal));
    el.closeSettingsBtn.addEventListener('click', () => closeModal(el.settingsModal));
    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) closeModal(el.settingsModal);
    });

    // Persona Quick chip in topbar and dock
    function openPersonaSettings() {
      openModal(el.settingsModal);
      switchModalTab('tab-params');
    }
    el.openPersonaModalBtn.addEventListener('click', openPersonaSettings);
    el.inputPersonaChip.addEventListener('click', openPersonaSettings);

    // Modal Tabs
    function switchModalTab(tabId) {
      el.settingsModal.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });
      el.settingsModal.querySelectorAll('.tab-pane').forEach(pane => {
        pane.style.display = pane.id === tabId ? 'block' : 'none';
      });
    }

    el.settingsModal.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchModalTab(btn.getAttribute('data-tab'));
      });
    });

    // Toggle API Key visibility
    el.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const type = el.modalApiKeyInput.type === 'password' ? 'text' : 'password';
      el.modalApiKeyInput.type = type;
    });

    // Test API Key
    el.testKeyBtn.addEventListener('click', async () => {
      const keyVal = el.modalApiKeyInput.value.trim();
      if (!keyVal) {
        showToast('Введите ключ для проверки', 'error');
        return;
      }
      el.testKeyBtn.querySelector('span').textContent = 'Проверяем...';
      el.testKeyBtn.disabled = true;

      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: keyVal })
        });
        const data = await res.json();
        if (data.success) {
          el.keyValidationBadge.innerHTML = `<span style="color:var(--accent-emerald);">✓ Действителен (${data.modelsCount} моделей)</span>`;
          showToast('Ключ действителен и готов к работе!', 'success');
        } else {
          el.keyValidationBadge.innerHTML = `<span style="color:var(--accent-rose);">✗ ${escapeHtml(data.error)}</span>`;
          showToast(data.error || 'Ошибка проверки ключа', 'error');
        }
      } catch (err) {
        showToast('Ошибка запроса: ' + err.message, 'error');
      } finally {
        el.testKeyBtn.querySelector('span').textContent = 'Проверить ключ';
        el.testKeyBtn.disabled = false;
      }
    });

    // Clear API Key
    el.clearKeyBtn.addEventListener('click', () => {
      if (confirm('Удалить сохраненный API-ключ из браузера?')) {
        state.apiKey = '';
        storage.removeItem(STORAGE_KEYS.API_KEY);
        el.modalApiKeyInput.value = '';
        el.keyValidationBadge.innerHTML = '';
        updateKeyStatusUI();
        showToast('API ключ удален', 'info');
      }
    });

    // Temperature Slider
    el.modalTempSlider.addEventListener('input', (e) => {
      el.tempValueBadge.textContent = e.target.value;
    });

    // Max Tokens Slider
    el.modalMaxTokensSlider.addEventListener('input', (e) => {
      el.maxTokensValueBadge.textContent = e.target.value;
    });

    // Persona Select
    el.modalPersonaSelect.addEventListener('change', (e) => {
      el.customPromptGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });

    // Save Settings Button
    el.saveSettingsBtn.addEventListener('click', () => {
      const newKey = el.modalApiKeyInput.value.trim();
      if (newKey !== state.apiKey) {
        state.apiKey = newKey;
        if (newKey) {
          storage.setItem(STORAGE_KEYS.API_KEY, newKey);
        } else {
          storage.removeItem(STORAGE_KEYS.API_KEY);
        }
        updateKeyStatusUI();
        loadModels();
      }

      state.settings.temperature = parseFloat(el.modalTempSlider.value) || 0.7;
      state.settings.maxTokens = parseInt(el.modalMaxTokensSlider.value, 10) || 4096;
      state.settings.persona = el.modalPersonaSelect.value;
      state.settings.customPrompt = el.modalCustomPrompt.value.trim();

      storage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));

      const selectedModelVal = el.modalModelSelect.value;
      if (selectedModelVal) {
        selectModel(selectedModelVal);
      }

      updatePersonaUI();
      closeModal(el.settingsModal);
      showToast('Настройки сохранены', 'success');
    });

    // Export Modal Controls
    el.exportChatBtn.addEventListener('click', () => openModal(el.exportModal));
    el.closeExportModalBtn.addEventListener('click', () => closeModal(el.exportModal));
    el.exportModal.addEventListener('click', (e) => {
      if (e.target === el.exportModal) closeModal(el.exportModal);
    });

    el.exportMarkdownBtn.addEventListener('click', () => {
      exportChatAsMarkdown();
      closeModal(el.exportModal);
    });
    el.exportJsonBtn.addEventListener('click', () => {
      exportChatAsJson();
      closeModal(el.exportModal);
    });
    el.copyAllTextBtn.addEventListener('click', () => {
      copyAllChatText();
      closeModal(el.exportModal);
    });

    // Close dropdown menus when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.msg-dropdown-menu.open').forEach(m => m.classList.remove('open'));
    });

    // Code Preview Modal
    const closePreviewBtn = document.getElementById('closeCodePreviewBtn');
    const codePreviewModal = document.getElementById('codePreviewModal');
    const previewDownloadBtn = document.getElementById('previewDownloadBtn');

    if (closePreviewBtn && codePreviewModal) {
      closePreviewBtn.addEventListener('click', () => closeModal(codePreviewModal));
      codePreviewModal.addEventListener('click', (e) => {
        if (e.target === codePreviewModal) closeModal(codePreviewModal);
      });
    }

    if (previewDownloadBtn) {
      previewDownloadBtn.addEventListener('click', () => {
        downloadFile(currentPreviewCode, currentPreviewFilename, currentPreviewMime);
        showToast(`Файл "${currentPreviewFilename}" скачан!`, 'success');
      });
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ctrl+N or Cmd+N: New chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        createNewChat();
      }
      // Escape: Close open modals
      if (e.key === 'Escape') {
        closeModal(el.settingsModal);
        closeModal(el.modelPickerModal);
        closeModal(el.exportModal);
        const codeModal = document.getElementById('codePreviewModal');
        if (codeModal) closeModal(codeModal);
        closeSidebar();
      }
    });
  }

  // --- Initial Setup ---
  async function init() {
    el.modalApiKeyInput.value = state.apiKey;
    el.modalTempSlider.value = state.settings.temperature;
    el.tempValueBadge.textContent = state.settings.temperature;
    el.modalMaxTokensSlider.value = state.settings.maxTokens;
    el.maxTokensValueBadge.textContent = state.settings.maxTokens;

    updatePersonaUI();
    updateKeyStatusUI();
    updateModelHeaderUI();

    initEvents();

    // Check status and models
    await checkServerStatus();
    await loadModels();

    // If no chats exist, create first
    if (state.chats.length === 0) {
      createNewChat();
    } else {
      renderSidebarChats();
      renderActiveChat();
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
