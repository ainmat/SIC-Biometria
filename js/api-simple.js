// API Simplificada - Versão sem modules para compatibilidade

// Configuração global
const CONFIG = window.CONFIG || {
  supabase: {
    url: 'https://placeholder.supabase.co',
    anonKey: 'placeholder-key'
  }
};

// Funções de utilidade
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

// Actions de fallback
const actions = {
  setTickets: () => {},
  addTicket: () => {},
  updateTicket: () => {},
  setLoading: () => {},
  setError: () => {},
  clearError: () => {},
  setLastUpdated: () => {}
};

// Enhanced Supabase Client
class SupabaseClient {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Dynamic import de Supabase
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
      
      this.client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        realtime: {
          params: {
            eventsPerSecond: 2
          }
        }
      });
      
      this.initialized = true;
    } catch (error) {
      throw new AppError('Failed to initialize Supabase client', 'SUPABASE_INIT_ERROR');
    }
  }

  async getTickets() {
    await this.initialize();
    
    try {
      const { data, error } = await this.client
        .from('chamados')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map(ticket => ({
        ...ticket,
        ticket: sanitizeInput(ticket.ticket),
        unidade: sanitizeInput(ticket.unidade),
        problema: sanitizeInput(ticket.problema),
        responsavel: sanitizeInput(ticket.responsavel)
      }));
    } catch (error) {
      throw new AppError(`Failed to fetch tickets: ${error.message}`, 'FETCH_ERROR');
    }
  }

  async getEquipments() {
    await this.initialize();
    
    try {
      const { data, error } = await this.client
        .from('equipamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map(equipment => ({
        ...equipment,
        nome: sanitizeInput(equipment.nome),
        tipo: sanitizeInput(equipment.tipo),
        localizacao: sanitizeInput(equipment.localizacao),
        modelo: sanitizeInput(equipment.modelo),
        numero_serie: sanitizeInput(equipment.numero_serie),
        secretaria: sanitizeInput(equipment.secretaria),
        responsavel: sanitizeInput(equipment.responsavel)
      }));
    } catch (error) {
      throw new AppError(`Failed to fetch equipments: ${error.message}`, 'FETCH_ERROR');
    }
  }

  async subscribeToEquipments(callback) {
    await this.initialize();
    
    try {
      return this.client
        .channel('equipamentos_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'equipamentos' },
          (payload) => {
            if (callback && typeof callback === 'function') {
              callback(payload);
            }
          }
        )
        .subscribe();
    } catch (error) {
      throw new AppError(`Failed to subscribe to equipments: ${error.message}`, 'SUBSCRIPTION_ERROR');
    }
  }
}

// API Service Layer
class ApiService {
  constructor() {
    this.supabase = new SupabaseClient();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  async fetchEquipments(forceRefresh = false) {
    const cacheKey = 'equipments';
    
    if (!forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const equipments = await this.supabase.getEquipments();
      
      this.setCache(cacheKey, equipments);
      
      return equipments;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async subscribeToEquipmentsRealtime(callback) {
    try {
      return await this.supabase.subscribeToEquipments((payload) => {
        this.cache.delete('equipments');
        
        if (callback && typeof callback === 'function') {
          callback(payload);
        }
      });
    } catch (error) {
      console.error('Equipment Subscription Error:', error);
      throw error;
    }
  }
}

// Criar instância global
window.api = new ApiService();

// Export funções globais
window.fetchEquipments = (forceRefresh) => window.api.fetchEquipments(forceRefresh);
window.subscribeToEquipmentsRealtime = (callback) => window.api.subscribeToEquipmentsRealtime(callback);

console.log('✅ API simplificada carregada com sucesso');
