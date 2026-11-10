import React, { useState, useCallback, useMemo } from 'react';
import {
  Upload, Search, Download, FileSpreadsheet, Hash, Users, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, Layers, CheckSquare, Square
} from 'lucide-react';
import {
  obterAbasArquivo,
  analisarProtocolosJustificativas,
  exportarProtocolosXLSX,
} from '@/modules/ponto/utils/analisarProtocolosJustificativas';

const CARD = {
  background: 'rgba(0,0,0,.02)',
  border: '1px solid rgba(0,0,0,.07)',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 16,
};

const TH = {
  padding: '8px 12px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.06em',
  color: 'var(--muted-c)', textAlign: 'left',
  borderBottom: '1px solid rgba(0,0,0,.06)',
  background: 'rgba(0,0,0,.03)',
};

const TD = {
  padding: '8px 12px', fontSize: 12,
  borderBottom: '1px solid rgba(0,0,0,.03)',
};

function KPI({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      padding: '14px 18px', borderRadius: 10,
      background: 'rgba(0,0,0,.02)',
      border: '1px solid rgba(0,0,0,.06)',
      borderTop: `3px solid ${cor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        {Icon && <Icon size={13} color={cor} />}
        <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function AbaAuditoriaProtocolos() {
  const [arquivo, setArquivo] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [abasDisponiveis, setAbasDisponiveis] = useState([]);
  const [abasSelecionadas, setAbasSelecionadas] = useState([]);
  const [carregandoAbas, setCarregandoAbas] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Sub-abas de visualização: 'protocolos' | 'servidores'
  const [visaoAtiva, setVisaoAtiva] = useState('protocolos');
  const [busca, setBusca] = useState('');
  const [filtroAno, setFiltroAno] = useState('todos'); // 'todos' | '2024' | '2025' | '2026'
  const [expandidos, setExpandidos] = useState(new Set());

  // Upload e detecção inicial de abas
  const handleSelecionarArquivo = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    setErro(null);
    setResultado(null);
    setCarregandoAbas(true);

    try {
      const { workbook: wb, sheetNames } = await obterAbasArquivo(f);
      setWorkbook(wb);
      setAbasDisponiveis(sheetNames);
      // Seleciona preferencialmente abas que contêm 'PGM' ou 'JUSTIFICADO' ou seleciona todas
      const abasSugeridas = sheetNames.filter(s =>
        !s.toUpperCase().includes('DINAMICA') &&
        (s.toUpperCase().includes('JUSTIFIC') || s.toUpperCase().includes('PGM') || s.toUpperCase().includes('DADOS'))
      );
      setAbasSelecionadas(abasSugeridas.length > 0 ? abasSugeridas : sheetNames);
    } catch (err) {
      setErro('Erro ao ler arquivo: ' + (err.message || 'formato inválido'));
    } finally {
      setCarregandoAbas(false);
    }
  }, []);

  const toggleAba = useCallback((nomeAba) => {
    setAbasSelecionadas(prev =>
      prev.includes(nomeAba)
        ? prev.filter(a => a !== nomeAba)
        : [...prev, nomeAba]
    );
  }, []);

  const selecionarTodasAbas = useCallback(() => {
    if (abasSelecionadas.length === abasDisponiveis.length) {
      setAbasSelecionadas([]);
    } else {
      setAbasSelecionadas([...abasDisponiveis]);
    }
  }, [abasSelecionadas, abasDisponiveis]);

  // Executar análise
  const processarAuditoria = useCallback(() => {
    if (!workbook || abasSelecionadas.length === 0) return;
    setProcessando(true);
    setErro(null);

    // Timeout leve para não travar a renderização do clique
    setTimeout(() => {
      try {
        const res = analisarProtocolosJustificativas(workbook, abasSelecionadas);
        setResultado(res);
        setExpandidos(new Set());
      } catch (err) {
        setErro('Erro ao processar protocolos: ' + err.message);
      } finally {
        setProcessando(false);
      }
    }, 50);
  }, [workbook, abasSelecionadas]);

  const toggleExpandido = useCallback((id) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filtros de Protocolos
  const protocolosFiltrados = useMemo(() => {
    if (!resultado) return [];
    let lista = resultado.listaProtocolos;

    if (filtroAno !== 'todos') {
      lista = lista.filter(p => p.ano === filtroAno);
    }

    const b = busca.trim().toLowerCase();
    if (b) {
      lista = lista.filter(p =>
        p.protocolo.includes(b) ||
        p.servidores.some(s => s.nome.toLowerCase().includes(b) || s.cartao.includes(b))
      );
    }

    return lista;
  }, [resultado, filtroAno, busca]);

  // Filtros de Servidores
  const servidoresFiltrados = useMemo(() => {
    if (!resultado) return [];
    let lista = resultado.listaServidores;

    const b = busca.trim().toLowerCase();
    if (b) {
      lista = lista.filter(s =>
        s.nome.toLowerCase().includes(b) ||
        s.cartao.includes(b) ||
        (s.setor && s.setor.toLowerCase().includes(b)) ||
        s.protocolos.some(p => p.protocolo.includes(b))
      );
    }

    return lista;
  }, [resultado, busca]);

  return (
    <div>
      {/* ── Box de Instruções e Upload ── */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Identificação & Auditoria de Protocolos Digitais (PD)
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-c)', marginTop: 2 }}>
              Algoritmo de varredura por expressão regular (12 dígitos iniciados em 2024, 2025 ou 2026).
              Detecta cada protocolo mesmo com textos mistos, quebras de linha ou múltiplos números por observação.
            </div>
          </div>
        </div>

        {/* Upload */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 8,
            background: '#0284c7', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'opacity .15s'
          }}>
            <Upload size={16} />
            {arquivo ? 'Trocar Planilha (.xlsx, .xlsm, .csv)' : 'Selecionar Planilha de Justificativas'}
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleSelecionarArquivo}
            />
          </label>
          {arquivo && (
            <div style={{ fontSize: 12, color: 'var(--text)' }}>
              <strong>Arquivo carregado:</strong> {arquivo.name} ({Math.round(arquivo.size / 1024)} KB)
            </div>
          )}
        </div>

        {carregandoAbas && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted-c)' }}>
            Lendo estrutura e abas da planilha...
          </div>
        )}

        {/* Seleção de Abas */}
        {abasDisponiveis.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                Selecione as abas a serem auditadas:
              </div>
              <button
                type="button"
                onClick={selecionarTodasAbas}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                {abasSelecionadas.length === abasDisponiveis.length ? 'Desmarcar Todas' : 'Marcar Todas'}
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {abasDisponiveis.map(nomeAba => {
                const ativa = abasSelecionadas.includes(nomeAba);
                const isDinamica = nomeAba.toUpperCase().includes('DINAMICA');
                return (
                  <button
                    key={nomeAba}
                    type="button"
                    onClick={() => toggleAba(nomeAba)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 6,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      border: ativa ? '1px solid #0284c7' : '1px solid rgba(0,0,0,.1)',
                      background: ativa ? 'rgba(2,132,199,.1)' : 'rgba(0,0,0,.02)',
                      color: ativa ? '#0284c7' : 'var(--text)',
                    }}
                  >
                    {ativa ? <CheckSquare size={13} color="#0284c7" /> : <Square size={13} color="var(--muted-c)" />}
                    <span>{nomeAba}</span>
                    {isDinamica && <span style={{ fontSize: 9, opacity: 0.6 }}>(Tabela Dinâmica)</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={processarAuditoria}
                disabled={processando || abasSelecionadas.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 22px', borderRadius: 8,
                  background: abasSelecionadas.length === 0 ? '#94a3b8' : '#0D7C3D',
                  color: '#fff', fontSize: 13, fontWeight: 600, border: 'none',
                  cursor: abasSelecionadas.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {processando ? 'Extraindo e cruzando protocolos...' : 'Processar Auditoria de Protocolos'}
              </button>
            </div>
          </div>
        )}

        {erro && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
            color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertTriangle size={15} />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* ── KPIs e Resultados ── */}
      {resultado && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <KPI
              label="Total Usos de Protocolo"
              valor={resultado.kpis.totalUsosIdentificados}
              sub={`Em ${resultado.kpis.linhasComProtocolo.toLocaleString('pt-BR')} linhas com protocolo`}
              cor="#0284c7"
              icon={Hash}
            />
            <KPI
              label="Protocolos Distintos"
              valor={resultado.kpis.totalProtocolosDistintos}
              sub="Códigos únicos encontrados"
              cor="#0D7C3D"
              icon={Layers}
            />
            <KPI
              label="Servidores Auditados"
              valor={resultado.kpis.totalServidoresIdentificados}
              sub="Servidores que usaram protocolos"
              cor="#9333ea"
              icon={Users}
            />
            <KPI
              label="Linhas Analisadas"
              valor={resultado.kpis.totalLinhasAnalisadas}
              sub={`${resultado.kpis.linhasSemProtocolo} sem protocolo identificado`}
              cor="#64748b"
              icon={CheckCircle}
            />
          </div>

          {/* Barra de Ações & Filtros */}
          <div style={{
            ...CARD, padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12
          }}>
            {/* Alternador de Visão */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.04)', padding: 3, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setVisaoAtiva('protocolos')}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: visaoAtiva === 'protocolos' ? '#fff' : 'transparent',
                  color: visaoAtiva === 'protocolos' ? '#0284c7' : 'var(--muted-c)',
                  boxShadow: visaoAtiva === 'protocolos' ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}
              >
                Por Protocolo ({protocolosFiltrados.length})
              </button>
              <button
                type="button"
                onClick={() => setVisaoAtiva('servidores')}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: visaoAtiva === 'servidores' ? '#fff' : 'transparent',
                  color: visaoAtiva === 'servidores' ? '#0284c7' : 'var(--muted-c)',
                  boxShadow: visaoAtiva === 'servidores' ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}
              >
                Por Servidor ({servidoresFiltrados.length})
              </button>
            </div>

            {/* Busca & Filtro Ano */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 450 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.07)',
                flex: 1
              }}>
                <Search size={13} color="var(--muted-c)" />
                <input
                  type="text"
                  placeholder={visaoAtiva === 'protocolos' ? 'Buscar protocolo ou servidor...' : 'Buscar servidor, matrícula ou setor...'}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', width: '100%' }}
                />
              </div>

              {visaoAtiva === 'protocolos' && (
                <select
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 12,
                    background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.07)',
                    color: 'var(--text)', outline: 'none'
                  }}
                >
                  <option value="todos">Todos os Anos</option>
                  <option value="2026">Ano 2026</option>
                  <option value="2025">Ano 2025</option>
                  <option value="2024">Ano 2024</option>
                </select>
              )}
            </div>

            {/* Botão Exportar Excel */}
            <button
              type="button"
              onClick={() => exportarProtocolosXLSX(resultado)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: '#0D7C3D', color: '#fff', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer'
              }}
            >
              <Download size={14} />
              Exportar XLSX Completo
            </button>
          </div>

          {/* ── TABELA 1: VISÃO POR PROTOCOLO ── */}
          {visaoAtiva === 'protocolos' && (
            <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ ...TH, width: 40 }}></th>
                      <th style={TH}>Protocolo Digital (PD)</th>
                      <th style={{ ...TH, width: 80 }}>Ano</th>
                      <th style={{ ...TH, textAlign: 'center', width: 140 }}>Total de Usos</th>
                      <th style={{ ...TH, textAlign: 'center', width: 160 }}>Qtd Servidores</th>
                      <th style={TH}>Servidores que utilizaram</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protocolosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ ...TD, textAlign: 'center', padding: '24px 12px', color: 'var(--muted-c)' }}>
                          Nenhum protocolo encontrado para o filtro aplicado.
                        </td>
                      </tr>
                    ) : (
                      protocolosFiltrados.map((item) => {
                        const aberto = expandidos.has(item.protocolo);
                        return (
                          <React.Fragment key={item.protocolo}>
                            <tr
                              onClick={() => toggleExpandido(item.protocolo)}
                              style={{
                                cursor: 'pointer',
                                background: aberto ? 'rgba(2,132,199,.04)' : 'transparent',
                                transition: 'background .1s'
                              }}
                            >
                              <td style={{ ...TD, textAlign: 'center' }}>
                                {aberto ? <ChevronUp size={14} color="#0284c7" /> : <ChevronDown size={14} color="var(--muted-c)" />}
                              </td>
                              <td style={{ ...TD, fontWeight: 700, fontFamily: 'monospace', fontSize: 13, color: '#0284c7' }}>
                                {item.protocolo}
                              </td>
                              <td style={TD}>
                                <span style={{
                                  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                  background: item.ano === '2026' ? 'rgba(13,124,61,.1)' : item.ano === '2025' ? 'rgba(2,132,199,.1)' : 'rgba(0,0,0,.06)',
                                  color: item.ano === '2026' ? '#0D7C3D' : item.ano === '2025' ? '#0284c7' : 'var(--text)',
                                }}>
                                  {item.ano}
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>
                                <span style={{
                                  display: 'inline-block', minWidth: 32, padding: '2px 8px', borderRadius: 12,
                                  background: item.totalUsos > 50 ? 'rgba(220,38,38,.1)' : 'rgba(0,0,0,.05)',
                                  color: item.totalUsos > 50 ? '#dc2626' : 'var(--text)'
                                }}>
                                  {item.totalUsos}
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: 'center', color: 'var(--muted-c)' }}>
                                {item.totalServidores} {item.totalServidores === 1 ? 'servidor' : 'servidores'}
                              </td>
                              <td style={{ ...TD, color: 'var(--text)', fontSize: 11 }}>
                                {item.servidores.slice(0, 3).map(s => `${s.nome} (${s.qtd}x)`).join(', ')}
                                {item.servidores.length > 3 && ` + ${item.servidores.length - 3} outros`}
                              </td>
                            </tr>

                            {/* Detalhamento expandido dos servidores deste protocolo */}
                            {aberto && (
                              <tr style={{ background: 'rgba(2,132,199,.02)' }}>
                                <td colSpan={6} style={{ padding: '10px 16px 14px 44px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', marginBottom: 8 }}>
                                    Detalhamento de Servidores que usaram o Protocolo {item.protocolo} ({item.servidores.length})
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                                    {item.servidores.map((s, idx) => (
                                      <div key={idx} style={{
                                        padding: '8px 12px', borderRadius: 8,
                                        background: '#fff', border: '1px solid rgba(0,0,0,.07)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                      }}>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.nome}</div>
                                          <div style={{ fontSize: 10, color: 'var(--muted-c)' }}>
                                            {s.cartao ? `Mat: ${s.cartao}` : ''} {s.setor ? `• ${s.setor}` : ''}
                                          </div>
                                        </div>
                                        <div style={{
                                          padding: '2px 8px', borderRadius: 10,
                                          background: 'rgba(2,132,199,.1)', color: '#0284c7',
                                          fontSize: 11, fontWeight: 700
                                        }}>
                                          {s.qtd} {s.qtd === 1 ? 'vez' : 'vezes'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TABELA 2: VISÃO POR SERVIDOR ── */}
          {visaoAtiva === 'servidores' && (
            <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ ...TH, width: 40 }}></th>
                      <th style={TH}>Servidor</th>
                      <th style={TH}>Setor / Gerência</th>
                      <th style={{ ...TH, textAlign: 'center', width: 140 }}>Total Justificativas</th>
                      <th style={{ ...TH, textAlign: 'center', width: 160 }}>Qtd Protocolos Usados</th>
                      <th style={TH}>Principais Protocolos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servidoresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ ...TD, textAlign: 'center', padding: '24px 12px', color: 'var(--muted-c)' }}>
                          Nenhum servidor encontrado para o filtro aplicado.
                        </td>
                      </tr>
                    ) : (
                      servidoresFiltrados.map((item) => {
                        const aberto = expandidos.has(item.chave);
                        return (
                          <React.Fragment key={item.chave}>
                            <tr
                              onClick={() => toggleExpandido(item.chave)}
                              style={{
                                cursor: 'pointer',
                                background: aberto ? 'rgba(147,51,234,.04)' : 'transparent',
                                transition: 'background .1s'
                              }}
                            >
                              <td style={{ ...TD, textAlign: 'center' }}>
                                {aberto ? <ChevronUp size={14} color="#9333ea" /> : <ChevronDown size={14} color="var(--muted-c)" />}
                              </td>
                              <td style={TD}>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.nome}</div>
                                {item.cartao && <div style={{ fontSize: 10, color: 'var(--muted-c)' }}>Cartão: {item.cartao}</div>}
                              </td>
                              <td style={{ ...TD, fontSize: 11, color: 'var(--muted-c)' }}>
                                {item.setor || '-'}
                              </td>
                              <td style={{ ...TD, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>
                                <span style={{
                                  display: 'inline-block', minWidth: 32, padding: '2px 8px', borderRadius: 12,
                                  background: item.totalUsos > 50 ? 'rgba(147,51,234,.1)' : 'rgba(0,0,0,.05)',
                                  color: item.totalUsos > 50 ? '#9333ea' : 'var(--text)'
                                }}>
                                  {item.totalUsos}
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: 'center', color: 'var(--muted-c)' }}>
                                {item.totalProtocolosDistintos} {item.totalProtocolosDistintos === 1 ? 'protocolo' : 'protocolos'}
                              </td>
                              <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: 'var(--text)' }}>
                                {item.protocolos.slice(0, 3).map(p => `${p.protocolo} (${p.qtd}x)`).join(', ')}
                                {item.protocolos.length > 3 && ` + ${item.protocolos.length - 3} outros`}
                              </td>
                            </tr>

                            {/* Detalhamento expandido dos protocolos deste servidor */}
                            {aberto && (
                              <tr style={{ background: 'rgba(147,51,234,.02)' }}>
                                <td colSpan={6} style={{ padding: '10px 16px 14px 44px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', marginBottom: 8 }}>
                                    Protocolos Utilizados por {item.nome} ({item.protocolos.length} protocolos)
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                    {item.protocolos.map((p, idx) => (
                                      <div key={idx} style={{
                                        padding: '7px 10px', borderRadius: 6,
                                        background: '#fff', border: '1px solid rgba(0,0,0,.07)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                      }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#0284c7' }}>
                                          {p.protocolo}
                                        </span>
                                        <span style={{
                                          padding: '2px 7px', borderRadius: 10,
                                          background: 'rgba(147,51,234,.1)', color: '#9333ea',
                                          fontSize: 11, fontWeight: 700
                                        }}>
                                          {p.qtd}x
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

