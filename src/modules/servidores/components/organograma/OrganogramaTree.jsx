import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  Move, Layers, Compass
} from 'lucide-react';
import OrganogramaNode from './OrganogramaNode';

export default function OrganogramaTree({
  rootNode,
  expandedIds,
  onToggleExpand,
  onSelectNode,
  selectedNodeId,
  searchHighlightIds,
  onDrillDownSecretaria,
}) {
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.15, 1.6));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.15, 0.35));
  const handleResetZoom = () => {
    setScale(0.85);
    setPan({ x: 0, y: 0 });
  };

  const handleFitScreen = () => {
    if (!containerRef.current || !contentRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const contentW = contentRef.current.scrollWidth || 1200;
    const idealScale = Math.min(Math.max((containerW - 80) / contentW, 0.4), 1.0);
    setScale(idealScale);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    // Only drag on canvas background, not inside interactive buttons/cards
    if (e.target.closest('button') || e.target.closest('input')) return;
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

  // Wheel zoom (holding ctrl or meta)
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setScale(s => Math.min(Math.max(s + delta, 0.35), 1.6));
    }
  };

  if (!rootNode) {
    return (
      <div
        style={{
          height: 500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--muted-c)',
        }}
      >
        <Layers size={40} style={{ opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: 14 }}>Nenhuma unidade hierárquica encontrada para este filtro.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '620px',
        height: 'calc(100vh - 280px)',
        overflow: 'hidden',
        background: 'var(--bg)',
        backgroundImage: `radial-gradient(circle, var(--border-c) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        borderRadius: 16,
        border: '1px solid var(--border-c)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* Zoom / Pan Floating Control Toolbar */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          padding: '6px 10px',
          borderRadius: 12,
          border: '1px solid var(--border-c)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleZoomIn}
          title="Aumentar zoom (+)"
          style={controlBtnStyle}
        >
          <ZoomIn size={15} />
        </button>

        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--text)',
            minWidth: 42,
            textAlign: 'center',
            fontFamily: 'monospace',
          }}
        >
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={handleZoomOut}
          title="Diminuir zoom (-)"
          style={controlBtnStyle}
        >
          <ZoomOut size={15} />
        </button>

        <div style={{ width: 1, height: 18, background: 'var(--border-c)', margin: '0 2px' }} />

        <button
          onClick={handleResetZoom}
          title="Resetar zoom (100%)"
          style={controlBtnStyle}
        >
          <RotateCcw size={14} />
        </button>

        <button
          onClick={handleFitScreen}
          title="Ajustar à tela"
          style={controlBtnStyle}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Floating Canvas Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--sub)',
          background: 'var(--surface)',
          padding: '4px 10px',
          borderRadius: 8,
          border: '1px solid var(--border-c)',
          pointerEvents: 'none',
          opacity: 0.85,
        }}
      >
        <Move size={12} />
        Arraste para mover • Ctrl + Scroll para zoom
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
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: 40,
          paddingBottom: 80,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: 'top center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <OrganogramaNode
          node={rootNode}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
          searchHighlightIds={searchHighlightIds}
          onDrillDownSecretaria={onDrillDownSecretaria}
        />
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
