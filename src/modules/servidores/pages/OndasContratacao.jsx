import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');

// Anos de eleição municipal de Osasco (a cada 4 anos)
const ELEICOES_MUNICIPAIS = new Set([2000, 2004, 2008, 2012, 2016, 2020, 2024]);

function parseBRYear(s) {
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length >= 3) {
    const y = parseInt(parts[2]);
    return y > 1900 && y <= 2100 ? y : null;
  }
  return null;
}

function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const eleicao = ELEICOES_MUNICIPAIS.has(Number(label));
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: `1px solid ${eleicao ? 'rgba(245,158,11,.4)' : 'rgba(0, 0, 0, 0.07)'}`, borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: eleicao ? '#b45309' : '#1e293b', marginBottom: 4 }}>
        {label}{eleicao ? ' 🗳️ Eleição' : ''}
      </div>
      {payload.map((p, i) => <div key={i} style={{ color: p.fill || '#15A050' }}>{fmt(p.value)} admissões</div>)}
    </div>
  );
}

export default function OndasContratacao() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);
  const [filtroSec, setFiltroSec] = useState('');
  const [decada, setDecada]   = useState(false);

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const secretarias = useMemo(() => [...new Set(dados.map(r => r.Des_Secretaria).filter(Boolean))].sort(), [dados]);

  const { porAno, porDecada, topAnos, stats } = useMemo(() => {
    const base = filtroSec ? dados.filter(r => r.Des_Secretaria === filtroSec) : dados;

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
      .map(([ano, count]) => ({ ano: Number(ano), count, eleicao: ELEICOES_MUNICIPAIS.has(Number(ano)) }));

    const porDecada = Object.entries(accDecada)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([dec, count]) => ({ dec: `${dec}s`, count }));

    const topAnos = [...porAno].sort((a, b) => b.count - a.count).slice(0, 10);

    // Admissões em anos de eleição vs. outros
    const eleicaoTotal = porAno.filter(d => d.eleicao).reduce((s, d) => s + d.count, 0);
    const normalTotal  = porAno.filter(d => !d.eleicao).reduce((s, d) => s + d.count, 0);
    const eleicaoAnos  = porAno.filter(d => d.eleicao).length;
    const normalAnos   = porAno.filter(d => !d.eleicao).length;
    const mediaEleicao = eleicaoAnos > 0 ? eleicaoTotal / eleicaoAnos : 0;
    const mediaNormal  = normalAnos  > 0 ? normalTotal  / normalAnos  : 0;
    const stats = { eleicaoTotal, normalTotal, mediaEleicao, mediaNormal, eleicaoAnos, normalAnos };

    return { porAno, porDecada, topAnos, stats };
  }, [dados, filtroSec]);

  const chartData = decada ? porDecada.map(d => ({ ano: d.dec, count: d.count, eleicao: false })) : porAno;

  const SEL = { padding: '7px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', fontSize: 12, outline: 'none' };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Ondas de Contratação</h1>
          <p>Histórico de admissões e padrões ao longo do tempo</p>
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
            {/* Stats por ciclo eleitoral */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Admissões em anos eleitorais', val: fmt(stats.eleicaoTotal), sub: `média de ${fmt(stats.mediaEleicao)} por ano (${stats.eleicaoAnos} anos)`, cor: '#f59e0b' },
                { label: 'Admissões em anos normais',    val: fmt(stats.normalTotal),  sub: `média de ${fmt(stats.mediaNormal)} por ano (${stats.normalAnos} anos)`, cor: '#0D7C3D' },
                { label: 'Maior onda',                  val: topAnos[0] ? `${topAnos[0].ano}` : '—', sub: topAnos[0] ? `${fmt(topAnos[0].count)} admissões${ELEICOES_MUNICIPAIS.has(topAnos[0]?.ano) ? ' (eleição)' : ''}` : '', cor: '#10b981' },
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

            {/* Gráfico principal */}
            <div className="chart-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Admissões {decada ? 'por década' : 'por ano'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>
                {decada ? 'Concentração histórica de contratações' : 'Barras amarelas = anos de eleição municipal em Osasco'}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ left: 0, right: 20, top: 4, bottom: 20 }}>
                  <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} angle={-45} textAnchor="end" interval={decada ? 0 : 'preserveStartEnd'} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  <Bar dataKey="count" maxBarSize={32} radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.eleicao ? '#f59e0b' : '#0D7C3D'} />
                    ))}
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
      </div>
    </div>
  );
}
