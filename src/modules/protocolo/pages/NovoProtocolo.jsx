import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus, ArrowLeft, CheckCircle, FileText, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { criarProtocolo, importarProtocolos } from '../services/protocoloService';
import { lerArquivoXLS, processarLinhasPlanilha } from '../utils/processarProtocoloXLS';

const SECRETARIAS = ['Administração', 'Saúde', 'Educação', 'Finanças', 'Obras', 'Outros'];
const TIPOS = [
  'Abono de Faltas - Atestado Médico',
  'Retificação de Batida de Ponto',
  'Solicitação de Acesso Biométrico',
  'Licença Prêmio',
  'Opção por Acúmulo de Cargo',
  'Outros'
];

const inputSt = {
  width: '100%', background: 'rgba(0,0,0,.2)',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 8,
  padding: '10px 14px', color: '#f1f5f9', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

const labelSt = {
  display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
};

export default function NovoProtocolo() {
  const navigate = useNavigate();
  const [aba, setAba] = useState('individual'); // 'individual' ou 'lote'

  // --- Estado para Abertura Individual ---
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [secretaria, setSecretaria] = useState('');
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anexo, setAnexo] = useState('');
  const [prazo, setPrazo] = useState(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [sucessoIndividual, setSucessoIndividual] = useState(null);

  // --- Estado para Importação em Lote ---
  const [fileLote, setFileLote] = useState(null);
  const [protsLote, setProtsLote] = useState([]);
  const [sucessoLote, setSucessoLote] = useState(null); // guardará a quantidade de itens importados

  // --- Estados Compartilhados ---
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Salvar Individual
  async function handleSalvarIndividual(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) { setErro('Informe o nome do requerente.'); return; }
    if (!secretaria) { setErro('Selecione a secretaria correspondente.'); return; }
    if (!tipo) { setErro('Selecione o tipo de solicitação.'); return; }

    setLoading(true);
    try {
      const { data } = await criarProtocolo({
        requerente_nome: nome,
        requerente_matricula: matricula,
        secretaria,
        tipo_solicitacao: tipo,
        descricao,
        documento_anexo: anexo ? `anexo_${Date.now()}_${anexo.split('\\').pop()}` : null,
        prazo_estimado: prazo
      });
      setSucessoIndividual(data);
    } catch (err) {
      setErro(err.message || 'Erro ao abrir protocolo digital');
    } finally {
      setLoading(false);
    }
  }

  // Processar Planilha de Lote
  async function handleFileLoteChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(ext)) {
      setErro('Apenas arquivos .xls e .xlsx são aceitos.');
      setFileLote(null);
      setProtsLote([]);
      return;
    }

    setErro('');
    setFileLote(selectedFile);
    setLoading(true);

    try {
      const rows = await lerArquivoXLS(selectedFile);
      const parsed = processarLinhasPlanilha(rows);
      setProtsLote(parsed);
    } catch (err) {
      console.error(err);
      setErro(err.message || 'Erro ao ler a planilha. Verifique as colunas obrigatórias.');
      setProtsLote([]);
      setFileLote(null);
    } finally {
      setLoading(false);
    }
  }

  // Confirmar Importação em Lote
  async function handleConfirmarLote() {
    if (protsLote.length === 0) return;
    setLoading(true);
    setErro('');
    try {
      const res = await importarProtocolos(protsLote);
      setSucessoLote(res.count);
    } catch (err) {
      setErro(err.message || 'Erro ao importar protocolos da planilha.');
    } finally {
      setLoading(false);
    }
  }

  function reiniciarIndividual() {
    setNome('');
    setMatricula('');
    setSecretaria('');
    setTipo('');
    setDescricao('');
    setAnexo('');
    setSucessoIndividual(null);
    setErro('');
  }

  function reiniciarLote() {
    setFileLote(null);
    setProtsLote([]);
    setSucessoLote(null);
    setErro('');
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/protocolos/painel" style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>
              <ArrowLeft size={18} />
            </Link>
            <h1>Novo Protocolo Digital</h1>
          </div>
          <p>Abertura de nova requisição administrativa (individual ou importação por lote)</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        
        {/* --- TELA DE SUCESSO INDIVIDUAL --- */}
        {sucessoIndividual && (
          <div className="chart-card" style={{ maxWidth: 540, margin: '20px auto', textAlign: 'center', padding: '40px 30px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
            }}>
              <CheckCircle size={32} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>Protocolo Gerado com Sucesso</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
              O requerimento foi registrado no sistema e encaminhado para análise.
            </p>

            <div style={{
              background: 'rgba(99, 102, 241, 0.07)',
              border: '1px solid rgba(99, 102, 241, 0.18)',
              borderRadius: 10, padding: '16px 20px', marginBottom: 30
            }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Código do Protocolo</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#a5b4fc', fontFamily: 'monospace' }}>{sucessoIndividual.numero_protocolo}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#cbd5e1', marginTop: 12, borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 10 }}>
                <span>Requerente:</span>
                <span style={{ fontWeight: 600 }}>{sucessoIndividual.requerente_nome}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#cbd5e1', marginTop: 6 }}>
                <span>Prazo Estimado:</span>
                <span style={{ fontWeight: 600 }}>{new Date(sucessoIndividual.prazo_estimado).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={reiniciarIndividual}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Abrir Outro
              </button>
              <Link to="/protocolos/consulta" style={{ textDecoration: 'none' }}>
                <button
                  style={{
                    padding: '10px 22px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Consultar Lista
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* --- TELA DE SUCESSO EM LOTE (PLANILHA) --- */}
        {sucessoLote !== null && (
          <div className="chart-card" style={{ maxWidth: 540, margin: '20px auto', textAlign: 'center', padding: '40px 30px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
            }}>
              <CheckCircle size={32} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>Importação Concluída</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
              Sua planilha foi processada e os registros foram importados.
            </p>

            <div style={{
              background: 'rgba(99, 102, 241, 0.07)',
              border: '1px solid rgba(99, 102, 241, 0.18)',
              borderRadius: 10, padding: '20px', marginBottom: 30
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Total de Protocolos Criados</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#a5b4fc', fontFamily: 'monospace' }}>{sucessoLote}</div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={reiniciarLote}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Importar Outra Planilha
              </button>
              <Link to="/protocolos/consulta" style={{ textDecoration: 'none' }}>
                <button
                  style={{
                    padding: '10px 22px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Ver no Painel
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* --- FORMULÁRIOS DE CRIAÇÃO --- */}
        {!sucessoIndividual && sucessoLote === null && (
          <div className="chart-card" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 30px' }}>
            
            {/* TABS NAVEGAÇÃO DE TIPO DE CADASTRO */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 12 }}>
              <button
                type="button"
                onClick={() => { setAba('individual'); setErro(''); }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: aba === 'individual' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  border: `1px solid ${aba === 'individual' ? 'rgba(99, 102, 241, 0.25)' : 'transparent'}`,
                  color: aba === 'individual' ? '#a5b4fc' : '#64748b',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s'
                }}
              >
                Abertura Individual
              </button>
              <button
                type="button"
                onClick={() => { setAba('lote'); setErro(''); }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: aba === 'lote' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  border: `1px solid ${aba === 'lote' ? 'rgba(99, 102, 241, 0.25)' : 'transparent'}`,
                  color: aba === 'lote' ? '#a5b4fc' : '#64748b',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s'
                }}
              >
                Importação em Lote (Excel)
              </button>
            </div>

            {/* ABA INDIVIDUAL (FORMULÁRIO MANUAL) */}
            {aba === 'individual' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.05)', paddingBottom: 14 }}>
                  <FilePlus color="#6366f1" size={20} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Preencha o Formulário de Abertura</span>
                </div>

                <form onSubmit={handleSalvarIndividual} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={labelSt}>Nome do Requerente *</label>
                      <input
                        type="text"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Digite o nome completo"
                        style={inputSt}
                        required
                      />
                    </div>
                    <div>
                      <label style={labelSt}>Matrícula (opcional)</label>
                      <input
                        type="text"
                        value={matricula}
                        onChange={e => setMatricula(e.target.value)}
                        placeholder="Ex: 123456"
                        style={inputSt}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={labelSt}>Secretaria *</label>
                      <select
                        value={secretaria}
                        onChange={e => setSecretaria(e.target.value)}
                        style={inputSt}
                        required
                      >
                        <option value="">Selecione uma secretaria</option>
                        {SECRETARIAS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelSt}>Tipo de Solicitação *</label>
                      <select
                        value={tipo}
                        onChange={e => setTipo(e.target.value)}
                        style={inputSt}
                        required
                      >
                        <option value="">Selecione o tipo</option>
                        {TIPOS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={labelSt}>Prazo Estimado de Resolução</label>
                    <input
                      type="date"
                      value={prazo}
                      onChange={e => setPrazo(e.target.value)}
                      style={inputSt}
                    />
                  </div>

                  <div>
                    <label style={labelSt}>Descrição / Detalhamento do Requerimento</label>
                    <textarea
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      placeholder="Descreva detalhadamente o motivo da solicitação..."
                      style={{ ...inputSt, height: 100, resize: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={labelSt}>Documento Comprobatório (Anexo)</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(0,0,0,.15)', border: '1px dashed rgba(255,255,255,.15)',
                      borderRadius: 8, padding: '12px 16px', color: '#94a3b8', fontSize: 13
                    }}>
                      <FileText size={18} color="#6366f1" />
                      <input
                        type="file"
                        onChange={e => setAnexo(e.target.value)}
                        style={{ display: 'none' }}
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" style={{ cursor: 'pointer', color: '#a5b4fc', fontWeight: 600 }}>
                        {anexo ? anexo.split('\\').pop() : 'Selecione um arquivo PDF ou imagem'}
                      </label>
                      {anexo && (
                        <button type="button" onClick={() => setAnexo('')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                          Remover
                        </button>
                      )}
                    </div>
                  </div>

                  {erro && (
                    <div style={{ fontSize: 12, color: '#f87171', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}>
                      {erro}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                    <Link to="/protocolos/painel" style={{ textDecoration: 'none' }}>
                      <button
                        type="button"
                        style={{
                          padding: '10px 18px', borderRadius: 8,
                          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                          color: '#94a3b8', fontSize: 13, cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    </Link>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '10px 24px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                        cursor: loading ? 'wait' : 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                      }}
                    >
                      {loading ? 'Abrindo protocolo...' : 'Registrar Protocolo'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ABA EM LOTE (UPLOAD DA PLANILHA EXCEL) */}
            {aba === 'lote' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.05)', paddingBottom: 14 }}>
                  <FileSpreadsheet color="#10b981" size={20} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Importar Planilha XLSX de Protocolos</span>
                </div>

                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: '1.6', marginTop: -4 }}>
                  Carregue um arquivo Excel contendo as colunas do relatório <strong>"Protocolos Aceitar e Receber"</strong>. O sistema processará automaticamente todas as linhas contidas na planilha.
                </p>

                {/* Dropzone de Lote */}
                {!fileLote ? (
                  <div style={{
                    border: '2px dashed rgba(255,255,255,.15)', borderRadius: 10,
                    padding: '40px 20px', textAlign: 'center', background: 'rgba(0,0,0,.15)',
                    cursor: 'pointer', position: 'relative', minHeight: 120, display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    <input
                      type="file"
                      onChange={handleFileLoteChange}
                      accept=".xls,.xlsx"
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        opacity: 0, cursor: 'pointer'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Upload size={22} color="#34d399" />
                      </div>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Clique para selecionar</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}> ou arraste o arquivo Excel aqui</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#475569' }}>Suporta arquivos .XLS e .XLSX</span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)',
                    borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    <FileSpreadsheet size={24} color="#34d399" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileLote.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {(fileLote.size / 1024).toFixed(1)} KB · <strong>{protsLote.length}</strong> protocolos detectados para importação.
                      </div>
                    </div>
                    {!loading && (
                      <button
                        type="button"
                        onClick={() => { setFileLote(null); setProtsLote([]); setErro(''); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                )}

                {loading && <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: '#64748b' }}>Processando planilha...</div>}
                
                {erro && (
                  <div style={{ fontSize: 12, color: '#f87171', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{erro}</span>
                  </div>
                )}

                {/* Previsualização Lote */}
                {protsLote.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Pré-visualização dos Protocolos a serem criados</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 6 }}>
                      {protsLote.slice(0, 4).map((p, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: '#a5b4fc', fontFamily: 'monospace' }}>{p.numero_protocolo}</span>
                            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,.05)', color: '#94a3b8', fontSize: 10 }}>{p.secretaria}</span>
                          </div>
                          <div style={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 2 }}>{p.requerente_nome}</div>
                          <div style={{ color: '#64748b', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tipo_solicitacao} — {p.descricao}</div>
                        </div>
                      ))}
                      {protsLote.length > 4 && (
                        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>... e mais {protsLote.length - 4} protocolos encontrados na planilha.</div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12, borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 14 }}>
                  <Link to="/protocolos/painel" style={{ textDecoration: 'none' }}>
                    <button
                      type="button"
                      disabled={loading}
                      style={{
                        padding: '10px 18px', borderRadius: 8,
                        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                        color: '#94a3b8', fontSize: 13, cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  </Link>
                  <button
                    type="button"
                    onClick={handleConfirmarLote}
                    disabled={loading || protsLote.length === 0}
                    style={{
                      padding: '10px 24px', borderRadius: 8,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: (loading || protsLote.length === 0) ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                      opacity: protsLote.length === 0 ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Importando...' : `Confirmar Importação de ${protsLote.length} Protocolos`}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
