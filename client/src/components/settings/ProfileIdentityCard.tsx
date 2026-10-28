import React, { useRef } from 'react';
import { Camera, Edit3, Upload, Lock, Briefcase, Shield } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { UserDetailsData } from '@/api/user/user-details.api';
import type { ProfileForm, UpdateFieldFn } from '@/hooks/useProfileDetails';
import type { ToastTone } from '@/hooks/useToast';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 2048;
// Avatars render at 80px, so storing anything larger only inflates the request.
// Re-encoding to this bound keeps the base64 payload far below the API body limit.
const STORED_DIMENSION = 512;
const STORED_QUALITY = 0.85;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unreadable image'));
    image.src = src;
  });

/** Bounded JPEG rendition: keeps transparent pixels white instead of black. */
const toStoredDataUrl = (image: HTMLImageElement): string => {
  const scale = Math.min(1, STORED_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) return image.src;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', STORED_QUALITY);
};

interface ProfileIdentityCardProps {
  form: ProfileForm;
  updateField: UpdateFieldFn;
  details: UserDetailsData | null;
  email?: string;
  role?: string;
  displayName: string;
  isEditing: boolean;
  onStartEdit: () => void;
  showToast: (message: string, tone: ToastTone) => void;
}

export const ProfileIdentityCard: React.FC<ProfileIdentityCardProps> = ({
  form,
  updateField,
  details,
  email,
  role,
  displayName,
  isEditing,
  onStartEdit,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      showToast('Only PNG and JPG/JPEG images are permitted.', 'error');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      showToast('Image file size must be less than 2MB.', 'error');
      return;
    }

    void (async () => {
      try {
        const image = await loadImage(await readFileAsDataUrl(file));
        if (image.naturalWidth > MAX_DIMENSION || image.naturalHeight > MAX_DIMENSION) {
          showToast(`Image resolution must not exceed ${MAX_DIMENSION}x${MAX_DIMENSION}px.`, 'error');
          return;
        }
        updateField('avatarUrl', toStoredDataUrl(image));
      } catch {
        showToast('That image could not be read. Try a different file.', 'error');
      } finally {
        // Allow re-selecting the same file after a failed attempt.
        input.value = '';
      }
    })();
  };

  return (
    <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Camera size={16} className="text-primary" />
          <span>Profile & Identity</span>
        </h3>
        {!isEditing && (
          <Button
            type="button"
            onClick={onStartEdit}
            className="gap-1.5 text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
          >
            <Edit3 size={13} />
            <span>Update Profile</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <Avatar className="size-20 ring-2 ring-border">
            {form.avatarUrl && <AvatarImage src={form.avatarUrl} alt={displayName} />}
            <AvatarFallback name={displayName} className="text-2xl font-bold bg-muted text-foreground">
              {displayName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          {isEditing && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity cursor-pointer"
                title="Upload profile avatar"
              >
                <Upload size={13} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </>
          )}
        </div>

        <div className="flex-1 min-w-0 max-w-md space-y-1.5">
          {isEditing && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              PNG or JPG · max 2MB · up to 2048×2048.
            </p>
          )}
          <FormField label="Full Name" htmlFor="profile-userName" required={isEditing}>
            <Input
              id="profile-userName"
              value={form.userName}
              onChange={(e) => updateField('userName', e.target.value)}
              disabled={!isEditing}
              placeholder="Your full name"
              required={isEditing}
              className="text-xs disabled:opacity-75 disabled:bg-muted/50"
            />
          </FormField>
          {isEditing && form.avatarUrl && (
            <button
              type="button"
              onClick={() => updateField('avatarUrl', '')}
              className="text-xs text-destructive hover:underline inline-block cursor-pointer"
            >
              Remove avatar
            </button>
          )}
        </div>
      </div>

      {/* Fixed account identity — managed by the organization */}
      <div className="rounded-xs border border-border/60 bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Lock size={12} /> Account Identity · managed by your organization
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-muted-foreground font-medium block text-xs mb-1">Job Title</label>
            <div className="h-9 px-3 flex items-center gap-1.5 bg-background/60 border border-border/80 rounded-xs text-xs text-foreground font-medium">
              <Briefcase size={13} className="text-primary opacity-80 shrink-0" />
              <span className="truncate">{details?.jobTitle || 'No title set'}</span>
            </div>
          </div>
          <div>
            <label className="text-muted-foreground font-medium block text-xs mb-1">User Code</label>
            <div className="h-9 px-3 flex items-center bg-background/60 border border-border/80 rounded-xs font-mono text-xs text-foreground font-bold">
              {details?.userCode || 'USR-N/A'}
            </div>
          </div>
          <div>
            <label className="text-muted-foreground font-medium block text-xs mb-1">Email</label>
            <div className="h-9 px-3 flex items-center bg-background/60 border border-border/80 rounded-xs font-mono text-xs text-muted-foreground truncate">
              {email}
            </div>
          </div>
          <div>
            <label className="text-muted-foreground font-medium block text-xs mb-1">Assigned Role</label>
            <div className="h-9 px-3 flex items-center gap-1.5 bg-background/60 border border-border/80 rounded-xs text-primary font-bold text-xs">
              <Shield size={13} className="shrink-0" />
              <span className="truncate">{role || 'Member'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
