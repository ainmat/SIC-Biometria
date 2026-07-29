import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, User, Briefcase, Building2, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const PER_PAGE = 50;

function parseBR(s) {
  if (!s) return null;
  const [dmy] = s.split(' ');
  const [d, m, y] = dmy.split('/');
  const dt = new Date(`${y}-${m}-${d}`);
  return isNaN(dt) ? null : dt;
}

function fmtData(s) { return s ? s.split(' ')[0] : '—'; }

const ANOMALIAS = [
  { id: 'sem_nome',       label: 'Sem nome',                icon: User,          cor: '#ef4444', test: r => !r.Nome_Funcionario?.trim() },
  { id: 'sem_cargo',      label: 'Sem cargo',               icon: Briefcase,     cor: '#f97316', test: r => !r.Des_Cargo?.trim() },
  { id: 'sem_secretaria', label: 'Sem secretaria',          icon: Building2,     cor: '#f59e0b', test: r => !r.Des_Secretaria?.trim() },
  { id: 'dt_invalida',    label: 'Data de admissão inválida', icon: Calendar,    cor: '#a855f7', test: r => !parseBR(r.DtAdmissao) },
  { id: 'idade_atipica',  label: 'Idade atípica (<18 ou >90)', icon: Clock,      cor: '#0D7C3D', test: r => { const n = Number(r.Idade); return !n || n < 18 || n > 90; } },
];

function getAnomalias(r) {
  return ANOMALIAS.filter(a => a.test(r)).map(a => a.label).join(' · ');
}

export default function AuditoriaServidores() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);
  const [filtro,  setFiltro]  = useState('');
  const [pagina,  setPagina]  = useState(0);

  useEffect(() => {
    fetchResumoServidores()
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  const { contagens, anomalos } = useMemo(() => {
    const contagens = ANOMALIAS.map(a => ({ ...a, count: dados.filter(a.test).length }));
    const anomalos  = dados.filter(r => ANOMALIAS.some(a => a.test(r)));
    return { contagens, anomalos };
  }, [dados]);

  const filtrados = useMemo(() => {
    if (!filtro) return anomalos;
    const def = ANOMALIAS.find(a => a.id === filtro);
    return def ? anomalos.filter(def.test) : anomalos;
  }, [anomalos, filtro]);

  const paginaList = filtrados.slice(pagina * PER_PAGE, (pagina + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtrados.length / PER_PAGE);

  function mudarFiltro(id) {
    setFiltro(prev => (prev === id ? '' : id));
    setPagina(0);
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Auditoria de Dados</h1>
          <p>Registros com inconsistências ou campos críticos vazios</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando dados...</div>}
        {erro    && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && dados.length > 0 && (
          <>
            {/* Cards de anomalias */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
              {/* Card total */}
              <div
                onClick={() => { setFiltro(''); setPagina(0); }}
                style={{ flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 12,
                  background: filtro === '' ? 'rgba(239,68,68,.1)' : 'rgba(0,0,0,.02)',
                  border: `1px solid ${filtro === '' ? 'rgba(239,68,68,.4)' : 'rgba(0,0,0,.07)'}`,
                  cursor: 'pointer', transition: 'all .15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={13} color="#ef4444" />
                  <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total com anomalias</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmt(anomalos.length)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>de {fmt(dados.length)} servidores</div>
              </div>

              {contagens.map(({ id, label, icon: Icon, cor, count }) => (
                <div
                  key={id}
                  onClick={() => mudarFiltro(id)}
                  style={{ flex: 1, minWidth: 150, padding: '14px 18px', borderRadius: 12,
                    background: filtro === id ? `${cor}18` : 'rgba(0,0,0,.02)',
                    border: `1px solid ${filtro === id ? `${cor}60` : 'rgba(0,0,0,.07)'}`,
                    cursor: 'pointer', transition: 'all .15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Icon size={13} color={count > 0 ? cor : '#334155'} />
                    <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: count > 0 ? cor : '#334155', fontVariantNumeric: 'tabular-nums' }}>{fmt(count)}</div>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0, 0, 0, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {filtro ? (ANOMALIAS.find(a => a.id === filtro)?.label || 'Anomalias') : 'Todos os registros com anomalias'}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{fmt(filtrados.length)} registros</span>
              </div>

              {filtrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted-c)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <AlertTriangle size={28} color="#334155" />
                  Nenhuma inconsistência encontrada
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Matrícula','Nome','Cargo','Secretaria','Admissão','Idade','Anomalias'].map(h => (
                            <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)', whiteSpace: 'nowrap', background: 'rgba(0,0,0,.2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginaList.map(r => {
                          const dtOk  = !!parseBR(r.DtAdmissao);
                          const nOk   = !!r.Nome_Funcionario?.trim();
                          const cOk   = !!r.Des_Cargo?.trim();
                          const sOk   = !!r.Des_Secretaria?.trim();
                          const idade = Number(r.Idade);
                          const iOk   = idade >= 18 && idade <= 90;
                          return (
                            <tr key={r.Matricula} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                              <td style={{ padding: '9px 12px', fontSize: 12, color: '#15A050', fontFamily: 'monospace', fontWeight: 700 }}>{r.Matricula}</td>
                              <td style={{ padding: '9px 12px', fontSize: 12, color: nOk ? '#1e293b' : '#ef4444', whiteSpace: 'nowrap' }}>{r.Nome_Funcionario || '(vazio)'}</td>
                              <td style={{ padding: '9px 12px', fontSize: 11, color: cOk ? '#64748b' : '#dc2626', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Des_Cargo || '(vazio)'}</td>
                              <td style={{ padding: '9px 12px', fontSize: 11, color: sOk ? '#64748b' : '#dc2626', whiteSpace: 'nowrap' }}>{r.SiglaSec || r.Des_Secretaria || '(vazio)'}</td>
                              <td style={{ padding: '9px 12px', fontSize: 11, color: dtOk ? '#475569' : '#dc2626', whiteSpace: 'nowrap' }}>{fmtData(r.DtAdmissao)}</td>
                              <td style={{ padding: '9px 12px', fontSize: 11, color: iOk ? '#475569' : '#dc2626', whiteSpace: 'nowrap' }}>{r.Idade || '—'}</td>
                              <td style={{ padding: '9px 12px', fontSize: 10, color: '#f59e0b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getAnomalias(r)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>Página {pagina + 1} de {totalPages}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setPagina(p => p - 1)} disabled={pagina === 0} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(0, 0, 0, 0.06)', background: 'rgba(0, 0, 0, 0.02)', color: pagina === 0 ? '#334155' : '#64748b', fontSize: 12, cursor: pagina === 0 ? 'default' : 'pointer' }}>
                          <ChevronLeft size={13} /> Anterior
                        </button>
                        <button onClick={() => setPagina(p => p + 1)} disabled={pagina >= totalPages - 1} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(0, 0, 0, 0.06)', background: 'rgba(0, 0, 0, 0.02)', color: pagina >= totalPages - 1 ? '#334155' : '#64748b', fontSize: 12, cursor: pagina >= totalPages - 1 ? 'default' : 'pointer' }}>
                          Próxima <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
