import { NotificationSchema } from "@modelcontextprotocol/sdk/types.js";

export interface ParsedNotification {
  cleanedResponse: string;
  notifications: string[];
}

/**
 * Parses tool response to extract notifications from [SYSTEM_METADATA] block
 * and returns cleaned response without notifications for LLM consumption
 */
export function parseNotifications(response: string): ParsedNotification {
  const notifications: string[] = [];
  let cleanedResponse = response;

  // Find SYSTEM_METADATA block
  const metadataMatch = response.match(/\[SYSTEM_METADATA\]:\s*({.*})$/);
  
  if (metadataMatch) {
    try {
      const metadata = JSON.parse(metadataMatch[1]);
      
      // Extract notifications if present
      if (metadata.notifications && Array.isArray(metadata.notifications)) {
        notifications.push(...metadata.notifications);
        
        // Remove notifications from metadata before reconstructing
        delete metadata.notifications;
        
        // Reconstruct the response without notifications
        const cleanedMetadata = JSON.stringify(metadata, null, 2);
        cleanedResponse = response.replace(
          metadataMatch[0],
          `[SYSTEM_METADATA]: ${cleanedMetadata}`
        );
      }
    } catch (error) {
      // If parsing fails, return original response
      console.warn('[Notification Parser] Failed to parse SYSTEM_METADATA:', error);
    }
  }

  return {
    cleanedResponse,
    notifications
  };
}

/**
 * Creates MCP notification objects from notification strings
 */
export function createMCPNotifications(notifications: string[]): any[] {
  return notifications.map(message => ({
    method: "notifications/message",
    params: {
      level: "info",
      message,
      // Optional: Add timestamp
      timestamp: new Date().toISOString()
    }
  }));
}