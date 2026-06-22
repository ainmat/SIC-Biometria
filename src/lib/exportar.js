// Utilitário de exportação CSV — abre corretamente no Excel (BOM + separador ;)

function escaparCSV(valor) {
  const s = String(valor ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function baixarCSV(nomeArquivo, cabecalhos, linhas) {
  const sep = ';';
  const conteudo = [
    cabecalhos.map(escaparCSV).join(sep),
    ...linhas.map(linha => linha.map(escaparCSV).join(sep)),
  ].join('\r\n');

  const bom = '﻿'; // BOM para Excel reconhecer UTF-8
  const blob = new Blob([bom + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
