// Check what tools are available in the registry
import './dist/tools/index.js'; // Import to trigger registration
import { toolRegistry } from './dist/tools/registry.js';

console.log('🔍 Available tools in registry:');
toolRegistry.forEach((tool, index) => {
  console.log(`${index + 1}. ${tool.name}: ${tool.description}`);
});

console.log(`\nTotal tools: ${toolRegistry.length}`);