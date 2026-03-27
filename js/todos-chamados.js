const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let dados = [], filtroSecretaria = 'Todos', filtroMotivo = 'Todos', filtroStatus = 'Todos', pesquisa = '';

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

function filtrado(){
  let resultado = dados;
  
  // Aplicar filtro de secretaria
  if(filtroSecretaria!=='Todos'){
    if(filtroSecretaria==='Saúde') resultado = resultado.filter(d=>d.secretaria==='SS');
    else if(filtroSecretaria==='Educação') resultado = resultado.filter(d=>d.secretaria==='SED');
    else if(filtroSecretaria==='Outros') resultado = resultado.filter(d=>d.secretaria!=='SS' && d.secretaria!=='SED');
    else resultado = resultado.filter(d=>d.secretaria===filtroSecretaria);
  }
  
  // Aplicar filtro de motivo
  if(filtroMotivo!=='Todos'){
    resultado = resultado.filter(d=>d.motivo===filtroMotivo);
  }

  // Aplicar filtro de status
  if(filtroStatus!=='Todos'){
    resultado = resultado.filter(d => (d.status || 'Pendente') === filtroStatus);
  }
  
  // Aplicar pesquisa por ticket
  if(pesquisa){
    resultado = resultado.filter(d => d.ticket.toString().includes(pesquisa));
  }
  
  return resultado;
}

function render(){
  const arr = filtrado();
  const total = arr.length;

  document.getElementById('topbar-date').textContent =
    `Atualizado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · ${total} registros`;

  const tb = document.getElementById('table-body');
  if(arr.length === 0){
    tb.innerHTML = `<tr>
      <td colspan="7" style="text-align:center; padding:40px; color:var(--muted)">
        Nenhum chamado encontrado para o filtro selecionado.
      </td>
    </tr>`;
    return;
  }

  tb.innerHTML = arr.map(r => {
    const statusLimpo = r.status || 'Pendente';
    const statusClass = statusLimpo === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto';
    const cor = COR_SEC[r.secretaria]||'#64748b';
    const dadosChamado = encodeURIComponent(JSON.stringify(r));

    return `<tr class="clickable-row" onclick="abrirChamado('${dadosChamado}')" title="Clique para ver detalhes">
      <td class="clickable-cell table-right" style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#60a5fa;cursor:pointer">#${r.ticket}</td>
      <td class="clickable-cell table-left" style="color:#f1f5f9;font-weight:500;cursor:pointer">${r.unidade || 'N/A'}</td>
      <td class="table-centered" style="font-size:10px;padding:2px 6px;border-radius:4px;background:${cor}20;color:${cor};font-weight:500">${r.secretaria}</td>
      <td class="table-centered" style="font-size:11px">${r.motivo}</td>
      <td class="table-centered" style="font-family:'JetBrains Mono',monospace;font-size:10px">${fmtDate(r.data_abertura)}</td>
      <td class="table-centered">
        <span class="badge ${statusClass}" style="font-size:9px">
          ${statusLimpo}
        </span>
      </td>
      <td class="table-centered" style="font-size:11px;color:var(--sub);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.problema || '—'}">${r.problema || '—'}</td>
    </tr>`;
  }).join('');
}

// Filtros
document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const type = btn.dataset.type;
    const value = btn.dataset.f;
    
    // Remover classe 'on' de todos os botões do mesmo tipo
    document.querySelectorAll(`.filter-btn[data-type="${type}"]`).forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    
    // Atualizar o filtro correspondente
    if(type === 'secretaria'){
      filtroSecretaria = value;
    } else if(type === 'motivo'){
      filtroMotivo = value;
    } else if(type === 'status'){
      filtroStatus = value;
    }
    
    render();
  });
});

// Pesquisa
document.getElementById('search-input').addEventListener('input', (e) => {
  pesquisa = e.target.value;
  render();
});

// Realtime
_sb.channel('sic-rt')
  .on('postgres_changes',{event:'*',schema:'public',table:'chamados'},()=>carregar())
  .subscribe();

// Modal de detalhes do chamado
function abrirChamado(encodedData){
  const overlay = document.getElementById('chamado-modal-overlay');
  const content = document.getElementById('chamado-modal-content');
  const chamado = JSON.parse(decodeURIComponent(encodedData));
  const statusLimpo = chamado.status || 'Pendente';
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

document.getElementById('chamado-modal-close').addEventListener('click', fecharChamadoModal);
document.getElementById('chamado-modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'chamado-modal-overlay') fecharChamadoModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharChamadoModal();
});

carregar();
