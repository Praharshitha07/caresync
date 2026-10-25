import Doctor from '../models/doctor.model.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const fictionalDoctors = [
  {
    name: 'Alex Sample',
    specialty: 'Family Medicine',
    department: 'Primary Care',
    professionalIdentifier: 'DEV-FICTIONAL-001',
  },
  {
    name: 'Casey Example',
    specialty: 'Cardiology',
    department: 'Heart Care',
    professionalIdentifier: 'DEV-FICTIONAL-002',
  },
  {
    name: 'Riley Placeholder',
    specialty: 'Orthopedics',
    department: 'Musculoskeletal Care',
    professionalIdentifier: 'DEV-FICTIONAL-003',
  },
  {
    name: 'Morgan Demo',
    specialty: 'Pediatrics',
    department: 'Child Health',
    professionalIdentifier: 'DEV-FICTIONAL-004',
  },
];

async function seedDoctors() {
  await connectDatabase();
  await Doctor.createIndexes();

  for (const doctor of fictionalDoctors) {
    await Doctor.updateOne(
      { professionalIdentifier: doctor.professionalIdentifier },
      { $setOnInsert: { ...doctor, active: true } },
      { upsert: true }
    );
  }

  console.log(`Ensured ${fictionalDoctors.length} fictional development doctors exist.`);
}

try {
  await seedDoctors();
} catch (error) {
  console.error(`Doctor seed failed (${error.name || 'Error'}). Check the database connection and seed configuration.`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
