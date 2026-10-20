# CareSync — Patient Records & Care Management System

> **Tagline:** Better Records. Connected Care.
> **Status:** Authenticated patient, medical-record, and appointment screens are integrated with the Express API; live Atlas connectivity remains unverified

CareSync is a hospital staff portal designed for hospital administrators, doctors, nurses, and authorized healthcare personnel to manage patient information, clinical medical records, and scheduling workflows.

---

## 1. System Design System: Clinical Teal Pro

CareSync implements an enhanced healthcare aesthetic featuring refined contrast, a deep clinical teal sidebar, crisp surfaces, and accessible typography:

| Design Token | Color Hex | Role |
| :--- | :--- | :--- |
| **Deep Clinical Teal Sidebar** | `#115E59` | Rich, authoritative clinical sidebar background |
| **Darker Sidebar Hover** | `#134E4A` | Restrained sidebar hover state and profile surface |
| **Primary Teal** | `#0F766E` | Primary actions, branding, active navigation indicators |
| **Primary Dark** | `#115E59` | Hover states, emphasized typography |
| **White Top Bar** | `#FFFFFF` | Top navigation bar with subtle bottom border |
| **Main Background** | `#F1F5F7` | Neutral clinical canvas with enhanced contrast |
| **White Cards** | `#FFFFFF` | Clinical cards with clean borders and subtle shadows |
| **Primary Text** | `#172B4D` | Deep slate-navy text for high contrast readability |
| **Secondary Text** | `#475569` | Subtitles, labels, and secondary metadata |
| **Borders** | `#D8E1E7` | Clean, subtle card and table borders |
| **Clinical Success** | `#15803D` | Admitted / Confirmed status badges |
| **Clinical Warning** | `#D97706` | Observation / Pending status badges |
| **Clinical Error** | `#DC2626` | Validation errors and critical alerts |

---

## 2. Express Backend (`server/`)

The backend lives alongside the frontend in the `server/` directory and is built with **Node.js**, **Express**, and **JavaScript ES modules**.

### Architecture:
```
server/
├── .env.example              # Sample environment configuration
├── .gitignore                # Ignores .env, node_modules, and logs
├── package.json              # Express, Helmet, CORS, Rate Limit, Zod, Morgan, Supertest
├── src/
│   ├── app.js                # Express app setup, middleware stack & route mounting
│   ├── server.js             # Server startup, port listener & graceful shutdown handlers
│   ├── config/
│   │   ├── database.js       # Reusable Mongoose connection and health status
│   │   └── env.js            # Environment validation via Zod
│   ├── controllers/
│   │   ├── health.controller.js
│   │   └── patient.controller.js
│   ├── models/
│   │   ├── user.model.js
│   │   ├── auth-session.model.js
│   │   ├── audit-event.model.js
│   │   ├── medical-record.model.js
│   │   ├── appointment.model.js
│   │   └── patient.model.js # Patient schema, generated ID, timestamps, indexes
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── errorHandler.js   # Centralized error handler & malformed JSON interceptor
│   │   └── notFound.js       # Consistent 404 handler for unmatched routes
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── health.routes.js
│   │   ├── medical-record.routes.js
│   │   ├── appointment.routes.js
│   │   └── patient.routes.js
│   ├── scripts/
│   │   └── create-user.js # Private interactive staff-account provisioning
│   └── validation/
│       ├── auth.validation.js
│       └── patient.validation.js
└── tests/
    ├── auth.test.js
    ├── clinical.test.js      # Isolated medical-record and appointment API tests
    ├── health.test.js
    └── patient.test.js       # Isolated patient API tests; no live database
```

### Security & Middleware Pipeline:
1. **Helmet**: Secures HTTP response headers.
2. **CORS Restriction**: Origin checking against configured `CLIENT_URL` (development allows localhost frontend ports; production strictly enforces configured origin).
3. **Rate Limiting**: `express-rate-limit` caps general API traffic (1000 requests/15m in dev, 100 in production) and login attempts (10 per 15 minutes).
4. **Environment Validation**: Zod parses and strictly validates `PORT`, `NODE_ENV`, and `CLIENT_URL` on boot.
5. **Development HTTP Logging**: Morgan dev logger active in development (never logs request bodies or sensitive medical data).
6. **Authentication & Authorization**: Bcrypt password hashes, opaque server-side sessions in HttpOnly/SameSite cookies, and role checks on all patient and clinical API operations.
7. **Safe Error Handling**: Unified JSON response structure `{ "success": false, "message": "..." }` with stack traces hidden in production.

