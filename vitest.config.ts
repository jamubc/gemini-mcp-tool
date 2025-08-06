import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment configuration
    globals: true,
    environment: 'node',
    
    // Test file patterns
    include: [
      'tests/**/*.test.ts',
      'src/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'docs/**'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/tools/test-tool.example.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 90,
          statements: 90
        },
        // Higher thresholds for critical components
        'src/managers/chatManager.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'src/persistence/sqlitePersistence.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/tools/*.ts': {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    
    // Timeout configuration - extended for reliability testing
    testTimeout: 60000, // 60 seconds for Gemini CLI tests
    hookTimeout: 15000, // 15 seconds for setup/teardown with file operations
    
    // Test execution configuration
    maxConcurrency: 1, // Sequential execution to prevent file system conflicts
    
    // Setup files
    setupFiles: ['./tests/test-setup.ts'],
    
    // Test categorization and filtering
    sequence: {
      concurrent: false, // Run tests sequentially for database tests
      shuffle: false     // Maintain deterministic test order
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json'
    },
    
    // Watch mode configuration
    watch: false, // Disable watch mode by default for CI
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true
  },
  
  // Resolve configuration for TypeScript modules
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});