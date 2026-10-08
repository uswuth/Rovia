import client from '../client';
import type {
  AdminOrganization,
  CreateOrgInput,
  ProvisionUserInput,
  AdminProvisionedUser,
  UpdateUserInput
} from './organization.types';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';

export const getOrganizationMembers = () =>
  client.get<{ data: Member[] }>('/organizations/members');

export const getOrganizationMemberByIdApi = (memberId: string) =>
  client.get<{ data: Member }>(`/organizations/members/${memberId}`);

export const updateMemberRole = (memberId: string, role: MemberRole) =>
  client.patch<{ data: Member }>(`/organizations/members/${memberId}/role`, { role });

export const updateMemberStatus = (memberId: string, status: MemberStatus) =>
  client.patch<{ data: Member }>(`/organizations/members/${memberId}/status`, { status });

export const removeMember = (memberId: string) =>
  client.delete(`/organizations/members/${memberId}`);

export const createOrganizationApi = (payload: CreateOrgInput) =>
  client.post<{ data: AdminOrganization }>('/organizations', payload);

export const getAllOrganizationsApi = () =>
  client.get<{ data: AdminOrganization[] }>('/organizations');

export const provisionUserApi = (payload: ProvisionUserInput) =>
  client.post<{ data: AdminProvisionedUser }>('/organizations/users/provision', payload);

export const updateUserApi = (userId: string, payload: UpdateUserInput) =>
  client.patch<{ data: AdminProvisionedUser }>(`/organizations/users/${userId}`, payload);

export const getAllUsersAdminApi = () =>
  client.get<{ data: AdminProvisionedUser[] }>('/organizations/users/all');


