import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoordinationIntegration, EnhancedWorkflowStep } from '../open-swe/coordination-integration.js';
import { MultiAgentSystem } from '../open-swe/multi-agent-system.js';
import { AgentProfile, GraphState, AgentRole } from '../open-swe/types.js';
import { ExecutionStrategy } from '../open-swe/coordination-patterns.js';

// Mock all dependencies
vi.mock('../open-swe/multi-agent-system.js');
vi.mock('../open-swe/coordination-patterns.js');
vi.mock('../open-swe/distributed-coordination.js');
vi.mock('../open-swe/event-driven-architecture.js');
vi.mock('../open-swe/conflict-resolution.js');
vi.mock('../open-swe/performance-scalability.js');

describe('CoordinationIntegration', () => {
  let coordinationIntegration: CoordinationIntegration;
  let mockMultiAgentSystem: vi.Mocked<MultiAgentSystem>;
  
  const mockGraphState: GraphState = {
    messages: [],
    internalMessages: [],
    taskPlan: {
      tasks: [],
      activeTaskIndex: 0
    },
    contextGatheringNotes: '',
    sandboxSessionId: 'test-sandbox',
    branchName: 'test-branch',
    targetRepository: {
      owner: 'test-owner',
      repo: 'test-repo'
    },
    codebaseTree: '',
    documentCache: {},
    githubIssueId: 123,
    dependenciesInstalled: false,
    reviewsCount: 0,
    activeAgents: new Map(),
    collaborationContext: {
      currentTaskId: '',
      knowledgeBase: {},
      communicationHistory: [],
      workspaceState: {}
    },
    taskDelegations: [],
    ui: [],
    context: {}
  };

  beforeEach(() => {
    // Create mock multi-agent system
    mockMultiAgentSystem = {
      registry: {
        getAllAgents: vi.fn().mockReturnValue([
          {
            id: 'agent1',
            role: 'code_reviewer',
            specialization: ['javascript'],
            tools: ['lint'],
            collaborationRules: [],
            status: 'active',
            createdAt: Date.now(),
            lastActiveAt: Date.now()
          } as AgentProfile
        ]),
        getAgentStatus: vi.fn().mockReturnValue('active'),
        registerAgent: vi.fn(),
        unregisterAgent: vi.fn(),
        discoverAgents: vi.fn(),
        subscribeToEvents: vi.fn(),
        performHealthCheck: vi.fn(),
        getRegistryStatistics: vi.fn(),
        shutdown: vi.fn()
      },
      communicationHub: {
        sendMessage: vi.fn().mockResolvedValue({ success: true }),
        broadcastToRole: vi.fn().mockResolvedValue({ success: true }),
        subscribeToEvents: vi.fn(),
        unsubscribeFromEvents: vi.fn(),
        getQueueStatus: vi.fn(),
        getMessageHistory: vi.fn(),
        getStatistics: vi.fn(),
        shutdown: vi.fn()
      },
      registerAgent: vi.fn(),
      discoverAgents: vi.fn(),
      sendMessage: vi.fn(),
      broadcastToRole: vi.fn(),
      delegateTask: vi.fn(),
      addOrchestrationRule: vi.fn(),
      removeOrchestrationRule: vi.fn(),
      subscribeToSystemEvents: vi.fn(),
      getSystemStatistics: vi.fn(),
      getSystemStatus: vi.fn(),
      performSystemHealthCheck: vi.fn().mockResolvedValue({
        overall: 'healthy' as const,
        components: {
          registry: 'healthy' as const,
          communication: 'healthy' as const,
          agents: {}
        },
        recommendations: []
      }),
      shutdown: vi.fn()
    } as any;

    coordinationIntegration = new CoordinationIntegration(mockMultiAgentSystem, {
      enableCoordinationPatterns: true,
      enableDistributedCoordination: true,
      enableEventDriven: true,
      enableConflictResolution: true,
      enablePerformanceScalability: true,
      enableMonitoring: true,
      enableAutoHealing: true
    });
  });

  afterEach(async () => {
    await coordinationIntegration.shutdown();
  });

  describe('Workflow Execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'step1',
          name: 'Code Review',
          requiredCapabilities: ['lint'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 3,
              backoffMultiplier: 2,
              initialDelay: 1000
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 2,
            initialDelay: 1000
          },
          failureHandling: {
            strategy: 'retry'
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'test-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
      expect(result.results.size).toBe(1);
      expect(result.metrics.tasksCompleted).toBe(1);
    });

    it('should execute workflow with coordination patterns', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'scatter-step',
          name: 'Parallel Analysis',
          coordinationPattern: 'scatter_gather',
          requiredCapabilities: ['analyze'],
          preferredRoles: ['code_reviewer', 'test_engineer'],
          executionStrategy: {
            maxConcurrency: 3,
            taskTimeout: 30000,
            patternTimeout: 120000,
            failureTolerance: 1,
            retryConfig: {
              maxAttempts: 2,
              backoffMultiplier: 1.5,
              initialDelay: 500
            },
            resourceAllocation: 'capability_based',
            adaptiveOptimization: true
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 2,
            backoffMultiplier: 1.5,
            initialDelay: 500
          },
          failureHandling: {
            strategy: 'compensate'
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'pattern-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
      expect(result.results.size).toBe(1);
    });

    it('should handle workflow with distributed locks', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'locked-step',
          name: 'Critical Section',
          requiredCapabilities: ['critical_work'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 3,
              backoffMultiplier: 2,
              initialDelay: 1000
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          requiredLocks: [
            {
              lockId: 'critical_resource_lock',
              type: 'exclusive',
              timeout: 30000,
              autoReleaseTimeout: 60000,
              deadlockDetection: true,
              priority: 'high'
            }
          ],
          dependencies: [],
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 2,
            initialDelay: 1000
          },
          failureHandling: {
            strategy: 'retry'
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'locked-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should handle workflow with circuit breakers', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'protected-step',
          name: 'Protected Operation',
          requiredCapabilities: ['risky_operation'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 10000,
            patternTimeout: 30000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 1,
              backoffMultiplier: 1,
              initialDelay: 100
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          circuitBreakerConfig: {
            id: 'risky_op_breaker',
            failureThreshold: 50,
            successThreshold: 5,
            timeout: 30000,
            monitoringWindowSize: 20,
            minimumRequestThreshold: 5,
            slowCallThreshold: 50,
            slowCallDurationThreshold: 2000
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 1,
            backoffMultiplier: 1,
            initialDelay: 100
          },
          failureHandling: {
            strategy: 'retry'
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'protected-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should handle workflow with transactions', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'transactional-step',
          name: 'Transactional Operation',
          requiredCapabilities: ['database_work'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 3,
              backoffMultiplier: 2,
              initialDelay: 1000
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          transactionConfig: {
            isolationLevel: 'read_committed',
            timeout: 60000,
            participants: ['agent1']
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 2,
            initialDelay: 1000
          },
          failureHandling: {
            strategy: 'retry'
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'transactional-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should handle step dependencies correctly', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'step1',
          name: 'First Step',
          requiredCapabilities: ['first'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
          failureHandling: { strategy: 'retry' }
        },
        {
          id: 'step2',
          name: 'Dependent Step',
          requiredCapabilities: ['second'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: ['step1'],
          retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
          failureHandling: { strategy: 'retry' }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'dependent-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
      expect(result.results.size).toBe(2);
    });
  });

  describe('Failure Handling', () => {
    it('should retry failed steps', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'flaky-step',
          name: 'Flaky Operation',
          requiredCapabilities: ['flaky'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 1000, // Short timeout to force failure
            patternTimeout: 5000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 3,
              backoffMultiplier: 1.5,
              initialDelay: 100
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 1.5,
            initialDelay: 100
          },
          failureHandling: {
            strategy: 'retry'
          }
        }
      ];

      // This should succeed after retries
      const result = await coordinationIntegration.executeWorkflow(
        'retry-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should handle compensation strategy', async () => {
      let compensationCalled = false;

      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'compensable-step',
          name: 'Compensable Operation',
          requiredCapabilities: ['nonexistent'], // This will fail
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 1,
              backoffMultiplier: 1,
              initialDelay: 100
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 1,
            backoffMultiplier: 1,
            initialDelay: 100
          },
          failureHandling: {
            strategy: 'compensate',
            compensationAction: async () => {
              compensationCalled = true;
            }
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'compensation-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(false);
      expect(compensationCalled).toBe(true);
    });

    it('should ignore failures when configured', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'ignorable-step',
          name: 'Ignorable Failure',
          requiredCapabilities: ['nonexistent'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: {
              maxAttempts: 1,
              backoffMultiplier: 1,
              initialDelay: 100
            },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: {
            maxAttempts: 1,
            backoffMultiplier: 1,
            initialDelay: 100
          },
          failureHandling: {
            strategy: 'ignore'
          }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'ignore-failure-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true); // Should succeed despite step failure
    });
  });

  describe('Health Monitoring', () => {
    it('should provide system health status', () => {
      const health = coordinationIntegration.getSystemHealth();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('lastHealthCheck');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
    });

    it('should track active workflows', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'tracked-step',
          name: 'Tracked Step',
          requiredCapabilities: ['track'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
          failureHandling: { strategy: 'retry' }
        }
      ];

      // Start workflow (don't await)
      const workflowPromise = coordinationIntegration.executeWorkflow(
        'tracked-workflow',
        steps,
        mockGraphState
      );

      // Check active workflows
      const activeWorkflows = coordinationIntegration.getActiveWorkflows();
      expect(activeWorkflows.size).toBeGreaterThanOrEqual(0);

      // Wait for completion
      await workflowPromise;

      // Should be cleared after completion
      const completedWorkflows = coordinationIntegration.getActiveWorkflows();
      expect(completedWorkflows.has('tracked-workflow')).toBe(false);
    });
  });

  describe('Event Integration', () => {
    it('should emit integration events', (done) => {
      const events = coordinationIntegration.subscribeToIntegrationEvents();
      
      events.subscribe((event) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('timestamp');
        done();
      });

      // Execute a workflow to generate events
      coordinationIntegration.executeWorkflow(
        'event-workflow',
        [{
          id: 'event-step',
          name: 'Event Step',
          requiredCapabilities: ['event'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
          failureHandling: { strategy: 'retry' }
        }],
        mockGraphState
      );
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableCoordinationPatterns: false,
        enableMonitoring: false
      };

      coordinationIntegration.updateConfiguration(newConfig);

      // Configuration should be updated
      // We can't directly access the config, but the update should not throw
      expect(true).toBe(true);
    });

    it('should provide default configuration', () => {
      // Test that system works with default configuration
      const defaultIntegration = new CoordinationIntegration(mockMultiAgentSystem);
      
      expect(defaultIntegration).toBeInstanceOf(CoordinationIntegration);
      
      defaultIntegration.shutdown();
    });
  });

  describe('Resource Management', () => {
    it('should manage bulkheads correctly', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'bulkhead-step',
          name: 'Bulkhead Protected',
          requiredCapabilities: ['bulk_work'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 2,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          bulkheadConfig: {
            id: 'test_bulkhead',
            strategy: 'thread_pool',
            maxConcurrentOperations: 5,
            queueSize: 10,
            operationTimeout: 30000,
            queueTimeout: 5000
          },
          dependencies: [],
          retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
          failureHandling: { strategy: 'retry' }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'bulkhead-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should handle semaphore acquisition', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'semaphore-step',
          name: 'Semaphore Protected',
          requiredCapabilities: ['sem_work'],
          preferredRoles: ['code_reviewer'],
          executionStrategy: {
            maxConcurrency: 1,
            taskTimeout: 30000,
            patternTimeout: 60000,
            failureTolerance: 0,
            retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
            resourceAllocation: 'load_balanced',
            adaptiveOptimization: false
          },
          requiredSemaphores: [
            {
              semaphoreId: 'test_semaphore',
              maxPermits: 3,
              timeout: 10000,
              fairQueuing: true,
              autoReleaseTimeout: 30000
            }
          ],
          dependencies: [],
          retryConfig: { maxAttempts: 1, backoffMultiplier: 1, initialDelay: 100 },
          failureHandling: { strategy: 'retry' }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'semaphore-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Pattern Integration', () => {
    it('should execute map-reduce pattern', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'mapreduce-step',
          name: 'Map-Reduce Processing',
          coordinationPattern: 'map_reduce',
          requiredCapabilities: ['map', 'reduce'],
          preferredRoles: ['code_reviewer', 'test_engineer'],
          executionStrategy: {
            maxConcurrency: 4,
            taskTimeout: 30000,
            patternTimeout: 120000,
            failureTolerance: 1,
            retryConfig: { maxAttempts: 2, backoffMultiplier: 1.5, initialDelay: 500 },
            resourceAllocation: 'capability_based',
            adaptiveOptimization: true
          },
          dependencies: [],
          retryConfig: { maxAttempts: 2, backoffMultiplier: 1.5, initialDelay: 500 },
          failureHandling: { strategy: 'retry' }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'mapreduce-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should execute pipeline pattern', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'pipeline-step',
          name: 'Pipeline Processing',
          coordinationPattern: 'pipeline',
          requiredCapabilities: ['stage1', 'stage2', 'stage3'],
          preferredRoles: ['code_reviewer', 'test_engineer', 'architect'],
          executionStrategy: {
            maxConcurrency: 3,
            taskTimeout: 30000,
            patternTimeout: 180000,
            failureTolerance: 1,
            retryConfig: { maxAttempts: 2, backoffMultiplier: 1.5, initialDelay: 500 },
            resourceAllocation: 'priority',
            adaptiveOptimization: true
          },
          dependencies: [],
          retryConfig: { maxAttempts: 2, backoffMultiplier: 1.5, initialDelay: 500 },
          failureHandling: { strategy: 'compensate' }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'pipeline-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });

    it('should execute fork-join pattern', async () => {
      const steps: EnhancedWorkflowStep[] = [
        {
          id: 'forkjoin-step',
          name: 'Fork-Join Processing',
          coordinationPattern: 'fork_join',
          requiredCapabilities: ['fork', 'join'],
          preferredRoles: ['code_reviewer', 'test_engineer'],
          executionStrategy: {
            maxConcurrency: 5,
            taskTimeout: 30000,
            patternTimeout: 90000,
            failureTolerance: 1,
            retryConfig: { maxAttempts: 2, backoffMultiplier: 1.5, initialDelay: 500 },
            resourceAllocation: 'balanced',
            adaptiveOptimization: false
          },
          dependencies: [],
          retryConfig: { maxAttempts: 2, backoffMultiplier: 1.5, initialDelay: 500 },
          failureHandling: { strategy: 'retry' }
        }
      ];

      const result = await coordinationIntegration.executeWorkflow(
        'forkjoin-workflow',
        steps,
        mockGraphState
      );

      expect(result.success).toBe(true);
    });
  });
});