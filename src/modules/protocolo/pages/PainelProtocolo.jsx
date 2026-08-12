import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { FileText, Clock, CheckCircle, AlertCircle, Plus, Database } from 'lucide-react';
import { fetchProtocolos } from '../services/protocoloService';
import { AnimatedNumber } from '@/components/ui/dashboard-card';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

const CORES_PIE = ['#0D7C3D', '#10b981', '#f59e0b', '#ec4899', '#0D7C3D', '#14b8a6', '#a855f7'];

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

function KpiCard({ icon: Icon, label, value, cor = '#0D7C3D', sub }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 24, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 340, damping: 22, mass: 0.8 } } }}
      whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', transition: { duration: 0.2 } }}
      style={{ flex: 1, minWidth: '220px', background: 'linear-gradient(160deg, rgba(0, 0, 0, 0.02) 0%, rgba(0,0,0,.015) 100%)', border: '1px solid rgba(0, 0, 0, 0.05)', borderTop: `3px solid ${cor}`, borderRadius: 14, padding: '18px 20px', willChange: 'transform, opacity' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={cor} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}><AnimatedNumber value={value} /></div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 6 }}>{sub}</div>}
    </motion.div>
  );
}

export default function PainelProtocolo() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [erro, setErro] = useState(null);

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

  const stats = useMemo(() => {
    const total = dados.length;
    if (total === 0) return { total: 0, aberto: 0, emAnalise: 0, concluido: 0, bySecretaria: [], byTipo: [], byEvolucao: [], byStatus: [] };

    // Filtros por status unificados
    const aberto = dados.filter(d => d.status === 'Aberto').length;
    const emAnalise = dados.filter(d => d.status === 'Em Análise').length;
    const concluido = dados.filter(d => d.status === 'Concluído').length;

    // 1. Agrupar por Secretaria
    const secAcc = {};
    dados.forEach(d => {
      const k = d.secretaria || 'Não informada';
      secAcc[k] = (secAcc[k] || 0) + 1;
    });
    const bySecretaria = Object.entries(secAcc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // 2. Agrupar por Tipo de Solicitação
    const tipoAcc = {};
    dados.forEach(d => {
      const k = d.tipo_solicitacao || 'Outros';
      tipoAcc[k] = (tipoAcc[k] || 0) + 1;
    });
    const byTipo = Object.entries(tipoAcc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 3. Evolução Temporal (Agrupamento por Mês/Ano)
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const evoAcc = {};
    dados.forEach(d => {
      if (!d.data_abertura) return;
      const date = new Date(d.data_abertura);
      const chave = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const rotulo = `${mesesNomes[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
      if (!evoAcc[chave]) {
        evoAcc[chave] = { sortKey: chave, name: rotulo, value: 0 };
      }
      evoAcc[chave].value++;
    });
    const byEvolucao = Object.values(evoAcc)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // 4. Distribuição por Status
    const byStatus = [
      { name: 'Aberto', value: aberto, color: '#0D7C3D' },
      { name: 'Em Análise', value: emAnalise, color: '#f59e0b' },
      { name: 'Concluído', value: concluido, color: '#10b981' }
    ];

    return { total, aberto, emAnalise, concluido, bySecretaria, byTipo, byEvolucao, byStatus };
  }, [dados]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Protocolo Digital</h1>
          <p>Gestão e acompanhamento de processos administrativos em tempo real</p>
        </div>
        <div className="topbar-right">
          <Link to="/protocolos/novo" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 124, 61, 0.3)'
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
            borderRadius: 12, padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 14
          }}>
            <Database color="#f59e0b" size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>Modo Demonstração (LocalStorage) Ativo</div>
              <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>
                A tabela <code>protocolo_digital</code> não foi encontrada ou não está liberada no Supabase. O sistema está simulando localmente. Rode o script <code>create_protocolo_digital.sql</code> no Supabase para salvar na nuvem.
              </div>
            </div>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando estatísticas...</div>}
        {erro && <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && (
          <>
            {/* Cards de KPI */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}
            >
              <KpiCard icon={FileText} label="Total Protocolos" value={stats.total} cor="#a855f7" sub="Recebidos no sistema" />
              <KpiCard icon={AlertCircle} label="Protocolos Abertos" value={stats.aberto} cor="#0D7C3D" sub={`${pct(stats.aberto, stats.total)}% pendentes`} />
              <KpiCard icon={Clock} label="Em Análise" value={stats.emAnalise} cor="#f59e0b" sub="Sendo respondidos agora" />
              <KpiCard icon={CheckCircle} label="Concluídos" value={stats.concluido} cor="#10b981" sub={`${pct(stats.concluido, stats.total)}% encerrados`} />
            </motion.div>

            {/* Grid Principal de Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 20 }}>
              
              {/* Gráfico 1: Demandas por Secretaria (BarChart Horizontal) */}
              <div className="chart-card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>Demandas por Secretaria (Top 8)</div>
                {stats.bySecretaria.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.bySecretaria} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" stroke="#475569" fontSize={11} />
                      <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} width={130} tickFormatter={shortSecName} />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="value" fill="#0D7C3D" radius={[0, 4, 4, 0]} maxBarSize={16}>
                        {stats.bySecretaria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

              {/* Gráfico 2: Distribuição por Tipo de Solicitação (PieChart Donut com Quebra de Texto) */}
              <div className="chart-card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tipos de Solicitação</div>
                {stats.byTipo.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={stats.byTipo}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 10, flex: 1, minWidth: 180 }}>
                      {stats.byTipo.slice(0, 5).map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0, flex: 1 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: CORES_PIE[i % CORES_PIE.length], flexShrink: 0, marginTop: 3 }} />
                            <span style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.2' }}>{d.name}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flexShrink: 0, marginLeft: 8 }}>{d.value} ({pct(d.value, stats.total)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

              {/* Gráfico 3: Evolução Temporal de Aberturas (AreaChart com Gradiente) */}
              <div className="chart-card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>Evolução de Aberturas por Mês</div>
                {stats.byEvolucao.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
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
                  <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

              {/* Gráfico 4: Status dos Protocolos (BarChart Vertical sem Cursor Background) */}
              <div className="chart-card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>Status dos Protocolos</div>
                {stats.total > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.byStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#475569" fontSize={11} />
                      <YAxis stroke="#475569" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.byStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados disponíveis</div>
                )}
              </div>

            </div>

            {/* Rodapé Informativo */}
            <div className="chart-card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Ações Operacionais Rápidas</h3>
              <p style={{ fontSize: 12, color: 'var(--muted-c)', marginBottom: 20 }}>
                Gerencie todos os requerimentos na tela de consulta para dar andamento, registrar observações ou finalizar processos.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/protocolos/consulta" style={{ textDecoration: 'none' }}>
                  <button style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(0, 0, 0, 0.03)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    color: 'var(--text)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'background .15s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)'}>
                    Consultar Protocolos
                  </button>
                </Link>
                <Link to="/protocolos/novo" style={{ textDecoration: 'none' }}>
                  <button style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(13, 124, 61, 0.12)',
                    border: '1px solid rgba(13, 124, 61, 0.25)',
                    color: '#15A050', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'background .15s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(13, 124, 61, 0.18)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(13, 124, 61, 0.12)'}>
                    Abrir Requerimento
                  </button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
