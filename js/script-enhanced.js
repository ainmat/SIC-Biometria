// Enhanced Main Script
import { CONFIG, sanitizeInput } from './config.js';
import { store, actions, selectors } from './store.js';
import { fetchTickets, subscribeToRealtime } from './api.js';
import { LoadingSpinner, ErrorMessage, Toast, KPICard } from './components.js';

// Application Controller
class DashboardController {
  constructor() {
    this.loadingSpinner = null;
    this.errorMessage = null;
    this.kpiCards = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.setupEventListeners();
      await this.loadData();
      this.setupRealtime();
      this.render();
      
      this.initialized = true;
      console.log('Dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      this.handleError(error);
    }
  }

  setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        actions.setFilter('secretaria', filter);
        this.render();
      });
    });

    // Refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Subscribe to store changes
    store.subscribe('tickets', () => this.render());
    store.subscribe('filters', () => this.render());
    store.subscribe('ui', (ui) => {
      this.updateUIState(ui);
    });
  }

  async loadData() {
    try {
      await fetchTickets();
    } catch (error) {
      throw new Error(`Failed to load data: ${error.message}`);
    }
  }

  async refreshData() {
    try {
      await fetchTickets(true); // Force refresh
      Toast.show('Dados atualizados com sucesso', 'success');
    } catch (error) {
      Toast.show('Erro ao atualizar dados', 'error');
    }
  }

  setupRealtime() {
    try {
      subscribeToRealtime();
    } catch (error) {
      console.warn('Realtime subscription failed:', error);
    }
  }

  render() {
    this.renderKPIs();
    this.renderCharts();
    this.updateDate();
  }

  renderKPIs() {
    const stats = selectors.getStats();
    const kpiContainer = document.querySelector('.kpi-container');
    
    if (!kpiContainer) return;

    // Clear existing KPIs
    kpiContainer.innerHTML = '';

    // Create KPI cards
    const kpis = [
      {
        title: 'Total de Chamados',
        value: stats.total,
        change: 5.2,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>',
        color: '#3b82f6'
      },
      {
        title: 'Abertos',
        value: stats.abertos,
        change: -2.1,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/></svg>',
        color: '#ef4444'
      },
      {
        title: 'Em Andamento',
        value: stats.andamento,
        change: 8.7,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        color: '#f59e0b'
      },
      {
        title: 'Resolvidos',
        value: stats.resolvidos,
        change: 12.3,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        color: '#10b981'
      }
    ];

    kpis.forEach(kpi => {
      new KPICard(kpiContainer, kpi);
    });
  }

  renderCharts() {
    const ticketsBySecretaria = selectors.getTicketsBySecretaria();
    this.renderSecretariaChart(ticketsBySecretaria);
    this.renderTrendChart();
  }

  renderSecretariaChart(data) {
    const canvas = document.getElementById('secretariaChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = Object.keys(data);
    const values = labels.map(key => data[key].length);

    // Simple bar chart implementation
    this.drawBarChart(ctx, labels, values, 'Chamados por Secretaria');
  }

  renderTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const tickets = selectors.getFilteredTickets();
    
    // Generate trend data (last 7 days)
    const trendData = this.generateTrendData(tickets);
    
    this.drawLineChart(ctx, trendData.labels, trendData.values, 'Tendência 7 Dias');
  }

  drawBarChart(ctx, labels, values, title) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find max value
    const maxValue = Math.max(...values);
    const barWidth = chartWidth / labels.length * 0.6;
    const barSpacing = chartWidth / labels.length;

    // Draw bars
    labels.forEach((label, index) => {
      const value = values[index];
      const barHeight = (value / maxValue) * chartHeight;
      const x = padding + index * barSpacing + (barSpacing - barWidth) / 2;
      const y = height - padding - barHeight;

      // Bar
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, y, barWidth, barHeight);

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Sora';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth / 2, height - padding + 20);
      
      // Value
      ctx.fillText(value, x + barWidth / 2, y - 5);
    });
  }

  drawLineChart(ctx, labels, values, title) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(...values);
    const pointSpacing = chartWidth / (labels.length - 1);

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    labels.forEach((label, index) => {
      const value = values[index];
      const x = padding + index * pointSpacing;
      const y = height - padding - (value / maxValue) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    labels.forEach((label, index) => {
      const value = values[index];
      const x = padding + index * pointSpacing;
      const y = height - padding - (value / maxValue) * chartHeight;

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Sora';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, height - padding + 20);
    });
  }

  generateTrendData(tickets) {
    const days = 7;
    const labels = [];
    const values = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      labels.push(dateStr);
      
      // Count tickets for this day (simplified)
      const dayTickets = tickets.filter(ticket => {
        const ticketDate = new Date(ticket.created_at);
        return ticketDate.toDateString() === date.toDateString();
      });
      
      values.push(dayTickets.length);
    }

    return { labels, values };
  }

  updateDate() {
    const dateElement = document.getElementById('topbar-date');
    if (!dateElement) return;

    const now = new Date();
    const tickets = store.getState('tickets');
    const count = tickets.length;
    
    dateElement.textContent = `Atualizado em ${now.toLocaleDateString('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })} · ${count} registros`;
  }

  updateUIState(ui) {
    // Show/hide loading
    if (ui.loading) {
      this.showLoading();
    } else {
      this.hideLoading();
    }

    // Show/hide error
    if (ui.error) {
      this.showError(ui.error);
    } else {
      this.hideError();
    }
  }

  showLoading() {
    const container = document.querySelector('.content');
    if (container && !this.loadingSpinner) {
      this.loadingSpinner = new LoadingSpinner(container, 'large');
    }
  }

  hideLoading() {
    if (this.loadingSpinner) {
      this.loadingSpinner.remove();
      this.loadingSpinner = null;
    }
  }

  showError(message) {
    const container = document.querySelector('.content');
    if (container && !this.errorMessage) {
      this.errorMessage = new ErrorMessage(container, message, () => this.refreshData());
    }
  }

  hideError() {
    if (this.errorMessage) {
      this.errorMessage.remove();
      this.errorMessage = null;
    }
  }

  handleError(error) {
    console.error('Dashboard error:', error);
    Toast.show(error.message, 'error');
    actions.setError(error.message);
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new DashboardController();
  dashboard.initialize();
});

// Export for global access
window.Dashboard = DashboardController;
