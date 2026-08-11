import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileText, CheckCircle, AlertCircle, Users, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ImportarServidores() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ text: '', percent: 0 });
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [preview, setPreview] = useState([]);

  const handleFile = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setErro(null);
      setResultado(null);
      readPreview(selected);
    }
  };

  const normalizeKey = (k) => String(k || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const KEY_MAP = {
    'MATRICULA': 'Matricula',
    'NOMEFUNCIONARIO': 'Nome_Funcionario',
    'NOMECIVIL': 'Nome_Funcionario',
    'CONTRATO': 'Con',
    'DESCRICAOCARGO': 'Des_Cargo',
    'CARGO': 'CdCargo',
    'DESCRICAOSECRETARIA': 'Des_Secretaria',
    'SECRETARIA': 'CdSecret',
    'DESCRICAOLOCALTRABALHO': 'Des_LocalTrab',
    'DATANASCIMENTO': 'DtNascimento', // We will map it and compute Idade below
    'SEXO': 'Sexo',
    'DESCRICAOCONTRATO': 'Des_Contrato'
  };

  const parseSheetIntelligently = (ws) => {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
    let headerIdx = -1;
    
    // Procura o cabeçalho nas primeiras 20 linhas
    for(let i=0; i < Math.min(20, rows.length); i++) {
       const row = rows[i] || [];
       const strRow = row.map(c => normalizeKey(c));
       if (strRow.includes('MATRICULA') || strRow.includes('NOME') || strRow.includes('NOMEFUNCIONARIO')) {
         headerIdx = i;
         break;
       }
    }
    
    if (headerIdx === -1) {
      throw new Error("Não foi possível encontrar a linha de cabeçalho (esperávamos a coluna Matrícula ou Nome).");
    }
    
    const headers = rows[headerIdx];
    const canonicalHeaders = headers.map(h => {
       const norm = normalizeKey(h);
       return KEY_MAP[norm] || h; 
    });

    const dataRows = [];
    for(let i = headerIdx + 1; i < rows.length; i++) {
       const row = rows[i];
       if (!row || row.length === 0) continue;
       const obj = {};
       let hasData = false;
       for(let j=0; j < canonicalHeaders.length; j++) {
          if (row[j] !== undefined && row[j] !== '') {
             obj[canonicalHeaders[j]] = row[j];
             hasData = true;
          }
       }
       
       // Computar a Idade se tivermos a data de nascimento
       if (obj['DtNascimento']) {
          let dateStr = String(obj['DtNascimento']).trim();
          let birthDate = null;
          
          if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                  // DD/MM/YYYY
                  birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
              }
          } else if (!isNaN(dateStr)) {
              // Raw Excel serial date
              birthDate = new Date((Number(dateStr) - (25567 + 2)) * 86400 * 1000);
          }
          
          if (birthDate && !isNaN(birthDate.getTime())) {
              const ageDifMs = Date.now() - birthDate.getTime();
              const ageDate = new Date(ageDifMs);
              obj['Idade'] = Math.abs(ageDate.getUTCFullYear() - 1970);
          }
       }
       
       if(hasData) dataRows.push(obj);
    }
    return dataRows;
  };

  const readPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = parseSheetIntelligently(ws);
        setPreview(data.slice(0, 5));
      } catch (err) {
        setErro(err.message || 'Erro ao ler prévia do arquivo.');
        setPreview([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setProgress({ text: 'Iniciando leitura do arquivo...', percent: 0 });
    setErro(null);
    setResultado(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        console.log("1. Arquivo carregado na memória. Iniciando parse do Excel (isso pode demorar para arquivos grandes)...");
        setProgress({ text: 'Extraindo dados da planilha (isso pode demorar para arquivos grandes)...', percent: 5 });
        
        // Dá um respiro para a UI atualizar o state antes de travar no XLSX.read
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        
        console.log("2. Excel interpretado. Extraindo dados da aba principal...");
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        console.log("3. Buscando cabeçalhos e mapeando colunas...");
        const rawData = parseSheetIntelligently(ws);

        if (rawData.length === 0) {
          throw new Error("A planilha está vazia ou não tem dados válidos abaixo do cabeçalho.");
        }
        
        console.log(`4. Sucesso! Encontrados ${rawData.length} servidores. Iniciando envio em lotes...`);

        // Enviar os dados em blocos menores para não estourar o limite de 8s (Timeout)
        const BATCH_SIZE = 250;
        let processados = 0;
        const totalBatches = Math.ceil(rawData.length / BATCH_SIZE);
        
        setProgress({ text: `Preparando envio de ${rawData.length} servidores...`, percent: 10 });
        
        for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
           const lote = rawData.slice(i, i + BATCH_SIZE);
           const loteNum = Math.floor(i/BATCH_SIZE) + 1;
           
           console.log(`Enviando lote ${loteNum}... (${lote.length} registros)`);
           setProgress({ 
             text: `Sincronizando banco de dados... (Lote ${loteNum} de ${totalBatches})`, 
             percent: 10 + Math.floor((loteNum / totalBatches) * 75) 
           });
           
           const { error } = await supabase.rpc('sincronizar_servidores_batch_rpc', {
             p_servidores: lote
           });
           if (error) throw error;
           processados += lote.length;
        }

        console.log("5. Lotes enviados. Inativando servidores ausentes...");
        setProgress({ text: 'Lotes enviados! Finalizando e inativando servidores antigos...', percent: 85 });
        
        const matriculas_ativas = rawData.map(r => ({ Matricula: r.Matricula, Con: r.Con }));
        
        const { data: inativados, error: errInativar } = await supabase.rpc('inativar_servidores_ausentes_rpc', {
           p_matriculas: matriculas_ativas
        });
        
        if (errInativar) throw errInativar;

        console.log("6. Resposta do banco:", { processados, inativados });
        
        setResultado({
           sucesso: true,
           total_processados: processados,
           total_inativados: inativados
        });
        setFile(null);
        setPreview([]);

      } catch (err) {
        console.error("Erro na importação:", err);
        setErro(err.message || 'Erro ao processar a importação.');
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setErro('Falha ao ler o arquivo selecionado.');
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Importar Servidores</h1>
          <p>Atualize o quadro de funcionários enviando a nova planilha gerada pelo RH.</p>
        </div>
      </div>

      <div className="content" style={{ maxWidth: 900, margin: '0 auto' }}>
        
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 12, padding: 30, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={20} color="#0D7C3D" />
            Upload da Planilha de Servidores Ativos
          </h2>
          
          <p style={{ fontSize: 13, color: 'var(--muted-c)', marginBottom: 25, lineHeight: 1.5 }}>
            Selecione o arquivo Excel (.xlsx) ou CSV contendo <strong>apenas os servidores ativos hoje</strong>. 
            O sistema atualizará os cargos/secretarias, adicionará os novos contratados e marcará como <strong>INATIVOS</strong> 
            aqueles que constam no banco de dados mas <strong>não</strong> estão neste novo arquivo.
          </p>

          <div style={{
            border: '2px dashed var(--border-c)',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            background: 'rgba(0,0,0,0.01)',
            position: 'relative'
          }}>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFile}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer'
              }}
            />
            
            {file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <FileText size={40} color="#0D7C3D" />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                <button style={{
                  marginTop: 15, padding: '8px 20px', borderRadius: 8,
                  background: 'var(--surface)', border: '1px solid var(--border-c)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>
                  Trocar Arquivo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Download size={40} color="var(--muted-c)" style={{ opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Arraste a planilha aqui ou clique para selecionar
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>
                  Suporta arquivos .xlsx e .csv
                </div>
              </div>
            )}
          </div>

          {preview.length > 0 && !loading && !resultado && (
            <div style={{ marginTop: 25 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-c)', marginBottom: 10, textTransform: 'uppercase' }}>
                Pré-visualização (Primeiras 5 linhas)
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-c)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-c)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Matrícula</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Nome</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Cargo</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Secretaria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-c)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--muted-c)' }}>{row.Matricula || row.matricula || '-'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 600 }}>{row.Nome_Funcionario || row.nome || '-'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted-c)' }}>{row.Des_Cargo || row.cargo || '-'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted-c)' }}>{row.Des_Secretaria || row.secretaria || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={handleImport}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 8,
                    background: '#0D7C3D', color: '#fff', border: 'none',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Users size={16} />
                  Iniciar Sincronização
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0,0,0,0.01)', borderRadius: 12, border: '1px solid var(--border-c)', marginTop: 20 }}>
              <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700, marginBottom: 15 }}>
                {progress.text || 'Processando Sincronização...'}
              </div>
              
              <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'var(--border-c)', borderRadius: 4, margin: '0 auto', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  background: '#0D7C3D', 
                  width: `${progress.percent}%`,
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
              
              <div style={{ fontSize: 13, color: 'var(--muted-c)', marginTop: 15, fontWeight: 600 }}>
                {progress.percent}% Concluído
              </div>
            </div>
          )}

          {erro && (
            <div style={{ marginTop: 20, padding: 15, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', gap: 10, color: '#dc2626' }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Erro na Importação</div>
                <div style={{ fontSize: 12 }}>{erro}</div>
              </div>
            </div>
          )}

          {resultado && (
            <div style={{ marginTop: 20, padding: 20, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, display: 'flex', gap: 15, color: '#059669' }}>
              <CheckCircle size={28} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Sincronização Concluída com Sucesso!</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  • <strong>{resultado.total_processados}</strong> servidores recebidos (inseridos ou atualizados).<br/>
                  • <strong>{resultado.total_inativados}</strong> servidores foram marcados como INATIVOS por não constarem na lista atual.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
