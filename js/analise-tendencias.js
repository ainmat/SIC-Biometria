const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let dados = [], equipamentos = [], chartMensal = null, chartSemanal = null;

async function carregar(){
  try {
    console.log('🔄 Iniciando carregamento de dados...');
    
    // Carregar chamados
    const {data: chamadosData, error: chamadosError} = await _sb.from('chamados').select('*').order('data_abertura',{ascending:true});
    if(chamadosError){console.error('Erro ao carregar chamados:', chamadosError);return;}
    dados = chamadosData;
    console.log(`✅ Carregados ${dados.length} chamados`);
    
    // Carregar equipamentos
    const {data: equipamentosData, error: equipamentosError} = await _sb.from('equipamentos').select('*');
    if(equipamentosError){console.error('Erro ao carregar equipamentos:', equipamentosError);return;}
    equipamentos = equipamentosData;
    console.log(`✅ Carregados ${equipamentos.length} equipamentos`);
    
    render();
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
  }
}

function agruparPorMes(dados){
  const meses = {};
  dados.forEach(d => {
    const data = new Date(d.data_abertura + 'T00:00:00');
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    meses[chave] = (meses[chave] || 0) + 1;
  });
  
  // Ordenar por mês
  const ordenado = Object.entries(meses).sort((a, b) => a[0].localeCompare(b[0]));
  return ordenado;
}

function agruparPorDiaSemana(dados){
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const contagem = new Array(7).fill(0);
  
  dados.forEach(d => {
    const data = new Date(d.data_abertura + 'T00:00:00');
    contagem[data.getDay()]++;
  });
  
  return dias.map((dia, i) => ({dia, count: contagem[i]}));
}

function render(){
  const total = dados.length;
  
  document.getElementById('topbar-date').textContent =
    `Atualizado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})} · ${total} registros`;

  // KPIs
  const mensal = agruparPorMes(dados);
  const mesesAtuais = mensal.slice(-3);
  const mesesAnteriores = mensal.slice(-6, -3);
  
  const totalAtual = mesesAtuais.reduce((sum, [_, count]) => sum + count, 0);
  const totalAnterior = mesesAnteriores.reduce((sum, [_, count]) => sum + count, 0);
  const crescimento = totalAnterior > 0 ? Math.round((totalAtual - totalAnterior) / totalAnterior * 100) : 0;
  
  // Principal Motivo
  const motivos = {};
  dados.forEach(d => {
    if (d.motivo) {
      motivos[d.motivo] = (motivos[d.motivo] || 0) + 1;
    }
  });
  
  const motivoMaisFrequente = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0];
  if (motivoMaisFrequente) {
    document.getElementById('kpi-motivo').textContent = motivoMaisFrequente[0];
    document.getElementById('kpi-motivo-tag').textContent = `${motivoMaisFrequente[1]} chamados`;
  } else {
    document.getElementById('kpi-motivo').textContent = '—';
    document.getElementById('kpi-motivo-tag').textContent = '0 chamados';
  }
  
  // Média diária
  const diasUnicos = new Set(dados.map(d => d.data_abertura)).size;
  const mediaDiaria = diasUnicos > 0 ? Math.round(total / diasUnicos) : 0;
  document.getElementById('kpi-media').textContent = mediaDiaria;
  
  // Pico diário
  const porDia = {};
  dados.forEach(d => {
    porDia[d.data_abertura] = (porDia[d.data_abertura] || 0) + 1;
  });
  const pico = Math.max(...Object.values(porDia));
  document.getElementById('kpi-pico').textContent = pico;
  
  // Estatísticas
  const resolvidos = dados.filter(d => d.status === 'Atendimento Encerrado').length;
  const pendentes = total - resolvidos;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-resolvidos').textContent = resolvidos;
  document.getElementById('stat-pendentes').textContent = pendentes;
  
  // Gráfico mensal
  const mensalLabels = mensal.map(([mes, _]) => {
    const [ano, mesNum] = mes.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(mesNum) - 1]}/${ano.slice(2)}`;
  });
  const mensalData = mensal.map(([_, count]) => count);
  
  if(chartMensal) chartMensal.destroy();
  chartMensal = new Chart(document.getElementById('chartMensal'), {
    type: 'line',
    data: {
      labels: mensalLabels,
      datasets: [{
        label: 'Chamados',
        data: mensalData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      }
    }
  });
  
  // Gráfico semanal
  const semanal = agruparPorDiaSemana(dados);
  const semanalLabels = semanal.map(d => d.dia);
  const semanalData = semanal.map(d => d.count);
  
  if(chartSemanal) chartSemanal.destroy();
  chartSemanal = new Chart(document.getElementById('chartSemanal'), {
    type: 'bar',
    data: {
      labels: semanalLabels,
      datasets: [{
        label: 'Chamados',
        data: semanalData,
        backgroundColor: '#8b5cf6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      }
    }
  });
  
  // Badges
  document.getElementById('badge-mensal').textContent = `${total} total`;
  document.getElementById('badge-semanal').textContent = `${total} total`;
}

// Realtime
_sb.channel('sic-rt')
  .on('postgres_changes',{event:'*',schema:'public',table:'chamados'},()=>carregar())
  .on('postgres_changes',{event:'*',schema:'public',table:'equipamentos'},()=>carregar())
  .subscribe();

carregar();
