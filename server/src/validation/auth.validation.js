import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    password: z
      .string()
      .min(1)
      .refine((password) => Buffer.byteLength(password, 'utf8') <= 72),
  })
  .strict();

export const resetPasswordParamsSchema = z
  .object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'A valid user ID is required'),
  })
  .strict();

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be no more than 72 UTF-8 bytes'
  );

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required')
      .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        'Current password must be no more than 72 UTF-8 bytes'
      ),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
