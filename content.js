// content.js – Web Limits Remover (MV3) - 优化版
(() => {
  'use strict';

  /* ────────────── 配置与常量 ────────────── */
  const CONFIG = {
    IGN_ATTR: 'data-wlr-ignore',
    STYLE_ID: 'wlr-base-style',
    STORAGE_KEY: 'wlrPos',
    DEFAULT_SETTINGS: { autoRemove: true, floatingCopy: false },
    BLACK_PATTERNS: [
      /.*\.youtube\.com.*/, /.*\.wikipedia\.org.*/,
      /mail\.qq\.com.*/, /translate\.google\..*/
    ],
    CLEAR_EVENTS: [
      'contextmenu', 'select', 'selectstart',
      'copy', 'cut', 'dragstart', 'mousedown', 'mouseup', 'keydown', 'keyup'
    ],
    BASE_CSS: 'html,*{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important}',
    TOAST_DURATION: 2000,
    DEBOUNCE_DELAY: 16
  };

  /* ────────────── 状态管理 ────────────── */
  class StateManager {
    constructor() {
      this.settings = { ...CONFIG.DEFAULT_SETTINGS };
      this.isBlacklisted = this.checkBlacklist();
    }

    checkBlacklist() {
      const pageKey = location.host + location.pathname;
      return CONFIG.BLACK_PATTERNS.some(pattern => pattern.test(pageKey));
    }

    updateSettings(newSettings) {
      this.settings = { ...this.settings, ...newSettings };
    }
  }

  /* ────────────── 工具函数 ────────────── */
  const Utils = {
    debounce(func, delay) {
      let timeoutId;
      return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    },

    sendMessage(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    },

    createElement(tag, attrs = {}, styles = {}) {
      const el = document.createElement(tag);
      Object.assign(el, attrs);
      Object.assign(el.style, styles);
      return el;
    },

    safeExecute(fn, errorMsg = 'Operation failed') {
      try {
        return fn();
      } catch (error) {
        console.error(`[WLR] ${errorMsg}:`, error);
        return null;
      }
    }
  };

  /* ────────────── 样式管理器 ────────────── */
  class StyleManager {
    constructor() {
      this.styleElement = null;
    }

    addBaseStyle() {
      if (this.styleElement) return;

      this.styleElement = Utils.createElement('style', {
        id: CONFIG.STYLE_ID,
        textContent: CONFIG.BASE_CSS
      });

      const target = document.head || document.documentElement;
      target?.appendChild(this.styleElement);
    }

    removeBaseStyle() {
      if (this.styleElement) {
        this.styleElement.remove();
        this.styleElement = null;
      }
    }
  }

  /* ────────────── DOM 事件清理器 ────────────── */
  class DOMCleaner {
    constructor() {
      this.processedElements = new WeakSet();
    }

    clearDOM0Events() {
      const elements = [document, ...document.getElementsByTagName('*')];
      const clearElement = (el) => {
        if (this.processedElements.has(el)) return;
        
        CONFIG.CLEAR_EVENTS.forEach(eventType => {
          const handlerKey = 'on' + eventType;
          if (typeof el[handlerKey] === 'function') {
            el[handlerKey] = null;
          }
        });
        
        this.processedElements.add(el);
      };

      elements.forEach(clearElement);
    }
  }

  /* ────────────── 悬浮按钮管理器 ────────────── */
  class FloatingButton {
    constructor() {
      this.button = null;
      this.position = { x: 0, y: 80 };
      this.isDragging = false;
      this.dragStartPos = { x: 0, y: 0 };
      this.onDragMove = Utils.debounce(this.handleDragMove.bind(this), CONFIG.DEBOUNCE_DELAY);
    }

    async loadPosition() {
      try {
        const result = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
        if (result[CONFIG.STORAGE_KEY]) {
          this.position = result[CONFIG.STORAGE_KEY];
        }
      } catch (error) {
        console.warn('[WLR] Failed to load button position:', error);
      }
    }

    async savePosition() {
      try {
        await chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: this.position });
      } catch (error) {
        console.warn('[WLR] Failed to save button position:', error);
      }
    }

    async create() {
      if (this.button) return;
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => this.create(), { once: true });
        return;
      }
      await this.loadPosition();
      const vw = document.documentElement.clientWidth;
      if (this.position.x === 0) {
        this.position.x = Math.max(0, vw - 80);
      }
      this.button = Utils.createElement('div', {
        [CONFIG.IGN_ATTR]: '1',
        textContent: '📋'
      }, {
        position: 'fixed',
        left: `${this.position.x}px`,
        top: `${this.position.y}px`,
        width: '44px',
        height: '44px',
        lineHeight: '44px',
        textAlign: 'center',
        fontSize: '21px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: '2147483647',
        boxShadow: '0 4px 12px rgba(0,0,0,.3)',
        transition: 'transform .15s'
      });
      this.attachEventListeners();
      document.body.appendChild(this.button);
    }

    remove() {
      if (this.button) {
        this.savePosition();
        this.button.remove();
        this.button = null;
      }
    }

    attachEventListeners() {
      this.button.addEventListener('mouseenter', () => {
        this.button.style.transform = 'scale(1.1)';
      });

      this.button.addEventListener('mouseleave', () => {
        this.button.style.transform = 'scale(1)';
      });

      this.button.addEventListener('mousedown', this.handleDragStart.bind(this));
      this.button.addEventListener('click', (e) => {
        this.isDragging = false;
        this.button.style.cursor = 'grab';
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
        setTimeout(() => {
          elementSelector.startSelection();
        }, 0);
      });
    }

    handleDragStart(e) {
      this.isDragging = true;
      this.dragStartPos = { x: e.clientX, y: e.clientY };
      this.button.style.cursor = 'grabbing';
      
      document.addEventListener('mousemove', this.onDragMove);
      document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    }

    handleDragMove(e) {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.dragStartPos.x;
      const deltaY = e.clientY - this.dragStartPos.y;

      this.position.x += deltaX;
      this.position.y += deltaY;

      this.dragStartPos.x = e.clientX;
      this.dragStartPos.y = e.clientY;

      this.button.style.left = `${this.position.x}px`;
      this.button.style.top = `${this.position.y}px`;
    }

    handleDragEnd() {
      this.isDragging = false;
      this.button.style.cursor = 'grab';
      
      document.removeEventListener('mousemove', this.onDragMove);
      document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
      
      this.savePosition();
    }
  }

  /* ────────────── 元素选择器 ────────────── */
  class ElementSelector {
    constructor() {
      this.isSelecting = false;
      this.overlay = null;
      this.tip = null;
      this.highlightedElement = null;
      this.boundHandlers = this.bindHandlers();
    }

    bindHandlers() {
      return {
        highlight: this.handleHighlight.bind(this),
        select: this.handleSelect.bind(this),
        keydown: this.handleKeydown.bind(this)
      };
    }

    startSelection() {
      if (this.isSelecting) return;

      this.isSelecting = true;
      document.body.style.cursor = 'crosshair';

      this.createOverlay();
      this.createTip();
      this.attachEventListeners();
    }

    stopSelection() {
      if (!this.isSelecting) return;

      this.isSelecting = false;
      document.body.style.cursor = '';
      if (window.floatingButton && window.floatingButton.button) {
        window.floatingButton.isDragging = false;
        window.floatingButton.button.style.cursor = 'grab';
        document.removeEventListener('mousemove', window.floatingButton.onDragMove);
        document.removeEventListener('mouseup', window.floatingButton.handleDragEnd?.bind(window.floatingButton));
      }
      this.clearHighlight();
      this.removeOverlay();
      this.removeTip();
      this.detachEventListeners();
    }

    createOverlay() {
      this.overlay = Utils.createElement('div', {
        [CONFIG.IGN_ATTR]: '1'
      }, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,.1)',
        zIndex: '2147483646',
        pointerEvents: 'none'
      });
      document.body.appendChild(this.overlay);
    }

    createTip() {
      this.tip = Utils.createElement('div', {
        [CONFIG.IGN_ATTR]: '1',
        textContent: '点击元素复制，ESC 取消'
      }, {
        position: 'fixed',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#333',
        color: '#fff',
        fontSize: '13px',
        padding: '6px 18px',
        borderRadius: '18px',
        zIndex: '2147483647'
      });
      document.body.appendChild(this.tip);
    }

    removeOverlay() {
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
    }

    removeTip() {
      if (this.tip) {
        this.tip.remove();
        this.tip = null;
      }
    }

    attachEventListeners() {
      document.addEventListener('mouseover', this.boundHandlers.highlight, true);
      document.addEventListener('click', this.boundHandlers.select, true);
      document.addEventListener('keydown', this.boundHandlers.keydown, true);
    }

    detachEventListeners() {
      document.removeEventListener('mouseover', this.boundHandlers.highlight, true);
      document.removeEventListener('click', this.boundHandlers.select, true);
      document.removeEventListener('keydown', this.boundHandlers.keydown, true);
    }

    handleHighlight(e) {
      this.clearHighlight();
      
      if (e.target.hasAttribute(CONFIG.IGN_ATTR)) return;
      
      this.highlightedElement = e.target;
      this.highlightedElement.style.outline = '2px solid #667eea';
    }

    handleSelect(e) {
      if (e.target.hasAttribute(CONFIG.IGN_ATTR)) {
        this.stopSelection();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      
      textCopier.copyFromElement(e.target);
      this.stopSelection();
    }

    handleKeydown(e) {
      if (e.key === 'Escape') {
        this.stopSelection();
      }
    }

    clearHighlight() {
      if (this.highlightedElement?.style) {
        this.highlightedElement.style.outline = '';
        this.highlightedElement = null;
      }
    }
  }

  /* ────────────── 文本复制器 ────────────── */
  class TextCopier {
    async copyFromElement(element) {
      const text = this.extractText(element);
      
      if (!text) {
        toastManager.show('❌ 无可复制文本', 'error');
        return;
      }

      try {
        await this.copyToClipboard(text);
        toastManager.show('✅ 已复制', 'success');
      } catch (error) {
        console.error('[WLR] Copy failed:', error);
        toastManager.show('❌ 复制失败', 'error');
      }
    }

    extractText(element) {
      const tagName = element.tagName.toLowerCase();
      
      switch (tagName) {
        case 'input':
        case 'textarea':
          return element.value;
        case 'img':
          return element.alt || element.src;
        case 'a':
          return element.textContent || element.href;
        default:
          return element.textContent || element.innerText;
      }
    }

    async copyToClipboard(text) {
      const trimmedText = text.trim();
      
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(trimmedText);
      } else {
        return this.legacyCopy(trimmedText);
      }
    }

    legacyCopy(text) {
      return new Promise((resolve, reject) => {
        const textarea = Utils.createElement('textarea', {
          value: text
        }, {
          position: 'fixed',
          left: '-9999px'
        });

        document.body.appendChild(textarea);
        textarea.select();

        try {
          const success = document.execCommand('copy');
          success ? resolve() : reject(new Error('execCommand failed'));
        } catch (error) {
          reject(error);
        } finally {
          textarea.remove();
        }
      });
    }
  }

  /* ────────────── Toast 管理器 ────────────── */
  class ToastManager {
    show(message, type = 'info') {
      const toast = this.createToast(message, type);
      document.body.appendChild(toast);
      
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
      });

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, CONFIG.TOAST_DURATION);
    }

    createToast(message, type) {
      const colors = {
        success: '#4caf50',
        error: '#f44336',
        info: '#2196f3'
      };

      return Utils.createElement('div', {
        [CONFIG.IGN_ATTR]: '1',
        textContent: message
      }, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 22px',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#fff',
        zIndex: '2147483647',
        background: colors[type] || colors.info,
        opacity: '0',
        transition: 'opacity .3s'
      });
    }
  }

  /* ────────────── 主应用程序 ────────────── */
  class WebLimitsRemover {
    constructor() {
      this.stateManager = new StateManager();
      this.styleManager = new StyleManager();
      this.domCleaner = new DOMCleaner();
      this.floatingButton = new FloatingButton();
      this.elementSelector = new ElementSelector();
      this.textCopier = new TextCopier();
      this.toastManager = new ToastManager();
      
      // 全局引用，供其他模块使用
      window.elementSelector = this.elementSelector;
      window.textCopier = this.textCopier;
      window.toastManager = this.toastManager;
      window.floatingButton = this.floatingButton;
    }

    async initialize() {
      await this.loadSettings();
      await this.floatingButton.loadPosition();
      this.setupMessageListeners();
      this.setupStorageListeners();
      this.applySettings();
    }

    async loadSettings() {
      try {
        const result = await chrome.storage.sync.get(CONFIG.DEFAULT_SETTINGS);
        this.stateManager.updateSettings(result);
      } catch (error) {
        console.warn('[WLR] Failed to load settings:', error);
      }
    }

    setupMessageListeners() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const handlers = {
          updateSettings: (req) => {
            this.stateManager.updateSettings(req.settings);
            this.applySettings();
            return { success: true };
          },
          startElementSelection: () => {
            this.elementSelector.startSelection();
            return { success: true };
          }
        };

        const handler = handlers[request.action];
        if (handler) {
          Utils.safeExecute(() => {
            const response = handler(request);
            sendResponse(response);
          }, `Failed to handle message: ${request.action}`);
        }
      });
    }

    setupStorageListeners() {
      chrome.storage.onChanged.addListener((changes) => {
        let settingsChanged = false;
        const newSettings = {};

        for (const [key, { newValue }] of Object.entries(changes)) {
          if (key in CONFIG.DEFAULT_SETTINGS) {
            newSettings[key] = newValue;
            settingsChanged = true;
          }
        }

        if (settingsChanged) {
          this.stateManager.updateSettings(newSettings);
          this.applySettings();
        }
      });
    }

    applySettings() {
      const { settings, isBlacklisted } = this.stateManager;

      if (settings.autoRemove && !isBlacklisted) {
        this.injectMainWorldScript();
        this.styleManager.addBaseStyle();
        this.domCleaner.clearDOM0Events();
      } else {
        this.styleManager.removeBaseStyle();
      }

      if (settings.floatingCopy) {
        this.floatingButton.create();
      } else {
        this.floatingButton.remove();
      }
    }

    async injectMainWorldScript() {
      try {
        await Utils.sendMessage({ action: 'injectWLR' });
      } catch (error) {
        console.warn('[WLR] Failed to inject main world script:', error);
      }
    }
  }

  /* ────────────── 启动应用 ────────────── */
  const app = new WebLimitsRemover();
  app.initialize().catch(error => {
    console.error('[WLR] Failed to initialize:', error);
  });
})();