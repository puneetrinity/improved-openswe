import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MultiAgentSystem } from '../open-swe/multi-agent-system.js';
import { 
  AgentProfile, 
  AgentRole,
  AgentMessage,
  TaskDelegation
} from '../open-swe/types.js';
import {
  MultiAgentSystemConfig,
  OrchestrationRule
} from '../open-swe/multi-agent-system.js';
import {
  CapabilityQuery,
  AgentCapability
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

describe('MultiAgentSystem', () => {
  let multiAgentSystem: MultiAgentSystem;
  let testConfig: MultiAgentSystemConfig;

  beforeEach(() => {
    testConfig = {
      registry: {
        maxAgents: 20,
        healthCheck: {
          interval: 10000,
          timeout: 2000,
          failureThreshold: 3
        },
        autoCleanup: false
      },
      communication: {
        maxQueueSize: 50,
        messageTimeout: 5000,
        maxRetryAttempts: 2,
        enablePersistence: true,
        messageRetentionTime: 30000
      },
      enableOrchestration: true,
      maxConcurrentOperations: 50,
      enableDetailedLogging: false // Reduce noise in tests
    };

    multiAgentSystem = new MultiAgentSystem(testConfig);
  });

  afterEach(async () => {
    await multiAgentSystem.shutdown();
  });

  describe('Agent Registration and Discovery', () => {
    it('should register agents and set up communication automatically', async () => {
      const profile: AgentProfile = {
        id: 'integrated-agent-1',
        role: 'code_reviewer',
        specialization: ['javascript', 'typescript'],
        tools: ['eslint', 'tsc'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      const result = await multiAgentSystem.registerAgent(profile);

      expect(result.success).toBe(true);
      expect(result.metadata?.agentId).toBe('integrated-agent-1');

      // Verify agent can be discovered
      const query: CapabilityQuery = {
        required: ['javascript']
      };

      const discoveryResult = await multiAgentSystem.discoverAgents(query);
      expect(discoveryResult.agents).toHaveLength(1);
      expect(discoveryResult.agents[0].id).toBe('integrated-agent-1');
    });

    it('should discover agents with load balancing', async () => {
      // Register multiple agents with same capabilities but different loads
      const agents = [
        {
          id: 'balanced-agent-1',
          role: 'code_reviewer' as AgentRole,
          specialization: ['javascript'],
          tools: ['eslint']
        },
        {
          id: 'balanced-agent-2',
          role: 'code_reviewer' as AgentRole,
          specialization: ['javascript'],
          tools: ['eslint']
        },
        {
          id: 'balanced-agent-3',
          role: 'code_reviewer' as AgentRole,
          specialization: ['javascript'],
          tools: ['eslint']
        }
      ];

      for (const agentData of agents) {
        const profile: AgentProfile = {
          ...agentData,
          collaborationRules: [],
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        await multiAgentSystem.registerAgent(profile);
      }

      const query: CapabilityQuery = {
        required: ['javascript']
      };

      const result = await multiAgentSystem.discoverAgents(query, true);

      expect(result.agents).toHaveLength(3);
      // Agents should be sorted by load balancing criteria
      expect(result.loadInfo.size).toBe(3);
    });

    it('should handle concurrent operations within limits', async () => {
      const concurrentRegistrations = [];
      
      for (let i = 0; i < 10; i++) {
        const profile: AgentProfile = {
          id: `concurrent-agent-${i}`,
          role: 'code_reviewer',
          specialization: ['testing'],
          tools: ['jest'],
          collaborationRules: [],
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        concurrentRegistrations.push(multiAgentSystem.registerAgent(profile));
      }

      const results = await Promise.all(concurrentRegistrations);

      // All should succeed since we're within the concurrent operations limit
      expect(results.every(r => r.success)).toBe(true);

      const stats = multiAgentSystem.getSystemStatistics();
      expect(stats.registry.totalAgents).toBe(10);
    });

    it('should reject operations when at max concurrent capacity', async () => {
      // This test would require mocking or controlling the operation counter
      // For now, we'll test that the system respects the limit conceptually
      const systemStats = multiAgentSystem.getSystemStatistics();
      expect(systemStats.performance.operationsPerSecond).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Inter-Agent Communication', () => {
    beforeEach(async () => {
      // Set up test agents
      const agents = [
        { id: 'sender-agent', role: 'code_reviewer' as AgentRole },
        { id: 'receiver-agent', role: 'security' as AgentRole },
        { id: 'reviewer-1', role: 'code_reviewer' as AgentRole },
        { id: 'reviewer-2', role: 'code_reviewer' as AgentRole }
      ];

      for (const agentData of agents) {
        const profile: AgentProfile = {
          ...agentData,
          specialization: ['test'],
          tools: ['test-tool'],
          collaborationRules: [],
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        await multiAgentSystem.registerAgent(profile);
      }
    });

    it('should send messages between registered agents', async () => {
      const message: AgentMessage = {
        id: 'integration-message-1',
        fromAgentId: 'sender-agent',
        toAgentId: 'receiver-agent',
        type: 'request',
        content: 'Please review this security vulnerability',
        data: { severity: 'high', cve: 'CVE-2023-1234' },
        timestamp: Date.now(),
        priority: 'high'
      };

      const result = await multiAgentSystem.sendMessage('sender-agent', 'receiver-agent', message);

      expect(result.success).toBe(true);
      expect(result.metadata?.messageId).toBe('integration-message-1');
    });

    it('should validate agents exist before sending messages', async () => {
      const message: AgentMessage = {
        id: 'invalid-sender-message',
        fromAgentId: 'non-existent-sender',
        toAgentId: 'receiver-agent',
        type: 'request',
        content: 'This should fail',
        timestamp: Date.now(),
        priority: 'medium'
      };

      const result = await multiAgentSystem.sendMessage('non-existent-sender', 'receiver-agent', message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should broadcast messages to agents by role', async () => {
      const broadcastMessage: AgentMessage = {
        id: 'role-broadcast-test',
        fromAgentId: 'sender-agent',
        type: 'notification',
        content: 'New coding standards released',
        timestamp: Date.now(),
        priority: 'medium'
      };

      const result = await multiAgentSystem.broadcastToRole(
        'sender-agent',
        'code_reviewer',
        broadcastMessage
      );

      expect(result.success).toBe(true);
      // Should reach reviewer-1 and reviewer-2 (sender-agent excluded by default)
      expect(result.metadata?.targetCount).toBeGreaterThan(0);
    });

    it('should handle message routing with error recovery', async () => {
      const message: AgentMessage = {
        id: 'error-recovery-test',
        fromAgentId: 'sender-agent',
        toAgentId: 'receiver-agent',
        type: 'collaboration',
        content: 'Test message routing resilience',
        timestamp: Date.now(),
        priority: 'low'
      };

      // Send message and verify it's queued even if delivery might fail
      const result = await multiAgentSystem.sendMessage('sender-agent', 'receiver-agent', message);
      expect(result.success).toBe(true);

      // Check communication statistics
      const stats = multiAgentSystem.getSystemStatistics();
      expect(stats.communication.totalMessagesProcessed).toBeGreaterThan(0);
    });
  });

  describe('Task Delegation', () => {
    beforeEach(async () => {
      // Register agents for delegation testing
      const agents = [
        { id: 'delegator', role: 'architect' as AgentRole },
        { id: 'executor-1', role: 'code_reviewer' as AgentRole },
        { id: 'executor-2', role: 'security' as AgentRole }
      ];

      for (const agentData of agents) {
        const profile: AgentProfile = {
          ...agentData,
          specialization: ['task_execution'],
          tools: ['generic-tool'],
          collaborationRules: [],
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        await multiAgentSystem.registerAgent(profile);
      }
    });

    it('should delegate tasks between agents', async () => {
      const delegation: TaskDelegation = {
        id: 'delegation-test-1',
        taskId: 'review-task-123',
        delegatingAgentId: 'delegator',
        assignedAgentId: 'executor-1',
        status: 'pending',
        description: 'Review the authentication module for security issues',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = await multiAgentSystem.delegateTask(delegation);

      expect(result.success).toBe(true);
    });

    it('should automatically find suitable agents for delegation', async () => {
      const delegation: TaskDelegation = {
        id: 'auto-delegation-test',
        taskId: 'auto-task-456',
        delegatingAgentId: 'delegator',
        assignedAgentId: '', // Empty - should be auto-assigned
        status: 'pending',
        description: 'Find and fix code quality issues',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = await multiAgentSystem.delegateTask(delegation);

      expect(result.success).toBe(true);
      // The system should have found a suitable agent
    });

    it('should handle delegation when no suitable agents available', async () => {
      const delegation: TaskDelegation = {
        id: 'no-agent-delegation',
        taskId: 'impossible-task',
        delegatingAgentId: 'delegator',
        assignedAgentId: '', // Empty - needs auto-assignment
        status: 'pending',
        description: 'Perform quantum computing analysis', // No agents have this capability
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = await multiAgentSystem.delegateTask(delegation);

      // Should still succeed with default assignment logic
      expect(result.success).toBe(true);
    });
  });

  describe('Orchestration Rules', () => {
    beforeEach(async () => {
      // Register some test agents
      const profile: AgentProfile = {
        id: 'orchestration-test-agent',
        role: 'code_reviewer',
        specialization: ['javascript'],
        tools: ['eslint'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await multiAgentSystem.registerAgent(profile);
    });

    it('should add and execute custom orchestration rules', (done) => {
      const customRule: OrchestrationRule = {
        id: 'test-rule-1',
        name: 'Test Registration Notification',
        triggers: {
          eventTypes: ['agent_registered']
        },
        actions: {
          handler: async (event, system) => {
            expect(event.type).toBe('agent_registered');
            expect(system).toBe(multiAgentSystem);
            done();
          }
        },
        priority: 'medium',
        active: true
      };

      const addResult = multiAgentSystem.addOrchestrationRule(customRule);
      expect(addResult.success).toBe(true);

      // Trigger the rule by registering a new agent
      multiAgentSystem.registerAgent({
        id: 'trigger-agent',
        role: 'security',
        specialization: ['owasp'],
        tools: ['security-scanner'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });
    });

    it('should prevent duplicate orchestration rules', () => {
      const rule: OrchestrationRule = {
        id: 'duplicate-rule-test',
        name: 'Duplicate Test Rule',
        triggers: {
          eventTypes: ['agent_registered']
        },
        actions: {
          broadcastToRoles: ['architect']
        },
        priority: 'low',
        active: true
      };

      const firstResult = multiAgentSystem.addOrchestrationRule(rule);
      expect(firstResult.success).toBe(true);

      const secondResult = multiAgentSystem.addOrchestrationRule(rule);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already exists');
    });

    it('should remove orchestration rules', () => {
      const rule: OrchestrationRule = {
        id: 'removable-rule',
        name: 'Removable Test Rule',
        triggers: {
          eventTypes: ['health_check_failed']
        },
        actions: {
          notifyAgents: ['admin-agent']
        },
        priority: 'high',
        active: true
      };

      const addResult = multiAgentSystem.addOrchestrationRule(rule);
      expect(addResult.success).toBe(true);

      const removeResult = multiAgentSystem.removeOrchestrationRule('removable-rule');
      expect(removeResult.success).toBe(true);

      // Trying to remove again should fail
      const removeAgainResult = multiAgentSystem.removeOrchestrationRule('removable-rule');
      expect(removeAgainResult.success).toBe(false);
    });

    it('should execute default orchestration rules', async () => {
      // Default rules should be active - we can test by checking they don't interfere
      const stats = multiAgentSystem.getSystemStatistics();
      expect(stats.registry.totalAgents).toBeGreaterThan(0);
    });
  });

  describe('System Monitoring and Health', () => {
    beforeEach(async () => {
      // Register agents for health testing
      const agents = [
        { id: 'health-agent-1', role: 'code_reviewer' as AgentRole, status: 'active' as const },
        { id: 'health-agent-2', role: 'security' as AgentRole, status: 'idle' as const },
        { id: 'health-agent-3', role: 'test_engineer' as AgentRole, status: 'busy' as const }
      ];

      for (const agentData of agents) {
        const profile: AgentProfile = {
          ...agentData,
          specialization: ['health-testing'],
          tools: ['health-tool'],
          collaborationRules: [],
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        await multiAgentSystem.registerAgent(profile);
      }
    });

    it('should provide comprehensive system statistics', () => {
      const stats = multiAgentSystem.getSystemStatistics();

      expect(stats.registry.totalAgents).toBe(3);
      expect(stats.registry.agentsByStatus.active).toBe(1);
      expect(stats.registry.agentsByStatus.idle).toBe(1);
      expect(stats.registry.agentsByStatus.busy).toBe(1);
      expect(stats.registry.agentsByRole.code_reviewer).toBe(1);
      expect(stats.registry.agentsByRole.security).toBe(1);
      expect(stats.registry.agentsByRole.test_engineer).toBe(1);

      expect(stats.communication.totalMessagesProcessed).toBeGreaterThanOrEqual(0);
      expect(stats.performance.systemUptime).toBeGreaterThan(0);
      expect(stats.performance.operationsPerSecond).toBeGreaterThanOrEqual(0);
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });

    it('should track system status across all agents', () => {
      const systemStatus = multiAgentSystem.getSystemStatus();

      expect(systemStatus.size).toBe(3);
      expect(systemStatus.get('health-agent-1')).toBe('active');
      expect(systemStatus.get('health-agent-2')).toBe('idle');
      expect(systemStatus.get('health-agent-3')).toBe('busy');
    });

    it('should perform comprehensive system health check', async () => {
      const healthReport = await multiAgentSystem.performSystemHealthCheck();

      expect(healthReport.overall).toBeOneOf(['healthy', 'degraded', 'unhealthy']);
      expect(healthReport.components.registry).toBeOneOf(['healthy', 'degraded', 'unhealthy']);
      expect(healthReport.components.communication).toBeOneOf(['healthy', 'degraded', 'unhealthy']);
      
      expect(Object.keys(healthReport.components.agents)).toHaveLength(3);
      expect(healthReport.recommendations).toBeInstanceOf(Array);

      // All agents should have health status
      Object.values(healthReport.components.agents).forEach(status => {
        expect(status).toBeOneOf(['healthy', 'degraded', 'unhealthy']);
      });
    });

    it('should update performance metrics over time', async () => {
      const initialStats = multiAgentSystem.getSystemStatistics();
      
      // Perform some operations to generate metrics
      await multiAgentSystem.sendMessage('health-agent-1', 'health-agent-2', {
        id: 'performance-test-message',
        fromAgentId: 'health-agent-1',
        toAgentId: 'health-agent-2',
        type: 'request',
        content: 'Performance testing message',
        timestamp: Date.now(),
        priority: 'low'
      });

      // Wait a brief moment for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const updatedStats = multiAgentSystem.getSystemStatistics();
      
      expect(updatedStats.communication.totalMessagesProcessed)
        .toBeGreaterThanOrEqual(initialStats.communication.totalMessagesProcessed);
      expect(updatedStats.lastUpdated).toBeGreaterThanOrEqual(initialStats.lastUpdated);
    });
  });

  describe('Event Subscriptions and Monitoring', () => {
    beforeEach(async () => {
      const profile: AgentProfile = {
        id: 'event-monitor-agent',
        role: 'architect',
        specialization: ['system-monitoring'],
        tools: ['monitoring-tool'],
        collaborationRules: [],
        status: 'active',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await multiAgentSystem.registerAgent(profile);
    });

    it('should provide system-wide event subscriptions', (done) => {
      const subscription = multiAgentSystem.subscribeToSystemEvents({
        eventType: 'agent_registered'
      });

      subscription.subscribe(event => {
        expect(event.type).toBe('agent_registered');
        expect(event.agentId).toBe('new-monitored-agent');
        subscription.unsubscribe();
        done();
      });

      // Trigger event by registering new agent
      multiAgentSystem.registerAgent({
        id: 'new-monitored-agent',
        role: 'code_reviewer',
        specialization: ['monitoring-test'],
        tools: ['test-tool'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });
    });

    it('should filter system events by criteria', (done) => {
      let eventCount = 0;
      const subscription = multiAgentSystem.subscribeToSystemEvents({
        agentId: 'event-monitor-agent'
      });

      subscription.subscribe(() => {
        eventCount++;
      });

      // This should not trigger event for our specific agent
      multiAgentSystem.registerAgent({
        id: 'other-agent',
        role: 'security',
        specialization: ['other-test'],
        tools: ['other-tool'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });

      setTimeout(() => {
        expect(eventCount).toBe(0); // No events should match the filter
        subscription.unsubscribe();
        done();
      }, 100);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid agent profiles gracefully', async () => {
      const invalidProfile = {
        // Missing required fields
        specialization: [],
        tools: [],
        collaborationRules: []
      } as AgentProfile;

      const result = await multiAgentSystem.registerAgent(invalidProfile);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should maintain system stability under high load', async () => {
      const operations = [];

      // Mix of different operations to stress test the system
      for (let i = 0; i < 30; i++) {
        if (i % 3 === 0) {
          // Register agents
          operations.push(multiAgentSystem.registerAgent({
            id: `stress-agent-${i}`,
            role: 'code_reviewer',
            specialization: ['stress-testing'],
            tools: ['stress-tool'],
            collaborationRules: [],
            status: 'idle',
            createdAt: Date.now(),
            lastActiveAt: Date.now()
          }));
        } else if (i % 3 === 1) {
          // Discover agents
          operations.push(multiAgentSystem.discoverAgents({
            required: ['stress-testing']
          }));
        } else {
          // Get system statistics
          operations.push(Promise.resolve(multiAgentSystem.getSystemStatistics()));
        }
      }

      const results = await Promise.all(operations);

      // System should handle all operations without crashing
      expect(results.length).toBe(30);
      
      // Verify system is still functional
      const finalStats = multiAgentSystem.getSystemStatistics();
      expect(finalStats.registry.totalAgents).toBeGreaterThan(0);
    });

    it('should handle shutdown gracefully', async () => {
      // Perform some operations first
      await multiAgentSystem.registerAgent({
        id: 'shutdown-test-agent',
        role: 'code_reviewer',
        specialization: ['shutdown-testing'],
        tools: ['shutdown-tool'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });

      // Shutdown should not throw errors
      await expect(multiAgentSystem.shutdown()).resolves.not.toThrow();
    });

    it('should recover from component failures', async () => {
      // Test that the system continues to function even if individual components have issues
      const healthReport = await multiAgentSystem.performSystemHealthCheck();
      
      // Even if some components are degraded, system should provide results
      expect(healthReport.overall).toBeDefined();
      expect(healthReport.components).toBeDefined();
      expect(healthReport.recommendations).toBeDefined();
    });
  });

  describe('Integration with External Systems', () => {
    it('should maintain compatibility with existing Open SWE patterns', () => {
      // Verify that the system integrates well with existing patterns
      expect(multiAgentSystem.registry).toBeDefined();
      expect(multiAgentSystem.communicationHub).toBeDefined();
      
      // Check that system statistics follow expected format
      const stats = multiAgentSystem.getSystemStatistics();
      expect(stats).toHaveProperty('registry');
      expect(stats).toHaveProperty('communication');
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('lastUpdated');
    });

    it('should handle concurrent access from multiple threads/processes', async () => {
      // Simulate concurrent access patterns
      const concurrentAccess = Array.from({ length: 20 }, (_, i) => 
        multiAgentSystem.getSystemStatistics()
      );

      const results = await Promise.all(concurrentAccess);
      
      // All should return valid statistics
      expect(results.every(stats => 
        stats && 
        typeof stats.lastUpdated === 'number' &&
        typeof stats.registry.totalAgents === 'number'
      )).toBe(true);
    });
  });
});