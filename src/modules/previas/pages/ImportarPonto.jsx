import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useCallback, useRef, Fragment } from 'react';
import { AlertTriangle, CheckCircle, Upload, XCircle } from 'lucide-react';
import { parseArquivoPonto, extrairCompetencia } from '@/modules/previas/utils/parsePontoBiometria';
import {
  fetchMapaServidores,
  verificarImportacaoExistente,
  deletarCompetenciaPonto,
  inserirMarcacoes,
  publicarResumosPorSecretaria,
} from '@/modules/previas/services/pontoService';
import { MESES } from '@/modules/previas/constants';
import { useAuth } from '@/contexts/AuthContext';

const fmt = n => Math.round(n).toLocaleString('pt-BR');

const CARD = {
  background: 'rgba(0,0,0,.02)',
  border: '1px solid rgba(0,0,0,.07)',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 16,
};
const SEL = {
  padding: '7px 10px', borderRadius: 8,
  background: 'var(--card-bg)', border: '1px solid rgba(0, 0, 0, 0.06)',
  color: 'var(--text)', fontSize: 12, outline: 'none',
};
const BTN = (cor = '#0D7C3D', disabled = false) => ({
  padding: '9px 22px', borderRadius: 8,
  background: disabled ? 'rgba(0, 0, 0, 0.03)' : cor,
  border: 'none', color: disabled ? '#475569' : '#fff',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'opacity .15s',
});

function KPI({ label, val, sub, cor }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: '12px 16px', borderRadius: 10, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0, 0, 0, 0.04)', borderTop: `3px solid ${cor}` }}>
      <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, total, label }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-c)', marginBottom: 5 }}>
        <span>{label}</span>
        <span>{fmt(value)} / {fmt(total)} ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#0D7C3D', borderRadius: 4, transition: 'width .2s' }} />
      </div>
    </div>
  );
}

