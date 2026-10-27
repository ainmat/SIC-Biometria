import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Building2, Users, Award, Shield, Download,
  Search, ExternalLink, Calendar, Clock, User, Check,
  ChevronRight, ArrowRight, UserCheck, Briefcase
} from 'lucide-react';
import { baixarExcel, baixarCSV } from '@/lib/exportar';
import { getLeaderBadge } from '../../utils/organogramaEngine';

function getAvatarColor(nome) {
  if (!nome) return { bg: 'rgba(100,116,139,0.12)', text: '#64748b' };
  const cores = [
    { bg: 'rgba(13, 124, 61, 0.15)', text: '#0D7C3D' },
    { bg: 'rgba(5, 150, 105, 0.15)', text: '#059669' },
    { bg: 'rgba(37, 99, 235, 0.15)', text: '#2563eb' },
    { bg: 'rgba(124, 58, 237, 0.15)', text: '#7c3aed' },
    { bg: 'rgba(217, 119, 6, 0.15)', text: '#d97706' },
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

export default function UnidadeDetalhesDrawer({
  node,
  onClose,
  onSelectNode,
}) {
  const [search, setSearch] = useState('');

  const members = node?.members || [];
  const leaders = node?.leaders || [];

  // Estatísticas da Unidade
  const stats = useMemo(() => {
    let com = node?.comissionados || 0;
    let ef = node?.efetivos || 0;
    let masc = 0, fem = 0, somaIdade = 0, qtdIdade = 0;

    if (members.length > 0) {
      com = 0;
      ef = 0;
      for (const m of members) {
        const isCom = (m.Des_Padrao_Adm || '').toLowerCase().includes('comiss');
        if (isCom) com++;
        else ef++;

        const s = (m.Sexo || '').toLowerCase();
        if (s.startsWith('m')) masc++;
        else if (s.startsWith('f')) fem++;

        if (m.Idade) {
          somaIdade += Number(m.Idade);
          qtdIdade++;
        }
      }
    }

    return {
      total: node?.totalServidores || members.length || (com + ef),
      com,
      ef,
      masc,
      fem,
      avgIdade: qtdIdade > 0 ? Math.round(somaIdade / qtdIdade) : '—',
    };
  }, [node, members]);

  // Filtragem de servidores na tabela
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase().trim();
    return members.filter(m =>
      (m.Nome_Funcionario || '').toLowerCase().includes(q) ||
      (m.Des_Cargo || '').toLowerCase().includes(q) ||
      String(m.Matricula || '').includes(q)
    );
  }, [members, search]);

  if (!node) return null;

  const levelColor = node.levelInfo?.color || '#0D7C3D';

  // Exportar dados da unidade
  const handleExport = (tipo = 'excel') => {
    const cabecalhos = ['Matrícula', 'Nome do Servidor', 'Cargo Oficial', 'Vínculo / Padrão', 'Regime', 'Sexo', 'Idade', 'Órgão de Lotação'];
    const linhas = members.map(m => [
      m.Matricula || '',
      m.Nome_Funcionario || '',
      m.Des_Cargo || '',
      m.Des_Padrao_Adm || '',
      m.Des_RegTrab || '',
      m.Sexo || '',
      m.Idade || '',
      node.name,
    ]);

    if (tipo === 'excel') {
      baixarExcel(cabecalhos, linhas, `Servidores_${node.code}_${node.name.slice(0, 20)}`);
    } else {
      baixarCSV(cabecalhos, linhas, `Servidores_${node.code}_${node.name.slice(0, 20)}`);
    }
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(3px)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: 500, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 500, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 580,
            height: '100%',
            background: 'var(--surface)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-c)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              background: 'var(--card-bg)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: levelColor,
                    background: node.levelInfo?.bg,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  {node.levelInfo?.label || 'Unidade'}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--sub)', fontWeight: 700 }}>
                  {node.code}
                </span>
              </div>

              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>
                {node.name}
              </h2>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid var(--border-c)',
                background: 'var(--surface)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Lideranças da Unidade */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sub)' }}>
                Quadro de Lideranças ({leaders.length})
              </h4>

              {leaders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leaders.map((lead, lIdx) => {
                    const badge = getLeaderBadge(lead.cargo);
                    const av = getAvatarColor(lead.nome);
                    return (
                      <div
                        key={lIdx}
                        style={{
                          background: 'var(--card-bg)',
                          borderRadius: 12,
                          border: '1px solid var(--border-c)',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: av.bg,
                            color: av.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 800,
                            flexShrink: 0,
                            border: `1px solid ${av.text}33`,
                          }}
                        >
                          {getInitials(lead.nome)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: badge.bg,
                                color: badge.color,
                              }}
                            >
                              {badge.label}
                            </span>
                            <span style={{ fontSize: 10, color: lead.situacao === 'Normal' ? '#059669' : '#d97706', fontWeight: 600 }}>
                              ● {lead.situacao}
                            </span>
                          </div>

                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {lead.nome}
                          </div>

                          <div style={{ fontSize: 11.5, fontWeight: 600, color: badge.color, marginTop: 1 }}>
                            {lead.cargo}
                          </div>

                          <div style={{ fontSize: 10.5, color: 'var(--sub)', marginTop: 4, display: 'flex', gap: 10 }}>
                            {lead.matricula && <span>Mat: <strong>{lead.matricula}</strong></span>}
                            {lead.padrao && <span>Padrão: <strong>{lead.padrao}</strong></span>}
                            {lead.vinculo && <span>Vínculo: <strong>{lead.vinculo}</strong></span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px dashed var(--border-c)',
                    fontSize: 12,
                    color: 'var(--sub)',
                    fontStyle: 'italic',
                  }}
                >
                  Nenhuma liderança formal cadastrada individualmente nesta unidade na planilha.
                </div>
              )}
            </div>

            {/* Métricas do Órgão */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sub)' }}>
                Dimensão do Quadro de Pessoal
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={metricBox}>
                  <span style={metricLabel}>Total Servidores</span>
                  <span style={metricVal}>{stats.total}</span>
                </div>
                <div style={metricBox}>
                  <span style={metricLabel}>Comissionados</span>
                  <span style={{ ...metricVal, color: '#f59e0b' }}>{stats.com}</span>
                </div>
                <div style={metricBox}>
                  <span style={metricLabel}>Efetivos</span>
                  <span style={{ ...metricVal, color: '#0D7C3D' }}>{stats.ef}</span>
                </div>
              </div>
            </div>

            {/* Sub-órgãos Vinculados */}
            {node.children && node.children.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sub)' }}>
                  Órgãos Subordinados ({node.children.length})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {node.children.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => onSelectNode(ch)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-c)',
                        background: 'var(--card-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                          {ch.name}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--sub)', fontFamily: 'monospace' }}>
                          {ch.code} • {ch.primaryLeader ? ch.primaryLeader.nome : 'Sem titular'}
                        </div>
                      </div>

                      <ChevronRight size={14} style={{ color: 'var(--sub)' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabela de Servidores Alocados */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sub)' }}>
                  Servidores Lotados {members.length > 0 ? `(${members.length})` : ''}
                </h4>

                {members.length > 0 && (
                  <button
                    onClick={() => handleExport('excel')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0D7C3D',
                      background: 'rgba(13, 124, 61, 0.1)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={11} />
                    Exportar Lista
                  </button>
                )}
              </div>

              {members.length > 0 ? (
                <div>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--sub)' }} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filtrar servidores desta unidade..."
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        borderRadius: 8,
                        border: '1px solid var(--border-c)',
                        background: 'var(--card-bg)',
                        color: 'var(--text)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border-c)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-c)', color: 'var(--sub)', fontSize: 10, textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Servidor</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Cargo</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Vínculo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-c)' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{m.Nome_Funcionario}</div>
                              <div style={{ fontSize: 10, color: 'var(--sub)' }}>Mat: {m.Matricula}</div>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text)' }}>
                              {m.Des_Cargo}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ fontSize: 9.5, padding: '2px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.04)' }}>
                                {m.Des_Padrao_Adm || 'Efetivo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px dashed var(--border-c)',
                    fontSize: 11.5,
                    color: 'var(--sub)',
                    textAlign: 'center',
                  }}
                >
                  Esta unidade possui <strong>{node.totalServidores}</strong> servidores cadastrados no organograma geral.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

const metricBox = {
  background: 'var(--card-bg)',
  borderRadius: 10,
  border: '1px solid var(--border-c)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const metricLabel = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--sub)',
};

const metricVal = {
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--text)',
};
