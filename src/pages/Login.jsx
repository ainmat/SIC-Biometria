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
        background: 'linear-gradient(90deg, transparent, rgba(13, 124, 61, 0.12), transparent)',
      }} />
      <img
        src={logoDarh}
        alt="DARH"
        style={{ width: '50%', maxWidth: 260, filter: 'drop-shadow(0 2px 12px rgba(13,124,61,0.08))' }}
      />
      <div style={{
        width: '60%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(13, 124, 61, 0.12), transparent)',
      }} />
      <div style={{ textAlign: 'center', color: '#0D7C3D', fontWeight: 600, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Sistema de Informações e Controle · Biometria
      </div>
    </div>
  );
}

export default function Login() {
  const { loginUser } = useAuth();
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

  return (
    <div style={{ position: 'relative', width: '100dvw', height: '100dvh', overflow: 'hidden', background: '#F5F7FA' }}>
      {/* Partículas de fundo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <SparklesCore
          id="login-sparkles-active-green"
          background="transparent"
          minSize={1.0}
          maxSize={2.5}
          particleDensity={70}
          particleColor="#0D7C3D"
          speed={0.4}
          className="w-full h-full"
        />
      </div>

      {/* SignInPage acima das partículas */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <SignInPage
          title={
            <span className="text-[#0D7C3D] font-bold">
              SIC{' '}
              <span style={{ fontWeight: 300, opacity: 0.7 }}>·</span>{' '}
              <span style={{ fontWeight: 300 }}>Biometria</span>
            </span>
          }
          description="Prefeitura de Osasco — acesso restrito a servidores autorizados."
          heroContent={<HeroPainel />}
          onSignIn={handleSignIn}
          showEmail={true}
          emailType="text"
          emailLabel="Usuário"
          emailPlaceholder="seu.usuario"
          passwordLabel="Senha"
          passwordPlaceholder="Digite a senha de acesso..."
          submitLabel="Entrar"
          showSecondaryButton={false}
          showRememberMe={false}
          showResetPassword={false}
          showFooter={false}
          errorMessage={erro}
        />
      </div>
    </div>
  );
}
