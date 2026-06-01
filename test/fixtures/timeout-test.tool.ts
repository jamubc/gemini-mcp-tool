import { z } from 'zod';
import { UnifiedTool } from './registry.js';

const timeoutTestArgsSchema = z.object({
  duration: z.number().min(10).describe("Duration in milliseconds (minimum 10ms)"),
});

export const timeoutTestTool: UnifiedTool = {
  name: "timeout-test",
  description: "Test timeout prevention by running for a specified duration",
  zodSchema: timeoutTestArgsSchema,
  prompt: {
    description: "Test the timeout prevention system by running a long operation",
  },
  category: 'simple',
  execute: async (args, onProgress) => {
    const duration = args.duration as number;
    const steps = Math.ceil(duration / 5000); // Progress every 5 seconds
    const stepDuration = duration / steps;
    const startTime = Date.now();
    
    const results: string[] = [];
    results.push(`Starting timeout test for ${duration}ms (${duration/1000}s)`);
    
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      const elapsed = Date.now() - startTime;
      results.push(`Step ${i}/${steps} completed - Elapsed: ${Math.round(elapsed/1000)}s`);
    }
    
    const totalElapsed = Date.now() - startTime;
    results.push(`\nTimeout test completed successfully!`);
    results.push(`Target duration: ${duration}ms`);
    results.push(`Actual duration: ${totalElapsed}ms`);
    
    return results.join('\n');
  }
};