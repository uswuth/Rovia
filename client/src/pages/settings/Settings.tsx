import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Key,
  Clock,
  Check,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Upload,
  Camera,
  Palette,
  Phone,
  Heart,
  Save,
  Sun,
  Moon,
  Laptop,
  Edit3,
  Eye,
  Briefcase
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme-context';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { maskEmail } from '@/utils/privacy';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ColorSwatchPicker } from '@/components/ui/color-swatch-picker';
import { changePasswordApi } from '@/api/auth/auth.api';
import { getUserDetailsApi, updateUserDetailsApi, type UserDetailsData } from '@/api/user/user-details.api';
import { parseApiError } from '@/utils/apiError';
import { cn } from '@/lib/utils';
import { COUNTRIES, BLOOD_GROUPS, GENDERS, MARITAL_STATUSES } from '@/data/geo-data';

const ACCENT_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#EAB308'];

export const SettingsPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const { timeFormat, setTimeFormat, formatTimeStr } = useTimeFormat();
  const maskedEmail = maskEmail(user?.userEmail || 'user@example.com');

  // Active tab: 'profile' | 'appearance' | 'security'
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security'>('profile');

  // Profile View Mode vs Edit Mode
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // User details state
  const [details, setDetails] = useState<UserDetailsData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState('');
  const [detailsError, setDetailsError] = useState('');

  // Editable Profile fields
  const [userName, setUserName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [spouseName, setSpouseName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  // Avatar file upload validation
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Fetch extended user details on mount
  useEffect(() => {
    let mounted = true;
    const loadDetails = async () => {
      try {
        setLoadingDetails(true);
        const data = await getUserDetailsApi();
        if (!mounted) return;
        setDetails(data);
        setUserName(data.userName || user?.userName || '');
        setJobTitle(data.jobTitle || '');
        setPhoneNumber(data.phoneNumber || '');
        setBloodType(data.bloodType || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setState(data.state || '');
        setCountry(data.country || '');
        setPostalCode(data.postalCode || '');
        setDateOfBirth(data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '');
        setGender(data.gender || '');
        setMaritalStatus(data.maritalStatus || 'Single');
        setSpouseName(data.spouseName || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatarUrl || user?.avatarUrl || '');
        setEmergencyContactName(data.emergencyContactName || '');
        setEmergencyContactPhone(data.emergencyContactPhone || '');
        setEmergencyContactRelation(data.emergencyContactRelation || '');
        if (data.accentColor) {
          setAccentColor(data.accentColor);
        }
      } catch (err) {
        console.warn('Failed to load user details:', err);
      } finally {
        if (mounted) setLoadingDetails(false);
      }
    };
    void loadDetails();
    return () => {
      mounted = false;
    };
  }, [user, setAccentColor]);

  // Sync country change to phone country prefix if phone is empty
  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const foundCountry = COUNTRIES.find((c) => c.name === cName);
    if (foundCountry) {
      if (!phoneNumber || phoneNumber.startsWith('+')) {
        setPhoneNumber(foundCountry.phoneCode + ' ');
      }
      // Reset state and city if no longer in selected country
      const stateExists = foundCountry.states.some((s) => s.name === state);
      if (!stateExists) {
        setState('');
        setCity('');
      }
    }
  };

  // Sync state change
  const handleStateChange = (sName: string) => {
    setState(sName);
    const foundCountry = COUNTRIES.find((c) => c.name === country);
    const foundState = foundCountry?.states.find((s) => s.name === sName);
    if (foundState && !foundState.cities.includes(city)) {
      setCity('');
    }
  };

  // Avatar Image Upload & Validation (<2MB, PNG/JPEG, max 2048x2048)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setAvatarError('Only PNG and JPG/JPEG images are permitted.');
      return;
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE_BYTES) {
      setAvatarError('Image file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 2048;
        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          setAvatarError(`Image resolution must not exceed ${MAX_DIMENSION}x${MAX_DIMENSION}px.`);
          return;
        }
        setAvatarUrl(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Submit profile updates
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError('');
    setDetailsSuccess('');
    try {
      setSavingDetails(true);
      const updated = await updateUserDetailsApi({
        userName,
        phoneNumber,
        bloodType,
        address,
        city,
        state,
        country,
        postalCode,
        dateOfBirth: dateOfBirth || null,
        gender,
        maritalStatus,
        spouseName: maritalStatus === 'Married' ? spouseName : '',
        bio,
        avatarUrl,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        accentColor,
      });
      setDetails(updated);
      setDetailsSuccess('Profile details updated successfully!');
      setIsEditingProfile(false);
      await refreshProfile();
      setTimeout(() => setDetailsSuccess(''), 3000);
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      setDetailsError(message || 'Failed to update profile details.');
    } finally {
      setSavingDetails(false);
    }
  };

  // Password validation & submission
  const isMinLength = newPassword.length >= 8;
  const hasTypedConfirm = confirmPassword.length > 0;
  const isMatch = hasTypedConfirm && newPassword === confirmPassword;
  const canSubmitPassword = Boolean(currentPassword && newPassword && confirmPassword && isMinLength && isMatch);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!canSubmitPassword) return;

    try {
      setSubmittingPassword(true);
      await changePasswordApi({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Your password has been updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      setPasswordError(message || 'Failed to update password. Please check your current password.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmailSent(true);
    setTimeout(() => setResetEmailSent(false), 5000);
  };

  const sampleDate = new Date();
  const currentDisplayName = userName || user?.userName || 'User';

  const selectedCountryObj = COUNTRIES.find((c) => c.name === country);
  const availableStates = selectedCountryObj ? selectedCountryObj.states : [];
  const selectedStateObj = availableStates.find((s) => s.name === state);
  const availableCities = selectedStateObj ? selectedStateObj.cities : [];

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <SettingsIcon className="text-primary" size={24} />
          <span>Settings</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal details, privacy parameters, display preferences, and account security.
        </p>
      </div>

      {/* Tabs Navigation (No modal anywhere) */}
      <div className="flex border-b border-border gap-2 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold transition-all cursor-pointer -mb-px',
            activeTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <User size={15} />
          <span>Profile Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold transition-all cursor-pointer -mb-px',
            activeTab === 'appearance'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <Palette size={15} />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold transition-all cursor-pointer -mb-px',
            activeTab === 'security'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <Lock size={15} />
          <span>Security & Password</span>
        </button>
      </div>

      {/* Tab 1: Profile Details */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Top Bar for View Mode vs Edit Mode Toggle */}
          <div className="flex items-center justify-between bg-card border border-border/80 p-4 rounded-md shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {isEditingProfile ? 'Editing Profile Details' : 'Profile Overview'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditingProfile
                  ? 'Update your personal and demographic parameters. Organizational job role and email are locked.'
                  : 'Currently in view mode. Click Update Profile to make modifications.'}
              </p>
            </div>
            {!isEditingProfile ? (
              <Button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="gap-2 text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
              >
                <Edit3 size={14} />
                <span>Update Profile</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditingProfile(false);
                  setDetailsError('');
                }}
                className="gap-2 text-xs font-medium cursor-pointer"
              >
                <Eye size={14} />
                <span>Cancel / View Mode</span>
              </Button>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Avatar & Core Identity Section */}
            <div className="rounded-md border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-5 shadow-xs">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Camera size={16} className="text-primary" />
                <span>Profile Avatar & Core Identity</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="relative group shrink-0">
                  <Avatar className="size-20 sm:size-24 border-2 border-border shadow-md">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={currentDisplayName} />}
                    <AvatarFallback name={currentDisplayName} className="text-2xl font-bold bg-muted text-foreground">
                      {currentDisplayName[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>

                  {isEditingProfile && (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity cursor-pointer"
                        title="Upload profile avatar"
                      >
                        <Upload size={14} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                <div className="space-y-1.5 text-xs flex-1">
                  <p className="font-semibold text-foreground">Custom Profile Image</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Upload a PNG or JPG image (Max 2MB, up to 2048x2048 resolution). If no custom image is selected, a dynamic profile avatar automatically matches your name.
                  </p>
                  {avatarError && (
                    <p className="text-destructive font-medium flex items-center gap-1 pt-1">
                      <AlertCircle size={13} /> {avatarError}
                    </p>
                  )}
                  {isEditingProfile && avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-xs text-destructive hover:underline pt-1 inline-block cursor-pointer"
                    >
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                <FormField label="Full Name" htmlFor="profile-userName" required>
                  <Input
                    id="profile-userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={!isEditingProfile}
                    placeholder="Your full name"
                    required
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>

                <div>
                  <label className="text-muted-foreground font-medium block text-xs mb-1">
                    Job Title / Role (Fixed — Org Management Only)
                  </label>
                  <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs text-muted-foreground font-medium">
                    <Briefcase size={13} className="mr-1.5 opacity-70" />
                    <span>{jobTitle || details?.jobTitle || 'No title set'}</span>
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block text-xs mb-1">User Code (Fixed)</label>
                  <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md font-mono text-xs text-foreground font-bold">
                    {details?.userCode || 'USR-N/A'}
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block text-xs mb-1">
                    Email Address (Fixed — Protected)
                  </label>
                  <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md font-mono text-xs text-muted-foreground">
                    {user?.userEmail}
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block text-xs mb-1">Assigned Role</label>
                  <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-primary font-bold text-xs gap-1.5">
                    <Shield size={13} />
                    <span>{user?.userRole || 'Member'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & Demographic Details */}
            <div className="rounded-md border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Phone size={16} className="text-primary" />
                <span>Contact & Personal Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <FormField label="Country" htmlFor="profile-country">
                  {isEditingProfile ? (
                    <select
                      id="profile-country"
                      value={country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select Country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name} ({c.phoneCode})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs">
                      {country || 'Not specified'}
                    </div>
                  )}
                </FormField>

                <FormField label="Phone Number" htmlFor="profile-phone">
                  <Input
                    id="profile-phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={!isEditingProfile}
                    placeholder="+1 (555) 000-0000"
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>

                <FormField label="Blood Group" htmlFor="profile-bloodType">
                  {isEditingProfile ? (
                    <select
                      id="profile-bloodType"
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs">
                      {bloodType || 'Not specified'}
                    </div>
                  )}
                </FormField>

                <FormField label="Date of Birth" htmlFor="profile-dob">
                  <Input
                    id="profile-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    disabled={!isEditingProfile}
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>

                <FormField label="Gender" htmlFor="profile-gender">
                  {isEditingProfile ? (
                    <select
                      id="profile-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select Gender</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs">
                      {gender || 'Not specified'}
                    </div>
                  )}
                </FormField>

                <FormField label="Marital Status" htmlFor="profile-marital">
                  {isEditingProfile ? (
                    <select
                      id="profile-marital"
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {MARITAL_STATUSES.map((ms) => (
                        <option key={ms} value={ms}>
                          {ms}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs">
                      {maritalStatus || 'Single'}
                    </div>
                  )}
                </FormField>

                {maritalStatus === 'Married' && (
                  <div className="sm:col-span-2">
                    <FormField label="Spouse Name" htmlFor="profile-spouseName" required={isEditingProfile}>
                      <Input
                        id="profile-spouseName"
                        value={spouseName}
                        onChange={(e) => setSpouseName(e.target.value)}
                        disabled={!isEditingProfile}
                        placeholder="Enter spouse full name"
                        className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                      />
                    </FormField>
                  </div>
                )}
              </div>

              {/* Cascading State, City, Pin Code & Street */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                <FormField label="State / Province" htmlFor="profile-state">
                  {isEditingProfile ? (
                    <select
                      id="profile-state"
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select State</option>
                      {availableStates.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs">
                      {state || 'Not specified'}
                    </div>
                  )}
                </FormField>

                <FormField label="City" htmlFor="profile-city">
                  {isEditingProfile ? (
                    availableCities.length > 0 ? (
                      <select
                        id="profile-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Select City</option>
                        {availableCities.map((ct) => (
                          <option key={ct} value={ct}>
                            {ct}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="profile-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Enter City"
                        className="text-xs"
                      />
                    )
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-md text-xs">
                      {city || 'Not specified'}
                    </div>
                  )}
                </FormField>

                <FormField label="Postal / PIN Code" htmlFor="profile-postalCode">
                  <Input
                    id="profile-postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    disabled={!isEditingProfile}
                    placeholder="e.g. 560001 / 90210"
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>

                <div className="sm:col-span-2 md:col-span-4">
                  <FormField label="Residential Street Address" htmlFor="profile-address">
                    <Input
                      id="profile-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={!isEditingProfile}
                      placeholder="Street address, apartment or suite"
                      className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                    />
                  </FormField>
                </div>
              </div>

              <FormField label="Bio / About Me" htmlFor="profile-bio">
                <Textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={!isEditingProfile}
                  placeholder="Brief introduction or bio..."
                  className="text-xs resize-none disabled:opacity-75 disabled:bg-muted/50"
                  rows={3}
                />
              </FormField>
            </div>

            {/* Privacy & Emergency Contact */}
            <div className="rounded-md border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Heart size={16} className="text-destructive" />
                <span>Emergency Contact & Safety</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Emergency Contact Name" htmlFor="emergency-name">
                  <Input
                    id="emergency-name"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    disabled={!isEditingProfile}
                    placeholder="Full name"
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>

                <FormField label="Emergency Contact Phone" htmlFor="emergency-phone">
                  <Input
                    id="emergency-phone"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    disabled={!isEditingProfile}
                    placeholder="Phone number"
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>

                <FormField label="Relationship" htmlFor="emergency-rel">
                  <Input
                    id="emergency-rel"
                    value={emergencyContactRelation}
                    onChange={(e) => setEmergencyContactRelation(e.target.value)}
                    disabled={!isEditingProfile}
                    placeholder="e.g. Spouse, Parent, Sibling"
                    className="text-xs disabled:opacity-75 disabled:bg-muted/50"
                  />
                </FormField>
              </div>
            </div>

            {/* Feedback Alerts */}
            {detailsError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{detailsError}</span>
              </div>
            )}

            {detailsSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">
                <CheckCircle2 size={15} className="shrink-0 text-primary" />
                <span>{detailsSuccess}</span>
              </div>
            )}

            {/* Submit Action Only Visible in Edit Mode */}
            {isEditingProfile && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingProfile(false)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingDetails || loadingDetails}
                  className="gap-2 text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Save size={14} />
                  <span>{savingDetails ? 'Saving Profile Details…' : 'Save Changes'}</span>
                </Button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tab 2: Appearance */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Two-Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bento Left: Theme Switcher (Light, Dark, System) */}
            <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center text-primary ">
                    <Sun size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Theme Mode</h3>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2.5 p-4 rounded-lg border transition-all cursor-pointer',
                      theme === 'light'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                    )}
                  >
                    <Sun size={20} className={theme === 'light' ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs">Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2.5 p-4 rounded-lg border transition-all cursor-pointer',
                      theme === 'dark'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                    )}
                  >
                    <Moon size={20} className={theme === 'dark' ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs">Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2.5 p-4 rounded-lg border transition-all cursor-pointer',
                      theme === 'system'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                    )}
                  >
                    <Laptop size={20} className={theme === 'system' ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs">System</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bento Right: Accent Color Swatch Picker */}
            <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center  text-primary">
                    <Palette size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Accent Color Theme</h3>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-center gap-4">
                    <ColorSwatchPicker
                      value={accentColor}
                      onChange={(color) => {
                        const hex = typeof color === 'string' ? color : (color?.toString?.('hex') || String(color));
                        setAccentColor(hex);
                        void updateUserDetailsApi({ accentColor: hex });
                      }}
                      className="flex flex-wrap gap-2.5 items-center"
                    >
                      {ACCENT_COLORS.map((c) => (
                        <ColorSwatchPicker.Item
                          key={c}
                          color={c}
                          className="outline-none cursor-pointer relative flex items-center justify-center"
                        >
                          <ColorSwatchPicker.Swatch className="w-8 h-8 rounded-full shadow-xs border-2 border-white/20 transition-transform hover:scale-110" />
                          <ColorSwatchPicker.Indicator className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md text-xs font-bold pointer-events-none" />
                        </ColorSwatchPicker.Item>
                      ))}
                    </ColorSwatchPicker>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Time Display Format */}
          <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="flex h-8 w-8 items-center justify-center text-primary">
                <Clock size={16} />
              </div>
              <h3 className="font-bold text-sm text-foreground">Time Display Format</h3>
            </div>
            <div className="space-y-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Choose your preferred time format for meeting schedules, timers, and timestamps across the application.
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setTimeFormat('12h')}
                  className={cn(
                    'flex items-center justify-center p-4 rounded-lg border transition-all cursor-pointer',
                    timeFormat === '12h'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                  )}
                >
                  <span className="text-sm font-bold">12-Hour</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeFormat('24h')}
                  className={cn(
                    'flex items-center justify-center p-4 rounded-lg border transition-all cursor-pointer',
                    timeFormat === '24h'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                  )}
                >
                  <span className="text-sm font-bold">24-Hour</span>
                </button>
              </div>

              <div className="p-3 bg-secondary/70 border border-border/80 rounded-md flex items-center justify-between max-w-md">
                <span className="text-muted-foreground">Live Preview:</span>
                <span className="font-mono font-bold text-primary">{formatTimeStr(sampleDate)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Password */}
      {activeTab === 'security' && (
        <div className="rounded-md border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-6 shadow-xs max-w-2xl">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Change Password</h3>
                <p className="text-xs text-muted-foreground">Update your password directly without popups or modals.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
            >
              <HelpCircle size={13} />
              <span>Forgot Password?</span>
            </button>
          </div>

          {resetEmailSent && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
              <CheckCircle2 size={15} className="shrink-0 text-primary" />
              <span>Password reset link sent to <strong>{maskedEmail}</strong>. Please check your inbox.</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <FormField label="Current Password" htmlFor="tab-current-password" required>
              <PasswordInput
                id="tab-current-password"
                autoComplete="current-password"
                required
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                showGenerateButton={false}
                className="text-xs"
              />
            </FormField>

            <FormField label="New Password" htmlFor="tab-new-password" required>
              <PasswordInput
                id="tab-new-password"
                autoComplete="new-password"
                required
                placeholder="Enter new password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                showGenerateButton={false}
                className="text-xs"
              />
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                {newPassword ? (
                  isMinLength ? (
                    <span className="text-primary font-medium inline-flex items-center gap-1">
                      <Check size={12} /> At least 8 characters
                    </span>
                  ) : (
                    <span className="text-destructive font-medium inline-flex items-center gap-1">
                      <X size={12} /> Must be at least 8 characters
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground/60">Minimum 8 characters</span>
                )}
              </div>
            </FormField>

            <FormField label="Confirm New Password" htmlFor="tab-confirm-password" required>
              <PasswordInput
                id="tab-confirm-password"
                autoComplete="new-password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                showGenerateButton={false}
                className="text-xs"
              />
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                {hasTypedConfirm ? (
                  isMatch ? (
                    <span className="text-primary font-semibold inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20">
                      <CheckCircle2 size={12} /> Passwords match
                    </span>
                  ) : (
                    <span className="text-destructive font-semibold inline-flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-sm border border-destructive/20">
                      <AlertCircle size={12} /> Passwords do not match
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground/60">Re-enter your password to verify match</span>
                )}
              </div>
            </FormField>

            {passwordError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">
                <CheckCircle2 size={15} className="shrink-0 text-primary" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-3">
              <Button
                type="submit"
                disabled={!canSubmitPassword || submittingPassword}
                className="gap-2 text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
              >
                <Key size={14} />
                <span>{submittingPassword ? 'Updating Password…' : 'Update Password'}</span>
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
