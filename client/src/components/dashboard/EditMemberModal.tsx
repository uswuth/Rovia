import React, { useState, useEffect } from 'react';
import { User, Shield, CheckCircle, Briefcase } from 'lucide-react';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';
import { getJobTitles, assignJobTitle, type JobTitle } from '@/api/job-title/job-title.api';

interface EditMemberModalProps {
  isOpen: boolean;
  member: Member | null;
  onClose: () => void;
  onSave: (updatedMember: Member) => void;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  member,
  onClose,
  onSave,
}) => {
  const [availableTitles, setAvailableTitles] = useState<JobTitle[]>([]);

  useEffect(() => {
    if (isOpen) {
      getJobTitles()
        .then((res) => setAvailableTitles(res.data?.data || []))
        .catch(() => undefined);
    }
  }, [isOpen]);

  if (!isOpen || !member) return null;

  // Remounting on member change re-initializes the form state from the new member
  return (
    <EditMemberForm
      key={member.id}
      member={member}
      availableTitles={availableTitles}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

interface EditMemberFormProps {
  member: Member;
  availableTitles: JobTitle[];
  onClose: () => void;
  onSave: (updatedMember: Member) => void;
}

const EditMemberForm: React.FC<EditMemberFormProps> = ({
  member,
  availableTitles,
  onClose,
  onSave,
}) => {
  const [role, setRole] = useState<MemberRole>(member.role ?? 'Member');
  const [status, setStatus] = useState<MemberStatus>(member.status ?? 'Active');
  const [jobTitle, setJobTitle] = useState<string>(member.jobTitle ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (member && jobTitle !== (member.jobTitle ?? '')) {
      try {
        await assignJobTitle(member.id, jobTitle);
      } catch {
        // Ignore background assignment failure if offline
      }
    }
    onSave({
      ...member,
      role,
      status,
      jobTitle,
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Manage Member</h3>
              <p className="text-xs text-muted-foreground">{member.email || member.role}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Member Name */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Member Name
            </label>
            <div className="h-10 w-full rounded-md border border-border bg-secondary/50 px-3.5 flex items-center text-sm font-medium text-foreground">
              {member.name}
            </div>
          </div>

          {/* Job Title Selection */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Job Title
            </label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-3.5 text-sm text-foreground focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 transition-colors cursor-pointer"
              >
                <option value="">No Title Assigned</option>
                {availableTitles.map((t) => (
                  <option key={t.id} value={t.title}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Role
            </label>
            <div className="relative">
              <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-3.5 text-sm text-foreground focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 transition-colors cursor-pointer"
              >
                <option value="SuperAdmin">SuperAdmin</option>
                <option value="Admin">Admin</option>
                <option value="Host">Host</option>
                <option value="Member">Member</option>
              </select>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Account Status
            </label>
            <div className="relative">
              <CheckCircle size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MemberStatus)}
                className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-3.5 text-sm text-foreground focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 transition-colors cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
