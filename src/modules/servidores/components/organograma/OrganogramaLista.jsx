import { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, Building2, Users, Award,
  Shield, ExternalLink, ArrowUpDown, User
} from 'lucide-react';
import { getLeaderBadge } from '../../utils/organogramaEngine';

export default function OrganogramaLista({
  rootNode,
  expandedIds,
  onToggleExpand,
  onSelectNode,
  selectedNodeId,
  searchHighlightIds = new Set(),
}) {
  const [sortBy, setSortBy] = useState('hierarchy'); // 'hierarchy' | 'members' | 'name' | 'leaders'

  // Aplanar a árvore respeitando expansão
  const flatNodes = useMemo(() => {
    if (!rootNode) return [];

    const result = [];
    function traverse(node, depth = 0) {
      result.push({ ...node, depth });
      if (node.children && node.children.length > 0 && expandedIds.has(node.id)) {
        node.children.forEach(c => traverse(c, depth + 1));
      }
    }
    traverse(rootNode, 0);

    if (sortBy === 'members') {
      return [...result].sort((a, b) => (b.totalServidores || 0) - (a.totalServidores || 0));
    }
    if (sortBy === 'leaders') {
      return [...result].sort((a, b) => (b.aggregateLeaders || 0) - (a.aggregateLeaders || 0));
    }
    if (sortBy === 'name') {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [rootNode, expandedIds, sortBy]);

  if (!rootNode) return null;

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--border-c)',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
      }}
    >
      {/* Table Sorting Toolbar */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.015)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          Estrutura Linear da Secretaria de Saúde ({flatNodes.length} órgãos listados)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--sub)', fontWeight: 600 }}>Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid var(--border-c)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="hierarchy">Ordem Hierárquica Oficial (Decimal)</option>
            <option value="members">Maior Efetivo de Servidores</option>
            <option value="leaders">Maior Quantidade de Líderes</option>
            <option value="name">Ordem Alfabética</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-c)', color: 'var(--sub)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Unidade / Órgão da Saúde</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Código</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Titular Principal</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Co-Lideranças</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Total Servidores</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Líderes</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {flatNodes.map((node) => {
              const hasChildren = node.children && node.children.length > 0;
              const isExpanded = expandedIds.has(node.id);
              const isSelected = selectedNodeId === node.id;
              const isMatch = searchHighlightIds.has(node.id);
              const levelColor = node.levelInfo?.color || '#0D7C3D';
              const primary = node.primaryLeader;
              const badge = primary ? getLeaderBadge(primary.cargo) : null;
              const secondaries = node.secondaryLeaders || [];

              return (
                <tr
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  style={{
                    borderBottom: '1px solid var(--border-c)',
                    background: isSelected
                      ? 'rgba(13, 124, 61, 0.08)'
                      : isMatch
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isMatch) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Unidade + Indentation */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: `${node.depth * 20}px` }}>
                      {hasChildren ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node.id);
                          }}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 5,
                            border: '1px solid var(--border-c)',
                            background: 'var(--card-bg)',
                            color: 'var(--text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-c)' }} />
                        </div>
                      )}

                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: levelColor,
                          flexShrink: 0,
                        }}
                      />

                      <span
                        style={{
                          fontWeight: node.depth <= 1 ? 700 : 600,
                          color: 'var(--text)',
                          fontSize: node.depth <= 1 ? 13 : 12.5,
                        }}
                      >
                        {node.name}
                      </span>
                    </div>
                  </td>

                  {/* Código */}
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--sub)' }}>
                    {node.code}
                  </td>

                  {/* Titular */}
                  <td style={{ padding: '12px 16px' }}>
                    {primary ? (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>
                          {primary.nome}
                        </div>
                        <div style={{ fontSize: 10.5, color: badge?.color || 'var(--muted-c)', fontWeight: 600 }}>
                          {primary.cargo}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Co-Lideranças */}
                  <td style={{ padding: '12px 16px' }}>
                    {secondaries.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {secondaries.slice(0, 2).map((s, idx) => (
                          <span key={idx} style={{ fontSize: 11, color: 'var(--text)' }}>
                            • <strong>{s.nome}</strong> ({s.cargo.includes('SUPERVISOR') ? 'Superv.' : 'Gerente'})
                          </span>
                        ))}
                        {secondaries.length > 2 && (
                          <span style={{ fontSize: 10, color: 'var(--sub)' }}>
                            +{secondaries.length - 2} outros
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--sub)' }}>—</span>
                    )}
                  </td>

                  {/* Total Servidores */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.03)',
                        fontWeight: 700,
                        color: 'var(--text)',
                      }}
                    >
                      {node.totalServidores || 0}
                    </span>
                  </td>

                  {/* Líderes */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(37, 99, 235, 0.08)',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {node.aggregateLeaders || node.leaders?.length || 0}
                    </span>
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(node);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-c)',
                        background: 'var(--card-bg)',
                        color: 'var(--text)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ExternalLink size={11} />
                      Detalhes
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
