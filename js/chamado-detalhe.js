const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COR_SEC = {
  'SA': '#94a3b8', 'SAS': '#10b981', 'SECOM': '#38bdf8', 'SCULT': '#c084fc',
  'SETIDE': '#22d3ee', 'SED': '#3b82f6', 'SETR': '#4ade80', 'SEREL': '#fb923c',
  'SF': '#2dd4bf', 'SEGOV': '#6366f1', 'SEHAB': '#f472b6', 'SEMARH': '#15803d',
  'SEPLAG': '#818cf8', 'SS': '#ef4444', 'SECONTRU': '#475569', 'SSO': '#fbbf24',
  'SETRAN': '#f87171', 'SEFAM': '#a78bfa', 'SECOL': '#64748b', 'SEIJ': '#fb7185',
  'SEPCD': '#86efac', 'SEMUD': '#e879f9', 'SEPPIR': '#78350f', 'SELCICUS': '#4b5563',
  'GP': '#1e293b', 'GVP': '#334155', 'SCC': '#0f172a', 'PGM': '#1e1b4b',
  'CGM': '#374151', 'OGM': '#4b5563', 'GCM': '#1e3a8a', 'Defesa Civil': '#ea580c'
};

function fmtDate(d){
  const dt = new Date(d+'T00:00:00');
  return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
}

function fmtDateTime(d){
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) + ' ' + 
         dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

function calcularTempoDecorrido(dataAbertura){
  const agora = new Date();
  const abertura = new Date(dataAbertura + 'T00:00:00');
  const diffMs = agora - abertura;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHoras = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if(diffDias > 0){
    return `${diffDias} dia${diffDias > 1 ? 's' : ''} e ${diffHoras}h`;
  } else if(diffHoras > 0){
    return `${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
  } else {
    return 'Menos de 1 hora';
  }
}

async function carregarChamado(ticket){
  try {
    const {data, error} = await _sb
      .from('chamados')
      .select('*')
      .eq('ticket', ticket)
      .single();
    
    if(error){
      console.error(error);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      return;
    }
    
    if(!data){
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      return;
    }
    
    // Preencher dados
    document.getElementById('ticket-number').textContent = `#${data.ticket}`;
    document.getElementById('unidade').textContent = data.unidade || 'N/A';
    document.getElementById('secretaria').textContent = data.secretaria || 'N/A';
    document.getElementById('motivo').textContent = data.motivo || 'N/A';
    document.getElementById('data_abertura').textContent = fmtDate(data.data_abertura);
    document.getElementById('hora_abertura').textContent = data.hora_abertura || '—';
    document.getElementById('tempo_decorrido').textContent = calcularTempoDecorrido(data.data_abertura);
    document.getElementById('ultima_atualizacao').textContent = fmtDateTime(data.updated_at || data.created_at);
    document.getElementById('descricao').textContent = data.problema || 'Sem descrição disponível.';
    
    // Status com badge
    const statusLimpo = data.status || 'Pendente';
    const statusClass = statusLimpo === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto';
    document.getElementById('status').innerHTML = `<span class="status-badge ${statusClass}">${statusLimpo}</span>`;
    
    // Cor da secretaria
    const cor = COR_SEC[data.secretaria] || '#64748b';
    if(data.secretaria){
      document.getElementById('secretaria').innerHTML = 
        `<span style="padding:2px 8px;border-radius:4px;background:${cor}20;color:${cor};font-weight:500">${data.secretaria}</span>`;
    }
    
    // Atualizar topbar
    document.getElementById('topbar-date').textContent = 
      `Atualizado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · Ticket #${data.ticket}`;
    
    // Mostrar conteúdo
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    
  } catch(error){
    console.error('Erro ao carregar chamado:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
  }
}

// Obter ticket da URL
function getTicketFromURL(){
  const params = new URLSearchParams(window.location.search);
  return params.get('ticket');
}

// Carregar chamado ao iniciar a página
document.addEventListener('DOMContentLoaded', () => {
  const ticket = getTicketFromURL();
  if(ticket){
    carregarChamado(ticket);
  } else {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
  }
});

// Realtime para atualizações
const ticket = getTicketFromURL();
if(ticket){
  _sb.channel(`chamado-${ticket}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chamados',
      filter: `ticket=eq.${ticket}`
    }, () => {
      carregarChamado(ticket);
    })
    .subscribe();
}
