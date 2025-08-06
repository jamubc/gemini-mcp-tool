import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TestFileManager } from '../src/utils/testFileManager.js';
import { Logger } from '../src/utils/logger.js';

/**
 * Global test setup for improved test isolation and cleanup
 * Addresses ENOENT/EPERM issues through systematic file lifecycle management
 */

// Global test lifecycle hooks
beforeAll(async () => {
  // Initialize logger for test environment
  process.env.LOG_LEVEL = 'warn'; // Reduce log noise during tests
  
  // Emergency cleanup any leftover files from previous test runs
  await TestFileManager.emergencyCleanup();
  
  // Ensure test directory exists and is clean
  await TestFileManager.resetTestDirectory();
  
  Logger.info('Global test setup completed');
});

afterAll(async () => {
  // Final cleanup after all tests complete
  await TestFileManager.emergencyCleanup();
  
  Logger.info('Global test cleanup completed');
});

// Per-test isolation (optional - individual tests can override)
beforeEach(async () => {
  // Ensure clean state before each test
  await TestFileManager.resetTestDirectory();
});

afterEach(async () => {
  // Clean up after each test
  await TestFileManager.cleanupTestFiles();
});