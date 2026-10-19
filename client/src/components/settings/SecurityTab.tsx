import React, { useState } from 'react';
import { Lock, Key, Check, X, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { maskEmail } from '@/utils/privacy';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { changePasswordApi } from '@/api/auth/auth.api';
import { parseApiError } from '@/utils/apiError';
import { useToast } from '@/hooks/useToast';
import { SettingsToast } from './SettingsToast';

export const SecurityTab: React.FC = () => {
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const maskedEmail = maskEmail(user?.userEmail || 'user@example.com');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isMinLength = newPassword.length >= 8;
  const hasTypedConfirm = confirmPassword.length > 0;
  const isMatch = hasTypedConfirm && newPassword === confirmPassword;
  const canSubmit = Boolean(currentPassword && newPassword && confirmPassword && isMinLength && isMatch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await changePasswordApi({ currentPassword, newPassword });
      showToast('Your password has been updated successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      showToast(message || 'Failed to update password. Please check your current password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    showToast(`Password reset link sent to ${maskedEmail}. Please check your inbox.`, 'success');
  };

  return (
    <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-6 shadow-xs max-w-2xl">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Lock size={18} className="text-primary shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-foreground">Change Password</h3>
            <p className="text-xs text-muted-foreground">Update your password directly without popups or modals.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-xs font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
        >
          <HelpCircle size={13} />
          <span>Forgot Password?</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Current Password" htmlFor="tab-current-password" required>
          <PasswordInput
            id="tab-current-password"
            autoComplete="current-password"
            required
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            showGenerateButton={false}
            className="text-xs"
          />
        </FormField>

        <FormField label="New Password" htmlFor="tab-new-password" required>
          <PasswordInput
            id="tab-new-password"
            autoComplete="new-password"
            required
            placeholder="Enter new password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            showGenerateButton={false}
            className="text-xs"
          />
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            {newPassword ? (
              isMinLength ? (
                <span className="text-primary font-medium inline-flex items-center gap-1">
                  <Check size={12} /> At least 8 characters
                </span>
              ) : (
                <span className="text-destructive font-medium inline-flex items-center gap-1">
                  <X size={12} /> Must be at least 8 characters
                </span>
              )
            ) : (
              <span className="text-muted-foreground/60">Minimum 8 characters</span>
            )}
          </div>
        </FormField>

        <FormField label="Confirm New Password" htmlFor="tab-confirm-password" required>
          <PasswordInput
            id="tab-confirm-password"
            autoComplete="new-password"
            required
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            showGenerateButton={false}
            className="text-xs"
          />
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            {hasTypedConfirm ? (
              isMatch ? (
                <span className="text-primary font-semibold inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-xs border border-primary/20">
                  <CheckCircle2 size={12} /> Passwords match
                </span>
              ) : (
                <span className="text-destructive font-semibold inline-flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-xs border border-destructive/20">
                  <AlertCircle size={12} /> Passwords do not match
                </span>
              )
            ) : (
              <span className="text-muted-foreground/60">Re-enter your password to verify match</span>
            )}
          </div>
        </FormField>

        <div className="flex items-center justify-end pt-3">
          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="gap-2 text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
          >
            <Key size={14} />
            <span>{submitting ? 'Updating Password…' : 'Update Password'}</span>
          </Button>
        </div>
      </form>

      <SettingsToast toast={toast} />
    </div>
  );
};
