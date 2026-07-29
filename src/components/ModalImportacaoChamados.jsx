import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { lerArquivoPlanilha, processarEImportarChamados } from '../lib/importacaoChamados';

export default function ModalImportacaoChamados({ onClose, onSucesso }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === 'processing') return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      validarESetarArquivo(f);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validarESetarArquivo(e.target.files[0]);
    }
  };

  const validarESetarArquivo = (f) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.csv') && !f.name.endsWith('.xls')) {
      setErrorMsg('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.');
      setFile(null);
      return;
    }
    setErrorMsg('');
    setFile(f);
    setStatus('idle');
  };

  const processarArquivo = async () => {
    if (!file) return;
    
    setStatus('processing');
    setErrorMsg('');
    setProgress({ current: 0, total: 0 });

    try {
      // 1. Ler o arquivo
      const linhas = await lerArquivoPlanilha(file);
      if (!linhas || linhas.length === 0) {
        throw new Error('O arquivo está vazio ou não pôde ser lido.');
      }

      setProgress({ current: 0, total: linhas.length });

      // 2. Processar e Importar
      const inseridos = await processarEImportarChamados(linhas, (atual, total) => {
        setProgress({ current: atual, total });
      });

      setSuccessCount(inseridos);
      setStatus('success');
      if (onSucesso) onSucesso();
      
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Ocorreu um erro ao processar a planilha.');
    }
  };

  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget && status !== 'processing') onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 500 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Importar Chamados via Planilha</div>
          {status !== 'processing' && (
            <button className="chamado-modal-close" onClick={onClose}>×</button>
          )}
        </div>
        
        <div style={{ padding: '24px' }}>
          {status === 'idle' && (
            <>
              <div 
                style={{ 
                  border: '2px dashed rgba(13, 124, 61, 0.3)', 
                  borderRadius: 12, 
                  padding: 40, 
                  textAlign: 'center',
                  background: 'rgba(13, 124, 61, 0.02)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  marginBottom: 16
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(13, 124, 61, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(13, 124, 61, 0.02)'}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileSelect}
                />
                
                <UploadCloud size={48} color="#0D7C3D" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {file ? file.name : 'Clique ou arraste o arquivo aqui'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>
                  {file ? `Tamanho: ${(file.size / 1024).toFixed(1)} KB` : 'Suporta arquivos .xlsx e .csv'}
                </div>
              </div>

              {errorMsg && (
                <div style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button 
                  onClick={onClose} 
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(0,0,0,0.05)', color: 'var(--text)', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={processarArquivo} 
                  disabled={!file}
                  style={{ 
                    padding: '8px 16px', borderRadius: 8, background: file ? '#0D7C3D' : '#94a3b8', 
                    color: '#fff', border: 'none', cursor: file ? 'pointer' : 'not-allowed', fontWeight: 500 
                  }}
                >
                  Processar Importação
                </button>
              </div>
            </>
          )}

          {status === 'processing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Loader2 className="animate-spin" size={40} color="#0D7C3D" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                Processando arquivo com Inteligência Artificial...
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-c)', marginBottom: 20 }}>
                A IA está classificando secretaria, unidade e motivo. Por favor, aguarde.
              </div>
              
              {progress.total > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 10, height: 8, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ 
                    background: '#0D7C3D', 
                    height: '100%', 
                    width: `${Math.max(5, (progress.current / progress.total) * 100)}%`,
                    transition: 'width 0.3s'
                  }} />
                </div>
              )}
              
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {progress.total > 0 ? `Processando ${progress.current} de ${progress.total} registros` : 'Iniciando leitura do arquivo...'}
              </div>
            </div>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Importação concluída com sucesso!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-c)', marginBottom: 24 }}>
                {successCount} chamados foram processados e atualizados no banco de dados.
              </div>
              
              <button 
                onClick={onClose} 
                style={{ padding: '10px 24px', borderRadius: 8, background: '#0D7C3D', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, width: '100%' }}
              >
                Concluir
              </button>
            </div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <XCircle size={56} color="#dc2626" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Falha na importação
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-c)', marginBottom: 24, background: 'rgba(220, 38, 38, 0.1)', padding: 12, borderRadius: 8 }}>
                {errorMsg}
              </div>
              
              <button 
                onClick={() => setStatus('idle')} 
                style={{ padding: '10px 24px', borderRadius: 8, background: '#1e293b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, width: '100%' }}
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
