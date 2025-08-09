import { Observable, Subject, BehaviorSubject, merge, combineLatest, from } from 'rxjs';
import { map, filter, mergeMap, concatMap, switchMap, take, timeout, retry, catchError } from 'rxjs/operators';
import { 
  AgentProfile, 
  AgentRole,
  AgentMessage,
  TaskDelegation,
  CollaborationPattern,
  WorkflowStep
} from './types.js';
import {
  AgentRegistry,
  AgentCommunicationHub,
  AgentEvent,
  AgentEventType,
  RegistryOperationResult
} from './agent-registry.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Supported coordination pattern types
 */
export type CoordinationPatternType = 
  | 'scatter_gather'
  | 'map_reduce' 
  | 'pipeline'
  | 'fork_join'
  | 'leader_election'
  | 'consensus'
  | 'barrier_sync'
  | 'producer_consumer'
  | 'master_worker'
  | 'chain_of_responsibility';

/**
 * Execution strategy for parallel tasks
 */
export interface ExecutionStrategy {
  /**
   * Maximum concurrent tasks
   */
  maxConcurrency: number;
  
  /**
   * Timeout for individual tasks (ms)
   */
  taskTimeout: number;
  
  /**
   * Overall pattern timeout (ms)
   */
  patternTimeout: number;
  
  /**
   * Failure tolerance (number of failures before pattern fails)
   */
  failureTolerance: number;
  
  /**
   * Retry configuration
   */
  retryConfig: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  
  /**
   * Resource allocation strategy
   */
  resourceAllocation: 'balanced' | 'priority' | 'capability_based' | 'load_balanced';
  
  /**
   * Enable adaptive optimization
   */
  adaptiveOptimization: boolean;
}

/**
 * Task specification for coordination patterns
 */
export interface CoordinationTask {
  /**
   * Task identifier
   */
  id: string;
  
  /**
   * Task type or category
   */
  type: string;
  
  /**
   * Task payload data
   */
  payload: Record<string, unknown>;
  
  /**
   * Required capabilities
   */
  requiredCapabilities: string[];
  
  /**
   * Preferred agent roles
   */
  preferredRoles: AgentRole[];
  
  /**
   * Task dependencies
   */
  dependencies: string[];
  
  /**
   * Estimated execution time (ms)
   */
  estimatedDuration?: number;
  
  /**
   * Task priority
   */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Deadline for completion
   */
  deadline?: number;
}

/**
 * Task result from agent execution
 */
export interface TaskResult {
  /**
   * Task identifier
   */
  taskId: string;
  
  /**
   * Agent that executed the task
   */
  agentId: string;
  
  /**
   * Execution status
   */
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  
  /**
   * Result data
   */
  result?: Record<string, unknown>;
  
  /**
   * Error information if failed
   */
  error?: string;
  
  /**
   * Execution metrics
   */
  metrics: {
    startTime: number;
    endTime: number;
    executionTime: number;
    memoryUsed?: number;
    cpuTime?: number;
  };
  
  /**
   * Task-specific metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Pattern execution context
 */
export interface ExecutionContext {
  /**
   * Pattern execution ID
   */
  executionId: string;
  
  /**
   * Pattern type being executed
   */
  patternType: CoordinationPatternType;
  
  /**
   * Tasks to execute
   */
  tasks: CoordinationTask[];
  
  /**
   * Execution strategy
   */
  strategy: ExecutionStrategy;
  
  /**
   * Shared context data
   */
  sharedContext: Record<string, unknown>;
  
  /**
   * Start timestamp
   */
  startTime: number;
  
  /**
   * Current execution state
   */
  state: 'initializing' | 'executing' | 'completed' | 'failed' | 'cancelled';
  
  /**
   * Progress tracking
   */
  progress: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    runningTasks: number;
  };
  
  /**
   * Allocated agents
   */
  allocatedAgents: Map<string, AgentProfile>;
  
  /**
   * Results collection
   */
  results: Map<string, TaskResult>;
}

/**
 * Pattern execution result
 */
export interface PatternExecutionResult {
  /**
   * Execution context
   */
  context: ExecutionContext;
  
  /**
   * Overall success status
   */
  success: boolean;
  
  /**
   * Combined results
   */
  results: TaskResult[];
  
  /**
   * Execution summary
   */
  summary: {
    totalDuration: number;
    successfulTasks: number;
    failedTasks: number;
    avgExecutionTime: number;
    throughput: number;
  };
  
  /**
   * Performance metrics
   */
  performanceMetrics: {
    agentUtilization: Map<string, number>;
    resourceEfficiency: number;
    parallelismFactor: number;
    scalabilityIndex: number;
  };
  
  /**
   * Error information if failed
   */
  error?: string;
}

/**
 * Dynamic load balancing information
 */
export interface LoadBalancingInfo {
  /**
   * Agent identifier
   */
  agentId: string;
  
  /**
   * Current load percentage (0-100)
   */
  currentLoad: number;
  
