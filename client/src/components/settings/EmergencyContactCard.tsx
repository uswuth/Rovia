import React from 'react';
import { Heart } from 'lucide-react';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { ProfileForm, UpdateFieldFn } from '@/hooks/useProfileDetails';

interface EmergencyContactCardProps {
  form: ProfileForm;
  updateField: UpdateFieldFn;
  isEditing: boolean;
}

export const EmergencyContactCard: React.FC<EmergencyContactCardProps> = ({
  form,
  updateField,
  isEditing,
}) => (
  <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-4 shadow-xs">
    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
      <Heart size={16} className="text-destructive" />
      <span>Emergency Contact & Safety</span>
    </h3>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <FormField label="Emergency Contact Name" htmlFor="emergency-name">
        <Input
          id="emergency-name"
          value={form.emergencyContactName}
          onChange={(e) => updateField('emergencyContactName', e.target.value)}
          disabled={!isEditing}
          placeholder="Full name"
          className="text-xs disabled:opacity-75 disabled:bg-muted/50"
        />
      </FormField>

      <FormField label="Emergency Contact Phone" htmlFor="emergency-phone">
        <Input
          id="emergency-phone"
          value={form.emergencyContactPhone}
          onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
          disabled={!isEditing}
          placeholder="Phone number"
          className="text-xs disabled:opacity-75 disabled:bg-muted/50"
        />
      </FormField>

      <FormField label="Relationship" htmlFor="emergency-rel">
        <Input
          id="emergency-rel"
          value={form.emergencyContactRelation}
          onChange={(e) => updateField('emergencyContactRelation', e.target.value)}
          disabled={!isEditing}
          placeholder="e.g. Spouse, Parent, Sibling"
          className="text-xs disabled:opacity-75 disabled:bg-muted/50"
        />
      </FormField>
    </div>
  </div>
);
