import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, X, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  User, Building2, Briefcase, Calendar, Clock, Award, Shield, Copy, Check, ExternalLink,
  SlidersHorizontal, Filter, Users
} from 'lucide-react';
import { baixarCSV } from '@/lib/exportar';
import {
  fetchServidoresPaginado,
  fetchServidorDetalhe,
  fetchOpcoesServidores,
} from '@/modules/servidores/services/servidoresService';
import { motion, AnimatePresence } from 'motion/react';
import { COR_SEC } from '@/lib/constants';

const PER_PAGE = 35;

function fmtData(s) {
  if (!s) return '—';
  return s.split(' ')[0];
}

function getAvatarColor(nome) {
  if (!nome) return { bg: 'rgba(100,116,139,0.12)', text: '#64748b' };
  const cores = [
    { bg: 'rgba(13, 124, 61, 0.12)', text: '#0D7C3D' },
    { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' },
    { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb' },
    { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' },
    { bg: 'rgba(234, 179, 8, 0.14)', text: '#B45309' },
    { bg: 'rgba(244, 63, 94, 0.12)', text: '#e11d48' },
  ];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % cores.length;
  return cores[idx];
}

function getInitials(nome) {
  if (!nome) return '?';
  const parts = nome.trim().split(/\s+/).filter(p => p.length > 1);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function calcularTempoServicoExtenso(dtAdmissaoStr) {
  if (!dtAdmissaoStr) return null;
  let dia, mes, ano;
  const dataLimpa = dtAdmissaoStr.split(' ')[0];
  if (dataLimpa.includes('/')) {
    const parts = dataLimpa.split('/');
    if (parts.length !== 3) return null;
    dia = parseInt(parts[0], 10);
    mes = parseInt(parts[1], 10);
    ano = parseInt(parts[2], 10);
  } else {
    const date = new Date(dtAdmissaoStr);
    if (isNaN(date.getTime())) return null;
    dia = date.getDate();
    mes = date.getMonth() + 1;
    ano = date.getFullYear();
  }

  const dtInicio = new Date(ano, mes - 1, dia);
  const dtFim = new Date();
  if (isNaN(dtInicio.getTime()) || dtInicio > dtFim) return '0 Dia(s)';

  let anos = dtFim.getFullYear() - dtInicio.getFullYear();
  let meses = dtFim.getMonth() - dtInicio.getMonth();
  let dias = dtFim.getDate() - dtInicio.getDate();

  if (dias < 0) {
    meses--;
    const prevMonth = new Date(dtFim.getFullYear(), dtFim.getMonth(), 0);
    dias += prevMonth.getDate();
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }

  const partes = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (meses > 0) partes.push(`${meses} m${meses > 1 ? 'eses' : 'ês'}`);
  if (dias > 0 || partes.length === 0) partes.push(`${dias} dia${dias > 1 ? 's' : ''}`);
  return partes.join(', ');
}

// ─── Slide-Over Drawer: Ficha Funcional do Servidor ─────────────────────────
function FichaServidorDrawer({ matricula, onClose }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTexto, setCopiadoTexto] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    fetchServidorDetalhe(matricula)
      .then(setDados)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [matricula]);

  const copiarMatricula = () => {
    navigator.clipboard.writeText(String(matricula));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const copiarResumo = () => {
    if (!dados) return;
    const resumo = `👤 Ficha Funcional — Matrícula #${dados.Matricula}
• Nome: ${dados.Nome_Funcionario || 'N/A'}
• Cargo: ${dados.Des_Cargo || 'N/A'}
• Secretaria: ${dados.Des_Secretaria || dados.SiglaSec || 'N/A'}
• Lotação: ${dados.Des_LocalTrab || 'N/A'}
• Regime: ${dados.Des_RegTrab || 'N/A'} (Padrão: ${dados.Des_Padrao_Adm || 'N/A'})
• Admissão: ${fmtData(dados.DtAdmissao)}`;
    navigator.clipboard.writeText(resumo);
    setCopiadoTexto(true);
    setTimeout(() => setCopiadoTexto(false), 2200);
  };

  const tempoServico = dados
    ? calcularTempoServicoExtenso(dados.DtAdmissao) || dados.Tempo_Contrato_Extenso
    : null;
  const corSec = dados ? COR_SEC[dados.SiglaSec] || '#64748b' : '#64748b';
  const avatarStyle = dados ? getAvatarColor(dados.Nome_Funcionario) : { bg: '#eee', text: '#333' };

  return (
    <>
      <motion.div
        className="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={onClose}
      />
      <motion.aside
        className="drawer-panel"
        style={{ width: 'min(560px, 100vw)' }}
        initial={{ transform: 'translateX(100%)' }}
        animate={{ transform: 'translateX(0%)' }}
        exit={{ transform: 'translateX(100%)' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
        aria-label="Ficha do Servidor"
      >
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              className="hr-avatar"
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                fontSize: 15,
                background: avatarStyle.bg,
                color: avatarStyle.text,
              }}
            >
              {dados ? getInitials(dados.Nome_Funcionario) : '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {dados?.Nome_Funcionario || 'Carregando servidor...'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="hr-matricula-pill">
                  Mat. {matricula}
                  <button onClick={copiarMatricula} className="ticket-copy-btn" title="Copiar matrícula">
                    {copiado ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                </span>
                {dados?.SiglaSec && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: `${corSec}18`,
                      color: corSec,
                    }}
                  >
                    {dados.SiglaSec}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="drawer-close-btn" title="Fechar (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {loading && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted-c)', fontSize: 13 }}>
              Carregando dados funcionais...
            </div>
          )}

          {erro && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#dc2626',
                fontSize: 12.5,
              }}
            >
              {erro}
            </div>
          )}

          {dados && (
            <>
              {/* Lotação e Alocação */}
              <div>
                <div className="drawer-section-title">
                  <Building2 size={13} /> Lotação e Posto de Trabalho
                </div>
                <div className="drawer-key-val-grid">
                  <div className="drawer-key-val-card" style={{ gridColumn: 'span 2' }}>
                    <div className="drawer-key">Secretaria Municipal</div>
                    <div className="drawer-val" style={{ fontSize: 13 }}>
                      {dados.Des_Secretaria || '—'}
                    </div>
                  </div>

                  <div className="drawer-key-val-card" style={{ gridColumn: 'span 2' }}>
                    <div className="drawer-key">Local de Trabalho Oficial</div>
                    <div className="drawer-val" style={{ fontSize: 13 }}>
                      {dados.Des_LocalTrab || '—'}
                    </div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Centro de Custeio</div>
                    <div className="drawer-val">{dados.Des_Custeio || '—'}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Cód. Custeio</div>
                    <div className="drawer-val" style={{ fontFamily: 'monospace', color: '#0D7C3D' }}>
                      {dados.CdCusteio || '—'}
                    </div>
                  </div>

                  <div className="drawer-key-val-card" style={{ gridColumn: 'span 2' }}>
                    <div className="drawer-key">Escala / Horário Cadastrado</div>
                    <div className="drawer-val">{dados.Des_Horario || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Vínculo & Vida Funcional */}
              <div>
                <div className="drawer-section-title">
                  <Briefcase size={13} /> Contrato e Vida Funcional
                </div>
                <div className="drawer-key-val-grid">
                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Cargo / Função</div>
                    <div className="drawer-val">{dados.Des_Cargo || '—'}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Regime de Trabalho</div>
                    <div className="drawer-val">
                      <span
                        className={`hr-regime-badge ${
                          dados.Des_RegTrab?.toUpperCase().includes('ESTAT')
                            ? 'hr-regime-efetivo'
                            : dados.Des_RegTrab?.toUpperCase().includes('COMIS')
                            ? 'hr-regime-comissionado'
                            : ''
                        }`}
                      >
                        {dados.Des_RegTrab || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Padrão Administrativo</div>
                    <div className="drawer-val">{dados.Des_Padrao_Adm || '—'}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Jornada Semanal</div>
                    <div className="drawer-val">{dados.HrSem ? `${dados.HrSem}h semanais` : '—'}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Data de Nomeação</div>
                    <div className="drawer-val">{fmtData(dados.DtNomeacao)}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Data de Posse</div>
                    <div className="drawer-val">{fmtData(dados.DtPosse)}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Admissão Oficial</div>
                    <div className="drawer-val">{fmtData(dados.DtAdmissao)}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Início do Exercício</div>
                    <div className="drawer-val">{fmtData(dados.DtIniExerc)}</div>
                  </div>
                </div>
              </div>

              {/* Tempo de Serviço Dedicado */}
              {tempoServico && (
                <div
                  style={{
                    background: 'rgba(13, 124, 61, 0.06)',
                    border: '1px solid rgba(13, 124, 61, 0.2)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} className="text-emerald-600" />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-c)' }}>
                        Tempo de Serviço na Prefeitura
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D7C3D' }}>
                        {tempoServico}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dados Pessoais & Escolaridade */}
              <div>
                <div className="drawer-section-title">
                  <User size={13} /> Dados Pessoais & Qualificação
                </div>
                <div className="drawer-key-val-grid">
                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Gênero / Sexo</div>
                    <div className="drawer-val">{dados.Sexo || '—'}</div>
                  </div>

                  <div className="drawer-key-val-card">
                    <div className="drawer-key">Idade</div>
                    <div className="drawer-val">{dados.Idade ? `${dados.Idade} anos` : '—'}</div>
                  </div>

                  <div className="drawer-key-val-card" style={{ gridColumn: 'span 2' }}>
                    <div className="drawer-key">Grau de Instrução / Escolaridade</div>
                    <div className="drawer-val">{dados.Des_GrInstrucao || 'Não informado'}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button onClick={copiarResumo} className="pagination-btn" style={{ padding: '8px 14px' }}>
            {copiadoTexto ? (
              <>
                <Check size={14} className="text-emerald-500" /> Resumo Copiado!
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar Resumo
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="pagination-btn"
            style={{ padding: '8px 16px', background: 'var(--surface)', fontWeight: 600 }}
          >
            Fechar
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── Componente Principal ───────────────────────────────────────────────────
export default function DiretorioServidores() {
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroSec, setFiltroSec] = useState('');
  const [filtroReg, setFiltroReg] = useState('');
  const [filtroPad, setFiltroPad] = useState('');

  const [opcoes, setOpcoes] = useState({ secretarias: [], regimes: [], padroes: [] });
  const [selectedMatricula, setSelectedMatricula] = useState(null);

  const buscaTimer = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchOpcoesServidores().then(setOpcoes).catch(() => {});
  }, []);

  const carregar = useCallback(
    (p = 0) => {
      setLoading(true);
      setErro(null);
      fetchServidoresPaginado(
        { busca, secretaria: filtroSec, regime: filtroReg, padrao: filtroPad },
        p,
        PER_PAGE
      )
        .then(({ data, count }) => {
          setLista(data);
          setTotal(count);
          setPage(p);
        })
        .catch((e) => setErro(e.message))
        .finally(() => setLoading(false));
    },
    [busca, filtroSec, filtroReg, filtroPad]
  );

  useEffect(() => {
    clearTimeout(buscaTimer.current);
    buscaTimer.current = setTimeout(() => carregar(0), 280);
    return () => clearTimeout(buscaTimer.current);
  }, [carregar]);

  // Tecla de atalho /
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function exportar() {
    fetchServidoresPaginado(
      { busca, secretaria: filtroSec, regime: filtroReg, padrao: filtroPad },
      0,
      9999
    )
      .then(({ data }) => {
        baixarCSV(
          'servidores_osasco.csv',
          ['Matrícula', 'Nome', 'Cargo', 'Secretaria', 'Local de Trabalho', 'Regime', 'Padrão Adm.', 'Admissão'],
          data.map((r) => [
            r.Matricula,
            r.Nome_Funcionario,
            r.Des_Cargo,
            r.Des_Secretaria,
            r.Des_LocalTrab,
            r.Des_RegTrab,
            r.Des_Padrao_Adm,
            fmtData(r.DtAdmissao),
          ])
        );
      })
      .catch((e) => alert(e.message));
  }

  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  const temFiltro = busca || filtroSec || filtroReg || filtroPad;

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <h1>Diretório Geral de Servidores</h1>
          <p>Consulta cadastral e funcional do quadro de pessoal da Prefeitura de Osasco</p>
        </div>
        <div className="topbar-right">
          <button
            onClick={exportar}
            className="pagination-btn"
            style={{ padding: '7px 12px', fontSize: 12 }}
            title="Exportar planilha de servidores"
          >
            <Download size={13} /> Exportar CSV
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Metric Strip (Resumo Executivo do Quadro) */}
        <div className="hr-metric-strip">
          <div className="hr-metric-card">
            <div className="hr-metric-top">
              <span className="hr-metric-title">
                <Users size={13} /> Total no Diretório
              </span>
              <span className="hr-metric-badge" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--muted-c)' }}>
                Base Ativa
              </span>
            </div>
            <div className="hr-metric-number">{total.toLocaleString('pt-BR')}</div>
            <div className="hr-metric-footnote">Servidores registrados</div>
          </div>

          <div className="hr-metric-card">
            <div className="hr-metric-top">
              <span className="hr-metric-title">
                <Building2 size={13} /> Secretarias Mapeadas
              </span>
              <span className="hr-metric-badge" style={{ background: 'rgba(13,124,61,0.1)', color: '#0D7C3D' }}>
                Órgãos
              </span>
            </div>
            <div className="hr-metric-number">{opcoes.secretarias.length}</div>
            <div className="hr-metric-footnote">Lotações e unidades gestoras</div>
          </div>

          <div className="hr-metric-card">
            <div className="hr-metric-top">
              <span className="hr-metric-title">
                <Shield size={13} /> Regimes Funcionais
              </span>
              <span className="hr-metric-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
                Vínculos
              </span>
            </div>
            <div className="hr-metric-number">{opcoes.regimes.length}</div>
            <div className="hr-metric-footnote">Estatutários, CLT e comissionados</div>
          </div>
        </div>

        {/* Toolbar de Busca e Filtros */}
        <div className="hr-toolbar">
          <div className="hr-toolbar-row">
            <div className="hr-search-box">
              <Search size={14} className="hr-search-icon" />
              <input
                ref={searchInputRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, cargo ou matrícula... (pressione /)"
                className="hr-search-input"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="chamados-search-clear"
                  title="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={filtroSec}
                onChange={(e) => setFiltroSec(e.target.value)}
                className={`hr-filter-select ${filtroSec ? 'active-filter' : ''}`}
              >
                <option value="">Todas as Secretarias</option>
                {opcoes.secretarias.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filtroReg}
                onChange={(e) => setFiltroReg(e.target.value)}
                className={`hr-filter-select ${filtroReg ? 'active-filter' : ''}`}
              >
                <option value="">Todos os Regimes</option>
                {opcoes.regimes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                value={filtroPad}
                onChange={(e) => setFiltroPad(e.target.value)}
                className={`hr-filter-select ${filtroPad ? 'active-filter' : ''}`}
              >
                <option value="">Todos os Padrões</option>
                {opcoes.padroes.map((p) => (
                  <option key={p} value={p}>
                    Padrão: {p}
                  </option>
                ))}
              </select>

              {temFiltro && (
                <button
                  onClick={() => {
                    setBusca('');
                    setFiltroSec('');
                    setFiltroReg('');
                    setFiltroPad('');
                  }}
                  className="chamados-reset-btn"
                >
                  <X size={12} /> Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {erro && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {erro}
          </div>
        )}

        {/* Tabela de Servidores */}
        <div className="hr-table-container">
          <div style={{ overflowX: 'auto' }}>
            <table className="hr-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Matrícula</th>
                  <th>Servidor</th>
                  <th style={{ width: '220px' }}>Cargo / Função</th>
                  <th style={{ width: '180px' }}>Lotação</th>
                  <th style={{ width: '130px' }}>Regime</th>
                  <th style={{ width: '90px' }}>Padrão</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Admissão</th>
                </tr>
              </thead>
              <tbody>
                {!loading && lista.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="chamados-empty-state">
                        <div className="chamados-empty-icon">
                          <Users size={22} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                          Nenhum servidor encontrado
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>
                          {total === 0 && !temFiltro
                            ? 'Nenhum servidor cadastrado na base.'
                            : 'Nenhum resultado corresponde aos filtros informados.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {lista.map((r) => {
                  const avatar = getAvatarColor(r.Nome_Funcionario);
                  const isEfetivo = r.Des_RegTrab?.toUpperCase().includes('ESTAT');
                  const isComiss = r.Des_RegTrab?.toUpperCase().includes('COMIS');
                  const isSelected = selectedMatricula === r.Matricula;

                  return (
                    <tr
                      key={r.Matricula}
                      onClick={() => setSelectedMatricula(r.Matricula)}
                      className={`hr-table-row ${isSelected ? 'row-selected' : ''}`}
                    >
                      <td>
                        <span className="hr-matricula-pill">#{r.Matricula}</span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="hr-avatar"
                            style={{ background: avatar.bg, color: avatar.text }}
                          >
                            {getInitials(r.Nome_Funcionario)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text)',
                                fontSize: 12.5,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 260,
                              }}
                            >
                              {r.Nome_Funcionario || '—'}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--sub)' }}>
                              {r.Des_LocalTrab || 'Lotação não informada'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                          {r.Des_Cargo || '—'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: 11.5, color: 'var(--muted-c)' }}>
                          {r.SiglaSec || r.Des_Secretaria || '—'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`hr-regime-badge ${
                            isEfetivo ? 'hr-regime-efetivo' : isComiss ? 'hr-regime-comissionado' : ''
                          }`}
                        >
                          {r.Des_RegTrab || '—'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: 11, color: 'var(--muted-c)', fontVariantNumeric: 'tabular-nums' }}>
                          {r.Des_Padrao_Adm || '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--muted-c)' }}>
                        {fmtData(r.DtAdmissao)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="chamados-pagination-bar">
              <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>
                Exibindo {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} de{' '}
                {total.toLocaleString('pt-BR')} servidores
              </span>

              <div className="pagination-controls">
                <button
                  onClick={() => carregar(0)}
                  disabled={page === 0}
                  className="pagination-btn"
                  title="Primeira página"
                >
                  <ChevronsLeft size={13} />
                </button>

                <button
                  onClick={() => carregar(page - 1)}
                  disabled={page === 0}
                  className="pagination-btn"
                  title="Página anterior"
                >
                  <ChevronLeft size={13} />
                </button>

                <span style={{ padding: '0 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  Página {page + 1} de {totalPages}
                </span>

                <button
                  onClick={() => carregar(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="pagination-btn"
                  title="Próxima página"
                >
                  <ChevronRight size={13} />
                </button>

                <button
                  onClick={() => carregar(totalPages - 1)}
                  disabled={page >= totalPages - 1}
                  className="pagination-btn"
                  title="Última página"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-Over Drawer: Ficha Funcional do Servidor */}
      <AnimatePresence>
        {selectedMatricula !== null && (
          <FichaServidorDrawer
            matricula={selectedMatricula}
            onClose={() => setSelectedMatricula(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
