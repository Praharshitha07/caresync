import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  INITIAL_PATIENTS,
  INITIAL_MEDICAL_RECORDS,
  INITIAL_APPOINTMENTS,
} from '../data/mockData';

const HospitalDataContext = createContext(null);

export function HospitalDataProvider({ children }) {
  // Initialize from sessionStorage if exists during dev review session, else fallback to initial mock data
  const [patients, setPatients] = useState(() => {
    try {
      const saved = sessionStorage.getItem('caresync_patients_store');
      return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
    } catch {
      return INITIAL_PATIENTS;
    }
  });

  const [medicalRecords, setMedicalRecords] = useState(() => {
    try {
      const saved = sessionStorage.getItem('caresync_records_store');
      return saved ? JSON.parse(saved) : INITIAL_MEDICAL_RECORDS;
    } catch {
      return INITIAL_MEDICAL_RECORDS;
    }
  });

  const [appointments, setAppointments] = useState(() => {
    try {
      const saved = sessionStorage.getItem('caresync_appointments_store');
      return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS;
    } catch {
      return INITIAL_APPOINTMENTS;
    }
  });

  // Sync to sessionStorage for session persistence
  useEffect(() => {
    try {
      sessionStorage.setItem('caresync_patients_store', JSON.stringify(patients));
    } catch (e) {
      console.warn('Storage warning', e);
    }
  }, [patients]);

  useEffect(() => {
    try {
      sessionStorage.setItem('caresync_records_store', JSON.stringify(medicalRecords));
    } catch (e) {
      console.warn('Storage warning', e);
    }
  }, [medicalRecords]);

  useEffect(() => {
    try {
      sessionStorage.setItem('caresync_appointments_store', JSON.stringify(appointments));
    } catch (e) {
      console.warn('Storage warning', e);
    }
  }, [appointments]);

  // Lookup helpers
  const getPatientById = (id) => {
    if (!id) return null;
    return patients.find((p) => p.id.toLowerCase() === id.toLowerCase()) || null;
  };

  const getRecordsByPatientId = (patientId) => {
    if (!patientId) return [];
    return medicalRecords.filter(
      (r) => r.patientId.toLowerCase() === patientId.toLowerCase()
    );
  };

  const getAppointmentsByPatientId = (patientId) => {
    if (!patientId) return [];
    return appointments.filter(
      (a) => a.patientId.toLowerCase() === patientId.toLowerCase()
    );
  };

  // Patient Actions
  const addPatient = (patientInput) => {
    const nextNum = 8900 + patients.length + 1;
    const newId = `CS-${nextNum}`;
    const today = new Date();
    const formattedRegDate = today.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const isoRegDate = today.toISOString().split('T')[0];

    // Calculate age if DOB provided
    let age = 0;
    if (patientInput.dob) {
      const birth = new Date(patientInput.dob);
      age = Math.max(0, today.getFullYear() - birth.getFullYear());
    }

    const newPatient = {
      id: newId,
      firstName: patientInput.firstName.trim(),
      lastName: patientInput.lastName.trim(),
      name: `${patientInput.firstName.trim()} ${patientInput.lastName.trim()}`,
      dob: patientInput.dob,
      age: age || 30,
      gender: patientInput.gender || 'Not specified',
      phone: patientInput.phone.trim(),
      email: patientInput.email ? patientInput.email.trim() : '',
      address: patientInput.address ? patientInput.address.trim() : 'Address on file',
      emergencyContact: {
        name: patientInput.emergencyContactName || 'N/A',
        relationship: patientInput.emergencyContactRelation || 'Contact',
        phone: patientInput.emergencyContactPhone || 'N/A',
      },
      registrationDate: isoRegDate,
      formattedRegDate: formattedRegDate,
      status: patientInput.status || 'Outpatient',
      statusVariant: patientInput.status === 'Admitted' ? 'success' : 'neutral',
      room: patientInput.room || 'General Intake',
      primaryPhysician: patientInput.primaryPhysician || 'Dr. Sarah Jenkins',
      bloodType: patientInput.bloodType || 'Unknown',
      allergies: patientInput.allergies || 'None recorded',
    };

    setPatients((prev) => [newPatient, ...prev]);
    return newPatient;
  };

  const updatePatient = (id, updatedFields) => {
    let updatedRecord = null;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id.toLowerCase() === id.toLowerCase()) {
          const updated = {
            ...p,
            ...updatedFields,
            name:
              updatedFields.firstName && updatedFields.lastName
                ? `${updatedFields.firstName.trim()} ${updatedFields.lastName.trim()}`
                : p.name,
          };
          updatedRecord = updated;
          return updated;
        }
        return p;
      })
    );
    return updatedRecord;
  };

  const deletePatient = (id) => {
    setPatients((prev) => prev.filter((p) => p.id.toLowerCase() !== id.toLowerCase()));
  };

  // Medical Record Actions
  const addMedicalRecord = (recordInput) => {
    const newId = `rec-${Date.now().toString().slice(-4)}`;
    const patient = getPatientById(recordInput.patientId);

    const newRecord = {
      id: newId,
      patientId: recordInput.patientId,
      patientName: patient ? patient.name : 'Unknown Patient',
      visitDate: recordInput.visitDate || new Date().toISOString().split('T')[0],
      formattedVisitDate: new Date(recordInput.visitDate || Date.now()).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' }
      ),
      diagnosis: recordInput.diagnosis.trim(),
      treatment: recordInput.treatment.trim(),
      prescriptions: recordInput.prescriptions ? recordInput.prescriptions.trim() : 'None prescribed',
      clinicalNotes: recordInput.clinicalNotes ? recordInput.clinicalNotes.trim() : 'Clinical documentation filed.',
      attendingPhysician: recordInput.attendingPhysician || 'Dr. Sarah Jenkins',
      department: recordInput.department || 'General Medicine',
      followUpDate: recordInput.followUpDate || '',
      severity: recordInput.severity || 'Moderate',
    };

    setMedicalRecords((prev) => [newRecord, ...prev]);
    return newRecord;
  };

  // Appointment Actions
  const addAppointment = (appointmentInput) => {
    const newId = `apt-${Date.now().toString().slice(-4)}`;
    const patient = getPatientById(appointmentInput.patientId);

    const formattedDate = new Date(appointmentInput.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newAppointment = {
      id: newId,
      patientId: appointmentInput.patientId,
      patientName: patient ? patient.name : appointmentInput.patientName || 'Patient',
      date: appointmentInput.date,
      formattedDate: formattedDate,
      time: appointmentInput.time,
      dateTime: `${formattedDate}, ${appointmentInput.time}`,
      reason: appointmentInput.reason.trim(),
      type: appointmentInput.type || 'Clinical Consultation',
      assignedDoctor: appointmentInput.assignedDoctor || 'Dr. Sarah Jenkins',
      status: 'Scheduled',
      statusVariant: 'info',
      room: appointmentInput.room || 'Consultation Suite',
    };

    setAppointments((prev) => [newAppointment, ...prev]);
    return newAppointment;
  };

  const updateAppointmentStatus = (id, newStatus) => {
    const variantMap = {
      Scheduled: 'info',
      Confirmed: 'success',
      'In Progress': 'warning',
      Completed: 'neutral',
      Cancelled: 'error',
    };

    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            status: newStatus,
            statusVariant: variantMap[newStatus] || 'neutral',
          };
        }
        return a;
      })
    );
  };

  const cancelAppointment = (id) => {
    updateAppointmentStatus(id, 'Cancelled');
  };

  return (
    <HospitalDataContext.Provider
      value={{
        patients,
        medicalRecords,
        appointments,
        getPatientById,
        getRecordsByPatientId,
        getAppointmentsByPatientId,
        addPatient,
        updatePatient,
        deletePatient,
        addMedicalRecord,
        addAppointment,
        updateAppointmentStatus,
        cancelAppointment,
      }}
    >
      {children}
    </HospitalDataContext.Provider>
  );
}

export function useHospitalData() {
  const context = useContext(HospitalDataContext);
  if (!context) {
    throw new Error('useHospitalData must be used within a HospitalDataProvider');
  }
  return context;
}
