import { z } from 'zod';

const STAFF_ROLES = [
  'admin',
  'doctor',
  'clinician',
  'nurse',
  'receptionist',
  'records_staff',
];

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be no more than 72 UTF-8 bytes'
  );

const optionalDoctorText = (max) =>
  z.union([z.string().trim().max(max), z.literal('')])
    .optional()
    .transform((value) => value || undefined);

const doctorProfileSchema = z.object({
  specialty: z.string().trim().min(1).max(120),
  department: optionalDoctorText(120),
  phone: optionalDoctorText(40),
  professionalIdentifier: optionalDoctorText(40),
}).strict();

export const createStaffSchema = z
  .object({
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    displayName: z.string().trim().min(1).max(120),
    role: z.enum(STAFF_ROLES),
    doctorProfile: doctorProfileSchema.optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((value) => {
    return value.role === 'doctor'
      ? Boolean(value.doctorProfile)
      : !value.doctorProfile;
  }, {
    message: 'Doctor profile details are required for doctor accounts and are only allowed for doctor accounts.',
    path: ['doctorProfile'],
  });

export const updateStaffStatusParamsSchema = z
  .object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'A valid user ID is required') })
  .strict();

export const updateStaffStatusSchema = z
  .object({ isActive: z.boolean() })
  .strict();
