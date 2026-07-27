import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Download, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { baixarCSV } from '@/lib/exportar';
import {
  fetchServidoresPaginado,
  fetchServidorDetalhe,
  fetchOpcoesServidores,
} from '@/modules/servidores/services/servidoresService';

/* ── helpers ── */
const dash = (v) => v || '—';

function fmtData(s) {
  if (!s) return '—';
  // "17/07/1968 00:00" → "17/07/1968"
  return s.split(' ')[0];
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

  if (isNaN(dtInicio.getTime())) return null;
  if (dtInicio > dtFim) return '0 Dia(s)';

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
  if (anos > 0) partes.push(`${anos} Ano(s)`);
  if (meses > 0) partes.push(`${meses} Mese(s)`);
  if (dias > 0 || partes.length === 0) partes.push(`${dias} Dia(s)`);

  if (partes.length === 3) {
    return `${partes[0]}, ${partes[1]} e ${partes[2]}.`;
  } else if (partes.length === 2) {
    return `${partes[0]} e ${partes[1]}.`;
  } else {
    return `${partes[0]}.`;
  }
}

const PER_PAGE = 50;

const SEL_ST = {
  padding: '7px 10px', borderRadius: 8, background: 'var(--card-bg)',
  border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 12,
  outline: 'none', minWidth: 120,
};

