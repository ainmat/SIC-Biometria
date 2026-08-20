import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, RefreshCw, FileText, ChevronRight, Eye, Clipboard, ArrowRight, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Calendar, Plus, ChevronUp, ChevronDown, Trash2, Download, X } from 'lucide-react';
import { fetchProtocolos, atualizarStatusProtocolo, importarProtocolos, atualizarProtocolo, fetchProtocoloDetalhe, uploadAnexoProtocolo, listarAnexosProtocolo, excluirAnexoProtocolo, obterUrlAnexo } from '../services/protocoloService';
import { lerArquivoXLS, processarLinhasPlanilha } from '../utils/processarProtocoloXLS';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

import { SECRETARIAS } from '@/lib/secretarias';
const STATUS_OPCOES = ['Aberto', 'Em Análise', 'Concluído'];
const TIPOS = [
  'Abono de Faltas - Atestado Médico',
  'Retificação de Batida de Ponto',
  'Solicitação de Acesso Biométrico',
  'Licença Prêmio',
  'Opção por Acúmulo de Cargo',
  'Outros'
];

const CORES_STATUS = {
  'Aberto': { bg: 'rgba(13, 124, 61, 0.12)', text: '#15A050', border: 'rgba(13, 124, 61, 0.25)' },
  'Em Análise': { bg: 'rgba(245, 158, 11, 0.12)', text: '#b45309', border: 'rgba(245, 158, 11, 0.25)' },
  'Concluído': { bg: 'rgba(16, 185, 129, 0.12)', text: '#047857', border: 'rgba(16, 185, 129, 0.25)' }
};

const CORES_PRIORIDADE = {
  'Baixa': { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.25)' },
  'Normal': { bg: 'rgba(13, 124, 61, 0.12)', text: '#15A050', border: 'rgba(13, 124, 61, 0.25)' },
  'Alta': { bg: 'rgba(245, 158, 11, 0.12)', text: '#b45309', border: 'rgba(245, 158, 11, 0.25)' },
  'Urgente': { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.25)' }
};

