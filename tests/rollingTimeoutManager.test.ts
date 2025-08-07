import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RollingTimeoutManager, DEFAULT_TIMEOUT_CONFIG, SECURITY_LIMITS } from '../src/utils/rollingTimeoutManager.js';

describe('RollingTimeoutManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Configuration Validation', () => {
    it('should accept valid default configuration', () => {
      expect(() => new RollingTimeoutManager()).not.toThrow();
    });

    it('should reject rolling timeout below minimum', () => {
      expect(() => new RollingTimeoutManager({ 
        rollingTimeout: SECURITY_LIMITS.MIN_ROLLING_TIMEOUT - 1 
      })).toThrow('Rolling timeout must be between');
    });

    it('should reject rolling timeout above maximum', () => {
      expect(() => new RollingTimeoutManager({ 
        rollingTimeout: SECURITY_LIMITS.MAX_ROLLING_TIMEOUT + 1 
      })).toThrow('Rolling timeout must be between');
    });

    it('should reject absolute timeout below minimum', () => {
      expect(() => new RollingTimeoutManager({ 
        absoluteTimeout: SECURITY_LIMITS.MIN_ABSOLUTE_TIMEOUT - 1 
      })).toThrow('Absolute timeout must be between');
    });

    it('should reject absolute timeout above maximum', () => {
      expect(() => new RollingTimeoutManager({ 
        absoluteTimeout: SECURITY_LIMITS.MAX_ABSOLUTE_TIMEOUT + 1 
      })).toThrow('Absolute timeout must be between');
    });

    it('should reject absolute timeout less than or equal to rolling timeout', () => {
      expect(() => new RollingTimeoutManager({ 
        rollingTimeout: 30000,
        absoluteTimeout: 30000
      })).toThrow('Absolute timeout must be greater than rolling timeout');
    });
  });

  describe('Timeout Lifecycle', () => {
    it('should start with inactive state', () => {
      const manager = new RollingTimeoutManager();
      expect(manager.isActive()).toBe(false);
    });

    it('should become active when started', () => {
      const manager = new RollingTimeoutManager();
      manager.start();
      expect(manager.isActive()).toBe(true);
    });

    it('should become inactive when stopped', () => {
      const manager = new RollingTimeoutManager();
      manager.start();
      manager.stop();
      expect(manager.isActive()).toBe(false);
    });

    it('should provide abort signal', () => {
      const manager = new RollingTimeoutManager();
      const signal = manager.getAbortSignal();
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });
  });

  describe('Rolling Timeout Behavior', () => {
    it('should trigger rolling timeout after inactivity period', async () => {
      const manager = new RollingTimeoutManager({ rollingTimeout: 5000 }); // Use valid minimum
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      signal.addEventListener('abort', () => { aborted = true; });

      manager.start();
      
      // Advance time past rolling timeout
      vi.advanceTimersByTime(5100);
      
      expect(aborted).toBe(true);
      expect(signal.aborted).toBe(true);
    });

    it('should reset rolling timeout on activity', async () => {
      const manager = new RollingTimeoutManager({ rollingTimeout: 5000 }); // Use valid minimum
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      signal.addEventListener('abort', () => { aborted = true; });

      manager.start();
      
      // Advance time partway
      vi.advanceTimersByTime(2500);
      expect(aborted).toBe(false);
      
      // Reset on activity
      manager.resetOnActivity();
      
      // Advance time past original timeout point
      vi.advanceTimersByTime(3000);
      expect(aborted).toBe(false);
      
      // Should timeout after full rolling period from reset
      vi.advanceTimersByTime(2500);
      expect(aborted).toBe(true);
    });

    it('should handle multiple activity resets', async () => {
      const manager = new RollingTimeoutManager({ rollingTimeout: 5000 });
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      signal.addEventListener('abort', () => { aborted = true; });

      manager.start();
      
      // Multiple resets within rolling timeout period
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
        manager.resetOnActivity();
        expect(aborted).toBe(false);
      }
      
      // Should timeout after no more resets
      vi.advanceTimersByTime(5100);
      expect(aborted).toBe(true);
    });
  });

  describe('Absolute Timeout Behavior', () => {
    it('should trigger absolute timeout regardless of activity', async () => {
      const manager = new RollingTimeoutManager({ 
        rollingTimeout: 5000, 
        absoluteTimeout: 50000 
      });
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      signal.addEventListener('abort', () => { aborted = true; });

      manager.start();
      
      // Keep resetting rolling timeout
      for (let i = 0; i < 24; i++) { // Reduce to 24 iterations to stay under absolute timeout
        vi.advanceTimersByTime(2000);
        manager.resetOnActivity();
        expect(aborted).toBe(false);
      }
      
      // Should trigger absolute timeout (24 * 2000 = 48000ms, need 50000ms total)
      vi.advanceTimersByTime(2100);
      expect(aborted).toBe(true);
    });

    it('should trigger rolling timeout before absolute timeout', async () => {
      const manager = new RollingTimeoutManager({ 
        rollingTimeout: 5000, 
        absoluteTimeout: 50000 
      });
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      let abortReason = '';
      signal.addEventListener('abort', (event: any) => { 
        aborted = true; 
        abortReason = event.target.reason?.message || 'unknown';
      });

      manager.start();
      
      // Don't reset rolling timeout
      vi.advanceTimersByTime(5100);
      
      expect(aborted).toBe(true);
      expect(abortReason).toContain('inactivity');
    });
  });

  describe('Performance Optimization', () => {
    it('should throttle timeout resets when enabled', () => {
      const manager = new RollingTimeoutManager({ 
        enableThrottling: true,
        throttleInterval: 100
      });
      manager.start();

      const spy = vi.spyOn(global, 'setTimeout');
      const initialCallCount = spy.mock.calls.length;

      // Multiple rapid resets within throttle window
      manager.resetOnActivity();
      manager.resetOnActivity();
      manager.resetOnActivity();

      // Should not create multiple timeouts
      expect(spy.mock.calls.length).toBe(initialCallCount);
    });

    it('should not throttle when throttling disabled', () => {
      const manager = new RollingTimeoutManager({ 
        enableThrottling: false,
        throttleInterval: 0 // Ensure no throttling
      });

      const spy = vi.spyOn(global, 'setTimeout');
      manager.start(); // This will create first setTimeout
      const initialCallCount = spy.mock.calls.length;

      // Reset should create new setTimeout when throttling is disabled
      manager.resetOnActivity();
      const afterResetCount = spy.mock.calls.length;
      expect(afterResetCount).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate timeout statistics', () => {
      const manager = new RollingTimeoutManager({ 
        rollingTimeout: 5000,
        absoluteTimeout: 50000
      });
      
      manager.start();
      vi.advanceTimersByTime(2500);
      
      const stats = manager.getStats();
      expect(stats.totalDuration).toBe(2500);
      expect(stats.timeSinceLastActivity).toBe(2500);
      expect(stats.rollingTimeoutRemaining).toBe(2500);
      expect(stats.absoluteTimeoutRemaining).toBe(47500);
      expect(stats.isActive).toBe(true);
    });

    it('should update statistics after activity reset', () => {
      const manager = new RollingTimeoutManager({ 
        rollingTimeout: 5000,
        absoluteTimeout: 50000
      });
      
      manager.start();
      vi.advanceTimersByTime(2500);
      manager.resetOnActivity();
      vi.advanceTimersByTime(1000);
      
      const stats = manager.getStats();
      expect(stats.totalDuration).toBe(3500);
      expect(stats.timeSinceLastActivity).toBe(1000);
      expect(stats.rollingTimeoutRemaining).toBe(4000);
      expect(stats.absoluteTimeoutRemaining).toBe(46500);
    });
  });

  describe('Error Handling', () => {
    it('should handle stop called multiple times', () => {
      const manager = new RollingTimeoutManager();
      manager.start();
      
      expect(() => {
        manager.stop();
        manager.stop();
        manager.stop();
      }).not.toThrow();
      
      expect(manager.isActive()).toBe(false);
    });

    it('should handle resetOnActivity before start', () => {
      const manager = new RollingTimeoutManager();
      
      expect(() => {
        manager.resetOnActivity();
      }).not.toThrow();
    });

    it('should handle resetOnActivity after stop', () => {
      const manager = new RollingTimeoutManager();
      manager.start();
      manager.stop();
      
      expect(() => {
        manager.resetOnActivity();
      }).not.toThrow();
    });
  });

  describe('Custom Configuration', () => {
    it('should accept custom rolling timeout', () => {
      const customTimeout = 15000;
      const manager = new RollingTimeoutManager({ rollingTimeout: customTimeout });
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      signal.addEventListener('abort', () => { aborted = true; });

      manager.start();
      
      // Should not timeout before custom period
      vi.advanceTimersByTime(customTimeout - 100);
      expect(aborted).toBe(false);
      
      // Should timeout after custom period
      vi.advanceTimersByTime(200);
      expect(aborted).toBe(true);
    });

    it('should accept custom absolute timeout', () => {
      const manager = new RollingTimeoutManager({ 
        rollingTimeout: 5000,
        absoluteTimeout: 40000
      });
      const signal = manager.getAbortSignal();
      
      let aborted = false;
      signal.addEventListener('abort', () => { aborted = true; });

      manager.start();
      
      // Keep activity alive but hit absolute timeout
      for (let i = 0; i < 19; i++) {
        vi.advanceTimersByTime(2000);
        manager.resetOnActivity();
      }
      
      vi.advanceTimersByTime(2000);
      expect(aborted).toBe(true);
    });
  });
});