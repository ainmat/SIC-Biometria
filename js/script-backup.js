// Backup do script.js antes de corrigir
const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let dados = [], filtro = 'Todos', chartMot = null, chartSec = null;

const COR_MOT = {
  'Hardware/Suporte': '#f87171',
  'Sincronização':     '#60a5fa',
  'Enquadramento':     '#fbbf24',
  'Conectividade':     '#34d399',
  'Outros':            '#94a3b8'
};

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

async function carregar(){
  try {
    console.log('Iniciando carregamento de dados...'); // Debug
    
    const {data,error} = await _sb.from('chamados').select('*').order('data_abertura',{ascending:false});
    
    if(error) {
      console.error('Erro ao carregar dados:', error);
      return;
    }
    
    console.log('Dados recebidos:', data); // Debug
    console.log('Quantidade de dados:', data ? data.length : 0); // Debug
    
    dados = data || [];
    console.log('Variável dados atualizada:', dados.length); // Debug
    
    render();
    console.log('Carregamento concluído'); // Debug
    
  } catch (error) {
    console.error('Erro na função carregar:', error);
  }
}

function filtrado(){
  let resultado = dados;
  
  // Aplicar filtro de secretaria
  if(filtro!=='Todos'){
    if(filtro==='Saúde') resultado = resultado.filter(d=>d.secretaria==='SS');
    else if(filtro==='Educação') resultado = resultado.filter(d=>d.secretaria==='SED');
    else if(filtro==='Outros') resultado = resultado.filter(d=>d.secretaria!=='SS' && d.secretaria!=='SED');
    else resultado = resultado.filter(d=>d.secretaria===filtro);
  }
  
  return resultado;
}

function contarPor(arr,key){
  const m={};
  arr.forEach(d=>{m[d[key]]=(m[d[key]]||0)+1});
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}

function render(){
  try {
    console.log('Iniciando renderização...'); // Debug
    
    const arr = filtrado().sort((a, b) => b.ticket - a.ticket);
    console.log('Renderizando com filtro:', filtro, 'Total itens:', arr.length); // Debug
    
    const total = arr.length;
    
    // Atualizar data
    const dataElement = document.getElementById('topbar-date');
    if (dataElement) {
      dataElement.textContent = `Atualizado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · ${total} registros`;
    }
    
    // Atualizar KPIs
    const kpiTotal = document.getElementById('kpi-total');
    if (kpiTotal) kpiTotal.textContent = total;
    
    const secE = contarPor(arr,'secretaria');
    if (secE.length && secE[0]) {
      const kpiSec = document.getElementById('kpi-sec');
      const kpiSecTag = document.getElementById('kpi-sec-tag');
      if (kpiSec) kpiSec.textContent = secE[0][0];
      if (kpiSecTag) kpiSecTag.textContent = `${secE[0][1]} chamados`;
    }
    
    const motE = contarPor(arr,'motivo');
    if (motE.length) {
      document.getElementById('kpi-mot').textContent = motE[0][0]; 
      const pct = Math.round(motE[0][1]/total*100);
      document.getElementById('kpi-mot-tag').textContent = `${pct}% do total`;
    }

    document.getElementById('badge-mot').textContent = `${total} total`;
    document.getElementById('badge-sec').textContent = `${total} total`;
    
    // Donut motivo
    const motLabels = motE.map(e=>e[0]);
    const motVals   = motE.map(e=>e[1]);
    const motCores  = motLabels.map(l=>COR_MOT[l]||'#64748b');
    if(chartMot) chartMot.destroy();
    chartMot = new Chart(document.getElementById('chartMot'),{
      type:'doughnut',
      data:{labels:motLabels,datasets:[{data:motVals,backgroundColor:motCores,borderWidth:0,hoverOffset:4}]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',padding:15,font:{size:11}}}
      }
    });
    
    // Hbars secretaria
    const hbar = document.getElementById('hbar-sec');
    const maxSec = secE[0]?.[1]||1;
    hbar.innerHTML = secE.map(([l,v])=>{
      const pct = Math.round(v/maxSec*100);
      const cor = COR_SEC[l]||'#64748b';
      return `<div class="hbar-row">
        <div class="hbar-label">${l}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:0%;background:${cor}" data-w="${pct}"></div></div>
        <div class="hbar-val">${v}</div>
      </div>`;
    }).join('');
    setTimeout(()=>hbar.querySelectorAll('.hbar-fill').forEach(b=>b.style.width=b.dataset.w+'%'),60);

    // Tabela de Últimas Ocorrências
    const tb = document.getElementById('table-body');
    console.log('Dados para tabela:', arr.slice(0, 10)); // Debug
    tb.innerHTML = arr.slice(0, 10).map(r => {
      const statusLimpo = r.status || 'Pendente';
      const statusClass = statusLimpo === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto';
      const unidadeCurta = r.unidade?.split(' ').slice(0, 4).join(' ') || 'N/A';
      const secretaria = r.secretaria || 'N/A';
      const motivo = r.motivo || 'N/A';
      const ticket = r.ticket || 'N/A';

      console.log('Processando item:', { unidade: unidadeCurta, secretaria, motivo, ticket }); // Debug

      return `<tr>
        <td style="color:#f1f5f9;font-size:11px;font-weight:500">${unidadeCurta}</td>
        <td style="font-size:11px">${secretaria}</td>
        <td style="font-size:11px">${motivo}</td>
        <td>
          <span class="badge ${statusClass}" style="font-size:9px">
            ${statusLimpo}
          </span>
        </td>
        <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:10px;color:#60a5fa">#${ticket}</td>
      </tr>`;
    }).join('');

    // Timeline
    const tl = document.getElementById('timeline');
    console.log('Dados para timeline:', arr.slice(0, 8)); // Debug
    tl.innerHTML = arr.slice(0,8).map((d,i)=>{
      const cor = COR_SEC[d.secretaria]||'#64748b';
      const isLast = i===Math.min(7,arr.length-1);
      const unidade = d.unidade?.split(' ').slice(0,5).join(' ') || 'N/A';
      const data = fmtDate(d.data_abertura);
      const secretaria = d.secretaria || 'N/A';
      const ticket = d.ticket || 'N/A';
      
      console.log('Processando timeline item:', { unidade, data, secretaria, ticket }); // Debug
      
      return `<div class="tl-item">
        <div class="tl-line">
          <div class="tl-dot2" style="background:${cor}"></div>
          ${!isLast?'<div class="tl-connector"></div>':''}
        </div>
        <div class="tl-content">
          <div class="tl-title">${unidade}</div>
          <div class="tl-meta">${data} · ${secretaria}</div>
        </div>
        <div class="tl-ticket">#${ticket}</div>
      </div>`;
    }).join('');
    
    console.log('Renderização concluída com sucesso'); // Debug
    
  } catch (error) {
    console.error('Erro na renderização:', error);
  }
}

