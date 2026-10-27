import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown, ChevronRight, Users, Award, Shield,
  ExternalLink, Building2, User, Sparkles, CheckCircle2,
  AlertCircle, Briefcase, Plus, UserCheck
} from 'lucide-react';
import { getLeaderBadge } from '../../utils/organogramaEngine';

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

export default function OrganogramaNode({
  node,
  expandedIds,
  onToggleExpand,
  onSelectNode,
  selectedNodeId,
  searchHighlightIds = new Set(),
}) {
  const [showAllLeaders, setShowAllLeaders] = useState(false);

  if (!node) return null;

  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isSearchMatch = searchHighlightIds.has(node.id);

  const levelColor = node.levelInfo?.color || '#0D7C3D';
  const primaryLeader = node.primaryLeader;
  const leaderBadge = primaryLeader ? getLeaderBadge(primaryLeader.cargo) : null;
  const avatarStyle = primaryLeader ? getAvatarColor(primaryLeader.nome) : { bg: '#f1f5f9', text: '#64748b' };
  const secondaryLeaders = node.secondaryLeaders || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        margin: '0 10px',
      }}
    >
      {/* Node Card */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={() => onSelectNode(node)}
        style={{
          width: 330,
          background: isSelected ? 'var(--card-bg)' : 'var(--surface)',
          borderRadius: 14,
          border: isSelected
            ? `2px solid ${levelColor}`
            : isSearchMatch
            ? '2px solid #f59e0b'
            : '1px solid var(--border-c)',
          boxShadow: isSelected
            ? `0 12px 30px ${levelColor}25`
            : isSearchMatch
            ? '0 8px 24px rgba(245, 158, 11, 0.25)'
            : '0 4px 14px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s ease',
          zIndex: isSelected ? 10 : 2,
        }}
        whileHover={{
          y: -3,
          boxShadow: '0 10px 24px rgba(0,0,0,0.09)',
          borderColor: levelColor,
        }}
      >
        {/* Accent Bar */}
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${levelColor}, ${levelColor}88)`,
          }}
        />

        {/* Card Header: Level Badge & Unit Code */}
        <div
          style={{
            padding: '9px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            borderBottom: '1px solid var(--border-c)',
            background: 'rgba(0,0,0,0.015)',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: levelColor,
              background: node.levelInfo?.bg || 'rgba(0,0,0,0.05)',
              padding: '2px 8px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Building2 size={11} />
            {node.levelInfo?.label || 'Unidade'}
          </span>

          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--sub)',
              fontFamily: 'monospace',
              letterSpacing: '0.02em',
            }}
          >
            {node.code}
          </span>
        </div>

        {/* Card Body: Unit Name */}
        <div style={{ padding: '12px 14px 10px' }}>
          <h3
            style={{
              margin: '0 0 10px 0',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.35,
              minHeight: 34,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={node.name}
          >
            {node.name}
          </h3>

          {/* Primary Leader Block */}
          {primaryLeader ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 10,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-c)',
                marginBottom: 8,
              }}
            >
              {/* Leader Avatar */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: avatarStyle.bg,
                  color: avatarStyle.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12.5,
                  fontWeight: 800,
                  flexShrink: 0,
                  border: `1px solid ${avatarStyle.text}33`,
                  marginTop: 2,
                }}
              >
                {getInitials(primaryLeader.nome)}
              </div>

              {/* Leader Info */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: leaderBadge?.bg || 'rgba(0,0,0,0.06)',
                      color: leaderBadge?.color || 'var(--text)',
                      display: 'inline-block',
                    }}
                  >
                    {leaderBadge?.label.split('/')[0].trim() || 'Líder'}
                  </span>
                  {primaryLeader.situacao && (
                    <span
                      style={{
                        fontSize: 9,
                        color: primaryLeader.situacao === 'Normal' ? '#059669' : '#d97706',
                        fontWeight: 600,
                      }}
                    >
                      • {primaryLeader.situacao}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={primaryLeader.nome}
                >
                  {primaryLeader.nome}
                </div>

                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: 'var(--muted-c)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 1,
                  }}
                  title={primaryLeader.cargo}
                >
                  {primaryLeader.cargo}
                </div>

                {primaryLeader.matricula && (
                  <div style={{ fontSize: 9.5, color: 'var(--sub)', marginTop: 3 }}>
                    Mat: <strong>{primaryLeader.matricula}</strong>
                    {primaryLeader.padrao ? ` • ${primaryLeader.padrao}` : ''}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.02)',
                border: '1px dashed var(--border-c)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--sub)',
                fontSize: 11,
                fontStyle: 'italic',
              }}
            >
              <User size={13} style={{ opacity: 0.6 }} />
              Titular em definição / Coordenação conjunta
            </div>
          )}

          {/* Secondary Leaders (e.g. UBS with Gerente + Supervisor) */}
          {secondaryLeaders.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sub)', textTransform: 'uppercase' }}>
                  Co-Lideranças ({secondaryLeaders.length}):
                </span>
                {secondaryLeaders.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllLeaders(!showAllLeaders);
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: levelColor,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showAllLeaders ? 'Ver menos' : `+${secondaryLeaders.length - 1} mais`}
                  </button>
                )}
              </div>

              {(showAllLeaders ? secondaryLeaders : secondaryLeaders.slice(0, 1)).map((sec, sIdx) => {
                const sBadge = getLeaderBadge(sec.cargo);
                return (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.025)',
                      border: '1px solid var(--border-c)',
                      fontSize: 10.5,
                      marginBottom: 3,
                    }}
                    title={`${sec.nome} - ${sec.cargo}`}
                  >
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 800,
                        padding: '1px 4px',
                        borderRadius: 3,
                        background: sBadge.bg,
                        color: sBadge.color,
                        flexShrink: 0,
                      }}
                    >
                      {sBadge.label.split('/')[0].slice(0, 5)}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {sec.nome}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        color: 'var(--sub)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sec.cargo.includes('SUPERVISOR') ? 'Superv.' : 'Gerente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Metrics Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              paddingTop: 4,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: 'var(--text)',
                background: 'rgba(0,0,0,0.03)',
                padding: '3px 8px',
                borderRadius: 6,
              }}
              title={`Efetivo estimado de servidores vinculados`}
            >
              <Users size={12} style={{ color: levelColor }} />
              <span>
                <strong>{node.totalServidores || 0}</strong> servidores
              </span>
            </div>

            {node.aggregateLeaders > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#2563eb',
                  background: 'rgba(37, 99, 235, 0.1)',
                  padding: '2px 7px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title={`${node.aggregateLeaders} líderes sob esta coordenação`}
              >
                <Award size={10} />
                {node.aggregateLeaders} líder{node.aggregateLeaders > 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Card Actions Footer */}
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border-c)',
            background: 'rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(node);
            }}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--muted-c)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
            }}
          >
            <ExternalLink size={11} />
            Detalhes da Unidade
          </button>

          {/* Expand / Collapse toggle */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isExpanded ? 'var(--sub)' : levelColor,
                background: isExpanded ? 'rgba(0,0,0,0.05)' : `${levelColor}15`,
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: '0.15s',
              }}
            >
              {isExpanded ? (
                <>
                  <ChevronDown size={13} />
                  Recolher
                </>
              ) : (
                <>
                  <ChevronRight size={13} />
                  +{node.children.length} {node.children.length > 1 ? 'órgãos' : 'órgão'}
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* Children Tree Branch */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              overflow: 'visible',
            }}
          >
            {/* Vertical connector line from parent to horizontal bus */}
            <div
              style={{
                width: 2,
                height: 24,
                background: 'var(--border-c)',
              }}
            />

            {/* Horizontal bus line across children */}
            <div
              style={{
                display: 'flex',
                position: 'relative',
                paddingTop: 16,
              }}
            >
              {node.children.length > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `calc(100% - ${330 + 20}px)`,
                    height: 2,
                    background: 'var(--border-c)',
                  }}
                />
              )}

              {/* Render each child recursively */}
              {node.children.map((child, idx) => (
                <div
                  key={child.id || idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  {/* Vertical drop line to child card */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      width: 2,
                      height: 16,
                      background: 'var(--border-c)',
                    }}
                  />
                  <OrganogramaNode
                    node={child}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    onSelectNode={onSelectNode}
                    selectedNodeId={selectedNodeId}
                    searchHighlightIds={searchHighlightIds}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
