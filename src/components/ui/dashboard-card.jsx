/**
 * dashboard-card.jsx
 * Suportam modo claro e escuro via `isDark` prop ou hook interno.
 */
import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/* ─── Variants de animação ────────────────────────────────────────────────── */
const kpiContainerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const kpiItemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 340,
      damping: 22,
      mass: 0.8,
    },
  },
};

/* ─── AnimatedNumber ──────────────────────────────────────────────────────── */
export function AnimatedNumber({ value }) {
  const isNumber = typeof value === 'number';
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 30, mass: 1 });

  useEffect(() => {
    if (isNumber) {
      motionValue.set(value);
    }
  }, [value, isNumber, motionValue]);

  const display = useTransform(springValue, (current) => {
    return Math.round(current).toLocaleString('pt-BR');
  });

  if (!isNumber) {
    return <span>{value}</span>;
  }

  return <motion.span>{display}</motion.span>;
}

/* ─── Tokens de tema ──────────────────────────────────────────────────────── */
export function useDashboardTheme(isDark) {
  return {
    card:        isDark ? 'rgba(15,23,42,0.85)'  : 'rgba(255,255,255,0.9)',
    border:      isDark ? 'rgba(51,65,85,0.9)'   : 'rgba(226,232,240,0.9)',
    borderHover: isDark ? 'rgba(16,185,129,0.4)' : 'rgba(13,124,61,0.25)',
    text:        isDark ? '#f1f5f9'              : '#0f172a',
    muted:       isDark ? '#94a3b8'              : '#64748b',
    grid:        isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    tooltipBg:   isDark ? 'rgba(15,23,42,0.97)'  : 'rgba(255,255,255,0.97)',
    tooltipBorder: isDark ? '#334155'            : '#e2e8f0',
  };
}

/* ─── Chart.js tooltip style factory ─────────────────────────────────────── */
export function chartTooltipStyle(isDark) {
  const t = useDashboardTheme(isDark);
  return {
    backgroundColor: t.tooltipBg,
    titleColor:      t.text,
    bodyColor:       t.muted,
    borderColor:     t.tooltipBorder,
    borderWidth:     1,
    padding:         12,
    cornerRadius:    10,
    displayColors:   true,
  };
}

/* ─── KpiCard ─────────────────────────────────────────────────────────────── */
/**
 * @param {object} props
 * @param {string}    props.label        - Label de título
 * @param {string|number} props.value    - Valor principal
 * @param {string}    [props.sub]        - Texto/tag secundária
 * @param {string}    [props.cor]        - Cor do acento e ícone (#hex)
 * @param {React.ReactNode} [props.icon] - Ícone lucide-react
 * @param {string}    [props.trend]      - 'up' | 'down' | null
 * @param {string}    [props.trendLabel] - Ex: "+12.5%"
 * @param {boolean}   [props.isDark]
 */
export function KpiCard({ label, value, sub, cor = '#0D7C3D', icon, trend, trendLabel, isDark = true }) {
  const t = useDashboardTheme(isDark);
  const accentRgb = hexToRgb(cor);
  const accentBg  = accentRgb ? `rgba(${accentRgb},0.12)` : 'rgba(13,124,61,0.12)';
  const accentBrd = accentRgb ? `rgba(${accentRgb},0.25)` : 'rgba(13,124,61,0.25)';

  return (
    <motion.div
      className="kpi-card"
      variants={kpiItemVariants}
      whileHover={{
        borderColor: t.borderHover,
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.1)',
        y: -2,
        transition: { duration: 0.2 },
      }}
      style={{
        background:    t.card,
        border:        `1px solid ${t.border}`,
        borderRadius:  18,
        padding:       '18px 20px',
        backdropFilter:'blur(12px)',
        boxShadow:     isDark
          ? '0 4px 24px rgba(0,0,0,0.3)'
          : '0 2px 16px rgba(0,0,0,0.06)',
        position:      'relative',
        overflow:      'hidden',
        willChange:    'transform, opacity',
      }}
    >
      {/* Glow de fundo */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 100, height: 100,
        borderRadius: '50%', background: accentBg, filter: 'blur(24px)', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.muted }}>
          {label}
        </span>
        {icon && (
          <div style={{
            padding: '8px', borderRadius: 12,
            background: accentBg, border: `1px solid ${accentBrd}`,
            color: cor, display: 'flex', alignItems: 'center',
          }}>
            {React.cloneElement(icon, { size: 18 })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span className="text-primary" style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
          <AnimatedNumber value={value} />
        </span>
        {trend && trendLabel && (
          <span style={{
            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2,
            color: trend === 'up' ? '#10b981' : '#ef4444',
          }}>
            {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {trendLabel}
          </span>
        )}
      </div>

      {sub && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
          background: accentBg, color: cor, border: `1px solid ${accentBrd}`,
        }}>
          {sub}
        </span>
      )}
    </motion.div>
  );
}

/* ─── ChartCard ───────────────────────────────────────────────────────────── */
/**
 * @param {object} props
 * @param {string}  props.title
 * @param {string}  [props.subtitle]
 * @param {string}  [props.badge]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.actions] - Botões no canto direito do header
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.isDark]
 * @param {object}  [props.style]        - Estilos extras no wrapper
 * @param {object}  [props.bodyStyle]    - Estilos extras no corpo
 */
export function ChartCard({ title, subtitle, badge, icon, actions, children, isDark = true, style = {}, bodyStyle = {} }) {
  const t = useDashboardTheme(isDark);

  return (
    <div className="chart-card" style={{
      background:    t.card,
      border:        `1px solid ${t.border}`,
      borderRadius:  18,
      padding:       '20px 22px',
      backdropFilter:'blur(12px)',
      boxShadow:     isDark ? '0 4px 24px rgba(0,0,0,0.25)' : '0 2px 16px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && (
            <div style={{ color: '#0D7C3D', display: 'flex', alignItems: 'center' }}>
              {React.cloneElement(icon, { size: 18 })}
            </div>
          )}
          <div>
            <div className="text-primary" style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>{title}</div>
            {subtitle && <div className="text-muted" style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              background: 'rgba(13,124,61,0.1)', color: '#0D7C3D',
              border: '1px solid rgba(13,124,61,0.2)', fontFamily: 'monospace',
            }}>
              {badge}
            </span>
          )}
          {actions}
        </div>
      </div>
      {/* Body */}
      <div style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

/* ─── KpiGrid — wrapper animado com stagger ──────────────────────────────── */
/**
 * Wrapper para animar um grupo de KpiCards com entrada escalonada.
 * Aceita os mesmos props de style de um div grid.
 *
 * @param {object}  props
 * @param {object}  [props.style]    - Estilos extras do grid container
 * @param {string}  [props.className]
 * @param {React.ReactNode} props.children - KpiCards filhos
 */
export function KpiGrid({ children, style = {}, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={kpiContainerVariants}
      initial="hidden"
      animate="show"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Utilidades ─────────────────────────────────────────────────────────── */
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : null;
}

/**
 * Retorna as opções padrão de escala Chart.js com suporte a tema.
 */
export function chartScaleOpts(isDark, { beginAtZero = true } = {}) {
  const t = useDashboardTheme(isDark);
  return {
    x: {
      ticks: { color: t.muted, font: { size: 10, family: 'Inter' } },
      grid:  { color: t.grid },
    },
    y: {
      ticks: { color: t.muted, font: { size: 10, family: 'Inter' } },
      grid:  { color: t.grid },
      beginAtZero,
    },
  };
}
