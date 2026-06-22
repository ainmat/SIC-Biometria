// Re-exporta da lista unificada — fonte única de verdade
export {
  MAPA_SECRETARIA,
  COR_SEC_FOLHA,
  getCor,
  getNome,
  resolverSigla,
  SECRETARIAS,
} from '@/lib/secretarias';

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function fmtCompetencia(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${MESES_CURTOS[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

export function competenciaParaDate(mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}
