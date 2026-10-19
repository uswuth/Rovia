import React from 'react';
import { CalendarDays, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  COUNTRIES,
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  getFlagEmoji,
  getCountryByName,
  getCurrencyByCountryName,
} from '@/data/geo-data';
import type { ProfileForm, UpdateFieldFn } from '@/hooks/useProfileDetails';

/** Parse a YYYY-MM-DD string as a LOCAL date (avoids UTC off-by-one on display). */
const parseLocalDate = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

interface ProfileContactCardProps {
  form: ProfileForm;
  updateField: UpdateFieldFn;
  handleCountryChange: (name: string) => void;
  handleStateChange: (name: string) => void;
  isEditing: boolean;
}

export const ProfileContactCard: React.FC<ProfileContactCardProps> = ({
  form,
  updateField,
  handleCountryChange,
  handleStateChange,
  isEditing,
}) => {
  const selectedCountryObj = COUNTRIES.find((c) => c.name === form.country);
  const availableStates = selectedCountryObj ? selectedCountryObj.states : [];
  const selectedStateObj = availableStates.find((s) => s.name === form.state);
  const availableCities = selectedStateObj ? selectedStateObj.cities : [];
  const selectedCurrency = getCurrencyByCountryName(form.country);

  return (
    <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-4 shadow-xs">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
        <Phone size={16} className="text-primary" />
        <span>Contact & Personal Details</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <FormField label="Country" htmlFor="profile-country">
          {isEditing ? (
            <SearchableSelect
              id="profile-country"
              value={form.country}
              onChange={handleCountryChange}
              placeholder="Select Country"
              searchPlaceholder="Search country or currency..."
              options={COUNTRIES.map((c) => ({
                value: c.name,
                label: c.name,
                badge: c.currency.code,
                icon: (
                  <span className="text-base leading-none" aria-hidden="true">
                    {getFlagEmoji(c.code)}
                  </span>
                ),
              }))}
            />
          ) : (
            <div className="h-9 px-3 flex items-center gap-2 bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.country ? (
                <>
                  <span className="text-base leading-none" aria-hidden="true">
                    {getFlagEmoji(getCountryByName(form.country)?.code || '')}
                  </span>
                  <span className="truncate">{form.country}</span>
                  {selectedCurrency && (
                    <span className="ml-auto px-1.5 py-0.2 rounded-xs text-[10px] font-mono bg-muted text-muted-foreground border border-border/50">
                      {selectedCurrency.code}
                    </span>
                  )}
                </>
              ) : (
                'Not specified'
              )}
            </div>
          )}
        </FormField>

        <FormField label="Phone Number" htmlFor="profile-phone">
          <Input
            id="profile-phone"
            value={form.phoneNumber}
            onChange={(e) => updateField('phoneNumber', e.target.value)}
            disabled={!isEditing}
            placeholder="+1 (555) 000-0000"
            className="text-xs disabled:opacity-75 disabled:bg-muted/50"
          />
        </FormField>

        <FormField label="Blood Group" htmlFor="profile-bloodType">
          {isEditing ? (
            <Select
              value={form.bloodType}
              onValueChange={(val) => updateField('bloodType', typeof val === 'string' ? val : '')}
            >
              <SelectTrigger id="profile-bloodType" className="w-full h-9 text-xs rounded-xs">
                <SelectValue placeholder="Select Blood Group" />
              </SelectTrigger>
              <SelectContent className="rounded-xs">
                {BLOOD_GROUPS.map((bg) => (
                  <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.bloodType ? (
                <Badge tone="danger" className="font-mono">
                  {form.bloodType}
                </Badge>
              ) : (
                'Not specified'
              )}
            </div>
          )}
        </FormField>

        <FormField label="Date of Birth" htmlFor="profile-dob">
          {isEditing ? (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full h-9 justify-start px-3 text-xs font-normal',
                      !form.dateOfBirth && 'text-muted-foreground'
                    )}
                  >
                    <CalendarDays size={14} className="mr-2 opacity-60" />
                    {form.dateOfBirth ? format(parseLocalDate(form.dateOfBirth), 'PPP') : 'Pick a date'}
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.dateOfBirth ? parseLocalDate(form.dateOfBirth) : undefined}
                  onSelect={(date) => updateField('dateOfBirth', date ? format(date, 'yyyy-MM-dd') : '')}
                  disabled={{ after: new Date() }}
                  captionLayout="dropdown"
                  startMonth={new Date(1920, 0)}
                  endMonth={new Date()}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.dateOfBirth ? format(parseLocalDate(form.dateOfBirth), 'PPP') : 'Not specified'}
            </div>
          )}
        </FormField>

        <FormField label="Gender" htmlFor="profile-gender">
          {isEditing ? (
            <Select
              value={form.gender}
              onValueChange={(val) => updateField('gender', typeof val === 'string' ? val : '')}
            >
              <SelectTrigger id="profile-gender" className="w-full h-9 text-xs rounded-xs">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent className="rounded-xs">
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.gender ? <Badge tone="info">{form.gender}</Badge> : 'Not specified'}
            </div>
          )}
        </FormField>

        <FormField label="Marital Status" htmlFor="profile-marital">
          {isEditing ? (
            <Select
              value={form.maritalStatus}
              onValueChange={(val) => updateField('maritalStatus', typeof val === 'string' ? val : 'Single')}
            >
              <SelectTrigger id="profile-marital" className="w-full h-9 text-xs rounded-xs">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xs">
                {MARITAL_STATUSES.map((ms) => (
                  <SelectItem key={ms} value={ms}>{ms}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.maritalStatus || 'Single'}
            </div>
          )}
        </FormField>

        {form.maritalStatus === 'Married' && (
          <div className="sm:col-span-2">
            <FormField label="Spouse Name" htmlFor="profile-spouseName" required={isEditing}>
              <Input
                id="profile-spouseName"
                value={form.spouseName}
                onChange={(e) => updateField('spouseName', e.target.value)}
                disabled={!isEditing}
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
          {isEditing ? (
            availableStates.length > 0 ? (
              <Select
                value={form.state}
                onValueChange={(val) => handleStateChange(typeof val === 'string' ? val : '')}
              >
                <SelectTrigger id="profile-state" className="w-full h-9 text-xs rounded-xs">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent className="rounded-xs">
                  {availableStates.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="profile-state"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
                placeholder="Enter State / Province"
                className="text-xs"
              />
            )
          ) : (
            <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.state || 'Not specified'}
            </div>
          )}
        </FormField>

        <FormField label="City" htmlFor="profile-city">
          {isEditing ? (
            availableCities.length > 0 ? (
              <Select
                value={form.city}
                onValueChange={(val) => updateField('city', typeof val === 'string' ? val : '')}
              >
                <SelectTrigger id="profile-city" className="w-full h-9 text-xs rounded-xs">
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent className="rounded-xs">
                  {availableCities.map((ct) => (
                    <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="profile-city"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Enter City"
                className="text-xs"
              />
            )
          ) : (
            <div className="h-9 px-3 flex items-center bg-secondary/70 border border-border/80 rounded-xs text-xs">
              {form.city || 'Not specified'}
            </div>
          )}
        </FormField>

        <FormField label="Postal / PIN Code" htmlFor="profile-postalCode">
          <Input
            id="profile-postalCode"
            value={form.postalCode}
            onChange={(e) => updateField('postalCode', e.target.value)}
            disabled={!isEditing}
            placeholder="e.g. 560001 / 90210"
            className="text-xs disabled:opacity-75 disabled:bg-muted/50"
          />
        </FormField>

        <div className="sm:col-span-2 md:col-span-4">
          <FormField label="Residential Street Address" htmlFor="profile-address">
            <Input
              id="profile-address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              disabled={!isEditing}
              placeholder="Street address, apartment or suite"
              className="text-xs disabled:opacity-75 disabled:bg-muted/50"
            />
          </FormField>
        </div>
      </div>

      <FormField label="Bio / About Me" htmlFor="profile-bio">
        <Textarea
          id="profile-bio"
          value={form.bio}
          onChange={(e) => updateField('bio', e.target.value)}
          disabled={!isEditing}
          placeholder="Brief introduction or bio..."
          className="text-xs resize-none disabled:opacity-75 disabled:bg-muted/50"
          rows={3}
        />
      </FormField>
    </div>
  );
};
