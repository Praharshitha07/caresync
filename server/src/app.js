import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import medicalRecordRoutes from './routes/medical-record.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import staffRoutes from './routes/staff.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. CORS Configuration
// In development, permit local frontend development ports (Vite runs on 3000 or 5173).
// In production, strictly restrict to the configured CLIENT_URL.
const allowedOrigins = env.CLIENT_URL.split(',').map((origin) => origin.trim());
if (env.NODE_ENV === 'development') {
  if (!allowedOrigins.includes('http://localhost:3000')) {
    allowedOrigins.push('http://localhost:3000');
  }
  if (!allowedOrigins.includes('http://localhost:5173')) {
    allowedOrigins.push('http://localhost:5173');
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: origin ${origin} is not authorized`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'development' ? 1000 : 100, // relaxed in dev, protected in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api', limiter);

// 4. HTTP Request Logging (dev-only; suppresses request bodies and PHI)
if (env.NODE_ENV === 'development') {
  app.use(
    morgan('dev', {
      skip: (req) =>
        ['/api/patients', '/api/medical-records', '/api/appointments'].some(
          (prefix) => req.path.startsWith(prefix)
        ),
    })
  );
}

// 5. Body Parsing with Safe Payload Limit
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/', (req, res) =>
  res.json({
    success: true,
    message: 'CareSync server is running successfully',
  })
);

// 6. API Route Registration
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);

// 7. Not Found Handler
app.use(notFound);

// 8. Centralized Error Handler
app.use(errorHandler);

export default app;
