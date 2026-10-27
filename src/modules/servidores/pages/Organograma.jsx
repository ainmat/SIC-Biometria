import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Network, Building2, Users, Award, Shield, Search,
  Download, Printer, RefreshCw, ZoomIn, ZoomOut,
  Maximize2, ChevronRight, ChevronDown, Sparkles,
  Layers, Filter, UserCheck, AlertCircle, Check,
  Upload, FileSpreadsheet, X, HelpCircle, HeartPulse,
  RotateCcw, Activity
} from 'lucide-react';
import { fetchResumoServidores, fetchLiderancasSS } from '@/modules/servidores/services/servidoresService';
import {
  buildSaudeTree,
  searchInSaudeTree,
  exportSaudeOrganogramaToExcel,
  parseLiderancasExcelFile,
  EIXOS_SAUDE,
} from '../utils/organogramaEngine';
import defaultLiderancas from '../data/Lideranca_SS.json';
import OrganogramaColunar from '../components/organograma/OrganogramaColunar';
import OrganogramaTree from '../components/organograma/OrganogramaTree';
import OrganogramaLista from '../components/organograma/OrganogramaLista';
import QuadroLiderancas from '../components/organograma/QuadroLiderancas';
import UnidadeDetalhesDrawer from '../components/organograma/UnidadeDetalhesDrawer';
import { AnimatedNumber } from '@/components/ui/dashboard-card';

const STORAGE_CUSTOM_KEY = 'saude_organograma_custom_liderancas';

