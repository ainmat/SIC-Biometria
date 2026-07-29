import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado } from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');

const ORDEM_ESCOL = ['Pós-graduação', 'Superior', 'Ensino Médio', 'Fund. / Básico', 'Não informado'];
const CORES_ESCOL = ['#0D7C3D', '#0D7C3D', '#10b981', '#f59e0b', '#475569'];

function categoriaEscol(s) {
  if (!s) return 'Não informado';
  const l = s.toLowerCase();
  if (l.includes('doutora') || l.includes('mestra') || l.includes('pós') || l.includes('pos-grad') || l.includes('especializa')) return 'Pós-graduação';
  if (l.includes('superior') || l.includes('gradua') || l.includes('faculdade') || l.includes('universit') || l.includes('universitário') || l.includes('bacharela') || l.includes('licencia')) return 'Superior';
  if (l.includes('médio') || l.includes('medio') || l.includes('colegial') || l.includes('técnico') || l.includes('tecnico') || l.includes('2º grau') || l.includes('2o grau')) return 'Ensino Médio';
  if (l.includes('fundamental') || l.includes('primár') || l.includes('ginásio') || l.includes('ginasio') || l.includes('1º grau') || l.includes('1o grau') || l.includes('analfabeto') || l.includes('sem instrução')) return 'Fund. / Básico';
  return 'Não informado';
}

function nivelEscol(cat) {
  const idx = ORDEM_ESCOL.indexOf(cat);
  return idx === -1 ? 0 : ORDEM_ESCOL.length - 1 - idx; // maior = mais escolarizado
}

function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => p.value > 0 && (
        <div key={i} style={{ color: p.fill, marginBottom: 2 }}>
          {p.name}: {fmt(p.value)} ({pct(p.value, total)}%)
        </div>
      ))}
    </div>
  );
}

export default function DescompassoEscolaridade() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const { totalPorEscol, porPadrao, nSub, nAcima } = useMemo(() => {
    if (!dados.length) return { totalPorEscol: [], porPadrao: [], subaproveitados: [], acimaDaFormacao: [] };
    const total = dados.length;

    // Distribuição geral
    const escAcc = {};
    dados.forEach(r => { const c = categoriaEscol(r.Des_GrInstrucao); escAcc[c] = (escAcc[c] || 0) + 1; });
    const totalPorEscol = ORDEM_ESCOL.map((cat, i) => ({ cat, count: escAcc[cat] || 0, pct: pct(escAcc[cat] || 0, total), cor: CORES_ESCOL[i] }));

    // Por padrão: top 12 padrões com distribuição de escolaridade
    const padAcc = {};
    dados.forEach(r => {
      const pad = r.Des_Padrao_Adm || 'Não informado';
      if (!padAcc[pad]) padAcc[pad] = { total: 0 };
      ORDEM_ESCOL.forEach(c => { if (!padAcc[pad][c]) padAcc[pad][c] = 0; });
      padAcc[pad].total++;
      padAcc[pad][categoriaEscol(r.Des_GrInstrucao)]++;
    });
    const porPadrao = Object.entries(padAcc)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 12)
      .map(([pad, v]) => ({ pad, ...v }));

    const nSub   = dados.filter(r => !isComissionado(r) && (categoriaEscol(r.Des_GrInstrucao) === 'Superior' || categoriaEscol(r.Des_GrInstrucao) === 'Pós-graduação')).length;
    const nAcima = dados.filter(r => isComissionado(r) && nivelEscol(categoriaEscol(r.Des_GrInstrucao)) <= nivelEscol('Ensino Médio')).length;

    return { totalPorEscol, porPadrao, nSub, nAcima };
  }, [dados]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Descompasso Escolaridade × Cargo</h1>
          <p>Alocação de talento por nível de formação e padrão funcional</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando...</div>}
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && dados.length > 0 && (
          <>
            {/* KPIs de escolaridade */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              {totalPorEscol.map(({ cat, count, pct: p, cor }) => (
                <div key={cat} style={{ flex: 1, minWidth: 130, padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: `3px solid ${cor}` }}>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{cat}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(count)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>{p}% do quadro</div>
                </div>
              ))}
            </div>

            {/* Distribuição por padrão */}
            <div className="chart-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Escolaridade por padrão funcional</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Composição do nível de formação em cada padrão — revela concentração de alta escolaridade em funções rotineiras</div>

              {/* Legenda */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                {ORDEM_ESCOL.map((cat, i) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: CORES_ESCOL[i], flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>{cat}</span>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={porPadrao.length * 32 + 20}>
                <BarChart data={porPadrao} layout="vertical" margin={{ left: 8, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="pad" width={180} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  {ORDEM_ESCOL.map((cat, i) => (
                    <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={CORES_ESCOL[i]} maxBarSize={22}
                      radius={i === ORDEM_ESCOL.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Links para Diretório */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { to: '/servidores/diretorio', label: 'Potencial subaproveitado', desc: `${fmt(nSub)} servidores com Superior/Pós em cargos efetivos`, cor: '#0D7C3D' },
                { to: '/servidores/diretorio', label: 'Cargo acima da formação', desc: `${fmt(nAcima)} comissionados com escolaridade até Ensino Médio`, cor: '#f97316' },
              ].map(({ to, label, desc, cor }) => (
                <Link key={label} to={to} style={{ flex: 1, minWidth: 240, textDecoration: 'none' }}>
                  <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color .15s, background .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${cor}50`; e.currentTarget.style.background = `${cor}08`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.07)'; e.currentTarget.style.background = 'rgba(0,0,0,.02)'; }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: cor }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 3 }}>{desc}</div>
                    </div>
                    <span style={{ fontSize: 18, color: cor }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
