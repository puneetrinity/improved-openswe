/**
 * Task Delegation Engine - Main orchestrator for intelligent task delegation
 * 
 * Provides the primary interface for task delegation with sophisticated routing,
 * intelligent agent matching, workflow orchestration, and performance optimization.
 */

import { EventEmitter } from 'events';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import { CapabilityMatcher } from './capability-matcher.js';
import { TaskRouter } from './task-router.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';
import { AgentRegistry } from './agent-registry-impl.js';
import { AgentCommunicationHub } from './agent-communication-hub.js';
import { AgentProfile, AgentRole, TaskDelegation } from './types.js';
import {
  TaskDelegationRequest,
  TaskDelegationResult,
  TaskRoutingDecision,
  WorkflowPlan,
  TaskDelegationConfig,
  TaskDelegationStatistics,
  DelegationPattern,
  ConflictResolutionContext,
  AuctionConfig,
  AgentBid,
  NotificationConfig,
  TaskComplexity,
  TaskPriority,
  TaskStatus
} from './task-delegation-types.js';

/**
 * Active delegation tracking
 */
interface ActiveDelegation {
  /**
   * Delegation request
   */
  request: TaskDelegationRequest;
  
  /**
   * Routing decision
   */
  routingDecision: TaskRoutingDecision;
  
  /**
   * Current status
   */
  status: TaskStatus;
  
  /**
   * Assigned agents
   */
  assignedAgents: string[];
  
  /**
   * Start time
   */
  startTime: number;
  
  /**
   * Expected completion time
   */
  expectedCompletion: number;
  
  /**
   * Actual completion time (if completed)
   */
  actualCompletion?: number;
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Any errors encountered
   */
  errors: string[];
  
  /**
   * Retry count
   */
  retryCount: number;
  
  /**
   * Delegation metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Auction state for auction-based delegation
 */
interface AuctionState {
  /**
   * Task being auctioned
   */
  task: TaskDelegationRequest;
  
  /**
   * Auction configuration
   */
  config: AuctionConfig;
  
  /**
   * Received bids
   */
  bids: AgentBid[];
  
  /**
   * Auction start time
   */
  startTime: number;
  
  /**
   * Auction end time
   */
  endTime: number;
  
  /**
   * Auction status
   */
  status: 'active' | 'evaluating' | 'completed' | 'cancelled';
  
  /**
   * Winning bid (if completed)
   */
  winningBid?: AgentBid;
}

/**
 * Task delegation event types
 */
type DelegationEventType =
  | 'delegation_requested'
  | 'delegation_completed'
  | 'delegation_failed'
  | 'task_assigned'
  | 'task_started'
  | 'task_progress'
  | 'task_completed'
  | 'task_failed'
  | 'agent_overloaded'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'auction_started'
  | 'auction_bid_received'
  | 'auction_completed'
  | 'performance_alert'
  | 'optimization_triggered';

/**
 * Delegation event data
 */
interface DelegationEvent {
  id: string;
  type: DelegationEventType;
  taskId: string;
  agentId?: string;
  data: Record<string, unknown>;
  timestamp: number;
  priority: TaskPriority;
}

/**
 * Comprehensive Task Delegation Engine
 */
export class TaskDelegationEngine extends EventEmitter {
  private readonly logger = createLogger(LogLevel.INFO, 'TaskDelegationEngine');

  /**
   * Core components
   */
  private readonly capabilityMatcher: CapabilityMatcher;
  private readonly taskRouter: TaskRouter;
  private readonly workflowOrchestrator: WorkflowOrchestrator;

  /**
   * Active delegations tracking
   */
  private readonly activeDelegations = new Map<string, ActiveDelegation>();

  /**
   * Active auctions
   */
  private readonly activeAuctions = new Map<string, AuctionState>();

  /**
   * Conflict resolution queue
   */
  private readonly conflictQueue: ConflictResolutionContext[] = [];

  /**
   * Engine configuration
   */
  private readonly config: TaskDelegationConfig;

  /**
   * Notification configuration
   */
  private readonly notificationConfig: NotificationConfig;

  /**
   * Engine statistics
   */
  private readonly statistics: TaskDelegationStatistics = {
    totalTasksProcessed: 0,
    successfulDelegations: 0,
    failedDelegations: 0,
    avgRoutingTime: 0,
    avgCompletionTime: 0,
    agentUtilization: {},
    delegationPatternUsage: {} as Record<DelegationPattern, number>,
    complexityDistribution: {} as Record<TaskComplexity, number>,
    lastUpdated: Date.now()
  };

  /**
   * Performance monitoring intervals
   */
  private performanceMonitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private statisticsInterval?: NodeJS.Timeout;

