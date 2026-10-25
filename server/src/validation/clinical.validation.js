import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateSchema = z
  .string()
  .regex(datePattern)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  });

const optionalText = (max) => z.string().trim().max(max).optional();
const requiredText = (max) => z.string().trim().min(1).max(max);

const medicalRecordFields = {
  patientId: requiredText(32),
  visitDate: dateSchema,
  diagnosis: requiredText(2000),
  treatment: requiredText(5000),
  prescriptions: optionalText(3000),
  clinicalNotes: optionalText(10000),
  attendingPhysician: requiredText(120),
  department: requiredText(120),
  followUpDate: z.union([dateSchema, z.literal('')]).optional(),
  severity: z.enum(['Low', 'Moderate', 'High', 'Critical']).optional(),
};

export const createMedicalRecordSchema = z.object(medicalRecordFields).strict();
export const updateMedicalRecordSchema = z
  .object(medicalRecordFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export const listMedicalRecordsSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    patientId: optionalText(32),
    search: optionalText(100),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .strict()
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: 'from must not be later than to',
  });

const appointmentFields = {
  patientId: requiredText(32),
  date: dateSchema,
  time: requiredText(40),
  reason: requiredText(1000),
  type: requiredText(120),
  assignedDoctor: requiredText(120),
  doctorId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  room: optionalText(80),
  status: z.enum(['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']).optional(),
};

export const createAppointmentSchema = z
  .object(appointmentFields)
  .omit({ status: true })
  .strict();
export const updateAppointmentSchema = z
  .object(appointmentFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export const listAppointmentsSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    patientId: optionalText(32),
    status: z.enum(['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']).optional(),
    search: optionalText(100),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .strict()
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: 'from must not be later than to',
  });
