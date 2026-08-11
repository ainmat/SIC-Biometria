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
import MapaEquipamentos from '@/pages/MapaEquipamentos';
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
import MapaDescontos    from '@/modules/folha/pages/MapaDescontos';

// Administração
import GerenciarUsuarios from '@/modules/admin/pages/GerenciarUsuarios';
import ImportarServidores from '@/modules/admin/pages/ImportarServidores';

// Servidores
import PainelServidores      from '@/modules/servidores/pages/PainelServidores';
import DiretorioServidores   from '@/modules/servidores/pages/DiretorioServidores';
import RadarAposentadoria    from '@/modules/servidores/pages/RadarAposentadoria';
import ComissionadosEfetivos from '@/modules/servidores/pages/ComissionadosEfetivos';
import AuditoriaServidores   from '@/modules/servidores/pages/AuditoriaServidores';
import DescompassoEscolaridade from '@/modules/servidores/pages/DescompassoEscolaridade';
import PerfilQuadro          from '@/modules/servidores/pages/PerfilQuadro';
import IndiceSaude           from '@/modules/servidores/pages/IndiceSaude';
import SimuladorCenarios     from '@/modules/servidores/pages/SimuladorCenarios';
import SentinelJornada       from '@/modules/servidores/pages/SentinelJornada';

// Protocolo Digital
import PainelProtocolo       from '@/modules/protocolo/pages/PainelProtocolo';
import ConsultaProtocolo     from '@/modules/protocolo/pages/ConsultaProtocolo';
import NovoProtocolo         from '@/modules/protocolo/pages/NovoProtocolo';



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

function BlockApoio({ children }) {
  const { isApoio } = useAuth();
  return isApoio ? <Navigate to="/folha/dashboard" replace /> : children;
}

export default function App() {
  const { isApoio } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        {/* Equipamentos e Chamados */}
        <Route index element={isApoio ? <Navigate to="/folha/dashboard" replace /> : <PainelChamados />} />
        <Route path="todos-chamados" element={<BlockApoio><TodosChamados /></BlockApoio>} />
        <Route path="analise-tendencias" element={<BlockApoio><AnaliseTendencias /></BlockApoio>} />
        <Route path="chamado-detalhe" element={<BlockApoio><ChamadoDetalhe /></BlockApoio>} />
        <Route path="parque-equipamentos" element={<BlockApoio><ParqueEquipamentos /></BlockApoio>} />
        <Route path="mapa-equipamentos" element={<BlockApoio><MapaEquipamentos /></BlockApoio>} />
        <Route path="unidades-multiplos-chamados" element={<BlockApoio><UnidadesMultiplosChamados /></BlockApoio>} />

        {/* Prévias de Frequência */}
        <Route path="previas">
          <Route index element={isApoio ? <Navigate to="historico" replace /> : <Navigate to="simulador" replace />} />
          <Route path="simulador" element={<BlockApoio><SimuladorPrevia /></BlockApoio>} />
          <Route path="historico" element={<HistoricoPrevias />} />
          <Route path="bi" element={<BiPrevias />} />
          <Route path="ponto" element={<Navigate to="/previas/historico" replace />} />
        </Route>

        {/* Folha de Pagamento */}
        <Route path="folha">
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="importar" element={<RequireAdmin><ImportarFolha /></RequireAdmin>} />
          <Route path="dashboard" element={<DashboardFolha />} />
          <Route path="simulador" element={<SimuladorFolha />} />
          <Route path="comparativo" element={<ComparativoFolha />} />
          <Route path="conferencia" element={<ConferenciaFolha />} />
          <Route path="mapa" element={<MapaDescontos />} />
        </Route>

        {/* Servidores */}
        <Route path="servidores">
          <Route index element={<Navigate to="painel" replace />} />
          <Route path="cockpit"       element={<Navigate to="/servidores/painel" replace />} />
          <Route path="painel"        element={<BlockApoio><PainelServidores /></BlockApoio>} />
          <Route path="diretorio"     element={<BlockApoio><DiretorioServidores /></BlockApoio>} />
          <Route path="aposentadoria" element={<BlockApoio><RadarAposentadoria /></BlockApoio>} />
          <Route path="comissionados" element={<BlockApoio><ComissionadosEfetivos /></BlockApoio>} />
          <Route path="auditoria"     element={<BlockApoio><AuditoriaServidores /></BlockApoio>} />
          <Route path="escolaridade"  element={<BlockApoio><DescompassoEscolaridade /></BlockApoio>} />
          <Route path="perfil"        element={<BlockApoio><PerfilQuadro /></BlockApoio>} />
          <Route path="genero"        element={<Navigate to="/servidores/perfil" replace />} />
          <Route path="ondas"         element={<Navigate to="/servidores/perfil" replace />} />
          <Route path="saude"         element={<BlockApoio><IndiceSaude /></BlockApoio>} />
          <Route path="simulador"     element={<BlockApoio><SimuladorCenarios /></BlockApoio>} />
          <Route path="sentinel"      element={<BlockApoio><SentinelJornada /></BlockApoio>} />
        </Route>

        {/* Protocolo Digital */}
        <Route path="protocolos">
          <Route index element={<Navigate to="painel" replace />} />
          <Route path="painel" element={<BlockApoio><PainelProtocolo /></BlockApoio>} />
          <Route path="consulta" element={<BlockApoio><ConsultaProtocolo /></BlockApoio>} />
          <Route path="novo" element={<BlockApoio><NovoProtocolo /></BlockApoio>} />
        </Route>

        {/* Administração */}
        <Route path="admin">
          <Route path="usuarios" element={<RequireAdmin><GerenciarUsuarios /></RequireAdmin>} />
          <Route path="servidores/importar" element={<RequireAdmin><ImportarServidores /></RequireAdmin>} />
        </Route>

        {/* Redirecionamentos */}
        <Route path="previas-frequencia" element={<Navigate to="/previas/simulador" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
