import { Router } from 'express';
import {
  getHealthStatus,
  getDatabaseHealthStatus,
} from '../controllers/health.controller.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    API process health and environment verification
 * @access  Public
 */
router.get('/health', getHealthStatus);

/**
 * @route   GET /api/health/db
 * @desc    MongoDB connection readiness and health check
 * @access  Public
 */
router.get('/health/db', getDatabaseHealthStatus);

export default router;
