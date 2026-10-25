import { z } from 'zod';

const optionalIdentifier = z.union([
  z.string().trim().min(1).max(40),
  z.literal('').transform(() => undefined),
]).optional();

export const doctorFields = {
  name: z.string().trim().min(1).max(120),
  specialty: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120).optional(),
  email: z.union([
    z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    z.literal(''),
  ]).optional(),
  phone: z.string().trim().max(40).optional(),
  professionalIdentifier: optionalIdentifier,
  active: z.boolean().optional(),
};

export const createDoctorSchema = z.object(doctorFields).strict();
export const updateDoctorSchema = z.object(doctorFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one doctor field is required');

export const listDoctorsSchema = z.object({
  search: z.string().trim().max(100).default(''),
  includeInactive: z.enum(['true', 'false']).default('false'),
}).strict();
