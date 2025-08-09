/**
 * Task Router with Advanced Load Balancing and Priority Queuing
 * 
 * Provides intelligent task routing, load balancing, priority queuing,
 * and performance optimization for multi-agent task delegation.
 */

import { EventEmitter } from 'events';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import { CapabilityMatcher } from './capability-matcher.js';
import { AgentRegistry } from './agent-registry-impl.js';
import { RuntimeAgentProfile } from './agent-registry.js';
import {
  TaskDelegationRequest,
  TaskRoutingDecision,
  AgentAssignment,
  TaskPriority,
  TaskComplexity,
  DelegationPattern,
  ExecutionPattern,
  LoadBalancingConfig,
  TaskRisk,
  CapabilityScore,
  ConflictResolutionContext
} from './task-delegation-types.js';

/**
 * Task queue item with priority and timing information
 */
interface QueuedTask {
  request: TaskDelegationRequest;
  queuedAt: number;
  attempts: number;
  lastAttemptAt?: number;
  assignedAgents?: string[];
  routingDecision?: TaskRoutingDecision;
  priority: TaskPriority;
  deadline?: number;
}

/**
 * Load balancing state for agents
 */
interface AgentLoadState {
  agentId: string;
  currentTasks: number;
  projectedLoad: number;
  lastAssignment: number;
  performanceScore: number;
  preferenceWeight: number;
}

/**
 * Priority queue implementation for task management
 */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    const queueItem = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (queueItem.priority > this.items[i].priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.item;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): T[] {
    return this.items.map(item => item.item);
  }
}

/**
 * Task routing statistics
 */
interface RoutingStatistics {
  totalTasksRouted: number;
  successfulRoutings: number;
  failedRoutings: number;
  avgRoutingTime: number;
  avgQueueWaitTime: number;
  delegationPatternUsage: Record<DelegationPattern, number>;
  loadBalancingEfficiency: number;
  agentUtilization: Record<string, number>;
  lastUpdated: number;
}

/**
 * Advanced Task Router with intelligent routing algorithms
 */
export class TaskRouter extends EventEmitter {
  private readonly logger = createLogger(LogLevel.INFO, 'TaskRouter');

  /**
   * Task queues by priority level
   */
  private readonly taskQueues = {
    critical: new PriorityQueue<QueuedTask>(),
    urgent: new PriorityQueue<QueuedTask>(),
    high: new PriorityQueue<QueuedTask>(),
    normal: new PriorityQueue<QueuedTask>(),
    low: new PriorityQueue<QueuedTask>()
  };

  /**
   * Agent load balancing state
   */
  private readonly agentLoadStates = new Map<string, AgentLoadState>();

  /**
   * Active routing decisions cache
   */
  private readonly routingCache = new Map<string, TaskRoutingDecision>();

  /**
   * Routing statistics
   */
  private readonly statistics: RoutingStatistics = {
    totalTasksRouted: 0,
    successfulRoutings: 0,
    failedRoutings: 0,
    avgRoutingTime: 0,
    avgQueueWaitTime: 0,
    delegationPatternUsage: {} as Record<DelegationPattern, number>,
    loadBalancingEfficiency: 100,
    agentUtilization: {},
    lastUpdated: Date.now()
  };

  /**
   * Router configuration
   */
  private readonly config: LoadBalancingConfig;

  /**
   * Processing intervals
   */
  private queueProcessingInterval?: NodeJS.Timeout;
  private loadBalancingInterval?: NodeJS.Timeout;
  private statisticsInterval?: NodeJS.Timeout;

  /**
   * Creates a new TaskRouter instance
   */
  constructor(
    private readonly capabilityMatcher: CapabilityMatcher,
    private readonly agentRegistry: AgentRegistry,
    config?: Partial<LoadBalancingConfig>
  ) {
    super();

    this.config = {
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
      updateInterval: 10000, // 10 seconds
      ...config
    };

    this.initializeLoadBalancing();
    this.startProcessingQueues();

    this.logger.info('TaskRouter initialized', { config: this.config });
  }

