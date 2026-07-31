import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { User, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { SearchSelect } from '@/components/ui/search-select';
import {
  fetchCompetencias,
  fetchSecretariasDaCompetencia,
  fetchUnidadesDaCompetencia,
  fetchServidoresDaUnidade,
  fetchEvolucaoServidor,
} from '@/modules/folha/services/folhaService';
import { fmtCompetencia } from '@/modules/folha/constants';

function NumBadge({ valor, label, cor, negativo = false }) {
  const v = Number(valor) || 0;
  if (v === 0) return null;
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8,
      background: `${cor}0f`, border: `1px solid ${cor}22`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{ fontSize: 13, color: 'var(--muted-c)' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: cor, fontFamily: 'monospace' }}>
        {negativo ? '-' : ''}{v}
      </span>
    </div>
  );
}

function StepLabel({ n, label, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: done ? '#0D7C3D' : 'rgba(0, 0, 0, 0.05)',
        border: `1px solid ${done ? '#0D7C3D' : 'rgba(0, 0, 0, 0.07)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: done ? '#fff' : '#64748b', flexShrink: 0,
      }}>{n}</div>
      <span style={{ fontSize: 11, color: done ? '#047857' : '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  );
}

// P09 — Tooltip personalizado para o gráfico histórico
function HistTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 8, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#dc2626' }}>Faltas: <strong>{d?.faltas ?? 0}</strong></div>
      <div style={{ color: '#f59e0b' }}>Atr. &lt;1h: <strong>{d?.atrasos_fracao ?? 0}</strong></div>
      <div style={{ color: '#f97316' }}>Atr. ≥1h: <strong>{d?.atrasos_dia ?? 0}</strong></div>
      {(d?.dsr > 0) && <div style={{ color: '#a78bfa' }}>DSR: <strong>{d?.dsr}</strong></div>}
      <div style={{ color: 'var(--muted-c)', marginTop: 4, borderTop: '1px solid rgba(0, 0, 0, 0.04)', paddingTop: 4 }}>
        Total desconto: <strong style={{ color: 'var(--text)' }}>{(d?.totalDesconto ?? 0).toFixed(3).replace('.', ',')}</strong>
      </div>
    </div>
  );
}

// P09 — Calcula meses consecutivos com ocorrências (da competência mais recente)
function calcConsecutivos(historico) {
  if (!historico.length) return 0;
  const sorted = [...historico].sort((a, b) => b.competencia.localeCompare(a.competencia));
  let count = 0;
  for (const h of sorted) {
    if (h.totalDesconto > 0) count++;
    else break;
  }
  return count;
}

export default function SimuladorFolha() {
  const [competencias, setCompetencias] = useState([]);
  const [secretarias,  setSecretarias]  = useState([]);
  const [unidades,     setUnidades]     = useState([]);
  const [servidores,   setServidores]   = useState([]);
  const [historico,    setHistorico]    = useState([]);

  const [selComp, setSelComp] = useState('');
  const [selSec,  setSelSec]  = useState('');
  const [selUnd,  setSelUnd]  = useState('');
  const [selMat,  setSelMat]  = useState('');
  const [busca,   setBusca]   = useState('');
  const [vista,   setVista]   = useState('detalhado');
  const [abaHist, setAbaHist] = useState(false);

  const servidor = servidores.find(s => String(s.matricula) === selMat) || null;

  useEffect(() => {
    fetchCompetencias().then(setCompetencias).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selComp) { setSecretarias([]); setSelSec(''); return; }
    fetchSecretariasDaCompetencia(selComp).then(setSecretarias).catch(console.error);
    setSelSec(''); setSelUnd(''); setSelMat('');
  }, [selComp]);

  useEffect(() => {
    if (!selComp) return;
    fetchUnidadesDaCompetencia(selComp, selSec || null).then(setUnidades).catch(console.error);
    setSelUnd(''); setSelMat('');
  }, [selComp, selSec]);

  useEffect(() => {
    if (!selComp || !selUnd) { setServidores([]); setSelMat(''); return; }
    fetchServidoresDaUnidade(selComp, selUnd).then(setServidores).catch(console.error);
    setSelMat('');
  }, [selComp, selUnd]);

  // P09 — carregar histórico longitudinal quando servidor é selecionado
  useEffect(() => {
    if (!selMat) { setHistorico([]); return; }
    fetchEvolucaoServidor(selMat).then(setHistorico).catch(console.error);
  }, [selMat]);

  const servidoresFiltrados = servidores.filter(s => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return String(s.matricula).includes(q) || (s.nome || '').toLowerCase().includes(q);
  });

  const faltas          = servidor ? (servidor.faltas           || 0) : 0;
  const atrasosDia      = servidor ? (servidor.atrasos_dia      || 0) : 0;
  const atrasosFracao   = servidor ? (servidor.atrasos_fracao   || 0) : 0;
  const dsr             = servidor ? (servidor.dsr              || 0) : 0;
  const he50            = servidor ? (servidor.hora_extra_50    || 0) : 0;
  const he100           = servidor ? (servidor.hora_extra_100   || 0) : 0;
  const adicNoturno     = servidor ? (servidor.adicional_noturno|| 0) : 0;

  const totalAtrasos    = atrasosDia + (atrasosFracao * 0.333);
  const totalDescontos  = faltas + totalAtrasos + dsr;
  const totalHE         = he50 + he100;

  // P09 — métricas do histórico
  const consecutivos = useMemo(() => calcConsecutivos(historico), [historico]);
  const chartData = useMemo(() =>
    historico.map(h => ({
      ...h,
      label: fmtCompetencia(h.competencia),
    })),
  [historico]);

  const selStyle = { width: '100%', borderRadius: 7, border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', fontSize: 13 };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Simulador de Folha</h1>
          <p>Consulte as verbas individuais de cada servidor</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        <div className="sim-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Painel de seleção */}
          <div className="chart-card no-print">
            <div className="chart-title" style={{ marginBottom: 20 }}>Selecionar Servidor</div>

            <StepLabel n="1" label="Competência" done={!!selComp} />
            <div style={{ marginBottom: 16, marginLeft: 30 }}>
              <select value={selComp} onChange={e => setSelComp(e.target.value)} className="sel-dark" style={selStyle}>
                <option value="">Selecione o mês/ano...</option>
                {competencias.map(c => <option key={c} value={c}>{fmtCompetencia(c)}</option>)}
              </select>
            </div>

            <StepLabel n="2" label="Secretaria" done={!!selSec} />
            <div style={{ marginBottom: 16, marginLeft: 30 }}>
              <SearchSelect
                value={selSec}
                onChange={setSelSec}
                disabled={!selComp}
                placeholder="Todas as secretarias"
                minWidth="100%"
                options={secretarias.map(s => ({ value: s.sigla, label: `${s.sigla}${s.nome ? ` — ${s.nome}` : ''}` }))}
              />
            </div>

            <StepLabel n="3" label="Unidade" done={!!selUnd} />
            <div style={{ marginBottom: 16, marginLeft: 30 }}>
              <SearchSelect
                value={selUnd}
                onChange={setSelUnd}
                disabled={!selComp}
                placeholder="Selecione a unidade..."
                minWidth="100%"
                options={unidades.map(u => ({ value: u, label: u }))}
              />
            </div>

            <StepLabel n="4" label="Servidor" done={!!selMat} />
            <div style={{ marginLeft: 30 }}>
              <input
                type="text"
                placeholder="Buscar por nome ou matrícula..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                disabled={!selUnd}
                style={{ width: '100%', marginBottom: 8 }}
              />
              <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 6, border: '1px solid rgba(0,0,0,.07)' }}>
                {servidoresFiltrados.length === 0 && selUnd && (
                  <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'center' }}>
                    {servidores.length === 0 ? 'Nenhum servidor nesta unidade' : 'Nenhum resultado'}
                  </div>
                )}
                {servidoresFiltrados.map(s => (
                  <div
                    key={s.matricula}
                    onClick={() => { setSelMat(String(s.matricula)); setBusca(''); }}
                    style={{
                      padding: '9px 12px', cursor: 'pointer',
                      background: selMat === String(s.matricula) ? 'rgba(13,124,61,.12)' : 'transparent',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.02)', transition: 'background .1s',
                    }}
                    onMouseOver={e => { if (selMat !== String(s.matricula)) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'; }}
                    onMouseOut={e => { if (selMat !== String(s.matricula)) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{s.nome || `Matrícula ${s.matricula}`}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 1 }}>
                      {s.matricula} · {s.cargo?.slice(0, 30) || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Painel de resultado */}
          <div>
            {!servidor && (
              <div className="chart-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--muted-c)' }}>
                <User size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: .3 }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>Selecione um servidor</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>As verbas serão exibidas aqui</div>
              </div>
            )}

            {servidor && (
              <>
                {/* Cabeçalho do servidor */}
                <div className="chart-card" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10,
                      background: 'linear-gradient(135deg,#0D7C3D,#0D7C3D)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0,
                    }}>
                      {(servidor.nome || 'S')[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{servidor.nome || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-c)', marginTop: 3 }}>
                        Mat. <span style={{ color: '#15A050', fontFamily: 'monospace', fontWeight: 600 }}>{servidor.matricula}</span>
                        {servidor.cargo && <> · {servidor.cargo}</>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>
                        {servidor.secretaria_sigla} · {servidor.unidade}
                        {' · '}<span style={{ color: '#a78bfa' }}>{fmtCompetencia(servidor.competencia)}</span>
                      </div>
                    </div>

                    {/* Toggle aba: verbas / histórico */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: 4, padding: '3px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.03)' }}>
                        <button
                          onClick={() => setAbaHist(false)}
                          style={{
                            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600,
                            background: !abaHist ? 'rgba(13,124,61,.25)' : 'transparent',
                            color: !abaHist ? '#15A050' : '#64748b', transition: 'all .15s',
                          }}
                        >Verbas</button>
                        <button
                          onClick={() => setAbaHist(true)}
                          style={{
                            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600,
                            background: abaHist ? 'rgba(13,124,61,.25)' : 'transparent',
                            color: abaHist ? '#15A050' : '#64748b', transition: 'all .15s',
                          }}
                        >
                          Histórico
                          {historico.length > 0 && (
                            <span style={{ marginLeft: 5, fontSize: 9, background: 'rgba(13,124,61,.3)', color: '#c7d2fe', padding: '1px 5px', borderRadius: 9 }}>
                              {historico.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ABA VERBAS ── */}
                {!abaHist && (
                  <>
                    {/* Toggle detalhado/resumido */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 4, padding: '3px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.03)' }}>
                        {['detalhado', 'resumido'].map(v => (
                          <button
                            key={v}
                            onClick={() => setVista(v)}
                            style={{
                              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                              background: vista === v ? 'rgba(13,124,61,.25)' : 'transparent',
                              color: vista === v ? '#15A050' : '#64748b', transition: 'all .15s',
                            }}
                          >{v}</button>
                        ))}
                      </div>
                    </div>

                    {vista === 'detalhado' && (
                      <>
                        <div className="chart-card" style={{ marginBottom: 14 }}>
                          <div className="chart-title" style={{ marginBottom: 14, color: '#dc2626' }}>Descontos</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <NumBadge valor={faltas}        label="Faltas — dias de desconto"                       cor="#ef4444" negativo />
                            <NumBadge valor={atrasosDia}    label="Atrasos ≥ 1h — dias de desconto"                cor="#ef4444" negativo />
                            <NumBadge valor={atrasosFracao} label="Atrasos < 1h — ocorrências (× 0,333 dias cada)" cor="#f59e0b" negativo />
                            <NumBadge valor={dsr}           label="DSR — domingos perdidos"                         cor="#f97316" negativo />
                            {faltas === 0 && atrasosDia === 0 && atrasosFracao === 0 && dsr === 0 && (
                              <div style={{ fontSize: 13, color: 'var(--muted-c)', textAlign: 'center', padding: '8px 0' }}>
                                Nenhum desconto nesta competência
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="chart-card" style={{ marginBottom: 14 }}>
                          <div className="chart-title" style={{ marginBottom: 14, color: '#047857' }}>Horas Extras e Adicionais</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <NumBadge valor={he50}        label="Hora extra 50%"    cor="#10b981" />
                            <NumBadge valor={he100}       label="Hora extra 100%"   cor="#10b981" />
                            <NumBadge valor={adicNoturno} label="Adicional noturno" cor="#0D7C3D" />
                            {he50 === 0 && he100 === 0 && adicNoturno === 0 && (
                              <div style={{ fontSize: 13, color: 'var(--muted-c)', textAlign: 'center', padding: '8px 0' }}>
                                Nenhuma hora extra nesta competência
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {vista === 'resumido' && (
                      <>
                        <div className="chart-card" style={{ marginBottom: 14 }}>
                          <div className="chart-title" style={{ marginBottom: 14, color: '#dc2626' }}>Descontos</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <NumBadge valor={faltas} label="Faltas — dias de desconto" cor="#ef4444" negativo />
                            {(atrasosDia > 0 || atrasosFracao > 0) && (
                              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--muted-c)' }}>Total Atrasos — dias de desconto</div>
                                  <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 3 }}>
                                    {atrasosDia > 0 && <span>{atrasosDia} dia{atrasosDia > 1 ? 's' : ''} (≥1h)</span>}
                                    {atrasosDia > 0 && atrasosFracao > 0 && <span> + </span>}
                                    {atrasosFracao > 0 && <span>{atrasosFracao} ocor. &lt;1h (×0,333)</span>}
                                  </div>
                                </div>
                                <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                                  -{totalAtrasos.toFixed(3).replace('.', ',')}
                                </span>
                              </div>
                            )}
                            <NumBadge valor={dsr} label="DSR — domingos perdidos" cor="#f97316" negativo />
                            {faltas === 0 && atrasosDia === 0 && atrasosFracao === 0 && dsr === 0 && (
                              <div style={{ fontSize: 13, color: 'var(--muted-c)', textAlign: 'center', padding: '8px 0' }}>Nenhum desconto nesta competência</div>
                            )}
                          </div>
                        </div>
                        <div className="chart-card" style={{ marginBottom: 14 }}>
                          <div className="chart-title" style={{ marginBottom: 14, color: '#047857' }}>Horas Extras e Adicionais</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(he50 > 0 || he100 > 0) && (
                              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--muted-c)' }}>Total Hora Extra</div>
                                  <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 3 }}>
                                    {he50  > 0 && <span>{he50}h (50%)</span>}
                                    {he50  > 0 && he100 > 0 && <span> + </span>}
                                    {he100 > 0 && <span>{he100}h (100%)</span>}
                                  </div>
                                </div>
                                <span style={{ fontSize: 16, fontWeight: 800, color: '#047857', fontFamily: 'monospace' }}>{totalHE}h</span>
                              </div>
                            )}
                            <NumBadge valor={adicNoturno} label="Adicional noturno" cor="#0D7C3D" />
                            {he50 === 0 && he100 === 0 && adicNoturno === 0 && (
                              <div style={{ fontSize: 13, color: 'var(--muted-c)', textAlign: 'center', padding: '8px 0' }}>Nenhuma hora extra nesta competência</div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="chart-card" style={{ borderLeft: '3px solid #0D7C3D' }}>
                      <div className="chart-title" style={{ marginBottom: 14 }}>Resumo</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Total dias descontados</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                            {totalDescontos.toFixed(3).replace('.', ',')}
                          </div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Total horas extras</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#047857', fontFamily: 'monospace' }}>{totalHE}h</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── ABA HISTÓRICO (P09) ── */}
                {abaHist && (
                  <>
                    {historico.length === 0 ? (
                      <div className="chart-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted-c)' }}>
                        <Calendar size={32} style={{ margin: '0 auto 12px', opacity: .3 }} />
                        <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhum histórico encontrado</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Este servidor não possui registros em outras competências</div>
                      </div>
                    ) : (
                      <>
                        {/* KPI consecutivos */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                          <div className="kpi-card">
                            <div className="kpi-accent" style={{ background: '#0D7C3D' }} />
                            <div className="kpi-label">Competências</div>
                            <div className="kpi-value" style={{ color: '#15A050', fontSize: 26 }}>{historico.length}</div>
                          </div>
                          <div className="kpi-card" style={{ borderColor: consecutivos >= 3 ? 'rgba(239,68,68,.25)' : undefined }}>
                            <div className="kpi-accent" style={{ background: consecutivos >= 3 ? '#ef4444' : consecutivos >= 1 ? '#f59e0b' : '#10b981' }} />
                            <div className="kpi-label">Meses consecutivos com desconto</div>
                            <div className="kpi-value" style={{ color: consecutivos >= 3 ? '#dc2626' : consecutivos >= 1 ? '#b45309' : '#047857', fontSize: 26 }}>
                              {consecutivos}
                            </div>
                          </div>
                          <div className="kpi-card">
                            <div className="kpi-accent" style={{ background: '#ef4444' }} />
                            <div className="kpi-label">Total faltas (acumulado)</div>
                            <div className="kpi-value" style={{ color: '#dc2626', fontSize: 26 }}>
                              {historico.reduce((s, h) => s + h.faltas, 0)}
                            </div>
                          </div>
                        </div>

                        {/* Gráfico */}
                        <div className="chart-card" style={{ marginBottom: 14 }}>
                          <div className="chart-title" style={{ marginBottom: 14 }}>
                            Desconto total por competência
                          </div>
                          <div style={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.03)" />
                                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip content={<HistTooltip />} cursor={{ fill: 'rgba(13,124,61,.08)' }} />
                                <Bar dataKey="totalDesconto" radius={[3, 3, 0, 0]}>
                                  {chartData.map((entry, idx) => (
                                    <Cell
                                      key={idx}
                                      fill={entry.totalDesconto > 0 ? '#ef4444bb' : '#1e293b'}
                                      stroke={entry.totalDesconto > 0 ? '#ef4444' : '#334155'}
                                      strokeWidth={1}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Tabela detalhada */}
                        <div className="chart-card">
                          <div className="chart-title" style={{ marginBottom: 12 }}>Detalhamento por competência</div>
                          <div style={{ overflowX: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  <th>Competência</th>
                                  <th style={{ textAlign: 'center' }}>Faltas</th>
                                  <th style={{ textAlign: 'center' }}>Atr. &lt;1h</th>
                                  <th style={{ textAlign: 'center' }}>Atr. ≥1h</th>
                                  <th style={{ textAlign: 'center' }}>DSR</th>
                                  <th style={{ textAlign: 'right' }}>Desc. Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...historico].sort((a, b) => b.competencia.localeCompare(a.competencia)).map(h => {
                                  const temDesc = h.totalDesconto > 0;
                                  return (
                                    <tr key={h.competencia} style={{ background: h.competencia === selComp ? 'rgba(13,124,61,.08)' : undefined }}>
                                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: h.competencia === selComp ? '#15A050' : '#64748b', fontWeight: h.competencia === selComp ? 700 : 400 }}>
                                        {fmtCompetencia(h.competencia)}
                                        {h.competencia === selComp && <span style={{ marginLeft: 6, fontSize: 9, color: '#0D7C3D' }}>← atual</span>}
                                      </td>
                                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: h.faltas > 0 ? '#dc2626' : '#374151' }}>{h.faltas}</td>
                                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: h.atrasos_fracao > 0 ? '#b45309' : '#374151' }}>{h.atrasos_fracao}</td>
                                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: h.atrasos_dia > 0 ? '#f97316' : '#374151' }}>{h.atrasos_dia}</td>
                                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: h.dsr > 0 ? '#a78bfa' : '#374151' }}>{h.dsr}</td>
                                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: temDesc ? '#dc2626' : '#374151' }}>
                                        {temDesc ? h.totalDesconto.toFixed(3).replace('.', ',') : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
