import { useLocation, useNavigate } from 'react-router-dom';
import { fmtDate } from '@/lib/utils';

export default function ChamadoDetalhe() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const chamado = state?.chamado;

  if (!chamado) {
    return (
      <div>
        <div className="topbar">
          <div className="topbar-left">
            <h1>Detalhe do Chamado</h1>
          </div>
        </div>
        <div className="content">
          <p style={{ color: 'var(--muted-c)' }}>
            Nenhum chamado selecionado.{' '}
            <button
              onClick={() => navigate('/')}
              style={{ color: 'var(--accent-c)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Voltar ao painel
            </button>
          </p>
        </div>
      </div>
    );
  }

  const st = chamado.status || 'Aguardando Atendimento';

  const campos = [
    ['Ticket', `#${chamado.ticket}`],
    ['Status', st],
    ['Unidade', chamado.unidade],
    ['Secretaria', chamado.secretaria],
    ['Motivo', chamado.motivo],
    ['Responsável', chamado.responsavel],
    ['Data de Abertura', fmtDate(chamado.data_abertura)],
    ['Data de Atualização', fmtDate(chamado.updated_at)],
  ];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Detalhe do Chamado #{chamado.ticket}</h1>
          <p>
            <button
              onClick={() => navigate(-1)}
              style={{ color: 'var(--accent-c)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
            >
              ← Voltar
            </button>
          </p>
        </div>
      </div>

      <div className="content">
        <div className="chart-card" style={{ maxWidth: 760 }}>
          <div className="chamado-modal-grid" style={{ marginBottom: 16 }}>
            {campos.map(([label, value]) => (
              <div key={label} className="chamado-modal-item">
                <div className="chamado-modal-label">{label}</div>
                <div className="chamado-modal-value">{value || '—'}</div>
              </div>
            ))}
          </div>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Descrição</div>
            <div className="chamado-modal-desc">{chamado.problema || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
