/**
 * Task Delegation Integration Layer for Open SWE
 * 
 * Provides seamless integration between the Task Delegation Engine and
 * the existing Open SWE GraphState/LangGraph architecture.
 */

import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import { TaskDelegationEngine } from './task-delegation-engine.js';
import { AgentRegistry } from './agent-registry-impl.js';
import { AgentCommunicationHub } from './agent-communication-hub.js';
import { 
  GraphState, 
  GraphUpdate, 
  AgentProfile, 
  AgentRole,
  TaskDelegation,
  Task,
  PlanItem 
} from './types.js';
import {
  TaskDelegationRequest,
  TaskDelegationResult,
  WorkflowPlan,
  WorkflowStep,
  TaskComplexity,
  TaskPriority,
  DelegationPattern,
  ExecutionPattern
} from './task-delegation-types.js';

/**
 * Integration configuration for the delegation system
 */
interface DelegationIntegrationConfig {
  /**
   * Enable task delegation for all tasks
   */
  enableTaskDelegation: boolean;
  
  /**
   * Enable workflow orchestration
   */
  enableWorkflowOrchestration: boolean;
  
  /**
   * Auto-delegate tasks above this complexity
   */
  autoDelegationComplexityThreshold: TaskComplexity;
  
  /**
   * Default delegation pattern for integrated tasks
   */
  defaultDelegationPattern: DelegationPattern;
  
  /**
   * Enable multi-agent collaboration for complex tasks
   */
  enableMultiAgentCollaboration: boolean;
  
  /**
   * Maximum agents per task
   */
  maxAgentsPerTask: number;
  
  /**
   * Task timeout in milliseconds
   */
  defaultTaskTimeout: number;
  
  /**
   * Enable automatic agent provisioning
   */
  enableAutoProvisioning: boolean;
  
  /**
   * Agent provisioning configuration
   */
  agentProvisioning: {
    /**
     * Roles to auto-provision
     */
    autoProvisionRoles: AgentRole[];
    
    /**
     * Maximum agents per role
     */
    maxAgentsPerRole: number;
    
    /**
     * Provisioning strategy
     */
    strategy: 'on_demand' | 'pre_provision' | 'hybrid';
  };
}

/**
 * Task delegation integration state extension
 */
interface DelegationIntegrationState {
  /**
   * Active task delegations
   */
  activeDelegations: TaskDelegation[];
  
  /**
   * Delegation engine statistics
   */
  delegationStats: {
    totalDelegated: number;
    successfulDelegations: number;
    failedDelegations: number;
    avgDelegationTime: number;
    agentUtilization: Record<string, number>;
  };
  
  /**
   * Auto-provisioned agents
   */
  autoProvisionedAgents: Map<string, AgentProfile>;
  
  /**
   * Current workflow executions
   */
  activeWorkflows: Map<string, {
    id: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    progress: number;
    startTime: number;
    estimatedCompletion?: number;
  }>;
}

/**
 * Task delegation integration for Open SWE
 */
export class TaskDelegationIntegration {
  private readonly logger = createLogger(LogLevel.INFO, 'TaskDelegationIntegration');

  /**
   * Task delegation engine instance
   */
  private readonly delegationEngine: TaskDelegationEngine;

  /**
   * Agent registry instance
   */
  private readonly agentRegistry: AgentRegistry;

  /**
   * Communication hub instance
   */
  private readonly communicationHub: AgentCommunicationHub;

  /**
   * Integration configuration
   */
  private readonly config: DelegationIntegrationConfig;

  /**
   * Integration state
   */
  private readonly integrationState: DelegationIntegrationState = {
    activeDelegations: [],
    delegationStats: {
      totalDelegated: 0,
      successfulDelegations: 0,
      failedDelegations: 0,
      avgDelegationTime: 0,
      agentUtilization: {}
    },
    autoProvisionedAgents: new Map(),
    activeWorkflows: new Map()
  };

  /**
   * Task completion callbacks by task ID
   */
  private readonly taskCompletionCallbacks = new Map<string, (result: unknown) => void>();

  /**
   * Workflow completion callbacks by workflow ID
   */
  private readonly workflowCompletionCallbacks = new Map<string, (result: unknown) => void>();

