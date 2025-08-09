/**
 * Comprehensive types and interfaces for the Task Delegation System
 * 
 * Provides intelligent task routing, agent matching, and workflow orchestration
 * for multi-agent collaboration in the Open SWE system.
 */

import { AgentProfile, AgentRole, AgentMessage, TaskDelegation, Task } from './types.js';
import { AgentLoadInfo, AgentHealthCheck, AgentMetrics } from './agent-registry.js';

/**
 * Task complexity levels for routing decisions
 */
export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'critical';

/**
 * Task delegation patterns for different scenarios
 */
export type DelegationPattern = 
  | 'direct_assignment'    // Direct task assignment to specific agent
  | 'auction_based'        // Agents bid for tasks based on capabilities
  | 'consensus_based'      // Multiple agents collaborate on decision
  | 'hierarchical'         // Manager-subordinate delegation
  | 'round_robin'          // Distribute tasks evenly across agents
  | 'load_balanced'        // Assign based on current load
  | 'capability_matched';  // Match based on specialized capabilities

/**
 * Task execution patterns for workflow orchestration
 */
export type ExecutionPattern = 
  | 'sequential'     // Tasks execute one after another
  | 'parallel'       // Tasks execute simultaneously
  | 'pipeline'       // Output of one task feeds into the next
  | 'fan_out'        // One task spawns multiple subtasks
  | 'fan_in'         // Multiple tasks merge into one result
  | 'conditional'    // Execution depends on conditions
  | 'iterative';     // Repeated execution until condition met

/**
 * Task priority levels for scheduling and resource allocation
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

/**
 * Task status throughout the delegation lifecycle
 */
export type TaskStatus = 
  | 'queued'         // Task is waiting to be assigned
  | 'analyzing'      // System is analyzing task requirements
  | 'routing'        // System is finding suitable agents
  | 'delegated'      // Task has been assigned to an agent
  | 'in_progress'    // Agent is working on the task
  | 'blocked'        // Task is blocked waiting for dependencies
  | 'review'         // Task is under review
  | 'completed'      // Task has been completed successfully
  | 'failed'         // Task failed and needs intervention
  | 'cancelled';     // Task was cancelled

/**
 * Task delegation request with comprehensive requirements
 */
export interface TaskDelegationRequest {
  /**
   * Unique task identifier
   */
  taskId: string;
  
  /**
   * Task description and requirements
   */
  description: string;
  
  /**
   * Task complexity assessment
   */
  complexity: TaskComplexity;
  
  /**
   * Task priority level
   */
  priority: TaskPriority;
  
  /**
   * Required capabilities for task completion
   */
  requiredCapabilities: string[];
  
  /**
   * Optional capabilities that would be beneficial
   */
  preferredCapabilities?: string[];
  
  /**
   * Specific agent role requirements
   */
  requiredRole?: AgentRole;
  
  /**
   * Preferred agents (if any)
   */
  preferredAgents?: string[];
  
  /**
   * Agents to exclude from consideration
   */
  excludedAgents?: string[];
  
  /**
   * Expected completion time (milliseconds)
   */
  expectedDuration?: number;
  
  /**
   * Hard deadline for task completion
   */
  deadline?: number;
  
  /**
   * Task dependencies (other task IDs)
   */
  dependencies?: string[];
  
  /**
   * Maximum number of agents that can work on this task
   */
  maxAgents?: number;
  
  /**
   * Whether task allows parallel execution
   */
  allowParallel?: boolean;
  
  /**
   * Additional context data for the task
   */
  context?: Record<string, unknown>;
  
  /**
   * Delegation pattern to use
   */
  delegationPattern?: DelegationPattern;
  
  /**
   * Execution pattern for the task
   */
  executionPattern?: ExecutionPattern;
  
  /**
   * Requesting agent ID
   */
  requestedBy: string;
  
  /**
   * When the request was created
   */
  createdAt: number;
}

/**
 * Agent capability score for matching algorithms
 */
export interface CapabilityScore {
  /**
   * Agent identifier
   */
  agentId: string;
  
  /**
   * Overall suitability score (0-100)
   */
  overallScore: number;
  
  /**
   * Capability match percentage (0-100)
   */
  capabilityMatch: number;
  
  /**
   * Availability score based on load (0-100)
   */
  availabilityScore: number;
  
  /**
   * Performance score based on history (0-100)
   */
  performanceScore: number;
  
  /**
   * Response time score (0-100)
   */
  responseTimeScore: number;
  
  /**
   * Quality score based on past work (0-100)
   */
  qualityScore: number;
  
  /**
   * Individual capability scores
   */
  capabilityScores: Record<string, number>;
  
  /**
   * Reasoning for the score
   */
  reasoning: string[];
  
  /**
   * Confidence level in the score (0-1)
   */
  confidence: number;
}

