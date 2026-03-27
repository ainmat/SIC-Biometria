// Versão planilha operacional - Parque de Equipamentos

let equipmentData = [];
let searchTerm = '';
let supabaseClient = null;
let chartInstance = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  setupEventListeners();
  
  // Pequeno delay para garantir que o config foi carregado
  setTimeout(() => {
    initializeSupabase();
  }, 100);
});

// Inicializar Supabase
async function initializeSupabase() {
  try {
    // Carregar configuração do CONFIG global
    const config = window.CONFIG || {};
    const supabaseUrl = config.supabase?.url || 'https://placeholder.supabase.co';
    const supabaseKey = config.supabase?.anonKey || 'placeholder-key';
    
    console.log('🔍 Verificando configuração...');
    console.log('URL:', supabaseUrl);
    
    if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
      throw new Error('Configure as credenciais do Supabase');
    }
    
    // Carregar Supabase dinamicamente
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Supabase inicializado com sucesso');
    
    // Carregar dados após inicialização
    await loadEquipments();
    await setupRealtimeSubscription();
    
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    showError(error.message);
  }
}

// Carregar equipamentos do banco
async function loadEquipments() {
  if (!supabaseClient) return;
  
  try {
    showLoading(true);
    
    const { data, error } = await supabaseClient
      .from('equipamentos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    equipmentData = data || [];
    renderTable();
    updateSummary();
    createChart();
    showLoading(false);
    
    console.log(`✅ Carregados ${equipmentData.length} equipamentos do banco`);
    
  } catch (error) {
    console.error('❌ Erro ao carregar equipamentos:', error);
    showLoading(false);
    showError(error.message);
  }
}

// Configurar subscription em tempo real
async function setupRealtimeSubscription() {
  if (!supabaseClient) return;
  
  try {
    const channel = supabaseClient
      .channel('equipamentos_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'equipamentos' },
        (payload) => {
          console.log('🔄 Mudança em tempo real:', payload.eventType);
          loadEquipments();
        }
      )
      .subscribe();
      
    console.log('✅ Subscription em tempo real ativa');
    return channel;
    
  } catch (error) {
    console.error('❌ Erro ao configurar subscription:', error);
  }
}

// Atualizar data e hora
function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const dateStr = now.toLocaleDateString('pt-BR', options);
  const dateElement = document.getElementById('topbar-date');
  if (dateElement) {
    dateElement.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Busca
  const searchInput = document.getElementById('search-equipamento');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      searchTerm = this.value.toLowerCase();
      renderTable();
    });
  }

  // Botão de refresh
  const refreshBtn = document.getElementById('refresh-button');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      loadEquipments();
    });
  }
}

