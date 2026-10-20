import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import { Box, Grid, Stack, Typography } from '@mui/material';

import { useAuth } from '@/context/AuthContext';
import { loginSchema, type LoginFormValues } from '@/schemas/auth.schema';
import { parseApiError } from '@/utils/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';

export const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { userEmail: '', password: '' },
  });

  const location = useLocation();
  const onSubmit = async (data: LoginFormValues) => {
    setServerError('');
    try {
      await login({ userEmail: data.userEmail, password: data.password });
      const returnUrl = (location.state as { from?: string } | null)?.from ||
        sessionStorage.getItem('intellmeet_redirect_url');
      sessionStorage.removeItem('intellmeet_redirect_url');
      if (returnUrl) {
        navigate(returnUrl, { replace: true });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const { message, fieldErrors } = parseApiError(err);
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        setError(field as keyof LoginFormValues, { message: msg });
      });
      setServerError(message);
    }
  };

  const inputCls =
    'h-10.5 rounded-sm border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground shadow-none transition-all hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-[0_0_20px_color-mix(in_srgb,var(--custom-accent,#10b981)_30%,transparent)]';
  const labelCls = 'text-[11px] font-medium text-muted-foreground';

  return (
    <Box
      component="main"
      className="bg-dots-pattern"
      sx={{
        minHeight: '100dvh',
        width: '100%',
        bgcolor: 'var(--background)',
        color: 'var(--foreground)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      { }
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          right: '15%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          pointerEvents: 'none',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--custom-accent, #10b981) 18%, transparent) 0%, transparent 65%)',
          filter: 'blur(60px)',
          zIndex: 1,
        }}
      />

      <Grid container sx={{ minHeight: '100dvh', width: '100%', position: 'relative', zIndex: 2 }}>
        {/* ── Left Hero Column (Inset with all 4 corners rounded) ── */}
        <Grid
          size={{ xs: 12, lg: 6 }}
          sx={{
            display: { xs: 'none', lg: 'flex' },
            p: 1,
            height: { lg: '100dvh' },
            position: { lg: 'sticky' },
            top: 0,
            boxSizing: 'border-box',
          }}
        >
          { }
          <Box
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: '24px',
              overflow: 'hidden',
              position: 'relative',
              p: { lg: 5, xl: 6 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background:
                'linear-gradient(160deg, color-mix(in srgb, var(--custom-accent, #10b981) 95%, #ffffff) 0%, color-mix(in srgb, var(--custom-accent, #10b981) 85%, #f59e0b) 35%, color-mix(in srgb, var(--custom-accent, #10b981) 90%, #d97706) 70%, color-mix(in srgb, var(--custom-accent, #10b981) 75%, #000000) 100%)',
              border: 'none',
              boxShadow:
                '0 10px 30px -5px color-mix(in srgb, var(--custom-accent, #10b981) 30%, rgba(0,0,0,0.1)), 15px 0 45px -10px color-mix(in srgb, var(--custom-accent, #10b981) 40%, rgba(0,0,0,0.25))',
            }}
          >
            { }
            <Box
              sx={{
                position: 'absolute',
                top: '-15%',
                right: '-15%',
                width: '80%',
                height: '70%',
                pointerEvents: 'none',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--custom-accent, #10b981) 40%, #ffedd5) 0%, color-mix(in srgb, var(--custom-accent, #10b981) 75%, #f59e0b) 45%, transparent 75%)',
                filter: 'blur(35px)',
                opacity: 0.9,
              }}
            />

            {/* Deep mesh shadow in bottom corner */}
            <Box
              sx={{
                position: 'absolute',
                bottom: '-20%',
                left: '-15%',
                width: '85%',
                height: '75%',
                pointerEvents: 'none',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--custom-accent, #10b981) 70%, #000000) 0%, transparent 70%)',
                filter: 'blur(50px)',
                opacity: 0.65,
              }}
            />

            { }
            <Box
              sx={{
                position: 'absolute',
                top: '30%',
                left: '20%',
                width: '75%',
                height: '60%',
                pointerEvents: 'none',
                borderRadius: '50%',
                background:
                  'radial-gradient(ellipse at center, color-mix(in srgb, var(--custom-accent, #10b981) 85%, #fde047) 0%, transparent 60%)',
                filter: 'blur(45px)',
                opacity: 0.4,
              }}
            />

            { }
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.22,
                backgroundImage:
                  'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), radial-gradient(rgba(0, 0, 0, 0.3) 1px, transparent 1px)',
                backgroundSize: '4px 4px, 6px 6px',
                backgroundPosition: '0 0, 2px 2px',
                mixBlendMode: 'overlay',
              }}
            />

            { }
            <Box sx={{ position: 'relative', zIndex: 10 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <IntellMeetLogo
                  size={28}
                  color="#ffffff"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                />
                <Typography
                  sx={{
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '1.15rem',
                    letterSpacing: '-0.025em',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  }}
                >
                  Intell<span style={{ opacity: 0.92 }}>Meet</span>
                </Typography>
              </Stack>
            </Box>

            { }
            <Stack spacing={4} sx={{ position: 'relative', zIndex: 10, width: '100%' }}>
              <Stack
                direction={{ xs: 'column', xl: 'row' }}
                spacing={2}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', xl: 'flex-end' },
                }}
              >
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: '2rem', xl: '2.5rem' },
                    fontWeight: 700,
                    lineHeight: 1.15,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Welcome<br />Back
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    maxWidth: 240,
                    lineHeight: 1.5,
                    pb: { xl: 0.5 },
                  }}
                >
                  Sign in to manage your meetings and collaborate with your team.
                </Typography>
              </Stack>

              <Grid container spacing={1.75}>
                {[
                  { n: '1', label: 'Sign in to\nyour account', active: true },
                  { n: '2', label: 'Select your\nworkspace', active: false },
                  { n: '3', label: 'Access your\nmeetings', active: false },
                ].map((step) => (
                  <Grid key={step.n} size={{ xs: 4 }}>
                    <Box
                      sx={{
                        p: { lg: 1.25, xl: 1.75 },
                        height: '100%',
                        borderRadius: '12px',
                        transition: 'all 0.2s ease',
                        border: step.active
                          ? '1px solid rgba(255, 255, 255, 0.9)'
                          : '1px solid rgba(255, 255, 255, 0.25)',
                        bgcolor: step.active
                          ? 'rgba(255, 255, 255, 0.95)'
                          : 'rgba(0, 0, 0, 0.18)',
                        color: step.active ? '#09090b' : '#ffffff',
                        backdropFilter: 'blur(12px)',
                        boxShadow: step.active
                          ? '0 12px 30px -5px rgba(0, 0, 0, 0.35)'
                          : '0 4px 15px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          mb: 1.25,
                          bgcolor: step.active ? '#09090b' : 'rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                        }}
                      >
                        {step.n}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: { lg: '0.72rem', xl: '0.75rem' },
                          fontWeight: 600,
                          lineHeight: 1.35,
                          whiteSpace: 'pre-line',
                          color: step.active ? '#09090b' : 'rgba(255, 255, 255, 0.95)',
                        }}
                      >
                        {step.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Box>
        </Grid>

        {/* ── Right Form Panel (MUI Layout) ── */}
        <Grid
          size={{ xs: 12, lg: 6 }}
          sx={{
            minHeight: '100dvh',
            height: { lg: '100dvh' },
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            px: { xs: 2, sm: 6, lg: 8 },
            py: { xs: 3, sm: 4, lg: 2.5 },
            bgcolor: { xs: 'transparent', lg: 'var(--background)' },
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--border)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: 'var(--muted-foreground)',
            },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 440, mx: 'auto', my: 'auto' }}>
            <Stack spacing={2.5}>
              {/* Brand Logo Header for Small Screens (< 1200px) */}
              <Box sx={{ display: { xs: 'flex', lg: 'none' }, justifyContent: { xs: 'center', sm: 'flex-start' }, mb: 0.5 }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <IntellMeetLogo size={26} />
                  <Typography
                    sx={{
                      color: 'var(--foreground)',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      letterSpacing: '-0.025em',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    Intell<span className="text-primary">Meet</span>
                  </Typography>
                </Stack>
              </Box>

              <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography
                  component="h2"
                  sx={{
                    fontSize: { xs: '1.35rem', sm: '1.55rem' },
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--foreground)',
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', mt: 0.25 }}>
                  Sign in to access your meetings and workspace.
                </Typography>
              </Box>

              {serverError && (
                <Box
                  role="alert"
                  sx={{
                    p: 1.5,
                    borderRadius: '6px',
                    bgcolor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                  }}
                >
                  {serverError}
                </Box>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack spacing={1.75}>
                  <Stack spacing={0.5}>
                    <Label htmlFor="userEmail" className={labelCls}>
                      Email
                    </Label>
                    <Box sx={{ position: 'relative' }}>
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="userEmail"
                        type="email"
                        autoComplete="email"
                        aria-invalid={!!errors.userEmail}
                        aria-describedby={errors.userEmail ? 'userEmail-err' : undefined}
                        className={`${inputCls} pl-10`}
                        {...register('userEmail')}
                      />
                    </Box>
                    {errors.userEmail && (
                      <p id="userEmail-err" role="alert" className="text-[11px] leading-tight text-red-500 mt-0.5">
                        {errors.userEmail.message}
                      </p>
                    )}
                  </Stack>

                  <Stack spacing={0.5}>
                    <Label htmlFor="password" className={labelCls}>
                      Password
                    </Label>
                    <Box sx={{ position: 'relative' }}>
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className={`${inputCls} pl-10 pr-10`}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? 'pass-err' : undefined}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </Box>
                    {errors.password && (
                      <p id="pass-err" role="alert" className="text-[11px] leading-tight text-red-500 mt-0.5">
                        {errors.password.message}
                      </p>
                    )}
                  </Stack>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10.5 mt-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-sm rounded-sm transition-all duration-200 shadow-md cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Signing in…
                      </>
                    ) : (
                      'Log In'
                    )}
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
