const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let dados = [];

const COR_SEC = {
  // Secretarias Municipais (Administração Direta)
  'SA': '#94a3b8',        // Secretaria de Administração
  'SAS': '#10b981',       // Secretaria de Assistência Social
  'SECOM': '#38bdf8',     // Secretaria de Comunicação
  'SCULT': '#c084fc',     // Secretaria de Cultura
  'SETIDE': '#22d3ee',    // Secretaria de Tecnologia, Inovação e Desenvolvimento Econômico
  'SED': '#3b82f6',       // Secretaria de Educação
  'SETR': '#4ade80',      // Secretaria de Emprego, Trabalho e Renda
  'SEREL': '#fb923c',     // Secretaria de Esporte, Recreação e Lazer
  'SF': '#2dd4bf',        // Secretaria de Finanças
  'SEGOV': '#6366f1',     // Secretaria de Governo
  'SEHAB': '#f472b6',     // Secretaria de Habitação
  'SEMARH': '#15803d',    // Secretaria de Meio Ambiente e Recursos Hídricos
  'SEPLAG': '#818cf8',    // Secretaria de Planejamento e Gestão
  'SS': '#ef4444',        // Secretaria de Saúde
  'SECONTRU': '#475569',  // Secretaria de Segurança e Controle Urbano
  'SSO': '#fbbf24',       // Secretaria de Serviços e Obras
  'SETRAN': '#f87171',    // Secretaria de Transportes e Mobilidade Urbana
  'SEFAM': '#a78bfa',     // Secretaria da Família, Cidadania e Segurança Alimentar
  
  // Secretarias Executivas
  'SECOL': '#64748b',     // Secretaria Executiva de Compras e Licitações
  'SEIJ': '#fb7185',      // Secretaria Executiva da Infância e Juventude
  'SEPCD': '#86efac',     // Secretaria Executiva da Pessoa com Deficiência
  'SEMUD': '#e879f9',     // Secretaria Executiva de Política para Mulheres e Promoção da Diversidade
  'SEPPIR': '#78350f',    // Secretaria Executiva de Políticas da Promoção da Igualdade Racial
  'SELCICUS': '#4b5563',  // Secretaria Executiva de Licenciamento e Cadastro Imobiliário e Controle do Uso do Solo
  
  // Órgãos de Gabinete e Controle
  'GP': '#1e293b',        // Gabinete do Prefeito
  'GVP': '#334155',       // Gabinete do Vice-Prefeito
  'SCC': '#0f172a',       // Casa Civil
  'PGM': '#1e1b4b',       // Procuradoria Geral do Município
  'CGM': '#374151',       // Controladoria Geral do Município
  'OGM': '#4b5563',       // Ouvidoria Geral do Município
  'GCM': '#1e3a8a',       // Guarda Civil Municipal
  'Defesa Civil': '#ea580c' // Coordenadoria da Defesa Civil
};

function fmtDate(d){
  const dt = new Date(d+'T00:00:00');
  return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
}

