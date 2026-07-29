import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado, anosParaAposentadoria, APOSENTADORIA } from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const diff = (a, b) => { const d = b - a; return d >= 0 ? `+${fmt(d)}` : fmt(d); };

function Slider({ label, value, onChange, min = 0, max = 100, step = 1, cor = '#0D7C3D', suffix = '%', hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{value}{suffix}</span>
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 6 }}>{hint}</div>}
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: cor, cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text)' }}>{min}{suffix}</span>
        <span style={{ fontSize: 10, color: 'var(--text)' }}>{max}{suffix}</span>
      </div>
    </div>
  );
}

function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const at = payload.find(p => p.dataKey === 'atual');
  const pr = payload.find(p => p.dataKey === 'projetado');
  const d = pr && at ? pr.value - at.value : 0;
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      {at && <div style={{ color: '#0D7C3D' }}>Atual: {fmt(at.value)}</div>}
      {pr && <div style={{ color: '#10b981' }}>Projetado: {fmt(pr.value)}</div>}
      {d !== 0 && <div style={{ color: d < 0 ? '#ef4444' : '#047857', fontWeight: 700, marginTop: 4 }}>{d > 0 ? '+' : ''}{fmt(d)} servidores</div>}
    </div>
  );
}

export default function SimuladorCenarios() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  const [horizonte,    setHorizonte]    = useState(5);   // anos para aposentadoria
  const [pctAposenta,  setPctAposenta]  = useState(80);  // % dos elegíveis que efetivamente saem
  const [pctCortaComiss, setPctCortaComiss] = useState(0);  // % de comissionados cortados
  const [admissoesNova, setAdmissoesNova]   = useState(0);  // novas admissões
  const [filtroSec, setFiltroSec] = useState('');

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const secretarias = useMemo(() => [...new Set(dados.map(r => r.Des_Secretaria).filter(Boolean))].sort(), [dados]);

  const { resumo, porSecretaria } = useMemo(() => {
    const base = filtroSec ? dados.filter(r => r.Des_Secretaria === filtroSec) : dados;
    if (!base.length) return { resumo: {}, porSecretaria: [] };

    const elegiveisN = base.filter(r => anosParaAposentadoria(r) <= horizonte && anosParaAposentadoria(r) >= 0);
    const comissArr  = base.filter(isComissionado);

    const saemAposent = Math.round(elegiveisN.length * pctAposenta / 100);
    const saemComiss  = Math.round(comissArr.length * pctCortaComiss / 100);
    const total       = base.length;
    const projetado   = total - saemAposent - saemComiss + admissoesNova;

    const resumo = { total, saemAposent, saemComiss, admissoesNova, projetado, variacao: projetado - total, nElegiveis: elegiveisN.length, nComiss: comissArr.length };

    // Por secretaria
    const bySecAcc = {};
    base.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecAcc[sec]) bySecAcc[sec] = { total: 0, elegiveis: 0, comiss: 0 };
      bySecAcc[sec].total++;
      if (anosParaAposentadoria(r) <= horizonte) bySecAcc[sec].elegiveis++;
      if (isComissionado(r)) bySecAcc[sec].comiss++;
    });

    const porSecretaria = Object.entries(bySecAcc)
      .map(([sec, v]) => {
        const saemA = Math.round(v.elegiveis * pctAposenta / 100);
        const saemC = Math.round(v.comiss * pctCortaComiss / 100);
        const proj  = v.total - saemA - saemC;
        return { sec, atual: v.total, projetado: proj, delta: proj - v.total };
      })
      .sort((a, b) => a.delta - b.delta) // mais impactados primeiro
      .slice(0, 20);

    return { resumo, porSecretaria };
  }, [dados, horizonte, pctAposenta, pctCortaComiss, admissoesNova, filtroSec]);

  const SEL = { padding: '7px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', fontSize: 12, outline: 'none' };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Simulador de Cenários</h1>
          <p>Projete o impacto de aposentadorias, cortes e novas admissões</p>
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
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando...</div>}
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && dados.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Painel de controles */}
            <div style={{ position: 'sticky', top: 20 }}>
              <div className="chart-card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Parâmetros do cenário</div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#b45309', fontSize: 10, marginBottom: 16, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <AlertTriangle size={11} style={{ marginTop: 1, flexShrink: 0 }} />
                  Estimativas de aposentadoria baseadas em parâmetros configuráveis (EC 103/2019). Confirme com RH.
                </div>

                <Slider label="Horizonte de aposentadoria" value={horizonte} onChange={setHorizonte} min={0} max={10} step={1} cor="#f59e0b" suffix=" anos"
                  hint={`Considera elegíveis em até ${horizonte} anos. Hoje: ${fmt(resumo.nElegiveis || 0)} elegíveis.`} />

                <Slider label="% dos elegíveis que saem" value={pctAposenta} onChange={setPctAposenta} min={0} max={100} cor="#ef4444"
                  hint={`${fmt(resumo.saemAposent || 0)} servidores saem por aposentadoria.`} />

                <Slider label="% de corte em comissionados" value={pctCortaComiss} onChange={setPctCortaComiss} min={0} max={100} cor="#f97316"
                  hint={`${fmt(resumo.saemComiss || 0)} comissionados saem (de ${fmt(resumo.nComiss || 0)}).`} />

                <Slider label="Novas admissões" value={admissoesNova} onChange={setAdmissoesNova} min={0} max={2000} step={10} cor="#10b981"
                  hint="Contratações novas no período projetado." />
              </div>

              {/* Resumo */}
              {resumo.total > 0 && (
                <div className="chart-card">
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Resultado do cenário</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Quadro atual',          val: fmt(resumo.total),       cor: '#0D7C3D' },
                      { label: `Saem (aposentadoria)`,  val: `−${fmt(resumo.saemAposent)}`, cor: '#ef4444' },
                      { label: 'Saem (comissionados)',  val: `−${fmt(resumo.saemComiss)}`,  cor: '#f97316' },
                      { label: 'Novas admissões',       val: `+${fmt(resumo.admissoesNova)}`, cor: '#10b981' },
                    ].map(({ label, val, cor }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.05)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>Quadro projetado</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: resumo.variacao < 0 ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>{fmt(resumo.projetado)}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: resumo.variacao < 0 ? '#dc2626' : '#047857', fontWeight: 600 }}>
                      {resumo.variacao > 0 ? '+' : ''}{fmt(resumo.variacao)} servidores ({resumo.total > 0 ? ((resumo.variacao / resumo.total) * 100).toFixed(1) : 0}%)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Gráfico por secretaria */}
            <div className="chart-card">
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Impacto por secretaria</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Top 20 mais impactadas — barras paralelas: atual × projetado</div>
              <ResponsiveContainer width="100%" height={porSecretaria.length * 48 + 40}>
                <BarChart data={porSecretaria} layout="vertical" margin={{ left: 8, right: 80, top: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="sec" width={200} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  <Legend formatter={v => <span style={{ color: 'var(--muted-c)', fontSize: 11 }}>{v === 'atual' ? 'Atual' : 'Projetado'}</span>} />
                  <Bar dataKey="atual"     name="atual"     fill="#0D7C3D" maxBarSize={14} radius={[0, 3, 3, 0]}
                    label={{ position: 'right', fill: '#475569', fontSize: 9, formatter: fmt }} />
                  <Bar dataKey="projetado" name="projetado" fill="#10b981" maxBarSize={14} radius={[0, 3, 3, 0]}
                    label={{
                      content: ({ x, y, width, height, index }) => {
                        const d = porSecretaria[index];
                        if (!d) return null;
                        const deltaStr = d.delta !== 0 ? ` (${d.delta > 0 ? '+' : ''}${fmt(d.delta)})` : '';
                        return <text x={x + width + 5} y={y + height / 2 + 4} fill="#475569" fontSize={9} textAnchor="start">{fmt(d.projetado)}{deltaStr}</text>;
                      },
                    }}>
                    {porSecretaria.map((d, i) => <Cell key={i} fill={d.delta < 0 ? '#ef4444' : d.delta > 0 ? '#10b981' : '#0D7C3D'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
