import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado } from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');

// ── Eleições municipais ──────────────────────────────────────────────────────
const ELEICOES = new Set([2000, 2004, 2008, 2012, 2016, 2020, 2024]);

function parseBRYear(s) {
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length >= 3) {
    const y = parseInt(parts[2]);
    return y > 1900 && y <= 2100 ? y : null;
  }
  return null;
}

// ── Cores ────────────────────────────────────────────────────────────────────
const COR_F = '#ec4899';
const COR_M = '#0D7C3D';

// ── Tooltips ─────────────────────────────────────────────────────────────────
function TooltipGenero({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const f = payload.find(p => p.dataKey === 'pctFem');
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      {f && <div style={{ color: COR_F }}>Feminino: {f.value.toFixed(1)}%</div>}
    </div>
  );
}

function TooltipOndas({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const eleicao = ELEICOES.has(Number(label));
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: `1px solid ${eleicao ? 'rgba(245,158,11,.4)' : 'rgba(0, 0, 0, 0.07)'}`, borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: eleicao ? '#b45309' : '#1e293b', marginBottom: 4 }}>
        {label}{eleicao ? ' — Eleição' : ''}
      </div>
      {payload.map((p, i) => <div key={i} style={{ color: p.fill || '#15A050' }}>{fmt(p.value)} admissões</div>)}
    </div>
  );
}

// ── PieDuplo (equidade) ──────────────────────────────────────────────────────
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

