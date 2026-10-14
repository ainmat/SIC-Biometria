import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts';
import {
  Users, TrendingUp, Clock, BookOpen, AlertTriangle, Shield,
  Database, Building2, UserCheck, ArrowRight, Layers
} from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado, anosParaAposentadoria, ALERTAS, APOSENTADORIA } from '@/modules/servidores/config/servidoresConfig';
import { AnimatedNumber } from '@/components/ui/dashboard-card';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, total) => (total > 0 ? ((v / total) * 100).toFixed(1) : '0.0');

function parseBRDate(s) {
  if (!s) return null;
  const [dmy] = s.split(' ');
  const [d, m, y] = dmy.split('/');
  const dt = new Date(`${y}-${m}-${d}`);
  return isNaN(dt) ? null : dt;
}

function agrupar(arr, campo) {
  const acc = {};
  arr.forEach((r) => {
    const k = r[campo] || 'Não informado';
    acc[k] = (acc[k] || 0) + 1;
  });
  return Object.entries(acc)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function faixaEtaria(idade) {
  if (idade === null || idade === undefined) return 'Não informado';
  const n = Number(idade);
  if (n < 25) return '< 25';
  if (n < 30) return '25–29';
  if (n < 35) return '30–34';
  if (n < 40) return '35–39';
  if (n < 45) return '40–44';
  if (n < 50) return '45–49';
  if (n < 55) return '50–54';
  if (n < 60) return '55–59';
  return '60+';
}

const FAIXA_ORDER = ['< 25', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60+', 'Não informado'];
const CORES_SEC = ['#0D7C3D', '#15A050', '#10b981', '#f97316', '#a855f7', '#06b6d4', '#f59e0b', '#3b82f6', '#ec4899', '#64748b'];
const CORES_PIE = ['#0D7C3D', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];
const CORES_FAIXA = ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#64748b'];

const shortName = (name) => {
  if (!name) return '';
  let s = name.replace('SECRETARIA EXECUTIVA ', 'SEC. EXEC. ');
  s = s.replace('SECRETARIA DA ', 'SEC. DA ');
  s = s.replace('SECRETARIA DE ', 'SEC. DE ');
  s = s.replace('SECRETARIA DO ', 'SEC. DO ');
  s = s.replace('SECRETARIA ', 'SEC. ');
  return s.length > 32 ? s.substring(0, 30) + '...' : s;
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-c)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,.15)',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill || p.color }} />
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt(p.value)} servidores</span>
        </div>
      ))}
    </div>
  );
}

