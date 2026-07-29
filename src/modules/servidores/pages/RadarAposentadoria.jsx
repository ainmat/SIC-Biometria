import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import {
  computeFaixa, computePenhasco, anosAteElegivel,
  PROJECAO, RGPS, PROFESSOR,
} from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const SEL = { padding: '7px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', fontSize: 12, outline: 'none' };

// Faixas exibidas no gráfico (da mais confiante para a menos)
const FAIXAS = [
  { key: 'provavelmente_elegivel', label: 'Provável',              cor: '#10b981' },
  { key: 'possivelmente_elegivel', label: 'Possível (requer CNIS)', cor: '#f59e0b' },
  { key: 'elegivel_por_idade',     label: 'Compulsória (75a)',      cor: '#ef4444' },
];

const HORIZONTES = [0, 3, 5, 10];

function TooltipProj({ active, payload, label, apenasIdade }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      {apenasIdade
        ? <div style={{ color: '#15A050' }}>{fmt(total)} elegíveis (por idade)</div>
        : payload.map((p, i) => p.value > 0 && (
          <div key={i} style={{ color: p.fill, marginBottom: 2 }}>
            {FAIXAS.find(f => f.key === p.dataKey)?.label ?? p.dataKey}: {fmt(p.value)}
          </div>
        ))}
    </div>
  );
}

function TooltipPenhasco({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Ano +{label}</div>
      <div style={{ color: '#f97316' }}>{fmt(payload[0].value)} novos elegíveis</div>
    </div>
  );
}

function TooltipSec({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#f97316' }}>{d?.expostos} de {d?.total} ({payload[0].value.toFixed(1)}%)</div>
    </div>
  );
}

