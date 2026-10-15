import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function escapeHtml(value) {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function contarPor(arr, key) {
  const m = {};
  arr.forEach((d) => { m[d[key]] = (m[d[key]] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export function normalizeStr(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchUnidade(userUnit, dbUnit) {
  if (!userUnit || !dbUnit) return false;
  const u1 = normalizeStr(userUnit);
  const u2 = normalizeStr(dbUnit);
  if (u1 === u2 || u1.includes(u2) || u2.includes(u1)) return true;
  
  const words1 = u1.split(' ').filter(w => w.length > 2);
  const words2 = u2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  let matches = 0;
  for (const w of words1) {
    if (words2.includes(w)) matches++;
  }
  
  const minWords = Math.min(words1.length, words2.length);
  return (matches / minWords) >= 0.7;
}

export function calcularAging(dataAbertura, status) {
  if (!dataAbertura) {
    return { dias: 0, nivel: 'regular', label: '—', diasTexto: '—', color: '#64748b' };
  }

  let dt;
  if (typeof dataAbertura === 'string' && dataAbertura.includes('T')) {
    dt = new Date(dataAbertura);
  } else {
    dt = new Date(String(dataAbertura) + 'T00:00:00');
  }

  if (isNaN(dt.getTime())) {
    return { dias: 0, nivel: 'regular', label: '—', diasTexto: '—', color: '#64748b' };
  }

  const encerrado = status === 'Atendimento Encerrado' || status === 'Atendimento Cancelado';
  const agora = Date.now();
  const diffMs = agora - dt.getTime();
  const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (encerrado) {
    return {
      dias,
      nivel: 'encerrado',
      label: 'Encerrado',
      diasTexto: dias === 0 ? 'Hoje' : `${dias}d`,
      color: '#64748b',
      badgeClass: 'sla-encerrado',
    };
  }

  if (dias <= 2) {
    return {
      dias,
      nivel: 'regular',
      label: 'SLA Regular',
      diasTexto: dias === 0 ? 'Hoje' : `${dias}d`,
      color: '#10B981',
      badgeClass: 'sla-regular',
    };
  }

  if (dias <= 7) {
    return {
      dias,
      nivel: 'atencao',
      label: 'SLA Atenção',
      diasTexto: `${dias}d`,
      color: '#F59E0B',
      badgeClass: 'sla-atencao',
    };
  }

  return {
    dias,
    nivel: 'critico',
    label: 'SLA Crítico (>7d)',
    diasTexto: `${dias}d`,
    color: '#EF4444',
    badgeClass: 'sla-critico',
  };
}