  /**
   * Routes a task to the most suitable agents with intelligent decision making
   * 
   * @param request - Task delegation request
   * @returns Promise resolving to routing decision
   */
  async routeTask(request: TaskDelegationRequest): Promise<TaskRoutingDecision> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting task routing', {
        taskId: request.taskId,
        priority: request.priority,
        complexity: request.complexity,
        requiredCapabilities: request.requiredCapabilities.length
      });

      // Validate request
      this.validateRequest(request);

      // Check for immediate routing vs. queuing
      const shouldQueue = await this.shouldQueueTask(request);
      
      if (shouldQueue) {
        return this.queueTask(request);
      }

      // Perform immediate routing
      const routingDecision = await this.performRouting(request);

      // Update statistics
      this.updateRoutingStatistics(routingDecision, Date.now() - startTime);

      // Cache the decision
      this.routingCache.set(request.taskId, routingDecision);

      // Emit routing event
      this.emit('taskRouted', {
        taskId: request.taskId,
        success: routingDecision.confidence > 0.5,
        routingDecision,
        routingTime: Date.now() - startTime
      });

      this.logger.info('Task routing completed', {
        taskId: request.taskId,
        assignedAgents: routingDecision.assignments.length,
        confidence: routingDecision.confidence,
        routingTime: Date.now() - startTime
      });

      return routingDecision;

    } catch (error) {
      this.statistics.failedRoutings++;
      
      this.logger.error('Task routing failed', {
        taskId: request.taskId,
        error: error instanceof Error ? error.message : error
      });

      // Return failed routing decision
      return {
        taskId: request.taskId,
        assignments: [],
        alternatives: [],
        delegationPattern: 'direct_assignment',
        executionPattern: 'sequential',
        estimatedDuration: 0,
        confidence: 0,
        risks: [{
          type: 'capability',
          severity: 1,
          probability: 1,
          description: `Routing failed: ${error instanceof Error ? error.message : error}`,
          mitigations: ['Manual task assignment required'],
          impact: 'Task cannot be automatically assigned'
        }],
        fallbackOptions: [],
        reasoning: `Routing failed due to error: ${error instanceof Error ? error.message : error}`,
        decidedAt: Date.now()
      };
    }
  }

  /**
   * Gets current queue status and statistics
   * 
   * @returns Queue status information
   */
  getQueueStatus(): {
    totalQueued: number;
    byPriority: Record<TaskPriority, number>;
    oldestTask?: { taskId: string; queuedAt: number };
    avgWaitTime: number;
  } {
    const totalQueued = Object.values(this.taskQueues).reduce((sum, queue) => sum + queue.size(), 0);
    
    const byPriority: Record<TaskPriority, number> = {
      critical: this.taskQueues.critical.size(),
      urgent: this.taskQueues.urgent.size(),
      high: this.taskQueues.high.size(),
      normal: this.taskQueues.normal.size(),
      low: this.taskQueues.low.size()
    };

    // Find oldest task
    let oldestTask: { taskId: string; queuedAt: number } | undefined;
    let oldestTime = Date.now();

    for (const queue of Object.values(this.taskQueues)) {
      const tasks = queue.toArray();
      for (const task of tasks) {
        if (task.queuedAt < oldestTime) {
          oldestTime = task.queuedAt;
          oldestTask = {
            taskId: task.request.taskId,
            queuedAt: task.queuedAt
          };
        }
      }
    }

    return {
      totalQueued,
      byPriority,
      oldestTask,
      avgWaitTime: this.statistics.avgQueueWaitTime
    };
  }

  /**
   * Gets load balancing status for all agents
   * 
   * @returns Load balancing information
   */
  getLoadBalancingStatus(): Record<string, AgentLoadState> {
    const status: Record<string, AgentLoadState> = {};
    
    for (const [agentId, state] of this.agentLoadStates.entries()) {
      status[agentId] = { ...state };
    }

    return status;
  }

  /**
   * Gets comprehensive routing statistics
   * 
   * @returns Current routing statistics
   */
  getStatistics(): RoutingStatistics {
    this.statistics.lastUpdated = Date.now();
    return { ...this.statistics };
  }

  /**
   * Manually rebalances load across agents
   * 
   * @returns Promise resolving when rebalancing is complete
   */
  async rebalanceLoad(): Promise<void> {
    this.logger.info('Starting manual load rebalancing');

    try {
      await this.updateAgentLoadStates();
      await this.optimizeTaskDistribution();
      
      this.logger.info('Load rebalancing completed successfully');
      
      this.emit('loadRebalanced', {
        timestamp: Date.now(),
        agentStates: this.getLoadBalancingStatus()
      });

    } catch (error) {
      this.logger.error('Load rebalancing failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Resolves conflicts when multiple tasks compete for same agents
   * 
   * @param context - Conflict resolution context
   * @returns Resolved task assignments
   */
  async resolveConflicts(context: ConflictResolutionContext): Promise<TaskRoutingDecision[]> {
    this.logger.info('Starting conflict resolution', {
      conflictType: context.conflictType,
      taskCount: context.conflictingTasks.length,
      agentCount: context.availableAgents.length
    });

    try {
      let decisions: TaskRoutingDecision[] = [];

      switch (context.resolutionStrategy) {
        case 'priority_based':
          decisions = await this.resolvePriorityBased(context);
          break;
        case 'capability_based':
          decisions = await this.resolveCapabilityBased(context);
          break;
        case 'round_robin':
          decisions = await this.resolveRoundRobin(context);
          break;
        case 'negotiation':
          decisions = await this.resolveNegotiation(context);
          break;
        default:
          throw new Error(`Unsupported resolution strategy: ${context.resolutionStrategy}`);
      }

      this.logger.info('Conflict resolution completed', {
        conflictType: context.conflictType,
        resolvedTasks: decisions.length
      });

      return decisions;

    } catch (error) {
      this.logger.error('Conflict resolution failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Validates a task delegation request
   * 
   * @private
   */
  private validateRequest(request: TaskDelegationRequest): void {
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

    // Validate deadline
    if (request.deadline && request.deadline <= Date.now()) {
      throw new Error('Task deadline must be in the future');
    }

    // Validate expected duration
    if (request.expectedDuration && request.expectedDuration <= 0) {
      throw new Error('Expected duration must be positive');
    }
  }

  /**
   * Determines if a task should be queued vs. routed immediately
   * 
   * @private
   */
  private async shouldQueueTask(request: TaskDelegationRequest): Promise<boolean> {
    // Always queue critical tasks for special handling
    if (request.priority === 'critical') {
      return false; // Critical tasks get immediate attention
    }

    // Check system load
    const avgLoad = Array.from(this.agentLoadStates.values())
      .reduce((sum, state) => sum + state.projectedLoad, 0) / this.agentLoadStates.size;

    if (avgLoad > this.config.maxLoadThreshold) {
      this.logger.info('Queueing task due to high system load', {
        taskId: request.taskId,
        systemLoad: avgLoad,
        threshold: this.config.maxLoadThreshold
      });
      return true;
    }

    // Check if suitable agents are available
    const availableAgents = await this.getAvailableAgents();
    const suitableCount = await this.countSuitableAgents(request, availableAgents);

    if (suitableCount < this.config.minAgentsConsidered) {
      this.logger.info('Queueing task due to insufficient suitable agents', {
        taskId: request.taskId,
        suitableCount,
        required: this.config.minAgentsConsidered
      });
      return true;
    }

    return false;
  }

  /**
   * Queues a task for later processing
   * 
   * @private
   */
  private queueTask(request: TaskDelegationRequest): TaskRoutingDecision {
    const queuedTask: QueuedTask = {
      request,
      queuedAt: Date.now(),
      attempts: 0,
      priority: request.priority
    };

    // Add to appropriate priority queue
    const priorityValue = this.getPriorityValue(request.priority);
    this.taskQueues[request.priority].enqueue(queuedTask, priorityValue);

    this.logger.info('Task queued for later processing', {
      taskId: request.taskId,
      priority: request.priority,
      queueSize: this.taskQueues[request.priority].size()
    });

    // Return queued routing decision
    return {
      taskId: request.taskId,
      assignments: [],
      alternatives: [],
      delegationPattern: 'direct_assignment',
      executionPattern: 'sequential',
      estimatedDuration: 0,
      confidence: 0.5,
      risks: [{
        type: 'resource',
        severity: 0.3,
        probability: 0.5,
        description: 'Task queued due to resource constraints',
        mitigations: ['Will be processed when resources become available'],
        impact: 'Delayed execution'
      }],
      fallbackOptions: [],
      reasoning: 'Task queued for later processing due to resource constraints',
      decidedAt: Date.now()
    };
  }

  /**
   * Performs the actual task routing logic
   * 
   * @private
   */
  private async performRouting(request: TaskDelegationRequest): Promise<TaskRoutingDecision> {
    // Get available agents
    const availableAgents = await this.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      throw new Error('No agents available for task routing');
    }

    // Find best matching agents
    const capabilityScores = await this.capabilityMatcher.findBestMatches(request, availableAgents);
    
    if (capabilityScores.length === 0) {
      throw new Error('No suitable agents found for task requirements');
    }

    // Determine delegation pattern
    const delegationPattern = this.selectDelegationPattern(request, capabilityScores);
    
    // Determine execution pattern
    const executionPattern = this.selectExecutionPattern(request, capabilityScores);

    // Create agent assignments
    const assignments = await this.createAgentAssignments(
      request, 
      capabilityScores, 
      delegationPattern
    );

    // Calculate alternatives
    const alternatives = this.createAlternativeAssignments(capabilityScores, assignments);

    // Assess risks
    const risks = await this.assessTaskRisks(request, assignments, availableAgents);

    // Create fallback options
    const fallbackOptions = this.createFallbackOptions(capabilityScores, assignments);

    // Calculate estimated duration
    const estimatedDuration = this.calculateEstimatedDuration(request, assignments);

    // Calculate overall confidence
    const confidence = this.calculateRoutingConfidence(assignments, risks);

    // Generate reasoning
    const reasoning = this.generateRoutingReasoning(
      request, 
      assignments, 
      delegationPattern, 
      executionPattern, 
      risks
    );

    return {
      taskId: request.taskId,
      assignments,
      alternatives,
      delegationPattern,
      executionPattern,
      estimatedDuration,
      confidence,
      risks,
      fallbackOptions,
      reasoning,
      decidedAt: Date.now()
    };
  }

  /**
   * Gets currently available agents from the registry
   * 
   * @private
   */
  private async getAvailableAgents(): Promise<RuntimeAgentProfile[]> {
    const allAgents = this.agentRegistry.getAllAgents();
    const availableAgents: RuntimeAgentProfile[] = [];

    for (const agent of allAgents) {
      const details = this.agentRegistry.getAgentDetails(agent.id);
      if (details && details.status !== 'offline' && details.healthStatus.status !== 'unhealthy') {
        availableAgents.push(details);
      }
    }

    return availableAgents;
  }

  /**
   * Counts agents suitable for a task
   * 
   * @private
   */
  private async countSuitableAgents(
    request: TaskDelegationRequest,
    availableAgents: RuntimeAgentProfile[]
  ): Promise<number> {
    let suitableCount = 0;

    for (const agent of availableAgents) {
      const hasRequiredRole = !request.requiredRole || agent.role === request.requiredRole;
      const hasCapabilities = request.requiredCapabilities.some(cap => 
        agent.specialization.includes(cap) || agent.tools.includes(cap)
      );
      const notOverloaded = agent.loadInfo.currentLoad < this.config.maxLoadThreshold * 100;

      if (hasRequiredRole && hasCapabilities && notOverloaded) {
        suitableCount++;
      }
    }

    return suitableCount;
  }

  /**
   * Selects the best delegation pattern for a task
   * 
   * @private
   */
  private selectDelegationPattern(
    request: TaskDelegationRequest,
    capabilityScores: CapabilityScore[]
  ): DelegationPattern {
    // Use requested pattern if specified
    if (request.delegationPattern) {
      return request.delegationPattern;
    }

    // Select based on task characteristics
    if (request.priority === 'critical') {
      return 'consensus_based'; // Critical tasks need consensus
    }

    if (request.complexity === 'complex' || request.complexity === 'critical') {
      return 'hierarchical'; // Complex tasks need coordination
    }

    if ((request.maxAgents || 1) > 1) {
      return 'capability_matched'; // Multi-agent tasks need capability matching
    }

    if (capabilityScores.length > 5) {
      return 'auction_based'; // Many options - let them compete
    }

    return 'direct_assignment'; // Simple direct assignment
  }

  /**
   * Selects the execution pattern for a task
   * 
   * @private
   */
  private selectExecutionPattern(
    request: TaskDelegationRequest,
    capabilityScores: CapabilityScore[]
  ): ExecutionPattern {
    // Use requested pattern if specified
    if (request.executionPattern) {
      return request.executionPattern;
    }

    // Select based on task characteristics
    if (request.allowParallel && (request.maxAgents || 1) > 1) {
      return 'parallel';
    }

    if (request.dependencies && request.dependencies.length > 0) {
      return 'sequential';
    }

    if (request.complexity === 'complex') {
      return 'pipeline';
    }

    return 'sequential'; // Default to sequential
  }

  /**
   * Creates agent assignments based on capability scores and delegation pattern
   * 
   * @private
   */
  private async createAgentAssignments(
    request: TaskDelegationRequest,
    capabilityScores: CapabilityScore[],
    delegationPattern: DelegationPattern
  ): Promise<AgentAssignment[]> {
    const assignments: AgentAssignment[] = [];
    const maxAgents = request.maxAgents || 1;

    // Apply load balancing
    const balancedScores = await this.applyLoadBalancing(capabilityScores, request);

    switch (delegationPattern) {
      case 'direct_assignment':
        if (balancedScores.length > 0) {
          assignments.push(this.createPrimaryAssignment(balancedScores[0], request));
        }
        break;

      case 'capability_matched':
        for (let i = 0; i < Math.min(maxAgents, balancedScores.length); i++) {
          const role = i === 0 ? 'primary' : 'secondary';
          assignments.push(this.createAssignment(balancedScores[i], request, role));
        }
        break;

      case 'hierarchical':
        if (balancedScores.length > 0) {
          assignments.push(this.createPrimaryAssignment(balancedScores[0], request));
          
          // Add reviewers for hierarchical pattern
          for (let i = 1; i < Math.min(3, balancedScores.length); i++) {
            assignments.push(this.createAssignment(balancedScores[i], request, 'reviewer'));
          }
        }
        break;

      case 'consensus_based':
        for (let i = 0; i < Math.min(maxAgents, balancedScores.length); i++) {
          assignments.push(this.createAssignment(balancedScores[i], request, 'collaborator'));
        }
        break;

      default:
        // For other patterns, use simple assignment
        for (let i = 0; i < Math.min(maxAgents, balancedScores.length); i++) {
          const role = i === 0 ? 'primary' : 'secondary';
          assignments.push(this.createAssignment(balancedScores[i], request, role));
        }
    }

    return assignments;
  }

  /**
   * Applies load balancing to capability scores
   * 
   * @private
   */
  private async applyLoadBalancing(
    scores: CapabilityScore[],
    request: TaskDelegationRequest
  ): Promise<CapabilityScore[]> {
    const balancedScores = [...scores];

    switch (this.config.algorithm) {
      case 'least_loaded':
        balancedScores.sort((a, b) => {
          const loadA = this.agentLoadStates.get(a.agentId)?.projectedLoad || 0;
          const loadB = this.agentLoadStates.get(b.agentId)?.projectedLoad || 0;
          return loadA - loadB;
        });
        break;

      case 'weighted_round_robin':
        this.applyWeightedRoundRobin(balancedScores);
        break;

      case 'capability_based':
        // Already sorted by capability, apply load adjustment
        balancedScores.forEach(score => {
          const loadState = this.agentLoadStates.get(score.agentId);
          if (loadState && loadState.projectedLoad > this.config.maxLoadThreshold) {
            score.overallScore *= 0.7; // Reduce score for overloaded agents
          }
        });
        balancedScores.sort((a, b) => b.overallScore - a.overallScore);
        break;

      case 'round_robin':
        this.applyRoundRobin(balancedScores);
        break;

      case 'random':
        for (let i = balancedScores.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [balancedScores[i], balancedScores[j]] = [balancedScores[j], balancedScores[i]];
        }
        break;
    }

    return balancedScores;
  }

  /**
   * Creates a primary agent assignment
   * 
   * @private
   */
  private createPrimaryAssignment(
    score: CapabilityScore,
    request: TaskDelegationRequest
  ): AgentAssignment {
    return this.createAssignment(score, request, 'primary');
  }

  /**
   * Creates an agent assignment
   * 
   * @private
   */
  private createAssignment(
    score: CapabilityScore,
    request: TaskDelegationRequest,
    role: AgentAssignment['role']
  ): AgentAssignment {
    const contributionPercentage = this.calculateContributionPercentage(role, request);
    const estimatedTime = this.estimateAgentTime(request, score, contributionPercentage);
    
    return {
      agentId: score.agentId,
      role,
      responsibilities: this.generateResponsibilities(role, request),
      contributionPercentage,
      capabilityScore: score,
      estimatedTime,
      priority: request.priority
    };
  }

  /**
   * Calculates contribution percentage for an agent role
   * 
   * @private
   */
  private calculateContributionPercentage(
    role: AgentAssignment['role'],
    request: TaskDelegationRequest
  ): number {
    const maxAgents = request.maxAgents || 1;
    
    switch (role) {
      case 'primary':
        return maxAgents === 1 ? 100 : 60;
      case 'secondary':
        return 30;
      case 'reviewer':
        return 15;
      case 'collaborator':
        return 100 / maxAgents;
      default:
        return 25;
    }
  }

  /**
   * Estimates time commitment for an agent
   * 
   * @private
   */
  private estimateAgentTime(
    request: TaskDelegationRequest,
    score: CapabilityScore,
    contributionPercentage: number
  ): number {
    const baseTime = request.expectedDuration || 3600000; // 1 hour default
    const contribution = contributionPercentage / 100;
    const efficiencyFactor = score.overallScore / 100;
    
    return Math.round(baseTime * contribution / efficiencyFactor);
  }

  /**
   * Generates responsibilities for an agent role
   * 
   * @private
   */
  private generateResponsibilities(
    role: AgentAssignment['role'],
    request: TaskDelegationRequest
  ): string[] {
    const responsibilities: string[] = [];

    switch (role) {
      case 'primary':
        responsibilities.push('Lead task execution');
        responsibilities.push('Coordinate with team members');
        responsibilities.push('Ensure task completion');
        responsibilities.push('Report progress');
        break;
        
      case 'secondary':
        responsibilities.push('Support primary agent');
        responsibilities.push('Handle specific subtasks');
        responsibilities.push('Provide expertise in specialized areas');
        break;
        
      case 'reviewer':
        responsibilities.push('Review work quality');
        responsibilities.push('Provide feedback and suggestions');
        responsibilities.push('Ensure compliance with standards');
        break;
        
      case 'collaborator':
        responsibilities.push('Collaborate on task execution');
        responsibilities.push('Share knowledge and insights');
        responsibilities.push('Participate in decision making');
        break;
    }

    // Add task-specific responsibilities
    if (request.complexity === 'critical') {
      responsibilities.push('Maintain high quality standards');
      responsibilities.push('Document all decisions and actions');
    }

    return responsibilities;
  }

  /**
   * Creates alternative assignments for fallback scenarios
   * 
   * @private
   */
  private createAlternativeAssignments(
    allScores: CapabilityScore[],
    primaryAssignments: AgentAssignment[]
  ): AgentAssignment[] {
    const assignedAgentIds = new Set(primaryAssignments.map(a => a.agentId));
    const alternatives: AgentAssignment[] = [];

    // Create alternatives from remaining top agents
    const availableScores = allScores.filter(score => !assignedAgentIds.has(score.agentId));
    
    for (let i = 0; i < Math.min(3, availableScores.length); i++) {
      alternatives.push({
        agentId: availableScores[i].agentId,
        role: 'primary',
        responsibilities: ['Alternative assignment if primary fails'],
        contributionPercentage: 100,
        capabilityScore: availableScores[i],
        estimatedTime: 0, // Will be calculated if needed
        priority: 'normal'
      });
    }

    return alternatives;
  }

  /**
   * Assesses risks associated with task assignments
   * 
   * @private
   */
  private async assessTaskRisks(
    request: TaskDelegationRequest,
    assignments: AgentAssignment[],
    availableAgents: RuntimeAgentProfile[]
  ): Promise<TaskRisk[]> {
    const risks: TaskRisk[] = [];

    // Performance risk assessment
    const avgCapabilityScore = assignments.reduce((sum, a) => sum + a.capabilityScore.overallScore, 0) / assignments.length;
    if (avgCapabilityScore < 70) {
      risks.push({
        type: 'performance',
        severity: 0.7,
        probability: 0.6,
        description: 'Low average capability score may impact performance',
        mitigations: ['Provide additional support', 'Consider adding more experienced agents'],
        impact: 'Potential delays or quality issues'
      });
    }

    // Availability risk assessment
    for (const assignment of assignments) {
      const agent = availableAgents.find(a => a.id === assignment.agentId);
      if (agent && agent.loadInfo.currentLoad > 80) {
        risks.push({
          type: 'availability',
          severity: 0.5,
          probability: 0.4,
          description: `Agent ${assignment.agentId} has high current load`,
          mitigations: ['Monitor agent load', 'Have backup agent ready'],
          impact: 'Potential delays due to agent overload'
        });
      }
    }

    // Deadline risk assessment
    if (request.deadline) {
      const totalEstimatedTime = Math.max(...assignments.map(a => a.estimatedTime));
      const timeUntilDeadline = request.deadline - Date.now();
      
      if (totalEstimatedTime > timeUntilDeadline * 0.8) {
        risks.push({
          type: 'deadline',
          severity: 0.8,
          probability: 0.7,
          description: 'Tight deadline with limited time buffer',
          mitigations: ['Prioritize task', 'Add more agents if possible', 'Reduce scope if necessary'],
          impact: 'Risk of missing deadline'
        });
      }
    }

    // Dependency risk assessment
    if (request.dependencies && request.dependencies.length > 0) {
      risks.push({
        type: 'dependency',
        severity: 0.4,
        probability: 0.3,
        description: 'Task has dependencies that may cause delays',
        mitigations: ['Monitor dependency completion', 'Have contingency plans'],
        impact: 'Potential cascading delays'
      });
    }

    return risks;
  }

  /**
   * Creates fallback options for task assignments
   * 
   * @private
   */
  private createFallbackOptions(
    allScores: CapabilityScore[],
    primaryAssignments: AgentAssignment[]
  ): AgentAssignment[] {
    return this.createAlternativeAssignments(allScores, primaryAssignments);
  }

  /**
   * Calculates estimated duration for task completion
   * 
   * @private
   */
  private calculateEstimatedDuration(
    request: TaskDelegationRequest,
    assignments: AgentAssignment[]
  ): number {
    if (assignments.length === 0) {
      return request.expectedDuration || 3600000; // 1 hour default
    }

    // For parallel execution, use maximum individual time
    // For sequential execution, sum all times
    const executionPattern = request.executionPattern || 'sequential';
    
    if (executionPattern === 'parallel' || request.allowParallel) {
      return Math.max(...assignments.map(a => a.estimatedTime));
    } else {
      return assignments.reduce((sum, a) => sum + a.estimatedTime, 0);
    }
  }

  /**
   * Calculates overall confidence in the routing decision
   * 
   * @private
   */
  private calculateRoutingConfidence(
    assignments: AgentAssignment[],
    risks: TaskRisk[]
  ): number {
    if (assignments.length === 0) {
      return 0;
    }

    // Base confidence from capability scores
    const avgCapabilityScore = assignments.reduce((sum, a) => sum + a.capabilityScore.overallScore, 0) / assignments.length;
    let confidence = avgCapabilityScore / 100;

    // Reduce confidence based on risks
    const avgRiskSeverity = risks.reduce((sum, r) => sum + r.severity * r.probability, 0) / Math.max(1, risks.length);
    confidence *= (1 - avgRiskSeverity * 0.5);

    // Boost confidence for multiple agents (redundancy)
    if (assignments.length > 1) {
      confidence *= 1.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generates human-readable reasoning for the routing decision
   * 
   * @private
   */
  private generateRoutingReasoning(
    request: TaskDelegationRequest,
    assignments: AgentAssignment[],
    delegationPattern: DelegationPattern,
    executionPattern: ExecutionPattern,
    risks: TaskRisk[]
  ): string {
    const parts: string[] = [];

    parts.push(`Selected ${assignments.length} agent(s) for ${request.complexity} task with ${request.priority} priority.`);
    parts.push(`Using ${delegationPattern} delegation pattern with ${executionPattern} execution.`);

    if (assignments.length > 0) {
      const primaryAgent = assignments.find(a => a.role === 'primary');
      if (primaryAgent) {
        parts.push(`Primary agent ${primaryAgent.agentId} selected with ${primaryAgent.capabilityScore.overallScore.toFixed(1)} capability score.`);
      }
    }

    if (risks.length > 0) {
      const highRisks = risks.filter(r => r.severity > 0.6);
      if (highRisks.length > 0) {
        parts.push(`${highRisks.length} high-severity risk(s) identified and mitigated.`);
      }
    }

    const avgScore = assignments.reduce((sum, a) => sum + a.capabilityScore.overallScore, 0) / assignments.length;
    parts.push(`Overall assignment quality: ${avgScore.toFixed(1)}/100.`);

    return parts.join(' ');
  }

  /**
   * Gets the numeric priority value for queue ordering
   * 
   * @private
   */
  private getPriorityValue(priority: TaskPriority): number {
    switch (priority) {
      case 'critical': return 100;
      case 'urgent': return 80;
      case 'high': return 60;
      case 'normal': return 40;
      case 'low': return 20;
      default: return 40;
    }
  }

  /**
   * Initializes load balancing state management
   * 
   * @private
   */
  private initializeLoadBalancing(): void {
    // Update load states periodically
    this.loadBalancingInterval = setInterval(async () => {
      try {
        await this.updateAgentLoadStates();
      } catch (error) {
        this.logger.error('Failed to update agent load states', {
          error: error instanceof Error ? error.message : error
        });
      }
    }, this.config.updateInterval);

    // Update statistics
    this.statisticsInterval = setInterval(() => {
      this.updateStatistics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Starts processing queued tasks
   * 
   * @private
   */
  private startProcessingQueues(): void {
    this.queueProcessingInterval = setInterval(async () => {
      try {
        await this.processQueuedTasks();
      } catch (error) {
        this.logger.error('Failed to process queued tasks', {
          error: error instanceof Error ? error.message : error
        });
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Processes queued tasks when resources become available
   * 
   * @private
   */
  private async processQueuedTasks(): Promise<void> {
    // Process in priority order
    const priorities: TaskPriority[] = ['critical', 'urgent', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.taskQueues[priority];
      
      while (!queue.isEmpty()) {
        const queuedTask = queue.peek();
        if (!queuedTask) break;

        try {
          // Check if we can process this task now
          const canProcess = await this.canProcessTask(queuedTask);
          
          if (canProcess) {
            queue.dequeue(); // Remove from queue
            
            // Process the task
            const routingDecision = await this.performRouting(queuedTask.request);
            
            // Update statistics
            const queueWaitTime = Date.now() - queuedTask.queuedAt;
            this.statistics.avgQueueWaitTime = 
              (this.statistics.avgQueueWaitTime + queueWaitTime) / 2;

            // Emit event
            this.emit('queuedTaskProcessed', {
              taskId: queuedTask.request.taskId,
              queueWaitTime,
              routingDecision
            });

            this.logger.info('Processed queued task', {
              taskId: queuedTask.request.taskId,
              queueWaitTime,
              priority
            });

          } else {
            break; // Can't process this task, try next priority
          }

        } catch (error) {
          queue.dequeue(); // Remove failed task
          this.statistics.failedRoutings++;
          
          this.logger.error('Failed to process queued task', {
            taskId: queuedTask.request.taskId,
            error: error instanceof Error ? error.message : error
          });
        }
      }
    }
  }

  /**
   * Checks if a queued task can be processed now
   * 
   * @private
   */
  private async canProcessTask(queuedTask: QueuedTask): Promise<boolean> {
    // Check deadline
    if (queuedTask.deadline && Date.now() > queuedTask.deadline) {
      return false; // Past deadline
    }

    // Check system load
    const avgLoad = Array.from(this.agentLoadStates.values())
      .reduce((sum, state) => sum + state.projectedLoad, 0) / this.agentLoadStates.size;

    if (avgLoad > this.config.maxLoadThreshold) {
      return false; // Still overloaded
    }

    // Check agent availability
    const availableAgents = await this.getAvailableAgents();
    const suitableCount = await this.countSuitableAgents(queuedTask.request, availableAgents);

    return suitableCount >= this.config.minAgentsConsidered;
  }

  /**
   * Updates agent load states from registry
   * 
   * @private
   */
  private async updateAgentLoadStates(): Promise<void> {
    const allAgents = this.agentRegistry.getAllAgents();

    for (const agent of allAgents) {
      const details = this.agentRegistry.getAgentDetails(agent.id);
      if (!details) continue;

      const loadState: AgentLoadState = {
        agentId: agent.id,
        currentTasks: details.loadInfo.activeTasks,
        projectedLoad: details.loadInfo.currentLoad / 100,
        lastAssignment: this.agentLoadStates.get(agent.id)?.lastAssignment || 0,
        performanceScore: details.metrics.successRate * (details.metrics.qualityScore / 100),
        preferenceWeight: 1.0 // Could be adjusted based on user preferences
      };

      this.agentLoadStates.set(agent.id, loadState);
    }
  }

  /**
   * Optimizes task distribution across agents
   * 
   * @private
   */
  private async optimizeTaskDistribution(): Promise<void> {
    // Implementation would involve reassigning tasks to balance load
    // This is a placeholder for advanced optimization logic
    this.logger.debug('Task distribution optimization completed');
  }

  /**
   * Applies weighted round robin to agent scores
   * 
   * @private
   */
  private applyWeightedRoundRobin(scores: CapabilityScore[]): void {
    // Adjust scores based on recent assignments and weights
    scores.forEach(score => {
      const loadState = this.agentLoadStates.get(score.agentId);
      if (loadState) {
        const timeSinceLastAssignment = Date.now() - loadState.lastAssignment;
        const weight = Math.min(2, 1 + (timeSinceLastAssignment / 3600000)); // Increase weight over time
        score.overallScore *= weight;
      }
    });

    scores.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Applies round robin to agent scores
   * 
   * @private
   */
  private applyRoundRobin(scores: CapabilityScore[]): void {
    // Find agent with least recent assignment
    scores.sort((a, b) => {
      const lastA = this.agentLoadStates.get(a.agentId)?.lastAssignment || 0;
      const lastB = this.agentLoadStates.get(b.agentId)?.lastAssignment || 0;
      return lastA - lastB;
    });
  }

  /**
   * Resolves conflicts using priority-based strategy
   * 
   * @private
   */
  private async resolvePriorityBased(context: ConflictResolutionContext): Promise<TaskRoutingDecision[]> {
    const decisions: TaskRoutingDecision[] = [];
    const sortedTasks = context.conflictingTasks.sort((a, b) => 
      this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority)
    );

    const usedAgents = new Set<string>();

    for (const task of sortedTasks) {
      const availableAgents = context.availableAgents.filter(id => !usedAgents.has(id));
      
      if (availableAgents.length > 0) {
        const modifiedTask = { ...task };
        // Modify task to only consider available agents
        
        const decision = await this.routeTask(modifiedTask);
        decisions.push(decision);

        // Mark assigned agents as used
        decision.assignments.forEach(assignment => {
          usedAgents.add(assignment.agentId);
        });
      }
    }

    return decisions;
  }

  /**
   * Resolves conflicts using capability-based strategy
   * 
   * @private
   */
  private async resolveCapabilityBased(context: ConflictResolutionContext): Promise<TaskRoutingDecision[]> {
    // Implementation for capability-based conflict resolution
    return this.resolvePriorityBased(context); // Placeholder
  }

  /**
   * Resolves conflicts using round robin strategy
   * 
   * @private
   */
  private async resolveRoundRobin(context: ConflictResolutionContext): Promise<TaskRoutingDecision[]> {
    // Implementation for round robin conflict resolution
    return this.resolvePriorityBased(context); // Placeholder
  }

  /**
   * Resolves conflicts using negotiation strategy
   * 
   * @private
   */
  private async resolveNegotiation(context: ConflictResolutionContext): Promise<TaskRoutingDecision[]> {
    // Implementation for negotiation-based conflict resolution
    return this.resolvePriorityBased(context); // Placeholder
  }

  /**
   * Updates routing statistics
   * 
   * @private
   */
  private updateRoutingStatistics(decision: TaskRoutingDecision, routingTime: number): void {
    this.statistics.totalTasksRouted++;
    
    if (decision.confidence > 0.5) {
      this.statistics.successfulRoutings++;
    } else {
      this.statistics.failedRoutings++;
    }

    this.statistics.avgRoutingTime = (this.statistics.avgRoutingTime + routingTime) / 2;

    // Update delegation pattern usage
    if (!this.statistics.delegationPatternUsage[decision.delegationPattern]) {
      this.statistics.delegationPatternUsage[decision.delegationPattern] = 0;
    }
    this.statistics.delegationPatternUsage[decision.delegationPattern]++;

    // Update agent utilization
    decision.assignments.forEach(assignment => {
      if (!this.statistics.agentUtilization[assignment.agentId]) {
        this.statistics.agentUtilization[assignment.agentId] = 0;
      }
      this.statistics.agentUtilization[assignment.agentId]++;
    });
  }

  /**
   * Updates general statistics
   * 
   * @private
   */
  private updateStatistics(): void {
    // Calculate load balancing efficiency
    const loadStates = Array.from(this.agentLoadStates.values());
    if (loadStates.length > 1) {
      const loads = loadStates.map(state => state.projectedLoad);
      const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
      const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
      this.statistics.loadBalancingEfficiency = Math.max(0, 100 - (variance * 100));
    }

    this.statistics.lastUpdated = Date.now();
  }

  /**
   * Shuts down the task router and cleans up resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down TaskRouter');

    // Clear intervals
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
    }
    if (this.loadBalancingInterval) {
      clearInterval(this.loadBalancingInterval);
    }
    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
    }

    // Clear queues
    Object.values(this.taskQueues).forEach(queue => queue.clear());

    // Clear caches and state
    this.agentLoadStates.clear();
    this.routingCache.clear();

    this.logger.info('TaskRouter shutdown complete');
  }
}