// Re-exporta da lista unificada — fonte única de verdade
export {
  SECRETARIAS,
  getCor,
  getNome,
  getNomeSecretaria,
  getCorSecretaria,
} from '@/lib/secretarias';

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function formatarCompetencia(yyyymm) {
  if (!yyyymm) return '';
  const [ano, mes] = yyyymm.split('-');
  return `${MESES_CURTOS[parseInt(mes, 10) - 1]}/${ano}`;
}

export function formatarCompetenciaLonga(yyyymm) {
  if (!yyyymm) return '';
  const [ano, mes] = yyyymm.split('-');
  return `${MESES[parseInt(mes, 10) - 1]} de ${ano}`;
}
