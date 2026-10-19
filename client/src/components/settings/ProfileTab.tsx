import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { parseApiError } from '@/utils/apiError';
import { useProfileDetails } from '@/hooks/useProfileDetails';
import { useToast } from '@/hooks/useToast';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import { ProfileContactCard } from './ProfileContactCard';
import { EmergencyContactCard } from './EmergencyContactCard';
import { SettingsToast } from './SettingsToast';

export const ProfileTab: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { toast, showToast } = useToast();
  const { details, loading, saving, form, updateField, handleCountryChange, handleStateChange, submit } =
    useProfileDetails();
  const { user } = useAuth();
  const displayName = form.userName || user?.userName || 'User';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submit();
      showToast('Profile details updated successfully!', 'success');
      setIsEditing(false);
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      showToast(message || 'Failed to update profile details.', 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ProfileIdentityCard
        form={form}
        updateField={updateField}
        details={details}
        email={user?.userEmail}
        role={user?.userRole}
        displayName={displayName}
        isEditing={isEditing}
        onStartEdit={() => setIsEditing(true)}
        showToast={showToast}
      />
      <ProfileContactCard
        form={form}
        updateField={updateField}
        handleCountryChange={handleCountryChange}
        handleStateChange={handleStateChange}
        isEditing={isEditing}
      />
      <EmergencyContactCard form={form} updateField={updateField} isEditing={isEditing} />

      {isEditing && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditing(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || loading}
            className="gap-2 text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
          >
            <Save size={14} />
            <span>{saving ? 'Saving Profile Details…' : 'Save Changes'}</span>
          </Button>
        </div>
      )}

      <SettingsToast toast={toast} />
    </form>
  );
};