function formatarData(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatarDataSimples(isoStr) {
  if (!isoStr) return '—';
  // Datas no formato YYYY-MM-DD são interpretadas como UTC meia-noite pelo new Date(),
  // o que em GMT-3 mostra o dia anterior. Parseamos manualmente para evitar isso.
  if (typeof isoStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoStr)) {
    const [ano, mes, dia] = isoStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function obterIniciais(nome) {
  if (!nome) return '';
  return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Modal de detalhes e tramitação
function DetalhesModal({ protocolo, onClose, onRefresh, operadores, isAdmin, meuNome }) {
  const { sessao } = useAuth();
  const [localProt, setLocalProt] = useState(protocolo);
  
  const [novoStatus, setNovoStatus] = useState(protocolo.status);
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [copiado, setCopiado] = useState(false);
  
  // Estado para os Anexos
  const [anexos, setAnexos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    setLocalProt(protocolo);
    setNovoStatus(protocolo.status);
    carregarAnexos(protocolo.id);
  }, [protocolo]);

  async function carregarAnexos(protId) {
    const data = await listarAnexosProtocolo(protId);
    setAnexos(data);
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const operador = sessao?.nome || sessao?.username || 'Sistema';
    
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadAnexoProtocolo(localProt.id, files[i], operador);
      }
      await carregarAnexos(localProt.id);
    } catch (e) {
      alert('Erro ao enviar um ou mais anexos: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoverAnexo(anexo) {
    if (!confirm('Deseja realmente remover este anexo?')) return;
    try {
      await excluirAnexoProtocolo(anexo.id, anexo.caminho_storage);
      await carregarAnexos(localProt.id);
    } catch (e) {
      alert('Erro ao remover anexo: ' + e.message);
    }
  }

  const handleDrag = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const stStyle = CORES_STATUS[localProt.status] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#1e293b', border: 'rgba(0, 0, 0, 0.06)' };
  const prioStyle = CORES_PRIORIDADE[localProt.prioridade || 'Normal'] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#cbd5e1', border: 'rgba(0, 0, 0, 0.06)' };

  async function handleUpdateField(campo, valor) {
    try {
      setEditingField(null);
      if (campo === 'status') {
        const operador = sessao?.nome || sessao?.username || 'Operador';
        await atualizarStatusProtocolo(localProt.id, valor, `Status alterado no detalhamento`, operador);
      } else {
        await atualizarProtocolo(localProt.id, { [campo]: valor });
      }
      
      const res = await fetchProtocoloDetalhe(localProt.id);
      if (res.data) {
        setLocalProt(res.data);
        setNovoStatus(res.data.status);
      }
      onRefresh();
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
    }
  }

  async function handleTramitar(e) {
    e.preventDefault();
    if (!observacao.trim()) {
      setErro('Informe uma justificativa ou observação para a tramitação.');
      return;
    }
    setErro('');
    setSubmitting(true);
    try {
      const operador = sessao?.nome || sessao?.username || 'Administrador';
      await atualizarStatusProtocolo(localProt.id, novoStatus, observacao, operador);
      setObservacao('');
      
      const res = await fetchProtocoloDetalhe(localProt.id);
      if (res.data) {
        setLocalProt(res.data);
        setNovoStatus(res.data.status);
      }
      onRefresh();
    } catch (err) {
      setErro(err.message || 'Erro ao atualizar protocolo');
    } finally {
      setSubmitting(false);
    }
  }

  function extrairAutor(texto) {
    const regex = /^(.*)\s\((.*?)\)$/;
    const match = texto.match(regex);
    if (match) {
      return { mensagem: match[1], autor: match[2] };
    }
    return { mensagem: texto, autor: 'Sistema' };
  }

  const isAtrasado = () => {
    if (!localProt.data_conclusao || localProt.status === 'Concluído') return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const parts = localProt.data_conclusao.split('-');
    const conclusao = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    conclusao.setHours(0, 0, 0, 0);
    return conclusao < hoje;
  };
  const atrasado = isAtrasado();

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 840 }}>
        {/* CABEÇALHO ASANA STYLE */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15A050', fontWeight: 600, fontSize: 14 }}>
              <CheckCircle size={16} />
              <span>{localProt.numero_protocolo}</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(localProt.numero_protocolo);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              title="Copiar número do protocolo"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', color: copiado ? '#15A050' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 4,
                transition: 'all 0.2s'
              }}
            >
              {copiado ? <CheckCircle size={14} /> : <Clipboard size={14} />}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{localProt.tipo_solicitacao}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* PROPERTIES EM LINHA: STATUS, RESPONSÁVEL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Status */}
              <div style={{ position: 'relative' }}>
                {editingField === 'status' ? (
                  <select
                    defaultValue={localProt.status}
                    onChange={(e) => handleUpdateField('status', e.target.value)}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    style={{
                      padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                      border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                    }}
                  >
                    {STATUS_OPCOES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                ) : (
                  <div 
                    onClick={() => setEditingField('status')}
                    style={{
                      padding: '4px 10px', borderRadius: 20,
                      background: stStyle.bg, color: stStyle.text,
                      border: `1px solid ${stStyle.border}`,
                      fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
                    }}
                  >
                    {localProt.status} <ChevronDown size={10} />
                  </div>
                )}
              </div>

              {/* Responsável */}
              <div style={{ position: 'relative' }}>
                {editingField === 'responsavel' ? (
                  <select
                    defaultValue={localProt.responsavel || ''}
                    onChange={(e) => handleUpdateField('responsavel', e.target.value || null)}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    style={{
                      padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                      border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none', width: '120px'
                    }}
                  >
                    <option value="">Ninguém</option>
                    {operadores.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                ) : localProt.responsavel ? (
                  <div 
                    onClick={() => setEditingField('responsavel')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 8px 2px 2px', borderRadius: 20, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0, 0, 0, 0.04)' }}
                    title="Clique para alterar"
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0D7C3D', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {obterIniciais(localProt.responsavel)}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{localProt.responsavel.split(' ')[0]}</span>
                  </div>
                ) : (
                  <div 
                    onClick={() => setEditingField('responsavel')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 10px', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.2)', color: 'var(--muted-c)' }}
                  >
                    <Plus size={12} /> <span style={{ fontSize: 11 }}>Atribuir</span>
                  </div>
                )}
              </div>

            </div>

            <div style={{ width: 1, height: 20, background: 'var(--border-c)' }}></div>
            
            <button className="chamado-modal-close" style={{ position: 'static', margin: 0, padding: 4 }} onClick={onClose}>×</button>
          </div>
        </div>

        {/* CORPO ASANA STYLE */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* BARRA DE PROPRIEDADES HORIZONTAL */}
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, 
            background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 10, padding: 16, marginBottom: 24 
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase', marginBottom: 4 }}>Requerente</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{localProt.requerente_nome}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>Mat: {localProt.requerente_matricula || 'N/I'}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase', marginBottom: 4 }}>Secretaria</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{localProt.secretaria}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase', marginBottom: 4 }}>Prioridade</div>
              {editingField === 'prioridade' ? (
                <select
                  defaultValue={localProt.prioridade || 'Normal'}
                  onChange={(e) => handleUpdateField('prioridade', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  style={{
                    padding: '4px 6px', borderRadius: 6, background: 'var(--surface)', width: '100%',
                    border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                  }}
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              ) : (
                <div 
                  onClick={() => setEditingField('prioridade')}
                  style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: prioStyle.bg, color: prioStyle.text,
                    border: `1px solid ${prioStyle.border}`,
                    fontSize: 11, fontWeight: 600, display: 'inline-flex', cursor: 'pointer'
                  }}
                >
                  {localProt.prioridade || 'Normal'}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase', marginBottom: 4 }}>Datas</div>
              <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
                <span style={{ color: 'var(--muted-c)' }}>Aber:</span> <span style={{ fontWeight: 500 }}>{formatarDataSimples(localProt.data_abertura)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
                <span style={{ color: 'var(--muted-c)' }}>Prazo:</span> <span style={{ fontWeight: 500 }}>{formatarDataSimples(localProt.prazo_estimado)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--muted-c)' }}>Concl:</span> 
                {editingField === 'data_conclusao' ? (
                  <input
                    type="date"
                    defaultValue={localProt.data_conclusao || ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateField('data_conclusao', e.target.value || null);
                      if (e.key === 'Escape') setEditingField(null);
                    }}
                    onBlur={(e) => handleUpdateField('data_conclusao', e.target.value || null)}
                    autoFocus
                    style={{
                      padding: '0px 2px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 11, outline: 'none'
                    }}
                  />
                ) : localProt.data_conclusao ? (
                  <span onClick={() => setEditingField('data_conclusao')} style={{ color: atrasado ? '#ef4444' : 'var(--text)', textDecoration: 'underline', textDecorationStyle: 'dotted', cursor: 'pointer', fontWeight: 500 }}>
                    {formatarDataSimples(localProt.data_conclusao)}
                  </span>
                ) : (
                  <span onClick={() => setEditingField('data_conclusao')} style={{ color: 'var(--muted-c)', borderBottom: '1px dashed rgba(0,0,0,0.2)', cursor: 'pointer', fontWeight: 500 }}>
                    Definir
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MAIN COLUMN (Full width) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Descrição */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Descrição</div>
              <div style={{ 
                fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: '1.6', 
                background: 'rgba(0,0,0,0.01)', padding: 16, borderRadius: 8, border: '1px solid rgba(0,0,0,0.03)'
              }}>
                {localProt.descricao || 'Nenhuma descrição fornecida.'}
              </div>
            </div>

            {/* Anexos */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Anexos ({anexos.length + (localProt.documento_anexo ? 1 : 0)})</div>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {/* Anexo antigo (mock) */}
                {localProt.documento_anexo && (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', 
                    borderRadius: 8, border: '1px solid var(--border-c)', background: 'var(--surface)'
                  }}>
                    <FileText size={20} color="#0D7C3D" />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{localProt.documento_anexo}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-c)' }}>Documento antigo</div>
                    </div>
                  </div>
                )}
                
                {/* Lista de anexos novos */}
                {anexos.map((anexo) => (
                  <div key={anexo.id} style={{ 
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', 
                    borderRadius: 8, border: '1px solid var(--border-c)', background: 'var(--surface)',
                    position: 'relative'
                  }}>
                    <div style={{ padding: 6, background: 'rgba(13, 124, 61, 0.1)', borderRadius: 6 }}>
                      <FileText size={18} color="#0D7C3D" />
                    </div>
                    <div style={{ flex: 1, minWidth: 120, maxWidth: 200 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={anexo.nome_arquivo}>
                        {anexo.nome_arquivo}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted-c)' }}>
                        {(anexo.tamanho_bytes / 1024).toFixed(1)} KB • {anexo.enviado_por?.split(' ')[0]}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => window.open(obterUrlAnexo(anexo.caminho_storage), '_blank')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                        title="Baixar anexo"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoverAnexo(anexo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                        title="Excluir anexo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Zona de Drop para novos anexos */}
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{ 
                  width: '100%', padding: '20px', borderRadius: 8, 
                  border: `1px dashed ${dragActive ? '#0D7C3D' : 'var(--border-c)'}`,
                  background: dragActive ? 'rgba(13, 124, 61, 0.05)' : 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--muted-c)',
                  position: 'relative', transition: 'all 0.2s'
                }}
              >
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => handleFiles(e.target.files)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                  disabled={uploading}
                />
                <Upload size={20} color={dragActive ? '#0D7C3D' : '#94a3b8'} />
                <span style={{ fontSize: 12 }}>
                  {uploading ? 'Enviando arquivos...' : 'Clique ou arraste arquivos para anexar'}
                </span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-c)' }} />

            {/* Feed de Comentários / Atividades */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Todas as atividades</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {localProt.historico_tramitacao?.map((t, idx) => {
                  const { mensagem, autor } = extrairAutor(t.observacao);
                  const iniciais = obterIniciais(autor);
                  
                  return (
                    <div key={idx} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'rgba(13, 124, 61, 0.1)', color: '#0D7C3D', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {iniciais}
                      </div>
                      <div style={{ flex: 1, paddingTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{autor}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{formatarData(t.data)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {mensagem}
                        </div>
                        {t.status && t.status !== 'Aberto' && (
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-c)' }}>
                            → Alterou o status para <strong>{t.status}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Input de Comentário Fixo (Asana Style) */}
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: '#0D7C3D', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {obterIniciais(meuNome || 'U')}
                  </div>
                  <div style={{ flex: 1, border: '1px solid var(--border-c)', borderRadius: 8, overflow: 'hidden' }}>
                    <textarea
                      value={observacao}
                      onChange={e => setObservacao(e.target.value)}
                      placeholder="Adicionar um comentário..."
                      style={{
                        width: '100%', height: 60, padding: '10px 12px', border: 'none',
                        background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '8px 12px', borderTop: '1px solid var(--border-c)' }}>
                      <select
                        value={novoStatus}
                        onChange={e => setNovoStatus(e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 11, outline: 'none'
                        }}
                      >
                        {STATUS_OPCOES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>

                      <button
                        onClick={(e) => { e.preventDefault(); handleTramitar(e); }}
                        disabled={submitting || !observacao.trim()}
                        style={{
                          padding: '6px 14px', borderRadius: 6,
                          background: (submitting || !observacao.trim()) ? '#94a3b8' : '#0D7C3D',
                          border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                          cursor: (submitting || !observacao.trim()) ? 'not-allowed' : 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        {submitting ? 'Salvando...' : 'Comentar'}
                      </button>
                    </div>
                  </div>
                </div>
                {erro && <div style={{ fontSize: 11, color: '#dc2626', marginTop: -10, paddingLeft: 44 }}>{erro}</div>}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConsultaProtocolo() {
  const { sessao, isMaster, isAdmin } = useAuth();
  const meuNome = sessao?.nome || sessao?.username;
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [operadores, setOperadores] = useState([]);

  useEffect(() => {
    async function fetchOperadores() {
      try {
        const { data, error } = await supabase.rpc('listar_usuarios_rpc', { p_token: sessao?.token });
        if (error) {
          console.error('Erro ao buscar operadores:', error);
        }
        if (!error && data) {
          const ops = data.filter(u => 
            u.ativo && 
            (u.role === 'admin' || u.role === 'master') && 
            !u.nome.toLowerCase().includes('teste')
          );
          setOperadores(ops.map(u => u.nome));
        }
      } catch (e) {
        console.error('Exceção ao buscar operadores:', e);
      }
    }
    if (sessao) fetchOperadores();
  }, [sessao]);

  // Abas estilo Asana (Todos vs Meus)
  const [abaAtiva, setAbaAtiva] = useState('todos'); // 'todos' ou 'meus'

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSecretaria, setFiltroSecretaria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [mostrarFiltrosAvan, setMostrarFiltrosAvan] = useState(false);

  const tiposDisponiveis = useMemo(() => {
    const ts = new Set(TIPOS);
    dados.forEach(d => {
      if (d.tipo_solicitacao) ts.add(d.tipo_solicitacao);
    });
    return Array.from(ts).sort();
  }, [dados]);

  // Ordenação (Estilo Excel/Asana)
  const [sortField, setSortField] = useState('data_abertura');
  const [sortDirection, setSortDirection] = useState('desc');

  // Estados de Edição Inline (Estilo Asana)
  const [editingPrioId, setEditingPrioId] = useState(null);
  const [editingRespId, setEditingRespId] = useState(null);
  const [editingDateId, setEditingDateId] = useState(null);
  const [editingStatusId, setEditingStatusId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProtocolos();
      setDados(res.data);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar protocolos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Filtragem local e Ordenação
  const filtrados = useMemo(() => {
    let res = dados.filter(p => {
      const termo = busca.trim().toLowerCase();
      const matchBusca = !termo ||
        p.numero_protocolo.toLowerCase().includes(termo) ||
        p.requerente_nome.toLowerCase().includes(termo) ||
        (p.requerente_matricula && p.requerente_matricula.includes(termo));
      
      const matchStatus = !filtroStatus || p.status === filtroStatus;
      const matchSec = !filtroSecretaria || p.secretaria === filtroSecretaria;
      const matchTipo = !filtroTipo || p.tipo_solicitacao === filtroTipo;
      
      const pResp = p.responsavel || 'Não atribuído';
      const matchResp = !filtroResponsavel || pResp === filtroResponsavel;
      
      const pPrio = p.prioridade || 'Normal';
      const matchPrio = !filtroPrioridade || pPrio === filtroPrioridade;

      return matchBusca && matchStatus && matchSec && matchTipo && matchResp && matchPrio;
    });

    // Filtro por "Meus Protocolos"
    if (abaAtiva === 'meus') {
      res = res.filter(p => p.responsavel === meuNome);
    }

    if (sortField) {
      res.sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';

        if (sortField === 'data_abertura' || sortField === 'data_conclusao' || sortField === 'prazo_estimado') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return res;
  }, [dados, busca, filtroStatus, filtroSecretaria, filtroTipo, filtroResponsavel, filtroPrioridade, sortField, sortDirection, abaAtiva, sessao]);

  const SEL = {
    padding: '7px 10px',
    borderRadius: 8,
    background: 'var(--card-bg)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    color: 'var(--text)',
    fontSize: 12,
    outline: 'none',
    minWidth: 120
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Consulta de Protocolos</h1>
          <p>Localize, analise e faça a tramitação de requerimentos digitais</p>
        </div>
        <div className="topbar-right">
          <button
            onClick={() => setModalImportar(true)}
            title="Importar Planilha XLSX"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#047857', fontSize: 12, fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Upload size={14} />
            Importar Planilha
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Abas estilo Asana */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(0, 0, 0, 0.04)', marginBottom: 16 }}>
          <button
            onClick={() => setAbaAtiva('todos')}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              color: abaAtiva === 'todos' ? '#0D7C3D' : '#64748b',
              borderBottom: abaAtiva === 'todos' ? '2px solid #0D7C3D' : '2px solid transparent',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
              transition: 'color 0.2s, border-color 0.2s'
            }}
          >
            Todos os Protocolos
          </button>
          <button
            onClick={() => setAbaAtiva('meus')}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              color: abaAtiva === 'meus' ? '#0D7C3D' : '#64748b',
              borderBottom: abaAtiva === 'meus' ? '2px solid #0D7C3D' : '2px solid transparent',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
              transition: 'color 0.2s, border-color 0.2s'
            }}
          >
            Meus Protocolos
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="chart-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 8, padding: '6px 12px', flex: 1, minWidth: 200 }}>
              <Search size={15} color="#64748b" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por Requerente ou Protocolo..."
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }}
              />
            </div>

            <button
              onClick={() => setMostrarFiltrosAvan(!mostrarFiltrosAvan)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8,
                background: mostrarFiltrosAvan ? 'rgba(13, 124, 61, 0.1)' : 'var(--surface)',
                border: mostrarFiltrosAvan ? '1px solid rgba(13, 124, 61, 0.2)' : '1px solid var(--border-c)',
                color: mostrarFiltrosAvan ? '#0D7C3D' : 'var(--text)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Filter size={14} />
              Filtros Avançados
              {(filtroStatus || filtroSecretaria || filtroTipo || filtroResponsavel || filtroPrioridade) && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginLeft: 2 }} />
              )}
            </button>

            {/* Ordenação - Visual Asana */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ordenar:</span>
              <select
                value={sortField}
                onChange={e => setSortField(e.target.value)}
                style={SEL}
              >
                <option value="data_abertura">Data de Abertura</option>
                <option value="numero_protocolo">Número do Protocolo</option>
                <option value="requerente_nome">Requerente</option>
                <option value="data_conclusao">Data de Conclusão</option>
                <option value="prioridade">Prioridade</option>
              </select>
              <button
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600
                }}
              >
                {sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
              </button>
            </div>
          </div>

          {/* Área expansível de filtros */}
          {mostrarFiltrosAvan && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4, padding: '12px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, width: 45 }}>Status:</span>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...SEL, minWidth: 160 }}>
                  <option value="">Todos</option>
                  {STATUS_OPCOES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, width: 65 }}>Secretaria:</span>
                <select value={filtroSecretaria} onChange={e => setFiltroSecretaria(e.target.value)} style={{ ...SEL, minWidth: 160 }}>
                  <option value="">Todas</option>
                  {SECRETARIAS.map(sec => <option key={sec.nome} value={sec.nome}>{sec.nome}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, width: 35 }}>Tipo:</span>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...SEL, maxWidth: 220 }}>
                  <option value="">Todos</option>
                  {tiposDisponiveis.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, width: 75 }}>Responsável:</span>
                <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} style={{ ...SEL, maxWidth: 180 }}>
                  <option value="">Todos</option>
                  <option value="Não atribuído">Não atribuído</option>
                  {operadores.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, width: 62 }}>Prioridade:</span>
                <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)} style={{ ...SEL, maxWidth: 160 }}>
                  <option value="">Todas</option>
                  <option value="Baixa">Baixa</option>
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
            </div>
          )}

          {/* Tags de Filtros Ativos */}
          {(filtroStatus || filtroSecretaria || filtroTipo || filtroResponsavel || filtroPrioridade) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {filtroStatus && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--muted-c)' }}>Status:</span> {filtroStatus}
                  <span style={{ cursor: 'pointer', marginLeft: 4, color: 'var(--muted-c)' }} onClick={() => setFiltroStatus('')}>×</span>
                </div>
              )}
              {filtroSecretaria && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--muted-c)' }}>Secretaria:</span> {filtroSecretaria}
                  <span style={{ cursor: 'pointer', marginLeft: 4, color: 'var(--muted-c)' }} onClick={() => setFiltroSecretaria('')}>×</span>
                </div>
              )}
              {filtroTipo && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--muted-c)' }}>Tipo:</span> {filtroTipo}
                  <span style={{ cursor: 'pointer', marginLeft: 4, color: 'var(--muted-c)' }} onClick={() => setFiltroTipo('')}>×</span>
                </div>
              )}
              {filtroResponsavel && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--muted-c)' }}>Resp:</span> {filtroResponsavel}
                  <span style={{ cursor: 'pointer', marginLeft: 4, color: 'var(--muted-c)' }} onClick={() => setFiltroResponsavel('')}>×</span>
                </div>
              )}
              {filtroPrioridade && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--muted-c)' }}>Prio:</span> {filtroPrioridade}
                  <span style={{ cursor: 'pointer', marginLeft: 4, color: 'var(--muted-c)' }} onClick={() => setFiltroPrioridade('')}>×</span>
                </div>
              )}
              
              <div 
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, color: 'var(--muted-c)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => {
                  setFiltroStatus(''); setFiltroSecretaria(''); setFiltroTipo(''); setFiltroResponsavel(''); setFiltroPrioridade('');
                }}
              >
                Limpar todos
              </div>
            </div>
          )}

        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-c)' }}>Carregando protocolos...</div>
        ) : erro ? (
          <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>
            <strong>Erro:</strong> {erro}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: 60, color: 'var(--muted-c)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhum protocolo localizado</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros ou crie um novo protocolo.</div>
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: '1px solid var(--border-c)', background: 'var(--card-bg)' }}>
            <div style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  {[
                    { key: 'numero_protocolo', label: 'Protocolo', w: 140 },
                    { key: 'requerente_nome', label: 'Requerente', w: null },
                    { key: null, label: 'Demanda', w: null },
                    { key: null, label: 'Secretaria', w: null },
                    { key: 'data_abertura', label: 'Abertura', w: 100, defaultDir: 'desc' },
                    { key: 'responsavel', label: 'Responsável', w: 150 },
                    { key: 'data_conclusao', label: 'Conclusão', w: 110 },
                    { key: 'prioridade', label: 'Prioridade', w: 100 },
                    { key: 'status', label: 'Status', w: 120 },
                  ].map((col, ci) => (
                    <th 
                      key={ci}
                      onClick={col.key ? () => {
                        setSortField(col.key);
                        setSortDirection(prev => sortField === col.key ? (prev === 'asc' ? 'desc' : 'asc') : (col.defaultDir || 'asc'));
                      } : undefined}
                      style={{ 
                        padding: '10px 16px', fontSize: 11, color: sortField === col.key ? '#0D7C3D' : 'var(--muted-c)', 
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                        cursor: col.key ? 'pointer' : 'default', userSelect: 'none',
                        borderBottom: '2px solid var(--border-c)',
                        whiteSpace: 'nowrap', width: col.w || undefined,
                        transition: 'color 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {col.label}
                        {sortField === col.key && (
                          <span style={{ opacity: 0.7 }}>{sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, rowIdx) => {
                  const st = CORES_STATUS[p.status] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#1e293b', border: 'rgba(0, 0, 0, 0.06)' };
                  const prioStyle = CORES_PRIORIDADE[p.prioridade || 'Normal'] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#cbd5e1', border: 'rgba(0, 0, 0, 0.06)' };
                  
                  const isAtrasado = () => {
                    if (!p.data_conclusao || p.status === 'Concluído') return false;
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const parts = p.data_conclusao.split('-');
                    const conclusao = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    conclusao.setHours(0, 0, 0, 0);
                    return conclusao < hoje;
                  };
                  const atrasado = isAtrasado();

                  const obterIniciais = (nome) => {
                    if (!nome) return '';
                    return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  };

                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => setModal(p)}
                      title="Abrir detalhes do protocolo"
                      style={{ 
                        borderBottom: '1px solid rgba(0, 0, 0, 0.04)', 
                        cursor: 'pointer',
                        background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.008)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(13, 124, 61, 0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = rowIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.008)'}
                    >
                      {/* Protocolo */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          fontSize: 12, fontWeight: 700, color: '#0D7C3D', 
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          letterSpacing: '-.02em'
                        }}>
                          {p.numero_protocolo}
                        </span>
                      </td>
                      
                      {/* Requerente */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{p.requerente_nome}</div>
                        {p.requerente_matricula && (
                          <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 1 }}>Mat: {p.requerente_matricula}</div>
                        )}
                      </td>
                      
                      {/* Tipo de Demanda */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text)', maxWidth: 200 }}>
                        <span style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.tipo_solicitacao}
                        </span>
                      </td>
                      
                      {/* Secretaria */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text)', maxWidth: 180 }}>
                        <span style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.secretaria}
                        </span>
                      </td>
                      
                      {/* Abertura */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted-c)', whiteSpace: 'nowrap' }}>
                        {formatarDataSimples(p.data_abertura)}
                      </td>
                      
                      {/* Responsável */}
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        {editingRespId === p.id ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <div
                              style={{
                                padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                                border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                minWidth: 120
                              }}
                            >
                              {p.responsavel || 'Ninguém'}
                            </div>
                            <div
                              style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 9999,
                                background: 'var(--card-bg)', border: '1px solid var(--border-c)',
                                borderRadius: 10, padding: 6, minWidth: 220,
                                boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                                display: 'flex', flexDirection: 'column', gap: 2,
                                marginTop: 4, maxHeight: 200, overflowY: 'auto'
                              }}
                            >
                              <div
                                onClick={async () => {
                                  setEditingRespId(null);
                                  try {
                                    await atualizarProtocolo(p.id, { responsavel: null });
                                    carregar();
                                  } catch (err) { alert('Erro ao atualizar responsável: ' + err.message); }
                                }}
                                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, color: 'var(--muted-c)', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                Ninguém
                              </div>
                              {operadores.map(op => (
                                <div
                                  key={op}
                                  onClick={async () => {
                                    setEditingRespId(null);
                                    try {
                                      await atualizarProtocolo(p.id, { responsavel: op });
                                      carregar();
                                    } catch (err) { alert('Erro ao atualizar responsável: ' + err.message); }
                                  }}
                                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #0D7C3D, #10B981)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {obterIniciais(op)}
                                  </div>
                                  {op}
                                </div>
                              ))}
                            </div>
                            <div 
                              style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
                              onClick={(e) => { e.stopPropagation(); setEditingRespId(null); }}
                            />
                          </div>
                        ) : p.responsavel ? (
                          (p.responsavel === meuNome || isAdmin) ? (
                            <div 
                              onClick={() => setEditingRespId(p.id)}
                              style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', 
                                padding: '3px 10px 3px 3px', borderRadius: 20, 
                                background: 'rgba(13, 124, 61, 0.06)', border: '1px solid rgba(13, 124, 61, 0.1)',
                                transition: 'all 0.15s'
                              }}
                              title="Clique para alterar o responsável"
                            >
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #0D7C3D, #10B981)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {obterIniciais(p.responsavel)}
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{p.responsavel.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <div 
                              style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: 6, 
                                padding: '3px 10px 3px 3px', borderRadius: 20, 
                                background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)', opacity: 0.6
                              }}
                              title={`Atribuído a ${p.responsavel}`}
                            >
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#64748b', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {obterIniciais(p.responsavel)}
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--muted-c)', fontWeight: 500 }}>{p.responsavel.split(' ')[0]}</span>
                            </div>
                          )
                        ) : (
                          <div 
                            onClick={() => setEditingRespId(p.id)}
                            style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', 
                              padding: '4px 10px', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.15)', 
                              color: 'var(--muted-c)', transition: 'all 0.15s', fontSize: 11
                            }}
                            title="Atribuir responsável"
                          >
                            <Plus size={11} />
                            Atribuir
                          </div>
                        )}
                      </td>

                      {/* Conclusão */}
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        {editingDateId === p.id ? (
                          <input
                            type="date"
                            defaultValue={p.data_conclusao || ''}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const nv = e.target.value || null;
                                setEditingDateId(null);
                                try {
                                  await atualizarProtocolo(p.id, { data_conclusao: nv });
                                  carregar();
                                } catch (err) {
                                  alert('Erro ao atualizar data de conclusão: ' + err.message);
                                }
                              } else if (e.key === 'Escape') {
                                setEditingDateId(null);
                              }
                            }}
                            onBlur={async (e) => {
                              const nv = e.target.value || null;
                              setEditingDateId(null);
                              try {
                                await atualizarProtocolo(p.id, { data_conclusao: nv });
                                carregar();
                              } catch (err) {
                                alert('Erro ao atualizar data de conclusão: ' + err.message);
                              }
                            }}
                            autoFocus
                            style={{
                              padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                              border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none', width: 120
                            }}
                          />
                        ) : p.data_conclusao ? (
                          <div 
                            onClick={() => setEditingDateId(p.id)}
                            style={{ 
                              fontSize: 12, color: atrasado ? '#ef4444' : 'var(--muted-c)', cursor: 'pointer', 
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6,
                              background: atrasado ? 'rgba(239,68,68,0.08)' : 'transparent',
                              border: atrasado ? '1px solid rgba(239,68,68,0.15)' : '1px solid transparent'
                            }}
                            title={atrasado ? 'Prazo expirado!' : 'Clique para alterar'}
                          >
                            <Calendar size={11} color={atrasado ? '#ef4444' : '#94a3b8'} />
                            <span style={{ fontWeight: atrasado ? 600 : 400 }}>{formatarDataSimples(p.data_conclusao)}</span>
                          </div>
                        ) : (
                          <div 
                            onClick={() => setEditingDateId(p.id)}
                            style={{ 
                              fontSize: 11, color: 'var(--muted-c)', cursor: 'pointer', 
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6, border: '1px dashed rgba(0,0,0,0.1)'
                            }}
                            title="Definir data de conclusão"
                          >
                            <Calendar size={11} />
                            Definir
                          </div>
                        )}
                      </td>

                      {/* Prioridade */}
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        {editingPrioId === p.id ? (
                          <select
                            value={p.prioridade || 'Normal'}
                            onChange={async (e) => {
                              const nv = e.target.value;
                              setEditingPrioId(null);
                              try {
                                await atualizarProtocolo(p.id, { prioridade: nv });
                                carregar();
                              } catch (err) {
                                alert('Erro ao atualizar prioridade: ' + err.message);
                              }
                            }}
                            onBlur={() => setEditingPrioId(null)}
                            autoFocus
                            style={{
                              padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                              border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                            }}
                          >
                            <option value="Baixa">Baixa</option>
                            <option value="Normal">Normal</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">Urgente</option>
                          </select>
                        ) : (
                          <span 
                            onClick={() => setEditingPrioId(p.id)}
                            style={{
                              padding: '3px 10px', borderRadius: 20,
                              background: prioStyle.bg, color: prioStyle.text,
                              border: `1px solid ${prioStyle.border}`,
                              fontSize: 11, fontWeight: 600, display: 'inline-block', cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            title="Clique para alterar prioridade"
                          >
                            {p.prioridade || 'Normal'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        {editingStatusId === p.id ? (
                          <select
                            value={p.status}
                            onChange={async (e) => {
                              const nv = e.target.value;
                              setEditingStatusId(null);
                              try {
                                const operador = sessao?.nome || sessao?.username || 'Operador';
                                await atualizarStatusProtocolo(p.id, nv, `Status alterado inline na listagem`, operador);
                                carregar();
                              } catch (err) {
                                alert('Erro ao atualizar status: ' + err.message);
                              }
                            }}
                            onBlur={() => setEditingStatusId(null)}
                            autoFocus
                            style={{
                              padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                              border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                            }}
                          >
                            {STATUS_OPCOES.map(stOpt => <option key={stOpt} value={stOpt}>{stOpt}</option>)}
                          </select>
                        ) : (
                          <span 
                            onClick={() => setEditingStatusId(p.id)}
                            style={{
                              padding: '3px 10px', borderRadius: 20,
                              background: st.bg, color: st.text,
                              border: `1px solid ${st.border}`,
                              fontSize: 11, fontWeight: 600, display: 'inline-block', cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            title="Clique para alterar status"
                          >
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Modal de Detalhes */}
        {modal && (
          <DetalhesModal
            protocolo={modal}
            onClose={() => setModal(null)}
            onRefresh={carregar}
            operadores={operadores}
            isAdmin={isAdmin}
            meuNome={meuNome}
          />
        )}

        {/* Modal de Importação */}
        {modalImportar && (
          <ImportarModal
            onClose={() => setModalImportar(false)}
            onRefresh={carregar}
          />
        )}
      </div>
    </div>
  );
}

// Modal de importação de planilha
function ImportarModal({ onClose, onRefresh }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [prots, setProts] = useState([]);
  const [sucessoMsg, setSucessoMsg] = useState('');

  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(ext)) {
      setErro('Apenas arquivos .xls e .xlsx são aceitos.');
      setFile(null);
      setProts([]);
      return;
    }

    setErro('');
    setFile(selectedFile);
    setLoading(true);

    try {
      const rows = await lerArquivoXLS(selectedFile);
      const parsed = processarLinhasPlanilha(rows);
      setProts(parsed);
    } catch (err) {
      console.error(err);
      setErro(err.message || 'Erro ao processar planilha. Verifique o formato.');
      setProts([]);
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmar() {
    if (prots.length === 0) return;
    setLoading(true);
    setErro('');
    try {
      const res = await importarProtocolos(prots);
      setSucessoMsg(`Sucesso! ${res.count} protocolo(s) importado(s) com sucesso.`);
    } catch (err) {
      setErro(err.message || 'Erro ao salvar os protocolos no sistema.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 540 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Importar Planilha de Protocolos</div>
          <button className="chamado-modal-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        {sucessoMsg ? (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <CheckCircle size={24} color="#10b981" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{sucessoMsg}</div>
            <button
              onClick={() => { onClose(); onRefresh(); }}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Concluído
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted-c)', lineHeight: '1.5' }}>
              Faça upload do relatório <strong>"Protocolos Aceitar e Receber"</strong> em formato XLS ou XLSX. O sistema identificará automaticamente as colunas correspondentes de forma inteligente.
            </p>

            {!file ? (
              <div style={{
                border: '2px dashed rgba(0, 0, 0, 0.08)', borderRadius: 10,
                padding: '30px 20px', textAlign: 'center', background: 'rgba(0,0,0,.15)',
                cursor: 'pointer', position: 'relative'
              }}>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xls,.xlsx"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(13, 124, 61, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={20} color="#15A050" />
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Clique para selecionar</span>
                    <span style={{ fontSize: 13, color: 'var(--muted-c)' }}> ou arraste o arquivo aqui</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Formatos aceitos: .XLS e .XLSX</span>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(13, 124, 61, 0.05)', border: '1px solid rgba(13, 124, 61, 0.15)',
                borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <FileSpreadsheet size={20} color="#818cf8" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>{(file.size / 1024).toFixed(1)} KB · {prots.length} protocolo(s) localizado(s)</div>
                </div>
                {!loading && (
                  <button
                    onClick={() => { setFile(null); setProts([]); }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remover
                  </button>
                )}
              </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--muted-c)' }}>Processando planilha...</div>}
            {erro && (
              <div style={{ fontSize: 12, color: '#dc2626', padding: '10px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{erro}</span>
              </div>
            )}

            {prots.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Pré-visualização (primeiros 3 itens)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {prots.slice(0, 3).map((p, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0, 0, 0, 0.03)', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: '#15A050', fontFamily: 'monospace' }}>{p.numero_protocolo}</span>
                        <span style={{ color: 'var(--muted-c)' }}>{p.secretaria}</span>
                      </div>
                      <div style={{ color: 'var(--text)', fontWeight: 600 }}>{p.requerente_nome}</div>
                      <div style={{ color: 'var(--muted-c)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tipo_solicitacao} - {p.descricao}</div>
                    </div>
                  ))}
                  {prots.length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', textAlign: 'center', marginTop: 4 }}>e mais {prots.length - 3} protocolo(s)...</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)',
                  color: 'var(--muted-c)', fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={loading || prots.length === 0}
                style={{
                  padding: '9px 20px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: (loading || prots.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: prots.length === 0 ? 0.6 : 1
                }}
              >
                {loading ? 'Processando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

