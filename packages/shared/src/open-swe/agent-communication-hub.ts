import { EventEmitter } from 'events';
import { Observable, Subject, BehaviorSubject, merge } from 'rxjs';
import { filter, map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { 
  AgentMessage, 
  AgentRole,
  TaskDelegation
} from './types.js';
import {
  AgentEvent,
  AgentEventType,
  MessageEnvelope,
  MessageDeliveryStatus,
  BroadcastSubscription,
  CommunicationHubConfig,
  RegistryOperationResult
} from './agent-registry.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Message queue for agent communication
 */
interface MessageQueue {
  agentId: string;
  messages: MessageEnvelope[];
  lastProcessed: number;
  processingActive: boolean;
}

/**
 * Comprehensive Agent Communication Hub for multi-agent collaboration.
 * 
 * Handles message routing, broadcasting, event-driven communication,
 * and reliable message delivery between agents in the Open SWE system.
 */
export class AgentCommunicationHub extends EventEmitter {
  private readonly logger = createLogger(LogLevel.INFO, 'AgentCommunicationHub');

  /**
   * Message queues by agent ID
   */
  private readonly messageQueues = new Map<string, MessageQueue>();

  /**
   * Active broadcast subscriptions
   */
  private readonly broadcastSubscriptions = new Map<string, BroadcastSubscription>();

  /**
   * Event streams by agent ID
   */
  private readonly agentEventStreams = new Map<string, Subject<AgentEvent>>();

  /**
   * Global event stream for all communication events
   */
  private readonly globalEventStream = new Subject<AgentEvent>();

  /**
   * Message history for persistence
   */
  private readonly messageHistory = new Map<string, AgentMessage[]>();

  /**
   * Hub configuration
   */
  private readonly config: CommunicationHubConfig;

  /**
   * Message processing intervals by agent
   */
  private readonly processingIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Hub statistics
   */
  private readonly statistics = {
    totalMessagesProcessed: 0,
    totalBroadcasts: 0,
    activeSubscriptions: 0,
    failedDeliveries: 0,
    avgDeliveryTime: 0,
    lastUpdated: Date.now()
  };

  /**
   * Creates a new AgentCommunicationHub
   * 
   * @param config - Hub configuration options
   */
  constructor(config?: Partial<CommunicationHubConfig>) {
    super();

    this.config = {
      maxQueueSize: 1000,
      messageTimeout: 30000,     // 30 seconds
      maxRetryAttempts: 3,
      enablePersistence: true,
      messageRetentionTime: 86400000, // 24 hours
      ...config
    };

    this.initializeCleanupRoutines();
    this.logger.info('AgentCommunicationHub initialized', { config: this.config });
  }

  /**
   * Sends a message from one agent to another with delivery guarantees
   * 
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param message - Message to send
   * @returns Promise resolving to operation result
   */
  async sendMessage(from: string, to: string, message: AgentMessage): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      // Validate message
      if (!message.id || !message.content) {
        return {
          success: false,
          error: 'Invalid message: missing required fields',
          executionTime: Date.now() - startTime
        };
      }

      // Ensure message has correct sender
      const messageWithSender: AgentMessage = {
        ...message,
        fromAgentId: from,
        toAgentId: to,
        timestamp: Date.now()
      };

      // Create message envelope
      const envelope: MessageEnvelope = {
        message: messageWithSender,
        status: 'pending',
        attempts: 0,
        queuedAt: Date.now()
      };

      // Get or create recipient queue
      const queue = this.getOrCreateQueue(to);

      // Check queue capacity
      if (queue.messages.length >= this.config.maxQueueSize) {
        return {
          success: false,
          error: `Message queue for agent ${to} is full (${this.config.maxQueueSize} messages)`,
          executionTime: Date.now() - startTime
        };
      }

      // Add to queue
      queue.messages.push(envelope);
      queue.lastProcessed = Date.now();

      // Start processing if not already active
      if (!queue.processingActive) {
        this.startMessageProcessing(to);
      }

      // Store in history if persistence is enabled
      if (this.config.enablePersistence) {
        this.addToHistory(messageWithSender);
      }

      // Emit message queued event
      this.emitEvent({
        id: `msg_queued_${message.id}`,
        type: 'message_received',
        agentId: to,
        payload: { 
          from, 
          to, 
          messageId: message.id, 
          type: message.type,
          priority: message.priority 
        },
        timestamp: Date.now(),
        priority: message.priority
      });

      this.statistics.totalMessagesProcessed++;
      this.updateStatistics();

      this.logger.info('Message queued for delivery', {
        from,
        to,
        messageId: message.id,
        queueSize: queue.messages.length
      });

      return {
        success: true,
        metadata: { 
          messageId: message.id, 
          queueSize: queue.messages.length 
        },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to send message', {
        from,
        to,
        messageId: message.id,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Broadcasts a message to all agents with a specific role
   * 
   * @param senderAgentId - Sender agent ID
   * @param role - Target agent role
   * @param message - Message to broadcast
   * @param excludeSender - Whether to exclude sender from broadcast
   * @returns Promise resolving to operation result with delivery count
   */
  async broadcastToRole(
    senderAgentId: string,
    role: AgentRole,
    message: AgentMessage,
    excludeSender: boolean = true
  ): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      // Find all subscriptions for this role
      const targetSubscriptions = Array.from(this.broadcastSubscriptions.values())
        .filter(sub => 
          sub.active && 
          (!sub.roleFilter || sub.roleFilter === role) &&
          (!excludeSender || sub.agentId !== senderAgentId)
        );

      const deliveryPromises: Promise<RegistryOperationResult>[] = [];
      
      // Send to each subscriber
      for (const subscription of targetSubscriptions) {
        const broadcastMessage: AgentMessage = {
          ...message,
          id: `${message.id}_broadcast_${subscription.agentId}`,
          fromAgentId: senderAgentId,
          toAgentId: subscription.agentId,
          type: 'notification',
          timestamp: Date.now()
        };

        deliveryPromises.push(
          this.sendMessage(senderAgentId, subscription.agentId, broadcastMessage)
        );
      }

      // Wait for all deliveries
      const results = await Promise.all(deliveryPromises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      // Emit broadcast event
      this.emitEvent({
        id: `broadcast_${role}_${Date.now()}`,
        type: 'message_received',
        agentId: senderAgentId,
        payload: { 
          role, 
          messageId: message.id, 
          targetCount: targetSubscriptions.length,
          successCount,
          failureCount
        },
        timestamp: Date.now(),
        priority: message.priority
      });

      this.statistics.totalBroadcasts++;
      this.updateStatistics();

      this.logger.info('Role broadcast completed', {
        senderAgentId,
        role,
        messageId: message.id,
        targetCount: targetSubscriptions.length,
        successCount,
        failureCount
      });

      return {
        success: successCount > 0,
        metadata: { 
          targetCount: targetSubscriptions.length,
          successCount, 
          failureCount 
        },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Broadcast to role failed', {
        senderAgentId,
        role,
        messageId: message.id,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Creates an event subscription for an agent
   * 
   * @param agentId - Agent identifier
   * @param eventType - Optional event type filter
   * @param roleFilter - Optional role filter for broadcasts
   * @returns Observable stream of filtered events
   */
  subscribeToEvents(
    agentId: string, 
    eventType?: AgentEventType,
    roleFilter?: AgentRole
  ): Observable<AgentEvent> {
    // Get or create agent-specific event stream
    if (!this.agentEventStreams.has(agentId)) {
      this.agentEventStreams.set(agentId, new Subject<AgentEvent>());
    }

    // Create broadcast subscription if roleFilter is provided
    if (roleFilter) {
      const subscriptionId = `${agentId}_${roleFilter}_${Date.now()}`;
      const subscription: BroadcastSubscription = {
        id: subscriptionId,
        agentId,
        roleFilter,
        eventTypeFilter: eventType ? [eventType] : undefined,
        createdAt: Date.now(),
        active: true
      };

      this.broadcastSubscriptions.set(subscriptionId, subscription);
      this.statistics.activeSubscriptions++;
      this.updateStatistics();

      this.logger.info('Event subscription created', {
        agentId,
        subscriptionId,
        eventType,
        roleFilter
      });
    }

    // Return filtered observable
    const agentStream = this.agentEventStreams.get(agentId)!;
    const globalStream = this.globalEventStream.asObservable();

    return merge(agentStream.asObservable(), globalStream).pipe(
      filter(event => {
        // Include events specifically for this agent
        if (event.agentId === agentId) {
          return true;
        }

        // Include global events if no specific filters
        if (!eventType && !roleFilter) {
          return true;
        }

        // Apply event type filter
        if (eventType && event.type !== eventType) {
          return false;
        }

        return true;
      }),
      distinctUntilChanged((a, b) => a.id === b.id)
    );
  }

  /**
   * Unsubscribes an agent from event notifications
   * 
   * @param agentId - Agent identifier
   * @param subscriptionId - Optional specific subscription ID
   * @returns Operation result
   */
  async unsubscribeFromEvents(agentId: string, subscriptionId?: string): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      let removedCount = 0;

      if (subscriptionId) {
        // Remove specific subscription
        const subscription = this.broadcastSubscriptions.get(subscriptionId);
        if (subscription && subscription.agentId === agentId) {
          this.broadcastSubscriptions.delete(subscriptionId);
          removedCount = 1;
        }
      } else {
        // Remove all subscriptions for agent
        const agentSubscriptions = Array.from(this.broadcastSubscriptions.entries())
          .filter(([_, sub]) => sub.agentId === agentId);

        for (const [subId, _] of agentSubscriptions) {
          this.broadcastSubscriptions.delete(subId);
          removedCount++;
        }

        // Close agent-specific event stream
        const agentStream = this.agentEventStreams.get(agentId);
        if (agentStream) {
          agentStream.complete();
          this.agentEventStreams.delete(agentId);
        }
      }

      this.statistics.activeSubscriptions -= removedCount;
      this.updateStatistics();

      this.logger.info('Event unsubscription completed', {
        agentId,
        subscriptionId,
        removedCount
      });

      return {
        success: true,
        metadata: { removedCount },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to unsubscribe from events', {
        agentId,
        subscriptionId,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Gets the current message queue status for an agent
   * 
   * @param agentId - Agent identifier
   * @returns Queue information or null if no queue exists
   */
  getQueueStatus(agentId: string): { 
    size: number; 
    pendingCount: number; 
    failedCount: number; 
    lastProcessed: number;
  } | null {
    const queue = this.messageQueues.get(agentId);
    if (!queue) {
      return null;
    }

    const pendingCount = queue.messages.filter(m => m.status === 'pending').length;
    const failedCount = queue.messages.filter(m => m.status === 'failed').length;

    return {
      size: queue.messages.length,
      pendingCount,
      failedCount,
      lastProcessed: queue.lastProcessed
    };
  }

  /**
   * Gets message history for an agent or between two agents
   * 
   * @param agentId - Agent identifier
   * @param otherAgentId - Optional other agent for bilateral history
   * @param limit - Maximum number of messages to return
   * @returns Array of historical messages
   */
  getMessageHistory(agentId: string, otherAgentId?: string, limit: number = 50): AgentMessage[] {
    if (!this.config.enablePersistence) {
      return [];
    }

    const history = this.messageHistory.get(agentId) || [];
    
    let filteredHistory = history;
    
    if (otherAgentId) {
      filteredHistory = history.filter(msg => 
        (msg.fromAgentId === agentId && msg.toAgentId === otherAgentId) ||
        (msg.fromAgentId === otherAgentId && msg.toAgentId === agentId)
      );
    }

    // Sort by timestamp descending and limit
    return filteredHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Processes pending messages in agent queues with retry logic
   * 
   * @param agentId - Agent identifier
   * @private
   */
  private startMessageProcessing(agentId: string): void {
    const queue = this.messageQueues.get(agentId);
    if (!queue || queue.processingActive) {
      return;
    }

    queue.processingActive = true;

    const processMessages = async () => {
      const pendingMessages = queue.messages.filter(env => env.status === 'pending');
      
      for (const envelope of pendingMessages) {
        try {
          const deliveryStartTime = Date.now();
          
          // Simulate message delivery (in real implementation, this would be actual agent communication)
          const deliverySuccess = Math.random() > 0.1; // 90% success rate simulation
          
          if (deliverySuccess) {
            envelope.status = 'delivered';
            envelope.deliveredAt = Date.now();
            
            // Emit delivery success event
            this.emitAgentEvent(agentId, {
              id: `delivery_success_${envelope.message.id}`,
              type: 'message_received',
              agentId,
              payload: { 
                messageId: envelope.message.id,
                deliveryTime: Date.now() - deliveryStartTime
              },
              timestamp: Date.now(),
              priority: envelope.message.priority
            });

            // Update statistics
            const deliveryTime = Date.now() - envelope.queuedAt;
            this.statistics.avgDeliveryTime = (this.statistics.avgDeliveryTime + deliveryTime) / 2;

          } else {
            envelope.attempts++;
            
            if (envelope.attempts >= this.config.maxRetryAttempts) {
              envelope.status = 'failed';
              envelope.error = 'Maximum retry attempts exceeded';
              this.statistics.failedDeliveries++;
              
              this.logger.warn('Message delivery failed permanently', {
                agentId,
                messageId: envelope.message.id,
                attempts: envelope.attempts
              });
            } else {
              // Schedule retry
              envelope.retryAt = Date.now() + (1000 * Math.pow(2, envelope.attempts)); // Exponential backoff
              
              this.logger.info('Message delivery failed, scheduling retry', {
                agentId,
                messageId: envelope.message.id,
                attempt: envelope.attempts,
                retryAt: envelope.retryAt
              });
            }
          }
          
        } catch (error) {
          envelope.attempts++;
          envelope.error = error instanceof Error ? error.message : 'Unknown error';
          
          if (envelope.attempts >= this.config.maxRetryAttempts) {
            envelope.status = 'failed';
            this.statistics.failedDeliveries++;
          }
          
          this.logger.error('Message processing error', {
            agentId,
            messageId: envelope.message.id,
            error: envelope.error
          });
        }
      }

      // Clean up old messages
      const now = Date.now();
      queue.messages = queue.messages.filter(env => {
        if (env.status === 'delivered' || env.status === 'failed') {
          return (now - env.queuedAt) < this.config.messageRetentionTime;
        }
        return true;
      });

      // Check if there are still pending messages to process
      const stillPending = queue.messages.some(env => 
        env.status === 'pending' || 
        (env.retryAt && env.retryAt <= now)
      );

      if (stillPending) {
        // Schedule next processing cycle
        setTimeout(processMessages, 1000); // Process every second
      } else {
        queue.processingActive = false;
      }
    };

    processMessages();
  }

  /**
   * Gets or creates a message queue for an agent
   * 
   * @private
   */
  private getOrCreateQueue(agentId: string): MessageQueue {
    let queue = this.messageQueues.get(agentId);
    
    if (!queue) {
      queue = {
        agentId,
        messages: [],
        lastProcessed: Date.now(),
        processingActive: false
      };
      
      this.messageQueues.set(agentId, queue);
      this.logger.info('Created message queue for agent', { agentId });
    }
    
    return queue;
  }

  /**
   * Adds a message to the persistent history
   * 
   * @private
   */
  private addToHistory(message: AgentMessage): void {
    // Add to sender's history
    if (message.fromAgentId) {
      if (!this.messageHistory.has(message.fromAgentId)) {
        this.messageHistory.set(message.fromAgentId, []);
      }
      this.messageHistory.get(message.fromAgentId)!.push(message);
    }

    // Add to recipient's history
    if (message.toAgentId) {
      if (!this.messageHistory.has(message.toAgentId)) {
        this.messageHistory.set(message.toAgentId, []);
      }
      this.messageHistory.get(message.toAgentId)!.push(message);
    }
  }

  /**
   * Emits an event to the global stream
   * 
   * @private
   */
  private emitEvent(event: AgentEvent): void {
    this.globalEventStream.next(event);
    this.emit('event', event);
  }

  /**
   * Emits an event to a specific agent's stream
   * 
   * @private
   */
  private emitAgentEvent(agentId: string, event: AgentEvent): void {
    const agentStream = this.agentEventStreams.get(agentId);
    if (agentStream) {
      agentStream.next(event);
    }
    this.emitEvent(event); // Also emit to global stream
  }

  /**
   * Initializes cleanup routines for message retention and queue management
   * 
   * @private
   */
  private initializeCleanupRoutines(): void {
    // Clean up old messages every 5 minutes
    setInterval(() => {
      this.performMessageCleanup();
    }, 300000);

    // Update statistics every 30 seconds
    setInterval(() => {
      this.updateStatistics();
    }, 30000);
  }

  /**
   * Performs cleanup of old messages and inactive subscriptions
   * 
   * @private
   */
  private performMessageCleanup(): void {
    const now = Date.now();
    const retentionTime = this.config.messageRetentionTime;

    // Clean up message queues
    for (const [agentId, queue] of this.messageQueues.entries()) {
      const originalSize = queue.messages.length;
      
      queue.messages = queue.messages.filter(envelope => {
        // Keep pending and recent messages
        if (envelope.status === 'pending') {
          return true;
        }
        
        return (now - envelope.queuedAt) < retentionTime;
      });

      const cleanedCount = originalSize - queue.messages.length;
      if (cleanedCount > 0) {
        this.logger.info('Cleaned up old messages', { agentId, cleanedCount });
      }
    }

    // Clean up message history
    if (this.config.enablePersistence) {
      for (const [agentId, history] of this.messageHistory.entries()) {
        const originalSize = history.length;
        
        const filteredHistory = history.filter(message => 
          (now - message.timestamp) < retentionTime
        );
        
        this.messageHistory.set(agentId, filteredHistory);
        
        const cleanedCount = originalSize - filteredHistory.length;
        if (cleanedCount > 0) {
          this.logger.info('Cleaned up message history', { agentId, cleanedCount });
        }
      }
    }
  }

  /**
   * Updates hub statistics
   * 
   * @private
   */
  private updateStatistics(): void {
    this.statistics.activeSubscriptions = this.broadcastSubscriptions.size;
    this.statistics.lastUpdated = Date.now();
  }

  /**
   * Gets comprehensive hub statistics
   * 
   * @returns Current hub statistics
   */
  getStatistics(): typeof this.statistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Shuts down the communication hub and cleans up resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down AgentCommunicationHub');

    // Clear all intervals
    for (const interval of this.processingIntervals.values()) {
      clearInterval(interval);
    }
    this.processingIntervals.clear();

    // Complete all event streams
    for (const stream of this.agentEventStreams.values()) {
      stream.complete();
    }
    this.agentEventStreams.clear();
    this.globalEventStream.complete();

    // Clear all data structures
    this.messageQueues.clear();
    this.broadcastSubscriptions.clear();
    this.messageHistory.clear();

    this.logger.info('AgentCommunicationHub shutdown complete');
  }
}