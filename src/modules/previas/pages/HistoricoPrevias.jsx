import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, Download, RefreshCw, ChevronDown, ChevronUp, TrendingUp, XCircle, Timer, Activity } from 'lucide-react';
import { SECRETARIAS, formatarCompetencia } from '@/modules/previas/constants';
import { labelClassificacao, corClassificacao, analisarComHistorico } from '@/modules/previas/utils/analise';
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
      background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.05)',
    }}>
      <span style={{ fontSize: 15, color: color || '#15A050', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(value)}</span>
      <span style={{ fontSize: 9, color: 'var(--muted-c)', marginTop: 2 }}>{label}</span>
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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
          <button
            onClick={exportarCSV}
            disabled={filtrados.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: filtrados.length ? '#0D7C3D' : 'rgba(0, 0, 0, 0.04)', border: 'none', color: filtrados.length ? '#fff' : '#475569', cursor: filtrados.length ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}
          >
            <Download size={12} /> Exportar
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 250, background: 'var(--surface)', padding: '12px 20px', borderRadius: 99, border: '1px solid var(--border-c)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <Search size={16} color="#64748b" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar secretaria por nome ou sigla..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, fontWeight: 500 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: '12px 20px', borderRadius: 99, border: '1px solid var(--border-c)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <Filter size={15} color="#64748b" />
            <select
              value={filtroAno}
              onChange={e => setFiltroAno(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: filtroAno ? 'var(--text)' : '#64748b', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Todos os anos</option>
              {ANOS.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-c)' }}>Carregando histórico...</div>
        ) : erro ? (
          <div className="chart-card" style={{ color: '#dc2626', fontSize: 13 }}>
            <strong>Erro:</strong> {erro}
            {erro?.includes('relation') && (
              <div style={{ marginTop: 8, color: 'var(--muted-c)', fontSize: 12 }}>
                A tabela <code>previas_publicadas</code> ainda não foi criada. Execute <code>previas_publicadas.sql</code> no Supabase.
              </div>
            )}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: 60, color: 'var(--muted-c)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhuma prévia publicada</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Use o Simulador para publicar a primeira prévia</div>
          </div>
        ) : (
          <>
            {/* ── Consolidated overview banner ── */}
            <div
              style={{
                display: 'flex', flexDirection: 'column', marginBottom: 32,
                background: 'linear-gradient(135deg, rgba(13,124,61,0.95), rgba(13,124,61,0.75))',
                borderRadius: 20, padding: '24px 32px', color: '#fff',
                boxShadow: '0 12px 32px rgba(13,124,61,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: -100, right: -50, width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
              
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Visão Consolidada do Histórico</div>
                  <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 500 }}>
                    {consolidado.primeiroPeriodo 
                      ? `Período analisado: ${formatarCompetencia(consolidado.primeiroPeriodo)} até ${formatarCompetencia(consolidado.ultimoPeriodo)}`
                      : 'Nenhum período disponível'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', fontSize: 13, fontWeight: 600 }}>
                    {consolidado.secretariasAtivas} secretarias
                  </span>
                  <span style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 600 }}>
                    {consolidado.totalPrevias} prévias
                  </span>
                  {consolidado.alertas > 0 && (
                    <span style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>
                      {consolidado.alertas} alertas
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                <div style={{ flex: '1 1 200px', background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', border: '1px solid var(--border-c)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={16} color="#f59e0b" /> Ocorrências Totais</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(consolidado.totalOcorrencias)}</div>
                </div>
                <div style={{ flex: '1 1 200px', background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', border: '1px solid var(--border-c)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={16} color="#ef4444" /> Faltas Acumuladas</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(consolidado.totalFaltas)}</div>
                </div>
                <div style={{ flex: '1 1 200px', background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', border: '1px solid var(--border-c)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={16} color="#f97316" /> Atrasos Acumulados</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f97316', fontFamily: 'monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(consolidado.totalAtrasos)}</div>
                </div>
                <div style={{ flex: '1 1 200px', background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', border: '1px solid var(--border-c)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={16} color="#10b981" /> Servidores</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', fontFamily: 'monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(consolidado.totalServidores)}</div>
                </div>
              </div>
            </div>

            {/* ── Expand / collapse controls ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>
                {secretariasFiltradas.length} secretaria{secretariasFiltradas.length !== 1 ? 's' : ''} com dados
              </span>
              <button
                onClick={toggleTodos}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', cursor: 'pointer', fontSize: 11 }}
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
                    style={{
                      background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
                      border: '1px solid var(--border-c)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s', position: 'relative'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = sec.cor; e.currentTarget.style.boxShadow = `0 8px 24px ${sec.cor}20`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-c)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: sec.cor }} />

                    {/* Header — always visible */}
                    <button
                      onClick={() => toggleExpand(sec.codigo)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                        padding: '16px 20px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ width: 36, height: 36, borderRadius: '50%', background: `${sec.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sec.cor, fontSize: 13, fontWeight: 800 }}>
                        {sec.numero}
                      </span>
                      <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        {sec.sigla || sec.codigo}
                      </span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted-c)', fontWeight: 500 }}>
                          {sec.periodos.length} período{sec.periodos.length !== 1 ? 's' : ''}
                          {ultimo ? ` · último: ${formatarCompetencia(ultimo.competencia)}` : ''}
                        </span>
                        
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ padding: '4px 10px', borderRadius: 99, background: '#fef3c7', color: '#b45309', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                            {fmt(totOcorr)} ocorr.
                          </span>
                          <span style={{ padding: '4px 10px', borderRadius: 99, background: '#fee2e2', color: '#b91c1c', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                            {fmt(totFaltas)} F
                          </span>
                          <span style={{ padding: '4px 10px', borderRadius: 99, background: '#ffedd5', color: '#c2410c', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                            {fmt(totAtrasos)} A
                          </span>
                        </div>
                        
                        <div style={{ background: 'rgba(0,0,0,0.04)', padding: 6, borderRadius: 50 }}>
                          {aberta
                            ? <ChevronUp   size={16} color="#64748b" />
                            : <ChevronDown size={16} color="#64748b" />}
                        </div>
                      </div>
                    </button>

                    {/* Periods list — visible when expanded */}
                    {aberta && (
                      <div style={{ borderTop: '1px solid var(--border-c)', background: 'var(--bg)', padding: '16px 20px' }}>
                        
                        {/* Table Header pseudo-grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px 140px 100px', gap: 16, padding: '0 16px 12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <div>Competência</div>
                          <div style={{ textAlign: 'right' }}>Ocorrências</div>
                          <div style={{ textAlign: 'right' }}>Faltas</div>
                          <div style={{ textAlign: 'right' }}>Atrasos</div>
                          <div style={{ textAlign: 'right' }}>Servidores</div>
                          <div style={{ textAlign: 'right' }}>Méd. Desc.</div>
                          <div>Classificação</div>
                          <div style={{ textAlign: 'right' }}>Publicado em</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {sec.periodos.map((d, i) => {
                            const historicoPassado = sec.periodos.slice(i + 1);
                            const analise = analisarComHistorico(d.total_ocorrencias, historicoPassado);
                            const classificacaoFinal = analise.classificacao !== 'sem_historico' ? analise.classificacao : d.classificacao_alerta;
                            
                            return (
                              <div key={d.id || d.competencia} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px 140px 100px', gap: 16, alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-c)', transition: 'background 0.2s' }}>
                                
                                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#15A050' }}>
                                  {formatarCompetencia(d.competencia)}
                                </div>
                                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmt(d.total_ocorrencias)}</div>
                                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmt(d.total_faltas || 0)}</div>
                                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#ea580c' }}>{fmt(d.total_atrasos || 0)}</div>
                                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmt(d.servidores_impactados)}</div>
                                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-c)', fontWeight: 600 }}>
                                  {d.media_desconto != null ? `${d.media_desconto}%` : '—'}
                                </div>
                                <div><BadgeAlerta classificacao={classificacaoFinal} /></div>
                                <div style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 500, textAlign: 'right' }}>
                                  {d.data_publicacao
                                    ? new Date(d.data_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : '—'}
                                </div>
                                
                              </div>
                            );
                          })}
                        </div>
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
