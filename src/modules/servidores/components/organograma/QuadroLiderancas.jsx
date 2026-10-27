import { useState, useMemo } from 'react';
import {
  Award, Shield, Building2, Users, Search,
  ExternalLink, UserCheck, Star, Briefcase,
  Download, Filter, ChevronRight, CheckCircle2,
  Calendar, Layers
} from 'lucide-react';
import { getLeaderBadge, getLeaderRank } from '../../utils/organogramaEngine';
import { baixarExcel, baixarCSV } from '@/lib/exportar';

function getAvatarColor(nome) {
  if (!nome) return { bg: 'rgba(100,116,139,0.12)', text: '#64748b' };
  const cores = [
    { bg: 'rgba(13, 124, 61, 0.15)', text: '#0D7C3D' },
    { bg: 'rgba(5, 150, 105, 0.15)', text: '#059669' },
    { bg: 'rgba(37, 99, 235, 0.15)', text: '#2563eb' },
    { bg: 'rgba(124, 58, 237, 0.15)', text: '#7c3aed' },
    { bg: 'rgba(217, 119, 6, 0.15)', text: '#d97706' },
    { bg: 'rgba(2, 132, 199, 0.15)', text: '#0284c7' },
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

export default function QuadroLiderancas({
  liderancas = [],
  onSelectNode,
  onFocusLeaderInTree,
  allUnitsMap = new Map(),
}) {
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterEixo, setFilterEixo] = useState('ALL');
  const [search, setSearch] = useState('');

  // Contagem por categoria
  const counts = useMemo(() => {
    let diretores = 0, gerentes = 0, supervisores = 0, outros = 0;
    liderancas.forEach(l => {
      if (l.roleCategory === 'DIRETOR') diretores++;
      else if (l.roleCategory === 'GERENTE') gerentes++;
      else if (l.roleCategory === 'SUPERVISOR') supervisores++;
      else outros++;
    });
    return { diretores, gerentes, supervisores, outros, total: liderancas.length };
  }, [liderancas]);

  // Filtragem
  const filtered = useMemo(() => {
    return liderancas.filter(l => {
      // Filtro de Papel
      if (filterRole === 'DIRETORES' && l.roleCategory !== 'DIRETOR') return false;
      if (filterRole === 'GERENTES' && l.roleCategory !== 'GERENTE') return false;
      if (filterRole === 'SUPERVISORES' && l.roleCategory !== 'SUPERVISOR') return false;

      // Filtro de Eixo
      if (filterEixo !== 'ALL') {
        const sigla = l.siglaCargo || '';
        const local = l.localTrabalho || '';
        const unit = l.unitCode || '';
        if (!sigla.includes(filterEixo) && !local.includes(filterEixo) && !unit.includes(filterEixo)) {
          return false;
        }
      }

      // Busca texto
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const mNome = (l.nome || '').toLowerCase().includes(q);
        const mCargo = (l.cargo || '').toLowerCase().includes(q);
        const mLocal = (l.localTrabalho || '').toLowerCase().includes(q);
        const mMat = String(l.matricula || '').includes(q);
        const mCpf = String(l.cpf || '').includes(q);
        if (!mNome && !mCargo && !mLocal && !mMat && !mCpf) return false;
      }

      return true;
    }).sort((a, b) => {
      const rA = getLeaderRank(a.cargo);
      const rB = getLeaderRank(b.cargo);
      if (rA !== rB) return rA - rB;
      return a.nome.localeCompare(b.nome);
    });
  }, [liderancas, filterRole, filterEixo, search]);

  // Exportar Lideranças Filtradas
  const handleExport = (tipo = 'excel') => {
    const cabecalhos = [
      'Matrícula', 'Nome Completo', 'Cargo Oficial', 'Categoria',
      'Padrão Salarial', 'Situação', 'Código Unidade', 'Local de Trabalho',
      'Vínculo Funcional', 'Sigla Cargo', 'CPF'
    ];
    const linhas = filtered.map(l => [
      l.matricula || '',
      l.nome || '',
      l.cargo || '',
      l.roleCategory || '',
      l.padrao || '',
      l.situacao || '',
      l.unitCode || '',
      l.localTrabalho || '',
      l.vinculo || '',
      l.siglaCargo || '',
      l.cpf || '',
    ]);

    if (tipo === 'excel') {
      baixarExcel(cabecalhos, linhas, `Quadro_Liderancas_Saude_${new Date().toISOString().slice(0, 10)}`);
    } else {
      baixarCSV(cabecalhos, linhas, `Quadro_Liderancas_Saude_${new Date().toISOString().slice(0, 10)}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Filter and Actions Toolbar */}
      <div
        style={{
          background: 'var(--surface)',
          padding: '14px 18px',
          borderRadius: 14,
          border: '1px solid var(--border-c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Chips de Cargo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterRole('ALL')}
            style={chipStyle(filterRole === 'ALL', '#0D7C3D')}
          >
            Todas as Lideranças ({counts.total})
          </button>
          <button
            onClick={() => setFilterRole('DIRETORES')}
            style={chipStyle(filterRole === 'DIRETORES', '#2563eb')}
          >
            Diretores ({counts.diretores})
          </button>
          <button
            onClick={() => setFilterRole('GERENTES')}
            style={chipStyle(filterRole === 'GERENTES', '#7c3aed')}
          >
            Gerentes ({counts.gerentes})
          </button>
          <button
            onClick={() => setFilterRole('SUPERVISORES')}
            style={chipStyle(filterRole === 'SUPERVISORES', '#d97706')}
          >
            Supervisores ({counts.supervisores})
          </button>
        </div>

        {/* Eixo Selector & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={filterEixo}
            onChange={(e) => setFilterEixo(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-c)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Todos os Eixos da Saúde</option>
            <option value="58-3">58-3 Atenção Primária (UBSs)</option>
            <option value="58-4">58-4 Atenção Secundária (Policlínicas/CAPS)</option>
            <option value="58-5">58-5 Urgência e Emergência (UPAs/PSs/SAMU)</option>
            <option value="58-6">58-6 Hospital Maternidade Amador Aguiar</option>
            <option value="58-7">58-7 Gestão, Vigilância e Farmácia</option>
          </select>

          <div style={{ position: 'relative', width: 220 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--sub)',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar líder, cargo ou UBS..."
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

          <button
            onClick={() => handleExport('excel')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-c)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Exportar listagem filtrada para Excel"
          >
            <Download size={13} />
            Exportar XLS
          </button>
        </div>
      </div>

      {/* Resultados Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--sub)' }}>
        <span>
          Mostrando <strong>{filtered.length}</strong> de <strong>{liderancas.length}</strong> lideranças da Saúde
        </span>
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: '#0D7C3D', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
          >
            Limpar busca
          </button>
        )}
      </div>

      {/* Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
        }}
      >
        {filtered.map((lead) => {
          const badge = getLeaderBadge(lead.cargo);
          const avatar = getAvatarColor(lead.nome);
          const unitNode = allUnitsMap.get(lead.unitCode);

          return (
            <div
              key={lead.id}
              style={{
                background: 'var(--surface)',
                borderRadius: 14,
                border: '1px solid var(--border-c)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                {/* Header: Role Badge + Situacao */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: badge.bg,
                      color: badge.color,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Award size={11} />
                    {badge.label}
                  </span>

                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: lead.situacao === 'Normal' ? '#059669' : '#d97706',
                    }}
                  >
                    ● {lead.situacao}
                  </span>
                </div>

                {/* Identity: Avatar + Nome */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: avatar.bg,
                      color: avatar.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                      border: `1px solid ${avatar.text}33`,
                    }}
                  >
                    {getInitials(lead.nome)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--text)',
                        lineHeight: 1.3,
                      }}
                    >
                      {lead.nome}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: badge.color,
                        marginTop: 2,
                        lineHeight: 1.3,
                      }}
                    >
                      {lead.cargo}
                    </div>
                  </div>
                </div>

                {/* Workplace / Location Details */}
                <div
                  style={{
                    background: 'var(--card-bg)',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-c)',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 600 }}>
                    <Building2 size={12} style={{ color: 'var(--sub)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.localTrabalho}>
                      {lead.localTrabalho || 'Gabinete / Administração da Saúde'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--sub)', fontSize: 10.5, marginTop: 2 }}>
                    <span>Mat: <strong>{lead.matricula}</strong></span>
                    {lead.padrao && <span>Padrão: <strong>{lead.padrao}</strong></span>}
                    {lead.unitCode && <span style={{ fontFamily: 'monospace' }}>{lead.unitCode}</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingTop: 6,
                  borderTop: '1px solid var(--border-c)',
                }}
              >
                {onFocusLeaderInTree && (
                  <button
                    onClick={() => onFocusLeaderInTree(lead)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0D7C3D',
                      background: 'rgba(13, 124, 61, 0.08)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: '0.15s',
                    }}
                  >
                    <Layers size={12} />
                    Ver no Organograma
                  </button>
                )}

                {unitNode && onSelectNode && (
                  <button
                    onClick={() => onSelectNode(unitNode)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--sub)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <ExternalLink size={11} />
                    Unidade
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--muted-c)',
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px dashed var(--border-c)',
          }}
        >
          Nenhuma liderança encontrada com os filtros informados.
        </div>
      )}
    </div>
  );
}

function chipStyle(active, activeColor) {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    border: active ? `1px solid ${activeColor}` : '1px solid var(--border-c)',
    background: active ? `${activeColor}15` : 'var(--card-bg)',
    color: active ? activeColor : 'var(--text)',
    transition: 'all 0.15s ease',
  };
}
