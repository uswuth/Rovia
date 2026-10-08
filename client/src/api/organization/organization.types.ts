export interface AdminOrganization {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLocation?: string;
  organizationDescription?: string;
  memberCount?: number;
  createdAt: string;
}

export interface CreateOrgInput {
  organizationName: string;
  organizationLocation?: string;
  organizationDescription?: string;
}

export interface ProvisionUserInput {
  userName: string;
  userEmail: string;
  password?: string;
  organizationId: string;
  userRole?: 'SuperAdmin' | 'Admin' | 'Member';
  userStatus?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  jobTitle?: string;
}

export interface AdminProvisionedUser {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'SuperAdmin' | 'Admin' | 'Member';
  userStatus?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  jobTitle?: string;
  userCode?: string;
  isSuperAdmin?: boolean;
  organizationId?: string | { _id: string; organization_name: string; organization_slug: string };
  organization_id?: { _id: string; organization_name: string; organization_slug: string };
  organizationName?: string;
  initialPassword?: string;
  createdAt?: string;
}

export interface UpdateUserInput {
  userName?: string;
  userEmail?: string;
  userRole?: 'SuperAdmin' | 'Admin' | 'Member';
  userStatus?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  jobTitle?: string;
  organizationId?: string;
}



