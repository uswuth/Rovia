/**
 * Shared Mongoose projection strings. Keeping them here means a field added to
 * the user shape reaches every populate/select in one edit, instead of drifting
 * between inline copies.
 */

export const USER_POPULATE = 'user_name user_email avatar_url user_role is_super_admin job_title organization_id';
export const USER_SELECT = '_id organization_id user_name user_email avatar_url user_role is_super_admin job_title';
export const USER_LIST_SELECT =
  '_id organization_id user_name user_email user_role is_super_admin avatar_url job_title created_at updated_at';
export const ORGANIZATION_POPULATE =
  'organization_name organization_slug organization_location organization_description ' +
  'organization_invite_code revoked_invite_codes organization_owner_id created_at updated_at';
export const ORGANIZATION_OWNER_POPULATE =
  'user_name user_email avatar_url user_role is_super_admin job_title created_at updated_at';
