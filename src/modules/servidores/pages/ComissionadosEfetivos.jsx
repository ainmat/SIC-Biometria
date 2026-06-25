import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado, ALERTAS } from '@/modules/servidores/config/servidoresConfig';

const fmt  = (n) => Math.round(n).toLocaleString('pt-BR');
const pct  = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');

function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ef = payload.find(p => p.dataKey === 'efetivos');
  const co = payload.find(p => p.dataKey === 'comissionados');
  const total = (ef?.value || 0) + (co?.value || 0);
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{label}</div>
      {ef && <div style={{ color: '#10b981', marginBottom: 2 }}>Efetivos: {fmt(ef.value)} ({pct(ef.value, total)}%)</div>}
      {co && <div style={{ color: '#f97316' }}>Comissionados: {fmt(co.value)} ({pct(co.value, total)}%)</div>}
    </div>
  );
}

export default function ComissionadosEfetivos() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  useEffect(() => {
    fetchResumoServidores()
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  const { total, nComiss, nEfetivos, pctComiss, porSecretaria } = useMemo(() => {
    if (!dados.length) return { total: 0, nComiss: 0, nEfetivos: 0, pctComiss: 0, porSecretaria: [] };

    const total   = dados.length;
    const nComiss = dados.filter(isComissionado).length;
    const nEfetivos = total - nComiss;
    const pctComiss = total > 0 ? (nComiss / total) * 100 : 0;

    const bySecAcc = {};
    dados.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecAcc[sec]) bySecAcc[sec] = { total: 0, comiss: 0 };
      bySecAcc[sec].total++;
      if (isComissionado(r)) bySecAcc[sec].comiss++;
    });
    const porSecretaria = Object.entries(bySecAcc)
      .map(([sec, v]) => {
        const pctC = v.total > 0 ? (v.comiss / v.total) * 100 : 0;
        return {
          sec,
          efetivos: v.total - v.comiss,
          comissionados: v.comiss,
          pctC,
          labelComiss: v.comiss > 0 ? `${v.comiss} (${Math.round(pctC)}%)` : '',
        };
      })
      .sort((a, b) => b.comissionados - a.comissionados)
      .slice(0, 20);

    return { total, nComiss, nEfetivos, pctComiss, porSecretaria };
  }, [dados]);

  const alerta = pctComiss > ALERTAS.maxPctComissionados;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Comissionados × Efetivos</h1>
          <p>Composição do quadro por tipo de vínculo</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569', fontSize: 14 }}>Carregando dados...</div>}
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && total > 0 && (
          <>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 11, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={13} />
              Classificação por texto em Des_CategSefip / Des_Padrao_Adm (padrões configuráveis). Confirme com RH a lista definitiva de cargos em comissão.
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total de servidores', val: fmt(total),     sub: '100% do quadro',               cor: '#6366f1' },
                { label: 'Efetivos',            val: fmt(nEfetivos), sub: `${pct(nEfetivos, total)}% do quadro`, cor: '#10b981' },
                { label: 'Comissionados',        val: fmt(nComiss),   sub: `${pct(nComiss, total)}% do quadro`,  cor: alerta ? '#ef4444' : '#f97316' },
              ].map(({ label, val, sub, cor }) => (
                <div key={label} style={{ flex: 1, minWidth: 180, background: 'linear-gradient(160deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.015) 100%)', border: '1px solid rgba(255,255,255,.08)', borderTop: `3px solid ${cor}`, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{label}</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#f8fafc', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{sub}</div>
                </div>
              ))}
              {alerta && (
                <div style={{ flex: 1, minWidth: 180, padding: '16px 20px', borderRadius: 14, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>Limite excedido</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Acima do limiar configurado de {ALERTAS.maxPctComissionados}%</div>
                  </div>
                </div>
              )}
            </div>

            {/* Gráfico de barras empilhadas */}
            <div className="chart-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>Composição por secretaria</div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 14 }}>Efetivos × comissionados — ordenado por número de comissionados</div>
              <ResponsiveContainer width="100%" height={porSecretaria.length * 34 + 20}>
                <BarChart data={porSecretaria} layout="vertical" margin={{ left: 8, right: 60, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="sec" width={200} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                  <Bar dataKey="efetivos"      name="Efetivos"      stackId="a" fill="#10b981" maxBarSize={22} />
                  <Bar dataKey="comissionados" name="Comissionados" stackId="a" fill="#f97316" maxBarSize={22} radius={[0, 4, 4, 0]}
                    label={{
                      position: 'right', fill: '#475569', fontSize: 10,
                      content: ({ x, y, width, height, index }) => {
                        const d = porSecretaria[index];
                        if (!d || !d.comissionados) return null;
                        return (
                          <text x={x + width + 5} y={y + height / 2 + 4} fill="#475569" fontSize={10} textAnchor="start">
                            {d.labelComiss}
                          </text>
                        );
                      },
                    }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Link para Diretório */}
            <Link to="/servidores/diretorio" style={{ textDecoration: 'none' }}>
              <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color .15s, background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'; e.currentTarget.style.background = 'rgba(99,102,241,.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc' }}>Ver lista completa de comissionados no Diretório</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{fmt(nComiss)} registros — busca com filtro por padrão administrativo</div>
                </div>
                <span style={{ fontSize: 18, color: '#6366f1' }}>→</span>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