/**
 * Task routing decision with detailed analysis
 */
export interface TaskRoutingDecision {
  /**
   * Task identifier
   */
  taskId: string;
  
  /**
   * Recommended agent assignments
   */
  assignments: AgentAssignment[];
  
  /**
   * Alternative agent options
   */
  alternatives: AgentAssignment[];
  
  /**
   * Delegation pattern used
   */
  delegationPattern: DelegationPattern;
  
  /**
   * Execution pattern recommended
   */
  executionPattern: ExecutionPattern;
  
  /**
   * Estimated completion time
   */
  estimatedDuration: number;
  
  /**
   * Confidence in the routing decision (0-1)
   */
  confidence: number;
  
  /**
   * Risk assessment
   */
  risks: TaskRisk[];
  
  /**
   * Fallback options if primary fails
   */
  fallbackOptions: AgentAssignment[];
  
  /**
   * Decision reasoning
   */
  reasoning: string;
  
  /**
   * When the decision was made
   */
  decidedAt: number;
}

/**
 * Agent assignment with role and expectations
 */
export interface AgentAssignment {
  /**
   * Agent identifier
   */
  agentId: string;
  
  /**
   * Agent role in this task
   */
  role: 'primary' | 'secondary' | 'reviewer' | 'collaborator';
  
  /**
   * Specific responsibilities for this agent
   */
  responsibilities: string[];
  
  /**
   * Expected contribution percentage
   */
  contributionPercentage: number;
  
  /**
   * Capability score for this assignment
   */
  capabilityScore: CapabilityScore;
  
  /**
   * Estimated time commitment
   */
  estimatedTime: number;
  
  /**
   * Priority level for this agent
   */
  priority: TaskPriority;
}

/**
 * Task risk assessment
 */
export interface TaskRisk {
  /**
   * Risk type
   */
  type: 'performance' | 'availability' | 'capability' | 'deadline' | 'dependency' | 'resource';
  
  /**
   * Risk severity (0-1, where 1 is highest)
   */
  severity: number;
  
  /**
   * Risk probability (0-1)
   */
  probability: number;
  
  /**
   * Risk description
   */
  description: string;
  
  /**
   * Mitigation strategies
   */
  mitigations: string[];
  
  /**
   * Impact if risk occurs
   */
  impact: string;
}

/**
 * Workflow step for complex multi-agent orchestration
 */
export interface WorkflowStep {
  /**
   * Step identifier
   */
  id: string;
  
  /**
   * Step name/description
   */
  name: string;
  
  /**
   * Task delegation request for this step
   */
  task: TaskDelegationRequest;
  
  /**
   * Dependencies on other steps
   */
  dependencies: string[];
  
  /**
   * Execution pattern for this step
   */
  executionPattern: ExecutionPattern;
  
  /**
   * Conditions that must be met to execute
   */
  preconditions: WorkflowCondition[];
  
  /**
   * Conditions that indicate successful completion
   */
  postconditions: WorkflowCondition[];
  
  /**
   * Error handling strategy for this step
   */
  errorHandling: ErrorHandlingStrategy;
  
  /**
   * Retry configuration
   */
  retryConfig: RetryConfig;
  
  /**
   * Timeout configuration
   */
  timeout: number;
}

/**
 * Workflow condition for step execution
 */
export interface WorkflowCondition {
  /**
   * Condition type
   */
  type: 'data_available' | 'agent_available' | 'time_constraint' | 'resource_available' | 'custom';
  
  /**
   * Condition expression or description
   */
  expression: string;
  
  /**
   * Whether condition must be true or false
   */
  expectedValue: boolean;
  
  /**
   * Timeout for condition evaluation
   */
  timeout?: number;
}

/**
 * Error handling strategy configuration
 */
export interface ErrorHandlingStrategy {
  /**
   * Strategy type
   */
  strategy: 'retry' | 'fallback' | 'escalate' | 'skip' | 'fail_fast' | 'compensate';
  
  /**
   * Maximum attempts before giving up
   */
  maxAttempts: number;
  
  /**
   * Fallback agents if primary fails
   */
  fallbackAgents?: string[];
  
  /**
   * Escalation agent for complex failures
   */
  escalationAgent?: string;
  
  /**
   * Compensation actions for rollback
   */
  compensationActions?: string[];
  
  /**
   * Custom error handling logic
   */
  customHandler?: string;
}

/**
 * Retry configuration for failed tasks
 */
export interface RetryConfig {
  /**
   * Maximum number of retries
   */
  maxRetries: number;
  
  /**
   * Initial delay before first retry (ms)
   */
  initialDelay: number;
  
  /**
   * Backoff strategy
   */
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  
  /**
   * Maximum delay between retries (ms)
   */
  maxDelay: number;
  
  /**
   * Jitter to add to delay (ms)
   */
  jitter?: number;
  
