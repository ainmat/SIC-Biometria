import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import {
  fetchCompetencias,
  fetchConferencia,
  fetchSecretariasDaCompetencia,
} from '@/modules/folha/services/folhaService';
import { fmtCompetencia } from '@/modules/folha/constants';
import { SearchSelect } from '@/components/ui/search-select';
import { baixarCSV } from '@/lib/exportar';

function statusDivergencia(r) {
  const temPonto = r.faltas_ponto > 0 || r.atrasos_ponto > 0;
  const temFolha = r.faltas_folha > 0 || r.atrasos_fracao_folha > 0 || r.atrasos_dia_folha > 0;
  if (!temPonto && !temFolha) return { key: 'semOc',    label: 'Sem oc.',   color: '#475569', bg: 'rgba(71,85,105,.12)'   };
  if (temPonto && temFolha)   return { key: 'concordam',label: 'Concordam', color: '#34d399', bg: 'rgba(52,211,153,.12)'  };
  if (temPonto)               return { key: 'soPonto',  label: 'Só Ponto',  color: '#fbbf24', bg: 'rgba(251,191,36,.12)'  };
  return                             { key: 'soFolha',  label: 'Só Folha',  color: '#a78bfa', bg: 'rgba(167,139,250,.12)' };
}

const STATUS_OPTS = [
  { key: '',          label: 'Todos',     color: '#94a3b8', bg: 'rgba(148,163,184,.12)' },
  { key: 'concordam', label: 'Concordam', color: '#34d399', bg: 'rgba(52,211,153,.12)'  },
  { key: 'soPonto',   label: 'Só Ponto',  color: '#fbbf24', bg: 'rgba(251,191,36,.12)'  },
  { key: 'soFolha',   label: 'Só Folha',  color: '#a78bfa', bg: 'rgba(167,139,250,.12)' },
];