// Filtros - Adicionado verificação de erro
setTimeout(() => {
  try {
    const botoesFiltro = document.querySelectorAll('.filter-btn');
    console.log('Botões encontrados:', botoesFiltro.length); // Debug
    
    if (botoesFiltro.length === 0) {
      console.warn('Botões não encontrados, tentando novamente em 1 segundo...');
      setTimeout(() => {
        const botoesRetry = document.querySelectorAll('.filter-btn');
        console.log('Tentativa 2 - Botões encontrados:', botoesRetry.length);
        configurarFiltros(botoesRetry);
      }, 1000);
    } else {
      configurarFiltros(botoesFiltro);
    }
  } catch (error) {
    console.error('Erro ao configurar filtros:', error);
  }
}, 500);

function configurarFiltros(botoesFiltro) {
  botoesFiltro.forEach((btn, index) => {
    console.log(`Configurando botão ${index}:`, btn.dataset.f); // Debug
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const novoFiltro = btn.dataset.f;
      console.log('Botão clicado:', novoFiltro); // Debug
      
      filtro = novoFiltro;
      
      // Atualizar classes
      botoesFiltro.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      
      console.log('Filtro atualizado para:', filtro); // Debug
      
      // Forçar renderização
      render();
    });
  });
}

// Realtime
_sb.channel('sic-rt')
  .on('postgres_changes',{event:'*',schema:'public',table:'chamados'},()=>carregar())
  .subscribe();

// Verificar se Supabase está disponível e iniciar carregamento
console.log('=== INICIANDO SISTEMA ===');
console.log('Verificando Supabase...', typeof supabase);
console.log('URL Supabase:', SUPABASE_URL);

if (typeof supabase !== 'undefined') {
  console.log('✅ Supabase disponível, iniciando carregamento...');
  carregar();
} else {
  console.error('❌ Supabase não foi carregado! Aguardando carregamento...');
  
  // Aguardar um pouco e tentar novamente
  setTimeout(() => {
    if (typeof supabase !== 'undefined') {
      console.log('✅ Supabase carregado após espera, iniciando...');
      carregar();
    } else {
      console.error('❌ Supabase ainda não disponível');
    }
  }, 2000);
}

carregar();
