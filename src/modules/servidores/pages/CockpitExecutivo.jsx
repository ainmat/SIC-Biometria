import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, Clock, Shield, Database, AlertTriangle } from 'lucide-react';
import { fetchResumoServidores } from '@/modules/servidores/services/servidoresService';
import { isComissionado, anosParaAposentadoria, ALERTAS, APOSENTADORIA } from '@/modules/servidores/config/servidoresConfig';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const pct = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : '0.0');

function parseBR(s) {
  if (!s) return null;
  const [dmy] = s.split(' ');
  const [d, m, y] = dmy.split('/');
  const dt = new Date(`${y}-${m}-${d}`);
  return isNaN(dt) ? null : dt;
}

function AlertCard({ icon: Icon, label, value, sub, status = 'ok', link }) {
  const cor =
    status === 'alert' ? '#ef4444' :
    status === 'warn'  ? '#f59e0b' : '#10b981';

  const card = (
    <div style={{
      flex: 1, minWidth: 200,
      background: 'linear-gradient(160deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.015) 100%)',
      border: `1px solid ${status === 'alert' ? 'rgba(239,68,68,.3)' : status === 'warn' ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,.08)'}`,
      borderTop: `3px solid ${cor}`, borderRadius: 14, padding: '18px 20px',
      cursor: link ? 'pointer' : 'default', textDecoration: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color={cor} />
          </div>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
        </div>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: cor, display: 'block' }} />
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#f8fafc', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{sub}</div>}
      {link && <div style={{ fontSize: 10, color: cor, marginTop: 8, fontWeight: 600 }}>Ver detalhes →</div>}
    </div>
  );

  return link
    ? <Link to={link} style={{ flex: 1, minWidth: 200, textDecoration: 'none' }}>{card}</Link>
    : card;
}

const QUICK_LINKS = [
  { to: '/servidores/painel',        label: 'Painel Geral',             desc: 'Distribuições por secretaria, regime e faixa etária' },
  { to: '/servidores/aposentadoria', label: 'Radar de Aposentadoria',   desc: 'Projeção de saídas e cargos sem sucessão' },
  { to: '/servidores/comissionados', label: 'Comissionados × Efetivos', desc: 'Proporção de cargos em comissão por secretaria' },
  { to: '/servidores/auditoria',     label: 'Auditoria de Dados',       desc: 'Registros com inconsistências ou campos vazios' },
  { to: '/servidores/diretorio',     label: 'Diretório',                desc: 'Consulta individual de servidores' },
];

export default function CockpitExecutivo() {
  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);

  useEffect(() => {
    fetchResumoServidores()
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  const dozeMesesAtras = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d; }, []);

  const kpis = useMemo(() => {
    if (!dados.length) return null;
    const total    = dados.length;
    const recentes = dados.filter(r => { const dt = parseBR(r.DtAdmissao); return dt && dt >= dozeMesesAtras; }).length;
    const nComiss  = dados.filter(isComissionado).length;
    const pctComiss = total > 0 ? (nComiss / total) * 100 : 0;
    const elegiveis = dados.filter(r => anosParaAposentadoria(r) === 0).length;
    const proximosN = dados.filter(r => { const a = anosParaAposentadoria(r); return a > 0 && a <= APOSENTADORIA.alertaAntes; }).length;
    const incompletos = dados.filter(r => !r.Nome_Funcionario?.trim() || !r.Des_Cargo?.trim() || !r.Des_Secretaria?.trim()).length;
    return { total, recentes, nComiss, pctComiss, elegiveis, proximosN, incompletos };
  }, [dados, dozeMesesAtras]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Cockpit Executivo</h1>
          <p>Visão estratégica do quadro de pessoal</p>
        </div>
        <div className="topbar-right"><TopbarAvatar /></div>
      </div>

      <div className="content">
        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569', fontSize: 14 }}>Carregando dados...</div>}
        {erro    && <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontSize: 13 }}>{erro}</div>}

        {kpis && (
          <>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 11, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} />
              Indicadores de aposentadoria são estimativas (EC 103/2019, parâmetros configuráveis). Confirme com RH/Jurídico antes de usar para decisões formais.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
              <AlertCard icon={Users}       label="Total de servidores"         value={fmt(kpis.total)}     sub={`${new Set(dados.map(r => r.Des_Secretaria).filter(Boolean)).size} secretarias`} status="ok" />
              <AlertCard icon={TrendingUp}  label="Admissões (12 meses)"        value={fmt(kpis.recentes)}  sub="novas admissões no período" status={kpis.recentes === 0 ? 'warn' : 'ok'} />
              <AlertCard icon={Shield}      label="Comissionados"               value={`${pct(kpis.nComiss, kpis.total)}%`} sub={`${fmt(kpis.nComiss)} servidores`} status={kpis.pctComiss > ALERTAS.maxPctComissionados ? 'alert' : 'ok'} link="/servidores/comissionados" />
              <AlertCard icon={Clock}       label="Elegíveis à aposentadoria"   value={fmt(kpis.elegiveis)} sub="já atingiram os requisitos mínimos" status={kpis.elegiveis > 0 ? 'warn' : 'ok'} link="/servidores/aposentadoria" />
              <AlertCard icon={Clock}       label={`Elegíveis em até ${APOSENTADORIA.alertaAntes} anos`} value={fmt(kpis.proximosN)} sub="atenção à sucessão" status={kpis.proximosN > 200 ? 'alert' : kpis.proximosN > 0 ? 'warn' : 'ok'} link="/servidores/aposentadoria" />
              <AlertCard icon={Database}    label="Dados incompletos"           value={fmt(kpis.incompletos)} sub="campos críticos vazios" status={kpis.incompletos > 0 ? 'warn' : 'ok'} link="/servidores/auditoria" />
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Navegação rápida</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              {QUICK_LINKS.map(({ to, label, desc }) => (
                <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                  <div
                    style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', transition: 'border-color .15s, background .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'; e.currentTarget.style.background = 'rgba(99,102,241,.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
