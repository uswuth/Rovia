import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/react';
import { ShieldAlert, ArrowLeft, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';

export const UnauthorizedAccess: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user } = useClerk();

  const handleSignOutAndRetry = async () => {
    try {
      await signOut();
    } catch {
      // Ignore signOut errors if session was already invalidated
    }
    navigate('/login', { replace: true });
  };

  const userEmail = user?.primaryEmailAddress?.emailAddress || 'your account';

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden bg-dots-pattern">
      <div className="absolute top-8 left-8">
        <IntellMeetLogo />
      </div>

      <div className="w-full max-w-md bg-card border border-border/80 rounded-sm p-6 sm:p-8 shadow-xl text-center space-y-6 relative z-10">
        <div className="size-14 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mx-auto border border-destructive/25">
          <ShieldAlert size={28} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Access Restricted
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The account <span className="font-semibold text-foreground">{userEmail}</span> is authenticated, but is <strong className="text-destructive">not registered</strong> in an active IntellMeet organization.
          </p>
        </div>

        <div className="p-3.5 rounded-xs bg-muted/40 border border-border/60 text-xs text-muted-foreground text-left space-y-1.5">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Mail size={13} className="text-primary" />
            <span>How to get access:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Only invited and registered members may sign in. Please contact your organization administrator or project lead to invite this email address to your organization.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            onClick={handleSignOutAndRetry}
            className="w-full h-10 gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-xs"
          >
            <LogOut size={14} />
            <span>Sign In With Different Email</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/login')}
            className="w-full h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-xs"
          >
            <ArrowLeft size={13} />
            <span>Back to Login</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