  /**
   * Whether to retry on different agents
   */
  retryOnDifferentAgent: boolean;
}

/**
 * Workflow orchestration plan
 */
export interface WorkflowPlan {
  /**
   * Plan identifier
   */
  id: string;
  
  /**
   * Plan name/description
   */
  name: string;
  
  /**
   * All workflow steps
   */
  steps: WorkflowStep[];
  
  /**
   * Overall execution pattern
   */
  executionPattern: ExecutionPattern;
  
  /**
   * Estimated total duration
   */
  estimatedDuration: number;
  
  /**
   * Required agents for the entire workflow
   */
  requiredAgents: string[];
  
  /**
   * Global error handling strategy
   */
  globalErrorHandling: ErrorHandlingStrategy;
  
  /**
   * Success criteria for the workflow
   */
  successCriteria: WorkflowCondition[];
  
  /**
   * Cleanup actions after completion
   */
  cleanupActions: string[];
  
  /**
   * Created timestamp
   */
  createdAt: number;
  
  /**
   * Created by agent
   */
  createdBy: string;
}

/**
 * Task delegation result with comprehensive feedback
 */
export interface TaskDelegationResult {
  /**
   * Task identifier
   */
  taskId: string;
  
  /**
   * Whether delegation was successful
   */
  success: boolean;
  
  /**
   * Assigned agents
   */
  assignedAgents: string[];
  
  /**
   * Delegation pattern used
   */
  delegationPattern: DelegationPattern;
  
  /**
   * Routing decision details
   */
  routingDecision: TaskRoutingDecision;
  
  /**
   * Estimated completion time
   */
  estimatedCompletion: number;
  
  /**
   * Delegation metadata
   */
  metadata: {
    /**
     * Time taken to find suitable agents (ms)
     */
    routingTime: number;
    
    /**
     * Number of agents considered
     */
    agentsConsidered: number;
    
    /**
     * Average capability score of assigned agents
     */
    avgCapabilityScore: number;
    
    /**
     * Confidence level in assignment
     */
    confidence: number;
  };
  
  /**
   * Error message if delegation failed
   */
  error?: string;
  
  /**
   * Warnings or concerns about the delegation
   */
  warnings: string[];
  
  /**
   * Delegation timestamp
   */
  delegatedAt: number;
}

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  /**
   * Load balancing algorithm
   */
  algorithm: 'round_robin' | 'least_loaded' | 'weighted_round_robin' | 'random' | 'capability_based';
  
  /**
   * Weight factors for different metrics
   */
  weights: {
    /**
     * Current load weight (0-1)
     */
    load: number;
    
    /**
     * Performance history weight (0-1)
     */
    performance: number;
    
    /**
     * Response time weight (0-1)
     */
    responseTime: number;
    
    /**
     * Capability match weight (0-1)
     */
    capability: number;
    
    /**
     * Agent preference weight (0-1)
     */
    preference: number;
  };
  
  /**
   * Maximum load threshold before avoiding agent
   */
  maxLoadThreshold: number;
  
  /**
   * Minimum agents to consider for each task
   */
  minAgentsConsidered: number;
  
  /**
   * Load balancing update interval (ms)
   */
  updateInterval: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
  /**
   * Metrics collection interval (ms)
   */
  metricsInterval: number;
  
  /**
   * Performance history retention (ms)
   */
  historyRetention: number;
  
  /**
   * Anomaly detection thresholds
   */
  anomalyThresholds: {
    /**
     * Response time anomaly threshold (ms)
     */
    responseTime: number;
    
    /**
     * Success rate anomaly threshold (0-1)
     */
    successRate: number;
    
    /**
     * Load spike threshold (0-1)
     */
    loadSpike: number;
  };
  
  /**
   * Enable adaptive optimization
   */
  enableAdaptiveOptimization: boolean;
  
  /**
   * Optimization trigger thresholds
   */
  optimizationTriggers: {
    /**
     * Failed delegation rate threshold
     */
    failedDelegationRate: number;
    
    /**
     * Average response time threshold
     */
    avgResponseTime: number;
    
    /**
     * Agent overload frequency threshold
     */
    overloadFrequency: number;
  };
}

/**
 * Task delegation engine configuration
 */
export interface TaskDelegationConfig {
  /**
   * Maximum concurrent tasks per agent
   */
  maxConcurrentTasksPerAgent: number;
  
  /**
   * Default task timeout (ms)
   */
  defaultTaskTimeout: number;
  
  /**
   * Load balancing configuration
   */
  loadBalancing: LoadBalancingConfig;
  
  /**
   * Performance monitoring configuration
   */
  monitoring: PerformanceMonitoringConfig;
  
  /**
   * Enable intelligent routing
   */
  enableIntelligentRouting: boolean;
  