// tabela colapsável de secretaria/unidade (reutilizada em etapa 1 e etapa 3)
function TabelaSecretarias({ porSecretaria, expandidas, setExpandidas }) {
  if (!porSecretaria?.length) return null;
  return (
    <div style={CARD}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
        Distribuição por Secretaria ({porSecretaria.length})
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Sigla', 'Secretaria', 'Servidores', 'Marcações', ''].map(h => (
              <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {porSecretaria.map(s => (
            <Fragment key={s.sigla}>
              <tr
                onClick={() => setExpandidas(prev => { const n = new Set(prev); n.has(s.sigla) ? n.delete(s.sigla) : n.add(s.sigla); return n; })}
                style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)', cursor: s.unidades.length > 0 ? 'pointer' : 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '7px 10px', color: '#15A050', fontWeight: 700 }}>{s.sigla}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text)' }}>{s.nome}</td>
                <td style={{ padding: '7px 10px', color: '#10b981', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.servidores)}</td>
                <td style={{ padding: '7px 10px', color: '#0D7C3D', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.marcacoes)}</td>
                <td style={{ padding: '7px 10px', color: 'var(--muted-c)', fontSize: 10 }}>
                  {s.unidades.length > 0 ? (expandidas.has(s.sigla) ? '▲' : `▼ ${s.unidades.length} unid.`) : ''}
                </td>
              </tr>
              {expandidas.has(s.sigla) && s.unidades.map(u => (
                <tr key={u.nome} style={{ background: 'rgba(13,124,61,.03)', borderBottom: '1px solid rgba(0,0,0,.02)' }}>
                  <td style={{ padding: '5px 10px 5px 22px', color: 'var(--muted-c)', fontSize: 10 }}>↳</td>
                  <td style={{ padding: '5px 10px', color: 'var(--muted-c)', fontSize: 11 }}>{u.nome}</td>
                  <td style={{ padding: '5px 10px', color: '#10b981', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmt(u.servidores)}</td>
                  <td style={{ padding: '5px 10px', color: '#0D7C3D', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmt(u.marcacoes)}</td>
                  <td />
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ETAPAS = ['Arquivo', 'Análise', 'Revisão', 'Importado'];

// ─── Conteúdo reutilizável (sem wrapper de página) ───────────────────────────
export function ImportarPontoContent() {
  const { sessao } = useAuth();
  const token = sessao?.token;
  const [etapa,       setEtapa]       = useState(0);
  const [arquivo,     setArquivo]     = useState(null);
  const [competencia, setCompetencia] = useState('');
  const [compDetec,   setCompDetec]   = useState('');
  const [parsed,      setParsed]      = useState(null);
  const [join,        setJoin]        = useState(null);
  const [existente,   setExistente]   = useState(null);
  const [carregando,  setCarregando]  = useState('');
  const [progresso,   setProgresso]   = useState({ v: 0, t: 0 });
  const [resultado,   setResultado]   = useState(null);
  const [erro,        setErro]        = useState('');
  const [expandidas,  setExpandidas]  = useState(new Set());
  const [conflitos,   setConflitos]   = useState([]);
  const dropRef = useRef();

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] ?? e.target?.files?.[0];
    if (!f) return;
    selecionarArquivo(f);
  }, []);

  function selecionarArquivo(f) {
    setArquivo(f);
    setErro('');
    setExpandidas(new Set());
    setConflitos([]);
    const comp = extrairCompetencia(f.name);
    if (comp) {
      // arquivo IMP052026 → competência da folha = arquivo + 1 mês
      let m = parseInt(comp.mes, 10) + 1;
      let a = parseInt(comp.ano, 10);
      if (m === 13) { m = 1; a += 1; }
      const folha = `${a}-${String(m).padStart(2, '0')}`;
      setCompetencia(folha);          // campo editável: competência da folha (Jun/2026)
      setCompDetec(comp.competencia); // exibição: mês do arquivo (Mai/2026)
    } else {
      setCompetencia('');
      setCompDetec('');
    }
    setParsed(null); setJoin(null); setExistente(null); setResultado(null); setEtapa(0);
  }

  async function analisar() {
    if (!arquivo || !competencia) return;
    setCarregando('Lendo arquivo...'); setErro('');
    try {
      const texto = await arquivo.text();
      const p = parseArquivoPonto(texto);
      setParsed(p);

      // ── Detectar conflitos: mesma (matricula, data) com 2+ registros tipo1 ──
      const dataMap = {};
      p.tipo1.forEach(r => {
        const key = `${r.matricula}|${r.data}`;
        if (!dataMap[key]) dataMap[key] = [];
        dataMap[key].push(r.codigo);
      });
      const conflitosDetec = Object.entries(dataMap)
        .filter(([, cods]) => cods.length >= 2)
        .map(([key, cods]) => {
          const [matricula, data] = key.split('|');
          return { matricula, data, codigos: cods };
        })
        .sort((a, b) => a.matricula.localeCompare(b.matricula) || a.data.localeCompare(b.data));
      setConflitos(conflitosDetec);

      // ── Join com banco ──────────────────────────────────────────────────────
      setCarregando('Buscando servidores do banco...');
      const mapa = await fetchMapaServidores(p.matriculas);

      const orfasArq    = p.matriculas.filter(m => !mapa.has(m));
      const enriquecidos = p.matriculas
        .filter(m => mapa.has(m))
        .map(m => ({ matricula: m, ...mapa.get(m) }));

      // ── Classificação por secretaria/unidade ────────────────────────────────
      const secMap = {};
      enriquecidos.forEach(e => {
        const sigla = e.SiglaSec || '—';
        if (!secMap[sigla]) secMap[sigla] = { sigla, nome: e.Des_Secretaria || 'Sem secretaria', servidores: new Set(), marcacoes: 0, unidades: {} };
        secMap[sigla].servidores.add(e.matricula);
        const unid = e.Des_LocalTrab || 'Sem unidade';
        if (!secMap[sigla].unidades[unid]) secMap[sigla].unidades[unid] = { nome: unid, servidores: new Set(), marcacoes: 0 };
        secMap[sigla].unidades[unid].servidores.add(e.matricula);
      });
      p.tipo1.forEach(r => {
        const info = mapa.get(r.matricula);
        if (!info) return;
        const sigla = info.SiglaSec || '—';
        const unid  = info.Des_LocalTrab || 'Sem unidade';
        if (!secMap[sigla]) return;
        secMap[sigla].marcacoes++;
        if (secMap[sigla].unidades[unid]) secMap[sigla].unidades[unid].marcacoes++;
      });
      const porSecretaria = Object.values(secMap)
        .map(s => ({
          sigla: s.sigla, nome: s.nome,
          servidores: s.servidores.size, marcacoes: s.marcacoes,
          unidades: Object.values(s.unidades)
            .map(u => ({ nome: u.nome, servidores: u.servidores.size, marcacoes: u.marcacoes }))
            .sort((a, b) => b.servidores - a.servidores),
        }))
        .sort((a, b) => b.servidores - a.servidores);

      setJoin({ enriquecidos, orfasArq, porSecretaria });

      const ex = await verificarImportacaoExistente(competencia);
      setExistente(ex);
      setEtapa(1);
    } catch (e) {
      setErro(e.message || 'Erro ao analisar o arquivo.');
    } finally {
      setCarregando('');
    }
  }

  async function importar() {
    if (!parsed || !competencia) return;
    setCarregando('Apagando competência anterior...'); setErro('');
    try {
      await deletarCompetenciaPonto(competencia, token);

      // Map rápido a partir dos enriquecidos (já calculado na análise)
      const enriquecidosMap = new Map(join.enriquecidos.map(e => [e.matricula, e]));

      setCarregando('Importando ocorrências em previas_frequencia...');
      setProgresso({ v: 0, t: parsed.tipo1.length });
      const nMarcacoes = await inserirMarcacoes(
        parsed.tipo1, competencia, arquivo.name, enriquecidosMap, token,
        (v, t) => setProgresso({ v, t }),
      );

      setCarregando('Publicando resumos por secretaria...');
      const nPublicadas = await publicarResumosPorSecretaria(parsed.tipo1, competencia, enriquecidosMap, token);

      setResultado({
        competencia, arquivo: arquivo.name,
        marcacoes: nMarcacoes,
        publicadas: nPublicadas,
        servidores: join.enriquecidos.length,
        orfas: join.orfasArq.length,
        rejeitadas: parsed.rejeitadas.length,
        secretarias: join.porSecretaria?.length ?? 0,
        conflitos: conflitos.length,
      });
      setEtapa(3);
    } catch (e) {
      setErro(e.message || 'Erro durante a importação.');
    } finally {
      setCarregando('');
    }
  }

  function reiniciar() {
    setExpandidas(new Set()); setConflitos([]);
    setEtapa(0); setArquivo(null); setParsed(null); setJoin(null);
    setResultado(null); setCompetencia(''); setCompDetec('');
  }

  const compLabel = (c) => {
    if (!c) return '—';
    const [y, m] = c.split('-');
    return `${MESES?.[Number(m) - 1] ?? m}/${y}`;
  };
  const fmtData = iso => iso ? iso.split('-').reverse().join('/') : '—';

  return (
    <>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        {ETAPAS.map((e, i) => (
          <div key={e} style={{ display: 'flex', alignItems: 'center', flex: i < ETAPAS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: i < etapa ? '#0D7C3D' : i === etapa ? 'rgba(13,124,61,.2)' : 'rgba(0, 0, 0, 0.03)', color: i <= etapa ? '#15A050' : '#334155', border: `1.5px solid ${i <= etapa ? '#0D7C3D' : 'rgba(0, 0, 0, 0.05)'}` }}>
                {i < etapa ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: i === etapa ? '#1e293b' : '#475569' }}>{e}</span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: i < etapa ? '#0D7C3D' : 'rgba(0, 0, 0, 0.04)', margin: '0 10px' }} />
            )}
          </div>
        ))}
      </div>

      {/* Erro global */}
      {erro && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626', fontSize: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{erro}</span>
        </div>
      )}

      {/* ── Etapa 0: selecionar arquivo ── */}
      {etapa === 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Selecionar arquivo</div>

          <div
            ref={dropRef}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => document.getElementById('ponto-file-input').click()}
            style={{ border: '2px dashed rgba(13,124,61,.35)', borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s', marginBottom: 20 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(13,124,61,.7)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(13,124,61,.35)'}
          >
            <Upload size={28} color="#0D7C3D" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: 'var(--muted-c)', marginBottom: 4 }}>
              {arquivo
                ? <><b style={{ color: 'var(--text)' }}>{arquivo.name}</b> ({(arquivo.size / 1024).toFixed(0)} KB)</>
                : 'Clique ou arraste o arquivo .txt aqui'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text)' }}>IMP052026_unificado.txt · largura fixa, 29 char/linha, CRLF</div>
            <input id="ponto-file-input" type="file" accept=".txt" style={{ display: 'none' }} onChange={e => selecionarArquivo(e.target.files[0])} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Competência</label>
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} style={{ ...SEL, width: 160 }} />
            </div>
            {compDetec && (
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 16, lineHeight: 1.8 }}>
                <div>Arquivo detectado: <b style={{ color: 'var(--muted-c)' }}>{compLabel(compDetec)}</b></div>
                <div>Competência da folha: <b style={{ color: '#15A050' }}>{compLabel(competencia)}</b></div>
              </div>
            )}
          </div>

          <button
            onClick={analisar}
            disabled={!arquivo || !competencia || !!carregando}
            style={BTN('#0D7C3D', !arquivo || !competencia || !!carregando)}
          >
            {carregando || 'Analisar arquivo'}
          </button>
        </div>
      )}

      {/* ── Etapa 1: análise ── */}
      {etapa === 1 && parsed && join && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <KPI label="Total de linhas"      val={fmt(parsed.resumo.totalLinhas)}       sub={arquivo?.name}               cor="#0D7C3D" />
            <KPI label="Marcações (Tipo 1)"   val={fmt(parsed.resumo.tipo1)}             sub="com data válida"             cor="#10b981" />
            <KPI label="Totais (Tipo 2)"      val={fmt(parsed.resumo.tipo2)}             sub="consolidação mensal"         cor="#0D7C3D" />
            <KPI label="Servidores distintos" val={fmt(parsed.resumo.servidores)}        sub="matrículas únicas"           cor="#0D7C3D" />
            <KPI label="Secretarias"          val={fmt(join.porSecretaria?.length ?? 0)} sub="identificadas no banco"      cor="#f59e0b" />
            <KPI label="Linhas rejeitadas"    val={fmt(parsed.resumo.rejeitadas)}        sub="formato inválido"            cor={parsed.resumo.rejeitadas > 0 ? '#ef4444' : '#10b981'} />
            {conflitos.length > 0 && (
              <KPI label="Conflitos de data"  val={fmt(conflitos.length)}                sub="2+ ocorrências no mesmo dia" cor="#ef4444" />
            )}
          </div>

          {/* Join result */}
          <div style={CARD}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Resultado do join com funcionarios_infos</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: join.orfasArq.length > 0 ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} color="#10b981" />
                <span style={{ fontSize: 12, color: 'var(--muted-c)' }}><b style={{ color: 'var(--text)' }}>{fmt(join.enriquecidos.length)}</b> matrículas casadas</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <span style={{ fontSize: 12, color: 'var(--muted-c)' }}><b style={{ color: join.orfasArq.length > 0 ? '#b45309' : '#1e293b' }}>{fmt(join.orfasArq.length)}</b> matrículas órfãs (no arquivo, ausentes no banco)</span>
              </div>
            </div>
            {join.orfasArq.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                  Matrículas sem correspondência — serão importadas sem enriquecimento
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {join.orfasArq.slice(0, 80).map(m => (
                    <span key={m} style={{ fontSize: 10, color: 'var(--muted-c)', background: 'rgba(0, 0, 0, 0.02)', padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(0,0,0,.07)' }}>{m}</span>
                  ))}
                  {join.orfasArq.length > 80 && <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>…e mais {fmt(join.orfasArq.length - 80)}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Conflitos de data */}
          {conflitos.length > 0 && (
            <div style={{ ...CARD, border: '1px solid rgba(239,68,68,.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={15} color="#ef4444" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                  Ocorrências Duplas na Mesma Data ({fmt(conflitos.length)})
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 12 }}>
                Mesma matrícula com 2+ registros no mesmo dia — ex: falta + atraso, falta + DSR. Verifique com o setor de ponto antes de importar.
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Matrícula', 'Data', 'Códigos no arquivo'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conflitos.slice(0, 50).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#b45309', fontWeight: 700 }}>{c.matricula}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--muted-c)' }}>{fmtData(c.data)}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                        {c.codigos.map((cod, j) => (
                          <span key={j} style={{ marginRight: 8, color: '#dc2626' }}>{cod}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {conflitos.length > 50 && (
                <div style={{ fontSize: 11, color: 'var(--muted-c)', padding: '8px 10px' }}>…e mais {fmt(conflitos.length - 50)} conflitos</div>
              )}
            </div>
          )}

          {/* Distribuição por Secretaria */}
          <TabelaSecretarias
            porSecretaria={join.porSecretaria}
            expandidas={expandidas}
            setExpandidas={setExpandidas}
          />

          {/* Linhas rejeitadas */}
          {parsed.rejeitadas.length > 0 && (
            <div style={CARD}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>Linhas rejeitadas ({fmt(parsed.rejeitadas.length)})</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Linha', 'Motivo', 'Conteúdo'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rejeitadas.slice(0, 30).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                        <td style={{ padding: '5px 10px', fontSize: 11, color: '#dc2626' }}>{r.nLinha}</td>
                        <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--muted-c)' }}>{r.motivo}</td>
                        <td style={{ padding: '5px 10px', fontSize: 10, color: 'var(--muted-c)', fontFamily: 'monospace' }}>{r.raw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rejeitadas.length > 30 && (
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', padding: '8px 10px' }}>…e mais {fmt(parsed.rejeitadas.length - 30)} rejeições</div>
                )}
              </div>
            </div>
          )}

          {/* Aviso reimportação */}
          {existente && (existente.marcacoes > 0 || existente.totais > 0) && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#b45309', fontSize: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                A competência <b>{compLabel(competencia)}</b> já possui {fmt(existente.marcacoes)} marcações e {fmt(existente.totais)} totais importados.
                A importação irá <b>substituir</b> esses dados. ⚠️ CONFIRMAR política com o setor.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEtapa(0)} style={BTN('rgba(0, 0, 0, 0.04)')}>Voltar</button>
            <button onClick={() => setEtapa(2)} style={BTN('#0D7C3D')}>Revisar e importar →</button>
          </div>
        </>
      )}

      {/* ── Etapa 2: revisão final ── */}
      {etapa === 2 && parsed && (
        <div style={CARD}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Resumo da importação</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {[
              ['Arquivo',            arquivo?.name,                                         '#0D7C3D'],
              ['Competência',        compLabel(competencia),                                '#0D7C3D'],
              ['Ocorrências (Tipo 1)', `${fmt(parsed.resumo.tipo1)} registros`,             '#10b981'],
              ['Secretarias',         `${fmt(join?.porSecretaria?.length ?? 0)} identificadas`, '#0D7C3D'],
              ['Servidores casados', `${fmt(join?.enriquecidos?.length ?? 0)}`,             '#0D7C3D'],
              ['Matrículas órfãs',  `${fmt(join?.orfasArq?.length ?? 0)}`,                 join?.orfasArq?.length > 0 ? '#f59e0b' : '#10b981'],
              ['Conflitos de data',  `${fmt(conflitos.length)}`,                            conflitos.length > 0 ? '#ef4444' : '#10b981'],
              ['Linhas rejeitadas',  `${fmt(parsed.resumo.rejeitadas)}`,                    parsed.resumo.rejeitadas > 0 ? '#ef4444' : '#10b981'],
            ].map(([k, v, cor]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted-c)', background: 'rgba(13,124,61,.05)', border: '1px solid rgba(13,124,61,.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
            Política: a competência será <b style={{ color: '#15A050' }}>apagada e substituída</b> antes da inserção (idempotente).
            Registros com código desconhecido são armazenados brutos.
          </div>

          {carregando ? (
            <div>
              <div style={{ fontSize: 12, color: '#15A050', marginBottom: 8 }}>{carregando}</div>
              <ProgressBar value={progresso.v} total={progresso.t} label="Marcações" />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEtapa(1)} style={BTN('rgba(0, 0, 0, 0.04)')}>Voltar</button>
              <button onClick={importar} style={BTN('#10b981')}>Confirmar e importar</button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 3: resultado ── */}
      {etapa === 3 && resultado && (
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <CheckCircle size={22} color="#10b981" />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Importação concluída — {compLabel(resultado.competencia)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <KPI label="Ocorrências"           val={fmt(resultado.marcacoes)}          sub="em previas_frequencia"      cor="#10b981" />
            <KPI label="Sec. publicadas"      val={fmt(resultado.publicadas ?? 0)}    sub="em previas_publicadas"      cor="#0D7C3D" />
            <KPI label="Servidores casados"   val={fmt(resultado.servidores)}         sub="com funcionarios_infos"     cor="#0D7C3D" />
            <KPI label="Secretarias"          val={fmt(resultado.secretarias ?? 0)}   sub="identificadas"              cor="#f59e0b" />
            <KPI label="Matrículas órfãs"     val={fmt(resultado.orfas)}              sub="sem correspondência"        cor={resultado.orfas > 0 ? '#f59e0b' : '#10b981'} />
            <KPI label="Conflitos de data"    val={fmt(resultado.conflitos ?? 0)}     sub="2+ ocorrências/dia"         cor={resultado.conflitos > 0 ? '#ef4444' : '#10b981'} />
            <KPI label="Linhas rejeitadas"    val={fmt(resultado.rejeitadas)}         sub="formato inválido"           cor={resultado.rejeitadas > 0 ? '#ef4444' : '#10b981'} />
          </div>

          {resultado.orfas > 0 && (
            <div style={{ fontSize: 12, color: '#b45309', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              {fmt(resultado.orfas)} matrículas não encontradas em funcionarios_infos — confirmar com RH se são temporários ou cadastro desatualizado.
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 20 }}>
            Arquivo: <b style={{ color: 'var(--muted-c)' }}>{resultado.arquivo}</b> · Tabelas: previas_frequencia, previas_publicadas
          </div>

          <TabelaSecretarias
            porSecretaria={join?.porSecretaria}
            expandidas={expandidas}
            setExpandidas={setExpandidas}
          />

          <button onClick={reiniciar} style={BTN('#0D7C3D')}>
            Importar outro arquivo
          </button>
        </div>
      )}
    </>
  );
}

// ─── Página standalone (rota /previas/ponto mantida para compatibilidade) ─────
export default function ImportarPonto() {
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
        <ImportarPontoContent />
      </div>
    </div>
  );
}
