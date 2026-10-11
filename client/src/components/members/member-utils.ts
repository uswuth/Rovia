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

/**
 * Normalizes a member entry (either a string ID or populated Member object)
 * into a strict, strongly-typed Member object according to the server payload contract.
 */
export const normalizeMember = (m: Member | string): Member => {
  if (typeof m === 'string') {
    return {
      userId: m,
      userName: m,
      userEmail: '',
      userRole: 'Member',
      userStatus: 'ACTIVE',
    };
  }
  return {
    userId: m.userId,
    userName: m.userName || '',
    userEmail: m.userEmail || '',
    userRole: m.userRole || 'Member',
    userStatus: m.userStatus || 'ACTIVE',
    userCode: m.userCode,
    avatarUrl: m.avatarUrl,
    jobTitle: m.jobTitle,
    isSuperAdmin: m.isSuperAdmin,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
};

/**
 * Deduplicates and normalizes an array of member entries (e.g. hosts and members combined)
 * strictly by member userId.
 */
export const normalizeMemberList = (
  rawMembers: (Member | string | undefined | null)[]
): Member[] => {
  const seen = new Set<string>();
  const result: Member[] = [];

  for (const raw of rawMembers) {
    if (!raw) continue;
    const normalized = normalizeMember(raw);
    if (normalized.userId && !seen.has(normalized.userId)) {
      seen.add(normalized.userId);
      result.push(normalized);
    }
  }

  return result;
};
