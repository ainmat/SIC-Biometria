import React from 'react';
import * as Avatar from '@radix-ui/react-avatar';
import * as Separator from '@radix-ui/react-separator';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ShieldCheck,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

export function AppShell({ children, title = "Painel de Controle", subtitle = "Prefeitura de Osasco · Biometria & Gestão" }) {
  return (
    <div className="min-h-screen w-full bg-[#070b14] text-slate-100 flex flex-col font-sans antialiased">
      {/* Header / Top Bar Efferd Style */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0c1222]/90 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-900/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                {title}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.0
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar chamado, servidor ou unidade..." 
              className="bg-slate-900/90 border border-slate-800 text-xs text-slate-200 rounded-xl pl-9 pr-4 py-2 w-64 focus:outline-none focus:border-emerald-500/60 transition-all placeholder:text-slate-500"
            />
          </div>

          <button className="relative p-2 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <Separator.Root orientation="vertical" className="h-6 w-[1px] bg-slate-800" />

          {/* Radix Dropdown Menu for Avatar */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2.5 p-1 pr-2 rounded-xl hover:bg-slate-800/60 transition-all focus:outline-none">
                <Avatar.Root className="w-8 h-8 rounded-full bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  <Avatar.Image src="" alt="Admin" />
                  <Avatar.Fallback className="text-white font-bold text-xs">AD</Avatar.Fallback>
                </Avatar.Root>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold text-white leading-tight">Administrador</p>
                  <p className="text-[10px] text-emerald-400 font-mono">DARH · Osasco</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-[180px] bg-[#0F172A] border border-slate-800 rounded-xl p-1.5 shadow-2xl z-50 text-xs text-slate-200 animate-in fade-in-80"
                sideOffset={8}
              >
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 cursor-pointer focus:outline-none">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Meu Perfil
                </DropdownMenu.Item>
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 cursor-pointer focus:outline-none">
                  <Settings className="w-3.5 h-3.5 text-slate-400" /> Configurações
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-[1px] bg-slate-800 my-1" />
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 cursor-pointer focus:outline-none">
                  <LogOut className="w-3.5 h-3.5" /> Sair do Sistema
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 w-full p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
