import { Logger } from '../utils/logger.js';
import { ChatMessage } from './chatManager.js';
import { AgentState, ParticipationState } from '../persistence/jsonChatPersistence.js';

/**
 * Manages agent participation states and determines appropriate context for each agent
 * Handles three participation states:
 * - 'new': First time accessing chat -> show full history
 * - 'returning': First time back after other agents participated -> show delta since last seen
 * - 'continuous': Subsequent interactions in sequence -> show only Gemini reply
 */
export class AgentParticipationManager {
  
  /**
   * Get messages that should be shown to an agent based on their participation state
   */
  static getMessagesForAgent(
    agentId: string,
    messages: ChatMessage[],
    agentStates: Record<string, AgentState>,
    currentGeminiReply?: string
  ): ChatMessage[] {
    const agentState = agentStates[agentId];
    
    if (!agentState || agentState.participationState === 'new') {
      // New agent: show full conversation history
      Logger.debug(`Agent ${agentId}: new participant - showing full history (${messages.length} messages)`);
      return messages;
    }
    
    if (agentState.participationState === 'returning') {
      // Returning agent: show messages since their last interaction
      const deltaMessages = this.getMessagesSinceLastSeen(messages, agentState.lastSeenMessageId);
      Logger.debug(`Agent ${agentId}: returning participant - showing ${deltaMessages.length} messages since last seen`);
      return deltaMessages;
    }
    
    if (agentState.participationState === 'continuous') {
      // Continuous agent: show only the latest Gemini reply
      if (currentGeminiReply) {
        const geminiMessage: ChatMessage = {
          id: `temp-${Date.now()}`,
          chatId: messages[0]?.chatId || '',
          agent: 'gemini',
          message: currentGeminiReply,
          timestamp: new Date(),
          sanitized: false
        };
        Logger.debug(`Agent ${agentId}: continuous participant - showing only Gemini reply`);
        return [geminiMessage];
      } else {
        // If no current Gemini reply, show the last message (likely the most recent Gemini response)
        const lastMessage = messages[messages.length - 1];
        Logger.debug(`Agent ${agentId}: continuous participant - showing last message only`);
        return lastMessage ? [lastMessage] : [];
      }
    }
    
    Logger.warn(`Agent ${agentId}: unknown participation state, defaulting to full history`);
    return messages;
  }

  /**
   * Update agent state when they interact with a chat
   */
  static updateAgentParticipation(
    agentId: string,
    chatId: string,
    newMessageId: string,
    agentStates: Record<string, AgentState>
  ): Record<string, AgentState> {
    const currentState = agentStates[agentId];
    
    if (!currentState) {
      // First time this agent is interacting with this chat
      agentStates[agentId] = {
        lastSeenMessageId: newMessageId,
        participationState: 'new',
        lastActiveAt: new Date()
      };
      Logger.debug(`Agent ${agentId}: initialized as new participant in chat ${chatId}`);
    } else {
      // Update existing state
      const updatedState = { ...currentState };
      updatedState.lastSeenMessageId = newMessageId;
      updatedState.lastActiveAt = new Date();
      
      // Auto-transition states when agent sends a message
      if (currentState.participationState === 'new') {
        updatedState.participationState = 'continuous';
        Logger.debug(`Agent ${agentId}: transitioned from new to continuous in chat ${chatId}`);
      } else if (currentState.participationState === 'returning') {
        updatedState.participationState = 'continuous';
        Logger.debug(`Agent ${agentId}: transitioned from returning to continuous in chat ${chatId}`);
      }
      
      agentStates[agentId] = updatedState;
    }
    
    return agentStates;
  }

  /**
   * Mark agent as returning when other agents have participated since their last interaction
   */
  static markAgentAsReturning(
    agentId: string,
    agentStates: Record<string, AgentState>
  ): Record<string, AgentState> {
    const currentState = agentStates[agentId];
    
    if (currentState && currentState.participationState === 'continuous') {
      // Transition from continuous to returning when other agents have been active
      agentStates[agentId] = {
        ...currentState,
        participationState: 'returning'
      };
      Logger.debug(`Agent ${agentId}: marked as returning due to other agent activity`);
    }
    
    return agentStates;
  }

  /**
   * Check if any agents need to be marked as returning due to other agent activity
   */
  static updateStatesForNewMessage(
    newMessageAgentId: string,
    allAgentStates: Record<string, AgentState>
  ): Record<string, AgentState> {
    const updatedStates = { ...allAgentStates };
    
    // Mark all other continuous agents as returning since someone else just participated
    Object.keys(updatedStates).forEach(agentId => {
      if (agentId !== newMessageAgentId) {
        const state = updatedStates[agentId];
        if (state && state.participationState === 'continuous') {
          updatedStates[agentId] = {
            ...state,
            participationState: 'returning'
          };
          Logger.debug(`Agent ${agentId}: marked as returning due to ${newMessageAgentId} activity`);
        }
      }
    });
    
    return updatedStates;
  }

  /**
   * Get messages since the agent's last seen message
   */
  private static getMessagesSinceLastSeen(
    messages: ChatMessage[],
    lastSeenMessageId: string | null
  ): ChatMessage[] {
    if (!lastSeenMessageId) {
      return messages;
    }
    
    const lastSeenIndex = messages.findIndex(msg => msg.id === lastSeenMessageId);
    
    if (lastSeenIndex === -1) {
      // Last seen message not found, return all messages
      Logger.warn(`Last seen message ${lastSeenMessageId} not found, returning all messages`);
      return messages;
    }
    
    // Return messages after the last seen message (excluding the last seen message itself)
    return messages.slice(lastSeenIndex + 1);
  }

  /**
   * Get summary of agent participation states for debugging
   */
  static getParticipationSummary(agentStates: Record<string, AgentState>): string {
    const summary = Object.entries(agentStates).map(([agentId, state]) => {
      const lastActive = state.lastActiveAt 
        ? new Date(state.lastActiveAt).toISOString() 
        : 'never';
      return `${agentId}:${state.participationState}(${lastActive})`;
    }).join(', ');
    
    return `Agent states: ${summary}`;
  }

  /**
   * Validate agent states and clean up invalid entries
   */
  static validateAndCleanStates(
    agentStates: Record<string, AgentState>,
    validMessages: ChatMessage[]
  ): Record<string, AgentState> {
    const cleanedStates: Record<string, AgentState> = {};
    const validMessageIds = new Set(validMessages.map(msg => msg.id));
    
    Object.entries(agentStates).forEach(([agentId, state]) => {
      const cleanedState = { ...state };
      
      // Check if lastSeenMessageId is still valid
      if (state.lastSeenMessageId && !validMessageIds.has(state.lastSeenMessageId)) {
        Logger.warn(`Agent ${agentId}: lastSeenMessageId ${state.lastSeenMessageId} no longer exists, resetting to new state`);
        cleanedState.lastSeenMessageId = null;
        cleanedState.participationState = 'new';
      }
      
      cleanedStates[agentId] = cleanedState;
    });
    
    return cleanedStates;
  }
}