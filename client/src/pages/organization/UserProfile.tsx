import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, Shield, Phone, MapPin, Calendar, Briefcase, Activity, Hash, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getOrganizationMemberByIdApi } from '@/api/organization/organization.api';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getRoleBadgeTone } from '@/lib/status-tone';
import type { Member } from '@/types/member.types';

export const UserProfile: React.FC = () => {
  const { userCode, id } = useParams<{ userCode?: string; id?: string }>();
  const navigate = useNavigate();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const identifier = userCode || id;
        if (!identifier) return;

        const res = await getOrganizationMemberByIdApi(identifier);
        if (!isMounted) return;

        const resData = res?.data as { data?: Member } | Member | undefined;
        let raw: Member | undefined = undefined;

        if (resData && typeof resData === 'object') {
          if ('data' in resData && resData.data && typeof resData.data === 'object') {
            raw = resData.data as Member;
          } else {
            raw = resData as Member;
          }
        }

        if (raw) {
          setMember(raw);
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [userCode, id]);

  if (loading) {
    return (
      <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-80 w-full rounded-sm" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6 max-w-4xl mx-auto text-center py-16">
        <User size={48} className="mx-auto text-muted-foreground/50 mb-3" />
        <h2 className="text-xl font-bold">Member Profile Not Found</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          No user account matching identifier '{userCode || id}' could be retrieved in your organization.
        </p>
        <Button onClick={() => navigate('/organization/members')} className="mt-4 gap-2">
          <ArrowLeft size={15} />
          <span>Back</span>
        </Button>
      </div>
    );
  }

  const name = member.userName || 'Unnamed User';
  const email = member.userEmail || 'N/A';
  const uCode = member.userCode || 'USR-N/A';
  const role = member.userRole || 'Member';
  const status = member.userStatus || 'ACTIVE';
  const jobTitle = member.jobTitle || 'Team Member';
  const phone = member.phoneNumber || 'N/A';
  const address = member.address || '';
  const city = member.city || '';
  const locationStr = [address, city].filter(Boolean).join(', ') || 'N/A';
  const joined = member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A';

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
              <User size={24} className="text-emerald-500" />
              <span>Member Profile</span>
            </h1>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/organization/members')}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Button>
        </div>

        {/* Profile Card Header */}
        <div className="rounded-sm border border-border bg-card p-6 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Avatar className="h-20 w-20 rounded-full shrink-0 border border-border">
            <AvatarImage src={member.avatarUrl} alt={name} />
            <AvatarFallback name={name} className="rounded-full font-bold text-2xl" />
          </Avatar>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{name}</h1>
              <span className="font-mono text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-sm w-fit mx-auto sm:mx-0">
                {uCode}
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
              <Mail size={13} />
              <span>{email}</span>
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Badge tone={status === 'ACTIVE' ? 'success' : 'warning'}>
                {status}
              </Badge>
              <Badge tone="neutral" className="gap-1 font-normal text-xs">
                <Briefcase size={11} />
                <span>{jobTitle}</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Detailed Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Box 1: Account & Platform Attributes */}
          <div className="rounded-sm border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 pb-2 border-b border-border/50">
              <Shield size={16} className="text-emerald-500" />
              <span>Platform Account Details</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Hash size={13} /> User Code
                </span>
                <span className="font-mono font-bold text-foreground">{uCode}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Briefcase size={13} /> Job Position
                </span>
                <span className="font-semibold text-foreground">{jobTitle}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Key size={13} /> Access Role
                </span>
                <Badge tone={getRoleBadgeTone(role)}>{role}</Badge>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Activity size={13} /> Account Status
                </span>
                <span className="font-semibold text-foreground">{status}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={13} /> Joined Date
                </span>
                <span className="font-mono text-foreground">{joined}</span>
              </div>
            </div>
          </div>

          {/* Box 2: Personal Contact Information */}
          <div className="rounded-sm border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 pb-2 border-b border-border/50">
              <Phone size={16} className="text-emerald-500" />
              <span>Contact & Location</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Phone size={13} /> Phone Number
                </span>
                <span className="font-medium text-foreground">{phone}</span>
              </div>

              <div className="flex items-start justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <MapPin size={13} /> Address & City
                </span>
                <span className="font-medium text-foreground text-right max-w-[200px] leading-relaxed">{locationStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
