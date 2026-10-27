import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Move,
  ChevronDown, ChevronRight, User, Award, Shield,
  Building2, Users, ExternalLink, Check, Briefcase,
  Layers, Search, Sparkles, Filter, ChevronUp
} from 'lucide-react';

export default function OrganogramaColunar({
  liderancas = [],
  selectedEixo = 'ALL',
  onSelectEixo,
  onSelectLeader,
  selectedLeaderId,
  searchQuery = '',
  searchHighlightIds = new Set(),
}) {
  const [scale, setScale] = useState(0.82);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Colunas colapsadas/expandidas
  const [collapsedCols, setCollapsedCols] = useState(new Set());

  // 1. Secretário e Gabinete
  const topSecretario = useMemo(() => {
    return {
      id: 'sec_193240',
      nome: 'DR. FERNANDO MACHADO OLIVEIRA',
      cargo: 'SECRETÁRIO MUNICIPAL DA SAÚDE',
      matricula: '193240',
      padrao: 'Agente Político',
      situacao: 'Titular do Cargo',
      roleCategory: 'SECRETÁRIO',
      localTrabalho: '58-0-0-0 - GABINETE DO SECRETÁRIO DA SAÚDE',
      unitCode: '58-0-0-0-0',
    };
  }, []);

  const topGabinete = useMemo(() => {
    return {
      id: 'gab_188744',
      nome: 'DRA. SUZETE SOUZA FRANCO SILVA',
      subNome: 'JOÃO RICARDO MORINA DA SILVA (CHEFE DE GABINETE)',
      cargo: 'SECRETÁRIA ADJUNTA & CHEFE DE GABINETE',
      matricula: '188744',
      situacao: 'Titular',
      roleCategory: 'DIRETOR',
      localTrabalho: '58-0-0-0 - GABINETE DO SECRETÁRIO DA SAÚDE',
      unitCode: '58-0-0-0-0',
    };
  }, []);

  // Helper para verificar se líder ou cargo está destacado pela busca
  const isLeaderHighlighted = useCallback((leader) => {
    if (!leader) return false;
    if (selectedLeaderId && (leader.id === selectedLeaderId || leader.matricula === selectedLeaderId)) {
      return true;
    }
    if (searchHighlightIds && searchHighlightIds.size > 0) {
      if (searchHighlightIds.has(leader.id) || searchHighlightIds.has(leader.matricula)) return true;
    }
    if (searchQuery && searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase().trim();
      return (
        (leader.nome && leader.nome.toLowerCase().includes(q)) ||
        (leader.cargo && leader.cargo.toLowerCase().includes(q)) ||
        (leader.matricula && leader.matricula.includes(q)) ||
        (leader.localTrabalho && leader.localTrabalho.toLowerCase().includes(q))
      );
    }
    return false;
  }, [selectedLeaderId, searchHighlightIds, searchQuery]);

  // 2. Estruturação exata das 6 Colunas (Secretário -> Diretor -> Gerente -> Supervisor)
  const allColumnsData = useMemo(() => {
    const colDef = [
      {
        id: 'col_primaria',
        code: '58-3',
        eixoKey: '58-3',
        titulo: 'ATENÇÃO PRIMÁRIA',
        subtitulo: 'Rede de UBSs & Cuidados Básicos',
        diretores: [],
        grupos: [],
        directSupervisores: []
      },
      {
        id: 'col_secundaria',
        code: '58-4',
        eixoKey: '58-4',
        titulo: 'ATENÇÃO SECUNDÁRIA',
        subtitulo: 'Policlínicas, CAPS & Especialidades',
        diretores: [],
        grupos: [],
        directSupervisores: []
      },
      {
        id: 'col_urgencia',
        code: '58-5',
        eixoKey: '58-5',
        titulo: 'URGÊNCIA E EMERGÊNCIA',
        subtitulo: 'UPAs, Prontos-Socorros & SAMU',
        diretores: [],
        grupos: [],
        directSupervisores: []
      },
      {
        id: 'col_maternidade',
        code: '58-6',
        eixoKey: '58-6',
        titulo: 'HOSPITAL MATERNIDADE',
        subtitulo: 'HMMAA Amador Aguiar',
        diretores: [],
        grupos: [],
        directSupervisores: []
      },
      {
        id: 'col_vigilancia_farmacia',
        code: '58-7-VF',
        eixoKey: '58-7',
        titulo: 'VIGILÂNCIA & FARMÁCIA',
        subtitulo: 'Sanitária, Zoonoses, Epidem. & Farmácia',
        diretores: [],
        grupos: [],
        directSupervisores: []
      },
      {
        id: 'col_gestao_suporte',
        code: '58-7-GS',
        eixoKey: '58-7',
        titulo: 'GESTÃO & SUPORTE',
        subtitulo: 'Estratégias, Regulação, RH & Orçamento',
        diretores: [],
        grupos: [],
        directSupervisores: []
      }
    ];

    function getColIdx(l) {
      const s = (l.siglaCargo || '').toUpperCase();
      const loc = (l.localTrabalho || '').toUpperCase();
      const c = (l.cargo || '').toUpperCase();

      if (s.startsWith('58-3') || loc.includes('58-3') || c.includes('UBS')) return 0;
      if (s.startsWith('58-4') || loc.includes('58-4') || c.includes('POLICLINICA') || c.includes('CAPS') || c.includes('SECUNDA')) return 1;
      if (s.startsWith('58-5') || loc.includes('58-5') || c.includes('SAMU') || c.includes('PRONTO') || c.includes('URGEN')) return 2;
      if (s.startsWith('58-6') || loc.includes('58-6') || c.includes('HOSPITAL') || c.includes('MATERNID')) return 3;
      if (s.startsWith('58-7-3') || s.startsWith('58-7-4') || loc.includes('58-7-3') || loc.includes('58-7-4') || c.includes('VIGILANCIA') || c.includes('FARMAC') || c.includes('ZOONOSE') || c.includes('SVO')) return 4;
      return 5;
    }

    // 1. Separar Diretores
    liderancas.forEach(l => {
      if (l.roleCategory === 'DIRETOR') {
        const idx = getColIdx(l);
        colDef[idx].diretores.push(l);
      }
    });

    // 2. Agrupar Gerentes e seus Supervisores
    colDef.forEach((col, cIdx) => {
      const colLeaders = liderancas.filter(l => getColIdx(l) === cIdx && l.roleCategory !== 'DIRETOR');
      const gerentes = colLeaders.filter(l => l.roleCategory === 'GERENTE');
      const supervisores = colLeaders.filter(l => l.roleCategory === 'SUPERVISOR');
      const assignedSup = new Set();

      // Parear Gerentes por Local de Trabalho
      gerentes.forEach(g => {
        const gCode = (g.localTrabalho.match(/58-[\d.-]+/) || [])[0];
        const gName = g.localTrabalho.replace(/^\d+-[\d.-]+\s*-\s*/, '').trim().toUpperCase();

        const subs = supervisores.filter(s => {
          if (assignedSup.has(s.id)) return false;
          const sCode = (s.localTrabalho.match(/58-[\d.-]+/) || [])[0];
          if (gCode && sCode && (sCode.startsWith(gCode) || gCode.startsWith(sCode))) return true;
          const sName = s.localTrabalho.replace(/^\d+-[\d.-]+\s*-\s*/, '').trim().toUpperCase();
          if (gName.length > 5 && sName.includes(gName)) return true;
          return false;
        });

        subs.forEach(s => assignedSup.add(s.id));

        col.grupos.push({
          id: `grp_${g.id}`,
          gerente: g,
          supervisores: subs,
          unidade: g.localTrabalho.replace(/^58-[\d.-]+\s*-\s*/, '')
        });
      });

      // Supervisores diretos (sem gerente intermediário na unidade)
      const unassigned = supervisores.filter(s => !assignedSup.has(s.id));
      col.directSupervisores = unassigned;
    });

    return colDef;
  }, [liderancas]);

  // Colunas filtradas baseadas no Eixo selecionado
  const displayedColumns = useMemo(() => {
    if (!selectedEixo || selectedEixo === 'ALL' || selectedEixo === '58-0') {
      return allColumnsData;
    }
    return allColumnsData.filter(col => col.eixoKey === selectedEixo || col.code.startsWith(selectedEixo));
  }, [allColumnsData, selectedEixo]);

  // Controles de Zoom & Pan
  const handleZoomIn = () => setScale(s => Math.min(s + 0.15, 1.8));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.15, 0.35));
  const handleResetZoom = () => {
    setScale(0.82);
    setPan({ x: 0, y: 0 });
  };

  const handleFitScreen = () => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const totalW = displayedColumns.length * 320 + (displayedColumns.length - 1) * 24 + 100;
    const idealScale = Math.min(Math.max((containerW - 40) / totalW, 0.35), 1.0);
    setScale(idealScale);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Suporte a trackpad / scroll do mouse (pan em 2D ou zoom com Ctrl/Cmd)
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY < 0 ? 0.06 : -0.06;
      setScale(s => Math.min(Math.max(s + delta, 0.35), 1.8));
    } else {
      setPan(p => ({
        x: p.x - e.deltaX * 1.1,
        y: p.y - e.deltaY * 1.1,
      }));
    }
  };

  const toggleCollapseCol = (colId) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const toggleCollapseAll = () => {
    if (collapsedCols.size > 0) {
      setCollapsedCols(new Set());
    } else {
      const allIds = new Set(allColumnsData.map(c => c.id));
      setCollapsedCols(allIds);
    }
  };

  // Cores Fiéis à Imagem 2 (Excel)
  const COR_SECRETARIO = '#c84b31';      // Vermelho Terracota da foto
  const COR_GABINETE = '#1b2d4f';        // Azul Marinho Escuro da foto
  const COR_DIRETOR = '#1b2d4f';         // Azul Marinho Escuro da foto
  const COR_GERENTE_BG = '#d4e9f7';      // Azul Claro da foto
  const COR_GERENTE_BORDER = '#93c5fd';  // Borda Azul Claro
  const COR_GERENTE_TEXT = '#0f2942';    // Texto Escuro
  const COR_SUPERVISOR_BG = '#ffffff';   // Branco da foto
  const COR_SUPERVISOR_BORDER = '#cca055'; // Dourado / Bronze da foto
  const COR_SUPERVISOR_TEXT = '#1e293b';
  const COR_LINHA = '#cca055';           // Linha conectora dourada da foto

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '700px',
        height: 'calc(100vh - 270px)',
        overflow: 'hidden',
        background: '#f8fafc',
        backgroundImage: `radial-gradient(circle, #e2e8f0 1.2px, transparent 1.2px)`,
        backgroundSize: '24px 24px',
        borderRadius: 16,
        border: '1px solid var(--border-c)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* Quick Eixo Jump Bar (Topo do Canvas) */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          padding: '4px 8px',
          borderRadius: 12,
          border: '1px solid var(--border-c)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          maxWidth: '92%',
          overflowX: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onSelectEixo && onSelectEixo('ALL')}
          style={eixoPillStyle(selectedEixo === 'ALL')}
        >
          <Layers size={12} />
          Todas as 6 Diretorias
        </button>

        {allColumnsData.map((col) => {
          const isActive = selectedEixo === col.eixoKey;
          const totalInCol = col.diretores.length + col.grupos.length + col.directSupervisores.length;
          return (
            <button
              key={col.id}
              onClick={() => onSelectEixo && onSelectEixo(col.eixoKey)}
              style={eixoPillStyle(isActive)}
            >
              {col.titulo} ({totalInCol})
            </button>
          );
        })}
      </div>

      {/* Floating Canvas Hint (Canto Inferior Esquerdo) */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--sub)',
          background: 'var(--surface)',
          padding: '6px 14px',
          borderRadius: 10,
          border: '1px solid var(--border-c)',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <Move size={13} style={{ color: COR_SECRETARIO }} />
        <span>Padrão Oficial:</span>
        <span style={{ color: COR_SECRETARIO }}>Secretário</span> ➔
        <span style={{ color: COR_DIRETOR }}>Diretores</span> ➔
        <span style={{ color: '#0284c7' }}>Gerentes</span> ➔
        <span style={{ color: '#b45309' }}>Supervisores</span>
      </div>

      {/* Zoom / Pan Toolbar (Canto Inferior Direito) */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          padding: '6px 12px',
          borderRadius: 12,
          border: '1px solid var(--border-c)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={toggleCollapseAll}
          style={{ ...controlBtnStyle, width: 'auto', padding: '0 8px', fontSize: 11, fontWeight: 700 }}
          title={collapsedCols.size > 0 ? "Expandir todas as colunas" : "Recolher todas as colunas"}
        >
          {collapsedCols.size > 0 ? 'Expandir Colunas' : 'Recolher Colunas'}
        </button>
        <div style={{ width: 1, height: 18, background: 'var(--border-c)', margin: '0 2px' }} />
        <button onClick={handleZoomIn} style={controlBtnStyle} title="Aumentar zoom (+)">
          <ZoomIn size={15} />
        </button>
        <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 42, textAlign: 'center', fontFamily: 'monospace' }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={handleZoomOut} style={controlBtnStyle} title="Diminuir zoom (-)">
          <ZoomOut size={15} />
        </button>
        <div style={{ width: 1, height: 18, background: 'var(--border-c)', margin: '0 2px' }} />
        <button onClick={handleResetZoom} style={controlBtnStyle} title="Resetar posição">
          <RotateCcw size={14} />
        </button>
        <button onClick={handleFitScreen} style={controlBtnStyle} title="Ajustar à tela">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Transformable Interactive Canvas */}
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 68,
          paddingBottom: 120,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: 'top center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        {/* ============================================================== */}
        {/* NÍVEL 1: SECRETÁRIO DE SAÚDE (Card Vermelho da Imagem 2) */}
        {/* ============================================================== */}
        <div
          onClick={() => onSelectLeader && onSelectLeader(topSecretario)}
          style={{
            width: 330,
            background: COR_SECRETARIO,
            color: '#ffffff',
            borderRadius: 14,
            padding: '12px 18px',
            textAlign: 'center',
            boxShadow: isLeaderHighlighted(topSecretario)
              ? '0 0 0 4px #fbbf24, 0 10px 30px rgba(200, 75, 49, 0.4)'
              : '0 8px 24px rgba(200, 75, 49, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9, marginBottom: 2 }}>
            SECRETARIA MUNICIPAL DA SAÚDE
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            {topSecretario.nome}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.95, marginTop: 2 }}>
            {topSecretario.cargo}
          </div>
        </div>

        {/* Linha vertical conectando Secretário ao Gabinete com seta */}
        <div style={{ position: 'relative', width: 2.5, height: 26, background: COR_LINHA }}>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: -3.75,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `6px solid ${COR_LINHA}`,
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* NÍVEL 1.5: GABINETE & SECRETÁRIA ADJUNTA (Card Azul Marinho) */}
        {/* ============================================================== */}
        <div
          onClick={() => onSelectLeader && onSelectLeader(topGabinete)}
          style={{
            width: 350,
            background: COR_GABINETE,
            color: '#ffffff',
            borderRadius: 14,
            padding: '12px 18px',
            textAlign: 'center',
            boxShadow: isLeaderHighlighted(topGabinete)
              ? '0 0 0 4px #fbbf24, 0 10px 30px rgba(27, 45, 79, 0.35)'
              : '0 8px 24px rgba(27, 45, 79, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd', marginBottom: 2 }}>
            GABINETE DO SECRETÁRIO & ADJUNTA
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 900, lineHeight: 1.25 }}>
            {topGabinete.nome}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>
            {topGabinete.subNome}
          </div>
        </div>

        {/* Linha vertical descendo do Gabinete para o Barramento com seta */}
        <div style={{ position: 'relative', width: 2.5, height: 28, background: COR_LINHA }}>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: -3.75,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `6px solid ${COR_LINHA}`,
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* BARRAMENTO HORIZONTAL (Linha Dourada conectando as Colunas) */}
        {/* ============================================================== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            position: 'relative',
            paddingTop: 24,
            gap: 24,
          }}
        >
          {/* Linha horizontal mestra ligando o topo das colunas visíveis */}
          {displayedColumns.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 'calc(290px / 2)',
                right: 'calc(290px / 2)',
                height: 2.5,
                background: COR_LINHA,
              }}
            />
          )}

          {/* ============================================================== */}
          {/* AS COLUNAS DE DIRETORES DA SAÚDE */}
          {/* ============================================================== */}
          {displayedColumns.map((col) => {
            const isCollapsed = collapsedCols.has(col.id);
            const totalLideres = col.diretores.length +
              col.grupos.reduce((acc, g) => acc + (g.gerente ? 1 : 0) + g.supervisores.length, 0) +
              col.directSupervisores.length;

            return (
              <div
                key={col.id}
                style={{
                  width: 290,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {/* Linha de queda vertical do barramento até o card do Diretor */}
                <div
                  style={{
                    position: 'absolute',
                    top: -24,
                    width: 2.5,
                    height: 24,
                    background: COR_LINHA,
                  }}
                >
                  {/* Seta para baixo apontando para a Diretoria Geral */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: -3.75,
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: `6px solid ${COR_LINHA}`,
                    }}
                  />
                </div>

                {/* ======================================================== */}
                {/* NÍVEL 2: CARD DA DIRETORIA GERAL (Azul Marinho da Foto 2) */}
                {/* ======================================================== */}
                <div
                  style={{
                    width: '100%',
                    background: COR_DIRETOR,
                    color: '#ffffff',
                    borderRadius: 14,
                    padding: '12px 14px',
                    boxShadow: '0 6px 18px rgba(27, 45, 79, 0.22)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: '#93c5fd',
                        background: 'rgba(147, 197, 253, 0.15)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      DIRETORIA GERAL
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapseCol(col.id);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.12)',
                        border: 'none',
                        color: '#ffffff',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      title={isCollapsed ? "Expandir líderes da diretoria" : "Recolher diretoria"}
                    >
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      {totalLideres}
                    </button>
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 900, lineHeight: 1.25 }}>
                    {col.titulo}
                  </div>

                  {/* Lista de Diretores Titulares desta Diretoria */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                    {col.diretores.map((dir, dIdx) => {
                      const isHigh = isLeaderHighlighted(dir);
                      return (
                        <div
                          key={dIdx}
                          onClick={() => onSelectLeader && onSelectLeader(dir)}
                          style={{
                            background: isHigh ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255,255,255,0.08)',
                            border: isHigh ? '1px solid #fbbf24' : '1px solid transparent',
                            borderRadius: 8,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isHigh) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isHigh) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#f8fafc' }}>
                            {dir.nome}
                          </div>
                          <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {dir.cargo}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ======================================================== */}
                {/* NÍVEIS 3 & 4: GERENTES E SUPERVISORES (Descida Vertical) */}
                {/* ======================================================== */}
                {!isCollapsed && (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      position: 'relative',
                      paddingLeft: 12,
                      paddingTop: 18,
                    }}
                  >
                    {/* Linha tronco vertical da coluna */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 20,
                        bottom: 20,
                        width: 2.5,
                        background: COR_LINHA,
                      }}
                    />

                    {/* 1. Lista dos Grupos de Gerente + Seus Supervisores */}
                    {col.grupos.map((grp) => {
                      const hasGerente = !!grp.gerente;
                      const hasSupervisores = grp.supervisores && grp.supervisores.length > 0;
                      const isGerenteHigh = grp.gerente ? isLeaderHighlighted(grp.gerente) : false;

                      return (
                        <div
                          key={grp.id}
                          style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            marginBottom: 12,
                            paddingLeft: 22,
                          }}
                        >
                          {/* Conector horizontal saindo do tronco para o Gerente */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 20,
                              left: 8,
                              width: 14,
                              height: 2,
                              background: COR_LINHA,
                            }}
                          >
                            {/* Seta horizontal apontando para o Gerente */}
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: -3,
                                width: 0,
                                height: 0,
                                borderTop: '4px solid transparent',
                                borderBottom: '4px solid transparent',
                                borderLeft: `5px solid ${COR_LINHA}`,
                              }}
                            />
                          </div>

                          {/* ============================================== */}
                          {/* CARD DO GERENTE (Azul Claro da Imagem 2) */}
                          {/* ============================================== */}
                          {hasGerente && (
                            <div
                              onClick={() => onSelectLeader && onSelectLeader(grp.gerente)}
                              style={{
                                width: '100%',
                                background: COR_GERENTE_BG,
                                border: isGerenteHigh ? '2px solid #fbbf24' : `1.5px solid ${COR_GERENTE_BORDER}`,
                                borderRadius: 10,
                                padding: '8px 10px',
                                boxShadow: isGerenteHigh
                                  ? '0 0 0 3px #fbbf24, 0 4px 12px rgba(0,0,0,0.1)'
                                  : '0 2px 8px rgba(0,0,0,0.04)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = isGerenteHigh
                                  ? '0 0 0 3px #fbbf24, 0 4px 12px rgba(0,0,0,0.1)'
                                  : '0 2px 8px rgba(0,0,0,0.04)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                                <span
                                  style={{
                                    fontSize: 8.5,
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    color: '#0369a1',
                                    background: 'rgba(3, 105, 161, 0.12)',
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                  }}
                                >
                                  GERENTE
                                </span>

                                <span style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>
                                  Mat: {grp.gerente.matricula}
                                </span>
                              </div>

                              <div style={{ fontSize: 11.5, fontWeight: 800, color: COR_GERENTE_TEXT, lineHeight: 1.25 }}>
                                {grp.gerente.nome}
                              </div>

                              <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>
                                {grp.unidade || grp.gerente.cargo}
                              </div>
                            </div>
                          )}

                          {/* ============================================== */}
                          {/* SUB-CARDS DOS SUPERVISORES (Branco c/ Dourado) */}
                          {/* ============================================== */}
                          {hasSupervisores && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                marginTop: 6,
                                paddingLeft: 16,
                                position: 'relative',
                              }}
                            >
                              {/* Linha vertical cotovelo descendo do Gerente */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: -6,
                                  left: 2,
                                  bottom: 14,
                                  width: 2,
                                  background: COR_LINHA,
                                }}
                              />

                              {grp.supervisores.map((sup) => {
                                const isSupHigh = isLeaderHighlighted(sup);
                                return (
                                  <div
                                    key={sup.id}
                                    style={{
                                      position: 'relative',
                                      width: '100%',
                                    }}
                                  >
                                    {/* Conector horizontal com seta para o Supervisor */}
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: -14,
                                        width: 14,
                                        height: 2,
                                        background: COR_LINHA,
                                        transform: 'translateY(-50%)',
                                      }}
                                    >
                                      <div
                                        style={{
                                          position: 'absolute',
                                          right: 0,
                                          top: -3,
                                          width: 0,
                                          height: 0,
                                          borderTop: '4px solid transparent',
                                          borderBottom: '4px solid transparent',
                                          borderLeft: `5px solid ${COR_LINHA}`,
                                        }}
                                      />
                                    </div>

                                    <div
                                      onClick={() => onSelectLeader && onSelectLeader(sup)}
                                      style={{
                                        background: COR_SUPERVISOR_BG,
                                        border: isSupHigh ? '2px solid #b45309' : `1.5px solid ${COR_SUPERVISOR_BORDER}`,
                                        borderRadius: 8,
                                        padding: '6px 8px',
                                        boxShadow: isSupHigh
                                          ? '0 0 0 3px #fbbf24, 0 4px 10px rgba(204, 160, 85, 0.25)'
                                          : '0 2px 6px rgba(204, 160, 85, 0.15)',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#b45309';
                                        e.currentTarget.style.transform = 'translateX(2px)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = isSupHigh ? '#b45309' : COR_SUPERVISOR_BORDER;
                                        e.currentTarget.style.transform = 'none';
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <span
                                          style={{
                                            fontSize: 8.5,
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            color: '#b45309',
                                            background: 'rgba(217, 119, 6, 0.1)',
                                            padding: '1px 4px',
                                            borderRadius: 3,
                                          }}
                                        >
                                          SUPERVISOR
                                        </span>

                                        <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                          Mat: {sup.matricula}
                                        </span>
                                      </div>

                                      <div style={{ fontSize: 11, fontWeight: 700, color: COR_SUPERVISOR_TEXT }}>
                                        {sup.nome}
                                      </div>

                                      <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {sup.cargo}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 2. Supervisores Diretos da Diretoria (Sem Gerente na Unidade) */}
                    {col.directSupervisores.map((sup) => {
                      const isSupHigh = isLeaderHighlighted(sup);
                      return (
                        <div
                          key={sup.id}
                          style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            marginBottom: 10,
                            paddingLeft: 22,
                          }}
                        >
                          {/* Conector horizontal direto do tronco */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 20,
                              left: 8,
                              width: 14,
                              height: 2,
                              background: COR_LINHA,
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: -3,
                                width: 0,
                                height: 0,
                                borderTop: '4px solid transparent',
                                borderBottom: '4px solid transparent',
                                borderLeft: `5px solid ${COR_LINHA}`,
                              }}
                            />
                          </div>

                          <div
                            onClick={() => onSelectLeader && onSelectLeader(sup)}
                            style={{
                              background: COR_SUPERVISOR_BG,
                              border: isSupHigh ? '2px solid #b45309' : `1.5px solid ${COR_SUPERVISOR_BORDER}`,
                              borderRadius: 8,
                              padding: '6px 8px',
                              boxShadow: isSupHigh
                                ? '0 0 0 3px #fbbf24, 0 4px 10px rgba(204, 160, 85, 0.25)'
                                : '0 2px 6px rgba(204, 160, 85, 0.15)',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#b45309';
                              e.currentTarget.style.transform = 'translateX(2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = isSupHigh ? '#b45309' : COR_SUPERVISOR_BORDER;
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span
                                style={{
                                  fontSize: 8.5,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  color: '#b45309',
                                  background: 'rgba(217, 119, 6, 0.1)',
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                }}
                              >
                                SUPERVISOR
                              </span>

                              <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                Mat: {sup.matricula}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, fontWeight: 700, color: COR_SUPERVISOR_TEXT }}>
                              {sup.nome}
                            </div>

                            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sup.cargo}
                            </div>

                            {sup.localTrabalho && (
                              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>
                                {sup.localTrabalho.replace(/^58-[\d.-]+\s*-\s*/, '')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const controlBtnStyle = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: '1px solid var(--border-c)',
  background: 'var(--card-bg)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: '0.15s',
};

const eixoPillStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  borderRadius: 8,
  border: active ? '1px solid #1b2d4f' : '1px solid transparent',
  background: active ? '#1b2d4f' : 'transparent',
  color: active ? '#ffffff' : 'var(--text)',
  fontSize: 11,
  fontWeight: active ? 800 : 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s ease',
});