  /**
   * Queue size
   */
  queueSize: number;
  
  /**
   * Average response time (ms)
   */
  avgResponseTime: number;
  
  /**
   * Success rate (0-1)
   */
  successRate: number;
  
  /**
   * Capacity score (0-1)
   */
  capacityScore: number;
  
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Agent allocation result
 */
export interface AgentAllocation {
  /**
   * Allocated agent
   */
  agent: AgentProfile;
  
  /**
   * Tasks assigned to agent
   */
  assignedTasks: string[];
  
  /**
   * Expected load after allocation
   */
  expectedLoad: number;
  
  /**
   * Allocation score
   */
  allocationScore: number;
  
  /**
   * Allocation rationale
   */
  rationale: string;
}

/**
 * Comprehensive coordination patterns system for parallel execution.
 * 
 * Implements various distributed computing patterns like scatter-gather,
 * map-reduce, pipeline processing, and fork-join with sophisticated 
 * agent allocation, load balancing, and failure recovery mechanisms.
 */
export class CoordinationPatterns {
  private readonly logger = createLogger(LogLevel.INFO, 'CoordinationPatterns');
  
  /**
   * Agent registry for capability discovery
   */
  private readonly registry: AgentRegistry;
  
  /**
   * Communication hub for message routing
   */
  private readonly communicationHub: AgentCommunicationHub;
  
  /**
   * Active executions
   */
  private readonly activeExecutions = new Map<string, ExecutionContext>();
  
  /**
   * Agent load balancing information
   */
  private readonly loadBalancingInfo = new Map<string, LoadBalancingInfo>();
  
  /**
   * Pattern execution event stream
   */
  private readonly executionEventStream = new Subject<AgentEvent>();
  
  /**
   * Performance monitoring
   */
  private readonly performanceMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTime: 0,
    totalTasksProcessed: 0,
    throughputPerSecond: 0,
    lastMetricsUpdate: Date.now()
  };
  
  /**
   * Configuration for optimization
   */
  private readonly config = {
    loadBalancingInterval: 5000, // 5 seconds
    performanceMetricsInterval: 10000, // 10 seconds
    adaptiveOptimizationEnabled: true,
    maxConcurrentExecutions: 50,
    defaultTaskTimeout: 60000, // 1 minute
    defaultPatternTimeout: 300000, // 5 minutes
    agentHealthCheckInterval: 30000 // 30 seconds
  };

  /**
   * Creates a new CoordinationPatterns instance
   * 
   * @param registry - Agent registry for capability discovery
   * @param communicationHub - Communication hub for message routing
   */
  constructor(registry: AgentRegistry, communicationHub: AgentCommunicationHub) {
    this.registry = registry;
    this.communicationHub = communicationHub;
    
    this.initializeLoadBalancing();
    this.initializePerformanceMonitoring();
    
    this.logger.info('CoordinationPatterns system initialized');
  }