// Renderizar tabela principal
function renderTable() {
  const tbody = document.querySelector('#equipamentos-table tbody');
  if (!tbody) return;
  
  const filteredData = filterEquipment();
  
  tbody.innerHTML = '';
  
  if (filteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--sub);">
          Nenhum equipamento encontrado
        </td>
      </tr>
    `;
    return;
  }
  
  filteredData.forEach(equipment => {
    const row = createTableRow(equipment);
    tbody.appendChild(row);
  });
}

// Criar linha da tabela
function createTableRow(equipment) {
  const row = document.createElement('tr');
  
  // Adicionar classe especial para módulo 21 (PACO)
  const modulo = equipment.modulo || equipment.codigo_modulo || '';
  const moduloNum = parseInt(modulo);
  
  if (moduloNum === 21) {
    row.classList.add('modulo-21');
  } else if (moduloNum >= 11 && moduloNum <= 16) {
    // Tommi (azul)
    row.classList.add('modulo-tommi');
  } else if (moduloNum >= 17 && moduloNum <= 21) {
    // Control ID (vermelho)
    row.classList.add('modulo-control-id');
  }
  
  row.innerHTML = `
    <td>${equipment.codigo || equipment.id || ''}</td>
    <td>${equipment.nome || equipment.nome_equipamento || ''}</td>
    <td>${modulo}</td>
    <td>${equipment.ip || equipment.ip_equipamento || ''}</td>
    <td>${equipment.secretaria || ''}</td>
  `;
  
  return row;
}

// Filtrar equipamentos
function filterEquipment() {
  return equipmentData.filter(equipment => {
    if (!searchTerm) return true;
    
    const searchFields = [
      equipment.codigo || equipment.id || '',
      equipment.nome || equipment.nome_equipamento || '',
      equipment.modulo || equipment.codigo_modulo || '',
      equipment.ip || equipment.ip_equipamento || '',
      equipment.secretaria || ''
    ].join(' ').toLowerCase();
    
    return searchFields.includes(searchTerm);
  });
}

// Atualizar painel de resumo
function updateSummary() {
  const total = equipmentData.length;
  
  // Atualizar total geral
  const totalElement = document.getElementById('total-coletores');
  if (totalElement) {
    totalElement.textContent = total;
  }
  
  // Separar por tipo de módulo
  const controlIDData = {};
  const tommiData = {};
  
  equipmentData.forEach(equipment => {
    const modulo = equipment.modulo || equipment.codigo_modulo || '';
    
    if (modulo >= 17 && modulo <= 21) {
      // Control ID
      controlIDData[modulo] = (controlIDData[modulo] || 0) + 1;
    } else if (modulo >= 11 && modulo <= 16) {
      // Tommi
      tommiData[modulo] = (tommiData[modulo] || 0) + 1;
    }
  });
  
  // Atualizar tabela Control ID
  updateControlIDTable(controlIDData);
  
  // Atualizar tabela Tommi
  updateTommiTable(tommiData);
}

// Atualizar tabela Control ID
function updateControlIDTable(data) {
  const tbody = document.querySelector('#modulos-control-id-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Módulos 17-21
  for (let i = 17; i <= 21; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i}</td>
      <td>${data[i] || 0}</td>
    `;
    tbody.appendChild(row);
  }
  
  // Total
  const total = Object.values(data).reduce((sum, count) => sum + count, 0);
  const totalRow = document.createElement('tr');
  totalRow.innerHTML = `
    <td><strong>Total</strong></td>
    <td><strong>${total}</strong></td>
  `;
  tbody.appendChild(totalRow);
}

// Atualizar tabela Tommi
function updateTommiTable(data) {
  const tbody = document.querySelector('#modulos-tommi-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Módulos 11-16
  for (let i = 11; i <= 16; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i}</td>
      <td>${data[i] || 0}</td>
    `;
    tbody.appendChild(row);
  }
  
  // Total
  const total = Object.values(data).reduce((sum, count) => sum + count, 0);
  const totalRow = document.createElement('tr');
  totalRow.innerHTML = `
    <td><strong>Total</strong></td>
    <td><strong>${total}</strong></td>
  `;
  tbody.appendChild(totalRow);
}

// Criar gráfico de pizza
function createChart() {
  const canvas = document.getElementById('equipamentos-chart');
  if (!canvas) return;
  
  // Calcular totais
  let controlIDTotal = 0;
  let tommiTotal = 0;
  
  equipmentData.forEach(equipment => {
    const modulo = equipment.modulo || equipment.codigo_modulo || '';
    
    if (modulo >= 17 && modulo <= 21) {
      controlIDTotal++;
    } else if (modulo >= 11 && modulo <= 16) {
      tommiTotal++;
    }
  });
  
  // Destruir gráfico anterior se existir
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  // Criar novo gráfico
  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Control ID', 'Tommi'],
      datasets: [{
        data: [controlIDTotal, tommiTotal],
        backgroundColor: [
          '#ffcccc', // Hover Control ID - mesmo da tabela
          '#b3d9ff'  // Hover Tommi - mesmo da tabela
        ],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((context.parsed / total) * 100);
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Mostrar carregamento
function showLoading(show) {
  const tbody = document.querySelector('#equipamentos-table tbody');
  if (!tbody) return;
  
  if (show) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--sub);">
          Carregando equipamentos...
        </td>
      </tr>
    `;
  }
}

// Mostrar erro
function showError(message) {
  const tbody = document.querySelector('#equipamentos-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 40px;">
        <div style="color: #f87171; margin-bottom: 16px;">❌ Erro ao carregar dados</div>
        <div style="color: var(--sub); font-size: 14px; margin-bottom: 20px;">${message}</div>
        <div style="color: var(--muted); font-size: 12px;">Verifique as credenciais e a tabela no Supabase</div>
      </td>
    </tr>
  `;
}
