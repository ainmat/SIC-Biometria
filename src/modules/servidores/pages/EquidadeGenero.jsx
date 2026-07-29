import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado } from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');

const COR_F = '#ec4899';
const COR_M = '#0D7C3D';

function PieDuplo({ title, sub, dataF, dataM, total }) {
  const pieData = [
    { name: 'Feminino', value: dataF, fill: COR_F },
    { name: 'Masculino', value: dataM, fill: COR_M },
  ];
  return (
    <div style={{ flex: 1, minWidth: 200, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted-c)', marginBottom: 10 }}>{sub}</div>}
      <ResponsiveContainer width="100%" height={100}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={2}>
            {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${fmt(v)} (${pct(v, total)}%)`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {pieData.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: d.fill }} />
              <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)' }}>{pct(d.value, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const f = payload.find(p => p.dataKey === 'pctFem');
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      {f && <div style={{ color: COR_F }}>Feminino: {f.value.toFixed(1)}%</div>}
    </div>
  );
}

export default function EquidadeGenero() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const { geral, comiss, efetivos, porSecretaria, paridade } = useMemo(() => {
    if (!dados.length) return { geral: {}, comiss: {}, efetivos: {}, porSecretaria: [], paridade: 1 };

    const contar = (arr) => {
      const f = arr.filter(r => (r.Sexo || '').toLowerCase().startsWith('f')).length;
      const m = arr.filter(r => (r.Sexo || '').toLowerCase().startsWith('m')).length;
      return { f, m, total: f + m, pctF: arr.length > 0 ? (f / arr.length) * 100 : 0 };
    };

    const comissArr  = dados.filter(isComissionado);
    const efetArr    = dados.filter(r => !isComissionado(r));

    const geral   = contar(dados);
    const comiss  = contar(comissArr);
    const efetivos = contar(efetArr);

    // % feminino por secretaria
    const bySecAcc = {};
    dados.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecAcc[sec]) bySecAcc[sec] = { f: 0, total: 0, comissF: 0, comissTotal: 0 };
      bySecAcc[sec].total++;
      if ((r.Sexo || '').toLowerCase().startsWith('f')) bySecAcc[sec].f++;
      if (isComissionado(r)) {
        bySecAcc[sec].comissTotal++;
        if ((r.Sexo || '').toLowerCase().startsWith('f')) bySecAcc[sec].comissF++;
      }
    });
    const porSecretaria = Object.entries(bySecAcc)
      .filter(([, v]) => v.total >= 5)
      .map(([sec, v]) => ({
        sec,
        pctFem: v.total > 0 ? (v.f / v.total) * 100 : 0,
        pctFemComiss: v.comissTotal > 0 ? (v.comissF / v.comissTotal) * 100 : 0,
        total: v.total,
        f: v.f,
      }))
      .sort((a, b) => b.pctFem - a.pctFem);

    // Índice de paridade: % F em comissão / % F geral (1.0 = perfeita paridade)
    const paridade = geral.pctF > 0 ? comiss.pctF / geral.pctF : 1;

    return { geral, comiss, efetivos, porSecretaria, paridade };
  }, [dados]);

  const paridadeLabel = paridade < 0.7 ? { txt: 'Teto de vidro identificado', cor: '#ef4444' }
    : paridade < 0.9 ? { txt: 'Leve sub-representação feminina', cor: '#f59e0b' }
    : { txt: 'Paridade razoável na liderança', cor: '#10b981' };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Equidade de Gênero na Liderança</h1>
          <p>Representação feminina no quadro geral e nos cargos de comando</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando...</div>}
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && dados.length > 0 && (
          <>
            {/* Índice de paridade */}
            <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: `${paridadeLabel.cor}10`, border: `1px solid ${paridadeLabel.cor}40`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: paridadeLabel.cor, fontVariantNumeric: 'tabular-nums' }}>{paridade.toFixed(2)}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{paridadeLabel.txt}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 3 }}>
                  Índice de paridade = % feminino nos cargos em comissão ÷ % feminino no quadro geral. 1,00 = paridade perfeita.
                </div>
              </div>
            </div>

            {/* Donuts comparativos */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <PieDuplo title="Quadro geral"         sub={`${fmt(geral.total)} servidores`}    dataF={geral.f}    dataM={geral.m}    total={geral.total} />
              <PieDuplo title="Efetivos"             sub={`${fmt(efetivos.total)} servidores`} dataF={efetivos.f} dataM={efetivos.m} total={efetivos.total} />
              <PieDuplo title="Comissionados"        sub={`${fmt(comiss.total)} servidores`}   dataF={comiss.f}   dataM={comiss.m}   total={comiss.total} />

              {/* KPI % F em comissão vs geral */}
              <div style={{ flex: 1, minWidth: 200, padding: '16px 18px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Comparativo feminino</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Quadro geral',  pctF: geral.pctF, cor: '#64748b' },
                    { label: 'Efetivos',      pctF: efetivos.pctF, cor: '#10b981' },
                    { label: 'Comissionados', pctF: comiss.pctF, cor: COR_F },
                  ].map(({ label, pctF, cor }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{pctF.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${pctF}%`, background: cor, transition: 'width .4s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* % feminino por secretaria */}
            <div className="chart-card">
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>% Feminino por secretaria</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Ordenado do maior para o menor — referência: {geral.pctF.toFixed(1)}% no quadro geral</div>
              <ResponsiveContainer width="100%" height={porSecretaria.length * 32 + 20}>
                <BarChart data={porSecretaria} layout="vertical" margin={{ left: 8, right: 60, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis type="category" dataKey="sec" width={200} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  {/* Linha de referência (média geral) - emulada com a barra de fundo */}
                  <Bar dataKey="pctFem" maxBarSize={18} radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fill: '#475569', fontSize: 10, formatter: v => `${v.toFixed(0)}%` }}>
                    {porSecretaria.map((d, i) => (
                      <Cell key={i} fill={d.pctFem >= geral.pctF ? COR_F : '#475569'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: COR_F }} />
                  <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Acima da média geral ({geral.pctF.toFixed(0)}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#475569' }} />
                  <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Abaixo da média geral</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
