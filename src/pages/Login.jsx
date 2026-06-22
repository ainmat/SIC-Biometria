import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SignInPage } from '@/components/ui/sign-in';
import { SparklesCore } from '@/components/ui/sparkles';
import logoPrefeitura from '../../img/logo-prefeitura-osasco.png';
import logoDarh from '../../img/logo-darh.png';


function HeroPainel() {
  return (
    <div
      className="animate-slide-right animate-delay-300 w-full h-full flex flex-col items-center justify-center gap-10"
    >
      <img
        src={logoPrefeitura}
        alt="Prefeitura de Osasco"
        style={{ width: '72%', maxWidth: 380, filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.5))' }}
      />
      <div style={{
        width: '60%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
      }} />
      <img
        src={logoDarh}
        alt="DARH"
        style={{ width: '50%', maxWidth: 260, filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.5))' }}
      />
      <div style={{
        width: '60%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
      }} />
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Sistema de Informações e Controle · Biometria
      </div>
    </div>
  );
}

const VisitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function Login() {
  const { loginUser, loginVisitor } = useAuth();
  const navigate = useNavigate();
  const [erro,       setErro]       = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSignIn(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = (formData.get('email') || '').trim();
    const senha    = formData.get('password') || '';
    setErro('');
    setCarregando(true);
    try {
      await loginUser(username, senha);
      navigate('/', { replace: true });
    } catch {
      setErro('Usuário ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  function handleVisitor() {
    loginVisitor();
    navigate('/', { replace: true });
  }

  return (
    <div style={{ position: 'relative', width: '100dvw', height: '100dvh', overflow: 'hidden', background: '#080d1a' }}>
      {/* Partículas de fundo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <SparklesCore
          id="login-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1.2}
          particleDensity={80}
          particleColor="#FFFFFF"
          speed={0.6}
          className="w-full h-full"
        />
      </div>

      {/* SignInPage acima das partículas */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <SignInPage
          title={
            <span>
              SIC{' '}
              <span style={{ fontWeight: 300, opacity: 0.7 }}>·</span>{' '}
              <span style={{ fontWeight: 300 }}>Biometria</span>
            </span>
          }
          description="Prefeitura de Osasco — acesso restrito a servidores autorizados."
          heroContent={<HeroPainel />}
          onSignIn={handleSignIn}
          onGoogleSignIn={handleVisitor}
          showEmail={true}
          emailType="text"
          emailLabel="Usuário"
          emailPlaceholder="seu.usuario"
          passwordLabel="Senha"
          passwordPlaceholder="Digite a senha de acesso..."
          submitLabel="Entrar"
          secondaryButtonLabel="Entrar como Visitante"
          secondaryButtonIcon={<VisitorIcon />}
          showRememberMe={false}
          showResetPassword={false}
          showFooter={false}
          errorMessage={erro}
        />
      </div>
    </div>
  );
}
