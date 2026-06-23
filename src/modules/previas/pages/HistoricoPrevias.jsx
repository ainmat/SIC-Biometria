import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { SECRETARIAS, formatarCompetencia } from '@/modules/previas/constants';
import { labelClassificacao, corClassificacao } from '@/modules/previas/utils/analise';
import { fetchPublicadas } from '@/modules/previas/services/previasService';

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i).reverse();

function fmt(n) { return (n || 0).toLocaleString('pt-BR'); }

function BadgeAlerta({ classificacao }) {
  if (!classificacao) return null;
  const cor = corClassificacao(classificacao);
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontWeight: 600, color: cor,
      background: `${cor}18`, border: `1px solid ${cor}30`,
    }}>
      {labelClassificacao(classificacao)}
    </span>
  );
}

function StatChip({ label, value, color }) {
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: '6px 14px', borderRadius: 8,
      background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
    }}>
      <span style={{ fontSize: 15, color: color || '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(value)}</span>
      <span style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{label}</span>
    </span>
  );
}

function PillTag({ value, color }) {
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4,
      background: `${color}18`, color,
      fontSize: 10, fontWeight: 600,
    }}>
      {value}
    </span>
  );
}

export default function HistoricoPrevias() {
  const [dados, setDados]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [erro, setErro]                 = useState(null);
  const [filtroAno, setFiltroAno]       = useState('');
  const [busca, setBusca]               = useState('');
  const [expandidos, setExpandidos]     = useState(new Set());
  const [todosAbertos, setTodosAbertos] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchPublicadas();
      setDados(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Apply year filter
  const filtrados = useMemo(
    () => dados.filter(d => !filtroAno || d.competencia?.startsWith(filtroAno)),
    [dados, filtroAno],
  );

  // Group by secretaria, preserve SECRETARIAS sort order
  const secretariasComDados = useMemo(() => {
    const mapa = {};
    filtrados.forEach(d => {
      const key = d.secretaria_codigo;
      if (!mapa[key]) mapa[key] = { codigo: key, nome: d.secretaria_nome, periodos: [] };
      mapa[key].periodos.push(d);
    });
    Object.values(mapa).forEach(s => {
      s.periodos.sort((a, b) => b.competencia.localeCompare(a.competencia));
    });
    return SECRETARIAS
      .filter(s => mapa[s.codigo])
      .map(s => ({ ...mapa[s.codigo], cor: s.cor, numero: s.numero, sigla: s.sigla }));
  }, [filtrados]);

  // Apply search filter on secretaria cards
  const secretariasFiltradas = useMemo(() => {
    if (!busca) return secretariasComDados;
    const q = busca.toLowerCase();
    return secretariasComDados.filter(s =>
      s.nome?.toLowerCase().includes(q) ||
      s.codigo?.toLowerCase().includes(q) ||
      s.numero?.includes(q),
    );
  }, [secretariasComDados, busca]);

  // Consolidated totals (across all filtrados, not just visible cards)
  const consolidado = useMemo(() => {
    const totalOcorrencias  = filtrados.reduce((s, d) => s + (d.total_ocorrencias || 0), 0);
    const totalFaltas       = filtrados.reduce((s, d) => s + (d.total_faltas || 0), 0);
    const totalAtrasos      = filtrados.reduce((s, d) => s + (d.total_atrasos || 0), 0);
    const totalServidores   = filtrados.reduce((s, d) => s + (d.servidores_impactados || 0), 0);
    const alertas           = filtrados.filter(d => ['anomalia_critica', 'atencao'].includes(d.classificacao_alerta)).length;
    const secretariasAtivas = new Set(filtrados.map(d => d.secretaria_codigo)).size;
    const competencias      = filtrados.map(d => d.competencia).sort();
    return {
      totalPrevias: filtrados.length, totalOcorrencias, totalFaltas, totalAtrasos,
      totalServidores, alertas, secretariasAtivas,
      primeiroPeriodo: competencias[0],
      ultimoPeriodo:   competencias[competencias.length - 1],
    };
  }, [filtrados]);

  const toggleExpand = (codigo) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(codigo) ? next.delete(codigo) : next.add(codigo);
      return next;
    });
  };

  const toggleTodos = () => {
    if (todosAbertos) {
      setExpandidos(new Set());
    } else {
      setExpandidos(new Set(secretariasFiltradas.map(s => s.codigo)));
    }
    setTodosAbertos(t => !t);
  };

  const exportarCSV = () => {
    const headers = ['Secretaria','Competência','Publicado em','Ocorrências','Faltas','Atrasos','Servidores','Desc. Total','Méd. Desconto','Z-Score','Classificação'];
    const rows = filtrados.map(d => [
      d.secretaria_nome,
      formatarCompetencia(d.competencia),
      d.data_publicacao ? new Date(d.data_publicacao).toLocaleDateString('pt-BR') : '',
      d.total_ocorrencias,
      d.total_faltas || 0,
      d.total_atrasos || 0,
      d.servidores_impactados,
      d.total_desconto_acumulado,
      d.media_desconto,
      d.z_score ?? '',
      d.classificacao_alerta ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `historico_previas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Histórico de Prévias</h1>
          <p>Prévias publicadas por secretaria</p>
        </div>
        <div className="topbar-right">
          <button
            onClick={carregar}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
          <button
            onClick={exportarCSV}
            disabled={filtrados.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: filtrados.length ? '#3b82f6' : 'rgba(255,255,255,.06)', border: 'none', color: filtrados.length ? '#fff' : '#475569', cursor: filtrados.length ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}
          >
            <Download size={12} /> Exportar
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filters */}
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
              <Search size={14} color="#64748b" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Filtrar secretaria..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 13 }}
              />
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={13} color="#64748b" />
              <select
                value={filtroAno}
                onChange={e => setFiltroAno(e.target.value)}
                style={{ background: 'var(--card-bg)', border: 'none', color: filtroAno ? '#f1f5f9' : '#64748b', fontSize: 12, outline: 'none' }}
              >
                <option value="">Todos os anos</option>
                {ANOS.map(a => <option key={a} value={String(a)}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Carregando histórico...</div>
        ) : erro ? (
          <div className="chart-card" style={{ color: '#f87171', fontSize: 13 }}>
            <strong>Erro:</strong> {erro}
            {erro?.includes('relation') && (
              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
                A tabela <code>previas_publicadas</code> ainda não foi criada. Execute <code>previas_publicadas.sql</code> no Supabase.
              </div>
            )}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhuma prévia publicada</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Use o Simulador para publicar a primeira prévia</div>
          </div>
        ) : (
          <>
            {/* ── Consolidated overview card ── */}
            <div
              className="chart-card"
              style={{ marginBottom: 16, borderLeft: '3px solid #3b82f6' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Visão Consolidada</div>
                  {consolidado.primeiroPeriodo && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                      {formatarCompetencia(consolidado.primeiroPeriodo)}
                      {' → '}
                      {formatarCompetencia(consolidado.ultimoPeriodo)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(59,130,246,.15)', color: '#60a5fa', fontSize: 11, fontWeight: 600 }}>
                    {consolidado.secretariasAtivas} secretaria{consolidado.secretariasAtivas !== 1 ? 's' : ''}
                  </span>
                  <span style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,.06)', color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>
                    {consolidado.totalPrevias} prévias
                  </span>
                  {consolidado.alertas > 0 && (
                    <span style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(239,68,68,.15)', color: '#f87171', fontSize: 11, fontWeight: 600 }}>
                      {consolidado.alertas} alerta{consolidado.alertas !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatChip label="Ocorrências" value={consolidado.totalOcorrencias} color="#f59e0b" />
                <StatChip label="Faltas"      value={consolidado.totalFaltas}      color="#ef4444" />
                <StatChip label="Atrasos"     value={consolidado.totalAtrasos}     color="#f97316" />
                <StatChip label="Servidores"  value={consolidado.totalServidores}  color="#10b981" />
              </div>
            </div>

            {/* ── Expand / collapse controls ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {secretariasFiltradas.length} secretaria{secretariasFiltradas.length !== 1 ? 's' : ''} com dados
              </span>
              <button
                onClick={toggleTodos}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
              >
                {todosAbertos ? 'Colapsar tudo' : 'Expandir tudo'}
              </button>
            </div>

            {/* ── Individual secretaria cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {secretariasFiltradas.map(sec => {
                const aberta     = expandidos.has(sec.codigo);
                const totOcorr   = sec.periodos.reduce((s, d) => s + (d.total_ocorrencias || 0), 0);
                const totFaltas  = sec.periodos.reduce((s, d) => s + (d.total_faltas || 0), 0);
                const totAtrasos = sec.periodos.reduce((s, d) => s + (d.total_atrasos || 0), 0);
                const ultimo     = sec.periodos[0]; // sorted DESC

                return (
                  <div
                    key={sec.codigo}
                    className="chart-card"
                    style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${sec.cor}` }}
                  >
                    {/* Header — always visible */}
                    <button
                      onClick={() => toggleExpand(sec.codigo)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 16px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sec.cor, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                        {sec.numero} — {sec.sigla || sec.codigo}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {sec.periodos.length} período{sec.periodos.length !== 1 ? 's' : ''}
                          {ultimo ? ` · último: ${formatarCompetencia(ultimo.competencia)}` : ''}
                        </span>
                        <PillTag value={`${fmt(totOcorr)} ocorr.`}   color="#f59e0b" />
                        <PillTag value={`${fmt(totFaltas)} faltas`}   color="#ef4444" />
                        <PillTag value={`${fmt(totAtrasos)} atrasos`} color="#f97316" />
                        {aberta
                          ? <ChevronUp   size={14} color="#64748b" />
                          : <ChevronDown size={14} color="#64748b" />}
                      </div>
                    </button>

                    {/* Periods table — visible when expanded */}
                    {aberta && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', overflowX: 'auto' }}>
                        <table style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ paddingLeft: 32 }}>Competência</th>
                              <th style={{ textAlign: 'right' }}>Ocorrências</th>
                              <th style={{ textAlign: 'right' }}>Faltas</th>
                              <th style={{ textAlign: 'right' }}>Atrasos</th>
                              <th style={{ textAlign: 'right' }}>Servidores</th>
                              <th style={{ textAlign: 'right' }}>Méd. Desc.</th>
                              <th>Classificação</th>
                              <th>Publicado em</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.periodos.map(d => (
                              <tr key={d.id || d.competencia}>
                                <td style={{ paddingLeft: 32, fontFamily: 'monospace', fontSize: 12, color: '#60a5fa' }}>
                                  {formatarCompetencia(d.competencia)}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmt(d.total_ocorrencias)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#f87171' }}>{fmt(d.total_faltas || 0)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#fb923c' }}>{fmt(d.total_atrasos || 0)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmt(d.servidores_impactados)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                                  {d.media_desconto != null ? `${d.media_desconto}%` : '—'}
                                </td>
                                <td><BadgeAlerta classificacao={d.classificacao_alerta} /></td>
                                <td style={{ fontSize: 11, color: '#64748b' }}>
                                  {d.data_publicacao
                                    ? new Date(d.data_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
