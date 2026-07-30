import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const GlassInputWrapper = ({ children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl flex-shrink-0" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
      <p className="text-muted-foreground">{testimonial.handle}</p>
      <p className="mt-1 text-foreground/80">{testimonial.text}</p>
    </div>
  </div>
);

export const SignInPage = ({
  title = <span className="font-light text-foreground tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  heroContent,
  testimonials = [],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  // Configuração
  showEmail = true,
  emailLabel = "Email Address",
  emailPlaceholder = "Enter your email address",
  emailType = "email",
  passwordLabel = "Password",
  passwordPlaceholder = "Enter your password",
  submitLabel = "Sign In",
  secondaryButtonLabel = "Continue with Google",
  secondaryButtonIcon = <GoogleIcon />,
  footerText = "New to our platform?",
  footerLinkText = "Create Account",
  showSecondaryButton = true,
  showFooter = true,
  showRememberMe = true,
  showResetPassword = true,
  errorMessage = "",
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row font-geist w-[100dvw]" style={{ background: 'transparent' }}>
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-bold leading-tight text-[#0D7C3D]">{title}</h1>
            <p className="animate-element animate-delay-200 text-slate-600 font-medium">{description}</p>

            <form className="space-y-5" onSubmit={onSignIn}>
              {showEmail && (
                <div className="animate-element animate-delay-300">
                  <label className="text-sm font-semibold text-slate-700">{emailLabel}</label>
                  <GlassInputWrapper>
                    <input
                      name="email"
                      type={emailType}
                      placeholder={emailPlaceholder}
                      className="w-full text-sm p-4 rounded-2xl focus:outline-none placeholder-slate-400 font-medium"
                      style={{ color: '#1E293B', WebkitTextFillColor: '#1E293B', backgroundColor: 'transparent' }}
                    />
                  </GlassInputWrapper>
                </div>
              )}

              <div className={`animate-element ${showEmail ? 'animate-delay-400' : 'animate-delay-300'}`}>
                <label className="text-sm font-semibold text-slate-700">{passwordLabel}</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={passwordPlaceholder}
                      className="w-full text-sm p-4 pr-12 rounded-2xl focus:outline-none placeholder-slate-400 font-medium"
                      style={{ color: '#1E293B', WebkitTextFillColor: '#1E293B', backgroundColor: 'transparent' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye className="w-5 h-5" />
                      }
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {(showRememberMe || showResetPassword) && (
                <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                  {showRememberMe && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="rememberMe" className="custom-checkbox border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-slate-700 font-medium">Manter conectado</span>
                    </label>
                  )}
                  {showResetPassword && onResetPassword && (
                    <a href="#" onClick={(e) => { e.preventDefault(); onResetPassword?.(); }} className="hover:underline text-emerald-600 transition-colors font-medium">
                      Esqueceu a senha?
                    </a>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="animate-element rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="animate-element animate-delay-600 w-full rounded-2xl bg-[#0D7C3D] py-4 font-semibold text-white hover:bg-[#0D7C3D]/90 active:scale-[0.98] transition-all shadow-md shadow-emerald-900/10"
              >
                {submitLabel}
              </button>
            </form>

            {showSecondaryButton && (
              <>
                <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                  <span className="w-full border-t border-border"></span>
                  <span className="px-4 text-sm text-muted-foreground absolute" style={{ background: 'transparent' }}>ou</span>
                </div>

                <button
                  onClick={onGoogleSignIn}
                  className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors"
                >
                  {secondaryButtonIcon}
                  {secondaryButtonLabel}
                </button>
              </>
            )}

            {showFooter && onCreateAccount && (
              <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
                {footerText}{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); onCreateAccount?.(); }} className="text-emerald-600 hover:underline transition-colors">
                  {footerLinkText}
                </a>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Right column: heroContent (JSX livre) ou hero image + testimonials */}
      {heroContent ? (
        <section className="hidden md:flex flex-1 relative p-4">
          {heroContent}
        </section>
      ) : heroImageSrc ? (
        <section className="hidden md:block flex-1 relative p-4">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && (
                <div className="hidden xl:flex">
                  <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
                </div>
              )}
              {testimonials[2] && (
                <div className="hidden 2xl:flex">
                  <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
};
