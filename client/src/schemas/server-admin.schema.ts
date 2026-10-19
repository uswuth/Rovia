import { z } from 'zod';

export const createServerAdminOrgSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must not exceed 100 characters'),
  organizationLocation: z
    .string()
    .trim()
    .max(150, 'Location must not exceed 150 characters')
    .optional()
    .or(z.literal('')),
  organizationDescription: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  adminName: z
    .string()
    .trim()
    .min(2, 'SuperAdmin name must be at least 2 characters')
    .max(100, 'SuperAdmin name must not exceed 100 characters'),
  adminEmail: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .toLowerCase(),
});

export type CreateServerAdminOrgFormValues = z.infer<typeof createServerAdminOrgSchema>;