  /**
   * Creates a new TaskDelegationEngine instance
   */
  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly communicationHub: AgentCommunicationHub,
    config?: Partial<TaskDelegationConfig>,
    notificationConfig?: Partial<NotificationConfig>
  ) {
    super();

    this.config = {
      maxConcurrentTasksPerAgent: 5,
      defaultTaskTimeout: 300000, // 5 minutes
      loadBalancing: {
        algorithm: 'capability_based',
        weights: {
          load: 0.3,
          performance: 0.25,
          responseTime: 0.2,
          capability: 0.15,
          preference: 0.1
        },
        maxLoadThreshold: 0.8,
        minAgentsConsidered: 3,
        updateInterval: 10000
      },
      monitoring: {
        metricsInterval: 30000,
        historyRetention: 86400000, // 24 hours
        anomalyThresholds: {
          responseTime: 5000,
          successRate: 0.9,
          loadSpike: 0.8
        },
        enableAdaptiveOptimization: true,
        optimizationTriggers: {
          failedDelegationRate: 0.1,
          avgResponseTime: 3000,
          overloadFrequency: 0.3
        }
      },
      enableIntelligentRouting: true,
      enableWorkflowOrchestration: true,
      defaultDelegationPattern: 'capability_matched',
      conflictResolution: 'capability_based',
      taskQueue: {
        maxSize: 1000,
        processInterval: 1000,
        priorityQueueEnabled: true
      },
      ...config
    };

    this.notificationConfig = {
      enableAssignmentNotifications: true,
      enableCompletionNotifications: true,
      enableFailureNotifications: true,
      enablePerformanceAlerts: true,
      channels: ['agent_message', 'system_log'],
      priorityThresholds: {
        minPriority: 'normal',
        criticalThreshold: 0.8
      },
      ...notificationConfig
    };

    // Initialize core components
    this.capabilityMatcher = new CapabilityMatcher();
    this.taskRouter = new TaskRouter(this.capabilityMatcher, this.agentRegistry, this.config.loadBalancing);
    this.workflowOrchestrator = new WorkflowOrchestrator(
      this.taskRouter,
      this.communicationHub,
      this.agentRegistry
    );

    this.initializeMonitoring();
    this.setupEventHandlers();

    this.logger.info('TaskDelegationEngine initialized', {
      config: this.config,
      notificationConfig: this.notificationConfig
    });
  }

