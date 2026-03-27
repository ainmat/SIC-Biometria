// Configuration Manager - Versão compatível sem import.meta

// Configuração com credenciais reais do projeto
window.CONFIG = {
  supabase: {
    url: 'https://iemysploewouodsoevyv.supabase.co',
    anonKey: 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y'
  },
  api: {
    baseUrl: '/api'
  },
  app: {
    name: 'SIC-Biometria',
    version: '2.0.0',
    environment: 'development'
  }
};

console.log('✅ Configuração carregada com credenciais reais');

// Security utilities
window.sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

window.validateTicketNumber = (ticket) => {
  const sanitized = window.sanitizeInput(ticket);
  return /^[A-Z0-9-]+$/.test(sanitized) ? sanitized : null;
};

// Error boundaries
window.AppError = class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
};

window.handleAsyncError = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
