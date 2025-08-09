import { Observable, Subject, merge } from 'rxjs';
import { filter, map, catchError } from 'rxjs/operators';
import { 
  AgentProfile, 
  AgentMessage,
  AgentRole,
  TaskDelegation,
  MultiAgentState,
  GraphState
} from './types.js';
import {
  AgentRegistry,
  AgentCommunicationHub,
  AgentEvent,
  RegistryOperationResult
} from './agent-registry.js';
import { MultiAgentSystem } from './multi-agent-system.js';
import { CoordinationPatterns, CoordinationTask, ExecutionStrategy } from './coordination-patterns.js';
import { DistributedCoordination, DistributedLockConfig, SemaphoreConfig } from './distributed-coordination.js';
import { EventDrivenArchitecture, DomainEvent, EventSubscription } from './event-driven-architecture.js';
import { ConflictResolution, DistributedTransaction } from './conflict-resolution.js';
import { PerformanceScalability, CircuitBreakerConfig, BulkheadConfig } from './performance-scalability.js';
import { ProductionMonitoring, ConfigurationManager } from './production-monitoring.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Coordination integration configuration
 */
export interface CoordinationIntegrationConfig {
  /**
   * Enable coordination patterns
   */
  enableCoordinationPatterns: boolean;
  
  /**
   * Enable distributed coordination
   */
  enableDistributedCoordination: boolean;
  
  /**
   * Enable event-driven architecture
   */
  enableEventDriven: boolean;
  
  /**
   * Enable conflict resolution
   */
  enableConflictResolution: boolean;
  
  /**
   * Enable performance and scalability features
   */
  enablePerformanceScalability: boolean;
  
  /**
   * Default execution strategy
   */
  defaultExecutionStrategy: Partial<ExecutionStrategy>;
  
  /**
   * Circuit breaker defaults
   */
  defaultCircuitBreakerConfig: Partial<CircuitBreakerConfig>;
  
  /**
   * Bulkhead defaults
   */
  defaultBulkheadConfig: Partial<BulkheadConfig>;
  
  /**
   * Integration monitoring
   */
  enableMonitoring: boolean;
  
  /**
   * Auto-healing capabilities
   */
  enableAutoHealing: boolean;
  
  /**
   * Production monitoring configuration
   */
  productionMonitoring: {
    enabled: boolean;
    metricsCollectionInterval: number;
    alertEvaluationInterval: number;
    enableDetailedTracing: boolean;
    enablePerformanceAnalytics: boolean;
    enablePredictiveAnalytics: boolean;
  };
  
  /**
   * Configuration management
   */
  configurationManagement: {
    enabled: boolean;
    hotReloadEnabled: boolean;
    validationEnabled: boolean;
  };
  
  /**
   * Advanced logging
   */
  advancedLogging: {
    enabled: boolean;
    logLevel: LogLevel;
    structuredLogging: boolean;
    auditLogging: boolean;
  };
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  /**
   * Workflow identifier
   */
  workflowId: string;
  
  /**
   * Graph state
   */
  graphState: GraphState;
  
  /**
   * Coordination patterns instance
   */
  coordinationPatterns: CoordinationPatterns;
  
  /**
   * Distributed coordination instance
   */
  distributedCoordination: DistributedCoordination;
  
  /**
   * Event-driven architecture instance
   */
  eventDriven: EventDrivenArchitecture;
  
  /**
   * Conflict resolution instance
   */
  conflictResolution: ConflictResolution;
  
  /**
   * Performance scalability instance
   */
  performanceScalability: PerformanceScalability;
  
  /**
   * Multi-agent system instance
   */
  multiAgentSystem: MultiAgentSystem;
  
  /**
   * Execution metrics
   */
  metrics: {
    startTime: number;
    tasksCompleted: number;
    conflictsResolved: number;
    circuitBreakersTriggered: number;
    eventsProcessed: number;
  };
}

/**
 * Enhanced workflow step with coordination features
 */
export interface EnhancedWorkflowStep {
  /**
   * Step identifier
   */
  id: string;
  
  /**
   * Step name
   */
  name: string;
  
  /**
   * Coordination pattern to use
   */
  coordinationPattern?: 'scatter_gather' | 'map_reduce' | 'pipeline' | 'fork_join';
  
  /**
   * Required capabilities
   */
  requiredCapabilities: string[];
  
  /**
   * Preferred agent roles
   */
  preferredRoles: AgentRole[];
  
  /**
   * Execution strategy
   */
  executionStrategy: ExecutionStrategy;
  
  /**
   * Circuit breaker configuration
   */
  circuitBreakerConfig?: CircuitBreakerConfig;
  
  /**
   * Bulkhead configuration
   */
  bulkheadConfig?: BulkheadConfig;
  
  /**
   * Required locks
   */
  requiredLocks?: DistributedLockConfig[];
  
  /**
   * Required semaphores
   */
  requiredSemaphores?: SemaphoreConfig[];
  
  /**
   * Event subscriptions
   */
  eventSubscriptions?: EventSubscription[];
  
  /**
   * Transaction requirements
   */
  transactionConfig?: {
    isolationLevel: 'read_committed' | 'repeatable_read' | 'serializable';
    timeout: number;
    participants: string[];
  };
  
  /**
   * Step dependencies
   */
  dependencies: string[];
  
  /**
   * Retry configuration
   */
  retryConfig: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  
  /**
   * Failure handling
   */
  failureHandling: {
    strategy: 'retry' | 'compensate' | 'escalate' | 'ignore';
    compensationAction?: (context: WorkflowExecutionContext) => Promise<void>;
  };
}

