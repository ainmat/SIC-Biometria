// Reusable UI Components
import { store, actions } from './store.js';

// Loading Component
export class LoadingSpinner {
  constructor(container, size = 'medium') {
    this.container = container;
    this.size = size;
    this.render();
  }

  render() {
    const sizes = {
      small: '16px',
      medium: '24px',
      large: '32px'
    };

    this.element = document.createElement('div');
    this.element.className = 'loading-spinner';
    this.element.innerHTML = `
      <div class="spinner" style="width: ${sizes[this.size]}; height: ${sizes[this.size]};">
        <div class="spinner-circle"></div>
      </div>
    `;
    
    this.container.appendChild(this.element);
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// Error Component
export class ErrorMessage {
  constructor(container, message, onRetry = null) {
    this.container = container;
    this.message = message;
    this.onRetry = onRetry;
    this.render();
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'error-message';
    this.element.innerHTML = `
      <div class="error-content">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span class="error-text">${this.message}</span>
        ${this.onRetry ? '<button class="retry-btn" onclick="this.parentElement.parentElement.retry()">Tentar Novamente</button>' : ''}
      </div>
    `;

    if (this.onRetry) {
      this.element.retry = this.onRetry;
    }

    this.container.appendChild(this.element);
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// Toast Notification Component
export class Toast {
  static show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Add to DOM
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Modal Component
export class Modal {
  constructor(title, content, options = {}) {
    this.title = title;
    this.content = content;
    this.options = {
      size: 'medium',
      closable: true,
      ...options
    };
    this.render();
  }

  render() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal modal-' + this.options.size;
    
    this.modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${this.title}</h3>
        ${this.options.closable ? '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button>' : ''}
      </div>
      <div class="modal-body">
        ${this.content}
      </div>
    `;

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Close on overlay click
    if (this.options.closable) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.remove();
        }
      });
    }

    // Close on escape
    this.handleEscape = (e) => {
      if (e.key === 'Escape' && this.options.closable) {
        this.remove();
      }
    };
    document.addEventListener('keydown', this.handleEscape);
  }

  remove() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.classList.add('hide');
      setTimeout(() => {
        this.overlay.remove();
        document.removeEventListener('keydown', this.handleEscape);
      }, 300);
    }
  }
}

// KPI Card Component
export class KPICard {
  constructor(container, data) {
    this.container = container;
    this.data = data;
    this.render();
  }

  render() {
    const { title, value, change, icon, color } = this.data;
    
    this.element = document.createElement('div');
    this.element.className = 'kpi-card';
    
    const changeHtml = change ? `
      <div class="kpi-change ${change >= 0 ? 'positive' : 'negative'}">
        ${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}%
      </div>
    ` : '';

    this.element.innerHTML = `
      <div class="kpi-header">
        <div class="kpi-icon" style="color: ${color}">
          ${icon}
        </div>
        <div class="kpi-title">${title}</div>
      </div>
      <div class="kpi-value">${value}</div>
      ${changeHtml}
    `;

    this.container.appendChild(this.element);
  }

  update(newData) {
    this.data = { ...this.data, ...newData };
    this.render();
  }
}
