import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  CheckCircle, XCircle, FileSpreadsheet, AlertTriangle, Info,
  ChevronRight, Table, Trash2, Calendar, Users, RefreshCw,
} from 'lucide-react';
import { lerArquivoXLS, analisarArquivo, processarLinhas, processarLinhasMovimento } from '@/modules/folha/utils/processarXLS';
import { VERBAS, IDENTIFICADORES, normalizarNome } from '@/modules/folha/utils/colunas';
import {
  upsertFolha, verificarCompetenciaExistente,
  listarFolhasImportadas, deletarFolha,
} from '@/modules/folha/services/folhaService';
import { MESES, competenciaParaDate, fmtCompetencia } from '@/modules/folha/constants';
import { useAuth } from '@/contexts/AuthContext';

const ANOS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

const LS_KEY = 'folha:mapeamentos_custom';

function carregarMapeamentosCustom() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function salvarMapeamentosCustom(map) {
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

// ─── Helpers de label ────────────────────────────────────────────────────────

const ID_LABELS = {
  matricula: 'Matrícula', nome: 'Nome', cargo: 'Cargo',
  subunidade: 'Secretaria / Subunidade', local: 'Unidade / Local',
};
const VERBA_LABELS = {
  atraso: 'Atraso (VB335)', dsr: 'DSR (VB504)',
  adicional_noturno: 'Adicional Noturno (VB24)', hora_extra_50: 'Hora Extra 50% (VB4)',
  falta: 'Falta (VB171)', hora_extra_100: 'Hora Extra 100% (VB5)',
};
const FORMATO_LABELS = {
  VB:        'Formato VB (códigos de verba)',
  extenso:   'Formato por extenso',
  misto:     'Formato misto (VB + extenso)',
  sem_verbas:'Sem verbas reconhecidas',
  movimento: 'Movimento de Variáveis (Lançamento)',
};

const ID_LABELS_EXTRA = {
  verba_mov:      'Verba (código)',
  quantidade_mov: 'Quantidade',
  local_trabalho: 'Local de Trabalho',
};

function defLabel(def) {
  if (!def) return '—';
  if (def.tipo === 'id')    return ID_LABELS[def.id] || ID_LABELS_EXTRA[def.id] || def.id;
  if (def.tipo === 'verba') return VERBA_LABELS[def.id] || def.id;
  return '—';
}

// Converte valor do <select> manual ↔ objeto de definição de campo
function selectParaDef(str) {
  if (!str || str === '') return '';
  if (str === 'ignorar') return 'ignorar';
  const [tipo, id, vb] = str.split(':');
  if (tipo === 'id')    return { tipo: 'id', id };
  if (tipo === 'verba') return { tipo: 'verba', id, vb };
  return '';
}
function defParaSelect(val) {
  if (!val || val === '') return '';
  if (val === 'ignorar') return 'ignorar';
  if (val.tipo === 'id')    return `id:${val.id}`;
  if (val.tipo === 'verba') return `verba:${val.id}:${val.vb}`;
  return '';
}

// ─── ModalPrevia ─────────────────────────────────────────────────────────────

function ModalPrevia({ arquivo, analise, onConfirm, onCancel }) {
  const [mapeamentosTemp, setMapeamentosTemp] = useState({});

  const { headerIdx, mapeamento, naoReconhecidas, formato, linhasDados, erros } = analise;

  const verbasDetectadas = VERBAS.filter(b =>
    Object.values(mapeamento).some(v => v.tipo === 'verba' && v.id === b.id)
  );
  const verbasAusentes = VERBAS.filter(b =>
    !Object.values(mapeamento).some(v => v.tipo === 'verba' && v.id === b.id)
  );

  function aoMudar(normNome, valor) {
    setMapeamentosTemp(prev => ({ ...prev, [normNome]: selectParaDef(valor) }));
  }

  function confirmar() {
    // Persiste os mapeamentos manuais para reuso automático
    const saved = carregarMapeamentosCustom();
    for (const [normNome, val] of Object.entries(mapeamentosTemp)) {
      if (val) saved[normNome] = val;
      else delete saved[normNome];
    }
    salvarMapeamentosCustom(saved);
    onConfirm();
  }

  const tdS = { fontSize: 11, padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle' };

  return (
    <div className="modal-overlay show" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div
        className="chamado-modal"
        style={{ maxWidth: 580, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">
            <Table size={15} style={{ display: 'inline', marginRight: 7 }} />
            Prévia do Arquivo
          </div>
          <button className="chamado-modal-close" onClick={onCancel}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 2px 4px' }}>
          {/* Arquivo */}
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 7, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', fontSize: 12, color: '#93c5fd' }}>
            <strong>Arquivo:</strong> {arquivo?.name}
          </div>

          {/* KPIs do layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Formato',    value: FORMATO_LABELS[formato] || formato },
              { label: 'Cabeçalho', value: `Linha ${headerIdx + 1}` },
              { label: 'Dados',     value: `${linhasDados.toLocaleString('pt-BR')} linhas` },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Erros de validação */}
          {erros.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {erros.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px', marginBottom: 6, borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>
                  <XCircle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#f87171' }}>{e}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mapeamento de colunas */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 8 }}>
              Colunas mapeadas ({Object.keys(mapeamento).length})
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                    <th style={{ ...tdS, color: '#64748b', textAlign: 'left', fontWeight: 600 }}>Coluna no arquivo</th>
                    <th style={{ ...tdS, color: '#64748b', textAlign: 'left', fontWeight: 600 }}>Campo canônico</th>
                    <th style={{ ...tdS, color: '#64748b', textAlign: 'center', fontWeight: 600 }}>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(mapeamento).map(([colIdx, def]) => (
                    <tr key={colIdx}>
                      <td style={{ ...tdS, fontFamily: 'monospace', color: '#94a3b8' }}>{def.nomeOriginal}</td>
                      <td style={{ ...tdS, color: '#e2e8f0', fontWeight: 500 }}>{defLabel(def)}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        {def.tipo === 'id'
                          ? <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,.14)', color: '#a5b4fc' }}>Identif.</span>
                          : <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,.12)', color: '#34d399' }}>Verba</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verbas detectadas / ausentes */}
          {formato === 'movimento' ? (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.18)', fontSize: 12, color: '#a5b4fc' }}>
              <strong>Verbas por código numérico:</strong> 171 = Falta · 335 = Atraso · 504 = DSR · 4 = HE 50% · 5 = HE 100% · 24 = Ad. Noturno.
              As verbas ausentes de cada servidor entram como zero automaticamente.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 6 }}>
                  Verbas detectadas ({verbasDetectadas.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {verbasDetectadas.length === 0
                    ? <span style={{ fontSize: 11, color: '#475569' }}>Nenhuma</span>
                    : verbasDetectadas.map(b => (
                      <span key={b.id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(16,185,129,.12)', color: '#34d399', fontWeight: 600 }}>
                        {b.label}
                      </span>
                    ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 6 }}>
                  Verbas ausentes → 0
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {verbasAusentes.length === 0
                    ? <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                    : verbasAusentes.map(b => (
                      <span key={b.id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(100,116,139,.12)', color: '#64748b' }}>
                        {b.label}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Colunas não reconhecidas */}
          {naoReconhecidas.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 8 }}>
                Colunas não reconhecidas ({naoReconhecidas.length}) — serão ignoradas
              </div>
              {naoReconhecidas.map(({ colIdx, nome }) => {
                const normNome = normalizarNome(nome);
                const val = mapeamentosTemp[normNome] ?? '';
                return (
                  <div key={colIdx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.14)' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#fbbf24', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                    <select
                      value={defParaSelect(val)}
                      onChange={e => aoMudar(normNome, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 11, minWidth: 180 }}
                    >
                      <option value="">— Ignorar —</option>
                      <option disabled>── Identificação ──</option>
                      {IDENTIFICADORES.map(d => (
                        <option key={d.id} value={`id:${d.id}`}>{ID_LABELS[d.id] || d.id}</option>
                      ))}
                      <option disabled>── Verbas ──</option>
                      {VERBAS.map(d => (
                        <option key={d.id} value={`verba:${d.id}:${d.vb}`}>{VERBA_LABELS[d.id] || d.id}</option>
                      ))}
                      <option value="ignorar">Marcar como ignorar (salvo)</option>
                    </select>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4, marginBottom: 12 }}>
                Os mapeamentos definidos aqui serão lembrados automaticamente nas próximas importações.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 14, display: 'flex', gap: 10 }}>
          <button
            onClick={confirmar}
            disabled={erros.length > 0}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
              background: erros.length > 0 ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: erros.length > 0 ? '#374151' : '#fff',
              cursor: erros.length > 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Continuar <ChevronRight size={14} />
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '10px 18px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ModalConfirmarExclusao ───────────────────────────────────────────────────

function ModalConfirmarExclusao({ competencia, total, deletando, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay show" onClick={e => e.target === e.currentTarget && !deletando && onCancel()}>
      <div className="chamado-modal" style={{ maxWidth: 420 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title" style={{ color: '#f87171' }}>
            <Trash2 size={14} style={{ display: 'inline', marginRight: 7 }} />
            Excluir folha importada
          </div>
          <button className="chamado-modal-close" onClick={onCancel} disabled={deletando}>×</button>
        </div>

        <div style={{ padding: '8px 0 20px' }}>
          <div style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 600, marginBottom: 8 }}>
            Excluir folha de {fmtCompetencia(competencia)}?
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            Todos os <strong style={{ color: '#fbbf24' }}>{total?.toLocaleString('pt-BR')} servidores</strong> desta
            competência serão removidos permanentemente. Esta ação não pode ser desfeita.
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 12, color: '#f87171' }}>
            Para recarregar esta competência, faça uma nova importação do arquivo XLS/XLSX.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={deletando}
            style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: deletando ? 'not-allowed' : 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deletando}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
              background: deletando ? 'rgba(239,68,68,.3)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
              color: '#fff', cursor: deletando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {deletando ? (
              <>
                <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Excluindo...
              </>
            ) : (
              <><Trash2 size={13} /> Excluir folha</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ModalCompetencia ─────────────────────────────────────────────────────────

function ModalCompetencia({ arquivo, onConfirm, onCancel }) {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const [mes, setMes] = useState(mesAtual);
  const [ano, setAno] = useState(anoAtual);
  const [existentes, setExistentes] = useState(null);
  const [verificando, setVerificando] = useState(false);

  const competencia = competenciaParaDate(mes, ano);

  useEffect(() => {
    setExistentes(null);
    setVerificando(true);
    verificarCompetenciaExistente(competencia)
      .then(count => setExistentes(count))
      .catch(() => setExistentes(0))
      .finally(() => setVerificando(false));
  }, [competencia]);

  return (
    <div className="modal-overlay show" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="chamado-modal" style={{ maxWidth: 460 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Competência da Folha</div>
          <button className="chamado-modal-close" onClick={onCancel}>×</button>
        </div>

        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', fontSize: 12, color: '#93c5fd' }}>
          <strong>Arquivo:</strong> {arquivo?.name}
        </div>

        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
          Informe a competência (mês/ano) referente a esta folha de pagamento.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Mês</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 13 }}
            >
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ano</label>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 13 }}
            >
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {!verificando && existentes > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>Competência já importada</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {MESES[mes - 1]}/{ano} já possui {existentes.toLocaleString('pt-BR')} servidores.
                Confirmar irá <strong style={{ color: '#fbbf24' }}>substituir</strong> todos os dados.
              </div>
            </div>
          </div>
        )}

        {verificando && (
          <div style={{ marginBottom: 16, fontSize: 11, color: '#64748b', padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,.03)' }}>
            Verificando dados existentes...
          </div>
        )}

        <button
          onClick={() => onConfirm(competencia)}
          style={{
            width: '100%', padding: '11px', borderRadius: 8,
            background: existentes > 0 ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          {existentes > 0 ? `Substituir Folha — ${MESES[mes - 1]}/${ano}` : `Processar Folha — ${MESES[mes - 1]}/${ano}`}
        </button>
      </div>
    </div>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, label }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#3b82f6,#6366f1)', width: `${pct}%`, transition: 'width .3s ease' }} />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ImportarFolha() {
  const { sessao } = useAuth();
  const token = sessao?.token;
  const [arquivo,       setArquivo]      = useState(null);
  const [fase,          setFase]         = useState('idle');
  const [previewAberto, setPreviewAberto] = useState(false);
  const [modalAberto,   setModalAberto]  = useState(false);
  const [analise,       setAnalise]      = useState(null);
  const [progresso,     setProgresso]    = useState(0);
  const [etapa,         setEtapa]        = useState('');
  const [resultado,     setResultado]    = useState(null);
  const [erro,          setErro]         = useState(null);
  const [errosLayout,   setErrosLayout]  = useState([]);
  const [dragOver,      setDragOver]     = useState(false);

  // Painel de folhas importadas
  const [folhasImportadas,  setFolhasImportadas]  = useState([]);
  const [carregandoFolhas,  setCarregandoFolhas]  = useState(true);
  const [confirmarDelete,   setConfirmarDelete]   = useState(null); // { competencia, total }
  const [deletando,         setDeletando]         = useState(false);

  const inputRef = useRef(null);
  const rowsRef  = useRef(null);

  const carregarFolhas = useCallback(async () => {
    setCarregandoFolhas(true);
    try {
      const lista = await listarFolhasImportadas();
      setFolhasImportadas(lista);
    } catch (e) {
      console.error('Erro ao listar folhas:', e);
    } finally {
      setCarregandoFolhas(false);
    }
  }, []);

  useEffect(() => { carregarFolhas(); }, [carregarFolhas]);

  const excluirFolha = useCallback(async () => {
    if (!confirmarDelete) return;
    setDeletando(true);
    try {
      await deletarFolha(confirmarDelete.competencia, token);
      setConfirmarDelete(null);
      await carregarFolhas();
    } catch (e) {
      console.error('Erro ao excluir folha:', e);
    } finally {
      setDeletando(false);
    }
  }, [confirmarDelete, carregarFolhas]);

  const selecionarArquivo = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(ext)) {
      setErro('Apenas arquivos .xls e .xlsx são aceitos.');
      return;
    }

    setErro(null);
    setErrosLayout([]);
    setArquivo(file);
    setFase('analisando');

    try {
      const rows = await lerArquivoXLS(file);
      rowsRef.current = rows;
      const mapeamentosCustom = carregarMapeamentosCustom();
      const a = analisarArquivo(rows, mapeamentosCustom);

      if (!a.ok) {
        setErrosLayout(a.erros);
        setFase('erro_layout');
        return;
      }

      setAnalise(a);
      setFase('idle'); // página fica em idle; modal de prévia aparece por cima
      setPreviewAberto(true);
    } catch (e) {
      setErro(e.message || 'Erro ao ler o arquivo.');
      setFase('erro');
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    selecionarArquivo(e.dataTransfer.files[0]);
  }, [selecionarArquivo]);

  // Chamado após confirmar a prévia
  const confirmarPrevia = useCallback(() => {
    setPreviewAberto(false);
    setModalAberto(true);
  }, []);

  // Chamado após escolher a competência
  const processar = useCallback(async (competencia) => {
    setModalAberto(false);
    setFase('processando');
    setProgresso(0);
    setErro(null);

    try {
      setEtapa('Validando mapeamento de colunas...');
      setProgresso(5);

      // Re-analisa com custom mappings atualizados (podem ter sido salvos na prévia)
      const rows = rowsRef.current;
      const mapeamentosCustom = carregarMapeamentosCustom();
      const analiseFinal = analisarArquivo(rows, mapeamentosCustom);

      if (!analiseFinal.ok) {
        setErrosLayout(analiseFinal.erros);
        setFase('erro_layout');
        return;
      }

      setEtapa('Processando linhas...');
      setProgresso(20);
      const { registros, ignorados, ambiguos } = analiseFinal.formato === 'movimento'
        ? processarLinhasMovimento(rows, competencia, analiseFinal)
        : processarLinhas(rows, competencia, analiseFinal);

      if (registros.length === 0) {
        throw new Error('Nenhum registro válido encontrado no arquivo.');
      }

      setEtapa(`Enviando ${registros.length} registros ao banco...`);
      const { processados } = await upsertFolha(registros, token, (pct) => {
        setProgresso(20 + Math.round(pct * 0.78));
      });

      setProgresso(100);
      setFase('concluido');
      setResultado({ competencia, total: processados, ignorados, ambiguos, arquivo: arquivo.name });
      carregarFolhas();
    } catch (e) {
      console.error(e);
      setErro(e.message || 'Erro ao processar o arquivo.');
      setFase('erro');
    }
  }, [arquivo, carregarFolhas]);

  const reiniciar = () => {
    setArquivo(null);
    setFase('idle');
    setProgresso(0);
    setResultado(null);
    setErro(null);
    setErrosLayout([]);
    setAnalise(null);
    setPreviewAberto(false);
    setModalAberto(false);
    rowsRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Importar Folha de Pagamento</h1>
          <p>Upload do arquivo XLS/XLSX para processar verbas de desconto</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content" style={{ maxWidth: 720 }}>
        {/* ── Analisando ── */}
        {fase === 'analisando' && (
          <div className="chart-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,.3)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: '#60a5fa', fontSize: 14 }}>Lendo e analisando o arquivo...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Upload (idle) ── */}
        {(fase === 'idle' || fase === 'erro') && (
          <>
            <div className="chart-card">
              <div className="chart-header" style={{ marginBottom: 20 }}>
                <div>
                  <div className="chart-title">Arquivo da Folha</div>
                  <div className="chart-sub">Formatos aceitos: .xls (legado) e .xlsx</div>
                </div>
              </div>

              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'rgba(99,102,241,.6)' : 'rgba(255,255,255,.1)'}`,
                  borderRadius: 10, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(99,102,241,.05)' : 'transparent', transition: 'all .2s',
                }}
              >
                <FileSpreadsheet size={40} color="#60a5fa" style={{ margin: '0 auto 16px', display: 'block', opacity: .7 }} />
                <div style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 600, marginBottom: 6 }}>
                  Arraste o arquivo .XLS / .XLSX ou clique para selecionar
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Arquivo gerado pelo sistema de folha de pagamento
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  style={{ display: 'none' }}
                  onChange={e => selecionarArquivo(e.target.files[0])}
                />
              </div>

              {(erro || fase === 'erro') && (
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <XCircle size={16} /> {erro}
                </div>
              )}
            </div>

            {/* Painel de folhas importadas */}
            <div className="chart-card" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div className="chart-title">Folhas importadas</div>
                  <div className="chart-sub">Competências disponíveis no banco de dados</div>
                </div>
                <button
                  onClick={carregarFolhas}
                  disabled={carregandoFolhas}
                  title="Atualizar lista"
                  style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', cursor: carregandoFolhas ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                >
                  <RefreshCw size={13} style={{ animation: carregandoFolhas ? 'spin 1s linear infinite' : 'none' }} />
                  Atualizar
                </button>
              </div>

              {carregandoFolhas ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: 13 }}>
                  <div style={{ width: 28, height: 28, border: '2px solid rgba(59,130,246,.3)', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                  Carregando...
                </div>
              ) : folhasImportadas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: 13 }}>
                  Nenhuma folha importada ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {folhasImportadas.map(({ competencia, total }) => (
                    <div
                      key={competencia}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
                      }}
                    >
                      <Calendar size={15} color="#60a5fa" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>
                        {fmtCompetencia(competencia)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
                        <Users size={12} />
                        {total.toLocaleString('pt-BR')} servidores
                      </div>
                      <button
                        onClick={() => setConfirmarDelete({ competencia, total })}
                        title={`Excluir folha de ${fmtCompetencia(competencia)}`}
                        style={{
                          padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.25)',
                          background: 'rgba(239,68,68,.08)', color: '#f87171',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                        }}
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instruções dos formatos */}
            <div className="chart-card" style={{ marginTop: 16 }}>
              <div className="chart-title" style={{ marginBottom: 14 }}>Formatos suportados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {[
                  {
                    titulo: 'Formato VB (códigos)',
                    ext: '.xls',
                    cor: '#6366f1',
                    itens: ['MATRICULA', 'nomecompleto', 'descargo_completa', 'descsubunidade', 'deslocal', 'VB335', 'VB504', 'VB24', 'VB4', 'VB171', 'VB5'],
                    obs: 'Cabeçalho pode estar após um banner de título — detectado automaticamente.',
                  },
                  {
                    titulo: 'Formato por extenso',
                    ext: '.xlsx',
                    cor: '#3b82f6',
                    itens: ['MATRICULA', 'nomecompleto', 'descargo_completa', 'descsubunidade', 'deslocal', 'ATRASO/SAIDA MES ANTERIOR', 'D.S.R.', 'ADICIONAL NOTURNO', 'FALTAS INJUSTIFICADAS'],
                    obs: 'Verbas ausentes (ex.: HE 50%, HE 100%) entram como 0 automaticamente.',
                  },
                ].map(({ titulo, ext, cor, itens, obs }) => (
                  <div key={titulo} style={{ padding: '12px 14px', borderRadius: 8, background: `${cor}09`, border: `1px solid ${cor}22` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: cor }}>{titulo}</div>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: `${cor}22`, color: cor, fontFamily: 'monospace' }}>{ext}</span>
                    </div>
                    {itens.map(col => (
                      <div key={col} style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>{col}</div>
                    ))}
                    <div style={{ marginTop: 8, fontSize: 10, color: '#475569' }}>{obs}</div>
                  </div>
                ))}
              </div>
              {/* Formato C — Movimento de Variáveis */}
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2dd4bf' }}>Lançamento do Movimento de Variáveis</div>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(20,184,166,.18)', color: '#2dd4bf', fontFamily: 'monospace' }}>.xls</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {['Matrícula', 'Nome Funcionário', 'Verba', 'Descrição Verba', 'Quantidade', 'Descrição Contrato', 'Lotação', 'Descrição Lotação', 'Descrição Local Trabalho'].map(col => (
                    <div key={col} style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>{col}</div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: '#475569' }}>
                  Layout longo: uma linha por verba por servidor. Verbas identificadas por código (171=Falta, 335=Atraso, 504=DSR…).
                  Cabeçalho detectado automaticamente — funciona mesmo com linhas em branco acima.
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Erro de layout ── */}
        {fase === 'erro_layout' && (
          <div className="chart-card">
            <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
              <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px', display: 'block' }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>Layout não reconhecido</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
                O arquivo não possui as colunas mínimas necessárias:
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              {errosLayout.map((e, i) => (
                <div key={i} style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 6, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', fontSize: 12, color: '#fbbf24', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  {e}
                </div>
              ))}
            </div>
            <button onClick={reiniciar} className="btn-primary" style={{ width: '100%' }}>
              Selecionar outro arquivo
            </button>
          </div>
        )}

        {/* ── Processando ── */}
        {fase === 'processando' && (
          <div className="chart-card">
            <div className="chart-title" style={{ marginBottom: 24 }}>Processando arquivo...</div>
            <ProgressBar pct={progresso} label={etapa} />
            <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
              Não feche esta aba durante o processamento.
            </p>
          </div>
        )}

        {/* ── Concluído ── */}
        {fase === 'concluido' && resultado && (
          <div className="chart-card">
            <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
              <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px', display: 'block' }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Importação concluída!</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{resultado.arquivo}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Competência',          value: fmtCompetencia(resultado.competencia), color: '#60a5fa' },
                { label: 'Servidores importados', value: resultado.total.toLocaleString('pt-BR'), color: '#34d399' },
                { label: 'Linhas ignoradas',      value: resultado.ignorados.toLocaleString('pt-BR'), color: '#fbbf24' },
              ].map(({ label, value, color }) => (
                <div key={label} className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label" style={{ justifyContent: 'center', paddingLeft: 0 }}>{label}</div>
                  <div className="kpi-value" style={{ color, fontSize: 26, paddingLeft: 0, textAlign: 'center' }}>{value}</div>
                </div>
              ))}
            </div>

            {resultado.ambiguos > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Info size={15} color="#818cf8" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>
                    {resultado.ambiguos} registro{resultado.ambiguos !== 1 ? 's' : ''} com VB335 ambíguo
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    O valor de VB335 admite mais de uma decomposição. Foi usada a combinação que minimiza atrasos ≥1h.
                  </div>
                </div>
              </div>
            )}

            <button onClick={reiniciar} className="btn-primary" style={{ width: '100%' }}>
              Importar outro arquivo
            </button>
          </div>
        )}
      </div>

      {/* ── Modais ── */}
      {confirmarDelete && (
        <ModalConfirmarExclusao
          competencia={confirmarDelete.competencia}
          total={confirmarDelete.total}
          deletando={deletando}
          onConfirm={excluirFolha}
          onCancel={() => !deletando && setConfirmarDelete(null)}
        />
      )}

      {previewAberto && analise && (
        <ModalPrevia
          arquivo={arquivo}
          analise={analise}
          onConfirm={confirmarPrevia}
          onCancel={() => { setPreviewAberto(false); reiniciar(); }}
        />
      )}

      {modalAberto && (
        <ModalCompetencia
          arquivo={arquivo}
          onConfirm={processar}
          onCancel={() => { setModalAberto(false); reiniciar(); }}
        />
      )}
    </div>
  );
}
