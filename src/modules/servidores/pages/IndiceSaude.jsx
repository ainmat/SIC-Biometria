import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado } from '@/modules/servidores/config/servidoresConfig';
import { Info, ChevronDown, ChevronUp, Clock, GraduationCap, Shield, Calendar } from 'lucide-react';

const fmt  = (n) => Math.round(n).toLocaleString('pt-BR');
const pct  = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');
const avg  = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

function categoriaEscol(s) {
  if (!s) return 0;
  const l = s.toLowerCase();
  if (l.includes('doutora') || l.includes('mestra') || l.includes('pós') || l.includes('especializa')) return 4;
  if (l.includes('superior') || l.includes('gradua') || l.includes('faculdade')) return 3;
  if (l.includes('médio') || l.includes('medio') || l.includes('técnico') || l.includes('tecnico')) return 2;
  if (l.includes('fundamental') || l.includes('primár') || l.includes('ginásio')) return 1;
  return 0;
}

// Normaliza um valor para 0-100 (maior = melhor)
function norm(val, min, max) {
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

function corScore(s) {
  if (s >= 70) return '#10b981';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

function BadgeScore({ score }) {
  const cor = corScore(score);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: `${cor}20`, border: `2px solid ${cor}`, fontSize: 13, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>
      {Math.round(score)}
    </span>
  );
}

function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const data = p?.payload;
  return (
    <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 200 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ color: 'var(--muted-c)' }}>Score geral: <b style={{ color: corScore(data?.score) }}>{Math.round(data?.score)}</b></div>
        <div style={{ color: 'var(--muted-c)', fontSize: 11 }}>Idade média: {data?.idadeMedia?.toFixed(0)} anos</div>
        <div style={{ color: 'var(--muted-c)', fontSize: 11 }}>% comissionados: {data?.pctComiss?.toFixed(1)}%</div>
        <div style={{ color: 'var(--muted-c)', fontSize: 11 }}>Tempo médio: {data?.tempoMedio?.toFixed(0)} anos</div>
        <div style={{ color: 'var(--muted-c)', fontSize: 11 }}>Nível escol. médio: {data?.escolMedia?.toFixed(1)}/4</div>
      </div>
    </div>
  );
}

