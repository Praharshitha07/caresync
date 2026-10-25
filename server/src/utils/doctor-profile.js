const DEMO_IDENTIFIER_PREFIX = 'DEV-FICTIONAL-';

export function isSeededDemoDoctor(doctor) {
  return typeof doctor?.professionalIdentifier === 'string'
    && doctor.professionalIdentifier.toUpperCase().startsWith(DEMO_IDENTIFIER_PREFIX);
}