  /**
   * Delegates a task to the most suitable agents
   * 
   * @param request - Task delegation request
   * @returns Promise resolving to delegation result
   */
  async delegateTask(request: TaskDelegationRequest): Promise<TaskDelegationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting task delegation', {
        taskId: request.taskId,
        complexity: request.complexity,
        priority: request.priority,
        requiredCapabilities: request.requiredCapabilities.length
      });

      // Validate request
      this.validateDelegationRequest(request);

      // Update statistics
      this.statistics.totalTasksProcessed++;
      this.updateComplexityDistribution(request.complexity);

      // Emit delegation requested event
      this.emitDelegationEvent({
        id: `delegation_req_${request.taskId}_${Date.now()}`,
        type: 'delegation_requested',
        taskId: request.taskId,
        data: { request },
        timestamp: Date.now(),
        priority: request.priority
      });

      // Check for conflicts with existing delegations
      const conflicts = this.detectConflicts(request);
      if (conflicts.length > 0) {
        await this.resolveConflicts(request, conflicts);
      }

      // Select delegation pattern
      const delegationPattern = request.delegationPattern || this.config.defaultDelegationPattern;
      
      let routingDecision: TaskRoutingDecision;
      
      // Handle different delegation patterns
      switch (delegationPattern) {
        case 'auction_based':
          routingDecision = await this.handleAuctionBasedDelegation(request);
          break;
          
        case 'consensus_based':
          routingDecision = await this.handleConsensusBasedDelegation(request);
          break;
          
        default:
          routingDecision = await this.taskRouter.routeTask(request);
          break;
      }

      // Create active delegation tracking
      const activeDelegation = this.createActiveDelegation(request, routingDecision);
      this.activeDelegations.set(request.taskId, activeDelegation);

      // Start monitoring the delegation
      this.startDelegationMonitoring(request.taskId);

      // Send notifications
      if (this.notificationConfig.enableAssignmentNotifications) {
        await this.sendAssignmentNotifications(request, routingDecision);
      }

      // Update statistics
      const routingTime = Date.now() - startTime;
      this.statistics.avgRoutingTime = (this.statistics.avgRoutingTime + routingTime) / 2;
      this.updateDelegationPatternUsage(delegationPattern);

      if (routingDecision.assignments.length > 0) {
        this.statistics.successfulDelegations++;
        
        const result: TaskDelegationResult = {
          taskId: request.taskId,
          success: true,
          assignedAgents: routingDecision.assignments.map(a => a.agentId),
          delegationPattern,
          routingDecision,
          estimatedCompletion: Date.now() + routingDecision.estimatedDuration,
          metadata: {
            routingTime,
            agentsConsidered: routingDecision.alternatives.length + routingDecision.assignments.length,
            avgCapabilityScore: routingDecision.assignments.reduce((sum, a) => sum + a.capabilityScore.overallScore, 0) / routingDecision.assignments.length,
            confidence: routingDecision.confidence
          },
          warnings: routingDecision.risks.filter(r => r.severity > 0.5).map(r => r.description),
          delegatedAt: Date.now()
        };

        this.emitDelegationEvent({
          id: `delegation_success_${request.taskId}_${Date.now()}`,
          type: 'delegation_completed',
          taskId: request.taskId,
          data: { result },
          timestamp: Date.now(),
          priority: request.priority
        });

        this.logger.info('Task delegation completed successfully', {
          taskId: request.taskId,
          assignedAgents: result.assignedAgents.length,
          confidence: routingDecision.confidence,
          routingTime
        });

        return result;

      } else {
        this.statistics.failedDelegations++;
        
        const result: TaskDelegationResult = {
          taskId: request.taskId,
          success: false,
          assignedAgents: [],
          delegationPattern,
          routingDecision,
          estimatedCompletion: 0,
          metadata: {
            routingTime,
            agentsConsidered: 0,
            avgCapabilityScore: 0,
            confidence: 0
          },
          error: 'No suitable agents found for task requirements',
          warnings: ['Consider reducing task requirements or adding more capable agents'],
          delegatedAt: Date.now()
        };

        this.emitDelegationEvent({
          id: `delegation_failed_${request.taskId}_${Date.now()}`,
          type: 'delegation_failed',
          taskId: request.taskId,
          data: { result, error: result.error },
          timestamp: Date.now(),
          priority: request.priority
        });

        return result;
      }

    } catch (error) {
      this.statistics.failedDelegations++;
      
      this.logger.error('Task delegation failed', {
        taskId: request.taskId,
        error: error instanceof Error ? error.message : error
      });

      const result: TaskDelegationResult = {
        taskId: request.taskId,
        success: false,
        assignedAgents: [],
        delegationPattern: request.delegationPattern || this.config.defaultDelegationPattern,
        routingDecision: {
          taskId: request.taskId,
          assignments: [],
          alternatives: [],
          delegationPattern: request.delegationPattern || this.config.defaultDelegationPattern,
          executionPattern: 'sequential',
          estimatedDuration: 0,
          confidence: 0,
          risks: [],
          fallbackOptions: [],
          reasoning: `Delegation failed: ${error instanceof Error ? error.message : error}`,
          decidedAt: Date.now()
        },
        estimatedCompletion: 0,
        metadata: {
          routingTime: Date.now() - startTime,
          agentsConsidered: 0,
          avgCapabilityScore: 0,
          confidence: 0
        },
        error: error instanceof Error ? error.message : String(error),
        warnings: [],
        delegatedAt: Date.now()
      };

      this.emitDelegationEvent({
        id: `delegation_error_${request.taskId}_${Date.now()}`,
        type: 'delegation_failed',
        taskId: request.taskId,
        data: { result, error: result.error },
        timestamp: Date.now(),
        priority: request.priority
      });

      return result;
    }
  }

  /**
   * Executes a complex workflow with multiple tasks
   * 
   * @param workflowPlan - Workflow plan to execute
   * @param metadata - Optional execution metadata
   * @returns Promise resolving to workflow execution context
   */
  async executeWorkflow(workflowPlan: WorkflowPlan, metadata?: Record<string, unknown>) {
    if (!this.config.enableWorkflowOrchestration) {
      throw new Error('Workflow orchestration is disabled in engine configuration');
    }

    this.logger.info('Starting workflow execution', {
      workflowId: workflowPlan.id,
      stepsCount: workflowPlan.steps.length
    });

    try {
      const context = await this.workflowOrchestrator.executeWorkflow(workflowPlan, metadata);
      
      this.logger.info('Workflow execution started successfully', {
        workflowId: workflowPlan.id,
        state: context.state
      });

      return context;

    } catch (error) {
      this.logger.error('Failed to start workflow execution', {
        workflowId: workflowPlan.id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Gets the current status of a task delegation
   * 
   * @param taskId - Task identifier
   * @returns Task delegation status or null if not found
   */
  getDelegationStatus(taskId: string): {
    status: TaskStatus;
    progress: number;
    assignedAgents: string[];
    startTime: number;
    expectedCompletion: number;
    actualCompletion?: number;
    errors: string[];
    retryCount: number;
  } | null {
    const delegation = this.activeDelegations.get(taskId);
    if (!delegation) {
      return null;
    }

    return {
      status: delegation.status,
      progress: delegation.progress,
      assignedAgents: delegation.assignedAgents,
      startTime: delegation.startTime,
      expectedCompletion: delegation.expectedCompletion,
      actualCompletion: delegation.actualCompletion,
      errors: delegation.errors,
      retryCount: delegation.retryCount
    };
  }

  /**
   * Gets comprehensive engine statistics
   * 
   * @returns Current delegation engine statistics
   */
  getStatistics(): TaskDelegationStatistics {
    // Update current agent utilization
    this.updateAgentUtilization();
    
    this.statistics.lastUpdated = Date.now();
    return { ...this.statistics };
  }

  /**
   * Gets queue status from the task router
   * 
   * @returns Current queue status
   */
  getQueueStatus() {
    return this.taskRouter.getQueueStatus();
  }

  /**
   * Gets load balancing status
   * 
   * @returns Current load balancing information
   */
  getLoadBalancingStatus() {
    return this.taskRouter.getLoadBalancingStatus();
  }

  /**
   * Manually triggers load rebalancing
   * 
   * @returns Promise resolving when rebalancing is complete
   */
  async rebalanceLoad(): Promise<void> {
    this.logger.info('Triggering manual load rebalancing');
    await this.taskRouter.rebalanceLoad();
  }

  /**
   * Updates task progress (called by agents or external systems)
   * 
   * @param taskId - Task identifier
   * @param progress - Progress percentage (0-100)
   * @param agentId - Reporting agent ID
   * @param metadata - Additional progress data
   */
  async updateTaskProgress(
    taskId: string,
    progress: number,
    agentId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const delegation = this.activeDelegations.get(taskId);
    if (!delegation) {
      this.logger.warn('Progress update for unknown task', { taskId, agentId });
      return;
    }

    delegation.progress = Math.max(delegation.progress, progress);
    delegation.metadata = { ...delegation.metadata, ...metadata };

    if (progress >= 100) {
      delegation.status = 'completed';
      delegation.actualCompletion = Date.now();
      
      // Update completion time statistics
      const completionTime = delegation.actualCompletion - delegation.startTime;
      this.statistics.avgCompletionTime = (this.statistics.avgCompletionTime + completionTime) / 2;

      // Send completion notifications
      if (this.notificationConfig.enableCompletionNotifications) {
        await this.sendCompletionNotifications(delegation);
      }

      // Remove from active delegations
      this.activeDelegations.delete(taskId);
    }

    this.emitDelegationEvent({
      id: `task_progress_${taskId}_${Date.now()}`,
      type: progress >= 100 ? 'task_completed' : 'task_progress',
      taskId,
      agentId,
      data: { progress, metadata },
      timestamp: Date.now(),
      priority: delegation.request.priority
    });

    this.logger.debug('Task progress updated', {
      taskId,
      agentId,
      progress,
      status: delegation.status
    });
  }

  /**
   * Reports task failure
   * 
   * @param taskId - Task identifier
   * @param error - Error information
   * @param agentId - Reporting agent ID
   */
  async reportTaskFailure(taskId: string, error: string, agentId: string): Promise<void> {
    const delegation = this.activeDelegations.get(taskId);
    if (!delegation) {
      this.logger.warn('Failure report for unknown task', { taskId, agentId });
      return;
    }

    delegation.status = 'failed';
    delegation.errors.push(error);
    delegation.actualCompletion = Date.now();

    // Send failure notifications
    if (this.notificationConfig.enableFailureNotifications) {
      await this.sendFailureNotifications(delegation, error);
    }

    // Attempt recovery if configured
    const recovered = await this.attemptTaskRecovery(delegation);
    
    if (!recovered) {
      // Remove from active delegations
      this.activeDelegations.delete(taskId);
    }

    this.emitDelegationEvent({
      id: `task_failed_${taskId}_${Date.now()}`,
      type: 'task_failed',
      taskId,
      agentId,
      data: { error, recovered },
      timestamp: Date.now(),
      priority: 'high'
    });

    this.logger.warn('Task failure reported', {
      taskId,
      agentId,
      error,
      recovered
    });
  }

  /**
   * Validates a task delegation request
   * 
   * @private
   */
  private validateDelegationRequest(request: TaskDelegationRequest): void {
    if (!request.taskId) {
      throw new Error('Task ID is required');
    }

    if (!request.description || request.description.trim().length === 0) {
      throw new Error('Task description is required');
    }

    if (!request.requiredCapabilities || request.requiredCapabilities.length === 0) {
      throw new Error('Required capabilities must be specified');
    }

    if (!request.requestedBy) {
      throw new Error('Requesting agent ID is required');
    }

    // Validate timeline constraints
    if (request.deadline && request.deadline <= Date.now()) {
      throw new Error('Task deadline must be in the future');
    }

    if (request.expectedDuration && request.expectedDuration <= 0) {
      throw new Error('Expected duration must be positive');
    }
  }

  /**
   * Detects conflicts with existing delegations
   * 
   * @private
   */
  private detectConflicts(request: TaskDelegationRequest): string[] {
    const conflicts: string[] = [];

    // Check for resource conflicts
    for (const [taskId, delegation] of this.activeDelegations.entries()) {
      if (delegation.status === 'in_progress' || delegation.status === 'delegated') {
        // Check for agent overlap in preferred agents
        if (request.preferredAgents) {
          const overlap = delegation.assignedAgents.filter(agentId => 
            request.preferredAgents!.includes(agentId)
          );
          
          if (overlap.length > 0) {
            conflicts.push(taskId);
          }
        }

        // Check for capability conflicts with high priority tasks
        if (request.priority === 'critical' && delegation.request.priority !== 'critical') {
          const capabilityOverlap = request.requiredCapabilities.some(cap => 
            delegation.request.requiredCapabilities.includes(cap)
          );
          
          if (capabilityOverlap) {
            conflicts.push(taskId);
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolves conflicts between task requests
   * 
   * @private
   */
  private async resolveConflicts(request: TaskDelegationRequest, conflictingTaskIds: string[]): Promise<void> {
    this.logger.info('Resolving task conflicts', {
      taskId: request.taskId,
      conflictCount: conflictingTaskIds.length
    });

    const conflictingTasks = conflictingTaskIds
      .map(taskId => this.activeDelegations.get(taskId)?.request)
      .filter(req => req !== undefined) as TaskDelegationRequest[];

    const availableAgents = this.agentRegistry.getAllAgents().map(agent => agent.id);

    const context: ConflictResolutionContext = {
      conflictingTasks: [request, ...conflictingTasks],
      availableAgents,
      conflictType: 'agent_availability',
      resolutionStrategy: this.config.conflictResolution,
      contextData: {
        timestamp: Date.now(),
        engineId: 'task_delegation_engine'
      }
    };

    try {
      const resolutions = await this.taskRouter.resolveConflicts(context);
      
      this.logger.info('Conflicts resolved successfully', {
        taskId: request.taskId,
        resolutionsCount: resolutions.length
      });

      this.emitDelegationEvent({
        id: `conflict_resolved_${request.taskId}_${Date.now()}`,
        type: 'conflict_resolved',
        taskId: request.taskId,
        data: { conflictingTaskIds, resolutionsCount: resolutions.length },
        timestamp: Date.now(),
        priority: request.priority
      });

    } catch (error) {
      this.logger.error('Conflict resolution failed', {
        taskId: request.taskId,
        error: error instanceof Error ? error.message : error
      });

      this.emitDelegationEvent({
        id: `conflict_failed_${request.taskId}_${Date.now()}`,
        type: 'conflict_detected',
        taskId: request.taskId,
        data: { conflictingTaskIds, error: error instanceof Error ? error.message : error },
        timestamp: Date.now(),
        priority: 'high'
      });

      throw new Error(`Conflict resolution failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handles auction-based task delegation
   * 
   * @private
   */
  private async handleAuctionBasedDelegation(request: TaskDelegationRequest): Promise<TaskRoutingDecision> {
    const auctionConfig: AuctionConfig = {
      duration: 30000, // 30 seconds
      minBids: 2,
      maxBids: 10,
      evaluationCriteria: {
        capabilityWeight: 0.4,
        timeWeight: 0.3,
        confidenceWeight: 0.2,
        trackRecordWeight: 0.1
      },
      sealedBidding: false
    };

    this.logger.info('Starting auction-based delegation', {
      taskId: request.taskId,
      duration: auctionConfig.duration
    });

    // Create auction state
    const auctionState: AuctionState = {
      task: request,
      config: auctionConfig,
      bids: [],
      startTime: Date.now(),
      endTime: Date.now() + auctionConfig.duration,
      status: 'active'
    };

    this.activeAuctions.set(request.taskId, auctionState);

    // Notify potential agents about the auction
    await this.notifyAgentsAboutAuction(request, auctionConfig);

    // Wait for auction to complete
    await new Promise(resolve => setTimeout(resolve, auctionConfig.duration));

    // Evaluate bids and select winner
    const winningBid = this.evaluateAuctionBids(auctionState);
    
    if (winningBid) {
      auctionState.winningBid = winningBid;
      auctionState.status = 'completed';

      this.emitDelegationEvent({
        id: `auction_completed_${request.taskId}_${Date.now()}`,
        type: 'auction_completed',
        taskId: request.taskId,
        agentId: winningBid.agentId,
        data: { winningBid, totalBids: auctionState.bids.length },
        timestamp: Date.now(),
        priority: request.priority
      });

      // Create routing decision from winning bid
      return {
        taskId: request.taskId,
        assignments: [{
          agentId: winningBid.agentId,
          role: 'primary',
          responsibilities: ['Execute auctioned task'],
          contributionPercentage: 100,
          capabilityScore: {
            agentId: winningBid.agentId,
            overallScore: winningBid.bidAmount,
            capabilityMatch: winningBid.bidAmount,
            availabilityScore: 100,
            performanceScore: winningBid.confidence * 100,
            responseTimeScore: 100,
            qualityScore: winningBid.confidence * 100,
            capabilityScores: {},
            reasoning: [`Won auction with bid: ${winningBid.bidAmount}`],
            confidence: winningBid.confidence
          },
          estimatedTime: winningBid.estimatedCompletionTime,
          priority: request.priority
        }],
        alternatives: [],
        delegationPattern: 'auction_based',
        executionPattern: 'sequential',
        estimatedDuration: winningBid.estimatedCompletionTime,
        confidence: winningBid.confidence,
        risks: [],
        fallbackOptions: [],
        reasoning: `Task awarded to ${winningBid.agentId} through auction process`,
        decidedAt: Date.now()
      };

    } else {
      auctionState.status = 'cancelled';
      
      // Fall back to regular routing
      this.logger.warn('Auction failed, falling back to regular routing', {
        taskId: request.taskId,
        bidsReceived: auctionState.bids.length
      });

      return this.taskRouter.routeTask(request);
    }
  }

  /**
   * Handles consensus-based task delegation
   * 
   * @private
   */
  private async handleConsensusBasedDelegation(request: TaskDelegationRequest): Promise<TaskRoutingDecision> {
    // Get multiple routing decisions and find consensus
    const routingAttempts = 3;
    const decisions: TaskRoutingDecision[] = [];

    for (let i = 0; i < routingAttempts; i++) {
      try {
        const decision = await this.taskRouter.routeTask(request);
        decisions.push(decision);
      } catch (error) {
        this.logger.warn('Routing attempt failed for consensus', {
          taskId: request.taskId,
          attempt: i + 1,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    if (decisions.length === 0) {
      throw new Error('All consensus routing attempts failed');
    }

    // Find consensus among decisions
    const consensusDecision = this.findConsensusDecision(decisions);
    consensusDecision.delegationPattern = 'consensus_based';
    consensusDecision.reasoning += ' (Consensus-based decision)';

    return consensusDecision;
  }

  /**
   * Finds consensus among multiple routing decisions
   * 
   * @private
   */
  private findConsensusDecision(decisions: TaskRoutingDecision[]): TaskRoutingDecision {
    // Count agent assignments across all decisions
    const agentVotes = new Map<string, number>();
    
    for (const decision of decisions) {
      for (const assignment of decision.assignments) {
        agentVotes.set(assignment.agentId, (agentVotes.get(assignment.agentId) || 0) + 1);
      }
    }

    // Find the most voted agent(s)
    const maxVotes = Math.max(...agentVotes.values());
    const consensusAgents = Array.from(agentVotes.entries())
      .filter(([_, votes]) => votes === maxVotes)
      .map(([agentId, _]) => agentId);

    // Use the best decision that includes consensus agents
    const bestDecision = decisions
      .filter(decision => 
        decision.assignments.some(assignment => 
          consensusAgents.includes(assignment.agentId)
        )
      )
      .sort((a, b) => b.confidence - a.confidence)[0] || decisions[0];

    return bestDecision;
  }

  /**
   * Creates active delegation tracking record
   * 
   * @private
   */
  private createActiveDelegation(
    request: TaskDelegationRequest,
    routingDecision: TaskRoutingDecision
  ): ActiveDelegation {
    return {
      request,
      routingDecision,
      status: 'delegated',
      assignedAgents: routingDecision.assignments.map(a => a.agentId),
      startTime: Date.now(),
      expectedCompletion: Date.now() + routingDecision.estimatedDuration,
      progress: 0,
      errors: [],
      retryCount: 0,
      metadata: {}
    };
  }

  /**
   * Starts monitoring a delegated task
   * 
   * @private
   */
  private startDelegationMonitoring(taskId: string): void {
    // Set up timeout monitoring
    const delegation = this.activeDelegations.get(taskId);
    if (!delegation) return;

    const timeout = delegation.request.deadline || 
      (Date.now() + (delegation.routingDecision.estimatedDuration * 1.5));

    setTimeout(() => {
      const currentDelegation = this.activeDelegations.get(taskId);
      if (currentDelegation && currentDelegation.status === 'in_progress') {
        this.logger.warn('Task delegation timeout', {
          taskId,
          timeout: timeout - Date.now()
        });

        this.emitDelegationEvent({
          id: `task_timeout_${taskId}_${Date.now()}`,
          type: 'task_failed',
          taskId,
          data: { reason: 'timeout', timeout },
          timestamp: Date.now(),
          priority: 'high'
        });

        // Attempt recovery
        this.attemptTaskRecovery(currentDelegation);
      }
    }, timeout - Date.now());
  }

  /**
   * Attempts to recover a failed task
   * 
   * @private
   */
  private async attemptTaskRecovery(delegation: ActiveDelegation): Promise<boolean> {
    if (delegation.retryCount >= 3) {
      this.logger.info('Maximum retry attempts reached', {
        taskId: delegation.request.taskId,
        retryCount: delegation.retryCount
      });
      return false;
    }

    delegation.retryCount++;
    delegation.status = 'queued';

    this.logger.info('Attempting task recovery', {
      taskId: delegation.request.taskId,
      retryCount: delegation.retryCount
    });

    try {
      // Try with fallback agents
      const fallbackOptions = delegation.routingDecision.fallbackOptions;
      if (fallbackOptions.length > 0) {
        const fallbackAgent = fallbackOptions[0];
        delegation.assignedAgents = [fallbackAgent.agentId];
        delegation.status = 'delegated';
        delegation.startTime = Date.now();
        
        return true;
      }

      // Re-route the task
      const newRoutingDecision = await this.taskRouter.routeTask(delegation.request);
      if (newRoutingDecision.assignments.length > 0) {
        delegation.routingDecision = newRoutingDecision;
        delegation.assignedAgents = newRoutingDecision.assignments.map(a => a.agentId);
        delegation.status = 'delegated';
        delegation.startTime = Date.now();
        
        return true;
      }

      return false;

    } catch (error) {
      this.logger.error('Task recovery failed', {
        taskId: delegation.request.taskId,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Notifies agents about an auction
   * 
   * @private
   */
  private async notifyAgentsAboutAuction(request: TaskDelegationRequest, config: AuctionConfig): Promise<void> {
    // Get potential agents
    const availableAgents = await this.getAllAvailableAgents();
    const suitableAgents = availableAgents.filter(agent => 
      request.requiredCapabilities.some(cap => 
        agent.specialization.includes(cap) || agent.tools.includes(cap)
      )
    );

    // Send auction notifications
    for (const agent of suitableAgents) {
      try {
        const auctionMessage = {
          id: `auction_${request.taskId}_${agent.id}_${Date.now()}`,
          fromAgentId: 'task_delegation_engine',
          toAgentId: agent.id,
          type: 'request' as const,
          content: `Auction started for task: ${request.description}`,
          data: {
            taskId: request.taskId,
            auctionConfig: config,
            taskRequirements: request,
            auctionEndTime: Date.now() + config.duration
          },
          timestamp: Date.now(),
          priority: request.priority
        };

        await this.communicationHub.sendMessage('task_delegation_engine', agent.id, auctionMessage);

      } catch (error) {
        this.logger.warn('Failed to notify agent about auction', {
          taskId: request.taskId,
          agentId: agent.id,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    this.emitDelegationEvent({
      id: `auction_started_${request.taskId}_${Date.now()}`,
      type: 'auction_started',
      taskId: request.taskId,
      data: { 
        notifiedAgents: suitableAgents.length,
        auctionDuration: config.duration
      },
      timestamp: Date.now(),
      priority: request.priority
    });
  }

  /**
   * Evaluates auction bids and selects winner
   * 
   * @private
   */
  private evaluateAuctionBids(auctionState: AuctionState): AgentBid | null {
    const { bids, config } = auctionState;

    if (bids.length < config.minBids) {
      this.logger.warn('Insufficient bids for auction', {
        taskId: auctionState.task.taskId,
        bidsReceived: bids.length,
        minRequired: config.minBids
      });
      return null;
    }

    // Score each bid based on evaluation criteria
    const scoredBids = bids.map(bid => {
      const score = 
        (bid.bidAmount / 100) * config.evaluationCriteria.capabilityWeight +
        (1 - (bid.estimatedCompletionTime / 3600000)) * config.evaluationCriteria.timeWeight + // Normalize to hours
        bid.confidence * config.evaluationCriteria.confidenceWeight +
        0.8 * config.evaluationCriteria.trackRecordWeight; // Simplified track record

      return { bid, score };
    });

    // Sort by score and select winner
    scoredBids.sort((a, b) => b.score - a.score);
    return scoredBids[0]?.bid || null;
  }

  /**
   * Sends assignment notifications to relevant parties
   * 
   * @private
   */
  private async sendAssignmentNotifications(
    request: TaskDelegationRequest,
    routingDecision: TaskRoutingDecision
  ): Promise<void> {
    // Notify assigned agents
    for (const assignment of routingDecision.assignments) {
      try {
        const assignmentMessage = {
          id: `assignment_${request.taskId}_${assignment.agentId}_${Date.now()}`,
          fromAgentId: 'task_delegation_engine',
          toAgentId: assignment.agentId,
          type: 'request' as const,
          content: `Task assigned: ${request.description}`,
          data: {
            taskId: request.taskId,
            assignment,
            taskRequirements: request,
            estimatedDuration: assignment.estimatedTime,
            priority: request.priority
          },
          timestamp: Date.now(),
          priority: request.priority
        };

        await this.communicationHub.sendMessage('task_delegation_engine', assignment.agentId, assignmentMessage);

      } catch (error) {
        this.logger.warn('Failed to send assignment notification', {
          taskId: request.taskId,
          agentId: assignment.agentId,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    // Notify requesting agent
    try {
      const confirmationMessage = {
        id: `confirmation_${request.taskId}_${Date.now()}`,
        fromAgentId: 'task_delegation_engine',
        toAgentId: request.requestedBy,
        type: 'response' as const,
        content: `Task delegation completed for: ${request.description}`,
        data: {
          taskId: request.taskId,
          assignedAgents: routingDecision.assignments.map(a => a.agentId),
          estimatedCompletion: Date.now() + routingDecision.estimatedDuration,
          confidence: routingDecision.confidence
        },
        timestamp: Date.now(),
        priority: request.priority
      };

      await this.communicationHub.sendMessage('task_delegation_engine', request.requestedBy, confirmationMessage);

    } catch (error) {
      this.logger.warn('Failed to send confirmation to requesting agent', {
        taskId: request.taskId,
        requestedBy: request.requestedBy,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Sends completion notifications
   * 
   * @private
   */
  private async sendCompletionNotifications(delegation: ActiveDelegation): Promise<void> {
    const completionMessage = {
      id: `completion_${delegation.request.taskId}_${Date.now()}`,
      fromAgentId: 'task_delegation_engine',
      toAgentId: delegation.request.requestedBy,
      type: 'notification' as const,
      content: `Task completed: ${delegation.request.description}`,
      data: {
        taskId: delegation.request.taskId,
        completionTime: delegation.actualCompletion,
        assignedAgents: delegation.assignedAgents,
        progress: delegation.progress
      },
      timestamp: Date.now(),
      priority: delegation.request.priority
    };

    try {
      await this.communicationHub.sendMessage('task_delegation_engine', delegation.request.requestedBy, completionMessage);
    } catch (error) {
      this.logger.warn('Failed to send completion notification', {
        taskId: delegation.request.taskId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Sends failure notifications
   * 
   * @private
   */
  private async sendFailureNotifications(delegation: ActiveDelegation, error: string): Promise<void> {
    const failureMessage = {
      id: `failure_${delegation.request.taskId}_${Date.now()}`,
      fromAgentId: 'task_delegation_engine',
      toAgentId: delegation.request.requestedBy,
      type: 'notification' as const,
      content: `Task failed: ${delegation.request.description}`,
      data: {
        taskId: delegation.request.taskId,
        error,
        assignedAgents: delegation.assignedAgents,
        progress: delegation.progress,
        retryCount: delegation.retryCount
      },
      timestamp: Date.now(),
      priority: 'high' as const
    };

    try {
      await this.communicationHub.sendMessage('task_delegation_engine', delegation.request.requestedBy, failureMessage);
    } catch (messageError) {
      this.logger.warn('Failed to send failure notification', {
        taskId: delegation.request.taskId,
        error: messageError instanceof Error ? messageError.message : messageError
      });
    }
  }

  /**
   * Gets all available agents from registry
   * 
   * @private
   */
  private async getAllAvailableAgents(): Promise<AgentProfile[]> {
    return this.agentRegistry.getAllAgents().filter(agent => {
      const status = this.agentRegistry.getAgentStatus(agent.id);
      return status !== 'offline' && status !== 'error';
    });
  }

  /**
   * Updates complexity distribution statistics
   * 
   * @private
   */
  private updateComplexityDistribution(complexity: TaskComplexity): void {
    if (!this.statistics.complexityDistribution[complexity]) {
      this.statistics.complexityDistribution[complexity] = 0;
    }
    this.statistics.complexityDistribution[complexity]++;
  }

  /**
   * Updates delegation pattern usage statistics
   * 
   * @private
   */
  private updateDelegationPatternUsage(pattern: DelegationPattern): void {
    if (!this.statistics.delegationPatternUsage[pattern]) {
      this.statistics.delegationPatternUsage[pattern] = 0;
    }
    this.statistics.delegationPatternUsage[pattern]++;
  }

  /**
   * Updates agent utilization statistics
   * 
   * @private
   */
  private updateAgentUtilization(): void {
    const agentTaskCounts = new Map<string, number>();

    for (const delegation of this.activeDelegations.values()) {
      for (const agentId of delegation.assignedAgents) {
        agentTaskCounts.set(agentId, (agentTaskCounts.get(agentId) || 0) + 1);
      }
    }

    this.statistics.agentUtilization = Object.fromEntries(agentTaskCounts);
  }

  /**
   * Initializes performance monitoring
   * 
   * @private
   */
  private initializeMonitoring(): void {
    if (!this.config.monitoring.enableAdaptiveOptimization) {
      return;
    }

    // Performance monitoring
    this.performanceMonitoringInterval = setInterval(() => {
      this.monitorPerformance();
    }, this.config.monitoring.metricsInterval);

    // Optimization triggers
    this.optimizationInterval = setInterval(() => {
      this.checkOptimizationTriggers();
    }, 60000); // Check every minute

    // Statistics updates
    this.statisticsInterval = setInterval(() => {
      this.updateStatistics();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Monitors engine performance
   * 
   * @private
   */
  private monitorPerformance(): void {
    try {
      // Check for performance anomalies
      const thresholds = this.config.monitoring.anomalyThresholds;
      
      if (this.statistics.avgRoutingTime > thresholds.responseTime) {
        this.emitDelegationEvent({
          id: `perf_alert_routing_${Date.now()}`,
          type: 'performance_alert',
          taskId: 'system',
          data: {
            metric: 'routing_time',
            value: this.statistics.avgRoutingTime,
            threshold: thresholds.responseTime
          },
          timestamp: Date.now(),
          priority: 'high'
        });
      }

      const successRate = this.statistics.successfulDelegations / Math.max(1, this.statistics.totalTasksProcessed);
      if (successRate < thresholds.successRate) {
        this.emitDelegationEvent({
          id: `perf_alert_success_${Date.now()}`,
          type: 'performance_alert',
          taskId: 'system',
          data: {
            metric: 'success_rate',
            value: successRate,
            threshold: thresholds.successRate
          },
          timestamp: Date.now(),
          priority: 'high'
        });
      }

    } catch (error) {
      this.logger.error('Performance monitoring error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Checks optimization triggers
   * 
   * @private
   */
  private checkOptimizationTriggers(): void {
    try {
      const triggers = this.config.monitoring.optimizationTriggers;
      
      const failedRate = this.statistics.failedDelegations / Math.max(1, this.statistics.totalTasksProcessed);
      
      if (failedRate > triggers.failedDelegationRate ||
          this.statistics.avgRoutingTime > triggers.avgResponseTime) {
        
        this.emitDelegationEvent({
          id: `optimization_trigger_${Date.now()}`,
          type: 'optimization_triggered',
          taskId: 'system',
          data: {
            failedRate,
            avgRoutingTime: this.statistics.avgRoutingTime,
            triggers
          },
          timestamp: Date.now(),
          priority: 'normal'
        });

        // Trigger optimization
        this.performOptimization();
      }

    } catch (error) {
      this.logger.error('Optimization trigger check error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Performs adaptive optimization
   * 
   * @private
   */
  private performOptimization(): void {
    this.logger.info('Performing adaptive optimization');
    
    // Update capability matcher statistics
    const allAgents = this.agentRegistry.getAllAgents()
      .map(agent => this.agentRegistry.getAgentDetails(agent.id))
      .filter(details => details !== null);

    this.capabilityMatcher.updateStatistics(allAgents);

    // Trigger load rebalancing
    this.taskRouter.rebalanceLoad().catch(error => {
      this.logger.error('Load rebalancing failed during optimization', {
        error: error instanceof Error ? error.message : error
      });
    });
  }

  /**
   * Updates engine statistics
   * 
   * @private
   */
  private updateStatistics(): void {
    this.updateAgentUtilization();
    this.statistics.lastUpdated = Date.now();
  }

  /**
   * Sets up event handlers for component integration
   * 
   * @private
   */
  private setupEventHandlers(): void {
    // Handle task router events
    this.taskRouter.on('taskRouted', (event) => {
      this.emitDelegationEvent({
        id: `task_routed_${event.taskId}_${Date.now()}`,
        type: 'task_assigned',
        taskId: event.taskId,
        data: event,
        timestamp: Date.now(),
        priority: 'normal'
      });
    });

    // Handle workflow orchestrator events
    this.workflowOrchestrator.on('workflowEvent', (event) => {
      this.emitDelegationEvent({
        id: `workflow_${event.type}_${Date.now()}`,
        type: event.type === 'workflow_completed' ? 'task_completed' : 'task_progress',
        taskId: event.workflowId,
        data: event.data,
        timestamp: event.timestamp,
        priority: 'normal'
      });
    });
  }

  /**
   * Emits delegation events
   * 
   * @private
   */
  private emitDelegationEvent(event: DelegationEvent): void {
    this.emit('delegationEvent', event);
    
    if (this.notificationConfig.channels.includes('system_log')) {
      this.logger.info('Delegation event', {
        eventType: event.type,
        taskId: event.taskId,
        agentId: event.agentId
      });
    }
  }

  /**
   * Receives bids for auction-based delegations
   * 
   * @param taskId - Task identifier
   * @param bid - Agent bid
   */
  async receiveBid(taskId: string, bid: AgentBid): Promise<void> {
    const auction = this.activeAuctions.get(taskId);
    if (!auction || auction.status !== 'active') {
      this.logger.warn('Bid received for inactive auction', { taskId, agentId: bid.agentId });
      return;
    }

    if (Date.now() > auction.endTime) {
      this.logger.warn('Bid received after auction end', { taskId, agentId: bid.agentId });
      return;
    }

    if (auction.bids.length >= auction.config.maxBids) {
      this.logger.warn('Maximum bids reached for auction', { taskId });
      return;
    }

    auction.bids.push(bid);

    this.emitDelegationEvent({
      id: `bid_received_${taskId}_${bid.agentId}_${Date.now()}`,
      type: 'auction_bid_received',
      taskId,
      agentId: bid.agentId,
      data: { bid, totalBids: auction.bids.length },
      timestamp: Date.now(),
      priority: 'normal'
    });

    this.logger.info('Bid received for auction', {
      taskId,
      agentId: bid.agentId,
      bidAmount: bid.bidAmount,
      totalBids: auction.bids.length
    });
  }

  /**
   * Shuts down the task delegation engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down TaskDelegationEngine');

    // Clear monitoring intervals
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
    }
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
    }

    // Shutdown components
    await Promise.all([
      this.taskRouter.shutdown(),
      this.workflowOrchestrator.shutdown()
    ]);

    // Clear caches and state
    this.capabilityMatcher.clearCaches();
    this.activeDelegations.clear();
    this.activeAuctions.clear();

    this.logger.info('TaskDelegationEngine shutdown complete');
  }
}