import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AgentRegistry } from '../open-swe/agent-registry-impl.js';
import { 
  AgentProfile, 
  AgentRole,
  AgentMetrics
} from '../open-swe/types.js';
import {
  AgentRegistryConfig,
  CapabilityQuery,
  AgentCapability,
  AgentStatus
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

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let testConfig: AgentRegistryConfig;

  beforeEach(() => {
    testConfig = {
      maxAgents: 10,
      healthCheck: {
        interval: 5000,
        timeout: 1000,
        failureThreshold: 2
      },
      performance: {
        maxResponseTime: 2000,
        minSuccessRate: 0.9,
        maxLoad: 0.75,
        healthCheckInterval: 5000
      },
      autoCleanup: false, // Disable for testing
      offlineTimeout: 60000
    };

    registry = new AgentRegistry(testConfig);
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('Agent Registration', () => {
    it('should successfully register a valid agent', async () => {
      const profile: AgentProfile = {
        id: 'test-agent-1',
        role: 'code_reviewer',
        specialization: ['javascript', 'typescript'],
        tools: ['eslint', 'prettier'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      const result = await registry.registerAgent(profile);

      expect(result.success).toBe(true);
      expect(result.metadata?.agentId).toBe('test-agent-1');
      
      const agentDetails = registry.getAgentDetails('test-agent-1');
      expect(agentDetails).not.toBeNull();
      expect(agentDetails?.id).toBe('test-agent-1');
      expect(agentDetails?.role).toBe('code_reviewer');
    });

    it('should reject registration of duplicate agent ID', async () => {
      const profile: AgentProfile = {
        id: 'duplicate-agent',
        role: 'code_reviewer',
        specialization: [],
        tools: [],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      const firstResult = await registry.registerAgent(profile);
      expect(firstResult.success).toBe(true);

      const secondResult = await registry.registerAgent(profile);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already registered');
    });

    it('should reject registration when at maximum capacity', async () => {
      // Register agents up to the limit
      const promises = [];
      for (let i = 0; i < testConfig.maxAgents; i++) {
        const profile: AgentProfile = {
          id: `agent-${i}`,
          role: 'code_reviewer',
          specialization: [],
          tools: [],
          collaborationRules: [],
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        promises.push(registry.registerAgent(profile));
      }

      await Promise.all(promises);

      // Try to register one more
      const extraProfile: AgentProfile = {
        id: 'extra-agent',
        role: 'code_reviewer',
        specialization: [],
        tools: [],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      const result = await registry.registerAgent(extraProfile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum capacity');
    });

    it('should validate required profile fields', async () => {
      const invalidProfile = {
        // Missing id and role
        specialization: [],
        tools: [],
        collaborationRules: [],
        status: 'idle' as AgentStatus,
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      } as AgentProfile;

      const result = await registry.registerAgent(invalidProfile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required fields');
    });
  });

  describe('Agent Discovery', () => {
    beforeEach(async () => {
      // Register test agents with different capabilities
      const agents = [
        {
          id: 'js-reviewer',
          role: 'code_reviewer' as AgentRole,
          specialization: ['javascript', 'react'],
          tools: ['eslint', 'jest']
        },
        {
          id: 'ts-reviewer',
          role: 'code_reviewer' as AgentRole,
          specialization: ['typescript', 'node'],
          tools: ['typescript', 'ts-node']
        },
        {
          id: 'security-agent',
          role: 'security' as AgentRole,
          specialization: ['owasp', 'penetration-testing'],
          tools: ['sonarqube', 'snyk']
        },
        {
          id: 'test-engineer',
          role: 'test_engineer' as AgentRole,
          specialization: ['unit-testing', 'integration-testing'],
          tools: ['jest', 'cypress']
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
        await registry.registerAgent(profile);
      }
    });

    it('should discover agents by required capabilities', async () => {
      const query: CapabilityQuery = {
        required: ['javascript']
      };

      const result = await registry.discoverAgents(query);

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('js-reviewer');
    });

    it('should discover agents by role', async () => {
      const query: CapabilityQuery = {
        required: [],
        role: 'code_reviewer'
      };

      const result = await registry.discoverAgents(query);

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(2);
      const agentIds = result.agents.map(a => a.id);
      expect(agentIds).toContain('js-reviewer');
      expect(agentIds).toContain('ts-reviewer');
    });

    it('should return empty result for non-existent capabilities', async () => {
      const query: CapabilityQuery = {
        required: ['python', 'django']
      };

      const result = await registry.discoverAgents(query);

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    it('should apply multiple capability requirements', async () => {
      const query: CapabilityQuery = {
        required: ['javascript', 'react']
      };

      const result = await registry.discoverAgents(query);

      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('js-reviewer');
    });

    it('should return agents sorted by suitability score', async () => {
      // Add capabilities to make one agent clearly better
      const capabilities: AgentCapability[] = [
        {
          name: 'javascript',
          version: '1.0.0',
          description: 'JavaScript expertise',
          dependencies: [],
          performance: {
            avgExecutionTime: 500,
            resourceRequirements: { cpu: 0.1, memory: 0.1 }
          }
        }
      ];

      await registry.registerAgent({
        id: 'expert-js-agent',
        role: 'code_reviewer',
        specialization: ['javascript', 'typescript', 'react', 'node'],
        tools: ['eslint', 'jest', 'webpack', 'babel'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      }, capabilities);

      const query: CapabilityQuery = {
        required: ['javascript'],
        optional: ['typescript', 'react']
      };

      const result = await registry.discoverAgents(query);

      expect(result.success).toBe(true);
      expect(result.agents.length).toBeGreaterThan(1);
      // The expert agent should be first due to higher score
      expect(result.agents[0].id).toBe('expert-js-agent');
    });
  });

  describe('Agent Status Management', () => {
    beforeEach(async () => {
      const profile: AgentProfile = {
        id: 'status-test-agent',
        role: 'code_reviewer',
        specialization: ['javascript'],
        tools: ['eslint'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await registry.registerAgent(profile);
    });

    it('should get current agent status', () => {
      const status = registry.getAgentStatus('status-test-agent');
      expect(status).toBe('idle');
    });

    it('should update agent status successfully', async () => {
      const result = await registry.updateAgentStatus('status-test-agent', 'busy');
      
      expect(result.success).toBe(true);
      expect(result.metadata?.newStatus).toBe('busy');

      const newStatus = registry.getAgentStatus('status-test-agent');
      expect(newStatus).toBe('busy');
    });

    it('should return null for non-existent agent status', () => {
      const status = registry.getAgentStatus('non-existent-agent');
      expect(status).toBeNull();
    });

    it('should fail to update status of non-existent agent', async () => {
      const result = await registry.updateAgentStatus('non-existent-agent', 'busy');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Agent Deregistration', () => {
    beforeEach(async () => {
      const profile: AgentProfile = {
        id: 'dereg-test-agent',
        role: 'code_reviewer',
        specialization: ['javascript'],
        tools: ['eslint'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await registry.registerAgent(profile);
    });

    it('should successfully deregister an existing agent', async () => {
      const result = await registry.deregisterAgent('dereg-test-agent');
      
      expect(result.success).toBe(true);
      expect(result.metadata?.agentId).toBe('dereg-test-agent');

      const status = registry.getAgentStatus('dereg-test-agent');
      expect(status).toBeNull();
    });

    it('should fail to deregister non-existent agent', async () => {
      const result = await registry.deregisterAgent('non-existent-agent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should clean up agent from indexes after deregistration', async () => {
      // First, verify the agent can be discovered
      const query: CapabilityQuery = {
        required: ['javascript']
      };

      const beforeResult = await registry.discoverAgents(query);
      expect(beforeResult.agents).toHaveLength(1);

      // Deregister the agent
      await registry.deregisterAgent('dereg-test-agent');

      // Verify it can no longer be discovered
      const afterResult = await registry.discoverAgents(query);
      expect(afterResult.agents).toHaveLength(0);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      const profile: AgentProfile = {
        id: 'health-test-agent',
        role: 'code_reviewer',
        specialization: ['javascript'],
        tools: ['eslint'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await registry.registerAgent(profile);
    });

    it('should perform health check on specific agent', async () => {
      const healthResults = await registry.performHealthCheck('health-test-agent');
      
      expect(healthResults.size).toBe(1);
      expect(healthResults.has('health-test-agent')).toBe(true);

      const healthCheck = healthResults.get('health-test-agent');
      expect(healthCheck).not.toBeUndefined();
      expect(healthCheck?.agentId).toBe('health-test-agent');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthCheck?.status);
    });

    it('should perform health check on all agents', async () => {
      // Register another agent
      await registry.registerAgent({
        id: 'health-test-agent-2',
        role: 'security',
        specialization: ['owasp'],
        tools: ['sonarqube'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });

      const healthResults = await registry.performHealthCheck();
      
      expect(healthResults.size).toBe(2);
      expect(healthResults.has('health-test-agent')).toBe(true);
      expect(healthResults.has('health-test-agent-2')).toBe(true);
    });
  });

  describe('Registry Statistics', () => {
    beforeEach(async () => {
      // Register multiple agents with different roles and statuses
      const agents = [
        {
          id: 'stats-reviewer-1',
          role: 'code_reviewer' as AgentRole,
          status: 'idle' as AgentStatus
        },
        {
          id: 'stats-reviewer-2', 
          role: 'code_reviewer' as AgentRole,
          status: 'busy' as AgentStatus
        },
        {
          id: 'stats-security',
          role: 'security' as AgentRole,
          status: 'idle' as AgentStatus
        },
        {
          id: 'stats-test-eng',
          role: 'test_engineer' as AgentRole,
          status: 'active' as AgentStatus
        }
      ];

      for (const agentData of agents) {
        const profile: AgentProfile = {
          ...agentData,
          specialization: ['test'],
          tools: ['test-tool'],
          collaborationRules: [],
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        await registry.registerAgent(profile);
      }
    });

    it('should provide accurate registry statistics', () => {
      const stats = registry.getRegistryStatistics();
      
      expect(stats.totalAgents).toBe(4);
      expect(stats.agentsByStatus.idle).toBe(2);
      expect(stats.agentsByStatus.busy).toBe(1);
      expect(stats.agentsByStatus.active).toBe(1);
      expect(stats.agentsByRole.code_reviewer).toBe(2);
      expect(stats.agentsByRole.security).toBe(1);
      expect(stats.agentsByRole.test_engineer).toBe(1);
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });

    it('should update statistics when agents are added or removed', async () => {
      const initialStats = registry.getRegistryStatistics();
      expect(initialStats.totalAgents).toBe(4);

      // Add another agent
      await registry.registerAgent({
        id: 'stats-new-agent',
        role: 'architect',
        specialization: ['system-design'],
        tools: ['uml'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });

      const afterAddStats = registry.getRegistryStatistics();
      expect(afterAddStats.totalAgents).toBe(5);
      expect(afterAddStats.agentsByRole.architect).toBe(1);

      // Remove an agent
      await registry.deregisterAgent('stats-new-agent');

      const afterRemoveStats = registry.getRegistryStatistics();
      expect(afterRemoveStats.totalAgents).toBe(4);
      expect(afterRemoveStats.agentsByRole.architect).toBeUndefined();
    });
  });

  describe('Event Subscriptions', () => {
    beforeEach(async () => {
      const profile: AgentProfile = {
        id: 'event-test-agent',
        role: 'code_reviewer',
        specialization: ['javascript'],
        tools: ['eslint'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await registry.registerAgent(profile);
    });

    it('should emit registration events', (done) => {
      const subscription = registry.subscribeToEvents(undefined, 'agent_registered');
      
      subscription.subscribe(event => {
        expect(event.type).toBe('agent_registered');
        expect(event.agentId).toBe('new-event-agent');
        subscription.unsubscribe();
        done();
      });

      // Register a new agent to trigger the event
      registry.registerAgent({
        id: 'new-event-agent',
        role: 'security',
        specialization: ['owasp'],
        tools: ['sonarqube'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });
    });

    it('should emit status change events', (done) => {
      const subscription = registry.subscribeToEvents('event-test-agent', 'agent_status_changed');
      
      subscription.subscribe(event => {
        expect(event.type).toBe('agent_status_changed');
        expect(event.agentId).toBe('event-test-agent');
        expect(event.payload.newStatus).toBe('busy');
        subscription.unsubscribe();
        done();
      });

      // Update agent status to trigger the event
      registry.updateAgentStatus('event-test-agent', 'busy');
    });

    it('should filter events by agent ID', (done) => {
      let eventCount = 0;
      const subscription = registry.subscribeToEvents('event-test-agent');
      
      subscription.subscribe(() => {
        eventCount++;
      });

      // This should trigger an event for our agent
      registry.updateAgentStatus('event-test-agent', 'busy');

      // Register another agent (should not trigger event for our specific agent)
      registry.registerAgent({
        id: 'another-agent',
        role: 'security',
        specialization: ['owasp'],
        tools: ['sonarqube'],
        collaborationRules: [],
        status: 'idle',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      });

      setTimeout(() => {
        expect(eventCount).toBe(1); // Only one event should have been received
        subscription.unsubscribe();
        done();
      }, 100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', async () => {
      const result = await registry.registerAgent(null as any);
      expect(result.success).toBe(false);
    });

    it('should handle empty capability queries', async () => {
      const query: CapabilityQuery = {
        required: []
      };

      const result = await registry.discoverAgents(query);
      expect(result.success).toBe(true);
      // Should return all agents when no specific requirements
    });

    it('should maintain consistency during concurrent operations', async () => {
      const concurrentRegistrations = [];
      
      for (let i = 0; i < 5; i++) {
        const profile: AgentProfile = {
          id: `concurrent-agent-${i}`,
          role: 'code_reviewer',
          specialization: ['javascript'],
          tools: ['eslint'],
          collaborationRules: [],
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        concurrentRegistrations.push(registry.registerAgent(profile));
      }

      const results = await Promise.all(concurrentRegistrations);
      
      // All registrations should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      const stats = registry.getRegistryStatistics();
      expect(stats.totalAgents).toBe(5);
    });
  });
});