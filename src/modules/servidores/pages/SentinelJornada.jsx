import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { AlertTriangle, ShieldAlert, CheckCircle, Search, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');

// Parser de horários planejados
export function parseSchedule(str) {
  if (!str || typeof str !== 'string') return null;
  
  // Trata formatos comuns
  const parts = str.split('/');
  if (parts.length < 1) return null;

  const parsePeriod = (pStr) => {
    if (!pStr) return null;
    const clean = pStr.trim();
    // Ex: "08:00 - 13:00" ou "08:00 AS 13:00" ou "08:00 A 13:00"
    const cleanNorm = clean.replace(/AS|A/gi, '-');
    const timeMatch = cleanNorm.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
    if (!timeMatch) return null;
    
    const [, sh, sm, eh, em] = timeMatch;
    const startMins = parseInt(sh, 10) * 60 + parseInt(sm, 10);
    let endMins = parseInt(eh, 10) * 60 + parseInt(em, 10);
    
    // Se o horário final for menor que o inicial, assumimos que virou o dia (ex: 19:00 - 07:00)
    // EXCETO se o horário final for 00:00 (meia-noite), que representa o fim do dia
    if (endMins < startMins && endMins !== 0) {
      endMins += 24 * 60;
    }
    
    // Se o horário final for 00:00, representamos como 24:00 (1440 min) para cálculos matemáticos
    if (endMins === 0) {
      endMins = 24 * 60;
    }
    
    const duration = (endMins - startMins) / 60;
    return {
      raw: clean,
      start: `${sh}:${sm}`,
      end: `${eh}:${em}`,
      startMins,
      endMins,
      duration
    };
  };

  const period1 = parsePeriod(parts[0]);
  const period2 = parts[1] ? parsePeriod(parts[1]) : null;

  if (!period1) return null;

  // Verifica se é o padrão desmembrado na meia-noite (ex: XX:XX - 00:00 / 00:00 - YY:YY)
  const isSplitAtMidnight = 
    period2 && 
    period1.end === '00:00' && 
    period2.start === '00:00' && 
    period2.end !== '00:00';

  if (isSplitAtMidnight) {
    let p1StartMins = period1.startMins;
    let p2EndMins = period2.endMins;
    
    // Se o término do segundo período for menor que o início do primeiro (ex: 19:00 - 00:00 / 00:00 - 07:00), cruzou a meia-noite
    if (p2EndMins < p1StartMins) {
      p2EndMins += 24 * 60;
    }
    
    const totalDuration = (p2EndMins - p1StartMins) / 60;
    
    return {
      raw: str,
      period1: {
        ...period1,
        end: period2.end,
        endMins: p2EndMins,
        duration: totalDuration
      },
      period2: null, // sem segundo período real / sem intervalo previsto cadastrado
      totalDuration,
      interval: 0
    };
  }

  const hasPeriod2 = period2 && period2.raw !== '00:00 - 00:00' && period2.duration > 0;
  const totalDuration = period1.duration + (hasPeriod2 ? period2.duration : 0);

  let interval = 0;
  if (hasPeriod2) {
    let p2Start = period2.startMins;
    if (p2Start < period1.endMins) {
      p2Start += 24 * 60; // Virou o dia
    }
    interval = (p2Start - period1.endMins) / 60;
  }

  return {
    raw: str,
    period1,
    period2: hasPeriod2 ? period2 : null,
    totalDuration,
    interval
  };
}

// Analisa infrações baseadas na legislação municipal de Osasco (CLT / Estatuto)
export function analyzeCompliance(sched, s = {}) {
  if (!sched) return { ok: true, infractions: [] };
  
  const infractions = [];
  const { totalDuration, interval, period2 } = sched;

  // Detecta se é plantonista 12x36 conforme o regime cadastrado ou duração do horário previsto
  const is12x36 = 
    (s.Des_RegTrab && s.Des_RegTrab.toUpperCase().includes('12X36')) ||
    (s.Des_Horario && s.Des_Horario.toUpperCase().includes('12X36')) ||
    (Math.abs(totalDuration - 12) < 0.1);

  if (is12x36) {
    // ──────── REGIME 12x36 (Lei Complementar nº 346/2018 & Decreto nº 11.865/2018) ────────
    
    // 1. Limite de Plantão consecutivas (12h)
    if (totalDuration > 12.01) {
      infractions.push({
        type: 'jornada_limite_12x36',
        severity: 'critica',
        title: 'Plantão 12x36 excedente a 12h (LC 346/2018)',
        desc: `Plantão de ${totalDuration.toFixed(1)}h. Segundo a Lei Complementar municipal nº 346/2018, a escala consiste em exatamente 12 horas consecutivas de trabalho seguidas de 36 horas de descanso.`
      });
    }

    // 2. Intervalo intrajornada de 60 min (Decreto nº 11.865/2018)
    // O intervalo é computado de forma remunerada/inclusa dentro da jornada de 12 horas
    if (period2) {
      if (interval < 0.99) {
        infractions.push({
          type: 'intervalo_plantonista_insuficiente',
          severity: 'grave',
          title: 'Intervalo de plantão inferior a 60 min (Decreto 11.865/2018)',
          desc: `Intervalo previsto de apenas ${Math.round(interval * 60)} min. O Decreto nº 11.865/2018 estabelece o direito a 60 minutos de intervalo para refeição e descanso, inseridos dentro das 12h do plantão.`
        });
      }
    }
  } else {
    // ──────── REGIME PADRÃO (Estatuto dos Servidores - Lei nº 836/1969 & Decreto nº 14.549/2025) ────────
    
    // 1. Jornada Diária Excedente
    if (totalDuration > 10.01) {
      infractions.push({
        type: 'jornada_excedente_estatuto',
        severity: 'critica',
        title: 'Jornada excedente a 10h (Estatuto - Lei 836/1969)',
        desc: `Jornada total de ${totalDuration.toFixed(1)}h. O Estatuto (Lei nº 836/1969) limita a jornada diária a 8h normais, com máximo de 2h extraordinárias (limite absoluto de 10h).`
      });
    }

    // 2. Intervalo Intrajornada para jornadas > 6h (Decreto nº 14.549/2025)
    // Exceção: Cargos de PDI (Professor de Desenvolvimento Infantil) na Secretaria de Educação (SED)
    // com jornada de até 7h diárias não possuem obrigatoriedade de intervalo intrajornada.
    const isPdiEduca = 
      (s.SiglaSec === 'SED' || (s.Des_Secretaria && s.Des_Secretaria.toUpperCase().includes('EDUCA'))) &&
      (s.Des_Cargo && s.Des_Cargo.toUpperCase().includes('PDI'));
    
    const isExemptInterval = isPdiEduca && totalDuration <= 7.05;

    if (totalDuration > 6.01 && !isExemptInterval) {
      if (!period2) {
        infractions.push({
          type: 'sem_intervalo_decreto',
          severity: 'grave',
          title: 'Ausência de intervalo (Decreto 14.549/2025)',
          desc: 'Para jornadas de trabalho superiores a 6 horas diárias, é obrigatória a concessão de um intervalo de repouso e alimentação de no mínimo 1 hora e no máximo 2 horas, conforme Art. 4º do Decreto municipal nº 14.549/2025.'
        });
      } else if (interval < 0.99) {
        infractions.push({
          type: 'intervalo_decreto_insuficiente',
          severity: 'grave',
          title: 'Intervalo intrajornada insuficiente (Decreto 14.549/2025)',
          desc: `Intervalo previsto de apenas ${Math.round(interval * 60)} min. Jornadas superiores a 6h exigem no mínimo 1 hora de descanso, conforme Decreto municipal nº 14.549/2025.`
        });
      } else if (interval > 2.01) {
        infractions.push({
          type: 'intervalo_decreto_excessivo',
          severity: 'moderada',
          title: 'Intervalo intrajornada excessivo (Decreto 14.549/2025)',
          desc: `Intervalo previsto de ${interval.toFixed(1)}h. O intervalo para refeição e descanso não deve ser superior a 2 horas, conforme Art. 4º do Decreto municipal nº 14.549/2025.`
        });
      }
    }

  }

  return {
    ok: infractions.length === 0,
    infractions
  };
}

const inputSt = {
  background: 'rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: 7,
  padding: '7px 10px', color: 'var(--text)', fontSize: 12,
  outline: 'none',
};

const SEVERITY_COLORS = {
  critica: '#ef4444',
  grave: '#f97316',
  moderada: '#b45309',
};

const SEVERITY_LABELS = {
  critica: '🚨 Crítica',
  grave: '⚠️ Grave',
  moderada: '🔔 Moderada',
};

export default function SentinelJornada() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroSec, setFiltroSec] = useState('');
  const [filtroGrav, setFiltroGrav] = useState('');
  const [modalDetalhe, setModalDetalhe] = useState(null);

  useEffect(() => {
    fetchResumoServidores()
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Processa e analisa todos os horários dos servidores
  const analisados = useMemo(() => {
    return dados.map(s => {
      const parsed = parseSchedule(s.Des_Horario);
      const { ok, infractions } = analyzeCompliance(parsed, s);
      return {
        ...s,
        parsedHorario: parsed,
        ok,
        infractions,
        maxSeverity: infractions.reduce((acc, curr) => {
          if (curr.severity === 'critica' || acc === 'critica') return 'critica';
          if (curr.severity === 'grave' || acc === 'grave') return 'grave';
          return 'moderada';
        }, '')
      };
    });
  }, [dados]);

  // Lista apenas os que possuem alguma infração detectada
  const comInfrações = useMemo(() => {
    return analisados.filter(s => !s.ok);
  }, [analisados]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const total = analisados.length;
    const conformes = total - comInfrações.length;
    const infraCount = comInfrações.length;
    const totalHorariosDistintos = new Set(dados.map(s => s.Des_Horario).filter(Boolean)).size;

    // Contagem de popularidade de horários previstos
    const horariosContagem = {};
    dados.forEach(s => {
      const h = s.Des_Horario || 'Não informado';
      horariosContagem[h] = (horariosContagem[h] || 0) + 1;
    });

    const horariosOrdenados = Object.entries(horariosContagem)
      .map(([horario, count]) => ({ horario, count }))
      .sort((a, b) => b.count - a.count);

    const top5Horarios = horariosOrdenados.slice(0, 5);
    const topHorarioMaisPopular = horariosOrdenados[0] || { horario: 'Nenhum', count: 0 };
    
    // Contagem por tipo e gravidade
    const gravidades = { critica: 0, grave: 0, moderada: 0 };
    const tipos = { jornada_limite: 0, jornada_extra_excedida: 0, sem_intervalo: 0, intervalo_insuficiente: 0, intervalo_abusivo: 0, outros: 0 };
    
    comInfrações.forEach(s => {
      if (s.maxSeverity) gravidades[s.maxSeverity]++;
      s.infractions.forEach(inf => {
        if (tipos[inf.type] !== undefined) {
          tipos[inf.type]++;
        } else {
          tipos.outros++;
        }
      });
    });

    // Infrações por secretaria (Top 10)
    const bySec = {};
    comInfrações.forEach(s => {
      const sec = s.Des_Secretaria || 'Não informado';
      if (!bySec[sec]) bySec[sec] = { sec, count: 0, critica: 0, grave: 0, moderada: 0 };
      bySec[sec].count++;
      if (s.maxSeverity) bySec[sec][s.maxSeverity]++;
    });

    const secChart = Object.values(bySec)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      conformes,
      infraCount,
      totalHorariosDistintos,
      topHorarioMaisPopular,
      top5Horarios,
      horariosOrdenados,
      gravidades,
      tipos,
      secChart
    };
  }, [analisados, comInfrações, dados]);

  // Filtros aplicados sobre a listagem
  const filtrados = useMemo(() => {
    return comInfrações.filter(s => {
      if (filtroSec && s.Des_Secretaria !== filtroSec) return false;
      if (filtroGrav && s.maxSeverity !== filtroGrav) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        const nome = (s.Nome_Funcionario || '').toLowerCase();
        const mat = String(s.Matricula);
        const cargo = (s.Des_Cargo || '').toLowerCase();
        if (!nome.includes(b) && !mat.includes(b) && !cargo.includes(b)) return false;
      }
      return true;
    });
  }, [comInfrações, filtroSec, filtroGrav, busca]);

  const secretarias = useMemo(() => {
    return [...new Set(dados.map(s => s.Des_Secretaria).filter(Boolean))].sort();
  }, [dados]);

  // Dados do gráfico de rosca de tipo de gravidade
  const pieData = [
    { name: 'Crítica', value: stats.gravidades.critica, color: SEVERITY_COLORS.critica },
    { name: 'Grave', value: stats.gravidades.grave, color: SEVERITY_COLORS.grave },
    { name: 'Moderada', value: stats.gravidades.moderada, color: SEVERITY_COLORS.moderada }
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Painel Sentinel — Auditoria de Jornada</h1>
          <p>Varredura contínua de escalas previstas para detecção de passivos de CLT e Estatuto</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-c)', fontSize: 14 }}>Carregando dados dos servidores...</div>}
        {erro && <div style={{ padding: '14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>{erro}</div>}

        {!loading && !erro && dados.length > 0 && (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180, padding: '16px 20px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: '3px solid #0D7C3D' }}>
                <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Servidores Analisados</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>{fmt(stats.total)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>100% da folha cadastrada</div>
              </div>
              <div style={{ flex: 1, minWidth: 180, padding: '16px 20px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: '3px solid #a855f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Clock size={14} color="#a855f7" />
                  <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Horários Previstos</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#c084fc' }}>{fmt(stats.totalHorariosDistintos)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`Mais popular: ${stats.topHorarioMaisPopular.horario} (${fmt(stats.topHorarioMaisPopular.count)} servidores)`}>
                  Mais popular: <b>{stats.topHorarioMaisPopular.horario}</b> ({fmt(stats.topHorarioMaisPopular.count)} serv.)
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 180, padding: '16px 20px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: '3px solid #10b981' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Em Conformidade</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#047857' }}>{fmt(stats.conformes)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>{pct(stats.conformes, stats.total)}% do quadro regular</div>
              </div>
              <div style={{ flex: 1, minWidth: 180, padding: '16px 20px', borderRadius: 12, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderTop: '3px solid #ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <ShieldAlert size={14} color="#ef4444" />
                  <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Alertas de Passivo</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#dc2626' }}>{fmt(stats.infraCount)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4 }}>{pct(stats.infraCount, stats.total)}% com inconsistência</div>
              </div>
            </div>

            {/* Gráficos de Risco */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14, marginBottom: 16 }}>
              {/* Gráfico 1: Secretarias mais expostas */}
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Top 10 Secretarias por Alertas</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Número absoluto de escalas inconsistentes em cada pasta</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.secChart} margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <XAxis dataKey="sec" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(0, 10) + '...'} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{d.sec}</div>
                            <div style={{ color: '#ef4444' }}>Crítica: {d.critica}</div>
                            <div style={{ color: '#f97316' }}>Grave: {d.grave}</div>
                            <div style={{ color: '#b45309' }}>Moderada: {d.moderada}</div>
                            <div style={{ fontWeight: 700, marginTop: 6, color: '#15A050' }}>Total: {d.count}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="critica" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="grave" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="moderada" stackId="a" fill="#b45309" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico 2: Distribuição por Severidade */}
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Gravidade dos Alertas</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Classificação das jornadas irregulares</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => [fmt(v), 'Servidores']} />
                      <Legend formatter={v => <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Gráficos de Escalas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14, marginBottom: 16 }}>
              {/* Gráfico 3: Top 5 Horários mais populares */}
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Top 5 Horários Mais Utilizados</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 14 }}>Escalas planejadas com maior número de servidores vinculados</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.top5Horarios} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="horario" type="category" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} width={120} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} 
                        contentStyle={{ background: 'rgba(10,17,32,.97)', border: '1px solid rgba(0, 0, 0, 0.07)', borderRadius: 8, padding: '8px 12px' }}
                        itemStyle={{ color: '#15A050', fontSize: 12 }}
                        labelStyle={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}
                        formatter={v => [fmt(v), 'Servidores']} 
                      />
                      <Bar dataKey="count" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={18}>
                        {stats.top5Horarios.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#0D7C3D', '#0D7C3D', '#a855f7', '#d946ef', '#ec4899'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela/Lista de Popularidade de Escalas */}
              <div className="chart-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Ranking Geral de Escalas (Top 10)</div>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 12 }}>Distribuição total de servidores por escala prevista no cadastro</div>
                <div style={{ overflowY: 'auto', maxHeight: 200, paddingRight: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)', background: 'rgba(0,0,0,.15)' }}>
                        <th style={{ padding: '6px 8px', color: 'var(--muted-c)', textAlign: 'left', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Pos.</th>
                        <th style={{ padding: '6px 8px', color: 'var(--muted-c)', textAlign: 'left', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Horário Previsto</th>
                        <th style={{ padding: '6px 8px', color: 'var(--muted-c)', textAlign: 'right', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Servidores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.horariosOrdenados.slice(0, 10).map((h, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                          <td style={{ padding: '6px 8px', color: i === 0 ? '#b45309' : '#64748b', fontWeight: 700 }}>#{i + 1}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 600 }}>{h.horario}</td>
                          <td style={{ padding: '6px 8px', color: '#15A050', textAlign: 'right', fontWeight: 700 }}>{fmt(h.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Listagem de Alertas */}
            <div className="chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Listagem de Irregularidades Detectadas</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>Visualização de todas as escalas fora da conformidade legal</div>
                </div>
                <span style={{ fontSize: 11, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)', padding: '4px 10px', borderRadius: 6, color: '#dc2626', fontWeight: 600 }}>
                  {fmt(filtrados.length)} pendência(s) encontrada(s)
                </span>
              </div>

              {/* Filtros da tabela */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: 7, padding: '0 10px', flex: 1, minWidth: 200 }}>
                  <Search size={14} color="#64748b" style={{ marginRight: 8 }} />
                  <input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar por nome, matrícula ou cargo..."
                    style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, outline: 'none', width: '100%', padding: '7px 0' }}
                  />
                </div>
                <select value={filtroSec} onChange={e => setFiltroSec(e.target.value)} style={{ ...inputSt, minWidth: 160 }}>
                  <option value="">Todas as Secretarias</option>
                  {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filtroGrav} onChange={e => setFiltroGrav(e.target.value)} style={{ ...inputSt, minWidth: 140 }}>
                  <option value="">Todas as Gravidades</option>
                  <option value="critica">🚨 Crítica</option>
                  <option value="grave">⚠️ Grave</option>
                  <option value="moderada">🔔 Moderada</option>
                </select>
              </div>

              {/* Tabela de Inconformidades */}
              {filtrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-c)' }}>
                  Nenhuma jornada irregular encontrada com os filtros aplicados.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,.15)' }}>
                        {['Matrícula', 'Servidor', 'Secretaria', 'Horário Previsto', 'Duração', 'Intervalo', 'Severidade', 'Alertas'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-c)', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map(s => {
                        const cor = SEVERITY_COLORS[s.maxSeverity] || '#64748b';
                        const dur = s.parsedHorario?.totalDuration || 0;
                        const hasInterval = s.parsedHorario?.period2;
                        const iv = s.parsedHorario?.interval || 0;

                        return (
                          <tr key={s.Matricula} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#15A050', fontWeight: 700 }}>{s.Matricula}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{s.Nome_Funcionario}</div>
                              <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 1 }}>{s.Des_Cargo}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--muted-c)' }}>{s.SiglaSec || s.Des_Secretaria}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>{s.Des_Horario}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{dur.toFixed(1)}h</td>
                            <td style={{ padding: '10px 12px', color: hasInterval ? '#b45309' : '#ef4444' }}>
                              {hasInterval ? `${Math.round(iv * 60)} min` : 'Inexistente'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}15`, padding: '2px 7px', borderRadius: 5, border: `1px solid ${cor}35` }}>
                                {SEVERITY_LABELS[s.maxSeverity]}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <button
                                onClick={() => setModalDetalhe(s)}
                                style={{ background: 'rgba(13,124,61,.12)', border: '1px solid rgba(13,124,61,.25)', borderRadius: 5, padding: '4px 10px', color: '#15A050', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                              >
                                Ver Detalhes
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de Detalhe de Infração */}
      {modalDetalhe && (
        <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) setModalDetalhe(null); }}>
          <div className="chamado-modal" style={{ maxWidth: 500 }}>
            <div className="chamado-modal-header">
              <div className="chamado-modal-title">Detalhes da Jornada — {modalDetalhe.Nome_Funcionario}</div>
              <button className="chamado-modal-close" onClick={() => setModalDetalhe(null)}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>Matrícula</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#15A050', fontFamily: 'monospace' }}>{modalDetalhe.Matricula}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>Vínculo</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{modalDetalhe.Des_RegTrab}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>Cargo</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{modalDetalhe.Des_Cargo}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>Secretaria</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{modalDetalhe.Des_Secretaria}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.07)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Escala Prevista</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{modalDetalhe.Des_Horario}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--muted-c)' }}>
                  <span>Jornada Total: <b>{modalDetalhe.parsedHorario?.totalDuration.toFixed(1)}h</b></span>
                  <span>Intervalo: <b>{modalDetalhe.parsedHorario?.period2 ? `${modalDetalhe.parsedHorario.interval.toFixed(1)}h` : 'Nenhum'}</b></span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Inconformidades CLT / RJSP ({modalDetalhe.infractions.length})</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {modalDetalhe.infractions.map((inf, idx) => {
                  const cor = SEVERITY_COLORS[inf.severity];
                  return (
                    <div key={idx} style={{ display: 'flex', gap: 12, background: 'rgba(0,0,0,.15)', borderLeft: `4px solid ${cor}`, padding: '12px 14px', borderRadius: '0 8px 8px 0' }}>
                      <AlertTriangle size={16} color={cor} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {inf.title} <span style={{ fontSize: 9, color: cor, fontWeight: 800, marginLeft: 6 }}>({inf.severity.toUpperCase()})</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 4, lineHeight: 1.5 }}>{inf.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setModalDetalhe(null)}
                  style={{ padding: '8px 18px', borderRadius: 7, background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