export default function ConferenciaFolha() {
  const [competencias,   setCompetencias]   = useState([]);
  const [secretarias,    setSecretarias]    = useState([]);
  const [filtroComp,     setFiltroComp]     = useState('');
  const [filtroSec,      setFiltroSec]      = useState('');
  const [filtroStatus,   setFiltroStatus]   = useState('');
  const [dados,          setDados]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [erro,           setErro]           = useState('');

  // Siglas com ponto neste período — derivadas ao carregar "Todas"
  const [siglasComPonto, setSiglasComPonto] = useState(new Set());

  useEffect(() => {
    fetchCompetencias().then(setCompetencias).catch(console.error);
  }, []);

  useEffect(() => {
    if (!filtroComp) { setSecretarias([]); setSiglasComPonto(new Set()); return; }
    fetchSecretariasDaCompetencia(filtroComp).then(setSecretarias).catch(console.error);
    setFiltroSec('');
    setFiltroStatus('');
  }, [filtroComp]);

  useEffect(() => {
    if (!filtroComp) { setDados([]); setErro(''); return; }
    setLoading(true);
    setErro('');
    fetchConferencia({ competencia: filtroComp, secretaria: filtroSec || null })
      .then(d => {
        setDados(d);
        // Ao carregar "Todas", registra quais secretarias têm ponto
        if (!filtroSec) {
          setSiglasComPonto(new Set(d.map(r => r.secretaria_sigla).filter(Boolean)));
        }
      })
      .catch(e => {
        if (e?.code === 'PGRST202' || e?.code === '42883' || e?.message?.includes('function')) {
          setErro('RPC get_conferencia_biometria_folha não encontrada. Execute o script SQL de migração no Supabase Dashboard.');
        } else {
          setErro(`Erro: ${e.message}`);
        }
        setDados([]);
      })
      .finally(() => setLoading(false));
  }, [filtroComp, filtroSec]);

  // Secretarias válidas = apenas as que têm pelo menos um registro de ponto
  const secretariasOpts = useMemo(() => {
    if (siglasComPonto.size === 0) return secretarias;
    return secretarias.filter(s => siglasComPonto.has(s.sigla));
  }, [secretarias, siglasComPonto]);

  const kpis = useMemo(() => {
    const total    = dados.length;
    const concordam = dados.filter(r => {
      const tp = r.faltas_ponto > 0 || r.atrasos_ponto > 0;
      const tf = r.faltas_folha > 0 || r.atrasos_fracao_folha > 0 || r.atrasos_dia_folha > 0;
      return tp && tf;
    }).length;
    const soFolha = dados.filter(r =>
      r.faltas_ponto === 0 && r.atrasos_ponto === 0 &&
      (r.faltas_folha > 0 || r.atrasos_fracao_folha > 0 || r.atrasos_dia_folha > 0)
    ).length;
    const soPonto = dados.filter(r =>
      r.faltas_folha === 0 && r.atrasos_fracao_folha === 0 && r.atrasos_dia_folha === 0 &&
      (r.faltas_ponto > 0 || r.atrasos_ponto > 0)
    ).length;
    return { total, concordam, divergem: total - concordam, soFolha, soPonto };
  }, [dados]);

  const dadosFiltrados = useMemo(() => {
    if (!filtroStatus) return dados;
    return dados.filter(r => statusDivergencia(r).key === filtroStatus);
  }, [dados, filtroStatus]);

  function exportar() {
    if (!dadosFiltrados.length) return;
    const sufixo = filtroStatus ? `_${filtroStatus}` : '';
    baixarCSV(
      `conferencia_${fmtCompetencia(filtroComp).replace('/', '-')}${sufixo}.csv`,
      ['Matrícula', 'Nome', 'Secretaria', 'Faltas Ponto', 'Atrasos Ponto', 'Faltas Folha', 'Atr. <1h Folha', 'Atr. ≥1h Folha', 'Status'],
      dadosFiltrados.map(r => {
        const st = statusDivergencia(r);
        return [r.matricula, r.nome || '', r.secretaria_sigla || '', r.faltas_ponto, r.atrasos_ponto, r.faltas_folha, r.atrasos_fracao_folha, r.atrasos_dia_folha, st.label];
      })
    );
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Conferência Ponto × Folha</h1>
          <p>Cruzamento entre registros biométricos e folha processada</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 5 }}>Competência*</div>
            <select
              value={filtroComp}
              onChange={e => setFiltroComp(e.target.value)}
              className="sel-dark"
              style={{ minWidth: 140, borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', color: filtroComp ? '#f1f5f9' : '#64748b', fontSize: 13 }}
            >
              <option value="">Selecione...</option>
              {competencias.map(c => <option key={c} value={c}>{fmtCompetencia(c)}</option>)}
            </select>
          </div>
          <SearchSelect
            label="Secretaria"
            value={filtroSec}
            onChange={v => { setFiltroSec(v); setFiltroStatus(''); }}
            disabled={!filtroComp}
            placeholder="Todas"
            minWidth={140}
            options={secretariasOpts.map(s => ({ value: s.sigla, label: `${s.sigla}${s.nome ? ` — ${s.nome}` : ''}` }))}
          />
          {dados.length > 0 && (
            <button onClick={exportar} style={{
              padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
              background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)',
              color: '#34d399', fontSize: 12, fontWeight: 600, alignSelf: 'flex-end',
            }}>
              ⬇ Exportar CSV
            </button>
          )}
        </div>

        {!filtroComp && (
          <div className="chart-card" style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Selecione uma competência</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              O cruzamento ponto biométrico × folha será carregado após a seleção
            </div>
          </div>
        )}

        {erro && (
          <div style={{
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 10, padding: '14px 18px', color: '#f87171', fontSize: 13, marginBottom: 20,
          }}>
            {erro}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Carregando dados...</div>
        )}

        {filtroComp && !loading && !erro && (
          <>
            {/* KPIs */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
              {[
                { label: 'Servidores',  value: kpis.total,     color: '#60a5fa', bg: '#3b82f6' },
                { label: 'Concordam',   value: kpis.concordam, color: '#34d399', bg: '#10b981' },
                { label: 'Divergem',    value: kpis.divergem,  color: '#f87171', bg: '#ef4444' },
                { label: 'Só no Ponto', value: kpis.soPonto,   color: '#fbbf24', bg: '#f59e0b' },
                { label: 'Só na Folha', value: kpis.soFolha,   color: '#a78bfa', bg: '#8b5cf6' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="kpi-card">
                  <div className="kpi-accent" style={{ background: bg }} />
                  <div className="kpi-label">{label}</div>
                  <div className="kpi-value" style={{ color, fontSize: 28, paddingLeft: 10 }}>
                    {value.toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div className="table-card">
              <div className="chart-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="chart-title">Cruzamento Servidor a Servidor</div>
                  <div className="chart-sub">
                    {filtroStatus
                      ? `${dadosFiltrados.length} de ${dados.length} servidores`
                      : `${dados.length} servidor${dados.length !== 1 ? 'es' : ''}`}
                    {filtroSec ? ` · ${filtroSec}` : ' · todas as secretarias com ponto'} · {fmtCompetencia(filtroComp)}
                  </div>
                </div>

                {/* Filtros de status — clicáveis */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {STATUS_OPTS.map(opt => {
                    const isActive = filtroStatus === opt.key;
                    const count = opt.key === ''
                      ? dados.length
                      : opt.key === 'concordam' ? kpis.concordam
                      : opt.key === 'soPonto'   ? kpis.soPonto
                      : kpis.soFolha;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setFiltroStatus(isActive ? '' : opt.key)}
                        title={isActive ? 'Remover filtro' : `Filtrar: ${opt.label}`}
                        style={{
                          fontSize: 10, padding: '3px 9px', borderRadius: 8, cursor: 'pointer',
                          background: isActive ? opt.bg : 'rgba(255,255,255,.04)',
                          color: isActive ? opt.color : '#64748b',
                          border: `1px solid ${isActive ? opt.color + '55' : 'rgba(255,255,255,.08)'}`,
                          fontWeight: isActive ? 700 : 500,
                          transition: 'all .15s',
                        }}
                      >
                        {opt.label}
                        {opt.key !== '' && (
                          <span style={{ marginLeft: 5, opacity: .7 }}>
                            {count.toLocaleString('pt-BR')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Nome</th>
                      <th>Sec.</th>
                      <th style={{ textAlign: 'center', color: '#60a5fa' }}>Faltas<br /><span style={{ fontWeight: 400, fontSize: 9 }}>Ponto</span></th>
                      <th style={{ textAlign: 'center', color: '#60a5fa' }}>Atrasos<br /><span style={{ fontWeight: 400, fontSize: 9 }}>Ponto</span></th>
                      <th style={{ textAlign: 'center', color: '#fbbf24' }}>Faltas<br /><span style={{ fontWeight: 400, fontSize: 9 }}>Folha</span></th>
                      <th style={{ textAlign: 'center', color: '#fbbf24' }}>Atr. &lt;1h<br /><span style={{ fontWeight: 400, fontSize: 9 }}>Folha</span></th>
                      <th style={{ textAlign: 'center', color: '#fbbf24' }}>Atr. ≥1h<br /><span style={{ fontWeight: 400, fontSize: 9 }}>Folha</span></th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.map(r => {
                      const st = statusDivergencia(r);
                      return (
                        <tr key={r.matricula}>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{r.matricula}</td>
                          <td style={{ fontSize: 11, color: '#f1f5f9', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(99,102,241,.15)', color: '#a5b4fc', fontWeight: 700 }}>
                              {r.secretaria_sigla || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.faltas_ponto > 0 ? '#60a5fa' : '#374151' }}>{r.faltas_ponto}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.atrasos_ponto > 0 ? '#60a5fa' : '#374151' }}>{r.atrasos_ponto}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.faltas_folha > 0 ? '#fbbf24' : '#374151' }}>{r.faltas_folha}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.atrasos_fracao_folha > 0 ? '#fbbf24' : '#374151' }}>{r.atrasos_fracao_folha}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.atrasos_dia_folha > 0 ? '#fbbf24' : '#374151' }}>{r.atrasos_dia_folha}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: st.bg, color: st.color, fontWeight: 700 }}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {dadosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
                          {filtroStatus
                            ? `Nenhum servidor com status "${STATUS_OPTS.find(o => o.key === filtroStatus)?.label}"${filtroSec ? ` em ${filtroSec}` : ''}`
                            : 'Nenhum servidor com divergência encontrado'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
