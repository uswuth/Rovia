import { useState } from 'react';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const CONSENT_KEY = 'intellmeet_cookie_consent';

type ConsentState = 'pending' | 'accepted' | 'declined';

function getConsent(): ConsentState {
  const stored = localStorage.getItem(CONSENT_KEY);
  return stored === 'accepted' || stored === 'declined' ? stored : 'pending';
}

export function CookieConsent() {
  const [state, setState] = useState<ConsentState>(() => getConsent());

  const handleChoice = (choice: 'accepted' | 'declined') => {
    localStorage.setItem(CONSENT_KEY, choice);
    setState(choice);
  };

  const handleClose = () => {
    handleChoice('declined');
  };

  if (state !== 'pending') return null;

  return (
    <Modal
      open={true}
      onClose={handleClose}
      title="Cookie Settings"
      description="We use cookies to improve your experience. Choose which cookies you allow."
      footer={
        <>
          <Button variant="secondary" onClick={() => handleChoice('declined')}>
            Decline
          </Button>
          <Button onClick={() => handleChoice('accepted')}>
            Accept All
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <div className="flex gap-3 rounded-xs bg-muted/50 p-3">
          <Cookie size={16} className="mt-0.5 shrink-0 text-foreground" />
          <div>
            <span className="font-medium text-foreground">Essential Cookies</span>
            <p className="mt-0.5 text-xs">
              Required for authentication and security. Always on.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xs bg-muted/50 p-3">
          <Cookie size={16} className="mt-0.5 shrink-0 text-foreground" />
          <div>
            <span className="font-medium text-foreground">Preference Cookies</span>
            <p className="mt-0.5 text-xs">
              Remembers your sidebar layout and UI preferences.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xs bg-muted/50 p-3">
          <Cookie size={16} className="mt-0.5 shrink-0 text-foreground" />
          <div>
            <span className="font-medium text-foreground">Analytics Cookies</span>
            <p className="mt-0.5 text-xs">
              Helps us understand how you use IntellMeet. Currently not in use.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
