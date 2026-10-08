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

export const getRoleCategory = (member: Member): 'SUPER_ADMIN' | 'ADMIN' | 'HOST' | 'MEMBERS' | 'VISITORS' => {
  const role = (member.userRole || '').toUpperCase();
  if (member.isSuperAdmin || role.includes('SUPER') || role === 'SUPERADMIN' || role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }
  if (role === 'ADMIN') {
    return 'ADMIN';
  }
  if (role.includes('HOST') || role === 'ORGANIZER' || role === 'OWNER') {
    return 'HOST';
  }
  if (role === 'VISITOR') {
    return 'VISITORS';
  }
  return 'MEMBERS';
};
