import client from '../client';

export interface UserDetailsData {
  id?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userCode?: string;
  jobTitle?: string;
  phoneNumber?: string;
  bloodType?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string | null;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateUserDetailsInput {
  userName?: string;
  jobTitle?: string;
  phoneNumber?: string;
  bloodType?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string | null;
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
}

export const getUserDetailsApi = async (): Promise<UserDetailsData> => {
  const res = await client.get<{ data: UserDetailsData }>('/user-details');
  return res.data.data;
};

export const updateUserDetailsApi = async (data: UpdateUserDetailsInput): Promise<UserDetailsData> => {
  const res = await client.put<{ data: UserDetailsData }>('/user-details', data);
  return res.data.data;
};