/* ── Modal de detalhe ── */
function ModalServidor({ matricula, onClose }) {
  const [dados,   setDados]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchServidorDetalhe(matricula)
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [matricula]);

  function campo(label, valor, mono = false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        <span style={{ fontSize: 13, color: mono ? '#a5b4fc' : '#e2e8f0', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: mono ? 700 : 400 }}>{dash(valor)}</span>
      </div>
    );
  }

  const tempoServicoReal = dados ? (calcularTempoServicoExtenso(dados.DtAdmissao) || dados.Tempo_Contrato_Extenso) : null;

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 600 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Detalhes do Servidor</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>Carregando...</div>}
        {erro    && <div style={{ padding: '16px 24px', color: '#f87171', fontSize: 13 }}>{erro}</div>}

        {dados && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.15)' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={22} color="#818cf8" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{dados.Nome_Funcionario || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace', fontWeight: 700 }}>Mat. {dados.Matricula}</span>
                  {dados.Des_Cargo && <span style={{ fontSize: 11, color: '#64748b' }}>· {dados.Des_Cargo}</span>}
                  {dados.SiglaSec && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.25)' }}>
                      {dados.SiglaSec}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Lotação */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Lotação</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {campo('Secretaria',       dados.Des_Secretaria)}
                {campo('Sigla',            dados.SiglaSec, true)}
                {campo('Custeio',          dados.Des_Custeio)}
                {campo('Cód. Custeio',     dados.CdCusteio, true)}
                {campo('Local de Trabalho', dados.Des_LocalTrab)}
                {campo('Horário',          dados.Des_Horario)}
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.06)' }} />

            {/* Contrato */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Contrato e Vínculo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {campo('Regime',        dados.Des_RegTrab)}
                {campo('Padrão Adm.',   dados.Des_Padrao_Adm)}
                {campo('Cargo',         dados.Des_Cargo)}
                {campo('Contrato',      dados.Des_Contrato)}
                {campo('Cat. SEFIP',    dados.Des_CategSefip)}
                {campo('Hrs/Semana',    dados.HrSem ? `${dados.HrSem}h` : null)}
                 {campo('Nomeação',      fmtData(dados.DtNomeacao))}
                {campo('Posse',         fmtData(dados.DtPosse))}
                {campo('Admissão',      fmtData(dados.DtAdmissao))}
                {campo('Início Exerc.', fmtData(dados.DtIniExerc))}
                {campo('Tempo de serviço', tempoServicoReal)}
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.06)' }} />

            {/* Dados pessoais */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Dados Pessoais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {campo('Sexo',        dados.Sexo)}
                {campo('Idade',       dados.Idade ? `${dados.Idade} anos` : null)}
                {campo('Escolaridade', dados.Des_GrInstrucao)}
              </div>
            </div>

            {/* Tempo de serviço em destaque */}
            {dados.Tempo_Contrato_Anos != null && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,.06)' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)' }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Tempo de serviço</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#a5b4fc', fontVariantNumeric: 'tabular-nums' }}>
                    {tempoServicoReal || `${dados.Tempo_Contrato_Anos} anos`}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export default function DiretorioServidores() {
  const [lista,    setLista]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState(null);

  const [busca,       setBusca]       = useState('');
  const [filtroSec,   setFiltroSec]   = useState('');
  const [filtroReg,   setFiltroReg]   = useState('');
  const [filtroPad,   setFiltroPad]   = useState('');

  const [opcoes,    setOpcoes]    = useState({ secretarias: [], regimes: [], padroes: [] });
  const [selected,  setSelected]  = useState(null);

  const buscaTimer = useRef(null);

  useEffect(() => {
    fetchOpcoesServidores().then(setOpcoes).catch(() => {});
  }, []);

  const carregar = useCallback((p = 0) => {
    setLoading(true);
    setErro(null);
    fetchServidoresPaginado(
      { busca, secretaria: filtroSec, regime: filtroReg, padrao: filtroPad },
      p, PER_PAGE
    )
      .then(({ data, count }) => { setLista(data); setTotal(count); setPage(p); })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [busca, filtroSec, filtroReg, filtroPad]);

  useEffect(() => {
    clearTimeout(buscaTimer.current);
    buscaTimer.current = setTimeout(() => carregar(0), 300);
    return () => clearTimeout(buscaTimer.current);
  }, [carregar]);

  function exportar() {
    fetchServidoresPaginado(
      { busca, secretaria: filtroSec, regime: filtroReg, padrao: filtroPad },
      0, 9999
    ).then(({ data }) => {
      baixarCSV('servidores.csv',
        ['Matrícula','Nome','Cargo','Secretaria','Local de Trabalho','Regime','Padrão Adm.','Admissão'],
        data.map(r => [r.Matricula, r.Nome_Funcionario, r.Des_Cargo, r.Des_Secretaria, r.Des_LocalTrab, r.Des_RegTrab, r.Des_Padrao_Adm, fmtData(r.DtAdmissao)])
      );
    }).catch(e => alert(e.message));
  }

  const totalPages = Math.ceil(total / PER_PAGE);
  const temFiltro  = busca || filtroSec || filtroReg || filtroPad;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Diretório de Servidores</h1>
          <p>Consulta e detalhamento do quadro de pessoal</p>
        </div>
        <div className="topbar-right">
          <button onClick={exportar} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', color: '#34d399', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={13} /> CSV
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filtros */}
        <div className="chart-card" style={{ marginBottom: 16, padding: '14px 18px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={14} color="#475569" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Nome, cargo ou matrícula..."
                style={{ ...SEL_ST, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              />
              {busca && (
                <button onClick={() => setBusca('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            <select value={filtroSec} onChange={e => setFiltroSec(e.target.value)} style={SEL_ST}>
              <option value="">Todas as secretarias</option>
              {opcoes.secretarias.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={filtroReg} onChange={e => setFiltroReg(e.target.value)} style={SEL_ST}>
              <option value="">Todos os regimes</option>
              {opcoes.regimes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={filtroPad} onChange={e => setFiltroPad(e.target.value)} style={SEL_ST}>
              <option value="">Todos os padrões</option>
              {opcoes.padroes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {temFiltro && (
              <button onClick={() => { setBusca(''); setFiltroSec(''); setFiltroReg(''); setFiltroPad(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                <X size={12} /> Limpar
              </button>
            )}

            <span style={{ fontSize: 12, color: '#475569', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {loading ? 'Buscando...' : `${total.toLocaleString('pt-BR')} servidores`}
            </span>
          </div>
        </div>

        {erro && <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>{erro}</div>}

        {/* Tabela */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Matrícula','Nome','Cargo','Secretaria','Local de Trabalho','Regime','Padrão Adm.','Admissão'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap', background: 'rgba(0,0,0,.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && lista.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 14px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
                      {total === 0 && !temFiltro ? 'Nenhum servidor cadastrado.' : 'Nenhum resultado para os filtros aplicados.'}
                    </td>
                  </tr>
                )}
                {lista.map(r => (
                  <tr key={r.Matricula}
                    onClick={() => setSelected(r.Matricula)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#a5b4fc', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.Matricula}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#f1f5f9', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.Nome_Funcionario || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Des_Cargo || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{r.SiglaSec || r.Des_Secretaria || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Des_LocalTrab || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{r.Des_RegTrab || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{r.Des_Padrao_Adm || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{fmtData(r.DtAdmissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ fontSize: 12, color: '#475569' }}>Página {page + 1} de {totalPages} · {total.toLocaleString('pt-BR')} servidores</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => carregar(page - 1)} disabled={page === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: page === 0 ? '#334155' : '#94a3b8', fontSize: 12, cursor: page === 0 ? 'default' : 'pointer' }}>
                  <ChevronLeft size={13} /> Anterior
                </button>
                <button onClick={() => carregar(page + 1)} disabled={page >= totalPages - 1}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: page >= totalPages - 1 ? '#334155' : '#94a3b8', fontSize: 12, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
                  Próxima <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected !== null && <ModalServidor matricula={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
