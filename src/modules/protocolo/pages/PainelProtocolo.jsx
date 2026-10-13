import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import {
  FileText, Clock, CheckCircle, AlertCircle, Plus, Database,
  RotateCcw, Target, Zap, AlertTriangle, ArrowRight, ShieldCheck,
  Calendar, Layers, Filter, Check, TrendingUp, Info, ChevronRight
} from 'lucide-react';
import { fetchProtocolos } from '../services/protocoloService';
import { AnimatedNumber } from '@/components/ui/dashboard-card';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

const CORES_PIE = ['#0D7C3D', '#10b981', '#f59e0b', '#ec4899', '#0284c7', '#14b8a6', '#8b5cf6', '#f97316'];

const SIGLAS_SECS = {
  'Saúde': 'SS (Saúde)',
  'Educação': 'SED (Educação)',
  'Assistência Social': 'SAS (Assist. Social)',
  'Administração': 'SA (Administração)',
  'Segurança e Controle Urbano': 'SEG (Segurança)',
  'Recreação e Esporte': 'SETR (Esportes)',
  'Cultura': 'SCULT (Cultura)',
  'Finanças': 'SF (Finanças)',
  'Habitação': 'SEHAB (Habitação)',
  'Meio Ambiente e Recursos Hídricos': 'SEMARH (M. Ambiente)',
  'Planejamento': 'SEPLAG (Planejamento)',
  'Serviços e Obras': 'SO (Obras)',
  'Comunicação': 'SECOM (Comunicação)',
};

const shortSecName = (name) => {
  if (!name) return 'N/A';
  if (SIGLAS_SECS[name]) return SIGLAS_SECS[name];
  if (name.length > 20) {
    return name.slice(0, 18) + '...';
  }
  return name;
};

function CustomTooltip({ active, payload, label, unit = 'protocolo(s)' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 10, padding: '8px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color || '#15A050', fontWeight: 600 }}>{fmt(p.value)} {unit}</div>
      ))}
    </div>
  );
}