function escapeHtml(value){
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function carregar(){
  const {data,error} = await _sb.from('chamados').select('*').order('ticket',{ascending:false});
  if(error){console.error(error);return;}
  dados = data;
  render();
}

function getUnidadesComMultiplosChamados(){
  // Agrupar chamados por unidade
  const chamadosPorUnidade = {};
  
  dados.forEach(chamado => {
    const unidade = chamado.unidade || 'Unidade Não Informada';
    if (!chamadosPorUnidade[unidade]) {
      chamadosPorUnidade[unidade] = [];
    }
    chamadosPorUnidade[unidade].push(chamado);
  });
  
  // Filtrar apenas unidades com mais de um chamado
  const unidadesComMultiplos = Object.entries(chamadosPorUnidade)
    .filter(([unidade, chamados]) => chamados.length > 1)
    .map(([unidade, chamados]) => ({
      unidade,
      chamados: chamados.sort((a, b) => b.ticket - a.ticket), // Ordenar por ticket decrescente
      totalChamados: chamados.length,
      secretaria: chamados[0].secretaria,
      chamadosAbertos: chamados.filter(c => (c.status || 'Aguardando Atendimento') !== 'Atendimento Encerrado').length
    }))
    .sort((a, b) => {
      // Colocar "NÃO IDENTIFICADO" por último
      const aIsNaoIdentificado = a.unidade.toUpperCase().includes('NÃO IDENTIFICADO') || a.unidade.toUpperCase().includes('UNIDADE NÃO INFORMADA');
      const bIsNaoIdentificado = b.unidade.toUpperCase().includes('NÃO IDENTIFICADO') || b.unidade.toUpperCase().includes('UNIDADE NÃO INFORMADA');
      
      if (aIsNaoIdentificado && !bIsNaoIdentificado) return 1;
      if (!aIsNaoIdentificado && bIsNaoIdentificado) return -1;
      
      // Ordenar por total de chamados decrescente para as outras unidades
      return b.totalChamados - a.totalChamados;
    });
  
  return unidadesComMultiplos;
}

function render(){
  const unidadesComMultiplos = getUnidadesComMultiplosChamados();
  const totalUnidades = unidadesComMultiplos.length;
  const totalChamados = unidadesComMultiplos.reduce((sum, unidade) => sum + unidade.totalChamados, 0);

  document.getElementById('topbar-date').textContent =
    `Atualizado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · ${totalUnidades} unidades · ${totalChamados} chamados`;

  const container = document.getElementById('unidades-container');
  
  if(unidadesComMultiplos.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted)">
        <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3">✓</div>
        <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px">Nenhuma unidade crítica encontrada</div>
        <div style="font-size: 12px">Não há unidades com múltiplos chamados em aberto no período.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = unidadesComMultiplos.map((unidade, index) => {
    const cor = COR_SEC[unidade.secretaria] || '#64748b';
    const dadosChamados = encodeURIComponent(JSON.stringify(unidade.chamados));
    const unidadeId = `unidade-${index}`;
    
    return `
      <div class="unidade-card">
        <div class="unidade-header">
          <div>
            <div class="unidade-nome">${escapeHtml(unidade.unidade)}</div>
            <div class="unidade-secretaria" style="color: ${cor}">${unidade.secretaria}</div>
          </div>
          <div class="unidade-stats">
            <div class="stat-badge" style="background: #ef4444">
              ${unidade.totalChamados} chamados
            </div>
            <div class="stat-badge" style="background: #f59e0b">
              ${unidade.chamadosAbertos} em aberto
            </div>
            ${unidade.chamados.length > 3 ? `
              <button class="expand-btn" onclick="toggleUnidade('${unidadeId}')" style="background: var(--accent); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">
                <span id="${unidadeId}-text">Ver todos</span>
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="chamados-list" id="${unidadeId}" style="${unidade.chamados.length > 3 ? 'max-height: 400px; overflow-y: auto;' : ''}">
          ${unidade.chamados.map(chamado => {
            const statusLimpo = chamado.status || 'Aguardando Atendimento';
            const statusClass = statusLimpo === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto';
            const statusBg = statusLimpo === 'Atendimento Encerrado' ? '#10b981' : '#ef4444';
            const dadosChamado = encodeURIComponent(JSON.stringify(chamado));
            
            return `
              <div class="chamado-item" onclick="abrirChamado('${dadosChamado}')" title="Clique para ver detalhes">
                <div class="chamado-item-header">
                  <div class="chamado-ticket">#${chamado.ticket}</div>
                  <div class="chamado-status" style="background: ${statusBg}20; color: ${statusBg}; border: 1px solid ${statusBg}40">
                    ${statusLimpo}
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--sub); margin-bottom: 4px;">
                  ${escapeHtml(chamado.motivo)}
                </div>
                <div class="chamado-info">
                  <div>Abertura: ${fmtDate(chamado.data_abertura)}</div>
                  <div>Status: ${statusLimpo}</div>
                  <div style="text-align: right; color: var(--muted);">
                    ${chamado.problema ? chamado.problema.substring(0, 50) + '...' : '—'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Função para expandir/colapsar lista de chamados da unidade
function toggleUnidade(unidadeId) {
  const chamadosList = document.getElementById(unidadeId);
  const buttonText = document.getElementById(`${unidadeId}-text`);
  
  if (chamadosList.style.maxHeight === 'none') {
    // Colapsar
    chamadosList.style.maxHeight = '400px';
    buttonText.textContent = 'Ver todos';
  } else {
    // Expandir
    chamadosList.style.maxHeight = 'none';
    buttonText.textContent = 'Minimizar';
  }
}

// Modal de detalhes do chamado
function abrirChamado(encodedData){
  const overlay = document.getElementById('chamado-modal-overlay');
  const content = document.getElementById('chamado-modal-content');
  const chamado = JSON.parse(decodeURIComponent(encodedData));
  const statusLimpo = chamado.status || 'Aguardando Atendimento';
  const statusClass = statusLimpo === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto';

  content.innerHTML = `
    <div class="chamado-modal-grid">
      <div class="chamado-modal-item">
        <div class="chamado-modal-label">Ticket</div>
        <div class="chamado-modal-value">#${escapeHtml(chamado.ticket)}</div>
      </div>
      <div class="chamado-modal-item">
        <div class="chamado-modal-label">Status</div>
        <div class="chamado-modal-value"><span class="badge ${statusClass}" style="font-size:10px">${escapeHtml(statusLimpo)}</span></div>
      </div>
      <div class="chamado-modal-item">
        <div class="chamado-modal-label">Unidade</div>
        <div class="chamado-modal-value">${escapeHtml(chamado.unidade)}</div>
      </div>
      <div class="chamado-modal-item">
        <div class="chamado-modal-label">Secretaria</div>
        <div class="chamado-modal-value">${escapeHtml(chamado.secretaria)}</div>
      </div>
      <div class="chamado-modal-item">
        <div class="chamado-modal-label">Motivo</div>
        <div class="chamado-modal-value">${escapeHtml(chamado.motivo)}</div>
      </div>
      <div class="chamado-modal-item">
        <div class="chamado-modal-label">Data de Abertura</div>
        <div class="chamado-modal-value">${escapeHtml(chamado.data_abertura ? fmtDate(chamado.data_abertura) : '—')}</div>
      </div>
    </div>
    <div class="chamado-modal-item">
      <div class="chamado-modal-label">Descrição</div>
      <div class="chamado-modal-desc">${escapeHtml(chamado.problema)}</div>
    </div>
  `;

  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
}

function fecharChamadoModal(){
  const overlay = document.getElementById('chamado-modal-overlay');
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
}

window.abrirChamado = abrirChamado;
window.toggleUnidade = toggleUnidade;

document.getElementById('chamado-modal-close').addEventListener('click', fecharChamadoModal);
document.getElementById('chamado-modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'chamado-modal-overlay') fecharChamadoModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharChamadoModal();
});

// Realtime
_sb.channel('sic-rt')
  .on('postgres_changes',{event:'*',schema:'public',table:'chamados'},()=>carregar())
  .subscribe();

carregar();