/**
 * Comprehensive coordination integration system that brings together all
 * coordination patterns, distributed systems features, and multi-agent
 * capabilities into a unified workflow execution environment.
 */
export class CoordinationIntegration {
  private readonly logger = createLogger(LogLevel.INFO, 'CoordinationIntegration');
  
  /**
   * Multi-agent system
   */
  public readonly multiAgentSystem: MultiAgentSystem;
  
  /**
   * Coordination patterns
   */
  public readonly coordinationPatterns: CoordinationPatterns;
  
  /**
   * Distributed coordination
   */
  public readonly distributedCoordination: DistributedCoordination;
  
  /**
   * Event-driven architecture
   */
  public readonly eventDriven: EventDrivenArchitecture;
  
  /**
   * Conflict resolution
   */
  public readonly conflictResolution: ConflictResolution;
  
  /**
   * Performance scalability
   */
  public readonly performanceScalability: PerformanceScalability;
  
  /**
   * Integration configuration
   */
  private readonly config: CoordinationIntegrationConfig;
  
  /**
   * Active workflow contexts
   */
  private readonly activeWorkflows = new Map<string, WorkflowExecutionContext>();
  
  /**
   * Integration event stream
   */
  private readonly integrationEventStream = new Subject<AgentEvent>();
  
  /**
   * System health monitoring
   */
  private readonly healthMonitor = {
    lastHealthCheck: 0,
    systemHealth: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    componentHealth: new Map<string, 'healthy' | 'degraded' | 'unhealthy'>(),
    healthCheckInterval: 30000 // 30 seconds
  };
  
  /**
   * Production monitoring system
   */
  private readonly productionMonitoring: ProductionMonitoring;
  
  /**
   * Configuration manager
   */
  private readonly configurationManager: ConfigurationManager;

  constructor(
    multiAgentSystem: MultiAgentSystem,
    config?: Partial<CoordinationIntegrationConfig>
  ) {
    this.multiAgentSystem = multiAgentSystem;
    
    this.config = {
      enableCoordinationPatterns: true,
      enableDistributedCoordination: true,
      enableEventDriven: true,
      enableConflictResolution: true,
      enablePerformanceScalability: true,
      defaultExecutionStrategy: {
        maxConcurrency: 10,
        taskTimeout: 60000,
        patternTimeout: 300000,
        failureTolerance: 1,
        retryConfig: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 1000
        },
        resourceAllocation: 'load_balanced',
        adaptiveOptimization: true
      },
      defaultCircuitBreakerConfig: {
        failureThreshold: 50,
        successThreshold: 10,
        timeout: 60000,
        monitoringWindowSize: 100,
        minimumRequestThreshold: 10,
        slowCallThreshold: 50,
        slowCallDurationThreshold: 5000
      },
      defaultBulkheadConfig: {
        strategy: 'thread_pool',
        maxConcurrentOperations: 20,
        queueSize: 100,
        operationTimeout: 30000,
        queueTimeout: 10000
      },
      enableMonitoring: true,
      enableAutoHealing: true,
      productionMonitoring: {
        enabled: true,
        metricsCollectionInterval: 10000,
        alertEvaluationInterval: 15000,
        enableDetailedTracing: false,
        enablePerformanceAnalytics: true,
        enablePredictiveAnalytics: false
      },
      configurationManagement: {
        enabled: true,
        hotReloadEnabled: true,
        validationEnabled: true
      },
      advancedLogging: {
        enabled: true,
        logLevel: LogLevel.INFO,
        structuredLogging: true,
        auditLogging: true
      },
      ...config
    };
    
    // Initialize coordination systems
    this.coordinationPatterns = new CoordinationPatterns(
      this.multiAgentSystem.registry,
      this.multiAgentSystem.communicationHub
    );
    
    this.distributedCoordination = new DistributedCoordination(
      this.multiAgentSystem.registry,
      this.multiAgentSystem.communicationHub
    );
    
    this.eventDriven = new EventDrivenArchitecture(
      this.multiAgentSystem.registry,
      this.multiAgentSystem.communicationHub
    );
    
    this.conflictResolution = new ConflictResolution(
      this.multiAgentSystem.registry,
      this.multiAgentSystem.communicationHub
    );
    
    this.performanceScalability = new PerformanceScalability(
      this.multiAgentSystem.registry,
      this.multiAgentSystem.communicationHub
    );
    
    // Initialize production monitoring
    this.productionMonitoring = new ProductionMonitoring({
      metricsCollectionInterval: this.config.productionMonitoring.metricsCollectionInterval,
      alertEvaluationInterval: this.config.productionMonitoring.alertEvaluationInterval,
      enableDetailedTracing: this.config.productionMonitoring.enableDetailedTracing,
      enablePerformanceAnalytics: this.config.productionMonitoring.enablePerformanceAnalytics,
      enablePredictiveAnalytics: this.config.productionMonitoring.enablePredictiveAnalytics,
      dataRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxHistorySize: 10000,
      alertThresholds: {
        unhealthyComponentThreshold: 2,
        failureRateThreshold: 0.1,
        averageResponseTimeThreshold: 30000,
        activeWorkflowThreshold: 100,
        memoryUsageThreshold: 0.85,
        cpuUsageThreshold: 0.8
      }
    });
    
    // Initialize configuration manager
    this.configurationManager = new ConfigurationManager(this.config as Record<string, any>);
    
    this.initializeIntegration();
    
