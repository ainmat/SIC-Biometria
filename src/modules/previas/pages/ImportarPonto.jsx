import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Upload, FileText, Users, XCircle } from 'lucide-react';
import { parseArquivoPonto, extrairCompetencia } from '@/modules/previas/utils/parsePontoBiometria';
import {
  fetchMapaServidores,
  verificarImportacaoExistente,
  deletarCompetenciaPonto,
  inserirMarcacoes,
  inserirTotais,
} from '@/modules/previas/services/pontoService';
import { MESES } from '@/modules/previas/constants';

const fmt = n => Math.round(n).toLocaleString('pt-BR');

const CARD = {
  background: 'rgba(255,255,255,.02)',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 16,
};
const SEL = {
  padding: '7px 10px', borderRadius: 8,
  background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,.1)',
  color: '#f1f5f9', fontSize: 12, outline: 'none',
};
const BTN = (cor = '#6366f1', disabled = false) => ({
  padding: '9px 22px', borderRadius: 8,
  background: disabled ? 'rgba(255,255,255,.05)' : cor,
  border: 'none', color: disabled ? '#475569' : '#fff',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'opacity .15s',
});

function Badge({ cor, label }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}15`, padding: '2px 7px', borderRadius: 5, border: `1px solid ${cor}40` }}>
      {label}
    </span>
  );
}

function KPI({ label, val, sub, cor }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderTop: `3px solid ${cor}` }}>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, total, label }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
        <span>{label}</span>
        <span>{fmt(value)} / {fmt(total)} ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#6366f1', borderRadius: 4, transition: 'width .2s' }} />
      </div>
    </div>
  );
}

// ─── Etapas ──────────────────────────────────────────────────────────────────
const ETAPAS = ['Arquivo', 'Análise', 'Revisão', 'Importado'];

export default function ImportarPonto() {
  const [etapa,       setEtapa]       = useState(0); // 0=arquivo 1=analise 2=revisao 3=resultado
  const [arquivo,     setArquivo]     = useState(null);
  const [competencia, setCompetencia] = useState('');
  const [compDetec,   setCompDetec]   = useState('');   // detectada do nome
  const [parsed,      setParsed]      = useState(null);
  const [join,        setJoin]        = useState(null);  // { enriquecidos, orfasArq, orfasBD }
  const [existente,   setExistente]   = useState(null);  // { marcacoes, totais }
  const [carregando,  setCarregando]  = useState('');
  const [progresso,   setProgresso]   = useState({ v: 0, t: 0 });
  const [resultado,   setResultado]   = useState(null);
  const [erro,        setErro]        = useState('');
  const dropRef = useRef();

  // ── drag and drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] ?? e.target?.files?.[0];
    if (!f) return;
    selecionarArquivo(f);
  }, []);

  function selecionarArquivo(f) {
    setArquivo(f);
    setErro('');
    const comp = extrairCompetencia(f.name);
    if (comp) {
      setCompetencia(comp.competencia);
      setCompDetec(comp.competencia);
    } else {
      setCompetencia('');
      setCompDetec('');
    }
    setParsed(null);
    setJoin(null);
    setExistente(null);
    setResultado(null);
    setEtapa(0);
  }

  // ── etapa 1: parsear ───────────────────────────────────────────────────────
  async function analisar() {
    if (!arquivo || !competencia) return;
    setCarregando('Lendo arquivo...');
    setErro('');
    try {
      const texto = await arquivo.text();
      const p = parseArquivoPonto(texto);
      setParsed(p);

      // join com banco
      setCarregando('Buscando servidores do banco...');
      const mapa = await fetchMapaServidores();

      const orfasArq = p.matriculas.filter(m => !mapa.has(m));
      const enriquecidos = p.matriculas
        .filter(m => mapa.has(m))
        .map(m => ({ matricula: m, ...mapa.get(m) }));

      // Matrículas no banco mas não no arquivo (apenas primeiros 50 para exibição)
      // Não bloqueante — só informativo
      setJoin({ enriquecidos, orfasArq });

      // verificar existente
      const ex = await verificarImportacaoExistente(competencia);
      setExistente(ex);

      setEtapa(1);
    } catch (e) {
      setErro(e.message || 'Erro ao analisar o arquivo.');
    } finally {
      setCarregando('');
    }
  }

  // ── etapa 2: confirmar revisão ─────────────────────────────────────────────
  function confirmar() { setEtapa(2); }

  // ── etapa 3: importar ──────────────────────────────────────────────────────
  async function importar() {
    if (!parsed || !competencia) return;
    setCarregando('Apagando competência anterior...');
    setErro('');
    try {
      await deletarCompetenciaPonto(competencia);

      setCarregando('Importando marcações diárias...');
      setProgresso({ v: 0, t: parsed.tipo1.length });
      const nMarcacoes = await inserirMarcacoes(
        parsed.tipo1, competencia, arquivo.name,
        (v, t) => setProgresso({ v, t }),
      );

      setCarregando('Importando totais mensais...');
      const nTotais = await inserirTotais(parsed.tipo2, competencia, arquivo.name);

      setResultado({
        competencia,
        arquivo: arquivo.name,
        marcacoes: nMarcacoes,
        totais: nTotais,
        servidores: join.enriquecidos.length,
        orfas: join.orfasArq.length,
        rejeitadas: parsed.rejeitadas.length,
      });
      setEtapa(3);
    } catch (e) {
      setErro(e.message || 'Erro durante a importação.');
    } finally {
      setCarregando('');
    }
  }

  const compLabel = (c) => {
    if (!c) return '—';
    const [y, m] = c.split('-');
    return `${MESES?.[Number(m) - 1] ?? m}/${y}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Importar Ponto Biométrico</h1>
          <p>Arquivo unificado de prévia de ponto — largura fixa, 29 caracteres por linha</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
          {ETAPAS.map((e, i) => (
            <div key={e} style={{ display: 'flex', alignItems: 'center', flex: i < ETAPAS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: i < etapa ? '#6366f1' : i === etapa ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.05)', color: i <= etapa ? '#a5b4fc' : '#334155', border: `1.5px solid ${i <= etapa ? '#6366f1' : 'rgba(255,255,255,.08)'}` }}>
                  {i < etapa ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: i === etapa ? '#f1f5f9' : '#475569' }}>{e}</span>
              </div>
              {i < ETAPAS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: i < etapa ? '#6366f1' : 'rgba(255,255,255,.06)', margin: '0 10px' }} />
              )}
            </div>
          ))}
        </div>

        {/* Erro global */}
        {erro && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{erro}</span>
          </div>
        )}

        {/* ── Etapa 0: selecionar arquivo ────────────────────────────────────── */}
        {etapa === 0 && (
          <div style={CARD}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>Selecionar arquivo</div>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => document.getElementById('ponto-file-input').click()}
              style={{ border: '2px dashed rgba(99,102,241,.35)', borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s', marginBottom: 20 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.7)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.35)'}
            >
              <Upload size={28} color="#6366f1" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                {arquivo ? <><b style={{ color: '#f1f5f9' }}>{arquivo.name}</b> ({(arquivo.size / 1024).toFixed(0)} KB)</> : 'Clique ou arraste o arquivo .txt aqui'}
              </div>
              <div style={{ fontSize: 11, color: '#334155' }}>IMP052026_unificado.txt · largura fixa, 29 char/linha, CRLF</div>
              <input id="ponto-file-input" type="file" accept=".txt" style={{ display: 'none' }} onChange={e => selecionarArquivo(e.target.files[0])} />
            </div>

            {/* Competência */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Competência</label>
                <input
                  type="month"
                  value={competencia}
                  onChange={e => setCompetencia(e.target.value)}
                  style={{ ...SEL, width: 160 }}
                />
              </div>
              {compDetec && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>
                  Detectada do nome: <b style={{ color: '#a5b4fc' }}>{compLabel(compDetec)}</b>
                </div>
              )}
            </div>

            <button
              onClick={analisar}
              disabled={!arquivo || !competencia || !!carregando}
              style={BTN('#6366f1', !arquivo || !competencia || !!carregando)}
            >
              {carregando || 'Analisar arquivo'}
            </button>
          </div>
        )}

        {/* ── Etapa 1: análise ───────────────────────────────────────────────── */}
        {etapa === 1 && parsed && join && (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <KPI label="Total de linhas"    val={fmt(parsed.resumo.totalLinhas)} sub={arquivo?.name}           cor="#6366f1" />
              <KPI label="Marcações (Tipo 1)" val={fmt(parsed.resumo.tipo1)}       sub="com data válida"          cor="#10b981" />
              <KPI label="Totais (Tipo 2)"    val={fmt(parsed.resumo.tipo2)}       sub="consolidação mensal"      cor="#3b82f6" />
              <KPI label="Servidores distintos" val={fmt(parsed.resumo.servidores)} sub="matrículas únicas"       cor="#8b5cf6" />
              <KPI label="Linhas rejeitadas"  val={fmt(parsed.resumo.rejeitadas)}  sub="formato inválido"         cor={parsed.resumo.rejeitadas > 0 ? '#ef4444' : '#10b981'} />
            </div>

            {/* Join result */}
            <div style={CARD}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>Resultado do join com funcionarios_infos</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}><b style={{ color: '#f1f5f9' }}>{fmt(join.enriquecidos.length)}</b> matrículas casadas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}><b style={{ color: join.orfasArq.length > 0 ? '#fbbf24' : '#f1f5f9' }}>{fmt(join.orfasArq.length)}</b> matrículas órfãs (no arquivo, ausentes no banco)</span>
                </div>
              </div>

              {join.orfasArq.length > 0 && (
                <div style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                    Matrículas sem correspondência — serão importadas sem enriquecimento
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {join.orfasArq.slice(0, 80).map(m => (
                      <span key={m} style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,.04)', padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,.07)' }}>{m}</span>
                    ))}
                    {join.orfasArq.length > 80 && (
                      <span style={{ fontSize: 10, color: '#475569' }}>…e mais {fmt(join.orfasArq.length - 80)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Linhas rejeitadas */}
            {parsed.rejeitadas.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>Linhas rejeitadas ({fmt(parsed.rejeitadas.length)})</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Linha', 'Motivo', 'Conteúdo'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rejeitadas.slice(0, 30).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: '#f87171' }}>{r.nLinha}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: '#94a3b8' }}>{r.motivo}</td>
                          <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>{r.raw}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rejeitadas.length > 30 && (
                    <div style={{ fontSize: 11, color: '#475569', padding: '8px 10px' }}>…e mais {fmt(parsed.rejeitadas.length - 30)} rejeições</div>
                  )}
                </div>
              </div>
            )}

            {/* Reimportação */}
            {existente && (existente.marcacoes > 0 || existente.totais > 0) && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>
                  A competência <b>{compLabel(competencia)}</b> já possui {fmt(existente.marcacoes)} marcações e {fmt(existente.totais)} totais importados.
                  A importação irá <b>substituir</b> esses dados. ⚠️ CONFIRMAR política com o setor.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEtapa(0)} style={BTN('rgba(255,255,255,.06)')}>Voltar</button>
              <button onClick={confirmar} style={BTN('#6366f1')}>Revisar e importar →</button>
            </div>
          </>
        )}

        {/* ── Etapa 2: revisão final ─────────────────────────────────────────── */}
        {etapa === 2 && parsed && (
          <div style={CARD}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>Resumo da importação</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                ['Arquivo',             arquivo?.name,                                    '#6366f1'],
                ['Competência',         compLabel(competencia),                           '#6366f1'],
                ['Marcações (Tipo 1)',  `${fmt(parsed.resumo.tipo1)} registros`,          '#10b981'],
                ['Totais (Tipo 2)',     `${fmt(parsed.resumo.tipo2)} registros`,          '#3b82f6'],
                ['Servidores casados',  `${fmt(join?.enriquecidos?.length ?? 0)}`,        '#8b5cf6'],
                ['Matrículas órfãs',   `${fmt(join?.orfasArq?.length ?? 0)}`,            join?.orfasArq?.length > 0 ? '#f59e0b' : '#10b981'],
                ['Linhas rejeitadas',  `${fmt(parsed.resumo.rejeitadas)}`,               parsed.resumo.rejeitadas > 0 ? '#ef4444' : '#10b981'],
              ].map(([k, v, cor]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#475569', background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
              Política: a competência será <b style={{ color: '#a5b4fc' }}>apagada e substituída</b> antes da inserção (idempotente).
              Códigos de significado desconhecido serão armazenados brutos sem interpretação.
            </div>

            {carregando ? (
              <div>
                <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 8 }}>{carregando}</div>
                <ProgressBar value={progresso.v} total={progresso.t} label="Marcações" />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEtapa(1)} style={BTN('rgba(255,255,255,.06)')}>Voltar</button>
                <button onClick={importar} style={BTN('#10b981')}>Confirmar e importar</button>
              </div>
            )}
          </div>
        )}

        {/* ── Etapa 3: resultado ────────────────────────────────────────────── */}
        {etapa === 3 && resultado && (
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <CheckCircle size={22} color="#10b981" />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                Importação concluída — {compLabel(resultado.competencia)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <KPI label="Marcações importadas" val={fmt(resultado.marcacoes)} sub="Tipo 1 — diárias"    cor="#10b981" />
              <KPI label="Totais importados"     val={fmt(resultado.totais)}    sub="Tipo 2 — mensais"    cor="#3b82f6" />
              <KPI label="Servidores casados"    val={fmt(resultado.servidores)} sub="com funcionarios_infos" cor="#8b5cf6" />
              <KPI label="Matrículas órfãs"      val={fmt(resultado.orfas)}     sub="sem correspondência" cor={resultado.orfas > 0 ? '#f59e0b' : '#10b981'} />
              <KPI label="Linhas rejeitadas"     val={fmt(resultado.rejeitadas)} sub="formato inválido"   cor={resultado.rejeitadas > 0 ? '#ef4444' : '#10b981'} />
            </div>

            {resultado.orfas > 0 && (
              <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                {fmt(resultado.orfas)} matrículas do arquivo não foram encontradas em funcionarios_infos. Registradas sem enriquecimento — confirmar com o RH se são servidores temporários ou com cadastro desatualizado.
              </div>
            )}

            <div style={{ fontSize: 11, color: '#475569', marginBottom: 20 }}>
              Arquivo: <b style={{ color: '#94a3b8' }}>{resultado.arquivo}</b> · Tabelas: ponto_previa_marcacoes, ponto_previa_totais
            </div>

            <button
              onClick={() => { setEtapa(0); setArquivo(null); setParsed(null); setJoin(null); setResultado(null); setCompetencia(''); setCompDetec(''); }}
              style={BTN('#6366f1')}
            >
              Importar outro arquivo
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
