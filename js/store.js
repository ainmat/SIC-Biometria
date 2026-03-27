// Global State Management
class Store {
  constructor() {
    this.state = {
      tickets: [],
      filters: {
        secretaria: 'Todos',
        searchTerm: '',
        status: 'Todos'
      },
      ui: {
        loading: false,
        error: null,
        lastUpdated: null
      },
      user: {
        initials: 'MC',
        name: 'Usuário'
      }
    };
    this.listeners = new Map();
    this.persistKeys = ['filters', 'user'];
  }

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(key).delete(callback);
    };
  }

  // Update state and notify listeners
  setState(updates, persist = false) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify listeners
    Object.keys(updates).forEach(key => {
      if (this.listeners.has(key)) {
        this.listeners.get(key).forEach(callback => {
          callback(this.state[key], prevState[key]);
        });
      }
    });

    // Persist to localStorage if needed
    if (persist) {
      this.persistState();
    }
  }

  // Get state slice
  getState(key) {
    return key ? this.state[key] : this.state;
  }

  // Persist state to localStorage
  persistState() {
    const persistData = {};
    this.persistKeys.forEach(key => {
      persistData[key] = this.state[key];
    });
    localStorage.setItem('sic-biometria-state', JSON.stringify(persistData));
  }

  // Load persisted state
  loadPersistedState() {
    try {
      const persisted = localStorage.getItem('sic-biometria-state');
      if (persisted) {
        const data = JSON.parse(persisted);
        this.setState(data, false);
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
  }

  // Clear all state
  clear() {
    this.state = {
      tickets: [],
      filters: { secretaria: 'Todos', searchTerm: '', status: 'Todos' },
      ui: { loading: false, error: null, lastUpdated: null },
      user: { initials: 'MC', name: 'Usuário' }
    };
    localStorage.removeItem('sic-biometria-state');
  }
}

// Create global store instance
export const store = new Store();

// Initialize with persisted data
store.loadPersistedState();

// Action creators
export const actions = {
  // Ticket actions
  setTickets: (tickets) => store.setState({ tickets }, true),
  addTicket: (ticket) => {
    const current = store.getState('tickets');
    store.setState({ tickets: [ticket, ...current] });
  },
  updateTicket: (id, updates) => {
    const current = store.getState('tickets');
    const updated = current.map(ticket => 
      ticket.id === id ? { ...ticket, ...updates } : ticket
    );
    store.setState({ tickets: updated });
  },

  // Filter actions
  setFilter: (filterType, value) => {
    const currentFilters = store.getState('filters');
    const newFilters = { ...currentFilters, [filterType]: value };
    store.setState({ filters: newFilters }, true);
  },

  // UI actions
  setLoading: (loading) => store.setState({ ui: { ...store.getState('ui'), loading } }),
  setError: (error) => store.setState({ ui: { ...store.getState('ui'), error } }),
  clearError: () => store.setState({ ui: { ...store.getState('ui'), error: null } }),
  setLastUpdated: () => store.setState({ ui: { ...store.getState('ui'), lastUpdated: new Date() } }),

  // User actions
  setUser: (user) => store.setState({ user }, true)
};

// Selectors
export const selectors = {
  getFilteredTickets: () => {
    const { tickets, filters } = store.getState();
    
    return tickets.filter(ticket => {
      // Secretaria filter
      if (filters.secretaria !== 'Todos') {
        if (filters.secretaria === 'Saúde' && ticket.secretaria !== 'SS') return false;
        if (filters.secretaria === 'Educação' && ticket.secretaria !== 'SED') return false;
        if (filters.secretaria === 'Outros' && (ticket.secretaria === 'SS' || ticket.secretaria === 'SED')) return false;
        if (filters.secretaria !== 'Saúde' && filters.secretaria !== 'Educação' && filters.secretaria !== 'Outros') {
          if (ticket.secretaria !== filters.secretaria) return false;
        }
      }
      
      // Search filter
      if (filters.searchTerm && !ticket.ticket.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filters.status !== 'Todos' && ticket.status !== filters.status) {
        return false;
      }
      
      return true;
    });
  },

  getTicketsBySecretaria: () => {
    const tickets = selectors.getFilteredTickets();
    const grouped = {};
    
    tickets.forEach(ticket => {
      const sigla = ticket.secretaria || 'Outros';
      if (!grouped[sigla]) grouped[sigla] = [];
      grouped[sigla].push(ticket);
    });
    
    return grouped;
  },

  getStats: () => {
    const tickets = selectors.getFilteredTickets();
    const total = tickets.length;
    const abertos = tickets.filter(t => t.status === 'Aberto').length;
    const andamento = tickets.filter(t => t.status === 'Em Andamento').length;
    const resolvidos = tickets.filter(t => t.status === 'Resolvido').length;
    
    return { total, abertos, andamento, resolvidos };
  }
};