  constructor(
    agentRegistry: AgentRegistry,
    communicationHub: AgentCommunicationHub,
    config?: Partial<DelegationIntegrationConfig>
  ) {
    this.config = {
      enableTaskDelegation: true,
      enableWorkflowOrchestration: true,
      autoDelegationComplexityThreshold: 'moderate',
      defaultDelegationPattern: 'capability_matched',
      enableMultiAgentCollaboration: true,
      maxAgentsPerTask: 3,
      defaultTaskTimeout: 300000, // 5 minutes
      enableAutoProvisioning: true,
      agentProvisioning: {
        autoProvisionRoles: ['code_reviewer', 'test_engineer', 'documentation'],
        maxAgentsPerRole: 2,
        strategy: 'on_demand'
      },
      ...config
    };

    this.agentRegistry = agentRegistry;
    this.communicationHub = communicationHub;

    // Initialize delegation engine
    this.delegationEngine = new TaskDelegationEngine(
      this.agentRegistry,
      this.communicationHub,
      {
        enableWorkflowOrchestration: this.config.enableWorkflowOrchestration,
        defaultDelegationPattern: this.config.defaultDelegationPattern,
        maxConcurrentTasksPerAgent: this.config.maxAgentsPerTask,
        defaultTaskTimeout: this.config.defaultTaskTimeout
      }
    );

    this.setupEventHandlers();
    this.initializeAutoProvisioning();

    this.logger.info('TaskDelegationIntegration initialized', { config: this.config });
  }

  /**
   * Integrates task delegation with GraphState updates
   * 
   * @param state - Current GraphState
   * @param update - Graph state update
   * @returns Promise resolving to updated state with delegation integration
   */
  async integrateWithGraphState(state: GraphState, update: GraphUpdate): Promise<GraphState> {
    try {
      // Check if multi-agent features are enabled
      if (!state.enableMultiAgent) {
        return { ...state, ...update };
      }

      let updatedState = { ...state, ...update };

      // Process task plan changes
      if (update.taskPlan) {
        updatedState = await this.handleTaskPlanUpdate(updatedState, update.taskPlan);
      }

      // Process active agents changes
      if (update.activeAgents) {
        updatedState = await this.handleActiveAgentsUpdate(updatedState, update.activeAgents);
      }

      // Process task delegations
      if (update.taskDelegations) {
        updatedState = await this.handleTaskDelegationsUpdate(updatedState, update.taskDelegations);
      }

      // Auto-delegate complex tasks
      if (this.config.enableTaskDelegation && update.taskPlan) {
        updatedState = await this.autoDelegate(updatedState);
      }

      // Update delegation statistics in collaboration context
      if (updatedState.collaborationContext) {
        updatedState.collaborationContext = {
          ...updatedState.collaborationContext,
          ...this.getDelegationContextUpdate()
        };
      }

      return updatedState;

    } catch (error) {
      this.logger.error('GraphState integration failed', {
        error: error instanceof Error ? error.message : error
      });
      return { ...state, ...update };
    }
  }

  /**
   * Converts Open SWE Task to TaskDelegationRequest
   * 
   * @param task - Open SWE Task
   * @param requestedBy - Agent requesting delegation
   * @returns Task delegation request
   */
  createDelegationRequest(task: Task, requestedBy: string): TaskDelegationRequest {
    // Analyze task complexity
    const complexity = this.analyzeTaskComplexity(task);
    const priority = this.determinePriority(task);
    const requiredCapabilities = this.extractRequiredCapabilities(task);

    return {
      taskId: task.id,
      description: task.title,
      complexity,
      priority,
      requiredCapabilities,
      preferredCapabilities: this.extractPreferredCapabilities(task),
      expectedDuration: this.estimateTaskDuration(task, complexity),
      maxAgents: this.config.maxAgentsPerTask,
      allowParallel: complexity === 'complex' || complexity === 'critical',
      context: {
        openSweTask: task,
        originalRequest: task.request,
        planRevisions: task.planRevisions,
        createdAt: task.createdAt
      },
      delegationPattern: this.selectDelegationPattern(task, complexity),
      executionPattern: this.selectExecutionPattern(task, complexity),
      requestedBy,
      createdAt: Date.now()
    };
  }

