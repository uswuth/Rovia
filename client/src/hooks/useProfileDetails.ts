import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme-context';
import { getUserDetailsApi, updateUserDetailsApi, type UserDetailsData } from '@/api/user/user-details.api';
import { COUNTRIES } from '@/data/geo-data';

/** The editable subset of the user's profile. Read-only account fields (userCode, email, role, jobTitle) are not here. */
export interface ProfileForm {
  userName: string;
  phoneNumber: string;
  bloodType: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  spouseName: string;
  bio: string;
  avatarUrl: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export type UpdateFieldFn = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;

const emptyForm: ProfileForm = {
  userName: '',
  phoneNumber: '',
  bloodType: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: 'Single',
  spouseName: '',
  bio: '',
  avatarUrl: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
};

/**
 * Owns the editable profile form: loads server details once, exposes field
 * updates and the cascading country/state handlers, and submits. Kept as a
 * hook so the profile cards stay presentational.
 */
export const useProfileDetails = () => {
  const { user, refreshProfile } = useAuth();
  const { accentColor, setAccentColor } = useTheme();
  // setAccentColor is recreated each ThemeProvider render; a ref keeps the load
  // effect from re-running (and re-fetching) on every provider render.
  const setAccentColorRef = useRef(setAccentColor);
  useEffect(() => {
    setAccentColorRef.current = setAccentColor;
  });

  const [details, setDetails] = useState<UserDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyForm);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getUserDetailsApi();
        if (!mounted) return;
        setDetails(data);
        setForm({
          userName: data.userName || user?.userName || '',
          phoneNumber: data.phoneNumber || '',
          bloodType: data.bloodType || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          country: data.country || '',
          postalCode: data.postalCode || '',
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
          gender: data.gender || '',
          maritalStatus: data.maritalStatus || 'Single',
          spouseName: data.spouseName || '',
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || user?.avatarUrl || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          emergencyContactRelation: data.emergencyContactRelation || '',
        });
        if (data.accentColor) setAccentColorRef.current(data.accentColor);
      } catch (err) {
        console.warn('Failed to load user details:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const updateField = useCallback<UpdateFieldFn>((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCountryChange = useCallback((name: string) => {
    const found = COUNTRIES.find((c) => c.name === name);
    setForm((prev) => {
      const next = { ...prev, country: name };
      if (found) {
        if (!prev.phoneNumber || prev.phoneNumber.startsWith('+')) {
          next.phoneNumber = found.phoneCode + ' ';
        }
        if (!found.states.some((s) => s.name === prev.state)) {
          next.state = '';
          next.city = '';
        }
      }
      return next;
    });
  }, []);

  const handleStateChange = useCallback((name: string) => {
    setForm((prev) => {
      const found = COUNTRIES.find((c) => c.name === prev.country);
      const foundState = found?.states.find((s) => s.name === name);
      const next = { ...prev, state: name };
      if (foundState && !foundState.cities.includes(prev.city)) next.city = '';
      return next;
    });
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      const updated = await updateUserDetailsApi({
        userName: form.userName,
        phoneNumber: form.phoneNumber,
        bloodType: form.bloodType,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        postalCode: form.postalCode,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender,
        maritalStatus: form.maritalStatus,
        spouseName: form.maritalStatus === 'Married' ? form.spouseName : '',
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
        emergencyContactRelation: form.emergencyContactRelation,
        accentColor,
      });
      setDetails(updated);
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  }, [form, accentColor, refreshProfile]);

  return { details, loading, saving, form, updateField, handleCountryChange, handleStateChange, submit };
};