export default function IndiceSaude() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);
  const [aba,     setAba]     = useState('ranking');
  const [expandedInfo, setExpandedInfo] = useState(false);

  useEffect(() => {
    fetchResumoServidores().then(setDados).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  const { ranking, global } = useMemo(() => {
    if (!dados.length) return { ranking: [], global: {} };

    // Agrega por secretaria
    const bySecAcc = {};
    dados.forEach(r => {
      const sec = r.Des_Secretaria || 'Não informado';
      if (!bySecAcc[sec]) bySecAcc[sec] = { idades: [], tempos: [], escolNiveis: [], total: 0, comiss: 0 };
      bySecAcc[sec].total++;
      const idade = Number(r.Idade);
      if (idade > 0 && idade < 120) bySecAcc[sec].idades.push(idade);
      const tempo = Number(r.Tempo_Contrato_Anos);
      if (tempo >= 0) bySecAcc[sec].tempos.push(tempo);
      bySecAcc[sec].escolNiveis.push(categoriaEscol(r.Des_GrInstrucao));
      if (isComissionado(r)) bySecAcc[sec].comiss++;
    });

    // Calcula métricas base por secretaria
    const metricas = Object.entries(bySecAcc)
      .filter(([, v]) => v.total >= 5)
      .map(([sec, v]) => ({
        sec,
        total: v.total,
        idadeMedia: avg(v.idades),
        tempoMedio: avg(v.tempos),
        escolMedia: avg(v.escolNiveis),
        pctComiss:  v.total > 0 ? (v.comiss / v.total) * 100 : 0,
      }));

    // Normaliza cada componente no universo de secretarias
    const idadeArr   = metricas.map(m => m.idadeMedia);
    const tempoArr   = metricas.map(m => m.tempoMedio);
    const escolArr   = metricas.map(m => m.escolMedia);
    const comissArr  = metricas.map(m => m.pctComiss);

    const [minId, maxId] = [Math.min(...idadeArr), Math.max(...idadeArr)];
    const [minTp, maxTp] = [Math.min(...tempoArr), Math.max(...tempoArr)];
    const [minEs, maxEs] = [Math.min(...escolArr), Math.max(...escolArr)];
    const [minCo, maxCo] = [Math.min(...comissArr), Math.max(...comissArr)];

    const ranking = metricas.map(m => {
      // Quadro jovem = bom; quadro muito velho = ruim → inverter
      const sIdade  = 100 - norm(m.idadeMedia, minId, maxId);
      // Mais experiência = melhor
      const sTempo  = norm(m.tempoMedio, minTp, maxTp);
      // Mais escolaridade = melhor
      const sEscol  = norm(m.escolMedia, minEs, maxEs);
      // Menos comissionados = melhor → inverter
      const sComiss = 100 - norm(m.pctComiss, minCo, maxCo);
      // Pesos: experiência 30%, escolaridade 30%, comissionados 25%, idade 15%
      const score = sIdade * 0.15 + sTempo * 0.30 + sEscol * 0.30 + sComiss * 0.25;
      return { ...m, score, sIdade, sTempo, sEscol, sComiss };
    }).sort((a, b) => b.score - a.score);

    const global = {
      mediaScore: avg(ranking.map(r => r.score)),
      verdes:  ranking.filter(r => r.score >= 70).length,
      amarelos: ranking.filter(r => r.score >= 50 && r.score < 70).length,
      vermelhos: ranking.filter(r => r.score < 50).length,
    };

    return { ranking, global };
  }, [dados]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Índice de Saúde do Quadro</h1>
          <p>Score composto por secretaria: experiência, escolaridade, comissionados e perfil etário</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando...</div>}
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && ranking.length > 0 && (
          <>
            {/* Painel Informativo sobre o Índice de Saúde */}
            <div style={{
              background: 'rgba(0,0,0,.01)',
              border: '1px solid rgba(0, 0, 0, 0.04)',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              transition: 'all 0.3s ease',
            }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} 
                onClick={() => setExpandedInfo(!expandedInfo)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Info size={18} color="#0D7C3D" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    Entenda os Critérios de Apuração do Índice de Saúde
                  </span>
                </div>
                <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-c)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {expandedInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {!expandedInfo ? (
                <p style={{ margin: '8px 0 0 28px', fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.5' }}>
                  O score de <b>0 a 100</b> avalia a sustentabilidade e qualificação do quadro de cada secretaria (mín. 5 servidores) com base em quatro pilares relativos. Clique para ver as regras de cálculo e faixas de risco.
                </p>
              ) : (
                <div style={{ marginTop: 16, borderTop: '1px solid rgba(0, 0, 0, 0.04)', paddingTop: 16 }}>
                  {/* Grid de Critérios */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,.01)', border: '1px solid rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Clock size={14} color="#15A050" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Experiência (Peso: 30%)</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.4', margin: 0 }}>
                        Calculado pelo <b>tempo médio de contrato</b> (em anos). Pontua melhor as secretarias com maior retenção e permanência dos servidores.
                      </p>
                    </div>

                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,.01)', border: '1px solid rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <GraduationCap size={14} color="#15A050" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Escolaridade (Peso: 30%)</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.4', margin: 0 }}>
                        Média ponderada do nível de instrução (de 0 a 4). Valoriza a qualificação formal (de Fundamental até Pós-graduação/Doutorado).
                      </p>
                    </div>

                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,.01)', border: '1px solid rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Shield size={14} color="#15A050" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Estabilidade (Peso: 25%)</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.4', margin: 0 }}>
                        Inverso da porcentagem de cargos comissionados. Menor dependência de indicações políticas gera maior estabilidade e eleva o score.
                      </p>
                    </div>

                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,.01)', border: '1px solid rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Calendar size={14} color="#15A050" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Perfil Etário (Peso: 15%)</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: '1.4', margin: 0 }}>
                        Idade média geral do quadro. Secretarias com menor idade média pontuam melhor por apresentarem menor risco de aposentadorias em lote.
                      </p>
                    </div>
                  </div>

                  {/* Classificação e Regra de Cálculo */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, color: 'var(--muted-c)', borderTop: '1px solid rgba(0, 0, 0, 0.02)', paddingTop: 12 }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--muted-c)', display: 'block', marginBottom: 4 }}>Faixas de Classificação:</span>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> <b>Saudável (≥ 70):</b> Quadro qualificado, estável e equilibrado.</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> <b>Atenção (50-69):</b> Alerta em algum pilar específico.</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> <b>Risco (&lt; 50):</b> Alto índice de rotatividade ou envelhecimento.</span>
                      </div>
                    </div>
                    <div style={{ flex: '1 1 250px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--muted-c)', display: 'block', marginBottom: 4 }}>Regra de Cálculo Relativo:</span>
                      <span>
                        Os valores são calculados relativamente entre as secretarias ativas. O município de menor desempenho no critério serve como 0 e o de maior como 100.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Score médio geral', val: Math.round(global.mediaScore), sub: 'das secretarias', cor: corScore(global.mediaScore) },
                { label: 'Saudáveis (≥ 70)',  val: fmt(global.verdes),    sub: 'secretarias em verde',   cor: '#10b981' },
                { label: 'Atenção (50–69)',    val: fmt(global.amarelos),  sub: 'secretarias em amarelo', cor: '#f59e0b' },
                { label: 'Risco (< 50)',       val: fmt(global.vermelhos), sub: 'secretarias em vermelho',cor: '#ef4444' },
              ].map(({ label, val, sub, cor }) => (
                <div key={label} style={{ flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: `3px solid ${cor}` }}>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{ id: 'ranking', label: 'Gráfico de ranking' }, { id: 'tabela', label: 'Tabela detalhada' }].map(({ id, label }) => (
                <button key={id} onClick={() => setAba(id)} style={{ padding: '6px 14px', borderRadius: 8, background: aba === id ? 'rgba(13,124,61,.2)' : 'rgba(0, 0, 0, 0.02)', border: `1px solid ${aba === id ? 'rgba(13,124,61,.5)' : 'rgba(0, 0, 0, 0.05)'}`, color: aba === id ? '#15A050' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {aba === 'ranking' && (
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Ranking de saúde por secretaria</div>
                <ResponsiveContainer width="100%" height={ranking.length * 34 + 20}>
                  <BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 60, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis type="category" dataKey="sec" width={200} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}
                      label={{ position: 'right', fill: '#475569', fontSize: 10, formatter: v => Math.round(v) }}>
                      {ranking.map((d, i) => <Cell key={i} fill={corScore(d.score)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {aba === 'tabela' && (
              <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#','Secretaria','Score','Idade média','Tempo médio','Escolaridade','% Comiss.','Servidores'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)', whiteSpace: 'nowrap', background: 'rgba(0,0,0,.2)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((r, i) => (
                        <tr key={r.sec} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted-c)' }}>#{i + 1}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sec}</td>
                          <td style={{ padding: '9px 12px' }}><BadgeScore score={r.score} /></td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.idadeMedia.toFixed(0)}a</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.tempoMedio.toFixed(0)}a</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.escolMedia.toFixed(1)}/4</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: r.pctComiss > 15 ? '#dc2626' : '#64748b', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.pctComiss.toFixed(1)}%</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total)}</td>
                        </tr>
                      ))}
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
