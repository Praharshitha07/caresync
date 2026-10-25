import { z } from 'zod';

const optionalText = (max) => z.string().trim().max(max).optional();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateValue = z
  .string()
  .regex(datePattern, 'Date of birth must use YYYY-MM-DD format')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Date of birth must be a valid date')
  .refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future')
  .refine((value) => value >= '1900-01-01', 'Date of birth must be 1900 or later');

const emergencyContactSchema = z
  .object({
    name: optionalText(120),
    relationship: optionalText(80),
    phone: optionalText(40),
  })
  .strict();

const patientFields = {
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dob: dateValue,
  gender: z.enum(['Female', 'Male', 'Other', 'Undisclosed']),
  phone: z.string().trim().min(7).max(40),
  email: z
    .union([z.string().trim().email().max(254).transform((value) => value.toLowerCase()), z.literal('')])
    .optional(),
  address: optionalText(300),
  emergencyContact: emergencyContactSchema.optional(),
  status: z.enum(['Outpatient', 'Admitted', 'Observation', 'Discharged']).optional(),
  primaryPhysician: optionalText(120),
  room: optionalText(80),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']).optional(),
  allergies: optionalText(1000),
  doctorId: z.string().regex(/^[a-f\d]{24}$/i, 'A valid doctor is required'),
};

export const createPatientSchema = z.object(patientFields).strict();
export const createReceptionistPatientSchema = z
  .object({
    firstName: patientFields.firstName,
    lastName: patientFields.lastName,
    dob: patientFields.dob,
    gender: patientFields.gender,
    phone: patientFields.phone,
    email: patientFields.email,
    address: patientFields.address,
    emergencyContact: patientFields.emergencyContact,
    doctorId: patientFields.doctorId,
  })
  .strict();
export const updatePatientSchema = z
  .object(patientFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one patient field is required');

export const updateReceptionistPatientSchema = z
  .object({
    firstName: patientFields.firstName.optional(),
    lastName: patientFields.lastName.optional(),
    dob: patientFields.dob.optional(),
    gender: patientFields.gender.optional(),
    phone: patientFields.phone.optional(),
    email: patientFields.email,
    address: patientFields.address,
    emergencyContact: patientFields.emergencyContact,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one demographic field is required');

export const listPatientsSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(100).default(''),
    status: z.enum(['Outpatient', 'Admitted', 'Observation', 'Discharged']).optional(),
    registered: z.enum(['all', 'last7', 'last30']).default('all'),
    sort: z.enum(['name', 'registrationDate']).default('registrationDate'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
