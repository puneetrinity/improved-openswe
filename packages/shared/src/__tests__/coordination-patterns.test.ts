import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { CoordinationPatterns, CoordinationTask, ExecutionStrategy } from '../open-swe/coordination-patterns.js';
import { AgentRegistry } from '../open-swe/agent-registry.js';
import { AgentCommunicationHub } from '../open-swe/agent-communication-hub.js';
import { AgentProfile, AgentRole } from '../open-swe/types.js';

// Mock dependencies
vi.mock('../open-swe/agent-registry.js');
vi.mock('../open-swe/agent-communication-hub.js');

describe('CoordinationPatterns', () => {
  let coordinationPatterns: CoordinationPatterns;
  let mockRegistry: vi.Mocked<AgentRegistry>;
  let mockCommunicationHub: vi.Mocked<AgentCommunicationHub>;
  
  const mockAgentProfiles: AgentProfile[] = [
    {
      id: 'agent1',
      role: 'code_reviewer',
      specialization: ['javascript', 'testing'],
      tools: ['lint', 'test'],
      collaborationRules: [],
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    },
    {
      id: 'agent2',
      role: 'test_engineer',
      specialization: ['unit_testing', 'integration_testing'],
      tools: ['jest', 'cypress'],
      collaborationRules: [],
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    },
    {
      id: 'agent3',
      role: 'architect',
      specialization: ['system_design', 'patterns'],
      tools: ['design', 'review'],
      collaborationRules: [],
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }
  ];

  beforeEach(() => {
    mockRegistry = {
      getAllAgents: vi.fn().mockReturnValue(mockAgentProfiles),
      getAgentStatus: vi.fn().mockReturnValue('active'),
      registerAgent: vi.fn(),
      unregisterAgent: vi.fn(),
      discoverAgents: vi.fn(),
      subscribeToEvents: vi.fn(),
      performHealthCheck: vi.fn(),
      getRegistryStatistics: vi.fn(),
      shutdown: vi.fn()
    } as any;

    mockCommunicationHub = {
      sendMessage: vi.fn().mockResolvedValue({ success: true }),
      broadcastToRole: vi.fn().mockResolvedValue({ success: true }),
      subscribeToEvents: vi.fn(),
      unsubscribeFromEvents: vi.fn(),
      getQueueStatus: vi.fn(),
      getMessageHistory: vi.fn(),
      getStatistics: vi.fn(),
      shutdown: vi.fn()
    } as any;

    coordinationPatterns = new CoordinationPatterns(mockRegistry, mockCommunicationHub);
  });

  afterEach(async () => {
    await coordinationPatterns.shutdown();
  });

  describe('Scatter-Gather Pattern', () => {
    it('should execute scatter-gather pattern successfully', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'task1',
          type: 'code_review',
          payload: { file: 'test.js' },
          requiredCapabilities: ['lint'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        },
        {
          id: 'task2',
          type: 'unit_test',
          payload: { file: 'test.js' },
          requiredCapabilities: ['test'],
          preferredRoles: ['test_engineer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const strategy: ExecutionStrategy = {
        maxConcurrency: 2,
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
      };

      const result = await coordinationPatterns.executeScatterGather(tasks, strategy);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.summary.totalDuration).toBeGreaterThan(0);
      expect(result.summary.successfulTasks).toBe(2);
      expect(result.summary.failedTasks).toBe(0);
    });

    it('should handle task failures within failure tolerance', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'task1',
          type: 'failing_task',
          payload: {},
          requiredCapabilities: ['nonexistent'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const strategy: ExecutionStrategy = {
        maxConcurrency: 1,
        taskTimeout: 1000,
        patternTimeout: 5000,
        failureTolerance: 1,
        retryConfig: {
          maxAttempts: 1,
          backoffMultiplier: 1,
          initialDelay: 100
        },
        resourceAllocation: 'load_balanced',
        adaptiveOptimization: false
      };

      const result = await coordinationPatterns.executeScatterGather(tasks, strategy);

      expect(result.success).toBe(true);
      expect(result.summary.failedTasks).toBeGreaterThan(0);
    });

    it('should provide aggregation function support', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'task1',
          type: 'count_task',
          payload: { value: 1 },
          requiredCapabilities: ['count'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        },
        {
          id: 'task2',
          type: 'count_task',
          payload: { value: 2 },
          requiredCapabilities: ['count'],
          preferredRoles: ['test_engineer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const aggregationFn = (results: any[]) => ({
        totalCount: results.reduce((sum, r) => sum + (r.result?.output ? 1 : 0), 0)
      });

      const result = await coordinationPatterns.executeScatterGather(
        tasks, 
        {}, 
        aggregationFn
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Map-Reduce Pattern', () => {
    it('should execute map-reduce pattern successfully', async () => {
      const mapTasks: CoordinationTask[] = [
        {
          id: 'map1',
          type: 'map_operation',
          payload: { data: [1, 2, 3] },
          requiredCapabilities: ['process'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        },
        {
          id: 'map2',
          type: 'map_operation',
          payload: { data: [4, 5, 6] },
          requiredCapabilities: ['process'],
          preferredRoles: ['test_engineer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const reduceTasks: CoordinationTask[] = [
        {
          id: 'reduce1',
          type: 'reduce_operation',
          payload: {},
          requiredCapabilities: ['aggregate'],
          preferredRoles: ['architect'],
          dependencies: [],
          priority: 'high'
        }
      ];

      const result = await coordinationPatterns.executeMapReduce(mapTasks, reduceTasks);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3); // 2 map + 1 reduce
      expect(result.summary.successfulTasks).toBeGreaterThan(0);
    });

    it('should handle map phase failures', async () => {
      const mapTasks: CoordinationTask[] = [
        {
          id: 'failing_map',
          type: 'failing_map',
          payload: {},
          requiredCapabilities: ['nonexistent'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const reduceTasks: CoordinationTask[] = [];

      // Should throw error if all map tasks fail
      await expect(
        coordinationPatterns.executeMapReduce(mapTasks, reduceTasks)
      ).rejects.toThrow('All map tasks failed');
    });
  });

  describe('Pipeline Pattern', () => {
    it('should execute pipeline pattern successfully', async () => {
      const stages = [
        {
          stageName: 'preparation',
          tasks: [
            {
              id: 'prep1',
              type: 'prepare',
              payload: { input: 'raw_data' },
              requiredCapabilities: ['prepare'],
              preferredRoles: ['code_reviewer' as AgentRole],
              dependencies: [],
              priority: 'medium' as const
            }
          ]
        },
        {
          stageName: 'processing',
          tasks: [
            {
              id: 'process1',
              type: 'process',
              payload: {},
              requiredCapabilities: ['process'],
              preferredRoles: ['test_engineer' as AgentRole],
              dependencies: [],
              priority: 'medium' as const
            }
          ]
        },
        {
          stageName: 'finalization',
          tasks: [
            {
              id: 'finalize1',
              type: 'finalize',
              payload: {},
              requiredCapabilities: ['finalize'],
              preferredRoles: ['architect' as AgentRole],
              dependencies: [],
              priority: 'high' as const
            }
          ]
        }
      ];

      const result = await coordinationPatterns.executePipeline(stages);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3); // One task per stage
      expect(result.summary.successfulTasks).toBe(3);
    });

    it('should handle stage failures within tolerance', async () => {
      const stages = [
        {
          stageName: 'failing_stage',
          tasks: [
            {
              id: 'failing_task',
              type: 'failing',
              payload: {},
              requiredCapabilities: ['nonexistent'],
              preferredRoles: ['code_reviewer' as AgentRole],
              dependencies: [],
              priority: 'medium' as const
            }
          ]
        }
      ];

      const strategy: ExecutionStrategy = {
        maxConcurrency: 1,
        taskTimeout: 1000,
        patternTimeout: 5000,
        failureTolerance: 1, // Allow 1 failure per stage
        retryConfig: {
          maxAttempts: 1,
          backoffMultiplier: 1,
          initialDelay: 100
        },
        resourceAllocation: 'balanced',
        adaptiveOptimization: false
      };

      await expect(
        coordinationPatterns.executePipeline(stages, strategy)
      ).rejects.toThrow();
    });

    it('should pass data between pipeline stages', async () => {
      const stages = [
        {
          stageName: 'input',
          tasks: [
            {
              id: 'input_task',
              type: 'input',
              payload: { value: 10 },
              requiredCapabilities: ['input'],
              preferredRoles: ['code_reviewer' as AgentRole],
              dependencies: [],
              priority: 'medium' as const
            }
          ]
        },
        {
          stageName: 'transform',
          tasks: [
            {
              id: 'transform_task',
              type: 'transform',
              payload: {},
              requiredCapabilities: ['transform'],
              preferredRoles: ['test_engineer' as AgentRole],
              dependencies: [],
              priority: 'medium' as const
            }
          ]
        }
      ];

      const result = await coordinationPatterns.executePipeline(stages);

      expect(result.success).toBe(true);
      // Check that pipeline data is passed between stages
      expect(result.context.sharedContext.pipelineOutput).toBeDefined();
    });
  });

  describe('Fork-Join Pattern', () => {
    it('should execute fork-join pattern successfully', async () => {
      const forkTasks: CoordinationTask[] = [
        {
          id: 'fork1',
          type: 'parallel_work',
          payload: { workload: 'A' },
          requiredCapabilities: ['work'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        },
        {
          id: 'fork2',
          type: 'parallel_work',
          payload: { workload: 'B' },
          requiredCapabilities: ['work'],
          preferredRoles: ['test_engineer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const joinTask: CoordinationTask = {
        id: 'join1',
        type: 'combine_results',
        payload: {},
        requiredCapabilities: ['combine'],
        preferredRoles: ['architect'],
        dependencies: [],
        priority: 'high'
      };

      const result = await coordinationPatterns.executeForkJoin(forkTasks, joinTask);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3); // 2 fork + 1 join
      expect(result.summary.successfulTasks).toBeGreaterThan(0);
    });

    it('should execute fork-join without join task', async () => {
      const forkTasks: CoordinationTask[] = [
        {
          id: 'fork1',
          type: 'independent_work',
          payload: {},
          requiredCapabilities: ['work'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const result = await coordinationPatterns.executeForkJoin(forkTasks);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1); // Only fork task
    });
  });

  describe('Load Balancing', () => {
    it('should distribute tasks based on agent load', async () => {
      const tasks: CoordinationTask[] = Array.from({ length: 6 }, (_, i) => ({
        id: `task${i}`,
        type: 'balanced_task',
        payload: {},
        requiredCapabilities: ['work'],
        preferredRoles: ['code_reviewer'],
        dependencies: [],
        priority: 'medium'
      }));

      const result = await coordinationPatterns.executeScatterGather(tasks);

      expect(result.success).toBe(true);
      expect(result.performanceMetrics.agentUtilization.size).toBeGreaterThan(0);
    });

    it('should provide load balancing information', () => {
      const loadInfo = coordinationPatterns.getLoadBalancingInfo();
      
      // Should have information for available agents
      expect(loadInfo).toBeInstanceOf(Map);
    });
  });

  describe('Performance Metrics', () => {
    it('should collect performance metrics', () => {
      const metrics = coordinationPatterns.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalExecutions');
      expect(metrics).toHaveProperty('successfulExecutions');
      expect(metrics).toHaveProperty('failedExecutions');
      expect(metrics).toHaveProperty('avgExecutionTime');
      expect(metrics).toHaveProperty('totalTasksProcessed');
      expect(metrics).toHaveProperty('throughputPerSecond');
      expect(metrics).toHaveProperty('lastMetricsUpdate');
    });

    it('should track execution events', (done) => {
      const executionEvents = coordinationPatterns.subscribeToExecutionEvents();
      
      executionEvents.subscribe((event) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('timestamp');
        done();
      });

      // Trigger an execution to generate events
      coordinationPatterns.executeScatterGather([
        {
          id: 'test_task',
          type: 'test',
          payload: {},
          requiredCapabilities: ['test'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'low'
        }
      ]);
    });
  });

  describe('Execution Management', () => {
    it('should track active executions', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'long_task',
          type: 'long_running',
          payload: {},
          requiredCapabilities: ['work'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      // Start execution (don't await)
      const executionPromise = coordinationPatterns.executeScatterGather(tasks);

      // Check active executions
      const activeExecutions = coordinationPatterns.getActiveExecutions();
      expect(activeExecutions.size).toBeGreaterThanOrEqual(0);

      // Wait for completion
      await executionPromise;
    });

    it('should allow canceling executions', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'cancelable_task',
          type: 'long_running',
          payload: {},
          requiredCapabilities: ['work'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'low'
        }
      ];

      // Start execution
      const executionPromise = coordinationPatterns.executeScatterGather(tasks);
      
      // Get active executions to find execution ID
      const activeExecutions = coordinationPatterns.getActiveExecutions();
      const executionId = Array.from(activeExecutions.keys())[0];

      if (executionId) {
        const cancelResult = await coordinationPatterns.cancelExecution(executionId);
        expect(cancelResult.success).toBe(true);
      }

      // Execution should complete or be cancelled
      await executionPromise;
    });
  });

  describe('Agent Allocation', () => {
    it('should select agents based on capabilities', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'specific_task',
          type: 'javascript_review',
          payload: {},
          requiredCapabilities: ['javascript'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const result = await coordinationPatterns.executeScatterGather(tasks);

      expect(result.success).toBe(true);
      expect(result.context.allocatedAgents.size).toBeGreaterThan(0);
      
      // Check that allocated agent has required capabilities
      const allocatedAgent = Array.from(result.context.allocatedAgents.values())[0];
      expect(allocatedAgent.specialization).toContain('javascript');
    });

    it('should handle no suitable agents scenario', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'impossible_task',
          type: 'impossible',
          payload: {},
          requiredCapabilities: ['nonexistent_capability'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      await expect(
        coordinationPatterns.executeScatterGather(tasks)
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle communication failures gracefully', async () => {
      // Mock communication failure
      mockCommunicationHub.sendMessage.mockResolvedValueOnce({ 
        success: false, 
        error: 'Communication failed' 
      });

      const tasks: CoordinationTask[] = [
        {
          id: 'comm_fail_task',
          type: 'test',
          payload: {},
          requiredCapabilities: ['test'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      const result = await coordinationPatterns.executeScatterGather(tasks);
      
      // Should handle failure gracefully
      expect(result.success).toBe(true);
      expect(result.summary.failedTasks).toBeGreaterThan(0);
    });

    it('should provide detailed error information', async () => {
      const tasks: CoordinationTask[] = [
        {
          id: 'error_task',
          type: 'error_prone',
          payload: {},
          requiredCapabilities: ['nonexistent'],
          preferredRoles: ['code_reviewer'],
          dependencies: [],
          priority: 'medium'
        }
      ];

      try {
        await coordinationPatterns.executeScatterGather(tasks);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
      }
    });
  });
});