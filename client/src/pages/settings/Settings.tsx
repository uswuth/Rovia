import React, { useState, useCallback } from 'react';
import { Settings as SettingsIcon, User, Shield, Key, Clock, Check, X, Lock, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { maskEmail } from '@/utils/privacy';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Modal, ModalFooterCancel } from '@/components/ui/modal';
import { changePasswordApi } from '@/api/auth/auth.api';
import { parseApiError } from '@/utils/apiError';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { timeFormat, setTimeFormat, formatTimeStr } = useTimeFormat();
  const maskedEmail = maskEmail(user?.userEmail || 'arlo@solution.com');

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Real-time Validation Flags
  const isMinLength = newPassword.length >= 6;
  const hasTypedConfirm = confirmPassword.length > 0;
  const isMatch = hasTypedConfirm && newPassword === confirmPassword;
  const canSubmit = Boolean(currentPassword && newPassword && confirmPassword && isMinLength && isMatch);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    if (!canSubmit) return;

    try {
      setSubmitting(true);
      await changePasswordApi({
        currentPassword,
        newPassword,
      });
      setSuccessMessage('Your password has been updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setSuccessMessage('');
      }, 1500);
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      setServerError(message || 'Failed to update password. Please check your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmailSent(true);
    setTimeout(() => setResetEmailSent(false), 5000);
  };

  const closeModal = useCallback(() => {
    setIsPasswordModalOpen(false);
    setServerError('');
    setSuccessMessage('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const sampleDate = new Date();

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <SettingsIcon className="text-emerald-500 dark:text-emerald-400" size={24} />
          <span>Settings</span>
        </h1>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
        {/* Profile Info */}
        <div className="rounded-md border border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-md text-card-foreground p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <User size={16} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Profile Details</h3>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-muted-foreground font-medium block mb-1">User Name</label>
              <div className="p-2.5 bg-secondary/70 border border-border/80 rounded-md font-semibold text-foreground">
                {user?.userName || 'arlo'}
              </div>
            </div>
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Masked Email</label>
              <div className="p-2.5 bg-secondary/70 border border-border/80 rounded-md font-mono text-muted-foreground">
                {maskedEmail}
              </div>
            </div>
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Assigned Role</label>
              <div className="p-2.5 bg-secondary/70 border border-border/80 rounded-md text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <Shield size={13} />
                {user?.userRole || 'SuperAdmin'}
              </div>
            </div>
          </div>
        </div>

        {/* Display & Time Preferences */}
        <div className="rounded-md border border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-md text-card-foreground p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Clock size={16} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Time Display Format</h3>
          </div>
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Choose your preferred time format for meeting schedules, timers, and timestamps across the application.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTimeFormat('12h')}
                className={`flex items-center justify-center p-4 rounded-lg border transition-all cursor-pointer ${
                  timeFormat === '12h'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                }`}
              >
                <span className="text-sm font-bold">12-Hour</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeFormat('24h')}
                className={`flex items-center justify-center p-4 rounded-lg border transition-all cursor-pointer ${
                  timeFormat === '24h'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                }`}
              >
                <span className="text-sm font-bold">24-Hour</span>
              </button>
            </div>

            <div className="p-3 bg-secondary/70 border border-border/80 rounded-md flex items-center justify-between">
              <span className="text-muted-foreground">Current Live Preview:</span>
              <span className="font-mono font-bold text-foreground">{formatTimeStr(sampleDate)}</span>
            </div>
          </div>
        </div>

        {/* Clean Password Settings Row */}
        <div className="rounded-md border border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-md text-card-foreground p-6 space-y-4 shadow-xs md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <span>Password</span>
                  <span className="text-xs font-mono text-muted-foreground font-normal">••••••••••••</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ensure your account uses a strong, secure password.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:self-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <HelpCircle size={13} />
                <span>Forgot Password?</span>
              </button>
              <Button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="gap-2 text-xs font-bold cursor-pointer"
              >
                <Key size={14} />
                <span>Update Password</span>
              </Button>
            </div>
          </div>

          {resetEmailSent && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in duration-200">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
              <span>Password reset link sent to <strong>{maskedEmail}</strong>. Please check your inbox.</span>
            </div>
          )}
        </div>
      </div>

      {/* Password Update Modal */}
      <Modal
        open={isPasswordModalOpen}
        onClose={closeModal}
        title="Update Password"
        showCloseButton
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {/* Hidden Username Field for Accessibility & Password Manager Integration */}
          <input
            type="text"
            name="username"
            value={user?.userEmail || user?.userName || ''}
            readOnly
            autoComplete="username"
            className="hidden"
          />

          {/* Current Password */}
          <FormField label="Current Password" htmlFor="modal-current-password" required>
            <PasswordInput
              id="modal-current-password"
              autoComplete="current-password"
              required
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              showGenerateButton={false}
              className="text-xs"
            />
          </FormField>

          {/* New Password */}
          <FormField label="New Password" htmlFor="modal-new-password" required>
            <PasswordInput
              id="modal-new-password"
              autoComplete="new-password"
              required
              placeholder="Enter new password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              showGenerateButton={false}
              className="text-xs"
            />
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {newPassword ? (
                isMinLength ? (
                  <span className="text-emerald-500 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                    <Check size={12} /> At least 6 characters
                  </span>
                ) : (
                  <span className="text-rose-500 font-medium inline-flex items-center gap-1">
                    <X size={12} /> Must be at least 6 characters
                  </span>
                )
              ) : (
                <span className="text-muted-foreground/60">Must be at least 6 characters</span>
              )}
            </div>
          </FormField>

          {/* Confirm Password */}
          <FormField label="Confirm New Password" htmlFor="modal-confirm-password" required>
            <PasswordInput
              id="modal-confirm-password"
              autoComplete="new-password"
              required
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              showGenerateButton={false}
              className="text-xs"
            />
            {/* Real-time Match Feedback Indicator */}
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {hasTypedConfirm ? (
                isMatch ? (
                  <span className="text-emerald-500 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
                    <CheckCircle2 size={12} /> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-500 font-semibold inline-flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-sm border border-rose-500/20">
                    <AlertCircle size={12} /> Passwords do not match
                  </span>
                )
              ) : (
                <span className="text-muted-foreground/60">Re-enter your password to verify match</span>
              )}
            </div>
          </FormField>

          {/* Error and Success Alerts */}
          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-5">
            <ModalFooterCancel onClick={closeModal} disabled={submitting} />
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="gap-2 text-xs font-bold cursor-pointer"
            >
              <Key size={14} />
              <span>{submitting ? 'Updating Password…' : 'Update Password'}</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
