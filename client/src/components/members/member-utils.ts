import type { Member } from '@/types/member.types';

export const getMemberId = (m: Member): string =>
  m.userId || m.userEmail || '';

export const isTopAdminRole = (member: Member): boolean => {
  const role = (member.userRole || '').toUpperCase();
  return (
    Boolean(member.isSuperAdmin) ||
    role.includes('SUPER') ||
    role === 'SUPERADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN'
  );
};

export const getRoleCategory = (member: Member): 'SUPER_ADMIN' | 'ADMIN' | 'MEMBERS' => {
  const role = (member.userRole || '').toUpperCase();
  if (member.isSuperAdmin || role.includes('SUPER') || role === 'SUPERADMIN' || role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }
  if (role === 'ADMIN') {
    return 'ADMIN';
  }
  return 'MEMBERS';
};
