// Store Tests
import { store, actions, selectors } from '../js/store.js';

describe('Store', () => {
  beforeEach(() => {
    store.clear();
  });

  test('should initialize with default state', () => {
    const state = store.getState();
    expect(state).toHaveProperty('tickets');
    expect(state).toHaveProperty('filters');
    expect(state).toHaveProperty('ui');
    expect(state).toHaveProperty('user');
  });

  test('should set tickets', () => {
    const tickets = [
      { id: 1, ticket: 'TEST-001', secretaria: 'SS' }
    ];
    
    actions.setTickets(tickets);
    
    const state = store.getState('tickets');
    expect(state).toEqual(tickets);
  });

  test('should add ticket', () => {
    const initialTicket = { id: 1, ticket: 'TEST-001' };
    actions.setTickets([initialTicket]);
    
    const newTicket = { id: 2, ticket: 'TEST-002' };
    actions.addTicket(newTicket);
    
    const state = store.getState('tickets');
    expect(state).toHaveLength(2);
    expect(state[0]).toEqual(newTicket); // Should be at the beginning
  });

  test('should update filter', () => {
    actions.setFilter('secretaria', 'Saúde');
    
    const filters = store.getState('filters');
    expect(filters.secretaria).toBe('Saúde');
  });
});

describe('Selectors', () => {
  beforeEach(() => {
    store.clear();
    actions.setTickets([
      { id: 1, ticket: 'TEST-001', secretaria: 'SS', status: 'Aberto' },
      { id: 2, ticket: 'TEST-002', secretaria: 'SED', status: 'Resolvido' },
      { id: 3, ticket: 'TEST-003', secretaria: 'SS', status: 'Em Andamento' }
    ]);
  });

  test('should get filtered tickets by secretaria', () => {
    actions.setFilter('secretaria', 'Saúde');
    
    const filtered = selectors.getFilteredTickets();
    expect(filtered).toHaveLength(2);
    expect(filtered.every(t => t.secretaria === 'SS')).toBe(true);
  });

  test('should get tickets by secretaria grouped', () => {
    const grouped = selectors.getTicketsBySecretaria();
    
    expect(grouped).toHaveProperty('SS');
    expect(grouped).toHaveProperty('SED');
    expect(grouped.SS).toHaveLength(2);
    expect(grouped.SED).toHaveLength(1);
  });

  test('should calculate stats correctly', () => {
    const stats = selectors.getStats();
    
    expect(stats.total).toBe(3);
    expect(stats.abertos).toBe(1);
    expect(stats.andamento).toBe(1);
    expect(stats.resolvidos).toBe(1);
  });
});
