import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import Login from '@/pages/Login';
import { useAuth } from '@/contexts/AuthContext';

// Equipamentos e Chamados
import PainelChamados from '@/pages/PainelChamados';
import TodosChamados from '@/pages/TodosChamados';
import AnaliseTendencias from '@/pages/AnaliseTendencias';
import ChamadoDetalhe from '@/pages/ChamadoDetalhe';
import ParqueEquipamentos from '@/pages/ParqueEquipamentos';
import UnidadesMultiplosChamados from '@/pages/UnidadesMultiplosChamados';

// Prévias de Frequência
import SimuladorPrevia from '@/modules/previas/pages/SimuladorPrevia';
import HistoricoPrevias from '@/modules/previas/pages/HistoricoPrevias';
import BiPrevias from '@/modules/previas/pages/BiPrevias';

// Folha de Pagamento
import ImportarFolha from '@/modules/folha/pages/ImportarFolha';
import DashboardFolha from '@/modules/folha/pages/DashboardFolha';
import SimuladorFolha from '@/modules/folha/pages/SimuladorFolha';
import ComparativoFolha from '@/modules/folha/pages/ComparativoFolha';
import ConferenciaFolha from '@/modules/folha/pages/ConferenciaFolha';
import GerenciarUsuarios from '@/modules/admin/pages/GerenciarUsuarios';

// Servidores
import PainelServidores   from '@/modules/servidores/pages/PainelServidores';
import DiretorioServidores from '@/modules/servidores/pages/DiretorioServidores';

function RequireAuth({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

function RequireMaster({ children }) {
  const { isMaster } = useAuth();
  return isMaster ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        {/* Equipamentos e Chamados */}
        <Route index element={<PainelChamados />} />
        <Route path="todos-chamados" element={<TodosChamados />} />
        <Route path="analise-tendencias" element={<AnaliseTendencias />} />
        <Route path="chamado-detalhe" element={<ChamadoDetalhe />} />
        <Route path="parque-equipamentos" element={<ParqueEquipamentos />} />
        <Route path="unidades-multiplos-chamados" element={<UnidadesMultiplosChamados />} />

        {/* Prévias de Frequência */}
        <Route path="previas">
          <Route index element={<Navigate to="simulador" replace />} />
          <Route path="simulador" element={<SimuladorPrevia />} />
          <Route path="historico" element={<HistoricoPrevias />} />
          <Route path="bi" element={<BiPrevias />} />
        </Route>

        {/* Folha de Pagamento */}
        <Route path="folha">
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="importar" element={<RequireAdmin><ImportarFolha /></RequireAdmin>} />
          <Route path="dashboard" element={<DashboardFolha />} />
          <Route path="simulador" element={<SimuladorFolha />} />
          <Route path="comparativo" element={<ComparativoFolha />} />
          <Route path="conferencia" element={<ConferenciaFolha />} />
        </Route>

        {/* Servidores */}
        <Route path="servidores">
          <Route index element={<Navigate to="painel" replace />} />
          <Route path="painel"    element={<PainelServidores />} />
          <Route path="diretorio" element={<DiretorioServidores />} />
        </Route>

        {/* Administração */}
        <Route path="admin">
          <Route path="usuarios" element={<RequireAdmin><GerenciarUsuarios /></RequireAdmin>} />
        </Route>

        {/* Redirecionamentos */}
        <Route path="previas-frequencia" element={<Navigate to="/previas/simulador" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
