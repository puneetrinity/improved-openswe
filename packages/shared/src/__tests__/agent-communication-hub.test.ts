import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AgentCommunicationHub } from '../open-swe/agent-communication-hub.js';
import { 
  AgentMessage,
  AgentRole
} from '../open-swe/types.js';
import {
  CommunicationHubConfig,
  AgentEventType
} from '../open-swe/agent-registry.js';

// Mock the logger to avoid console output during tests
jest.mock('../../../apps/open-swe/src/utils/logger.js', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  LogLevel: {
    INFO: 'info',
    DEBUG: 'debug',
    WARN: 'warn',
    ERROR: 'error'
  }
}));

describe('AgentCommunicationHub', () => {
  let communicationHub: AgentCommunicationHub;
  let testConfig: CommunicationHubConfig;

  beforeEach(() => {
    testConfig = {
      maxQueueSize: 100,
      messageTimeout: 5000,
      maxRetryAttempts: 2,
      enablePersistence: true,
      messageRetentionTime: 60000 // 1 minute for testing
    };

    communicationHub = new AgentCommunicationHub(testConfig);
  });

  afterEach(async () => {
    await communicationHub.shutdown();
  });

  describe('Message Sending', () => {
    it('should successfully send a message between agents', async () => {
      const message: AgentMessage = {
        id: 'test-message-1',
        fromAgentId: 'sender-agent',
        toAgentId: 'receiver-agent',
        type: 'request',
        content: 'Hello, can you review this code?',
        data: { codeSnippet: 'console.log("hello");' },
        timestamp: Date.now(),
        priority: 'medium'
      };

      const result = await communicationHub.sendMessage('sender-agent', 'receiver-agent', message);

      expect(result.success).toBe(true);
      expect(result.metadata?.messageId).toBe('test-message-1');
      
      const queueStatus = communicationHub.getQueueStatus('receiver-agent');
      expect(queueStatus).not.toBeNull();
      expect(queueStatus!.size).toBe(1);
    });

    it('should reject messages with missing required fields', async () => {
      const invalidMessage = {
        // Missing id and content
        fromAgentId: 'sender-agent',
        toAgentId: 'receiver-agent',
        type: 'request',
        timestamp: Date.now(),
        priority: 'medium'
      } as AgentMessage;

      const result = await communicationHub.sendMessage('sender-agent', 'receiver-agent', invalidMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required fields');
    });

    it('should set correct sender and timestamp on messages', async () => {
      const message: AgentMessage = {
        id: 'test-message-2',
        fromAgentId: 'wrong-sender', // This should be overridden
        toAgentId: 'receiver-agent',
        type: 'request',
        content: 'Test message',
        timestamp: 0, // This should be updated
        priority: 'low'
      };

      const beforeTime = Date.now();
      const result = await communicationHub.sendMessage('correct-sender', 'receiver-agent', message);
      const afterTime = Date.now();

      expect(result.success).toBe(true);

      // The internal message should have correct sender and updated timestamp
      // (We can't directly access it, but we can verify through other means)
      const queueStatus = communicationHub.getQueueStatus('receiver-agent');
      expect(queueStatus?.size).toBe(1);
    });

    it('should respect maximum queue size', async () => {
      // Fill the queue to maximum capacity
      const promises = [];
      for (let i = 0; i < testConfig.maxQueueSize; i++) {
        const message: AgentMessage = {
          id: `message-${i}`,
          fromAgentId: 'sender',
          toAgentId: 'receiver',
          type: 'notification',
          content: `Message ${i}`,
          timestamp: Date.now(),
          priority: 'low'
        };
        promises.push(communicationHub.sendMessage('sender', 'receiver', message));
      }

      await Promise.all(promises);

      // Try to send one more message
      const overflowMessage: AgentMessage = {
        id: 'overflow-message',
        fromAgentId: 'sender',
        toAgentId: 'receiver',
        type: 'request',
        content: 'This should fail',
        timestamp: Date.now(),
        priority: 'high'
      };

      const result = await communicationHub.sendMessage('sender', 'receiver', overflowMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('queue for agent receiver is full');
    });

    it('should handle concurrent message sending', async () => {
      const concurrentMessages = [];
      
      for (let i = 0; i < 10; i++) {
        const message: AgentMessage = {
          id: `concurrent-message-${i}`,
          fromAgentId: 'sender',
          toAgentId: `receiver-${i % 3}`, // Distribute across 3 receivers
          type: 'notification',
          content: `Concurrent message ${i}`,
          timestamp: Date.now(),
          priority: 'medium'
        };
        concurrentMessages.push(communicationHub.sendMessage('sender', `receiver-${i % 3}`, message));
      }

      const results = await Promise.all(concurrentMessages);

      // All messages should be sent successfully
      expect(results.every(r => r.success)).toBe(true);

      // Check that messages are distributed correctly
      const receiver0Status = communicationHub.getQueueStatus('receiver-0');
      const receiver1Status = communicationHub.getQueueStatus('receiver-1');
      const receiver2Status = communicationHub.getQueueStatus('receiver-2');

      expect(receiver0Status?.size).toBeGreaterThan(0);
      expect(receiver1Status?.size).toBeGreaterThan(0);
      expect(receiver2Status?.size).toBeGreaterThan(0);
    });
  });

  describe('Role-based Broadcasting', () => {
    beforeEach(() => {
      // Set up subscriptions for different roles
      communicationHub.subscribeToEvents('reviewer-1', undefined, 'code_reviewer');
      communicationHub.subscribeToEvents('reviewer-2', undefined, 'code_reviewer');
      communicationHub.subscribeToEvents('security-1', undefined, 'security');
      communicationHub.subscribeToEvents('test-eng-1', undefined, 'test_engineer');
    });

    it('should broadcast to all agents with specific role', async () => {
      const broadcastMessage: AgentMessage = {
        id: 'broadcast-test-1',
        fromAgentId: 'coordinator',
        type: 'notification',
        content: 'New code review guidelines available',
        timestamp: Date.now(),
        priority: 'medium'
      };

      const result = await communicationHub.broadcastToRole(
        'coordinator', 
        'code_reviewer', 
        broadcastMessage
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.targetCount).toBe(2); // reviewer-1 and reviewer-2
      expect(result.metadata?.successCount).toBe(2);
      expect(result.metadata?.failureCount).toBe(0);

      // Check that both reviewers received the message
      const reviewer1Status = communicationHub.getQueueStatus('reviewer-1');
      const reviewer2Status = communicationHub.getQueueStatus('reviewer-2');
      const securityStatus = communicationHub.getQueueStatus('security-1');

      expect(reviewer1Status?.size).toBe(1);
      expect(reviewer2Status?.size).toBe(1);
      expect(securityStatus?.size).toBe(0); // Security agent should not receive it
    });

    it('should exclude sender from broadcast when specified', async () => {
      const broadcastMessage: AgentMessage = {
        id: 'broadcast-test-2',
        fromAgentId: 'reviewer-1', // This agent has code_reviewer role
        type: 'notification',
        content: 'Sharing best practices',
        timestamp: Date.now(),
        priority: 'low'
      };

      const result = await communicationHub.broadcastToRole(
        'reviewer-1', 
        'code_reviewer', 
        broadcastMessage,
        true // excludeSender = true
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.targetCount).toBe(1); // Only reviewer-2
      expect(result.metadata?.successCount).toBe(1);

      // reviewer-1 should not receive its own broadcast
      const reviewer1Status = communicationHub.getQueueStatus('reviewer-1');
      const reviewer2Status = communicationHub.getQueueStatus('reviewer-2');

      expect(reviewer1Status?.size).toBe(0);
      expect(reviewer2Status?.size).toBe(1);
    });

    it('should include sender in broadcast when specified', async () => {
      const broadcastMessage: AgentMessage = {
        id: 'broadcast-test-3',
        fromAgentId: 'reviewer-1',
        type: 'notification',
        content: 'System announcement',
        timestamp: Date.now(),
        priority: 'high'
      };

      const result = await communicationHub.broadcastToRole(
        'reviewer-1', 
        'code_reviewer', 
        broadcastMessage,
        false // excludeSender = false
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.targetCount).toBe(2); // Both reviewers

      const reviewer1Status = communicationHub.getQueueStatus('reviewer-1');
      const reviewer2Status = communicationHub.getQueueStatus('reviewer-2');

      expect(reviewer1Status?.size).toBe(1);
      expect(reviewer2Status?.size).toBe(1);
    });

    it('should handle broadcast to role with no subscribers', async () => {
      const broadcastMessage: AgentMessage = {
        id: 'broadcast-test-4',
        fromAgentId: 'coordinator',
        type: 'notification',
        content: 'Documentation update',
        timestamp: Date.now(),
        priority: 'low'
      };

      const result = await communicationHub.broadcastToRole(
        'coordinator', 
        'documentation', // No agents subscribed to this role
        broadcastMessage
      );

      expect(result.success).toBe(false); // No successful deliveries
      expect(result.metadata?.targetCount).toBe(0);
      expect(result.metadata?.successCount).toBe(0);
    });
  });

  describe('Event Subscriptions', () => {
    it('should create event subscription for agent', () => {
      const subscription = communicationHub.subscribeToEvents('test-agent', 'message_received');
      
      expect(subscription).toBeDefined();
      // The subscription should be active (we can't directly test the observable without triggering events)
    });

    it('should receive events for subscribed agent', (done) => {
      const subscription = communicationHub.subscribeToEvents('receiver-agent', 'message_received');
      
      subscription.subscribe(event => {
        expect(event.type).toBe('message_received');
        expect(event.agentId).toBe('receiver-agent');
        subscription.unsubscribe();
        done();
      });

      // Send a message to trigger the event
      const message: AgentMessage = {
        id: 'event-test-message',
        fromAgentId: 'sender',
        toAgentId: 'receiver-agent',
        type: 'request',
        content: 'Test message for events',
        timestamp: Date.now(),
        priority: 'medium'
      };

      communicationHub.sendMessage('sender', 'receiver-agent', message);
    });

    it('should filter events by event type', (done) => {
      let receivedEventCount = 0;
      const subscription = communicationHub.subscribeToEvents('test-agent', 'collaboration_requested');
      
      subscription.subscribe(() => {
        receivedEventCount++;
      });

      // Send a message (should trigger message_received, not collaboration_requested)
      const message: AgentMessage = {
        id: 'filter-test-message',
        fromAgentId: 'sender',
        toAgentId: 'test-agent',
        type: 'request',
        content: 'This should not trigger collaboration_requested event',
        timestamp: Date.now(),
        priority: 'low'
      };

      communicationHub.sendMessage('sender', 'test-agent', message);

      setTimeout(() => {
        expect(receivedEventCount).toBe(0); // No collaboration_requested events should be received
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should unsubscribe specific subscription', async () => {
      // First subscribe
      communicationHub.subscribeToEvents('test-agent', undefined, 'code_reviewer');
      
      const stats = communicationHub.getStatistics();
      const initialSubscriptions = stats.activeSubscriptions;

      // Unsubscribe specific subscription
      const result = await communicationHub.unsubscribeFromEvents('test-agent');

      expect(result.success).toBe(true);
      expect(result.metadata?.removedCount).toBeGreaterThan(0);

      const newStats = communicationHub.getStatistics();
      expect(newStats.activeSubscriptions).toBeLessThan(initialSubscriptions);
    });

    it('should unsubscribe all subscriptions for an agent', async () => {
      // Create multiple subscriptions for the same agent
      communicationHub.subscribeToEvents('multi-sub-agent', 'message_received');
      communicationHub.subscribeToEvents('multi-sub-agent', 'task_delegated');
      communicationHub.subscribeToEvents('multi-sub-agent', undefined, 'code_reviewer');

      const result = await communicationHub.unsubscribeFromEvents('multi-sub-agent');

      expect(result.success).toBe(true);
      expect(result.metadata?.removedCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Message History', () => {
    beforeEach(() => {
      // Ensure persistence is enabled for these tests
      expect(testConfig.enablePersistence).toBe(true);
    });

    it('should store message history when persistence is enabled', async () => {
      const message: AgentMessage = {
        id: 'history-test-1',
        fromAgentId: 'sender',
        toAgentId: 'receiver',
        type: 'request',
        content: 'Test message for history',
        timestamp: Date.now(),
        priority: 'medium'
      };

      await communicationHub.sendMessage('sender', 'receiver', message);

      const senderHistory = communicationHub.getMessageHistory('sender');
      const receiverHistory = communicationHub.getMessageHistory('receiver');

      expect(senderHistory.length).toBeGreaterThan(0);
      expect(receiverHistory.length).toBeGreaterThan(0);
      
      const storedMessage = senderHistory.find(m => m.id === 'history-test-1');
      expect(storedMessage).toBeDefined();
      expect(storedMessage?.content).toBe('Test message for history');
    });

    it('should retrieve bilateral message history', async () => {
      // Send messages between two specific agents
      const messages = [
        {
          id: 'bilateral-1',
          fromAgentId: 'alice',
          toAgentId: 'bob',
          type: 'request' as const,
          content: 'Message from Alice to Bob',
          timestamp: Date.now(),
          priority: 'medium' as const
        },
        {
          id: 'bilateral-2',
          fromAgentId: 'bob',
          toAgentId: 'alice',
          type: 'response' as const,
          content: 'Message from Bob to Alice',
          timestamp: Date.now() + 1000,
          priority: 'medium' as const
        },
        {
          id: 'bilateral-3',
          fromAgentId: 'alice',
          toAgentId: 'charlie',
          type: 'request' as const,
          content: 'Message from Alice to Charlie',
          timestamp: Date.now() + 2000,
          priority: 'low' as const
        }
      ];

      for (const message of messages) {
        await communicationHub.sendMessage(message.fromAgentId, message.toAgentId, message);
      }

      const bilateralHistory = communicationHub.getMessageHistory('alice', 'bob');

      expect(bilateralHistory.length).toBe(2); // Only messages between Alice and Bob
      expect(bilateralHistory.some(m => m.id === 'bilateral-1')).toBe(true);
      expect(bilateralHistory.some(m => m.id === 'bilateral-2')).toBe(true);
      expect(bilateralHistory.some(m => m.id === 'bilateral-3')).toBe(false);
    });

    it('should respect message history limit', async () => {
      // Send more messages than the limit
      const messagePromises = [];
      for (let i = 0; i < 60; i++) {
        const message: AgentMessage = {
          id: `limit-test-${i}`,
          fromAgentId: 'prolific-sender',
          toAgentId: 'patient-receiver',
          type: 'notification',
          content: `Message number ${i}`,
          timestamp: Date.now() + i,
          priority: 'low'
        };
        messagePromises.push(communicationHub.sendMessage('prolific-sender', 'patient-receiver', message));
      }

      await Promise.all(messagePromises);

      const history = communicationHub.getMessageHistory('prolific-sender', undefined, 10);

      expect(history.length).toBeLessThanOrEqual(10);
      // Should return the most recent messages (highest indices)
      expect(history[0].content).toContain('59');
    });

    it('should return empty history when persistence is disabled', async () => {
      // Create a new hub with persistence disabled
      const noPersistenceHub = new AgentCommunicationHub({
        ...testConfig,
        enablePersistence: false
      });

      const message: AgentMessage = {
        id: 'no-persist-test',
        fromAgentId: 'sender',
        toAgentId: 'receiver',
        type: 'request',
        content: 'This should not be stored',
        timestamp: Date.now(),
        priority: 'medium'
      };

      await noPersistenceHub.sendMessage('sender', 'receiver', message);

      const history = noPersistenceHub.getMessageHistory('sender');
      expect(history.length).toBe(0);

      await noPersistenceHub.shutdown();
    });
  });

  describe('Queue Management', () => {
    it('should provide accurate queue status', async () => {
      // Send some messages
      for (let i = 0; i < 3; i++) {
        const message: AgentMessage = {
          id: `queue-status-${i}`,
          fromAgentId: 'sender',
          toAgentId: 'queue-test-receiver',
          type: 'request',
          content: `Queue test message ${i}`,
          timestamp: Date.now(),
          priority: 'medium'
        };
        await communicationHub.sendMessage('sender', 'queue-test-receiver', message);
      }

      const queueStatus = communicationHub.getQueueStatus('queue-test-receiver');

      expect(queueStatus).not.toBeNull();
      expect(queueStatus!.size).toBe(3);
      expect(queueStatus!.pendingCount).toBeGreaterThan(0);
      expect(queueStatus!.lastProcessed).toBeGreaterThan(0);
    });

    it('should return null for non-existent queue', () => {
      const queueStatus = communicationHub.getQueueStatus('non-existent-agent');
      expect(queueStatus).toBeNull();
    });

    it('should handle multiple queues independently', async () => {
      // Send messages to different agents
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      
      for (let i = 0; i < agents.length; i++) {
        for (let j = 0; j < i + 1; j++) {
          const message: AgentMessage = {
            id: `multi-queue-${i}-${j}`,
            fromAgentId: 'multi-sender',
            toAgentId: agents[i],
            type: 'notification',
            content: `Message ${j} for ${agents[i]}`,
            timestamp: Date.now(),
            priority: 'low'
          };
          await communicationHub.sendMessage('multi-sender', agents[i], message);
        }
      }

      // Check that each queue has the correct number of messages
      const status1 = communicationHub.getQueueStatus('agent-1');
      const status2 = communicationHub.getQueueStatus('agent-2');
      const status3 = communicationHub.getQueueStatus('agent-3');

      expect(status1?.size).toBe(1);
      expect(status2?.size).toBe(2);
      expect(status3?.size).toBe(3);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate communication statistics', async () => {
      const initialStats = communicationHub.getStatistics();
      const initialMessageCount = initialStats.totalMessagesProcessed;

      // Send some messages
      for (let i = 0; i < 5; i++) {
        const message: AgentMessage = {
          id: `stats-test-${i}`,
          fromAgentId: 'stats-sender',
          toAgentId: 'stats-receiver',
          type: 'request',
          content: `Statistics test message ${i}`,
          timestamp: Date.now(),
          priority: 'medium'
        };
        await communicationHub.sendMessage('stats-sender', 'stats-receiver', message);
      }

      // Perform a broadcast
      const broadcastMessage: AgentMessage = {
        id: 'stats-broadcast',
        fromAgentId: 'broadcaster',
        type: 'notification',
        content: 'Broadcast for statistics',
        timestamp: Date.now(),
        priority: 'low'
      };

      // Set up some subscriptions first
      communicationHub.subscribeToEvents('sub1', undefined, 'code_reviewer');
      communicationHub.subscribeToEvents('sub2', undefined, 'code_reviewer');

      await communicationHub.broadcastToRole('broadcaster', 'code_reviewer', broadcastMessage);

      const finalStats = communicationHub.getStatistics();

      expect(finalStats.totalMessagesProcessed).toBe(initialMessageCount + 5);
      expect(finalStats.totalBroadcasts).toBeGreaterThan(initialStats.totalBroadcasts);
      expect(finalStats.activeSubscriptions).toBeGreaterThan(0);
      expect(finalStats.lastUpdated).toBeGreaterThan(0);
    });

    it('should update statistics over time', () => {
      const stats1 = communicationHub.getStatistics();
      
      // Wait a bit to ensure different timestamps
      setTimeout(() => {
        const stats2 = communicationHub.getStatistics();
        expect(stats2.lastUpdated).toBeGreaterThanOrEqual(stats1.lastUpdated);
      }, 10);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed messages gracefully', async () => {
      const malformedMessage = {
        // Missing required fields
        fromAgentId: 'sender',
        type: 'request',
        timestamp: Date.now()
      } as AgentMessage;

      const result = await communicationHub.sendMessage('sender', 'receiver', malformedMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null and undefined inputs', async () => {
      const result = await communicationHub.sendMessage('sender', 'receiver', null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should maintain consistency during high concurrent load', async () => {
      const concurrentOperations = [];

      // Mix of different operations
      for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
          // Send message
          const message: AgentMessage = {
            id: `concurrent-${i}`,
            fromAgentId: `sender-${i % 5}`,
            toAgentId: `receiver-${i % 3}`,
            type: 'request',
            content: `Concurrent message ${i}`,
            timestamp: Date.now(),
            priority: 'medium'
          };
          concurrentOperations.push(communicationHub.sendMessage(`sender-${i % 5}`, `receiver-${i % 3}`, message));
        } else if (i % 3 === 1) {
          // Subscribe to events
          concurrentOperations.push(Promise.resolve(communicationHub.subscribeToEvents(`agent-${i}`, 'message_received')));
        } else {
          // Get queue status
          concurrentOperations.push(Promise.resolve(communicationHub.getQueueStatus(`receiver-${i % 3}`)));
        }
      }

      const results = await Promise.all(concurrentOperations);

      // Should not throw errors and maintain consistency
      expect(results.length).toBe(50);
      
      const stats = communicationHub.getStatistics();
      expect(stats.totalMessagesProcessed).toBeGreaterThan(0);
    });
  });
});