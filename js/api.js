import { CONFIG, sanitizeInput, AppError } from './config.js';
import { actions } from './store.js';

// Enhanced Supabase Client
class SupabaseClient {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Dynamic import of Supabase
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
      
      // Sanitize data
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

  async subscribeToTickets(callback) {
    await this.initialize();
    
    try {
      return this.client
        .channel('chamados_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'chamados' },
          (payload) => {
            // Handle different event types
            if (payload.eventType === 'INSERT') {
              actions.addTicket(payload.new);
            } else if (payload.eventType === 'UPDATE') {
              actions.updateTicket(payload.new.id, payload.new);
            } else if (payload.eventType === 'DELETE') {
              // Handle deletion if needed
            }
            actions.setLastUpdated();
          }
        )
        .subscribe();
    } catch (error) {
      throw new AppError(`Failed to subscribe to tickets: ${error.message}`, 'SUBSCRIPTION_ERROR');
    }
  }

  async updateTicketStatus(ticketId, status) {
    await this.initialize();
    
    try {
      const { error } = await this.client
        .from('chamados')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;
      
      return true;
    } catch (error) {
      throw new AppError(`Failed to update ticket: ${error.message}`, 'UPDATE_ERROR');
    }
  }

  // Equipment methods
  async getEquipments() {
    await this.initialize();
    
    try {
      const { data, error } = await this.client
        .from('equipamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Sanitize data
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

  async createEquipment(equipmentData) {
    await this.initialize();
    
    try {
      const { data, error } = await this.client
        .from('equipamentos')
        .insert([{
          ...equipmentData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      
      return data[0];
    } catch (error) {
      throw new AppError(`Failed to create equipment: ${error.message}`, 'CREATE_ERROR');
    }
  }

  async updateEquipment(id, equipmentData) {
    await this.initialize();
    
    try {
      const { data, error } = await this.client
        .from('equipamentos')
        .update({
          ...equipmentData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      
      return data[0];
    } catch (error) {
      throw new AppError(`Failed to update equipment: ${error.message}`, 'UPDATE_ERROR');
    }
  }

  async deleteEquipment(id) {
    await this.initialize();
    
    try {
      const { error } = await this.client
        .from('equipamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      return true;
    } catch (error) {
      throw new AppError(`Failed to delete equipment: ${error.message}`, 'DELETE_ERROR');
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
            callback(payload);
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

  // Cache management
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

  // API methods with caching and error handling
  async fetchTickets(forceRefresh = false) {
    const cacheKey = 'tickets';
    
    if (!forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        actions.setTickets(cached);
        return cached;
      }
    }

    try {
      actions.setLoading(true);
      actions.clearError();
      
      const tickets = await this.supabase.getTickets();
      
      this.setCache(cacheKey, tickets);
      actions.setTickets(tickets);
      actions.setLastUpdated();
      
      return tickets;
    } catch (error) {
      console.error('API Error:', error);
      actions.setError(error.message);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }

  async subscribeToRealtime() {
    try {
      return await this.supabase.subscribeToTickets();
    } catch (error) {
      console.error('Subscription Error:', error);
      actions.setError('Failed to enable real-time updates');
    }
  }

  async updateTicketStatus(ticketId, status) {
    try {
      await this.supabase.updateTicketStatus(ticketId, status);
      
      // Update local state optimistically
      actions.updateTicket(ticketId, { status });
      
      // Clear cache to force refresh
      this.cache.delete('tickets');
      
      return true;
    } catch (error) {
      console.error('Update Error:', error);
      actions.setError(error.message);
      throw error;
    }
  }

  // Utility methods
  async retryFailedRequest(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  // Equipment API methods
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

  async createEquipment(equipmentData) {
    try {
      const equipment = await this.supabase.createEquipment(equipmentData);
      
      // Clear cache to force refresh
      this.cache.delete('equipments');
      
      return equipment;
    } catch (error) {
      console.error('Create Error:', error);
      throw error;
    }
  }

  async updateEquipment(id, equipmentData) {
    try {
      const equipment = await this.supabase.updateEquipment(id, equipmentData);
      
      // Clear cache to force refresh
      this.cache.delete('equipments');
      
      return equipment;
    } catch (error) {
      console.error('Update Error:', error);
      throw error;
    }
  }

  async deleteEquipment(id) {
    try {
      await this.supabase.deleteEquipment(id);
      
      // Clear cache to force refresh
      this.cache.delete('equipments');
      
      return true;
    } catch (error) {
      console.error('Delete Error:', error);
      throw error;
    }
  }

  async subscribeToEquipmentsRealtime(callback) {
    try {
      return await this.supabase.subscribeToEquipments((payload) => {
        // Clear cache on any change
        this.cache.delete('equipments');
        
        // Handle different event types
        if (payload.eventType === 'INSERT') {
          console.log('New equipment added:', payload.new);
        } else if (payload.eventType === 'UPDATE') {
          console.log('Equipment updated:', payload.new);
        } else if (payload.eventType === 'DELETE') {
          console.log('Equipment deleted:', payload.old);
        }
        
        // Call the provided callback if it exists
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

// Create singleton instance
export const api = new ApiService();

// Export convenience methods
export const fetchTickets = (forceRefresh) => api.fetchTickets(forceRefresh);
export const subscribeToRealtime = () => api.subscribeToRealtime();
export const updateTicketStatus = (id, status) => api.updateTicketStatus(id, status);

// Equipment exports
export const fetchEquipments = (forceRefresh) => api.fetchEquipments(forceRefresh);
export const createEquipment = (equipmentData) => api.createEquipment(equipmentData);
export const updateEquipment = (id, equipmentData) => api.updateEquipment(id, equipmentData);
export const deleteEquipment = (id) => api.deleteEquipment(id);
export const subscribeToEquipmentsRealtime = (callback) => api.subscribeToEquipmentsRealtime(callback);