  /**
   * Creates a workflow plan from task plan
   * 
   * @param taskPlan - Open SWE task plan
   * @param requestedBy - Agent requesting workflow
   * @returns Workflow plan
   */
  createWorkflowPlan(taskPlan: Task[], requestedBy: string): WorkflowPlan {
    const workflowId = `workflow_${Date.now()}`;
    
    // Convert tasks to workflow steps
    const steps: WorkflowStep[] = taskPlan.map((task, index) => {
      const delegationRequest = this.createDelegationRequest(task, requestedBy);
      
      return {
        id: task.id,
        name: task.title,
        task: delegationRequest,
        dependencies: this.extractDependencies(task, taskPlan),
        executionPattern: delegationRequest.executionPattern || 'sequential',
        preconditions: this.createPreconditions(task),
        postconditions: this.createPostconditions(task),
        errorHandling: {
          strategy: 'retry',
          maxAttempts: 3,
          fallbackAgents: [],
          escalationAgent: requestedBy
        },
        retryConfig: {
          maxRetries: 3,
          initialDelay: 1000,
          backoffStrategy: 'exponential',
          maxDelay: 30000,
          retryOnDifferentAgent: true
        },
        timeout: this.config.defaultTaskTimeout
      };
    });

    return {
      id: workflowId,
      name: `Multi-task workflow for ${taskPlan.length} tasks`,
      steps,
      executionPattern: this.determineWorkflowExecutionPattern(taskPlan),
      estimatedDuration: this.estimateWorkflowDuration(steps),
      requiredAgents: this.extractWorkflowRequiredAgents(steps),
      globalErrorHandling: {
        strategy: 'escalate',
        maxAttempts: 1,
        escalationAgent: requestedBy
      },
      successCriteria: steps.map(step => ({
        type: 'data_available',
        expression: `result_${step.id}`,
        expectedValue: true
      })),
      cleanupActions: ['notify_completion', 'update_task_status'],
      createdAt: Date.now(),
      createdBy: requestedBy
    };
  }