### Authentication and account provisioning

There is no public registration endpoint or default account. An operator creates
staff accounts after the database is reachable:

```powershell
cd server
npm run users:create -- --email=staff@hospital.org --role=admin
```

The command prompts for a display name and a password twice; password input is
not echoed. Passwords must be at least 12 characters and no more than 72 UTF-8
bytes. Supported roles are `admin`, `clinician`, `nurse`, and `records_staff`.
The backend stores only bcrypt hashes and returns only public account fields.
Login sessions use random opaque tokens; only their SHA-256 hashes are stored
in MongoDB. Sessions expire after eight hours and are revoked at logout.
Cookies are HttpOnly and SameSite Strict, and Secure in production. Mutating
authenticated requests with an Origin header must come from a configured client
origin.

The browser login uses this backend session; the client cannot select its role.
Patient endpoints require an active session in every environment. Admin,
clinician, and nurse roles may create/update patient records; only admins may
archive them. All listed roles, including records staff, may read patient data.

Medical record reads are available to all staff roles; clinicians and nurses
may create/update records, and only admins may archive them. Appointment reads
are available to all staff roles; all roles may schedule appointments,
clinicians and nurses may update them, and only admins may archive/cancel them.
Every authenticated patient, medical-record, and appointment route records a
role decision in an append-only application audit collection before continuing.
Events include actor, action, resource, outcome, and a patient/record reference
when available, but never clinical text, request bodies, or query values.
Authorization fails closed if the audit write fails. The app does not expose
audit records through an API; deployment database permissions and retention
must also prevent unauthorized modification and deletion.

### Patient API

The schema follows the intake form: first/last name, date of birth, gender,
phone, email, address, emergency contact, status, physician, room, blood type,
and allergies. The backend generates an immutable `CS-...` identifier and
MongoDB enforces uniqueness with an index. Patient records have timestamps.
Directory deletion archives a record without deleting clinical history.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/patients` | Search, filter, sort, and paginate patients |
| `GET` | `/api/patients/:id` | Retrieve by stable patient ID or MongoDB ObjectId |
| `POST` | `/api/patients` | Validate and create a patient |
| `PATCH` | `/api/patients/:id` | Update explicitly allowed patient fields |
| `DELETE` | `/api/patients/:id` | Archive a patient without cascading deletion |

Use only fictional records locally. Authentication, CORS, and rate limiting
alone do not make a deployment compliant for real patient data.

### Health Route:
```http
GET /api/health
```
Response:
```json
{
  "success": true,
  "message": "CareSync API service is running",
  "environment": "development"
}
```

---

## 3. How to Run the Application

### A. Frontend (React + Vite)
```powershell
# From the project root
npm install
npm run dev
```
Accessible at: **`http://localhost:3000`**

The API URL defaults to `http://localhost:5000/api`. To override it, set
`VITE_API_BASE_URL` in a root `.env` file. Create the file only if one does not
already exist; do not overwrite an existing `.env`.

To compile the production build:
```powershell
npm run build
```

### B. Backend (Express)
```powershell
# Navigate into the server directory
cd server

# Install dependencies (if not already installed)
npm install

# Create a local environment file only if one does not already exist.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Set MONGODB_URI in server/.env using your deployment's secret configuration.
# The checked-in example intentionally leaves MONGODB_URI blank.

# Start the server (runs on port 5000)
npm start

# Or start in watch mode for development
npm run dev
```
Accessible at: **`http://localhost:5000`**
Health Check: **`http://localhost:5000/api/health`**

### C. Run Backend Automated Tests
```powershell
cd server
npm test
```
Runs authentication, health-check, patient, medical-record, and appointment
tests. API tests use isolated model mocks; they never connect to or modify a
live database.

---

## 4. Application Routes Table