function MiniPieCard({ title, data, total }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border-c)',
        borderRadius: 12,
        padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--muted-c)',
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}
      >
        {title}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={48} dataKey="value" paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {data.slice(0, 4).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: CORES_PIE[i % CORES_PIE.length],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: 'var(--muted-c)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.name}
              </span>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
              {pct(d.value, total)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PainelServidores() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtroSec, setFiltroSec] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchResumoServidores()
      .then(setDados)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  const secretarias = useMemo(
    () => [...new Set(dados.map((r) => r.Des_Secretaria).filter(Boolean))].sort(),
    [dados]
  );

  const {
    total,
    recentes,
    totalSecs,
    idadeMedia,
    bySecretaria,
    byRegime,
    bySexo,
    byPadrao,
    byEscol,
    byFaixa,
    alertas,
    saudeRisco,
  } = useMemo(() => {
    const doze = new Date();
    doze.setFullYear(doze.getFullYear() - 1);
    const base = filtroSec ? dados.filter((r) => r.Des_Secretaria === filtroSec) : dados;
    const total = base.length;

    if (!total) {
      return {
        total: 0,
        recentes: 0,
        totalSecs: 0,
        idadeMedia: null,
        bySecretaria: [],
        byRegime: [],
        bySexo: [],
        byPadrao: [],
        byEscol: [],
        byFaixa: [],
        alertas: { nComiss: 0, pctComiss: 0, elegiveis: 0, proximosN: 0, incompletos: 0 },
        saudeRisco: [],
      };
    }

    const recentes = base.filter((r) => {
      const dt = parseBRDate(r.DtAdmissao);
      return dt && dt >= doze;
    }).length;
    const totalSecs = filtroSec ? 1 : new Set(base.map((r) => r.Des_Secretaria).filter(Boolean)).size;
    const idades = base.map((r) => Number(r.Idade)).filter((n) => n > 0 && n < 120);
    const idadeMedia = idades.length > 0 ? (idades.reduce((a, b) => a + b, 0) / idades.length).toFixed(1) : null;

    const bySecretaria = agrupar(base, 'Des_Secretaria').slice(0, 15);
    const byRegime = agrupar(base, 'Des_RegTrab');
    const bySexo = agrupar(base, 'Sexo');
    const byPadrao = agrupar(base, 'Des_Padrao_Adm');
    const byEscol = agrupar(base, 'Des_GrInstrucao');

    const accF = {};
    base.forEach((r) => {
      const f = faixaEtaria(r.Idade);
      accF[f] = (accF[f] || 0) + 1;
    });
    const byFaixa = FAIXA_ORDER.filter((f) => accF[f]).map((f) => ({ name: f, value: accF[f] }));

    const nComiss = base.filter(isComissionado).length;
    const pctComiss = (nComiss / total) * 100;
    const elegiveis = base.filter((r) => anosParaAposentadoria(r) === 0).length;
    const proximosN = base.filter((r) => {
      const a = anosParaAposentadoria(r);
      return a > 0 && a <= APOSENTADORIA.alertaAntes;
    }).length;
    const incompletos = base.filter(
      (r) => !r.Nome_Funcionario?.trim() || !r.Des_Cargo?.trim() || !r.Des_Secretaria?.trim()
    ).length;
    const alertas = { nComiss, pctComiss, elegiveis, proximosN, incompletos };

    const bySecC = {};
    base.forEach((r) => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecC[sec]) bySecC[sec] = { total: 0, comiss: 0 };
      bySecC[sec].total++;
      if (isComissionado(r)) bySecC[sec].comiss++;
    });
    const saudeRisco = Object.entries(bySecC)
      .filter(([, v]) => v.total >= 5)
      .map(([sec, v]) => ({ sec, pctC: (v.comiss / v.total) * 100 }))
      .filter((v) => v.pctC > ALERTAS.maxPctComissionados)
      .sort((a, b) => b.pctC - a.pctC)
      .slice(0, 3);

    return {
      total,
      recentes,
      totalSecs,
      idadeMedia,
      bySecretaria,
      byRegime,
      bySexo,
      byPadrao,
      byEscol,
      byFaixa,
      alertas,
      saudeRisco,
    };
  }, [dados, filtroSec]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Painel Geral de Gestão de Pessoas</h1>
          <p>Visão demográfica, quadro de pessoal e auditoria funcional</p>
        </div>
        <div className="topbar-right">
          <select
            value={filtroSec}
            onChange={(e) => setFiltroSec(e.target.value)}
            className="hr-filter-select"
            style={{ height: 34 }}
          >
            <option value="">Todas as Secretarias</option>
            {secretarias.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 13 }}>
            Carregando indicadores do quadro funcional...
          </div>
        )}

        {erro && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 8,
              background: 'rgba(239,68,68,.1)',
              border: '1px solid rgba(239,68,68,.25)',
              color: '#dc2626',
              fontSize: 13,
            }}
          >
            {erro}
          </div>
        )}

        {!loading && !erro && total === 0 && (
          <div className="chamados-empty-state">
            <Users size={32} className="text-slate-400 mb-2" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Nenhum servidor encontrado</div>
          </div>
        )}

        {!loading && total > 0 && (
          <>
            {/* Disclaimer Legal */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(245,158,11,.08)',
                border: '1px solid rgba(245,158,11,.25)',
                color: '#b45309',
                fontSize: 11.5,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                <strong>Nota Técnica:</strong> Indicadores previdenciários seguem as regras de transição da EC 103/2019. Válidos como suporte analítico à gestão de pessoas.
              </span>
            </div>

            {/* Deck de KPIs Executivos */}
            <div className="hr-metric-strip">
              <div className="hr-metric-card">
                <div className="hr-metric-top">
                  <span className="hr-metric-title">
                    <Users size={13} /> Total no Quadro
                  </span>
                  <span className="hr-metric-badge" style={{ background: 'rgba(13,124,61,0.1)', color: '#0D7C3D' }}>
                    Ativos
                  </span>
                </div>
                <div className="hr-metric-number">{fmt(total)}</div>
                <div className="hr-metric-footnote">
                  {totalSecs} secretaria{totalSecs !== 1 ? 's' : ''} monitorada{totalSecs !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="hr-metric-card">
                <div className="hr-metric-top">
                  <span className="hr-metric-title">
                    <TrendingUp size={13} /> Admissões (12m)
                  </span>
                  <span className="hr-metric-badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                    Novos
                  </span>
                </div>
                <div className="hr-metric-number" style={{ color: '#059669' }}>
                  {fmt(recentes)}
                </div>
                <div className="hr-metric-footnote">Últimos 12 meses</div>
              </div>

              <div className="hr-metric-card">
                <div className="hr-metric-top">
                  <span className="hr-metric-title">
                    <Clock size={13} /> Idade Média
                  </span>
                  <span className="hr-metric-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
                    Média
                  </span>
                </div>
                <div className="hr-metric-number">{idadeMedia ?? '—'} <span style={{ fontSize: 16 }}>anos</span></div>
                <div className="hr-metric-footnote">Perfil etário do quadro</div>
              </div>

              <div className="hr-metric-card">
                <div className="hr-metric-top">
                  <span className="hr-metric-title">
                    <BookOpen size={13} /> Escolaridades
                  </span>
                  <span className="hr-metric-badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed' }}>
                    Qualificação
                  </span>
                </div>
                <div className="hr-metric-number">{byEscol.length}</div>
                <div className="hr-metric-footnote">Graus de instrução mapeados</div>
              </div>
            </div>

            {/* Alertas Estratégicos & Governança */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
              {[
                {
                  icon: Shield,
                  label: 'Comissionados',
                  value: `${pct(alertas.nComiss, total)}%`,
                  sub: `${fmt(alertas.nComiss)} servidores`,
                  status: alertas.pctComiss > ALERTAS.maxPctComissionados ? 'alert' : 'ok',
                  link: '/servidores/comissionados',
                },
                {
                  icon: Clock,
                  label: 'Já Elegíveis à Aposentadoria',
                  value: fmt(alertas.elegiveis),
                  sub: 'Preencheram requisitos',
                  status: alertas.elegiveis > 0 ? 'warn' : 'ok',
                  link: '/servidores/aposentadoria',
                },
                {
                  icon: Clock,
                  label: `Elegíveis em até ${APOSENTADORIA.alertaAntes} anos`,
                  value: fmt(alertas.proximosN),
                  sub: 'Planejamento de sucessão',
                  status: alertas.proximosN > 200 ? 'alert' : alertas.proximosN > 0 ? 'warn' : 'ok',
                  link: '/servidores/aposentadoria',
                },
                {
                  icon: Database,
                  label: 'Cadastros Incompletos',
                  value: fmt(alertas.incompletos),
                  sub: 'Pendências cadastrais',
                  status: alertas.incompletos > 0 ? 'warn' : 'ok',
                  link: '/servidores/auditoria',
                },
              ].map(({ icon: Icon, label, value, sub, status, link }) => {
                const cor = status === 'alert' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#10b981';
                return (
                  <Link key={label} to={link} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'var(--surface)',
                        border: '1px solid var(--border-c)',
                        borderTop: `3px solid ${cor}`,
                        transition: 'transform 140ms ease, border-color 140ms ease',
                      }}
                      className="hover:translate-y-[-2px]"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Icon size={14} color={cor} />
                        <span style={{ fontSize: 10.5, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {value}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Gráfico Principal de Lotação + Mini-Pies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, marginBottom: 20, alignItems: 'start' }}>
              <div className="chart-card">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    Distribuição do Quadro por Secretaria
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-c)' }}>
                    Top {bySecretaria.length} órgãos com maior efetivo lotado
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={bySecretaria.length * 32 + 20}>
                  <BarChart data={bySecretaria} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={210}
                      tickFormatter={shortName}
                      tick={{ fill: 'var(--muted-c)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', fill: 'var(--muted-c)', fontSize: 11, formatter: fmt }}>
                      {bySecretaria.map((_, i) => (
                        <Cell key={i} fill={CORES_SEC[i % CORES_SEC.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <MiniPieCard title="Regime de Trabalho" data={byRegime} total={total} />
                <MiniPieCard title="Composição por Sexo" data={bySexo} total={total} />
                <MiniPieCard title="Padrão Administrativo" data={byPadrao} total={total} />
              </div>
            </div>

            {/* Escolaridade + Faixa Etária */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                  Nível de Escolaridade Declarado
                </div>
                <ResponsiveContainer width="100%" height={Math.max(byEscol.length * 30 + 20, 100)}>
                  <BarChart data={byEscol} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={200}
                      tickFormatter={shortName}
                      tick={{ fill: 'var(--muted-c)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} fill="#0D7C3D" label={{ position: 'right', fill: 'var(--muted-c)', fontSize: 11, formatter: fmt }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                  Pirâmide Etária do Quadro
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={byFaixa} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--muted-c)', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'var(--muted-c)', fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {byFaixa.map((_, i) => (
                        <Cell key={i} fill={CORES_FAIXA[i % CORES_FAIXA.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela Resumo Executivo */}
            {!filtroSec && (
              <div className="hr-table-container">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-c)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                    Balanço Funcional por Secretaria
                  </div>
                  <Link to="/servidores/diretorio" style={{ textDecoration: 'none', color: '#0D7C3D', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Ver Diretório Completo <ArrowRight size={13} />
                  </Link>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="hr-table">
                    <thead>
                      <tr>
                        <th>Secretaria Municipal</th>
                        <th style={{ width: '100px' }}>Sigla</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Servidores</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>% do Quadro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agrupar(dados, 'Des_Secretaria').map((row, i) => {
                        const sigla = dados.find((r) => r.Des_Secretaria === row.name)?.SiglaSec || '—';
                        return (
                          <tr key={row.name} className="hr-table-row">
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: CORES_SEC[i % CORES_SEC.length],
                                    flexShrink: 0,
                                  }}
                                />
                                {row.name}
                              </div>
                            </td>
                            <td>
                              <span className="hr-matricula-pill" style={{ color: '#0D7C3D' }}>
                                {sigla}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(row.value)}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--muted-c)', fontVariantNumeric: 'tabular-nums' }}>
                              {pct(row.value, dados.length)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
