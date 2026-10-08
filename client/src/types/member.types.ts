export type MemberRole = 'SuperAdmin' | 'Admin' | 'Member';
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface Member {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: MemberRole;
  userStatus: MemberStatus;
  userCode?: string;
  jobTitle?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  bloodType?: string;
  address?: string;
  city?: string;
  isSuperAdmin?: boolean;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateMemberDTO {
  userRole?: MemberRole;
  userStatus?: MemberStatus;
}