  /**
   * Executes a scatter-gather pattern where tasks are distributed to multiple agents
   * and results are collected and aggregated.
   * 
   * @param tasks - Tasks to distribute
   * @param strategy - Execution strategy
   * @param aggregationFn - Function to aggregate results
   * @returns Promise resolving to pattern execution result
   */
  async executeScatterGather(
    tasks: CoordinationTask[],
    strategy: Partial<ExecutionStrategy> = {},
    aggregationFn?: (results: TaskResult[]) => Record<string, unknown>
  ): Promise<PatternExecutionResult> {
    const executionId = `scatter_gather_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting scatter-gather execution', {
      executionId,
      taskCount: tasks.length,
      strategy
    });

    const context = await this.initializeExecution(
      executionId,
      'scatter_gather',
      tasks,
      strategy
    );

    try {
      // Allocate agents for all tasks
      const allocations = await this.allocateAgentsForTasks(tasks, context.strategy);
      
      // Update context with allocations
      for (const allocation of allocations) {
        context.allocatedAgents.set(allocation.agent.id, allocation.agent);
      }

      // Execute all tasks in parallel
      const taskPromises = tasks.map(task => 
        this.executeTaskWithAgent(task, allocations.find(a => 
          a.assignedTasks.includes(task.id)
        )?.agent, context)
      );

      // Wait for all tasks with timeout
      const results = await Promise.all(
        taskPromises.map(promise => 
          promise.catch(error => ({
            taskId: '',
            agentId: 'unknown',
            status: 'failed' as const,
            error: error.message,
            metrics: {
              startTime: Date.now(),
              endTime: Date.now(),
              executionTime: 0
            }
          }))
        )
      );

      // Filter out failed results for aggregation if specified
      const successfulResults = results.filter(r => r.status === 'completed');
      
      // Aggregate results if function provided
      let aggregatedResult: Record<string, unknown> | undefined;
      if (aggregationFn && successfulResults.length > 0) {
        aggregatedResult = aggregationFn(successfulResults);
      }

      // Update context
      context.state = 'completed';
      context.progress.completedTasks = results.filter(r => r.status === 'completed').length;
      context.progress.failedTasks = results.filter(r => r.status === 'failed').length;

      // Store results in context
      results.forEach(result => {
        context.results.set(result.taskId, result);
      });

      const executionResult = await this.finalizeExecution(context, true, aggregatedResult);
      
      this.logger.info('Scatter-gather execution completed', {
        executionId,
        success: executionResult.success,
        totalTasks: tasks.length,
        successfulTasks: executionResult.summary.successfulTasks,
        duration: executionResult.summary.totalDuration
      });

      return executionResult;

    } catch (error) {
      this.logger.error('Scatter-gather execution failed', {
        executionId,
        error: error instanceof Error ? error.message : error
      });

      context.state = 'failed';
      return await this.finalizeExecution(context, false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Executes a map-reduce pattern with mapping phase followed by reduction phase.
   * 
   * @param mapTasks - Tasks for the mapping phase
   * @param reduceTasks - Tasks for the reduction phase
   * @param strategy - Execution strategy
   * @returns Promise resolving to pattern execution result
   */
  async executeMapReduce(
    mapTasks: CoordinationTask[],
    reduceTasks: CoordinationTask[],
    strategy: Partial<ExecutionStrategy> = {}
  ): Promise<PatternExecutionResult> {
    const executionId = `map_reduce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting map-reduce execution', {
      executionId,
      mapTaskCount: mapTasks.length,
      reduceTaskCount: reduceTasks.length
    });

    const allTasks = [...mapTasks, ...reduceTasks];
    const context = await this.initializeExecution(
      executionId,
      'map_reduce',
      allTasks,
      strategy
    );

    try {
      // Phase 1: Execute map tasks in parallel
      this.logger.info('Starting map phase', { executionId });
      
      const mapAllocations = await this.allocateAgentsForTasks(mapTasks, context.strategy);
      const mapPromises = mapTasks.map(task => 
        this.executeTaskWithAgent(task, mapAllocations.find(a => 
          a.assignedTasks.includes(task.id)
        )?.agent, context)
      );

      const mapResults = await Promise.all(mapPromises);
      const successfulMapResults = mapResults.filter(r => r.status === 'completed');

      if (successfulMapResults.length === 0) {
        throw new Error('All map tasks failed');
      }

      this.logger.info('Map phase completed', {
        executionId,
        successfulTasks: successfulMapResults.length,
        failedTasks: mapResults.length - successfulMapResults.length
      });

      // Phase 2: Execute reduce tasks with map results as input
      this.logger.info('Starting reduce phase', { executionId });
      
      // Enhance reduce tasks with map results
      const enhancedReduceTasks = reduceTasks.map(task => ({
        ...task,
        payload: {
          ...task.payload,
          mapResults: successfulMapResults.map(r => r.result)
        }
      }));

      const reduceAllocations = await this.allocateAgentsForTasks(enhancedReduceTasks, context.strategy);
      const reducePromises = enhancedReduceTasks.map(task => 
        this.executeTaskWithAgent(task, reduceAllocations.find(a => 
          a.assignedTasks.includes(task.id)
        )?.agent, context)
      );

      const reduceResults = await Promise.all(reducePromises);

      // Combine all results
      const allResults = [...mapResults, ...reduceResults];
      
      // Update context
      context.state = 'completed';
      context.progress.completedTasks = allResults.filter(r => r.status === 'completed').length;
      context.progress.failedTasks = allResults.filter(r => r.status === 'failed').length;

      allResults.forEach(result => {
        context.results.set(result.taskId, result);
      });

      // Update allocated agents
      [...mapAllocations, ...reduceAllocations].forEach(allocation => {
        context.allocatedAgents.set(allocation.agent.id, allocation.agent);
      });

      const executionResult = await this.finalizeExecution(context, true);
      
      this.logger.info('Map-reduce execution completed', {
        executionId,
        success: executionResult.success,
        totalDuration: executionResult.summary.totalDuration
      });

      return executionResult;

    } catch (error) {
      this.logger.error('Map-reduce execution failed', {
        executionId,
        error: error instanceof Error ? error.message : error
      });

      context.state = 'failed';
      return await this.finalizeExecution(context, false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Executes a pipeline pattern where tasks are processed in sequence through multiple stages.
   * 
   * @param stages - Pipeline stages with their tasks
   * @param strategy - Execution strategy
   * @returns Promise resolving to pattern execution result
   */
  async executePipeline(
    stages: { stageName: string; tasks: CoordinationTask[] }[],
    strategy: Partial<ExecutionStrategy> = {}
  ): Promise<PatternExecutionResult> {
    const executionId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting pipeline execution', {
      executionId,
      stageCount: stages.length,
      totalTasks: stages.reduce((sum, stage) => sum + stage.tasks.length, 0)
    });

    const allTasks = stages.flatMap(stage => stage.tasks);
    const context = await this.initializeExecution(
      executionId,
      'pipeline',
      allTasks,
      strategy
    );

    try {
      let pipelineData: Record<string, unknown> = {};
      
      // Execute stages sequentially
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        
        this.logger.info('Starting pipeline stage', {
          executionId,
          stageName: stage.stageName,
          stageIndex: i,
          taskCount: stage.tasks.length
        });

        // Enhance tasks with data from previous stages
        const enhancedTasks = stage.tasks.map(task => ({
          ...task,
          payload: {
            ...task.payload,
            pipelineData,
            stageIndex: i,
            stageName: stage.stageName
          }
        }));

        // Execute stage tasks in parallel
        const stageAllocations = await this.allocateAgentsForTasks(enhancedTasks, context.strategy);
        const stagePromises = enhancedTasks.map(task => 
          this.executeTaskWithAgent(task, stageAllocations.find(a => 
            a.assignedTasks.includes(task.id)
          )?.agent, context)
        );

        const stageResults = await Promise.all(stagePromises);
        const successfulStageResults = stageResults.filter(r => r.status === 'completed');

        // Check failure tolerance
        const failureRate = (stageResults.length - successfulStageResults.length) / stageResults.length;
        const maxFailureRate = (context.strategy.failureTolerance || 1) / stageResults.length;
        
        if (failureRate > maxFailureRate) {
          throw new Error(`Stage ${stage.stageName} exceeded failure tolerance: ${(failureRate * 100).toFixed(1)}%`);
        }

        // Aggregate stage results into pipeline data
        const stageOutput = successfulStageResults.reduce((acc, result) => {
          if (result.result) {
            return { ...acc, ...result.result };
          }
          return acc;
        }, {});

        pipelineData = {
          ...pipelineData,
          [stage.stageName]: stageOutput,
          [`${stage.stageName}_results`]: successfulStageResults
        };

        // Update context with stage results
        stageResults.forEach(result => {
          context.results.set(result.taskId, result);
        });

        stageAllocations.forEach(allocation => {
          context.allocatedAgents.set(allocation.agent.id, allocation.agent);
        });

        context.progress.completedTasks = Array.from(context.results.values()).filter(r => r.status === 'completed').length;
        context.progress.failedTasks = Array.from(context.results.values()).filter(r => r.status === 'failed').length;

        this.logger.info('Pipeline stage completed', {
          executionId,
          stageName: stage.stageName,
          successfulTasks: successfulStageResults.length,
          failedTasks: stageResults.length - successfulStageResults.length
        });
      }

      context.state = 'completed';
      context.sharedContext.pipelineOutput = pipelineData;

      const executionResult = await this.finalizeExecution(context, true, pipelineData);
      
      this.logger.info('Pipeline execution completed', {
        executionId,
        success: executionResult.success,
        stagesCompleted: stages.length,
        totalDuration: executionResult.summary.totalDuration
      });

      return executionResult;

    } catch (error) {
      this.logger.error('Pipeline execution failed', {
        executionId,
        error: error instanceof Error ? error.message : error
      });

      context.state = 'failed';
      return await this.finalizeExecution(context, false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Executes a fork-join pattern where tasks are forked into parallel branches
   * and then joined back together.
   * 
   * @param forkTasks - Tasks to fork into parallel execution
   * @param joinTask - Task to join results (optional)
   * @param strategy - Execution strategy
   * @returns Promise resolving to pattern execution result
   */
  async executeForkJoin(
    forkTasks: CoordinationTask[],
    joinTask?: CoordinationTask,
    strategy: Partial<ExecutionStrategy> = {}
  ): Promise<PatternExecutionResult> {
    const executionId = `fork_join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting fork-join execution', {
      executionId,
      forkTaskCount: forkTasks.length,
      hasJoinTask: !!joinTask
    });

    const allTasks = joinTask ? [...forkTasks, joinTask] : forkTasks;
    const context = await this.initializeExecution(
      executionId,
      'fork_join',
      allTasks,
      strategy
    );

    try {
      // Fork phase: Execute all fork tasks in parallel
      this.logger.info('Starting fork phase', { executionId });
      
      const forkAllocations = await this.allocateAgentsForTasks(forkTasks, context.strategy);
      const forkPromises = forkTasks.map(task => 
        this.executeTaskWithAgent(task, forkAllocations.find(a => 
          a.assignedTasks.includes(task.id)
        )?.agent, context)
      );

      const forkResults = await Promise.all(forkPromises);
      const successfulForkResults = forkResults.filter(r => r.status === 'completed');

      this.logger.info('Fork phase completed', {
        executionId,
        successfulTasks: successfulForkResults.length,
        failedTasks: forkResults.length - successfulForkResults.length
      });

      let joinResult: TaskResult | undefined;

      // Join phase: Execute join task if provided
      if (joinTask) {
        this.logger.info('Starting join phase', { executionId });

        const enhancedJoinTask: CoordinationTask = {
          ...joinTask,
          payload: {
            ...joinTask.payload,
            forkResults: successfulForkResults.map(r => r.result)
          }
        };

        const joinAllocation = await this.allocateAgentsForTasks([enhancedJoinTask], context.strategy);
        joinResult = await this.executeTaskWithAgent(
          enhancedJoinTask,
          joinAllocation[0]?.agent,
          context
        );

        this.logger.info('Join phase completed', {
          executionId,
          joinSuccess: joinResult.status === 'completed'
        });
      }

      // Combine all results
      const allResults = joinResult ? [...forkResults, joinResult] : forkResults;
      
      // Update context
      context.state = 'completed';
      context.progress.completedTasks = allResults.filter(r => r.status === 'completed').length;
      context.progress.failedTasks = allResults.filter(r => r.status === 'failed').length;

      allResults.forEach(result => {
        context.results.set(result.taskId, result);
      });

      forkAllocations.forEach(allocation => {
        context.allocatedAgents.set(allocation.agent.id, allocation.agent);
      });

      const executionResult = await this.finalizeExecution(
        context, 
        true, 
        joinResult ? joinResult.result : { forkResults: successfulForkResults }
      );
      
      this.logger.info('Fork-join execution completed', {
        executionId,
        success: executionResult.success,
        totalDuration: executionResult.summary.totalDuration
      });

      return executionResult;

    } catch (error) {
      this.logger.error('Fork-join execution failed', {
        executionId,
        error: error instanceof Error ? error.message : error
      });

      context.state = 'failed';
      return await this.finalizeExecution(context, false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Allocates agents for tasks based on capabilities and load balancing
   * 
   * @private
   */
  private async allocateAgentsForTasks(
    tasks: CoordinationTask[],
    strategy: ExecutionStrategy
  ): Promise<AgentAllocation[]> {
    const allocations: AgentAllocation[] = [];
    const agentTaskCounts = new Map<string, number>();

    for (const task of tasks) {
      // Find suitable agents based on capabilities
      const suitableAgents = await this.findSuitableAgents(task);
      
      if (suitableAgents.length === 0) {
        throw new Error(`No suitable agents found for task ${task.id}`);
      }

      // Apply allocation strategy
      const selectedAgent = this.selectAgentByStrategy(
        suitableAgents,
        strategy.resourceAllocation || 'load_balanced',
        agentTaskCounts
      );

      // Create allocation
      const currentTaskCount = agentTaskCounts.get(selectedAgent.id) || 0;
      agentTaskCounts.set(selectedAgent.id, currentTaskCount + 1);

      const allocation: AgentAllocation = {
        agent: selectedAgent,
        assignedTasks: [task.id],
        expectedLoad: this.calculateExpectedLoad(selectedAgent.id, currentTaskCount + 1),
        allocationScore: this.calculateAllocationScore(selectedAgent, task),
        rationale: `Selected based on ${strategy.resourceAllocation || 'load_balanced'} strategy`
      };

      allocations.push(allocation);
    }

    // Update load balancing information
    this.updateLoadBalancingInfo(allocations);

    return allocations;
  }

  /**
   * Finds agents suitable for a specific task
   * 
   * @private
   */
  private async findSuitableAgents(task: CoordinationTask): Promise<AgentProfile[]> {
    const suitableAgents: AgentProfile[] = [];

    // Get all active agents
    const allAgents = this.registry.getAllAgents();

    for (const agent of allAgents) {
      // Check if agent is active
      const status = this.registry.getAgentStatus(agent.id);
      if (status !== 'active' && status !== 'idle') {
        continue;
      }

      // Check role compatibility
      if (task.preferredRoles.length > 0 && !task.preferredRoles.includes(agent.role)) {
        continue;
      }

      // Check capability compatibility
      const hasRequiredCapabilities = task.requiredCapabilities.every(capability => 
        agent.tools.includes(capability) || agent.specialization.includes(capability)
      );

      if (hasRequiredCapabilities) {
        suitableAgents.push(agent);
      }
    }

    return suitableAgents;
  }

  /**
   * Selects an agent based on allocation strategy
   * 
   * @private
   */
  private selectAgentByStrategy(
    candidates: AgentProfile[],
    strategy: ExecutionStrategy['resourceAllocation'],
    currentAllocations: Map<string, number>
  ): AgentProfile {
    switch (strategy) {
      case 'load_balanced':
        return this.selectByLoadBalance(candidates, currentAllocations);
      
      case 'capability_based':
        return this.selectByCapabilities(candidates);
      
      case 'priority':
        return this.selectByPriority(candidates);
      
      case 'balanced':
      default:
        return this.selectByBalanced(candidates, currentAllocations);
    }
  }

  /**
   * Selects agent with lowest current load
   * 
   * @private
   */
  private selectByLoadBalance(
    candidates: AgentProfile[],
    currentAllocations: Map<string, number>
  ): AgentProfile {
    return candidates.reduce((best, current) => {
      const bestLoad = this.getCurrentAgentLoad(best.id, currentAllocations);
      const currentLoad = this.getCurrentAgentLoad(current.id, currentAllocations);
      
      return currentLoad < bestLoad ? current : best;
    });
  }

  /**
   * Selects agent with best capability match
   * 
   * @private
   */
  private selectByCapabilities(candidates: AgentProfile[]): AgentProfile {
    return candidates.reduce((best, current) => {
      const bestScore = best.tools.length + best.specialization.length;
      const currentScore = current.tools.length + current.specialization.length;
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Selects agent by priority/performance metrics
   * 
   * @private
   */
  private selectByPriority(candidates: AgentProfile[]): AgentProfile {
    return candidates.reduce((best, current) => {
      const bestActivity = best.lastActiveAt || 0;
      const currentActivity = current.lastActiveAt || 0;
      
      return currentActivity > bestActivity ? current : best;
    });
  }

  /**
   * Selects agent using balanced approach
   * 
   * @private
   */
  private selectByBalanced(
    candidates: AgentProfile[],
    currentAllocations: Map<string, number>
  ): AgentProfile {
    return candidates.reduce((best, current) => {
      const bestScore = this.calculateBalancedScore(best, currentAllocations);
      const currentScore = this.calculateBalancedScore(current, currentAllocations);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculates balanced score for agent selection
   * 
   * @private
   */
  private calculateBalancedScore(
    agent: AgentProfile,
    currentAllocations: Map<string, number>
  ): number {
    const loadFactor = 1.0 - (this.getCurrentAgentLoad(agent.id, currentAllocations) / 100);
    const capabilityFactor = (agent.tools.length + agent.specialization.length) / 20;
    const activityFactor = Math.min((Date.now() - agent.lastActiveAt) / (1000 * 60 * 60), 1); // Last hour
    
    return (loadFactor * 0.5) + (capabilityFactor * 0.3) + (activityFactor * 0.2);
  }

  /**
   * Gets current agent load including new allocations
   * 
   * @private
   */
  private getCurrentAgentLoad(agentId: string, newAllocations: Map<string, number>): number {
    const baseLoad = this.loadBalancingInfo.get(agentId)?.currentLoad || 0;
    const newTasks = newAllocations.get(agentId) || 0;
    
    return baseLoad + (newTasks * 10); // Estimate 10% load per task
  }

  /**
   * Calculates expected load after allocation
   * 
   * @private
   */
  private calculateExpectedLoad(agentId: string, taskCount: number): number {
    const baseInfo = this.loadBalancingInfo.get(agentId);
    const baseLoad = baseInfo?.currentLoad || 0;
    
    return Math.min(baseLoad + (taskCount * 10), 100);
  }

  /**
   * Calculates allocation score for agent-task pair
   * 
   * @private
   */
  private calculateAllocationScore(agent: AgentProfile, task: CoordinationTask): number {
    let score = 0;
    
    // Role match score
    if (task.preferredRoles.includes(agent.role)) {
      score += 0.4;
    }
    
    // Capability match score
    const matchedCapabilities = task.requiredCapabilities.filter(cap => 
      agent.tools.includes(cap) || agent.specialization.includes(cap)
    ).length;
    
    score += (matchedCapabilities / task.requiredCapabilities.length) * 0.4;
    
    // Load score (inverse - lower load is better)
    const loadInfo = this.loadBalancingInfo.get(agent.id);
    if (loadInfo) {
      score += (100 - loadInfo.currentLoad) / 100 * 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Executes a task with a specific agent
   * 
   * @private
   */
  private async executeTaskWithAgent(
    task: CoordinationTask,
    agent: AgentProfile | undefined,
    context: ExecutionContext
  ): Promise<TaskResult> {
    if (!agent) {
      return {
        taskId: task.id,
        agentId: 'unknown',
        status: 'failed',
        error: 'No agent allocated for task',
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          executionTime: 0
        }
      };
    }

    const startTime = Date.now();

    try {
      // Create task message
      const taskMessage: AgentMessage = {
        id: `task_${task.id}_${Date.now()}`,
        fromAgentId: 'coordinator',
        toAgentId: agent.id,
        type: 'collaboration',
        content: `Execute coordination task: ${task.type}`,
        data: {
          task,
          executionId: context.executionId,
          patternType: context.patternType,
          sharedContext: context.sharedContext
        },
        timestamp: Date.now(),
        priority: task.priority
      };

      // Send task to agent
      const sendResult = await this.communicationHub.sendMessage('coordinator', agent.id, taskMessage);
      
      if (!sendResult.success) {
        throw new Error(`Failed to send task to agent: ${sendResult.error}`);
      }

      // Wait for task completion (simplified - in real implementation, this would involve proper message handling)
      await this.waitForTaskCompletion(task.id, context.strategy.taskTimeout || this.config.defaultTaskTimeout);

      // Simulate task result (in real implementation, this would come from agent response)
      const executionTime = Date.now() - startTime;
      
      return {
        taskId: task.id,
        agentId: agent.id,
        status: 'completed',
        result: {
          taskType: task.type,
          executedBy: agent.id,
          executionTime,
          // Add simulated task-specific results
          output: `Task ${task.id} completed successfully`
        },
        metrics: {
          startTime,
          endTime: Date.now(),
          executionTime,
          memoryUsed: Math.floor(Math.random() * 1000), // Simulated
          cpuTime: executionTime * 0.8 // Simulated
        },
        metadata: {
          agent: agent.id,
          pattern: context.patternType
        }
      };

    } catch (error) {
      this.logger.error('Task execution failed', {
        taskId: task.id,
        agentId: agent.id,
        error: error instanceof Error ? error.message : error
      });

      return {
        taskId: task.id,
        agentId: agent.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          startTime,
          endTime: Date.now(),
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Waits for task completion with timeout
   * 
   * @private
   */
  private async waitForTaskCompletion(taskId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
      }, timeout);

      // Simulate async task completion
      const executionTime = Math.random() * Math.min(timeout * 0.5, 5000);
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, executionTime);
    });
  }

  /**
   * Initializes execution context
   * 
   * @private
   */
  private async initializeExecution(
    executionId: string,
    patternType: CoordinationPatternType,
    tasks: CoordinationTask[],
    strategyPartial: Partial<ExecutionStrategy>
  ): Promise<ExecutionContext> {
    const strategy: ExecutionStrategy = {
      maxConcurrency: 10,
      taskTimeout: this.config.defaultTaskTimeout,
      patternTimeout: this.config.defaultPatternTimeout,
      failureTolerance: 1,
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      resourceAllocation: 'load_balanced',
      adaptiveOptimization: true,
      ...strategyPartial
    };

    const context: ExecutionContext = {
      executionId,
      patternType,
      tasks,
      strategy,
      sharedContext: {},
      startTime: Date.now(),
      state: 'initializing',
      progress: {
        totalTasks: tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        runningTasks: 0
      },
      allocatedAgents: new Map(),
      results: new Map()
    };

    this.activeExecutions.set(executionId, context);
    
    // Emit execution started event
    this.executionEventStream.next({
      id: `execution_started_${executionId}`,
      type: 'task_delegated',
      agentId: 'coordinator',
      payload: {
        executionId,
        patternType,
        taskCount: tasks.length
      },
      timestamp: Date.now(),
      priority: 'medium'
    });

    context.state = 'executing';
    return context;
  }

  /**
   * Finalizes execution and calculates results
   * 
   * @private
   */
  private async finalizeExecution(
    context: ExecutionContext,
    success: boolean,
    aggregatedResult?: Record<string, unknown>,
    error?: string
  ): Promise<PatternExecutionResult> {
    const endTime = Date.now();
    const totalDuration = endTime - context.startTime;
    
    const results = Array.from(context.results.values());
    const successfulResults = results.filter(r => r.status === 'completed');
    const failedResults = results.filter(r => r.status === 'failed');

    // Calculate performance metrics
    const agentUtilization = new Map<string, number>();
    for (const [agentId] of context.allocatedAgents) {
      const agentResults = results.filter(r => r.agentId === agentId);
      const totalAgentTime = agentResults.reduce((sum, r) => sum + r.metrics.executionTime, 0);
      agentUtilization.set(agentId, totalAgentTime / totalDuration);
    }

    const avgExecutionTime = successfulResults.length > 0 ? 
      successfulResults.reduce((sum, r) => sum + r.metrics.executionTime, 0) / successfulResults.length : 0;

    const throughput = results.length / (totalDuration / 1000); // Tasks per second
    
    const resourceEfficiency = successfulResults.length / Math.max(context.allocatedAgents.size, 1);
    const parallelismFactor = context.progress.totalTasks / Math.max(context.allocatedAgents.size, 1);
    const scalabilityIndex = throughput * resourceEfficiency;

    // Update performance metrics
    this.performanceMetrics.totalExecutions++;
    if (success) {
      this.performanceMetrics.successfulExecutions++;
    } else {
      this.performanceMetrics.failedExecutions++;
    }
    this.performanceMetrics.avgExecutionTime = 
      (this.performanceMetrics.avgExecutionTime + totalDuration) / 2;
    this.performanceMetrics.totalTasksProcessed += results.length;

    const executionResult: PatternExecutionResult = {
      context,
      success,
      results,
      summary: {
        totalDuration,
        successfulTasks: successfulResults.length,
        failedTasks: failedResults.length,
        avgExecutionTime,
        throughput
      },
      performanceMetrics: {
        agentUtilization,
        resourceEfficiency,
        parallelismFactor,
        scalabilityIndex
      },
      error
    };

    // Add aggregated result if provided
    if (aggregatedResult) {
      context.sharedContext.aggregatedResult = aggregatedResult;
    }

    // Clean up
    this.activeExecutions.delete(context.executionId);

    // Emit execution completed event
    this.executionEventStream.next({
      id: `execution_completed_${context.executionId}`,
      type: 'task_delegated',
      agentId: 'coordinator',
      payload: {
        executionId: context.executionId,
        success,
        totalDuration,
        taskCount: results.length,
        successfulTasks: successfulResults.length
      },
      timestamp: Date.now(),
      priority: 'medium'
    });

    return executionResult;
  }

  /**
   * Updates load balancing information for allocated agents
   * 
   * @private
   */
  private updateLoadBalancingInfo(allocations: AgentAllocation[]): void {
    for (const allocation of allocations) {
      const existing = this.loadBalancingInfo.get(allocation.agent.id) || {
        agentId: allocation.agent.id,
        currentLoad: 0,
        queueSize: 0,
        avgResponseTime: 0,
        successRate: 1.0,
        capacityScore: 1.0,
        lastUpdated: Date.now()
      };

      const updated: LoadBalancingInfo = {
        ...existing,
        currentLoad: allocation.expectedLoad,
        queueSize: existing.queueSize + allocation.assignedTasks.length,
        lastUpdated: Date.now()
      };

      this.loadBalancingInfo.set(allocation.agent.id, updated);
    }
  }

  /**
   * Initializes load balancing monitoring
   * 
   * @private
   */
  private initializeLoadBalancing(): void {
    setInterval(() => {
      this.updateLoadBalancingMetrics();
    }, this.config.loadBalancingInterval);

    this.logger.info('Load balancing monitoring initialized');
  }

  /**
   * Updates load balancing metrics
   * 
   * @private
   */
  private updateLoadBalancingMetrics(): void {
    const allAgents = this.registry.getAllAgents();
    
    for (const agent of allAgents) {
      const existing = this.loadBalancingInfo.get(agent.id);
      
      if (!existing) {
        // Initialize new agent
        this.loadBalancingInfo.set(agent.id, {
          agentId: agent.id,
          currentLoad: 0,
          queueSize: 0,
          avgResponseTime: 0,
          successRate: 1.0,
          capacityScore: 1.0,
          lastUpdated: Date.now()
        });
      } else {
        // Decay load over time (simulated)
        const timeSinceUpdate = Date.now() - existing.lastUpdated;
        const decayFactor = Math.exp(-timeSinceUpdate / (60 * 1000)); // Decay over 1 minute
        
        const updated: LoadBalancingInfo = {
          ...existing,
          currentLoad: Math.max(0, existing.currentLoad * decayFactor),
          queueSize: Math.max(0, Math.floor(existing.queueSize * decayFactor)),
          lastUpdated: Date.now()
        };
        
        this.loadBalancingInfo.set(agent.id, updated);
      }
    }
  }

  /**
   * Initializes performance monitoring
   * 
   * @private
   */
  private initializePerformanceMonitoring(): void {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.performanceMetricsInterval);

    this.logger.info('Performance monitoring initialized');
  }

  /**
   * Updates performance metrics
   * 
   * @private
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    const timeDiff = now - this.performanceMetrics.lastMetricsUpdate;
    
    if (timeDiff > 0) {
      this.performanceMetrics.throughputPerSecond = 
        this.performanceMetrics.totalTasksProcessed / (timeDiff / 1000);
    }
    
    this.performanceMetrics.lastMetricsUpdate = now;
    
    this.logger.debug('Performance metrics updated', {
      totalExecutions: this.performanceMetrics.totalExecutions,
      successRate: this.performanceMetrics.successfulExecutions / Math.max(this.performanceMetrics.totalExecutions, 1),
      avgExecutionTime: this.performanceMetrics.avgExecutionTime,
      throughput: this.performanceMetrics.throughputPerSecond
    });
  }

  /**
   * Gets current system performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Gets load balancing information for all agents
   */
  getLoadBalancingInfo(): Map<string, LoadBalancingInfo> {
    return new Map(this.loadBalancingInfo);
  }

  /**
   * Gets active executions
   */
  getActiveExecutions(): Map<string, ExecutionContext> {
    return new Map(this.activeExecutions);
  }

  /**
   * Subscribes to execution events
   */
  subscribeToExecutionEvents(): Observable<AgentEvent> {
    return this.executionEventStream.asObservable();
  }

  /**
   * Cancels an active execution
   */
  async cancelExecution(executionId: string): Promise<RegistryOperationResult> {
    const context = this.activeExecutions.get(executionId);
    
    if (!context) {
      return {
        success: false,
        error: `Execution ${executionId} not found`,
        executionTime: 0
      };
    }

    context.state = 'cancelled';
    this.activeExecutions.delete(executionId);

    this.logger.info('Execution cancelled', { executionId });

    return {
      success: true,
      metadata: { executionId, cancelledAt: Date.now() },
      executionTime: 0
    };
  }

  /**
   * Shuts down the coordination patterns system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down CoordinationPatterns system');

    // Cancel all active executions
    for (const executionId of this.activeExecutions.keys()) {
      await this.cancelExecution(executionId);
    }

    // Complete event streams
    this.executionEventStream.complete();

    // Clear data structures
    this.loadBalancingInfo.clear();

    this.logger.info('CoordinationPatterns system shutdown complete');
  }
}