export default function Organograma() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [servidoresSaude, setServidoresSaude] = useState([]);
  const [liderancasData, setLiderancasData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    return defaultLiderancas;
  });
  const [isCustomLoaded, setIsCustomLoaded] = useState(() => {
    return !!localStorage.getItem(STORAGE_CUSTOM_KEY);
  });

  // Filtro de Eixo da Saúde ('ALL' | '58-0' | '58-3' | '58-4' | '58-5' | '58-6' | '58-7')
  const [selectedEixo, setSelectedEixo] = useState('ALL');

  // Modo de visualização: 'tree' | 'leaders' | 'list'
  const [viewMode, setViewMode] = useState('tree');

  // Nós expandidos (Set de IDs)
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Nó selecionado para abrir no Drawer lateral
  const [selectedNode, setSelectedNode] = useState(null);

  // Busca e destaques
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchHighlightIds, setSearchHighlightIds] = useState(new Set());

  // Modal de Upload XLSX
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Carregar líderes da tabela Lideranca_SS e servidores de Saúde do banco de dados
  const carregarServidores = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);

      // Tenta buscar líderes diretamente da tabela Lideranca_SS (ou base oficial Lideranca_SS.json)
      const lideres = await fetchLiderancasSS();
      if (lideres && lideres.length > 0) {
        setLiderancasData(lideres);
      }

      // Buscar servidores lotados na Saúde para estatísticas de unidade
      const all = await fetchResumoServidores(false);
      const saude = (all || []).filter(r => (r.Des_Secretaria || '').toUpperCase().includes('SAUDE'));
      setServidoresSaude(saude);
    } catch (e) {
      console.warn('Aviso ao carregar dados da Saúde:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarServidores();
  }, [carregarServidores]);

  // 2. Construção da Árvore Hierárquica Oficial da Saúde
  const fullTreeData = useMemo(() => {
    return buildSaudeTree(liderancasData, servidoresSaude);
  }, [liderancasData, servidoresSaude]);

  // 3. Sub-árvore ativa baseada no Eixo selecionado
  const activeTreeData = useMemo(() => {
    if (!fullTreeData.root) return { root: null, totalUnits: 0, totalLiderancas: 0 };

    if (selectedEixo === 'ALL') {
      return fullTreeData;
    }

    // Se um eixo específico foi selecionado (ex: 58-3 Atenção Primária)
    const eixoCode = `${selectedEixo}-0-0-0`;
    const targetNode = fullTreeData.allUnitsMap.get(eixoCode);

    if (targetNode) {
      return {
        root: targetNode,
        totalUnits: targetNode.children.length + 1,
        totalLiderancas: targetNode.aggregateLeaders || targetNode.leaders.length,
        allUnitsMap: fullTreeData.allUnitsMap,
        liderancas: fullTreeData.liderancas.filter(l => (l.unitCode || '').startsWith(selectedEixo) || (l.localTrabalho || '').includes(selectedEixo)),
      };
    }

    return fullTreeData;
  }, [fullTreeData, selectedEixo]);

  // 4. Auto-expansão inicial (Gabinete + Diretorias de 1º e 2º nível)
  useEffect(() => {
    if (activeTreeData.root) {
      const initial = new Set();
      initial.add(activeTreeData.root.id);

      if (activeTreeData.root.children) {
        activeTreeData.root.children.forEach(c => {
          initial.add(c.id);
          // Se for visão de eixo específico, expande também o 2º nível
          if (selectedEixo !== 'ALL' && c.children) {
            c.children.forEach(sub => initial.add(sub.id));
          }
        });
      }
      setExpandedIds(initial);
    }
  }, [activeTreeData.root, selectedEixo]);

  // 5. Expandir / Recolher todos os nós
  const handleExpandAll = () => {
    if (!fullTreeData.allUnitsMap) return;
    const all = new Set(Array.from(fullTreeData.allUnitsMap.keys()));
    setExpandedIds(all);
  };

  const handleCollapseAll = () => {
    if (activeTreeData.root) {
      setExpandedIds(new Set([activeTreeData.root.id]));
    }
  };

  const handleToggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 6. Busca instantânea na árvore
  useEffect(() => {
    if (!searchQuery.trim() || !fullTreeData.root) {
      setSearchResults([]);
      setSearchHighlightIds(new Set());
      return;
    }

    const matches = searchInSaudeTree(fullTreeData.root, searchQuery);
    setSearchResults(matches);

    // Identificar IDs para auto-expandir o caminho até o resultado
    const highlightIds = new Set();
    const pathToExpand = new Set(expandedIds);

    matches.forEach(m => {
      highlightIds.add(m.node.id);
      m.path.forEach(pId => pathToExpand.add(pId));
    });

    setSearchHighlightIds(highlightIds);
    setExpandedIds(pathToExpand);
  }, [searchQuery, fullTreeData.root]);

  // 7. Navegação a partir de resultado de busca
  const handleSelectSearchResult = (match) => {
    setShowSearchDropdown(false);
    setSelectedNode(match.node);

    // Garante que o caminho até o nó esteja expandido
    setExpandedIds(prev => {
      const next = new Set(prev);
      match.path.forEach(pId => next.add(pId));
      return next;
    });

    // Se estiver no quadro de lideranças, alterna para a árvore
    if (viewMode !== 'tree') {
      setViewMode('tree');
    }
  };

  // 8. Focar Líder do Quadro no Organograma
  const handleFocusLeaderInTree = (lead) => {
    const targetUnit = fullTreeData.allUnitsMap.get(lead.unitCode) || fullTreeData.root;
    setSelectedNode(targetUnit);
    setViewMode('tree');

    // Auto expande até a unidade
    if (targetUnit.parentCode) {
      setExpandedIds(prev => new Set([...prev, targetUnit.id, targetUnit.parentCode, fullTreeData.root.id]));
    }
    setSearchHighlightIds(new Set([targetUnit.id]));
  };

  // 9. Processar arquivo Excel carregado pelo usuário
  const handleFileUpload = async (file) => {
    try {
      setUploadError(null);
      setUploadSuccess(null);

      if (!file) return;
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setUploadError('Formato inválido. Por favor, envie uma planilha Excel (.xlsx ou .xls).');
        return;
      }

      const parsed = await parseLiderancasExcelFile(file);
      if (!parsed || parsed.length === 0) {
        setUploadError('Nenhuma liderança válida foi identificada nas colunas da planilha.');
        return;
      }

      setLiderancasData(parsed);
      setIsCustomLoaded(true);
      try {
        localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(parsed));
      } catch (e) {
        // quota limit
      }

      const diretores = parsed.filter(p => p.roleCategory === 'DIRETOR').length;
      const gerentes = parsed.filter(p => p.roleCategory === 'GERENTE').length;
      const supervisores = parsed.filter(p => p.roleCategory === 'SUPERVISOR').length;

      setUploadSuccess(`Planilha carregada com sucesso! ${parsed.length} lideranças identificadas (${diretores} diretores, ${gerentes} gerentes, ${supervisores} supervisores).`);

      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(null);
      }, 1800);
    } catch (err) {
      console.error('Erro ao ler planilha:', err);
      setUploadError(`Erro ao processar planilha: ${err.message || 'Arquivo corrompido ou formato divergente.'}`);
    }
  };

  // 10. Restaurar Base Oficial
  const handleResetToOfficial = () => {
    localStorage.removeItem(STORAGE_CUSTOM_KEY);
    setLiderancasData(defaultLiderancas);
    setIsCustomLoaded(false);
    setSelectedEixo('ALL');
    setSearchQuery('');
  };

  // 11. Estatísticas Executivas
  const kpis = useMemo(() => {
    const diretores = liderancasData.filter(l => l.roleCategory === 'DIRETOR').length;
    const gerentes = liderancasData.filter(l => l.roleCategory === 'GERENTE').length;
    const supervisores = liderancasData.filter(l => l.roleCategory === 'SUPERVISOR').length;
    return {
      totalLideres: liderancasData.length,
      diretores,
      gerentes,
      supervisores,
      totalOrgaos: fullTreeData.totalUnits,
      totalQuadro: 4320,
    };
  }, [liderancasData, fullTreeData.totalUnits]);

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Topbar Institucional */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#0D7C3D',
                background: 'rgba(13, 124, 61, 0.12)',
                padding: '3px 10px',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <HeartPulse size={13} />
              Secretaria da Saúde (58.00.00)
            </span>

            {isCustomLoaded ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#2563eb',
                  background: 'rgba(37, 99, 235, 0.1)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <FileSpreadsheet size={12} />
                Planilha Customizada Ativa
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#059669',
                  background: 'rgba(5, 150, 105, 0.1)',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                ● Base Oficial Ativa
              </span>
            )}
          </div>

          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Organograma Oficial da Secretaria da Saúde
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--sub)' }}>
            Gestão Hierárquica, Distribuição de Cargos de Liderança (Diretores, Gerentes e Supervisores) e Lotação de Unidades
          </p>
        </div>

        {/* Top Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowUploadModal(true)}
            style={actionBtnStyle('#0D7C3D', true)}
            title="Importar planilha XLSX com os cargos de liderança"
          >
            <Upload size={14} />
            Importar Planilha XLSX
          </button>

          <button
            onClick={() => exportSaudeOrganogramaToExcel(activeTreeData.root, liderancasData)}
            style={actionBtnStyle('var(--text)')}
            title="Exportar organograma completo formatado para Excel"
          >
            <Download size={14} />
            Exportar Excel
          </button>

          <button
            onClick={() => window.print()}
            style={actionBtnStyle('var(--text)')}
            title="Imprimir visualização"
          >
            <Printer size={14} />
            Imprimir
          </button>

          {isCustomLoaded && (
            <button
              onClick={handleResetToOfficial}
              style={{ ...actionBtnStyle('#d97706'), background: 'rgba(217, 119, 6, 0.1)', borderColor: 'rgba(217, 119, 6, 0.3)' }}
              title="Restaurar dados oficiais originais da Saúde"
            >
              <RotateCcw size={14} />
              Restaurar Base
            </button>
          )}

          <TopbarAvatar />
        </div>
      </div>

      {/* KPI Cards Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={kpiCardStyle('#0D7C3D')}>
          <div style={kpiHeaderStyle}>
            <span style={kpiLabelStyle}>Total de Lideranças</span>
            <Award size={15} style={{ color: '#0D7C3D' }} />
          </div>
          <div style={kpiValueStyle}>
            <AnimatedNumber value={kpis.totalLideres} />
          </div>
          <div style={kpiSubStyle}>100% mapeados na estrutura</div>
        </div>

        <div style={kpiCardStyle('#2563eb')}>
          <div style={kpiHeaderStyle}>
            <span style={kpiLabelStyle}>Diretores Gerais & Depto</span>
            <Shield size={15} style={{ color: '#2563eb' }} />
          </div>
          <div style={{ ...kpiValueStyle, color: '#2563eb' }}>
            <AnimatedNumber value={kpis.diretores} />
          </div>
          <div style={kpiSubStyle}>Cúpula executiva da Saúde</div>
        </div>

        <div style={kpiCardStyle('#7c3aed')}>
          <div style={kpiHeaderStyle}>
            <span style={kpiLabelStyle}>Gerentes de Serviços</span>
            <Users size={15} style={{ color: '#7c3aed' }} />
          </div>
          <div style={{ ...kpiValueStyle, color: '#7c3aed' }}>
            <AnimatedNumber value={kpis.gerentes} />
          </div>
          <div style={kpiSubStyle}>UBSs, Farmácias, SAMU, HMMAA</div>
        </div>

        <div style={kpiCardStyle('#d97706')}>
          <div style={kpiHeaderStyle}>
            <span style={kpiLabelStyle}>Supervisores Setoriais</span>
            <UserCheck size={15} style={{ color: '#d97706' }} />
          </div>
          <div style={{ ...kpiValueStyle, color: '#d97706' }}>
            <AnimatedNumber value={kpis.supervisores} />
          </div>
          <div style={kpiSubStyle}>Atendimento, Enfermagem, SAME</div>
        </div>

        <div style={kpiCardStyle('#0d9488')}>
          <div style={kpiHeaderStyle}>
            <span style={kpiLabelStyle}>Órgãos & Unidades</span>
            <Building2 size={15} style={{ color: '#0d9488' }} />
          </div>
          <div style={{ ...kpiValueStyle, color: '#0d9488' }}>
            <AnimatedNumber value={kpis.totalOrgaos} />
          </div>
          <div style={kpiSubStyle}>Cadeia decimal oficial (58)</div>
        </div>

        <div style={kpiCardStyle('#475569')}>
          <div style={kpiHeaderStyle}>
            <span style={kpiLabelStyle}>Quadro Geral da Saúde</span>
            <Activity size={15} style={{ color: '#475569' }} />
          </div>
          <div style={kpiValueStyle}>
            <AnimatedNumber value={kpis.totalQuadro} />
          </div>
          <div style={kpiSubStyle}>Servidores ativos lotados</div>
        </div>
      </div>

      {/* Main Filter & Navigation Bar */}
      <div
        style={{
          background: 'var(--surface)',
          padding: '14px 20px',
          borderRadius: 16,
          border: '1px solid var(--border-c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 16,
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
        }}
      >
        {/* Left: View Mode Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', padding: 3, borderRadius: 10, border: '1px solid var(--border-c)' }}>
          <button
            onClick={() => setViewMode('tree')}
            style={viewTabStyle(viewMode === 'tree')}
          >
            <Network size={14} />
            Árvore Hierárquica
          </button>
          <button
            onClick={() => setViewMode('leaders')}
            style={viewTabStyle(viewMode === 'leaders')}
          >
            <Award size={14} />
            Quadro de Lideranças ({kpis.totalLideres})
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={viewTabStyle(viewMode === 'list')}
          >
            <Layers size={14} />
            Estrutura Linear
          </button>
        </div>

        {/* Center: Eixo Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sub)' }}>
            Eixo da Saúde:
          </span>
          <select
            value={selectedEixo}
            onChange={(e) => setSelectedEixo(e.target.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-c)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: 260,
            }}
          >
            {EIXOS_SAUDE.map(e => (
              <option key={e.key} value={e.key}>{e.label}</option>
            ))}
          </select>
        </div>

        {/* Right: Search + Tree Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Global Search Input */}
          <div style={{ position: 'relative', width: 260 }}>
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
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder="Buscar gestor, cargo, UBS ou cód..."
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

            {/* Search Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: 320,
                  maxHeight: 280,
                  overflowY: 'auto',
                  background: 'var(--surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border-c)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  padding: '6px 0',
                }}
              >
                <div style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--sub)', borderBottom: '1px solid var(--border-c)' }}>
                  {searchResults.length} Resultados Encontrados
                </div>
                {searchResults.slice(0, 15).map((match, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSearchResult(match)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-c)',
                      fontSize: 11.5,
                      transition: '0.1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                      {match.node.name}
                    </div>
                    {match.matchingLeaders?.length > 0 && (
                      <div style={{ fontSize: 10.5, color: '#0D7C3D', fontWeight: 600 }}>
                        👤 {match.matchingLeaders[0].nome} ({match.matchingLeaders[0].cargo})
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--sub)', fontFamily: 'monospace' }}>
                      {match.node.code}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tree Expander Controls */}
          {viewMode === 'tree' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={handleExpandAll}
                style={miniBtnStyle}
                title="Expandir todos os nós da árvore"
              >
                Expandir Tudo
              </button>
              <button
                onClick={handleCollapseAll}
                style={miniBtnStyle}
                title="Recolher para a raiz"
              >
                Recolher
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Viewport Content */}
      <div>
        {viewMode === 'tree' && (
          <OrganogramaColunar
            liderancas={liderancasData}
            selectedEixo={selectedEixo}
            onSelectEixo={(eixo) => setSelectedEixo(eixo)}
            onSelectLeader={(leader) => {
              let unitNode = fullTreeData.allUnitsMap.get(leader.unitCode);
              if (!unitNode && leader.localTrabalho) {
                for (const [code, u] of fullTreeData.allUnitsMap.entries()) {
                  if (leader.localTrabalho.includes(code)) {
                    unitNode = u;
                    break;
                  }
                }
              }
              if (!unitNode) {
                unitNode = {
                  id: leader.id || leader.matricula,
                  code: leader.unitCode || '58-0-0-0-0',
                  name: leader.localTrabalho || leader.cargo,
                  levelInfo: { label: leader.roleCategory || 'Liderança', color: '#1b2d4f', bg: 'rgba(27, 45, 79, 0.12)' },
                  leaders: [leader],
                  totalServidores: 0,
                  comissionados: 1,
                  efetivos: 0,
                  members: []
                };
              }
              setSelectedNode(unitNode);
            }}
            selectedLeaderId={selectedNode?.id}
            searchQuery={searchQuery}
            searchHighlightIds={searchHighlightIds}
          />
        )}

        {viewMode === 'leaders' && (
          <QuadroLiderancas
            liderancas={liderancasData}
            onSelectNode={(node) => setSelectedNode(node)}
            onFocusLeaderInTree={handleFocusLeaderInTree}
            allUnitsMap={fullTreeData.allUnitsMap}
          />
        )}

        {viewMode === 'list' && (
          <OrganogramaLista
            rootNode={activeTreeData.root}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            onSelectNode={(node) => setSelectedNode(node)}
            selectedNodeId={selectedNode?.id}
            searchHighlightIds={searchHighlightIds}
          />
        )}
      </div>

      {/* Drawer Lateral de Detalhes da Unidade */}
      {selectedNode && (
        <UnidadeDetalhesDrawer
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSelectNode={(node) => setSelectedNode(node)}
        />
      )}

      {/* Modal de Importação de Planilha XLSX */}
      <AnimatePresence>
        {showUploadModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 540,
                background: 'var(--surface)',
                borderRadius: 18,
                border: '1px solid var(--border-c)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'rgba(13, 124, 61, 0.12)',
                      color: '#0D7C3D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                      Atualizar Cargos de Liderança (SS)
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--sub)' }}>
                      Carregue a planilha Excel (.xlsx ou .xls) com Diretores, Gerentes e Supervisores
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--border-c)',
                    background: 'transparent',
                    color: 'var(--sub)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragOver ? '2px dashed #0D7C3D' : '2px dashed var(--border-c)',
                  background: dragOver ? 'rgba(13, 124, 61, 0.05)' : 'var(--card-bg)',
                  borderRadius: 14,
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />

                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'rgba(13, 124, 61, 0.1)',
                    color: '#0D7C3D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Upload size={22} />
                </div>

                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    Arraste sua planilha aqui ou clique para selecionar
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 2 }}>
                    Suporta arquivos Excel (.xlsx, .xls) exportados do SysTime ou Folha
                  </div>
                </div>
              </div>

              {/* Error / Success Feedback */}
              {uploadError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={15} />
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Check size={15} />
                  {uploadSuccess}
                </div>
              )}

              {/* Informative Guidance */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.02)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: '1px solid var(--border-c)',
                  fontSize: 11.5,
                  color: 'var(--sub)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HelpCircle size={13} style={{ color: '#0D7C3D' }} />
                  Formato esperado das colunas na planilha:
                </div>
                <div>
                  • <strong>Nome Funcionário</strong>, <strong>Descrição Cargo</strong>, <strong>Sigla Cargo</strong> (ex: 58-3-0-0-0.3100)
                </div>
                <div>
                  • <strong>Descrição Local Trabalho</strong> (ex: 58-3-3-1-1-4 - UBS GETULINO JOSÉ DIAS), <strong>Matrícula</strong> e <strong>Situação</strong>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function actionBtnStyle(color, isPrimary = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 8,
    border: isPrimary ? 'none' : '1px solid var(--border-c)',
    background: isPrimary ? '#0D7C3D' : 'var(--card-bg)',
    color: isPrimary ? '#ffffff' : color,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: '0.15s ease',
  };
}

function viewTabStyle(active) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? '#0D7C3D' : 'var(--sub)',
    boxShadow: active ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
    fontSize: 12,
    fontWeight: active ? 800 : 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };
}

const miniBtnStyle = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-c)',
  background: 'var(--card-bg)',
  color: 'var(--sub)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

function kpiCardStyle(accentColor) {
  return {
    background: 'var(--surface)',
    borderRadius: 14,
    border: '1px solid var(--border-c)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
    borderTop: `3px solid ${accentColor}`,
  };
}

const kpiHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
};

const kpiLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--sub)',
};

const kpiValueStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: 'var(--text)',
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
};

const kpiSubStyle = {
  fontSize: 11,
  color: 'var(--muted-c)',
  fontWeight: 500,
};
