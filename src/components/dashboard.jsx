import React, { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Separator from '@radix-ui/react-separator';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ChevronDown,
  Layers,
  Sparkles,
  ArrowUpRight,
  MonitorCheck
} from 'lucide-react';

const mockTrendData = [
  { name: 'Seg', chamados: 42, resolvidos: 38 },
  { name: 'Ter', chamados: 58, resolvidos: 50 },
  { name: 'Qua', chamados: 65, resolvidos: 61 },
  { name: 'Qui', chamados: 49, resolvidos: 45 },
  { name: 'Sex', chamados: 72, resolvidos: 68 },
  { name: 'Sáb', chamados: 25, resolvidos: 24 },
  { name: 'Dom', chamados: 18, resolvidos: 18 },
];

const mockCategoryData = [
  { name: 'Leitor Biométrico', value: 45, color: '#10b981' },
  { name: 'Conectividade / Rede', value: 25, color: '#3b82f6' },
  { name: 'Alimentação / Energia', value: 18, color: '#f59e0b' },
  { name: 'Software / Sistema', value: 12, color: '#8b5cf6' },
];

export function Dashboard() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSec, setSelectedSec] = useState('Todas');

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#0f172a]/80 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Ocorrências</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">329</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-0.5">
              +12.5% <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Registrados este mês em Osasco</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#0f172a]/80 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chamados Resolvidos</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">304</span>
            <span className="text-xs font-semibold text-blue-400 flex items-center gap-0.5">
              92.4% taxa
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Solucionados com sucesso</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#0f172a]/80 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Em Atendimento</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">25</span>
            <span className="text-xs font-semibold text-amber-400">Ativos agora</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Tempo médio de resposta: 24m</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#0f172a]/80 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md group hover:border-teal-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Relógios Online</span>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <MonitorCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">184 / 190</span>
            <span className="text-xs font-semibold text-teal-400">96.8%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Terminais em operação live</p>
        </div>
      </div>

      {/* Radix Collapsible Filters Panel */}
      <Collapsible.Root open={filterOpen} onOpenChange={setFilterOpen} className="bg-[#0f172a]/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Filtros & Métricas Avançadas</span>
            <span className="text-xs text-slate-400 ml-2 font-mono">Secretaria: {selectedSec}</span>
          </div>
          <Collapsible.Trigger asChild>
            <button className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 px-3 py-1.5 rounded-xl transition-all">
              <span>{filterOpen ? 'Ocultar Filtros' : 'Expandir Filtros'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
          </Collapsible.Trigger>
        </div>

        <Collapsible.Content className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in-50">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Filtrar por Secretaria</label>
            <select 
              value={selectedSec} 
              onChange={(e) => setSelectedSec(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 p-2.5 focus:outline-none focus:border-emerald-500/60"
            >
              <option value="Todas">Todas as Secretarias</option>
              <option value="Saúde">Saúde (SS)</option>
              <option value="Educação">Educação (SED)</option>
              <option value="Administração">Administração (SADM)</option>
              <option value="Segurança">Segurança (SESTRAN)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Período de Análise</label>
            <select className="w-full bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 p-2.5 focus:outline-none focus:border-emerald-500/60">
              <option>Últimos 30 Dias</option>
              <option>Última Semana</option>
              <option>Este Ano (2026)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Status dos Relógios</label>
            <select className="w-full bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 p-2.5 focus:outline-none focus:border-emerald-500/60">
              <option>Todos os Status</option>
              <option>Operando Normalmente</option>
              <option>Requer Manutenção</option>
            </select>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Main Charts Row with Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-[#0f172a]/80 border border-slate-800/90 rounded-2xl p-6 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Volume de Chamados semanal
              </h3>
              <p className="text-xs text-slate-400">Comparativo entre chamados abertos e resolvidos</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Resolvidos
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Chamados
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorResolvidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorChamados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="chamados" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorChamados)" />
                <Area type="monotone" dataKey="resolvidos" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorResolvidos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Motivos Donut Chart */}
        <div className="bg-[#0f172a]/80 border border-slate-800/90 rounded-2xl p-6 shadow-lg backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-emerald-400" />
              Motivos de Ocorrências
            </h3>
            <p className="text-xs text-slate-400 mb-4">Distribuição por categoria técnica</p>

            <div className="h-52 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {mockCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-slate-800/80">
            {mockCategoryData.map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
                <span className="font-mono font-bold text-white">{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