// ── Componente principal ─────────────────────────────────────────────────────
export default function PerfilQuadro() {
  const [dados,    setDados]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [erro,     setErro]     = useState(null);
  const [aba,      setAba]      = useState('genero');
  const [filtroSec, setFiltroSec] = useState('');
  const [decada,   setDecada]   = useState(false);

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const secretarias = useMemo(
    () => [...new Set(dados.map(r => r.Des_Secretaria).filter(Boolean))].sort(),
    [dados]
  );

  // ── Dados de Equidade ────────────────────────────────────────────────────
  const equidade = useMemo(() => {
    const base = filtroSec ? dados.filter(r => r.Des_Secretaria === filtroSec) : dados;
    if (!base.length) return null;

    const contar = (arr) => {
      const f = arr.filter(r => (r.Sexo || '').toLowerCase().startsWith('f')).length;
      const m = arr.filter(r => (r.Sexo || '').toLowerCase().startsWith('m')).length;
      return { f, m, total: f + m, pctF: arr.length > 0 ? (f / arr.length) * 100 : 0 };
    };

    const comissArr = base.filter(isComissionado);
    const efetArr   = base.filter(r => !isComissionado(r));
    const geral     = contar(base);
    const comiss    = contar(comissArr);
    const efetivos  = contar(efetArr);
    const paridade  = geral.pctF > 0 ? comiss.pctF / geral.pctF : 1;

    const bySecAcc = {};
    base.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecAcc[sec]) bySecAcc[sec] = { f: 0, total: 0 };
      bySecAcc[sec].total++;
      if ((r.Sexo || '').toLowerCase().startsWith('f')) bySecAcc[sec].f++;
    });
    const porSecretaria = Object.entries(bySecAcc)
      .filter(([, v]) => v.total >= 5)
      .map(([sec, v]) => ({ sec, pctFem: (v.f / v.total) * 100, total: v.total }))
      .sort((a, b) => b.pctFem - a.pctFem);

    return { geral, comiss, efetivos, paridade, porSecretaria };
  }, [dados, filtroSec]);

  // ── Dados de Ondas ───────────────────────────────────────────────────────
  const ondas = useMemo(() => {
    const base = filtroSec ? dados.filter(r => r.Des_Secretaria === filtroSec) : dados;
    if (!base.length) return null;

    const accAnual = {};
    const accDecada = {};
    base.forEach(r => {
      const ano = parseBRYear(r.DtAdmissao);
      if (!ano) return;
      accAnual[ano] = (accAnual[ano] || 0) + 1;
      const dec = Math.floor(ano / 10) * 10;
      accDecada[dec] = (accDecada[dec] || 0) + 1;
    });

    const porAno = Object.entries(accAnual)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([ano, count]) => ({ ano: Number(ano), count, eleicao: ELEICOES.has(Number(ano)) }));

    const porDecada = Object.entries(accDecada)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([dec, count]) => ({ dec: `${dec}s`, count }));

    const topAnos = [...porAno].sort((a, b) => b.count - a.count).slice(0, 3);

    const eleicaoAnos   = porAno.filter(d => d.eleicao);
    const normalAnos    = porAno.filter(d => !d.eleicao);
    const mediaEleicao  = eleicaoAnos.length > 0 ? eleicaoAnos.reduce((s, d) => s + d.count, 0) / eleicaoAnos.length : 0;
    const mediaNormal   = normalAnos.length  > 0 ? normalAnos.reduce((s, d) => s + d.count, 0)  / normalAnos.length  : 0;

    return { porAno, porDecada, topAnos, mediaEleicao, mediaNormal, nEleicaoAnos: eleicaoAnos.length, nNormalAnos: normalAnos.length };
  }, [dados, filtroSec]);

  const SEL = { padding: '7px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', fontSize: 12, outline: 'none' };

  const paridadeLabel = equidade
    ? equidade.paridade < 0.7 ? { txt: 'Teto de vidro identificado', cor: '#ef4444' }
    : equidade.paridade < 0.9 ? { txt: 'Leve sub-representação feminina', cor: '#f59e0b' }
    : { txt: 'Paridade razoável na liderança', cor: '#10b981' }
    : null;

  const chartOndas = ondas
    ? (decada
      ? ondas.porDecada.map(d => ({ ano: d.dec, count: d.count, eleicao: false }))
      : ondas.porAno)
    : [];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Perfil do Quadro</h1>
          <p>Equidade de gênero e histórico de contratações</p>
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
          <>
            {/* Abas */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { id: 'genero', label: 'Equidade de Gênero' },
                { id: 'ondas',  label: 'Ondas de Contratação' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setAba(id)} style={{ padding: '8px 18px', borderRadius: 8, background: aba === id ? 'rgba(13,124,61,.2)' : 'rgba(0, 0, 0, 0.02)', border: `1px solid ${aba === id ? 'rgba(13,124,61,.5)' : 'rgba(0, 0, 0, 0.05)'}`, color: aba === id ? '#15A050' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── ABA: EQUIDADE ── */}
            {aba === 'genero' && equidade && (
              <>
                {/* Índice de paridade */}
                <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: `${paridadeLabel.cor}10`, border: `1px solid ${paridadeLabel.cor}40`, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: paridadeLabel.cor, fontVariantNumeric: 'tabular-nums' }}>{equidade.paridade.toFixed(2)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{paridadeLabel.txt}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 3 }}>
                      Índice de paridade = % feminino nos cargos em comissão ÷ % feminino no quadro geral. 1,00 = paridade perfeita.
                    </div>
                  </div>
                </div>

                {/* Donuts */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                  <PieDuplo title="Efetivos"      sub={`${fmt(equidade.efetivos.total)} servidores`} dataF={equidade.efetivos.f} dataM={equidade.efetivos.m} total={equidade.efetivos.total} />
                  <PieDuplo title="Comissionados" sub={`${fmt(equidade.comiss.total)} servidores`}   dataF={equidade.comiss.f}   dataM={equidade.comiss.m}   total={equidade.comiss.total} />

                  {/* Comparativo */}
                  <div style={{ flex: 1, minWidth: 200, padding: '16px 18px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Comparativo feminino</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Quadro geral',  pctF: equidade.geral.pctF,     cor: '#64748b' },
                        { label: 'Efetivos',      pctF: equidade.efetivos.pctF,  cor: '#10b981' },
                        { label: 'Comissionados', pctF: equidade.comiss.pctF,    cor: COR_F },
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
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>
                    Ordenado do maior para o menor — referência: {equidade.geral.pctF.toFixed(1)}% no quadro geral
                  </div>
                  <ResponsiveContainer width="100%" height={equidade.porSecretaria.length * 32 + 20}>
                    <BarChart data={equidade.porSecretaria} layout="vertical" margin={{ left: 8, right: 60, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide domain={[0, 100]} />
                      <YAxis type="category" dataKey="sec" width={200} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<TooltipGenero />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                      <Bar dataKey="pctFem" maxBarSize={18} radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fill: '#475569', fontSize: 10, formatter: v => `${v.toFixed(0)}%` }}>
                        {equidade.porSecretaria.map((d, i) => (
                          <Cell key={i} fill={d.pctFem >= equidade.geral.pctF ? COR_F : '#475569'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: COR_F }} />
                      <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Acima da média geral ({equidade.geral.pctF.toFixed(0)}%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#475569' }} />
                      <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Abaixo da média geral</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── ABA: ONDAS ── */}
            {aba === 'ondas' && ondas && (
              <>
                {/* KPIs */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Média em anos eleitorais', val: fmt(ondas.mediaEleicao), sub: `por ano (${ondas.nEleicaoAnos} anos)`, cor: '#f59e0b' },
                    { label: 'Média em anos normais',    val: fmt(ondas.mediaNormal),  sub: `por ano (${ondas.nNormalAnos} anos)`,  cor: '#0D7C3D' },
                    { label: 'Maior onda',               val: ondas.topAnos[0]?.ano ?? '—', sub: ondas.topAnos[0] ? `${fmt(ondas.topAnos[0].count)} admissões${ELEICOES.has(ondas.topAnos[0].ano) ? ' (eleição)' : ''}` : '', cor: '#10b981' },
                  ].map(({ label, val, sub, cor }) => (
                    <div key={label} style={{ flex: 1, minWidth: 200, padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: `3px solid ${cor}` }}>
                      <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{label}</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[{ id: false, label: 'Por ano' }, { id: true, label: 'Por década' }].map(({ id, label }) => (
                    <button key={String(id)} onClick={() => setDecada(id)} style={{ padding: '6px 14px', borderRadius: 8, background: decada === id ? 'rgba(13,124,61,.2)' : 'rgba(0, 0, 0, 0.02)', border: `1px solid ${decada === id ? 'rgba(13,124,61,.5)' : 'rgba(0, 0, 0, 0.05)'}`, color: decada === id ? '#15A050' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Gráfico */}
                <div className="chart-card">
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    Admissões {decada ? 'por década' : 'por ano'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>
                    {decada ? 'Concentração histórica de contratações' : 'Barras amarelas = anos de eleição municipal'}
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartOndas} margin={{ left: 0, right: 20, top: 4, bottom: 20 }}>
                      <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} angle={-45} textAnchor="end" interval={decada ? 0 : 'preserveStartEnd'} />
                      <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                      <Tooltip content={<TooltipOndas />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                      <Bar dataKey="count" maxBarSize={32} radius={[3, 3, 0, 0]}>
                        {chartOndas.map((d, i) => <Cell key={i} fill={d.eleicao ? '#f59e0b' : '#0D7C3D'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {!decada && (
                    <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} />
                        <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Ano eleitoral municipal</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0D7C3D' }} />
                        <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Ano normal</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