  /**
   * Delegates a task through the delegation engine
   * 
   * @param task - Open SWE task to delegate
   * @param requestedBy - Agent requesting delegation
   * @returns Promise resolving to delegation result
   */
  async delegateTask(task: Task, requestedBy: string): Promise<TaskDelegationResult> {
    const request = this.createDelegationRequest(task, requestedBy);
    
    this.logger.info('Delegating task through integration', {
      taskId: task.id,
      complexity: request.complexity,
      priority: request.priority
    });

    try {
      const result = await this.delegationEngine.delegateTask(request);

      // Update integration statistics
      this.integrationState.delegationStats.totalDelegated++;
      if (result.success) {
        this.integrationState.delegationStats.successfulDelegations++;
      } else {
        this.integrationState.delegationStats.failedDelegations++;
      }

      // Create task delegation record
      if (result.success) {
        const delegation: TaskDelegation = {
          id: `delegation_${task.id}_${Date.now()}`,
          taskId: task.id,
          delegatingAgentId: requestedBy,
          assignedAgentId: result.assignedAgents[0], // Primary agent
          status: 'accepted',
          description: task.title,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        this.integrationState.activeDelegations.push(delegation);
      }

      return result;

    } catch (error) {
      this.integrationState.delegationStats.failedDelegations++;
      this.logger.error('Task delegation failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Executes a workflow from task plan
   * 
   * @param taskPlan - Tasks to execute as workflow
   * @param requestedBy - Agent requesting execution
   * @returns Promise resolving to workflow context
   */
  async executeTaskPlanAsWorkflow(taskPlan: Task[], requestedBy: string) {
    if (!this.config.enableWorkflowOrchestration) {
      throw new Error('Workflow orchestration is disabled');
    }

    const workflowPlan = this.createWorkflowPlan(taskPlan, requestedBy);
    
    this.logger.info('Executing task plan as workflow', {
      workflowId: workflowPlan.id,
      tasksCount: taskPlan.length
    });

    try {
      const context = await this.delegationEngine.executeWorkflow(workflowPlan);

      // Track workflow execution
      this.integrationState.activeWorkflows.set(workflowPlan.id, {
        id: workflowPlan.id,
        status: 'running',
        progress: 0,
        startTime: Date.now(),
        estimatedCompletion: Date.now() + workflowPlan.estimatedDuration
      });

      return context;

    } catch (error) {
      this.logger.error('Workflow execution failed', {
        workflowId: workflowPlan.id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Gets integration state for GraphState updates
   * 
   * @returns Partial graph state with delegation integration data
   */
  getIntegrationStateUpdate(): Partial<GraphState> {
    const agentProfiles = Array.from(this.integrationState.autoProvisionedAgents.values());
    const activeAgentsMap = new Map(agentProfiles.map(agent => [agent.id, agent]));

    return {
      taskDelegations: this.integrationState.activeDelegations,
      activeAgents: activeAgentsMap,
      collaborationContext: {
        ...this.getDelegationContextUpdate()
      }
    };
  }

  /**
   * Provisions agents based on task requirements
   * 
   * @param requiredRoles - Agent roles needed
   * @param capabilities - Required capabilities
   * @returns Promise resolving to provisioned agents
   */
  async provisionAgents(requiredRoles: AgentRole[], capabilities: string[]): Promise<AgentProfile[]> {
    if (!this.config.enableAutoProvisioning) {
      return [];
    }

    const provisionedAgents: AgentProfile[] = [];

    for (const role of requiredRoles) {
      if (!this.config.agentProvisioning.autoProvisionRoles.includes(role)) {
        continue;
      }

      // Check if we already have enough agents for this role
      const existingAgents = Array.from(this.integrationState.autoProvisionedAgents.values())
        .filter(agent => agent.role === role);

      if (existingAgents.length >= this.config.agentProvisioning.maxAgentsPerRole) {
        continue;
      }

      // Create new agent profile
      const agent = this.createAgentProfile(role, capabilities);
      
      try {
        // Register with agent registry
        const result = await this.agentRegistry.registerAgent(agent);
        
        if (result.success) {
          this.integrationState.autoProvisionedAgents.set(agent.id, agent);
          provisionedAgents.push(agent);
          
          this.logger.info('Auto-provisioned agent', {
            agentId: agent.id,
            role: agent.role,
            capabilities: agent.specialization.length
          });
        }

      } catch (error) {
        this.logger.error('Failed to provision agent', {
          role,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    return provisionedAgents;
  }

  /**
   * Handles task plan updates
   * 
   * @private
   */
  private async handleTaskPlanUpdate(state: GraphState, taskPlan: any): Promise<GraphState> {
    // Auto-delegate complex tasks if enabled
    if (this.config.enableTaskDelegation) {
      for (const task of taskPlan.tasks) {
        if (!task.completed && this.shouldAutoDelegate(task)) {
          try {
            await this.delegateTask(task, 'manager');
          } catch (error) {
            this.logger.warn('Auto-delegation failed', {
              taskId: task.id,
              error: error instanceof Error ? error.message : error
            });
          }
        }
      }
    }

    return state;
  }

  /**
   * Handles active agents updates
   * 
   * @private
   */
  private async handleActiveAgentsUpdate(
    state: GraphState,
    activeAgents: Map<string, AgentProfile>
  ): Promise<GraphState> {
    // Sync with agent registry
    for (const [agentId, profile] of activeAgents.entries()) {
      const existingAgent = this.agentRegistry.getAgentDetails(agentId);
      if (!existingAgent) {
        try {
          await this.agentRegistry.registerAgent(profile);
        } catch (error) {
          this.logger.warn('Failed to register agent from GraphState', {
            agentId,
            error: error instanceof Error ? error.message : error
          });
        }
      }
    }

    return state;
  }

  /**
   * Handles task delegations updates
   * 
   * @private
   */
  private async handleTaskDelegationsUpdate(
    state: GraphState,
    taskDelegations: TaskDelegation[]
  ): Promise<GraphState> {
    // Update integration state
    this.integrationState.activeDelegations = taskDelegations;

    // Process delegation status changes
    for (const delegation of taskDelegations) {
      if (delegation.status === 'completed' && delegation.result) {
        // Notify completion callback if exists
        const callback = this.taskCompletionCallbacks.get(delegation.taskId);
        if (callback) {
          callback(delegation.result);
          this.taskCompletionCallbacks.delete(delegation.taskId);
        }
      }
    }

    return state;
  }

  /**
   * Auto-delegates tasks based on complexity threshold
   * 
   * @private
   */
  private async autoDelegate(state: GraphState): Promise<GraphState> {
    if (!state.taskPlan) {
      return state;
    }

    for (const task of state.taskPlan.tasks) {
      if (!task.completed && this.shouldAutoDelegate(task)) {
        try {
          const result = await this.delegateTask(task, 'manager');
          
          if (result.success) {
            this.logger.info('Auto-delegated task', {
              taskId: task.id,
              assignedAgents: result.assignedAgents
            });
          }

        } catch (error) {
          this.logger.warn('Auto-delegation failed', {
            taskId: task.id,
            error: error instanceof Error ? error.message : error
          });
        }
      }
    }

    return state;
  }

  /**
   * Determines if a task should be auto-delegated
   * 
   * @private
   */
  private shouldAutoDelegate(task: Task): boolean {
    const complexity = this.analyzeTaskComplexity(task);
    const thresholdLevel = this.getComplexityLevel(this.config.autoDelegationComplexityThreshold);
    const taskLevel = this.getComplexityLevel(complexity);
    
    return taskLevel >= thresholdLevel;
  }

  /**
   * Gets numeric complexity level for comparison
   * 
   * @private
   */
  private getComplexityLevel(complexity: TaskComplexity): number {
    switch (complexity) {
      case 'trivial': return 1;
      case 'simple': return 2;
      case 'moderate': return 3;
      case 'complex': return 4;
      case 'critical': return 5;
      default: return 3;
    }
  }

  /**
   * Analyzes task complexity from Open SWE task
   * 
   * @private
   */
  private analyzeTaskComplexity(task: Task): TaskComplexity {
    // Analyze based on various factors
    let complexityScore = 0;

    // Plan complexity
    const activePlan = task.planRevisions[task.activeRevisionIndex];
    if (activePlan) {
      complexityScore += activePlan.plans.length; // Number of plan items
    }

    // Description complexity (simple heuristics)
    const descriptionLength = task.title.length + task.request.length;
    complexityScore += Math.min(10, descriptionLength / 100);

    // Number of revisions (indicates complexity)
    complexityScore += task.planRevisions.length;

    // Determine complexity level
    if (complexityScore >= 15) return 'critical';
    if (complexityScore >= 10) return 'complex';
    if (complexityScore >= 5) return 'moderate';
    if (complexityScore >= 2) return 'simple';
    return 'trivial';
  }

  /**
   * Determines task priority
   * 
   * @private
   */
  private determinePriority(task: Task): TaskPriority {
    // Simple priority determination based on task characteristics
    if (task.request.toLowerCase().includes('urgent') || task.request.toLowerCase().includes('critical')) {
      return 'critical';
    }
    if (task.request.toLowerCase().includes('important') || task.request.toLowerCase().includes('priority')) {
      return 'high';
    }
    return 'normal';
  }

  /**
   * Extracts required capabilities from task
   * 
   * @private
   */
  private extractRequiredCapabilities(task: Task): string[] {
    const capabilities: string[] = [];

    // Extract from task description and request
    const text = `${task.title} ${task.request}`.toLowerCase();

    // Programming language detection
    const languages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp'];
    languages.forEach(lang => {
      if (text.includes(lang)) {
        capabilities.push(lang);
      }
    });

    // Technology detection
    const technologies = ['react', 'node', 'express', 'docker', 'kubernetes', 'aws', 'mongodb'];
    technologies.forEach(tech => {
      if (text.includes(tech)) {
        capabilities.push(tech);
      }
    });

    // Default capabilities
    if (capabilities.length === 0) {
      capabilities.push('software_development', 'problem_solving');
    }

    return capabilities;
  }

  /**
   * Extracts preferred capabilities from task
   * 
   * @private
   */
  private extractPreferredCapabilities(task: Task): string[] {
    const preferred: string[] = [];

    // Add testing capability for complex tasks
    const complexity = this.analyzeTaskComplexity(task);
    if (complexity === 'complex' || complexity === 'critical') {
      preferred.push('testing', 'code_review', 'documentation');
    }

    return preferred;
  }

  /**
   * Estimates task duration
   * 
   * @private
   */
  private estimateTaskDuration(task: Task, complexity: TaskComplexity): number {
    const baseDuration = {
      trivial: 300000,    // 5 minutes
      simple: 1800000,    // 30 minutes
      moderate: 3600000,  // 1 hour
      complex: 7200000,   // 2 hours
      critical: 14400000  // 4 hours
    };

    return baseDuration[complexity];
  }

  /**
   * Selects delegation pattern for task
   * 
   * @private
   */
  private selectDelegationPattern(task: Task, complexity: TaskComplexity): DelegationPattern {
    if (complexity === 'critical') {
      return 'consensus_based';
    }
    if (complexity === 'complex') {
      return 'hierarchical';
    }
    return this.config.defaultDelegationPattern;
  }

  /**
   * Selects execution pattern for task
   * 
   * @private
   */
  private selectExecutionPattern(task: Task, complexity: TaskComplexity): ExecutionPattern {
    if (complexity === 'complex' || complexity === 'critical') {
      return 'pipeline';
    }
    return 'sequential';
  }

  /**
   * Extracts dependencies between tasks
   * 
   * @private
   */
  private extractDependencies(task: Task, allTasks: Task[]): string[] {
    // Simple dependency extraction based on task indices
    // In a real implementation, this would be more sophisticated
    const dependencies: string[] = [];
    
    const currentIndex = task.taskIndex;
    if (currentIndex > 0) {
      const previousTask = allTasks.find(t => t.taskIndex === currentIndex - 1);
      if (previousTask) {
        dependencies.push(previousTask.id);
      }
    }

    return dependencies;
  }

  /**
   * Creates preconditions for workflow step
   * 
   * @private
   */
  private createPreconditions(task: Task) {
    return [
      {
        type: 'agent_available' as const,
        expression: 'any_suitable_agent',
        expectedValue: true,
        timeout: 30000
      }
    ];
  }

  /**
   * Creates postconditions for workflow step
   * 
   * @private
   */
  private createPostconditions(task: Task) {
    return [
      {
        type: 'data_available' as const,
        expression: `result_${task.id}`,
        expectedValue: true
      }
    ];
  }

  /**
   * Determines workflow execution pattern
   * 
   * @private
   */
  private determineWorkflowExecutionPattern(tasks: Task[]): ExecutionPattern {
    // Check if tasks can run in parallel
    const hasComplexTasks = tasks.some(task => 
      this.analyzeTaskComplexity(task) === 'complex' || 
      this.analyzeTaskComplexity(task) === 'critical'
    );

    if (hasComplexTasks) {
      return 'pipeline';
    }

    return 'sequential';
  }

  /**
   * Estimates workflow duration
   * 
   * @private
   */
  private estimateWorkflowDuration(steps: WorkflowStep[]): number {
    return steps.reduce((total, step) => total + (step.task.expectedDuration || 3600000), 0);
  }

  /**
   * Extracts required agents for workflow
   * 
   * @private
   */
  private extractWorkflowRequiredAgents(steps: WorkflowStep[]): string[] {
    const requiredRoles = new Set<string>();
    
    steps.forEach(step => {
      if (step.task.requiredRole) {
        requiredRoles.add(step.task.requiredRole);
      }
    });

    return Array.from(requiredRoles);
  }

  /**
   * Creates an agent profile for auto-provisioning
   * 
   * @private
   */
  private createAgentProfile(role: AgentRole, capabilities: string[]): AgentProfile {
    return {
      id: `auto_${role}_${Date.now()}`,
      role,
      specialization: capabilities,
      tools: this.getToolsForRole(role),
      collaborationRules: this.getDefaultCollaborationRules(role),
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
  }

  /**
   * Gets default tools for a role
   * 
   * @private
   */
  private getToolsForRole(role: AgentRole): string[] {
    const toolMap: Record<AgentRole, string[]> = {
      code_reviewer: ['code_analysis', 'static_analysis', 'diff_review'],
      test_engineer: ['unit_testing', 'integration_testing', 'test_automation'],
      documentation: ['markdown', 'documentation_generation', 'api_docs'],
      security: ['security_scan', 'vulnerability_assessment', 'penetration_testing'],
      architect: ['system_design', 'architecture_review', 'design_patterns'],
      code_smell_detector: ['code_analysis', 'refactoring', 'quality_metrics'],
      bug_pattern_analyzer: ['bug_detection', 'pattern_matching', 'root_cause_analysis'],
      performance_optimizer: ['performance_analysis', 'profiling', 'optimization'],
      architectural_reviewer: ['architecture_review', 'design_validation', 'best_practices'],
      solid_principles_validator: ['code_analysis', 'design_principles', 'refactoring_suggestions']
    };

    return toolMap[role] || ['general_purpose'];
  }

  /**
   * Gets default collaboration rules for a role
   * 
   * @private
   */
  private getDefaultCollaborationRules(role: AgentRole) {
    return [
      {
        trigger: 'task_assignment',
        targetRoles: ['code_reviewer'] as AgentRole[],
        priority: 'medium' as const
      }
    ];
  }

  /**
   * Gets delegation context update for collaboration context
   * 
   * @private
   */
  private getDelegationContextUpdate() {
    return {
      delegationStats: this.integrationState.delegationStats,
      activeWorkflowsCount: this.integrationState.activeWorkflows.size,
      autoProvisionedAgentsCount: this.integrationState.autoProvisionedAgents.size
    };
  }

  /**
   * Sets up event handlers for integration
   * 
   * @private
   */
  private setupEventHandlers(): void {
    // Handle delegation engine events
    this.delegationEngine.on('delegationEvent', (event) => {
      this.logger.debug('Delegation event received', {
        eventType: event.type,
        taskId: event.taskId
      });

      // Update integration statistics
      this.updateIntegrationStatistics(event);
    });

    // Handle agent registry events
    this.agentRegistry.on('event', (event) => {
      if (event.type === 'agent_registered') {
        this.logger.debug('Agent registered', {
          agentId: event.agentId
        });
      }
    });
  }

  /**
   * Initializes auto-provisioning if enabled
   * 
   * @private
   */
  private async initializeAutoProvisioning(): Promise<void> {
    if (!this.config.enableAutoProvisioning || 
        this.config.agentProvisioning.strategy !== 'pre_provision') {
      return;
    }

    // Pre-provision agents for common roles
    const commonCapabilities = ['software_development', 'problem_solving', 'communication'];
    
    for (const role of this.config.agentProvisioning.autoProvisionRoles) {
      try {
        const agents = await this.provisionAgents([role], commonCapabilities);
        this.logger.info('Pre-provisioned agents', {
          role,
          count: agents.length
        });
      } catch (error) {
        this.logger.error('Pre-provisioning failed', {
          role,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Updates integration statistics from events
   * 
   * @private
   */
  private updateIntegrationStatistics(event: any): void {
    // Update delegation timing
    if (event.type === 'delegation_completed' && event.data?.routingTime) {
      const currentAvg = this.integrationState.delegationStats.avgDelegationTime;
      const newTime = event.data.routingTime;
      this.integrationState.delegationStats.avgDelegationTime = 
        (currentAvg + newTime) / 2;
    }

    // Update agent utilization
    if (event.agentId) {
      const current = this.integrationState.delegationStats.agentUtilization[event.agentId] || 0;
      this.integrationState.delegationStats.agentUtilization[event.agentId] = current + 1;
    }
  }

  /**
   * Gets current integration statistics
   * 
   * @returns Integration statistics
   */
  getIntegrationStatistics() {
    return {
      ...this.integrationState.delegationStats,
      autoProvisionedAgents: this.integrationState.autoProvisionedAgents.size,
      activeWorkflows: this.integrationState.activeWorkflows.size,
      activeDelegations: this.integrationState.activeDelegations.length
    };
  }

  /**
   * Shuts down the integration layer
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down TaskDelegationIntegration');

    // Shutdown delegation engine
    await this.delegationEngine.shutdown();

    // Clean up state
    this.integrationState.activeDelegations = [];
    this.integrationState.autoProvisionedAgents.clear();
    this.integrationState.activeWorkflows.clear();
    this.taskCompletionCallbacks.clear();
    this.workflowCompletionCallbacks.clear();

    this.logger.info('TaskDelegationIntegration shutdown complete');
  }
}