### Frontend Routes
| Route | Component | Description |
| :--- | :--- | :--- |
| `/login` | `LoginPage` | Staff credential login against the backend |
| `/dashboard` | `DashboardPage` | Demonstration dashboard using clearly labeled synthetic data |
| `/patients` | `PatientsPage` | Patient directory with search, filter, sort, and pagination |
| `/patients/new` | `PatientFormPage` | New patient registration dossier |
| `/patients/:id` | `PatientDetailPage` | Patient clinical dossier with tabs (Overview, Records, Appointments) |
| `/patients/:id/edit`| `PatientFormPage` | Edit existing patient record |
| `/medical-records` | `MedicalRecordsPage` | Clinical encounter directory & dossier viewer |
| `/medical-records/new` | `NewMedicalRecordPage` | File new clinical progress notes & prescription record |
| `/appointments` | `AppointmentsPage` | Schedule, confirm, and cancel clinical appointments |
| `/settings` | `SettingsPage` | Staff profile, station preferences & security notices |

### Backend Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Confirms Express API service status and environment |
| `GET` | `/api/health/db` | Public | Reports MongoDB connection readiness without exposing connection details |
| `POST` | `/api/auth/login` | Public, rate-limited | Verify staff credentials and issue an HttpOnly session cookie |
| `GET` | `/api/auth/session` | Authenticated | Return the current account's public profile |
| `POST` | `/api/auth/logout` | Public, idempotent | Revoke the current session and clear its cookie |
| `GET` | `/api/patients` | Authenticated staff roles | Searchable, filterable, paginated patient directory |
| `GET` | `/api/patients/:id` | Authenticated staff roles | Retrieve by patient ID or MongoDB ObjectId |
| `POST` | `/api/patients` | Admin, clinician, nurse | Create a patient |
| `PATCH` | `/api/patients/:id` | Admin, clinician, nurse | Update allowed patient fields |
| `DELETE` | `/api/patients/:id` | Admin | Archive a patient |
| `GET` | `/api/medical-records` | Authenticated staff roles | Searchable, date-filtered, paginated clinical record list |
| `GET` | `/api/medical-records/:id` | Authenticated staff roles | Read a clinical record |
| `POST` | `/api/medical-records` | Admin, clinician, nurse | Create a record for an active patient |
| `PATCH` | `/api/medical-records/:id` | Admin, clinician, nurse | Update a record |
| `DELETE` | `/api/medical-records/:id` | Admin | Archive a record |
| `GET` | `/api/appointments` | Authenticated staff roles | Searchable, status/date-filtered, paginated appointment list |
| `GET` | `/api/appointments/:id` | Authenticated staff roles | Read an appointment |
| `POST` | `/api/appointments` | Authenticated staff roles | Schedule an appointment for an active patient |
| `PATCH` | `/api/appointments/:id` | Admin, clinician, nurse | Update appointment details or status |
| `DELETE` | `/api/appointments/:id` | Admin | Archive and cancel an appointment |

---

The backend validates its environment, connects to MongoDB before opening the HTTP
listener, and closes the HTTP and database connections on `SIGINT` or `SIGTERM`.
The API will not start if `MONGODB_URI` is missing or the initial database
connection fails. Keep real database credentials in the ignored `server/.env`
file or your deployment secret manager; never commit them. The backend resolves
`server/.env` relative to its configuration file (not the shell's working
directory), and variables already supplied by the runtime take precedence.

The patient directory, detail, create, and edit screens use the authenticated
Express API. Medical-record creation, listing, and patient detail tabs, as well
as appointment scheduling, listing, status updates, and cancellation, also use
authenticated API endpoints with loading, empty, and error states. The
dashboard remains a synthetic demonstration view and is explicitly labeled;
it must not be treated as live patient or appointment data.

## 5. Remaining Scope

- **Identity lifecycle hardening**: Password reset/change, MFA, account lockout
  and administrative account deactivation workflows are not implemented.
- **Audit governance**: The application writes authorization events, but
  production needs a reviewed retention policy, database-level append-only
  controls, monitoring, and verification of audit completeness.
- **Frontend validation**: API-connected screens have production-build
  validation; no dedicated frontend component-test runner is configured.
- **Production readiness**: These APIs have only been tested with isolated
  mocks; no production use with real patient data is appropriate until
  deployment controls, identity lifecycle, privacy review, and live DB testing
  are complete.
- **Atlas connectivity**: The configured Atlas connection is still failing at
  TLS handshake; live database authentication and sessions remain unverified.

Backend unit tests use isolated model mocks. They do not connect to Atlas,
verify live account provisioning, or test persistent clinical records and
audit events against a real MongoDB deployment.
