// Configuration Manager - Versão híbrida (funciona com e sem modules)

// Verificar se estamos em ambiente de módulo
const isModuleContext = typeof import.meta !== 'undefined';

// Função segura para obter variáveis de ambiente
function getEnvVar(key, defaultValue) {
  if (isModuleContext && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  // Fallback para ambiente sem módulos
  return defaultValue;
}

// Configuração
const CONFIG = {
  supabase: {
    url: getEnvVar('VITE_SUPABASE_URL', 'https://placeholder.supabase.co'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY', 'placeholder-key')
  },
  api: {
    baseUrl: getEnvVar('VITE_API_BASE_URL', '/api')
  },
  app: {
    name: 'SIC-Biometria',
    version: '2.0.0',
    environment: getEnvVar('NODE_ENV', 'development')
  }
};

// Tornar disponível globalmente para não-modules
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// Security utilities
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

const validateTicketNumber = (ticket) => {
  const sanitized = sanitizeInput(ticket);
  return /^[A-Z0-9-]+$/.test(sanitized) ? sanitized : null;
};

// Error boundaries
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

const handleAsyncError = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Export para modules (sempre disponível)
export { CONFIG, sanitizeInput, validateTicketNumber, AppError, handleAsyncError };
