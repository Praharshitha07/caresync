export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(message, { status, errors = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, options = {}) {
  const requestUrl = `${API_BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (import.meta.env.DEV && path === '/dashboard') {
      console.error('[CareSync dashboard diagnostic]', {
        url: requestUrl,
        status: null,
        message: 'Unable to reach the CareSync API.',
        validationErrors: [],
      });
    }
    throw new ApiError('Unable to reach the CareSync API. Check the backend connection and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (import.meta.env.DEV && path === '/dashboard') {
      console.error('[CareSync dashboard diagnostic]', {
        url: requestUrl,
        status: response.status,
        message: payload?.message || 'The CareSync API could not complete the request.',
        validationErrors: Array.isArray(payload?.errors)
          ? payload.errors.map(({ field, message }) => ({ field, message }))
          : [],
      });
    }
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('caresync:session-expired'));
    }
    throw new ApiError(payload?.message || 'The CareSync API could not complete the request.', {
      status: response.status,
      errors: payload?.errors || [],
    });
  }

  if (import.meta.env.DEV && path === '/dashboard') {
    console.info('[CareSync dashboard diagnostic]', {
      url: requestUrl,
      status: response.status,
    });
  }

  return payload;
}

export async function listPatients(params, { signal } = {}) {
  const query = new URLSearchParams(params);
  return request(`/patients?${query}`, { signal });
}

export async function getDashboardSummary({ signal } = {}) {
  const response = await request('/dashboard', { signal });
  return response.data;
}

export async function listDoctors(params = {}, { signal } = {}) {
  const query = new URLSearchParams(params);
  return (await request(`/doctors?${query}`, { signal })).data;
}

export async function createDoctor(doctor) {
  const response = await request('/doctors', {
    method: 'POST',
    body: JSON.stringify(doctor),
  });
  return response.data;
}

export async function updateDoctor(id, doctor) {
  const response = await request(`/doctors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(doctor),
  });
  return response.data;
}

export async function listStaffAccounts({ signal } = {}) {
  return (await request('/staff', { signal })).data;
}

export async function createStaffAccount(account) {
  return (await request('/staff', {
    method: 'POST',
    body: JSON.stringify(account),
  })).data;
}

export async function updateStaffAccountStatus(id, isActive) {
  return (await request(`/staff/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })).data;
}

export async function getPatient(id, { signal } = {}) {
  const response = await request(`/patients/${encodeURIComponent(id)}`, { signal });
  return response.data;
}

export async function createPatient(patient) {
  const response = await request('/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  });
  return response.data;
}

export async function updatePatient(id, patient) {
  const response = await request(`/patients/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patient),
  });
  return response.data;
}

export async function archivePatient(id) {
  return request(`/patients/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function authenticateUser(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function getCurrentUser() {
  return request('/auth/session');
}

export async function endSession() {
  return request('/auth/logout', { method: 'POST' });
}

export async function listMedicalRecords(params = {}, { signal } = {}) {
  const query = new URLSearchParams(params);
  return request(`/medical-records?${query}`, { signal });
}

export async function getMedicalRecord(id, { signal } = {}) {
  const response = await request(`/medical-records/${encodeURIComponent(id)}`, {
    signal,
  });
  return response.data;
}

export async function createMedicalRecord(record) {
  const response = await request('/medical-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
  return response.data;
}

export async function updateMedicalRecord(id, record) {
  const response = await request(`/medical-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(record),
  });
  return response.data;
}

export async function archiveMedicalRecord(id) {
  return request(`/medical-records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listAppointments(params = {}, { signal } = {}) {
  const query = new URLSearchParams(params);
  return request(`/appointments?${query}`, { signal });
}

export async function getAppointment(id, { signal } = {}) {
  const response = await request(`/appointments/${encodeURIComponent(id)}`, {
    signal,
  });
  return response.data;
}

export async function createAppointment(appointment) {
  const response = await request('/appointments', {
    method: 'POST',
    body: JSON.stringify(appointment),
  });
  return response.data;
}

export async function updateAppointment(id, appointment) {
  const response = await request(`/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(appointment),
  });
  return response.data;
}

export async function archiveAppointment(id) {
  return request(`/appointments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
