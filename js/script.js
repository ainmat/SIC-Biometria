// SIC-Biometria - Script Principal
const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';

let _sb = null;

// Inicialização segura do Supabase
function inicializarSupabase(){
  try {
    if(typeof supabase === 'undefined'){
      console.error('Supabase não está carregado!');
      document.getElementById('topbar-date').textContent = 'Erro: Supabase não carregado';
      return false;
    }
    
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  } catch(error){
    console.error('Erro ao inicializar Supabase:', error);
    document.getElementById('topbar-date').textContent = 'Erro ao inicializar Supabase';
    return false;
  }
}

let dados = [], filtro = 'Todos', chartMot = null;

const COR_MOT = {
  'EQUIPAMENTO': '#ef4444',
  'RECONHECIMENTO': '#3b82f6',
  'ESPELHO DE PONTO': '#f59e0b',
  'CADASTRO': '#10b981',
  'Hardware/Suporte': '#ef4444',
  'Sincronização': '#3b82f6',
  'Enquadramento': '#f59e0b',
  'Conectividade': '#10b981',
  'Outros': '#8b5cf6'
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
    if(!_sb && !inicializarSupabase()){
      return;
    }
    
    const {data,error} = await _sb.from('chamados').select('*').order('ticket',{ascending:false});
    
    if(error){
      console.error('Erro na consulta Supabase:', error);
      document.getElementById('topbar-date').textContent = 'Erro ao carregar dados';
      return;
    }
    
    dados = data || [];
    console.log('Carregados', dados.length, 'registros');
    
    if(dados.length === 0){
      document.getElementById('topbar-date').textContent = 'Nenhum registro encontrado';
      return;
    }
    
    render();
    
  } catch (error) {
    console.error('Erro ao carregar:', error);
    document.getElementById('topbar-date').textContent = 'Erro na conexão';
  }
}

function filtrado(){
  // Mantém ordenação por ticket (maior para menor) já que os dados vêm ordenados do banco
  if(filtro==='Todos') return dados;
  if(filtro==='Saúde') return dados.filter(d=>d.secretaria==='SS');
  if(filtro==='Educação') return dados.filter(d=>d.secretaria==='SED');
  if(filtro==='Outros') return dados.filter(d=>d.secretaria!=='SS' && d.secretaria!=='SED');
  return dados.filter(d=>d.secretaria===filtro);
}

function contarPor(arr,key){
  const m={};
  arr.forEach(d=>{m[d[key]]=(m[d[key]]||0)+1});
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}

function render(){
  try {
    const arr = filtrado();
    const total = arr.length;
    
    // Atualizar data
    document.getElementById('topbar-date').textContent = 
      `Atualizado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · ${total} registros`;

    // KPIs
    document.getElementById('kpi-total').textContent = total;
    
    const secE = contarPor(arr,'secretaria');
    if(secE.length){
      document.getElementById('kpi-sec').textContent = secE[0][0];
      document.getElementById('kpi-sec-tag').textContent = `${secE[0][1]} chamados`;
    }
    
    const motE = contarPor(arr,'motivo');
    if(motE.length){
      document.getElementById('kpi-mot').textContent = motE[0][0]; 
      const pct = Math.round(motE[0][1]/total*100);
      document.getElementById('kpi-mot-tag').textContent = `${pct}% do total`;
    }

    document.getElementById('badge-mot').textContent = `${total} total`;
    document.getElementById('badge-sec').textContent = `${total} total`;
    
    // Gráfico donut moderno com cores distintas
    const motLabels = motE.map(e=>e[0]);
    const motVals = motE.map(e=>e[1]);
    
    // Garantir que todas as categorias apareçam
    const todasCategorias = ['EQUIPAMENTO', 'RECONHECIMENTO', 'ESPELHO DE PONTO', 'CADASTRO'];
    const labelsFinais = [];
    const valoresFinais = [];
    const coresFinais = [];
    
    todasCategorias.forEach(cat => {
      const index = motLabels.indexOf(cat);
      if (index !== -1) {
        labelsFinais.push(cat);
        valoresFinais.push(motVals[index]);
      } else {
        labelsFinais.push(cat);
        valoresFinais.push(0);
      }
      coresFinais.push(COR_MOT[cat]);
    });
    
    if(chartMot) chartMot.destroy();
    chartMot = new Chart(document.getElementById('chartMot'),{
      type:'doughnut',
      data:{
        labels:labelsFinais,
        datasets:[{
          data:valoresFinais,
          backgroundColor:coresFinais,
          borderColor: '#0d1424',
          borderWidth: 2,
          hoverOffset: 8,
          hoverBorderWidth: 3,
          hoverBorderColor: '#3b82f6'
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        cutout: '60%',
        spacing: 3,
        plugins:{
          legend:{
            position:'bottom',
            labels:{
              color:'#f1f5f9',
              padding: 15,
              font:{size:12, family:'Sora', weight: '500'},
              usePointStyle: true,
              pointStyle: 'circle',
              pointStyleWidth: 10,
              pointStyleHeight: 10,
              boxWidth: 10
            }
          },
          tooltip:{
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(59, 130, 246, 0.3)',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((context.parsed / total) * 100);
                return `${context.label}: ${context.parsed} chamados (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 800,
          easing: 'easeInOutQuart'
        }
      }
    });
    
    // Barras secretaria
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

    // Tabela
    const tb = document.getElementById('table-body');
    tb.innerHTML = arr.slice(0,10).map(r=>{
      const status = r.status || 'Pendente';
      const statusClass = status === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto';
      return `<tr>
        <td style="color:#f1f5f9;font-size:11px;font-weight:500">${r.unidade?.split(' ').slice(0,4).join(' ') || 'N/A'}</td>
        <td style="font-size:11px">${r.secretaria}</td>
        <td style="font-size:11px">${r.motivo}</td>
        <td><span class="badge ${statusClass}" style="font-size:9px">${status}</span></td>
        <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:10px;color:#60a5fa">#${r.ticket}</td>
      </tr>`;
    }).join('');

    // Timeline
    const tl = document.getElementById('timeline');
    tl.innerHTML = arr.slice(0,8).map((d,i)=>{
      const cor = COR_SEC[d.secretaria]||'#64748b';
      const isLast = i===Math.min(7,arr.length-1);
      return `<div class="tl-item">
        <div class="tl-line">
          <div class="tl-dot2" style="background:${cor}"></div>
          ${!isLast?'<div class="tl-connector"></div>':''}
        </div>
        <div class="tl-content">
          <div class="tl-title">${d.unidade?.split(' ').slice(0,5).join(' ')}</div>
          <div class="tl-meta">${fmtDate(d.data_abertura)} · ${d.secretaria}</div>
        </div>
        <div class="tl-ticket">#${d.ticket}</div>
      </div>`;
    }).join('');
    
  } catch (error) {
    console.error('Erro na renderização:', error);
  }
}

// Filtros
setTimeout(() => {
  const botoes = document.querySelectorAll('.filter-btn');
  
  botoes.forEach(btn=>{
    btn.addEventListener('click',()=>{
      filtro = btn.dataset.f;
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      render();
    });
  });
}, 1000);

// Realtime
setTimeout(() => {
  if(_sb){
    _sb.channel('sic-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'chamados'},()=>carregar())
      .subscribe();
  }
}, 2000);

// Iniciar carregamento quando a página estiver pronta
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(carregar, 500);
});