    this.logger.info('CoordinationIntegration system initialized', { config: this.config });
  }

  /**
   * Executes an enhanced workflow with full coordination capabilities
   * 
   * @param workflowId - Workflow identifier
   * @param steps - Workflow steps with coordination features
   * @param initialGraphState - Initial graph state
   * @returns Promise resolving to execution result
   */
  async executeWorkflow(
    workflowId: string,
    steps: EnhancedWorkflowStep[],
    initialGraphState: GraphState
  ): Promise<{
    success: boolean;
    results: Map<string, unknown>;
    metrics: WorkflowExecutionContext['metrics'];
    error?: string;
  }> {
    const context: WorkflowExecutionContext = {
      workflowId,
      graphState: initialGraphState,
      coordinationPatterns: this.coordinationPatterns,
      distributedCoordination: this.distributedCoordination,
      eventDriven: this.eventDriven,
      conflictResolution: this.conflictResolution,
      performanceScalability: this.performanceScalability,
      multiAgentSystem: this.multiAgentSystem,
      metrics: {
        startTime: Date.now(),
        tasksCompleted: 0,
        conflictsResolved: 0,
        circuitBreakersTriggered: 0,
        eventsProcessed: 0
      }
    };
    
    this.activeWorkflows.set(workflowId, context);
    
    // Start tracing if enabled
    let traceId: string = '';
    if (this.config.productionMonitoring.enabled && this.config.productionMonitoring.enableDetailedTracing) {
      traceId = this.productionMonitoring.startTrace(`workflow_execution_${workflowId}`);
      this.productionMonitoring.addTraceLog(traceId, 'info', 'Workflow execution started', {
        workflowId,
        stepCount: steps.length,
        initialState: initialGraphState
      });
    }
    
    try {
      this.logger.info('Starting enhanced workflow execution', {
        workflowId,
        stepCount: steps.length
      });
      
      const results = new Map<string, unknown>();
      
      // Execute steps with coordination features
      for (const step of steps) {
        const stepResult = await this.executeWorkflowStep(context, step);
        results.set(step.id, stepResult);
        context.metrics.tasksCompleted++;
      }
      
      const totalDuration = Date.now() - context.metrics.startTime;
      
      this.logger.info('Workflow execution completed', {
        workflowId,
        totalDuration,
        tasksCompleted: context.metrics.tasksCompleted,
        conflictsResolved: context.metrics.conflictsResolved
      });
      
      // Record successful workflow execution metrics
      if (this.config.productionMonitoring.enabled) {
        this.productionMonitoring.recordWorkflowExecution(
          workflowId,
          context.metrics.startTime,
          Date.now(),
          true, // successful
          context.metrics.tasksCompleted,
          [], // no errors
          {
            conflictsResolved: context.metrics.conflictsResolved,
            circuitBreakersTriggered: context.metrics.circuitBreakersTriggered,
            eventsProcessed: context.metrics.eventsProcessed
          }
        );
        
        if (traceId) {
          this.productionMonitoring.addTraceLog(traceId, 'info', 'Workflow execution completed successfully', {
            completedSteps: results.size,
            duration: totalDuration,
            metrics: context.metrics
          });
        }
      }
      
      this.emitIntegrationEvent({
        id: `workflow_completed_${workflowId}`,
        type: 'task_delegated',
        agentId: 'coordination_system',
        payload: {
          workflowId,
          success: true,
          duration: totalDuration,
          metrics: context.metrics
        },
        timestamp: Date.now(),
        priority: 'medium'
      });
      
      return {
        success: true,
        results,
        metrics: context.metrics
      };
      
    } catch (error) {
      this.logger.error('Workflow execution failed', {
        workflowId,
        error: error instanceof Error ? error.message : error
      });
      
      // Record error in production monitoring
      if (this.config.productionMonitoring.enabled) {
        this.productionMonitoring.recordError('coordination_integration', error, 'high', {
          workflowId,
          stepCount: steps.length,
          metrics: context.metrics
        });
        
        if (traceId) {
          this.productionMonitoring.addTraceLog(traceId, 'error', 'Workflow execution failed', {
            error: error instanceof Error ? error.message : error,
            metrics: context.metrics
          });
        }
      }
      
      this.emitIntegrationEvent({
        id: `workflow_failed_${workflowId}`,
        type: 'task_delegated',
        agentId: 'coordination_system',
        payload: {
          workflowId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metrics: context.metrics
        },
        timestamp: Date.now(),
        priority: 'high'
      });
      
      // Record workflow execution metrics
      if (this.config.productionMonitoring.enabled) {
        this.productionMonitoring.recordWorkflowExecution(
          workflowId,
          context.metrics.startTime,
          Date.now(),
          false, // failed
          context.metrics.tasksCompleted,
          [error instanceof Error ? error.message : String(error)],
          {
            conflictsResolved: context.metrics.conflictsResolved,
            circuitBreakersTriggered: context.metrics.circuitBreakersTriggered,
            eventsProcessed: context.metrics.eventsProcessed
          }
        );
      }
      
      return {
        success: false,
        results: new Map(),
        metrics: context.metrics,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
    } finally {
      // Complete trace
      if (this.config.productionMonitoring.enabled && traceId) {
        this.productionMonitoring.completeTrace(traceId);
      }
      
      this.activeWorkflows.delete(workflowId);
    }
  }

  /**
   * Executes a single workflow step with coordination features
   * 
   * @private
   */
  private async executeWorkflowStep(
    context: WorkflowExecutionContext,
    step: EnhancedWorkflowStep
  ): Promise<unknown> {
    this.logger.info('Executing workflow step', {
      workflowId: context.workflowId,
      stepId: step.id,
      stepName: step.name
    });
    
    try {
      // Acquire required locks
      const lockAcquisitions = await this.acquireRequiredLocks(step);
      
      // Acquire required semaphores
      const semaphoreAcquisitions = await this.acquireRequiredSemaphores(step);
      
      // Begin transaction if required
      let transactionId: string | undefined;
      if (step.transactionConfig) {
        transactionId = await this.conflictResolution.beginTransaction(
          'workflow_coordinator',
          step.transactionConfig.participants,
          step.transactionConfig.isolationLevel,
          step.transactionConfig.timeout
        );
      }
      
      try {
        // Create circuit breaker if configured
        let circuitBreakerId: string | undefined;
        if (step.circuitBreakerConfig) {
          const config = { ...this.config.defaultCircuitBreakerConfig, ...step.circuitBreakerConfig };
          circuitBreakerId = this.performanceScalability.createCircuitBreaker(config);
        }
        
        // Create bulkhead if configured
        let bulkheadId: string | undefined;
        if (step.bulkheadConfig) {
          const config = { ...this.config.defaultBulkheadConfig, ...step.bulkheadConfig };
          bulkheadId = this.performanceScalability.createBulkhead(config);
        }
        
        // Execute step based on coordination pattern
        let result: unknown;
        
        if (step.coordinationPattern) {
          result = await this.executeWithCoordinationPattern(context, step);
        } else {
          result = await this.executeSimpleStep(context, step, circuitBreakerId, bulkheadId);
        }
        
        // Commit transaction if successful
        if (transactionId) {
          await this.conflictResolution.commitTransaction(transactionId);
        }
        
        return result;
        
      } catch (error) {
        // Abort transaction on failure
        if (transactionId) {
          await this.conflictResolution.abortTransaction(transactionId);
        }
        
        // Handle failure based on strategy
        await this.handleStepFailure(context, step, error);
        
        throw error;
        
      } finally {
        // Release locks and semaphores
        await this.releaseAcquiredResources(lockAcquisitions, semaphoreAcquisitions);
      }
      
    } catch (error) {
      // Apply failure handling strategy
      if (step.failureHandling.strategy === 'retry') {
        return this.retryStepExecution(context, step, error);
      } else if (step.failureHandling.strategy === 'compensate' && step.failureHandling.compensationAction) {
        await step.failureHandling.compensationAction(context);
        throw error;
      } else if (step.failureHandling.strategy === 'ignore') {
        this.logger.warn('Ignoring step failure', {
          stepId: step.id,
          error: error instanceof Error ? error.message : error
        });
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Executes a step using coordination patterns
   * 
   * @private
   */
  private async executeWithCoordinationPattern(
    context: WorkflowExecutionContext,
    step: EnhancedWorkflowStep
  ): Promise<unknown> {
    // Create coordination tasks
    const tasks: CoordinationTask[] = [{
      id: `task_${step.id}`,
      type: step.name,
      payload: { 
        stepId: step.id,
        workflowId: context.workflowId,
        graphState: context.graphState
      },
      requiredCapabilities: step.requiredCapabilities,
      preferredRoles: step.preferredRoles,
      dependencies: step.dependencies,
      priority: 'medium',
      estimatedDuration: step.executionStrategy.taskTimeout
    }];
    
    switch (step.coordinationPattern) {
      case 'scatter_gather':
        const scatterResult = await this.coordinationPatterns.executeScatterGather(
          tasks,
          step.executionStrategy
        );
        return scatterResult;
        
      case 'map_reduce':
        // Split tasks into map and reduce phases
        const mapTasks = tasks.slice(0, Math.ceil(tasks.length / 2));
        const reduceTasks = tasks.slice(Math.ceil(tasks.length / 2));
        
        const mapReduceResult = await this.coordinationPatterns.executeMapReduce(
          mapTasks,
          reduceTasks,
          step.executionStrategy
        );
        return mapReduceResult;
        
      case 'pipeline':
        const stages = [{ stageName: step.name, tasks }];
        const pipelineResult = await this.coordinationPatterns.executePipeline(
          stages,
          step.executionStrategy
        );
        return pipelineResult;
        
      case 'fork_join':
        const forkJoinResult = await this.coordinationPatterns.executeForkJoin(
          tasks,
          undefined,
          step.executionStrategy
        );
        return forkJoinResult;
        
      default:
        throw new Error(`Unsupported coordination pattern: ${step.coordinationPattern}`);
    }
  }

  /**
   * Executes a simple step with circuit breaker and bulkhead
   * 
   * @private
   */
  private async executeSimpleStep(
    context: WorkflowExecutionContext,
    step: EnhancedWorkflowStep,
    circuitBreakerId?: string,
    bulkheadId?: string
  ): Promise<unknown> {
    const stepOperation = async () => {
      // Simulate step execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      return {
        stepId: step.id,
        workflowId: context.workflowId,
        executedAt: Date.now(),
        result: `Step ${step.name} completed successfully`
      };
    };
    
    // Execute with circuit breaker if configured
    if (circuitBreakerId && step.circuitBreakerConfig) {
      const circuitBreakerConfig = { ...this.config.defaultCircuitBreakerConfig, ...step.circuitBreakerConfig };
      
      if (bulkheadId && step.bulkheadConfig) {
        const bulkheadConfig = { ...this.config.defaultBulkheadConfig, ...step.bulkheadConfig };
        
        return this.performanceScalability.executeWithBulkhead(
          bulkheadId,
          () => this.performanceScalability.executeWithCircuitBreaker(
            circuitBreakerId,
            stepOperation,
            circuitBreakerConfig
          ),
          bulkheadConfig
        );
      } else {
        return this.performanceScalability.executeWithCircuitBreaker(
          circuitBreakerId,
          stepOperation,
          circuitBreakerConfig
        );
      }
    } else if (bulkheadId && step.bulkheadConfig) {
      const bulkheadConfig = { ...this.config.defaultBulkheadConfig, ...step.bulkheadConfig };
      return this.performanceScalability.executeWithBulkhead(
        bulkheadId,
        stepOperation,
        bulkheadConfig
      );
    }
    
    return stepOperation();
  }

  /**
   * Acquires required locks for a step
   * 
   * @private
   */
  private async acquireRequiredLocks(step: EnhancedWorkflowStep): Promise<string[]> {
    const acquisitions: string[] = [];
    
    if (step.requiredLocks) {
      for (const lockConfig of step.requiredLocks) {
        const success = await this.distributedCoordination.acquireLock(
          'workflow_coordinator',
          lockConfig,
          'blocking'
        );
        
        if (success) {
          acquisitions.push(lockConfig.lockId);
        } else {
          throw new Error(`Failed to acquire lock: ${lockConfig.lockId}`);
        }
      }
    }
    
    return acquisitions;
  }

  /**
   * Acquires required semaphores for a step
   * 
   * @private
   */
  private async acquireRequiredSemaphores(step: EnhancedWorkflowStep): Promise<string[]> {
    const acquisitions: string[] = [];
    
    if (step.requiredSemaphores) {
      for (const semaphoreConfig of step.requiredSemaphores) {
        const success = await this.distributedCoordination.acquireSemaphore(
          'workflow_coordinator',
          semaphoreConfig
        );
        
        if (success) {
          acquisitions.push(semaphoreConfig.semaphoreId);
        } else {
          throw new Error(`Failed to acquire semaphore: ${semaphoreConfig.semaphoreId}`);
        }
      }
    }
    
    return acquisitions;
  }

  /**
   * Releases acquired resources
   * 
   * @private
   */
  private async releaseAcquiredResources(
    lockAcquisitions: string[],
    semaphoreAcquisitions: string[]
  ): Promise<void> {
    // Release locks
    for (const lockId of lockAcquisitions) {
      try {
        await this.distributedCoordination.releaseLock('workflow_coordinator', lockId);
      } catch (error) {
        this.logger.warn('Failed to release lock', {
          lockId,
          error: error instanceof Error ? error.message : error
        });
      }
    }
    
    // Release semaphores
    for (const semaphoreId of semaphoreAcquisitions) {
      try {
        await this.distributedCoordination.releaseSemaphore('workflow_coordinator', semaphoreId);
      } catch (error) {
        this.logger.warn('Failed to release semaphore', {
          semaphoreId,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Handles step failure
   * 
   * @private
   */
  private async handleStepFailure(
    context: WorkflowExecutionContext,
    step: EnhancedWorkflowStep,
    error: unknown
  ): Promise<void> {
    this.logger.error('Workflow step failed', {
      workflowId: context.workflowId,
      stepId: step.id,
      error: error instanceof Error ? error.message : error
    });
    
    // Publish failure event
    const failureEvent: DomainEvent = {
      id: `step_failed_${step.id}_${Date.now()}`,
      type: 'workflow_step_failed',
      aggregateId: context.workflowId,
      aggregateType: 'workflow',
      data: {
        stepId: step.id,
        stepName: step.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureHandlingStrategy: step.failureHandling.strategy
      },
      metadata: {
        timestamp: Date.now(),
        version: 1,
        source: 'coordination_integration'
      },
      schemaVersion: '1.0'
    };
    
    await this.eventDriven.publishEvent(failureEvent);
  }

  /**
   * Retries step execution
   * 
   * @private
   */
  private async retryStepExecution(
    context: WorkflowExecutionContext,
    step: EnhancedWorkflowStep,
    lastError: unknown
  ): Promise<unknown> {
    for (let attempt = 1; attempt <= step.retryConfig.maxAttempts; attempt++) {
      try {
        this.logger.info('Retrying step execution', {
          workflowId: context.workflowId,
          stepId: step.id,
          attempt,
          maxAttempts: step.retryConfig.maxAttempts
        });
        
        // Wait for backoff delay
        const delay = step.retryConfig.initialDelay * Math.pow(step.retryConfig.backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the step
        return await this.executeWorkflowStep(context, step);
        
      } catch (error) {
        if (attempt === step.retryConfig.maxAttempts) {
          throw error;
        }
        
        this.logger.warn('Step retry failed', {
          workflowId: context.workflowId,
          stepId: step.id,
          attempt,
          error: error instanceof Error ? error.message : error
        });
      }
    }
    
    throw lastError;
  }

  /**
   * Initializes integration between all coordination systems
   * 
   * @private
   */
  private initializeIntegration(): void {
    // Set up event forwarding between systems
    this.setupEventForwarding();
    
    // Initialize health monitoring
    if (this.config.enableMonitoring) {
      this.initializeHealthMonitoring();
    }
    
    // Initialize auto-healing
    if (this.config.enableAutoHealing) {
      this.initializeAutoHealing();
    }
    
    this.logger.info('Integration initialized successfully');
  }

  /**
   * Sets up event forwarding between coordination systems
   * 
   * @private
   */
  private setupEventForwarding(): void {
    // Forward coordination pattern events
    if (this.config.enableCoordinationPatterns) {
      this.coordinationPatterns.subscribeToExecutionEvents().subscribe(event => {
        this.integrationEventStream.next(event);
      });
    }
    
    // Forward distributed coordination events
    if (this.config.enableDistributedCoordination) {
      this.distributedCoordination.subscribeToCoordinationEvents('lock').subscribe(event => {
        this.integrationEventStream.next(event);
      });
    }
    
    // Forward event-driven architecture events
    if (this.config.enableEventDriven) {
      this.eventDriven.getCEPEventStream().subscribe(context => {
        this.integrationEventStream.next({
          id: `cep_${context.rule.id}_${Date.now()}`,
          type: 'message_received',
          agentId: 'cep_engine',
          payload: { context },
          timestamp: Date.now(),
          priority: 'medium'
        });
      });
    }
    
    // Forward conflict resolution events
    if (this.config.enableConflictResolution) {
      this.conflictResolution.subscribeToConflictEvents('conflict').subscribe(event => {
        this.integrationEventStream.next(event);
      });
    }
    
    // Forward performance events
    if (this.config.enablePerformanceScalability) {
      this.performanceScalability.subscribeToPerformanceEvents().subscribe(event => {
        this.integrationEventStream.next(event);
      });
    }
  }

  /**
   * Initializes health monitoring
   * 
   * @private
   */
  private initializeHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthMonitor.healthCheckInterval);
    
    this.logger.info('Health monitoring initialized');
  }

  /**
   * Performs system health check
   * 
   * @private
   */
  private async performHealthCheck(): Promise<void> {
    this.healthMonitor.lastHealthCheck = Date.now();
    
    try {
      const componentHealthChecks = await Promise.allSettled([
        this.checkMultiAgentSystemHealth(),
        this.checkCoordinationPatternsHealth(),
        this.checkDistributedCoordinationHealth(),
        this.checkEventDrivenHealth(),
        this.checkConflictResolutionHealth(),
        this.checkPerformanceScalabilityHealth()
      ]);
      
      let healthyComponents = 0;
      let degradedComponents = 0;
      let unhealthyComponents = 0;
      
      componentHealthChecks.forEach((result, index) => {
        const componentNames = [
          'multi_agent_system',
          'coordination_patterns', 
          'distributed_coordination',
          'event_driven',
          'conflict_resolution',
          'performance_scalability'
        ];
        
        const componentName = componentNames[index];
        let health: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
        
        if (result.status === 'fulfilled') {
          health = result.value;
        }
        
        this.healthMonitor.componentHealth.set(componentName, health);
        
        switch (health) {
          case 'healthy':
            healthyComponents++;
            break;
          case 'degraded':
            degradedComponents++;
            break;
          case 'unhealthy':
            unhealthyComponents++;
            break;
        }
      });
      
      // Determine overall system health
      if (unhealthyComponents > healthyComponents) {
        this.healthMonitor.systemHealth = 'unhealthy';
      } else if (degradedComponents > 0) {
        this.healthMonitor.systemHealth = 'degraded';
      } else {
        this.healthMonitor.systemHealth = 'healthy';
      }
      
      this.logger.debug('Health check completed', {
        systemHealth: this.healthMonitor.systemHealth,
        healthyComponents,
        degradedComponents,
        unhealthyComponents
      });
      
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : error
      });
      
      this.healthMonitor.systemHealth = 'unhealthy';
    }
  }

  /**
   * Checks multi-agent system health
   * 
   * @private
   */
  private async checkMultiAgentSystemHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const healthReport = await this.multiAgentSystem.performSystemHealthCheck();
      return healthReport.overall;
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Checks coordination patterns health
   * 
   * @private
   */
  private async checkCoordinationPatternsHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const metrics = this.coordinationPatterns.getPerformanceMetrics();
      const successRate = metrics.totalExecutions > 0 ? 
        metrics.successfulExecutions / metrics.totalExecutions : 1;
      
      if (successRate >= 0.9) return 'healthy';
      if (successRate >= 0.7) return 'degraded';
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Checks distributed coordination health
   * 
   * @private
   */
  private async checkDistributedCoordinationHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const lockStats = this.distributedCoordination.getLockStatistics();
      const deadlocks = this.distributedCoordination.getDeadlocks();
      
      if (deadlocks.size === 0 && lockStats.size < 1000) return 'healthy';
      if (deadlocks.size < 5) return 'degraded';
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Checks event-driven architecture health
   * 
   * @private
   */
  private async checkEventDrivenHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const activeSagas = this.eventDriven.getActiveSagas();
      const cepRules = this.eventDriven.getCEPRules();
      
      // Simple health check based on active components
      if (activeSagas.size < 100 && cepRules.size < 1000) return 'healthy';
      if (activeSagas.size < 500) return 'degraded';
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Checks conflict resolution health
   * 
   * @private
   */
  private async checkConflictResolutionHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const statistics = this.conflictResolution.getStatistics();
      const successRate = statistics.totalStarted > 0 ? 
        statistics.totalCommitted / statistics.totalStarted : 1;
      
      if (successRate >= 0.9) return 'healthy';
      if (successRate >= 0.7) return 'degraded';
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Checks performance scalability health
   * 
   * @private
   */
  private async checkPerformanceScalabilityHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const metrics = this.performanceScalability.getCurrentMetrics();
      
      if (!metrics) return 'degraded';
      
      if (metrics.errors.errorRate < 0.1 && metrics.load.cpuUsage < 0.8) return 'healthy';
      if (metrics.errors.errorRate < 0.2) return 'degraded';
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Initializes auto-healing capabilities
   * 
   * @private
   */
  private initializeAutoHealing(): void {
    // Monitor integration events for issues
    this.integrationEventStream.subscribe(event => {
      if (event.priority === 'critical' || event.priority === 'high') {
        this.handleCriticalEvent(event);
      }
    });
    
    this.logger.info('Auto-healing initialized');
  }

  /**
   * Handles critical events for auto-healing
   * 
   * @private
   */
  private async handleCriticalEvent(event: AgentEvent): Promise<void> {
    this.logger.warn('Critical event detected, attempting auto-healing', {
      eventId: event.id,
      eventType: event.type,
      agentId: event.agentId
    });
    
    // Implement auto-healing strategies based on event type
    // This is a simplified example - real implementation would be more sophisticated
    try {
      if (event.type === 'message_received' && event.payload) {
        // Handle specific auto-healing scenarios
        if (event.payload.circuitBreakerId) {
          // Circuit breaker opened - could trigger scaling
          this.logger.info('Auto-healing: Circuit breaker detected, monitoring for scaling opportunity');
        }
        
        if (event.payload.deadlockId) {
          // Deadlock detected - already handled by conflict resolution
          this.logger.info('Auto-healing: Deadlock handled by conflict resolution system');
        }
      }
    } catch (error) {
      this.logger.error('Auto-healing action failed', {
        eventId: event.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Emits integration event
   * 
   * @private
   */
  private emitIntegrationEvent(event: AgentEvent): void {
    this.integrationEventStream.next(event);
  }

  /**
   * Gets active workflow contexts
   */
  getActiveWorkflows(): Map<string, WorkflowExecutionContext> {
    return new Map(this.activeWorkflows);
  }

  /**
   * Gets system health status
   */
  getSystemHealth(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: Map<string, 'healthy' | 'degraded' | 'unhealthy'>;
    lastHealthCheck: number;
  } {
    return {
      overall: this.healthMonitor.systemHealth,
      components: new Map(this.healthMonitor.componentHealth),
      lastHealthCheck: this.healthMonitor.lastHealthCheck
    };
  }

  /**
   * Subscribes to integration events
   */
  subscribeToIntegrationEvents(): Observable<AgentEvent> {
    return this.integrationEventStream.asObservable();
  }

  /**
   * Updates integration configuration
   */
  updateConfiguration(config: Partial<CoordinationIntegrationConfig>): void {
    Object.assign(this.config, config);
    
    this.logger.info('Integration configuration updated', { config });
  }

  /**
   * Gets production monitoring metrics
   */
  getProductionMetrics(): any {
    if (!this.config.productionMonitoring.enabled) {
      return null;
    }
    
    return this.productionMonitoring.getMetrics();
  }

  /**
   * Gets system performance report
   */
  getPerformanceReport(): any {
    if (!this.config.productionMonitoring.enabled) {
      return null;
    }
    
    return this.productionMonitoring.getPerformanceReport();
  }

  /**
   * Gets active alerts
   */
  getActiveAlerts(): any[] {
    if (!this.config.productionMonitoring.enabled) {
      return [];
    }
    
    return this.productionMonitoring.getActiveAlerts();
  }

  /**
   * Acknowledges an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    if (!this.config.productionMonitoring.enabled) {
      return false;
    }
    
    return this.productionMonitoring.acknowledgeAlert(alertId);
  }

  /**
   * Resolves an alert
   */
  resolveAlert(alertId: string): boolean {
    if (!this.config.productionMonitoring.enabled) {
      return false;
    }
    
    return this.productionMonitoring.resolveAlert(alertId);
  }

  /**
   * Subscribes to production monitoring alerts
   */
  subscribeToAlerts(): Observable<any> {
    if (!this.config.productionMonitoring.enabled) {
      return new Subject().asObservable();
    }
    
    return this.productionMonitoring.subscribeToAlerts();
  }

  /**
   * Subscribes to production metrics updates
   */
  subscribeToMetricsUpdates(): Observable<any> {
    if (!this.config.productionMonitoring.enabled) {
      return new Subject().asObservable();
    }
    
    return this.productionMonitoring.subscribeToMetricsUpdates();
  }

  /**
   * Updates system configuration with hot-reload support
   */
  updateSystemConfiguration(changes: Record<string, any>, appliedBy: string = 'system', reason?: string): { success: boolean; errors: string[] } {
    if (!this.config.configurationManagement.enabled) {
      return { success: false, errors: ['Configuration management is disabled'] };
    }
    
    const result = this.configurationManager.updateConfiguration(changes, appliedBy, reason);
    
    if (result.success) {
      // Apply configuration changes to coordination integration
      Object.assign(this.config, changes);
      
      this.logger.info('System configuration updated', {
        changes,
        appliedBy,
        reason
      });
      
      // Emit configuration change event
      this.emitIntegrationEvent({
        id: `config_update_${Date.now()}`,
        type: 'system_configuration_updated',
        timestamp: Date.now(),
        agentId: 'coordination_integration',
        payload: {
          changes,
          appliedBy,
          reason
        }
      });
    }
    
    return result;
  }

  /**
   * Gets current system configuration
   */
  getSystemConfiguration(): Record<string, any> {
    if (!this.config.configurationManagement.enabled) {
      return {};
    }
    
    return this.configurationManager.getConfiguration();
  }

  /**
   * Gets configuration change history
   */
  getConfigurationHistory(): any[] {
    if (!this.config.configurationManagement.enabled) {
      return [];
    }
    
    return this.configurationManager.getConfigurationHistory();
  }

  /**
   * Subscribes to configuration changes
   */
  subscribeToConfigurationChanges(): Observable<any> {
    if (!this.config.configurationManagement.enabled) {
      return new Subject().asObservable();
    }
    
    return this.configurationManager.subscribeToChanges();
  }

  /**
   * Exports comprehensive monitoring data
   */
  exportMonitoringData(): any {
    if (!this.config.productionMonitoring.enabled) {
      return null;
    }
    
    return {
      ...this.productionMonitoring.exportMonitoringData(),
      systemHealth: this.getSystemHealth(),
      coordinationMetrics: {
        patterns: this.coordinationPatterns.getPerformanceMetrics(),
        distributedCoordination: this.distributedCoordination.getStatistics(),
        eventDriven: this.eventDriven.getStatistics(),
        conflictResolution: this.conflictResolution.getStatistics(),
        performanceScalability: this.performanceScalability.getCurrentMetrics()
      },
      activeWorkflows: Array.from(this.activeWorkflows.keys()),
      integrationConfiguration: this.config
    };
  }

  /**
   * Records health snapshot for system monitoring
   */
  recordSystemHealthSnapshot(): void {
    if (!this.config.productionMonitoring.enabled) {
      return;
    }
    
    const health = this.getSystemHealth();
    
    this.productionMonitoring.recordHealthSnapshot('coordination_integration', {
      timestamp: Date.now(),
      overall: health.overall,
      components: new Map(Array.from(health.components.entries()).map(([key, status]) => [
        key,
        {
          status,
          metrics: this.getComponentMetrics(key),
          details: `Component ${key} is ${status}`
        }
      ])),
      recommendations: this.generateHealthRecommendations(health)
    });
  }

  /**
   * Gets component-specific metrics
   * 
   * @private
   */
  private getComponentMetrics(componentName: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    try {
      switch (componentName) {
        case 'multi_agent_system':
          const systemStats = this.multiAgentSystem.getSystemStatistics();
          metrics.totalAgents = systemStats.totalAgents;
          metrics.activeAgents = systemStats.activeAgents;
          metrics.messagesSent = systemStats.messagesSent;
          break;
          
        case 'coordination_patterns':
          const patternMetrics = this.coordinationPatterns.getPerformanceMetrics();
          metrics.totalExecutions = patternMetrics.totalExecutions;
          metrics.successfulExecutions = patternMetrics.successfulExecutions;
          metrics.avgExecutionTime = patternMetrics.avgExecutionTime;
          break;
          
        case 'distributed_coordination':
          const distMetrics = this.distributedCoordination.getStatistics();
          metrics.locksAcquired = distMetrics.locks.totalAcquired;
          metrics.semaphoresUsed = distMetrics.semaphores.totalAcquired;
          break;
          
        case 'event_driven':
          const eventMetrics = this.eventDriven.getStatistics();
          metrics.eventsPublished = eventMetrics.eventsPublished;
          metrics.eventsProcessed = eventMetrics.eventsProcessed;
          break;
          
        case 'conflict_resolution':
          const conflictMetrics = this.conflictResolution.getStatistics();
          metrics.transactionsCommitted = conflictMetrics.totalCommitted;
          metrics.transactionAborted = conflictMetrics.totalAborted;
          break;
          
        case 'performance_scalability':
          const perfMetrics = this.performanceScalability.getCurrentMetrics();
          metrics.circuitBreakersOpen = perfMetrics?.circuitBreakers.openCount || 0;
          metrics.errorRate = perfMetrics?.errors.errorRate || 0;
          break;
      }
    } catch (error) {
      this.logger.warn('Failed to get component metrics', { 
        component: componentName, 
        error: error instanceof Error ? error.message : error 
      });
    }
    
    return metrics;
  }

  /**
   * Generates health recommendations based on system status
   * 
   * @private
   */
  private generateHealthRecommendations(health: any): string[] {
    const recommendations: string[] = [];
    
    let unhealthyComponents = 0;
    let degradedComponents = 0;
    
    for (const [name, status] of health.components) {
      if (status === 'unhealthy') {
        unhealthyComponents++;
        recommendations.push(`Investigate unhealthy component: ${name}`);
      } else if (status === 'degraded') {
        degradedComponents++;
        recommendations.push(`Monitor degraded component: ${name}`);
      }
    }
    
    if (unhealthyComponents > 2) {
      recommendations.push('Multiple unhealthy components detected - consider system restart');
    }
    
    if (degradedComponents > 3) {
      recommendations.push('System performance may be impacted - review resource allocation');
    }
    
    const activeWorkflowCount = this.activeWorkflows.size;
    if (activeWorkflowCount > 50) {
      recommendations.push('High number of active workflows - monitor resource usage');
    }
    
    return recommendations;
  }

  /**
   * Shuts down the coordination integration system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down CoordinationIntegration system');
    
    // Shutdown all coordination systems
    await Promise.all([
      this.coordinationPatterns.shutdown(),
      this.distributedCoordination.shutdown(),
      this.eventDriven.shutdown(),
      this.conflictResolution.shutdown(),
      this.performanceScalability.shutdown(),
      this.productionMonitoring.shutdown()
    ]);
    
    // Shutdown configuration manager
    this.configurationManager.shutdown();
    
    // Complete integration event stream
    this.integrationEventStream.complete();
    
    // Clear active workflows
    this.activeWorkflows.clear();
    
    this.logger.info('CoordinationIntegration system shutdown complete');
  }
}