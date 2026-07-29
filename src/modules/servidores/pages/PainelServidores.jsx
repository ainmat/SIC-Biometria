import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts';
import { Users, TrendingUp, Clock, BookOpen, AlertTriangle, Shield, Database } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado, anosParaAposentadoria, ALERTAS, APOSENTADORIA } from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

function parseBRDate(s) {
  if (!s) return null;
  const [dmy] = s.split(' ');
  const [d, m, y] = dmy.split('/');
  const dt = new Date(`${y}-${m}-${d}`);
  return isNaN(dt) ? null : dt;
}

function agrupar(arr, campo) {
  const acc = {};
  arr.forEach(r => { const k = r[campo] || 'Não informado'; acc[k] = (acc[k] || 0) + 1; });
  return Object.entries(acc).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
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

const FAIXA_ORDER = ['< 25','25–29','30–34','35–39','40–44','45–49','50–54','55–59','60+','Não informado'];
const CORES_SEC   = ['#0D7C3D','#0D7C3D','#10b981','#f97316','#ec4899','#a855f7','#14b8a6','#f59e0b','#ef4444','#0D7C3D','#06b6d4','#84cc16','#f43f5e','#0ea5e9','#d946ef'];
const CORES_PIE   = ['#0D7C3D','#10b981','#f97316','#ec4899','#a855f7','#0D7C3D','#f59e0b','#14b8a6'];
const CORES_FAIXA = ['#c7d2fe','#15A050','#818cf8','#0D7C3D','#0A6B33','#4338ca','#3730a3','#312e81','#64748b'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color, fontWeight: 600 }}>{fmt(p.value)} servidores</div>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, cor = '#0D7C3D' }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'linear-gradient(160deg, rgba(0, 0, 0, 0.02) 0%, rgba(0,0,0,.015) 100%)', border: '1px solid rgba(0, 0, 0, 0.05)', borderTop: `3px solid ${cor}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={cor} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function MiniPieCard({ title, data, total }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</div>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
        {data.slice(0, 5).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: CORES_PIE[i % CORES_PIE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--muted-c)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-c)', flexShrink: 0 }}>{pct(d.value, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PainelServidores() {
  const [dados,    setDados]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [erro,     setErro]     = useState(null);
  const [filtroSec, setFiltroSec] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const secretarias = useMemo(
    () => [...new Set(dados.map(r => r.Des_Secretaria).filter(Boolean))].sort(),
    [dados]
  );

  const {
    total, recentes, totalSecs, idadeMedia,
    bySecretaria, byRegime, bySexo, byPadrao, byEscol, byFaixa,
    alertas, saudeRisco,
  } = useMemo(() => {
    const doze = new Date(); doze.setFullYear(doze.getFullYear() - 1);
    const base = filtroSec ? dados.filter(r => r.Des_Secretaria === filtroSec) : dados;
    const total = base.length;

    if (!total) return {
      total: 0, recentes: 0, totalSecs: 0, idadeMedia: null,
      bySecretaria: [], byRegime: [], bySexo: [], byPadrao: [], byEscol: [], byFaixa: [],
      alertas: { nComiss: 0, pctComiss: 0, elegiveis: 0, proximosN: 0, incompletos: 0 },
      saudeRisco: [],
    };

    const recentes  = base.filter(r => { const dt = parseBRDate(r.DtAdmissao); return dt && dt >= doze; }).length;
    const totalSecs = filtroSec ? 1 : new Set(base.map(r => r.Des_Secretaria).filter(Boolean)).size;
    const idades    = base.map(r => Number(r.Idade)).filter(n => n > 0 && n < 120);
    const idadeMedia = idades.length > 0 ? (idades.reduce((a, b) => a + b, 0) / idades.length).toFixed(1) : null;

    const bySecretaria = agrupar(base, 'Des_Secretaria').slice(0, 15);
    const byRegime     = agrupar(base, 'Des_RegTrab');
    const bySexo       = agrupar(base, 'Sexo');
    const byPadrao     = agrupar(base, 'Des_Padrao_Adm');
    const byEscol      = agrupar(base, 'Des_GrInstrucao');

    const accF = {};
    base.forEach(r => { const f = faixaEtaria(r.Idade); accF[f] = (accF[f] || 0) + 1; });
    const byFaixa = FAIXA_ORDER.filter(f => accF[f]).map(f => ({ name: f, value: accF[f] }));

    // Alertas estratégicos (absorvidos do Cockpit)
    const nComiss    = base.filter(isComissionado).length;
    const pctComiss  = (nComiss / total) * 100;
    const elegiveis  = base.filter(r => anosParaAposentadoria(r) === 0).length;
    const proximosN  = base.filter(r => { const a = anosParaAposentadoria(r); return a > 0 && a <= APOSENTADORIA.alertaAntes; }).length;
    const incompletos = base.filter(r => !r.Nome_Funcionario?.trim() || !r.Des_Cargo?.trim() || !r.Des_Secretaria?.trim()).length;
    const alertas = { nComiss, pctComiss, elegiveis, proximosN, incompletos };

    // Widget de saúde: secretarias com % comissionados acima do limiar
    const bySecC = {};
    base.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecC[sec]) bySecC[sec] = { total: 0, comiss: 0 };
      bySecC[sec].total++;
      if (isComissionado(r)) bySecC[sec].comiss++;
    });
    const saudeRisco = Object.entries(bySecC)
      .filter(([, v]) => v.total >= 5)
      .map(([sec, v]) => ({ sec, pctC: (v.comiss / v.total) * 100 }))
      .filter(v => v.pctC > ALERTAS.maxPctComissionados)
      .sort((a, b) => b.pctC - a.pctC)
      .slice(0, 3);

    return { total, recentes, totalSecs, idadeMedia, bySecretaria, byRegime, bySexo, byPadrao, byEscol, byFaixa, alertas, saudeRisco };
  }, [dados, filtroSec]);

  const SEL = { padding: '7px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', fontSize: 12, outline: 'none' };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Painel de Servidores</h1>
          <p>Visão geral do quadro de pessoal</p>
        </div>
        <div className="topbar-right">
          <select value={filtroSec} onChange={e => setFiltroSec(e.target.value)} style={SEL}>
            <option value="">Todas as secretarias</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando dados...</div>}
        {erro    && <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}
        {!loading && !erro && total === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Users size={40} color="#334155" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, color: 'var(--muted-c)', fontWeight: 600 }}>Nenhum servidor encontrado</div>
          </div>
        )}

        {!loading && total > 0 && (
          <>
            {/* Disclaimer EC 103/2019 */}
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#b45309', fontSize: 11, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} />
              Indicadores de aposentadoria são estimativas (EC 103/2019). Confirme com RH/Jurídico antes de usar para decisões formais.
            </div>

            {/* Alertas estratégicos */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { icon: Shield,   label: 'Comissionados',           value: `${pct(alertas.nComiss, total)}%`, sub: `${fmt(alertas.nComiss)} servidores`,           status: alertas.pctComiss > ALERTAS.maxPctComissionados ? 'alert' : 'ok', link: '/servidores/comissionados' },
                { icon: Clock,    label: 'Já elegíveis',            value: fmt(alertas.elegiveis),            sub: 'atingiram os requisitos',                       status: alertas.elegiveis > 0 ? 'warn' : 'ok',                           link: '/servidores/aposentadoria' },
                { icon: Clock,    label: `Elegíveis em ${APOSENTADORIA.alertaAntes}a`, value: fmt(alertas.proximosN), sub: 'atenção à sucessão', status: alertas.proximosN > 200 ? 'alert' : alertas.proximosN > 0 ? 'warn' : 'ok', link: '/servidores/aposentadoria' },
                { icon: Database, label: 'Dados incompletos',       value: fmt(alertas.incompletos),          sub: 'campos críticos vazios',                        status: alertas.incompletos > 0 ? 'warn' : 'ok',                         link: '/servidores/auditoria' },
              ].map(({ icon: Icon, label, value, sub, status, link }) => {
                const cor = status === 'alert' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#10b981';
                return (
                  <Link key={label} to={link} style={{ flex: 1, minWidth: 155, textDecoration: 'none' }}>
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(160deg, rgba(0, 0, 0, 0.02) 0%, rgba(0,0,0,.015) 100%)', border: `1px solid ${status === 'alert' ? 'rgba(239,68,68,.3)' : status === 'warn' ? 'rgba(245,158,11,.3)' : 'rgba(0, 0, 0, 0.05)'}`, borderTop: `3px solid ${cor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Icon size={14} color={cor} />
                        <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cor, marginLeft: 'auto' }} />
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 4 }}>{sub}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Widget de saúde */}
            {saudeRisco.length > 0 && (
              <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
                    {saudeRisco.length} secretaria{saudeRisco.length > 1 ? 's' : ''} acima do limite de comissionados ({ALERTAS.maxPctComissionados}%)
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {saudeRisco.map(({ sec, pctC }) => (
                      <span key={sec} style={{ fontSize: 11, color: 'var(--muted-c)' }}>
                        <b style={{ color: '#dc2626' }}>{sec}</b> ({pctC.toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
                <Link to="/servidores/saude" style={{ textDecoration: 'none', color: '#dc2626', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Ver Índice de Saúde →
                </Link>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <KpiCard icon={Users}      label="Total de Servidores" value={total}            sub={`${totalSecs} secretaria${totalSecs !== 1 ? 's' : ''}`} cor="#0D7C3D" />
              <KpiCard icon={TrendingUp} label="Últ. 12 meses"       value={recentes}         sub="novas admissões"                                         cor="#10b981" />
              <KpiCard icon={Clock}      label="Idade média"          value={idadeMedia ?? '—'} sub="anos (média do quadro)"                                 cor="#f97316" />
              <KpiCard icon={BookOpen}   label="Escolaridades"        value={byEscol.length}   sub="níveis distintos registrados"                            cor="#a855f7" />
            </div>

            {/* Secretarias + mini-pies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14, marginBottom: 20, alignItems: 'start' }}>
              <div className="chart-card" style={{ minWidth: 0 }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Servidores por secretaria</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>Top {bySecretaria.length}</div>
                </div>
                <ResponsiveContainer width="100%" height={bySecretaria.length * 34 + 20}>
                  <BarChart data={bySecretaria} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22} label={{ position: 'right', fill: '#475569', fontSize: 11, formatter: fmt }}>
                      {bySecretaria.map((_, i) => <Cell key={i} fill={CORES_SEC[i % CORES_SEC.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <MiniPieCard title="Regime"      data={byRegime} total={total} />
                <MiniPieCard title="Sexo"        data={bySexo}   total={total} />
                <MiniPieCard title="Padrão Adm." data={byPadrao} total={total} />
              </div>
            </div>

            {/* Escolaridade + Faixa etária */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Nível de escolaridade</div>
                <ResponsiveContainer width="100%" height={Math.max(byEscol.length * 32 + 20, 80)}>
                  <BarChart data={byEscol} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20} fill="#0D7C3D" label={{ position: 'right', fill: '#475569', fontSize: 11, formatter: fmt }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Distribuição por faixa etária</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byFaixa} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {byFaixa.map((_, i) => <Cell key={i} fill={CORES_FAIXA[i % CORES_FAIXA.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela resumo (só no quadro completo) */}
            {!filtroSec && (
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Resumo por secretaria</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Secretaria','Sigla','Servidores','% do total'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-c)', textAlign: h === 'Servidores' || h === '% do total' ? 'right' : 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agrupar(dados, 'Des_Secretaria').map((row, i) => {
                        const sigla = dados.find(r => r.Des_Secretaria === row.name)?.SiglaSec || '—';
                        return (
                          <tr key={row.name} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: CORES_SEC[i % CORES_SEC.length], flexShrink: 0 }} />
                              {row.name}
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: '#15A050', fontFamily: 'monospace', fontWeight: 700 }}>{sigla}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.value)}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'right' }}>{pct(row.value, dados.length)}%</td>
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