export default function RadarAposentadoria() {
  const [dados,     setDados]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [erro,      setErro]      = useState(null);
  const [filtroSec, setFiltroSec] = useState('');
  const [apenasIdade, setApenasIdade] = useState(false);

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const secretarias = useMemo(() => [...new Set(dados.map(r => r.Des_Secretaria).filter(Boolean))].sort(), [dados]);

  const { kpis, projChart, penhasco, secExpostas, pessoasChave } = useMemo(() => {
    const base = filtroSec ? dados.filter(r => r.Des_Secretaria === filtroSec) : dados;
    if (!base.length) return { kpis: {}, projChart: [], penhasco: [], secExpostas: [], pessoasChave: [] };

    // KPIs hoje
    const hoje = { provavelmente_elegivel: 0, possivelmente_elegivel: 0, elegivel_por_idade: 0, nao_elegivel: 0 };
    base.forEach(r => hoje[computeFaixa(r, 0)]++);
    const kpis = {
      total: base.length,
      totalElegiveis: hoje.provavelmente_elegivel + hoje.possivelmente_elegivel + hoje.elegivel_por_idade,
      provavel:       hoje.provavelmente_elegivel,
      possivel:       hoje.possivelmente_elegivel,
    };

    // Projeção por horizonte fixo (0, 3, 5, 10 anos)
    const projChart = HORIZONTES.map(N => {
      const c = { provavelmente_elegivel: 0, possivelmente_elegivel: 0, elegivel_por_idade: 0 };
      base.forEach(r => { const f = computeFaixa(r, N); if (f !== 'nao_elegivel') c[f]++; });
      return { label: N === 0 ? 'Hoje' : `+${N}a`, ...c, total: c.provavelmente_elegivel + c.possivelmente_elegivel + c.elegivel_por_idade };
    });

    // Penhasco: novos elegíveis ano a ano
    const penhasco = computePenhasco(base, PROJECAO.maxCurvaAnos);

    // Secretarias mais expostas em até PROJECAO.horizonteAnos
    const bySecAcc = {};
    dados.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecAcc[sec]) bySecAcc[sec] = { total: 0, expostos: 0 };
      bySecAcc[sec].total++;
      if (computeFaixa(r, PROJECAO.horizonteAnos) !== 'nao_elegivel') bySecAcc[sec].expostos++;
    });
    const secExpostas = Object.entries(bySecAcc)
      .filter(([, v]) => v.total >= 5)
      .map(([sec, v]) => ({ sec, pct: (v.expostos / v.total) * 100, expostos: v.expostos, total: v.total }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 12);

    // Cargos críticos: único ocupante + elegível em até horizonte anos
    const roleCount = {};
    dados.forEach(r => {
      const key = `${r.Des_Cargo}||${r.Des_LocalTrab}`;
      if (!roleCount[key]) roleCount[key] = [];
      roleCount[key].push(r);
    });
    const pessoasChave = base
      .filter(r => {
        const key = `${r.Des_Cargo}||${r.Des_LocalTrab}`;
        const anos = anosAteElegivel(r);
        return roleCount[key]?.length === 1 && anos <= PROJECAO.horizonteAnos;
      })
      .map(r => ({ ...r, anosAte: anosAteElegivel(r), faixa: computeFaixa(r, 0) }))
      .sort((a, b) => a.anosAte - b.anosAte)
      .slice(0, 50);

    return { kpis, projChart, penhasco, secExpostas, pessoasChave };
  }, [dados, filtroSec]);

  const corFaixa = (f) =>
    f === 'provavelmente_elegivel' ? '#10b981' :
    f === 'possivelmente_elegivel' ? '#f59e0b' :
    f === 'elegivel_por_idade'     ? '#ef4444' : '#475569';

  const labelFaixa = (f) =>
    f === 'provavelmente_elegivel' ? 'Provável' :
    f === 'possivelmente_elegivel' ? 'Possível' :
    f === 'elegivel_por_idade'     ? 'Compulsória' : '—';

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Radar de Aposentadoria</h1>
          <p>Projeção de saídas e identificação de cargos sem sucessão</p>
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
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && dados.length > 0 && (
          <>
            {/* Disclaimer */}
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#b45309', fontSize: 11, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <AlertTriangle size={13} />
                <b>Estimativa para priorização — não é decisão jurídica.</b>
              </div>
              <div style={{ color: 'var(--muted-c)', lineHeight: 1.6 }}>
                Dados usados: <b>idade</b> (confiável) · <b>tempo nesta prefeitura</b> (piso — pode subestimar elegíveis com CNIS anterior).
                Limiares: RGPS H {RGPS.idadeMin.H}a/{RGPS.contribMinAnos.H}a contrib · M {RGPS.idadeMin.M}a/{RGPS.contribMinAnos.M}a (⚠️ CONFIRMAR).
                Professores: redução de {PROFESSOR.reducaoIdadeAnos}a (⚠️ CONFIRMAR padrões em Des_Cargo).
                Regras de transição (pontos, pedágio) e RPPS não modelados. A elegibilidade definitiva depende do CNIS completo e validação caso a caso pelo RH.
              </div>
            </div>

            {/* KPIs hoje */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total na base',          val: fmt(kpis.total),          sub: filtroSec || 'quadro completo',              cor: '#0D7C3D' },
                { label: 'Elegíveis hoje (total)',  val: fmt(kpis.totalElegiveis), sub: 'qualquer faixa',                            cor: '#f97316' },
                { label: 'Provável',                val: fmt(kpis.provavel),       sub: 'idade + tempo de casa ok',                  cor: '#10b981' },
                { label: 'Possível (requer CNIS)',  val: fmt(kpis.possivel),       sub: 'idade ok · tempo de casa insuficiente',     cor: '#f59e0b' },
              ].map(({ label, val, sub, cor }) => (
                <div key={label} style={{ flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: `3px solid ${cor}` }}>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Projeção + Penhasco */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {/* Projeção por horizonte */}
              <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Elegíveis por horizonte</div>
                  <button onClick={() => setApenasIdade(v => !v)} style={{ padding: '4px 10px', borderRadius: 6, background: apenasIdade ? 'rgba(13,124,61,.2)' : 'rgba(0, 0, 0, 0.02)', border: `1px solid ${apenasIdade ? 'rgba(13,124,61,.5)' : 'rgba(0, 0, 0, 0.06)'}`, color: apenasIdade ? '#15A050' : '#64748b', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                    Apenas por idade
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>
                  {apenasIdade ? 'Total elegíveis (condição de idade atingida)' : 'Empilhado por faixa de confiança'}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={projChart} margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<TooltipProj apenasIdade={apenasIdade} />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    {apenasIdade ? (
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={48} fill="#0D7C3D"
                        label={{ position: 'top', fill: '#475569', fontSize: 10, formatter: fmt }} />
                    ) : (
                      FAIXAS.map((f, i) => (
                        <Bar key={f.key} dataKey={f.key} name={f.label} stackId="a" fill={f.cor} maxBarSize={48}
                          radius={i === FAIXAS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))
                    )}
                    {!apenasIdade && <Legend formatter={v => <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>{v}</span>} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Penhasco demográfico */}
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Penhasco demográfico</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Novos elegíveis em cada ano — picos indicam ondas de saída potencial</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={penhasco} margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                    <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `+${v}a`} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<TooltipPenhasco />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="novos" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {penhasco.map((d, i) => <Cell key={i} fill={d.novos > 300 ? '#ef4444' : d.novos > 150 ? '#f97316' : '#0D7C3D'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Secretarias mais expostas */}
            <div className="chart-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Secretarias mais expostas</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>% com saída projetada em até {PROJECAO.horizonteAnos} anos (qualquer faixa)</div>
              <ResponsiveContainer width="100%" height={secExpostas.length * 32 + 20}>
                <BarChart data={secExpostas} layout="vertical" margin={{ left: 8, right: 70, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis type="category" dataKey="sec" width={160} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipSec />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={20} fill="#f97316"
                    label={{ position: 'right', fill: '#475569', fontSize: 10, formatter: v => `${v.toFixed(0)}%` }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cargos críticos */}
            <div className="chart-card">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Cargos críticos — único ocupante</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>
                  Servidores únicos no cargo+local com elegibilidade em até {PROJECAO.horizonteAnos} anos — risco de lacuna sem sucessão
                </div>
              </div>
              {pessoasChave.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text)', fontSize: 13 }}>Nenhum cargo crítico identificado com os filtros aplicados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Servidor','Cargo','Local de trabalho','Secretaria','Idade','Tempo de casa','Faltam','Faixa'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasChave.map(r => (
                        <tr key={r.Matricula} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.Nome_Funcionario || '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted-c)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Des_Cargo || '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted-c)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Des_LocalTrab || '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted-c)', whiteSpace: 'nowrap' }}>{r.SiglaSec || '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text)', textAlign: 'center' }}>{r.Idade || '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#15A050', whiteSpace: 'nowrap' }}>{r.Tempo_Contrato_Anos != null ? `${r.Tempo_Contrato_Anos} anos` : '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: r.anosAte === 0 ? '#ef4444' : r.anosAte <= 2 ? '#f97316' : '#f59e0b', whiteSpace: 'nowrap' }}>
                            {r.anosAte === 0 ? 'Já elegível' : `${r.anosAte} ano${r.anosAte !== 1 ? 's' : ''}`}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: corFaixa(r.faixa), background: `${corFaixa(r.faixa)}15`, padding: '2px 7px', borderRadius: 5, border: `1px solid ${corFaixa(r.faixa)}40` }}>
                              {labelFaixa(r.faixa)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
