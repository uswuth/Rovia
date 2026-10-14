import { UserDetails } from '../models/user-details.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';

export interface IUpdateUserDetailsInput {
  phoneNumber?: string;
  bloodType?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string | Date | null;
  gender?: string;
  maritalStatus?: string;
  spouseName?: string;
  bio?: string;
  avatarUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  preferredLanguage?: string;
  timezone?: string;
  accentColor?: string;
  userName?: string;
  jobTitle?: string;
}

export const getUserDetailsService = async (userId: string) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  let details = await UserDetails.findOne({ user_id: userId });
  if (!details) {
    // Seed initial user details document from any legacy fields
    details = await UserDetails.create({
      user_id: user._id,
      phone_number: user.phone_number || '',
      blood_type: user.blood_type || '',
      address: user.address || '',
      city: user.city || '',
      avatar_url: user.avatar_url || '',
      accent_color: '#10b981'
    });
  }

  const jsonDetails = details.toJSON();
  return {
    ...jsonDetails,
    userName: user.user_name,
    userEmail: user.user_email,
    userRole: user.user_role,
    jobTitle: user.job_title || '',
    userCode: user.user_code || ''
  };
};

export const updateOrCreateUserDetailsService = async (
  userId: string,
  input: IUpdateUserDetailsInput
) => {
  if (!userId) {
    throw ApiError.unauthorized('User identity is required');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // If userName or jobTitle or avatarUrl are provided, sync primary User model as well
  let userModified = false;
  if (typeof input.userName === 'string' && input.userName.trim().length >= 2) {
    user.user_name = input.userName.trim();
    userModified = true;
  }
  if (typeof input.jobTitle === 'string') {
    user.job_title = input.jobTitle.trim();
    userModified = true;
  }
  if (typeof input.avatarUrl === 'string') {
    user.avatar_url = input.avatarUrl.trim();
    userModified = true;
  }
  if (userModified) {
    await user.save();
  }

  const updatePayload: Record<string, unknown> = {};
  if (input.phoneNumber !== undefined) updatePayload.phone_number = input.phoneNumber.trim();
  if (input.bloodType !== undefined) updatePayload.blood_type = input.bloodType.trim();
  if (input.address !== undefined) updatePayload.address = input.address.trim();
  if (input.city !== undefined) updatePayload.city = input.city.trim();
  if (input.state !== undefined) updatePayload.state = input.state.trim();
  if (input.country !== undefined) updatePayload.country = input.country.trim();
  if (input.postalCode !== undefined) updatePayload.postal_code = input.postalCode.trim();
  if (input.gender !== undefined) updatePayload.gender = input.gender.trim();
  if (input.maritalStatus !== undefined) updatePayload.marital_status = input.maritalStatus.trim();
  if (input.spouseName !== undefined) updatePayload.spouse_name = input.spouseName.trim();
  if (input.bio !== undefined) updatePayload.bio = input.bio.trim();
  if (input.avatarUrl !== undefined) updatePayload.avatar_url = input.avatarUrl.trim();
  if (input.emergencyContactName !== undefined) updatePayload.emergency_contact_name = input.emergencyContactName.trim();
  if (input.emergencyContactPhone !== undefined) updatePayload.emergency_contact_phone = input.emergencyContactPhone.trim();
  if (input.emergencyContactRelation !== undefined) updatePayload.emergency_contact_relation = input.emergencyContactRelation.trim();
  if (input.preferredLanguage !== undefined) updatePayload.preferred_language = input.preferredLanguage.trim();
  if (input.timezone !== undefined) updatePayload.timezone = input.timezone.trim();
  if (input.accentColor !== undefined) updatePayload.accent_color = input.accentColor.trim();

  if (input.dateOfBirth !== undefined) {
    updatePayload.date_of_birth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  }

  const details = await UserDetails.findOneAndUpdate(
    { user_id: userId },
    { $set: updatePayload },
    { new: true, upsert: true }
  );

  const jsonDetails = details.toJSON();
  return {
    ...jsonDetails,
    userName: user.user_name,
    userEmail: user.user_email,
    userRole: user.user_role,
    jobTitle: user.job_title || '',
    userCode: user.user_code || ''
  };
};
