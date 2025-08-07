import { beforeAll, afterAll } from 'vitest';
import { Logger } from '../src/utils/logger.js';

/**
 * Global test setup for unified system tests
 */

// Global test lifecycle hooks
beforeAll(async () => {
  // Initialize logger for test environment
  process.env.LOG_LEVEL = 'warn'; // Reduce log noise during tests
  
  Logger.info('Global test setup completed');
});

afterAll(async () => {
  Logger.info('Global test cleanup completed');
});