  /**
   * Enable workflow orchestration
   */
  enableWorkflowOrchestration: boolean;
  
  /**
   * Default delegation pattern
   */
  defaultDelegationPattern: DelegationPattern;
  
  /**
   * Conflict resolution strategy
   */
  conflictResolution: 'first_come_first_serve' | 'priority_based' | 'capability_based' | 'negotiation';
  
  /**
   * Task queue configuration
   */
  taskQueue: {
    /**
     * Maximum queue size
     */
    maxSize: number;
    
    /**
     * Queue processing interval (ms)
     */
    processInterval: number;
    
    /**
     * Priority queue enabled
     */
    priorityQueueEnabled: boolean;
  };
}

/**
 * Task delegation statistics
 */
export interface TaskDelegationStatistics {
  /**
   * Total tasks processed
   */
  totalTasksProcessed: number;
  
  /**
   * Successful delegations
   */
  successfulDelegations: number;
  
  /**
   * Failed delegations
   */
  failedDelegations: number;
  
  /**
   * Average routing time (ms)
   */
  avgRoutingTime: number;
  
  /**
   * Average task completion time (ms)
   */
  avgCompletionTime: number;
  
  /**
   * Agent utilization statistics
   */
  agentUtilization: Record<string, {
    /**
     * Tasks completed by this agent
     */
    tasksCompleted: number;
    
    /**
     * Average completion time for this agent
     */
    avgCompletionTime: number;
    
    /**
     * Success rate for this agent
     */
    successRate: number;
    
    /**
     * Current load
     */
    currentLoad: number;
  }>;
  
  /**
   * Delegation pattern usage
   */
  delegationPatternUsage: Record<DelegationPattern, number>;
  
  /**
   * Task complexity distribution
   */
  complexityDistribution: Record<TaskComplexity, number>;
  
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Conflict resolution context for concurrent task assignment
 */
export interface ConflictResolutionContext {
  /**
   * Conflicting task requests
   */
  conflictingTasks: TaskDelegationRequest[];
  
  /**
   * Available agents
   */
  availableAgents: string[];
  
  /**
   * Conflict type
   */
  conflictType: 'agent_availability' | 'resource_contention' | 'capability_overlap' | 'priority_conflict';
  
  /**
   * Resolution strategy to apply
   */
  resolutionStrategy: 'priority_based' | 'capability_based' | 'round_robin' | 'negotiation';
  
  /**
   * Context data for resolution
   */
  contextData: Record<string, unknown>;
}

/**
 * Agent bid for auction-based delegation
 */
export interface AgentBid {
  /**
   * Bidding agent ID
   */
  agentId: string;
  
  /**
   * Task ID being bid on
   */
  taskId: string;
  
  /**
   * Bid amount (capability score)
   */
  bidAmount: number;
  
  /**
   * Estimated completion time
   */
  estimatedCompletionTime: number;
  
  /**
   * Agent's confidence in completing the task
   */
  confidence: number;
  
  /**
   * Justification for the bid
   */
  justification: string;
  
  /**
   * Additional terms or conditions
   */
  terms?: Record<string, unknown>;
  
  /**
   * Bid submission timestamp
   */
  submittedAt: number;
}

/**
 * Auction configuration for task delegation
 */
export interface AuctionConfig {
  /**
   * Auction duration (ms)
   */
  duration: number;
  
  /**
   * Minimum number of bids required
   */
  minBids: number;
  
  /**
   * Maximum number of bids to accept
   */
  maxBids: number;
  
  /**
   * Bid evaluation criteria
   */
  evaluationCriteria: {
    /**
     * Weight for capability score
     */
    capabilityWeight: number;
    
    /**
     * Weight for completion time
     */
    timeWeight: number;
    
    /**
     * Weight for agent confidence
     */
    confidenceWeight: number;
    
    /**
     * Weight for agent track record
     */
    trackRecordWeight: number;
  };
  
  /**
   * Enable sealed bidding
   */
  sealedBidding: boolean;
}

/**
 * Notification configuration for task delegation events
 */
export interface NotificationConfig {
  /**
   * Enable task assignment notifications
   */
  enableAssignmentNotifications: boolean;
  
  /**
   * Enable completion notifications
   */
  enableCompletionNotifications: boolean;
  
  /**
   * Enable failure notifications
   */
  enableFailureNotifications: boolean;
  
  /**
   * Enable performance alerts
   */
  enablePerformanceAlerts: boolean;
  
  /**
   * Notification channels
   */
  channels: ('agent_message' | 'system_log' | 'external_webhook')[];
  
  /**
   * Notification priority thresholds
   */
  priorityThresholds: {
    /**
     * Minimum priority for notifications
     */
    minPriority: TaskPriority;
    
    /**
     * Critical alert threshold
     */
    criticalThreshold: number;
  };
}