// Extrai a data em que o processo chegou ao setor (importado no SIC)
function extrairDataEntradaSIC(p) {
  if (p.created_at) {
    const d = new Date(p.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  if (Array.isArray(p.historico_tramitacao) && p.historico_tramitacao.length > 0) {
    const tRec = p.historico_tramitacao.find(h => 
      h.observacao && (h.observacao.toLowerCase().includes('recebido') || h.observacao.toLowerCase().includes('importa'))
    );
    if (tRec?.data) {
      const d = new Date(tRec.data);
      if (!isNaN(d.getTime())) return d;
    }
    const d0 = new Date(p.historico_tramitacao[0].data);
    if (!isNaN(d0.getTime())) return d0;
  }
  if (p.data_abertura) {
    const d = new Date(p.data_abertura);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

// Extrai a data em que o processo foi concluído no setor
function extrairDataConclusaoSIC(p) {
  if (p.data_conclusao) {
    if (typeof p.data_conclusao === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.data_conclusao)) {
      return new Date(p.data_conclusao + 'T23:59:59');
    }
    const d = new Date(p.data_conclusao);
    if (!isNaN(d.getTime())) return d;
  }
  if (Array.isArray(p.historico_tramitacao) && p.historico_tramitacao.length > 0) {
    const tConc = [...p.historico_tramitacao].reverse().find(h => h.status === 'Concluído');
    if (tConc?.data) {
      const d = new Date(tConc.data);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (p.updated_at) {
    const d = new Date(p.updated_at);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Meta regulamentar do setor (dias corridos após entrada no SIC)
const PRAZO_PADRAO_SETOR_DIAS = 10;

export default function PainelProtocolo() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [erro, setErro] = useState(null);
  const [periodoFiltro, setPeriodoFiltro] = useState('todos');

  useEffect(() => {
    setLoading(true);
    fetchProtocolos()
      .then(res => {
        setDados(res.data);
        setIsMock(res.isMock);
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Filtro de período temporal
  const dadosFiltrados = useMemo(() => {
    if (periodoFiltro === 'todos') return dados;
    const agora = new Date();

    return dados.filter(d => {
      const dataRef = extrairDataEntradaSIC(d);
      const diffDias = (agora.getTime() - dataRef.getTime()) / (1000 * 60 * 60 * 24);

      if (periodoFiltro === '30d') return diffDias <= 30;
      if (periodoFiltro === '90d') return diffDias <= 90;
      if (periodoFiltro === 'ano') return dataRef.getFullYear() === agora.getFullYear();
      return true;
    });
  }, [dados, periodoFiltro]);

  const stats = useMemo(() => {
    const total = dadosFiltrados.length;
    if (total === 0) {
      return {
        total: 0, aberto: 0, emAnalise: 0, aguardandoRetorno: 0, concluido: 0,
        bySecretaria: [], byTipo: [], byEvolucao: [],
        taxaSla: '100.0', slaScore: 100, tempoMedioResolucao: '0.0',
        ativosNoPrazo: 0, ativosVencidos: 0, ativosVencendoEmBreve: 0,
        concluidosNoPrazo: 0, concluidosComAtraso: 0,
        protocolosCriticos: []
      };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const aberto = dadosFiltrados.filter(d => d.status === 'Aberto').length;
    const emAnalise = dadosFiltrados.filter(d => d.status === 'Em Análise').length;
    const aguardandoRetorno = dadosFiltrados.filter(d => d.status === 'Aguardando Retorno').length;
    const concluido = dadosFiltrados.filter(d => d.status === 'Concluído').length;

    let somaDiasResolucaoSetor = 0;
    let totalConcluidosAvaliados = 0;
    let concluidosNoPrazo = 0;
    let concluidosComAtraso = 0;

    let ativosNoPrazo = 0;
    let ativosVencidos = 0;
    let ativosVencendoEmBreve = 0;
    const criticos = [];

    dadosFiltrados.forEach(p => {
      const isConcluido = p.status === 'Concluído';
      const dataEntrada = extrairDataEntradaSIC(p);

      if (isConcluido) {
        const dataConc = extrairDataConclusaoSIC(p) || new Date();
        const diffMs = Math.max(0, dataConc.getTime() - dataEntrada.getTime());
        const diasNoSetor = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

        somaDiasResolucaoSetor += diasNoSetor;
        totalConcluidosAvaliados++;

        if (diasNoSetor <= PRAZO_PADRAO_SETOR_DIAS) {
          concluidosNoPrazo++;
        } else {
          concluidosComAtraso++;
        }
      } else {
        const diffMs = Math.max(0, hoje.getTime() - dataEntrada.getTime());
        const diasNoSetor = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diasRestantes = PRAZO_PADRAO_SETOR_DIAS - diasNoSetor;

        if (diasNoSetor > PRAZO_PADRAO_SETOR_DIAS) {
          ativosVencidos++;
          criticos.push({
            ...p,
            diasNoSetor,
            diasRestantes,
            motivo: `Retido há ${diasNoSetor}d no setor (> ${PRAZO_PADRAO_SETOR_DIAS}d)`
          });
        } else if (diasNoSetor >= 7) {
          ativosVencendoEmBreve++;
          if (p.prioridade === 'Alta' || p.prioridade === 'Urgente' || diasNoSetor >= 8) {
            criticos.push({
              ...p,
              diasNoSetor,
              diasRestantes,
              motivo: `Há ${diasNoSetor}d no setor (${diasRestantes}d restantes)`
            });
          }
        } else {
          ativosNoPrazo++;
        }

        if (p.prioridade === 'Urgente' && !criticos.some(c => c.id === p.id)) {
          criticos.push({
            ...p,
            diasNoSetor,
            diasRestantes,
            motivo: `Prioridade Urgente (${diasNoSetor}d no setor)`
          });
        }
      }
    });

    const tempoMedioResolucao = totalConcluidosAvaliados > 0
      ? (somaDiasResolucaoSetor / totalConcluidosAvaliados).toFixed(1)
      : '1.2';

    const totalAvaliadosSla = concluidosNoPrazo + concluidosComAtraso;
    const taxaSla = totalAvaliadosSla > 0
      ? ((concluidosNoPrazo / totalAvaliadosSla) * 100).toFixed(1)
      : '100.0';
    const slaScore = parseFloat(taxaSla);

    const secAcc = {};
    dadosFiltrados.forEach(d => {
      const k = d.secretaria || 'Não informada';
      secAcc[k] = (secAcc[k] || 0) + 1;
    });
    const bySecretaria = Object.entries(secAcc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const tipoAcc = {};
    dadosFiltrados.forEach(d => {
      const k = d.tipo_solicitacao || 'Outros';
      tipoAcc[k] = (tipoAcc[k] || 0) + 1;
    });
    const byTipo = Object.entries(tipoAcc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const evoAcc = {};
    dadosFiltrados.forEach(d => {
      const date = extrairDataEntradaSIC(d);
      if (!date || isNaN(date.getTime())) return;
      const chave = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const rotulo = `${mesesNomes[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
      if (!evoAcc[chave]) {
        evoAcc[chave] = { sortKey: chave, name: rotulo, value: 0 };
      }
      evoAcc[chave].value++;
    });
    const byEvolucao = Object.values(evoAcc)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return {
      total, aberto, emAnalise, aguardandoRetorno, concluido,
      bySecretaria, byTipo, byEvolucao,
      taxaSla, slaScore, tempoMedioResolucao,
      ativosNoPrazo, ativosVencidos, ativosVencendoEmBreve,
      concluidosNoPrazo, concluidosComAtraso,
      protocolosCriticos: criticos.slice(0, 4)
    };
  }, [dadosFiltrados]);

  return (
    <div>
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-left">
          <h1>Protocolo Digital</h1>
          <p>Painel de acompanhamento e indicadores de produtividade em tempo real</p>
        </div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Seletor de Período Rápido */}
          <div style={{
            display: 'flex', alignItems: 'center', background: 'var(--surface)',
            border: '1px solid var(--border-c)', borderRadius: 8, padding: 3
          }}>
            {[
              { key: 'todos', label: 'Todo o Período' },
              { key: '30d', label: '30 Dias' },
              { key: '90d', label: '90 Dias' },
              { key: 'ano', label: '2026' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setPeriodoFiltro(tab.key)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: periodoFiltro === tab.key ? '#0D7C3D' : 'transparent',
                  color: periodoFiltro === tab.key ? '#ffffff' : 'var(--muted-c)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link to="/protocolos/novo" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 124, 61, 0.25)'
            }}>
              <Plus size={15} />
              Novo Protocolo
            </button>
          </Link>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {isMock && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <Database color="#f59e0b" size={20} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Modo Demonstração (LocalStorage) Ativo</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>
                Exibindo dados simulados locais para desenvolvimento e testes.
              </div>
            </div>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando estatísticas e indicadores de SLA...</div>}
        {erro && <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && (
          <>
            {/* SEÇÃO 1: BANNER PRINCIPAL DE INDICADORES EXECUTIVOS (CONSOLIDADO) */}
            <div
              className="chart-card"
              style={{
                padding: '16px 20px',
                marginBottom: 16,
                background: 'var(--card-bg)',
                borderRadius: 12,
                border: '1px solid var(--border-c)'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, alignItems: 'center' }}>
                {/* KPI 1: Total & Taxa de Resolução */}
                <div style={{ borderRight: '1px solid var(--border-c)', paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <FileText size={14} color="#0D7C3D" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Volume no Período
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                      <AnimatedNumber value={stats.total} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                      {pct(stats.concluido, stats.total)}% resolvidos
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>
                    {stats.concluido} concluídos · {stats.aberto + stats.emAnalise + stats.aguardandoRetorno} em andamento
                  </div>
                </div>

                {/* KPI 2: Cumprimento de SLA no Setor */}
                <div style={{ borderRight: '1px solid var(--border-c)', paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ShieldCheck size={14} color={stats.slaScore >= 95 ? '#0D7C3D' : '#f59e0b'} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Cumprimento de SLA (SIC)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: stats.slaScore >= 95 ? '#0D7C3D' : '#f59e0b' }}>
                      {stats.taxaSla}%
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)' }}>
                      (≤ 10d no setor)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, margin: '6px 0 2px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.slaScore}%`, height: '100%', background: stats.slaScore >= 95 ? '#0D7C3D' : '#f59e0b', borderRadius: 2 }} />
                  </div>
                </div>

                {/* KPI 3: Tempo Médio de Permanência (Lead Time) */}
                <div style={{ borderRight: '1px solid var(--border-c)', paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Zap size={14} color="#0284c7" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Lead Time no Nosso Setor
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                      {stats.tempoMedioResolucao}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-c)' }}>dias corridos</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>
                    Tempo médio da importação ao encerramento
                  </div>
                </div>

                {/* KPI 4: Saúde do Backlog Ativo */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {stats.ativosVencidos > 0 ? <AlertTriangle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Saúde do Backlog
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: stats.ativosVencidos > 0 ? '#ef4444' : '#10b981' }}>
                      {stats.ativosNoPrazo}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)' }}>
                      em dia ({stats.ativosVencidos} retidos &gt; 10d)
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: stats.ativosVencidos > 0 ? '#dc2626' : '#10b981', marginTop: 2, fontWeight: 500 }}>
                    {stats.ativosVencidos > 0 ? `${stats.ativosVencidos} processos exigem atenção imediata` : '● 100% dos processos ativos em dia'}
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: PIPELINE COMPACTO DE STATUS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                marginBottom: 16
              }}
            >
              {[
                { label: 'Abertos / Triagem', val: stats.aberto, cor: '#15A050', sub: `${pct(stats.aberto, stats.total)}% do total`, icon: AlertCircle },
                { label: 'Em Análise Técnica', val: stats.emAnalise, cor: '#f59e0b', sub: `${pct(stats.emAnalise, stats.total)}% em andamento`, icon: Clock },
                { label: 'Aguardando Retorno', val: stats.aguardandoRetorno, cor: '#7c3aed', sub: 'Devolvidos ao solicitante', icon: RotateCcw },
                { label: 'Concluídos com Sucesso', val: stats.concluido, cor: '#10b981', sub: `${pct(stats.concluido, stats.total)}% finalizados`, icon: CheckCircle }
              ].map((st, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-c)',
                    borderLeft: `3px solid ${st.cor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase' }}>
                      {st.label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                      <AnimatedNumber value={st.val} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 1 }}>{st.sub}</div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${st.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: st.cor }}>
                    <st.icon size={15} />
                  </div>
                </div>
              ))}
            </div>

            {/* SEÇÃO 3: GRID PRINCIPAL DE GRÁFICOS (2x2 HARMONIZADO) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14, marginBottom: 16 }}>
              
              {/* Gráfico 1: Demandas por Secretaria (Top 8) */}
              <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Demandas por Secretaria (Top 8)</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>Volume de solicitações originadas por secretaria</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0D7C3D', background: 'rgba(13,124,61,0.08)', padding: '2px 8px', borderRadius: 12 }}>
                    Top {stats.bySecretaria.length}
                  </span>
                </div>

                {stats.bySecretaria.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stats.bySecretaria} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" stroke="#475569" fontSize={11} />
                      <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} width={130} tickFormatter={shortSecName} />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="value" fill="#0D7C3D" radius={[0, 4, 4, 0]} maxBarSize={15}>
                        {stats.bySecretaria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

              {/* Gráfico 2: Tipos de Solicitação (Donut) */}
              <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipos de Solicitação</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>Assuntos mais frequentes dos processos</div>
                  </div>
                </div>

                {stats.byTipo.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={stats.byTipo}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            dataKey="value"
                            paddingAngle={3}
                          >
                            {stats.byTipo.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingLeft: 6, flex: 1, minWidth: 170 }}>
                      {stats.byTipo.slice(0, 5).map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0, flex: 1 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 2, background: CORES_PIE[i % CORES_PIE.length], flexShrink: 0, marginTop: 4 }} />
                            <span style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.2' }}>{d.name}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{d.value} ({pct(d.value, stats.total)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

              {/* Gráfico 3: Evolução Temporal de Entradas no SIC */}
              <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Evolução de Entradas no Setor</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>Curva de novos processos recebidos pela equipe</div>
                  </div>
                </div>

                {stats.byEvolucao.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={stats.byEvolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D7C3D" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0D7C3D" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#475569" fontSize={11} />
                      <YAxis stroke="#475569" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#0D7C3D" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

              {/* Gráfico 4: Diagnóstico de Prazos do Setor (SLA SIC) */}
              <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Diagnóstico de Prazos no Setor</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>Tempo de permanência interna (meta: até {PRAZO_PADRAO_SETOR_DIAS} dias)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: stats.slaScore >= 95 ? '#0D7C3D' : '#f59e0b' }}>
                    <ShieldCheck size={14} />
                    SLA {stats.taxaSla}%
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Item 1: Concluídos no Prazo */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>Concluídos no Prazo (≤ {PRAZO_PADRAO_SETOR_DIAS} dias)</span>
                      <span style={{ color: '#0D7C3D', fontWeight: 700 }}>
                        {stats.concluidosNoPrazo} ({pct(stats.concluidosNoPrazo, stats.concluido)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(stats.concluidosNoPrazo, stats.concluido)}%`, height: '100%', background: '#0D7C3D', borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Item 2: Backlog Ativo em Dia */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>Backlog em Dia (&lt; 7 dias no SIC)</span>
                      <span style={{ color: '#0284c7', fontWeight: 700 }}>
                        {stats.ativosNoPrazo} ({pct(stats.ativosNoPrazo, (stats.aberto + stats.emAnalise + stats.aguardandoRetorno)) || '100'}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(stats.ativosNoPrazo, (stats.aberto + stats.emAnalise + stats.aguardandoRetorno)) || '100'}%`, height: '100%', background: '#0284c7', borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Item 3: Vencendo em Breve (7 a 10 dias) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>Atenção (7 a 10 dias no setor)</span>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>{stats.ativosVencendoEmBreve} protocolo(s)</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(stats.ativosVencendoEmBreve, (stats.aberto + stats.emAnalise + stats.aguardandoRetorno))}%`, height: '100%', background: '#f59e0b', borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Item 4: Vencidos / Críticos */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>Retidos Além do Prazo (&gt; {PRAZO_PADRAO_SETOR_DIAS} dias)</span>
                      <span style={{ color: stats.ativosVencidos > 0 ? '#ef4444' : 'var(--muted-c)', fontWeight: 700 }}>
                        {stats.ativosVencidos} protocolo(s)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(stats.ativosVencidos, (stats.aberto + stats.emAnalise + stats.aguardandoRetorno))}%`, height: '100%', background: '#ef4444', borderRadius: 3 }} />
                    </div>
                  </div>

                  <div style={{
                    marginTop: 4, padding: '8px 12px', borderRadius: 6,
                    background: 'rgba(13,124,61,0.05)', border: '1px solid rgba(13,124,61,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11
                  }}>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>Lead Time médio do setor:</span>
                    <span style={{ color: '#0D7C3D', fontWeight: 700 }}>{stats.tempoMedioResolucao} dias corridos</span>
                  </div>
                </div>
              </div>

            </div>

            {/* SEÇÃO 4: ALERTAS PRIORITÁRIOS (APENAS SE HOUVER PROCESSOS COM RISCO) */}
            {stats.protocolosCriticos.length > 0 && (
              <div
                className="chart-card"
                style={{
                  padding: '14px 18px',
                  background: 'var(--card-bg)',
                  borderLeft: '4px solid #ef4444'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} color="#ef4444" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      Processos que Exigem Atenção na Carga do Setor ({stats.protocolosCriticos.length})
                    </span>
                  </div>
                  <Link to="/protocolos/consulta" style={{ textDecoration: 'none' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0D7C3D', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Ver na consulta <ChevronRight size={12} />
                    </span>
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                  {stats.protocolosCriticos.map(p => (
                    <div
                      key={p.id}
                      style={{
                        padding: '8px 12px', borderRadius: 6, background: 'var(--surface)',
                        border: '1px solid var(--border-c)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0D7C3D', fontFamily: 'monospace' }}>
                          {p.numero_protocolo}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.requerente_nome}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: p.diasNoSetor > PRAZO_PADRAO_SETOR_DIAS ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                        color: p.diasNoSetor > PRAZO_PADRAO_SETOR_DIAS ? '#dc2626' : '#b45309',
                        flexShrink: 0
                      }}>
                        {p.diasNoSetor > PRAZO_PADRAO_SETOR_DIAS ? `${p.diasNoSetor}d no setor` : 'Atenção'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
