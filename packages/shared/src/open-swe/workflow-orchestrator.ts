/**
 * Workflow Orchestrator for Complex Multi-Agent Workflows
 * 
 * Manages complex workflows with multiple agents, parallel execution,
 * dependency management, and sophisticated coordination patterns.
 */

import { EventEmitter } from 'events';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import { TaskRouter } from './task-router.js';
import { AgentCommunicationHub } from './agent-communication-hub.js';
import { AgentRegistry } from './agent-registry-impl.js';
import { AgentMessage } from './types.js';
import {
  WorkflowPlan,
  WorkflowStep,
  WorkflowCondition,
  ExecutionPattern,
  TaskDelegationRequest,
  TaskRoutingDecision,
  ErrorHandlingStrategy,
  RetryConfig,
  TaskStatus,
  TaskPriority
} from './task-delegation-types.js';

/**
 * Workflow execution state
 */
type WorkflowExecutionState = 'created' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Step execution state
 */
type StepExecutionState = 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled' | 'skipped';

/**
 * Workflow execution context
 */
interface WorkflowExecutionContext {
  /**
   * Workflow plan being executed
   */
  plan: WorkflowPlan;
  
  /**
   * Current execution state
   */
  state: WorkflowExecutionState;
  
  /**
   * Step execution states
   */
  stepStates: Map<string, StepExecutionState>;
  
  /**
   * Step execution results
   */
  stepResults: Map<string, unknown>;
  
  /**
   * Step routing decisions
   */
  stepRoutingDecisions: Map<string, TaskRoutingDecision>;
  
  /**
   * Execution start time
   */
  startTime: number;
  
  /**
   * Execution end time (if completed)
   */
  endTime?: number;
  
  /**
   * Currently running steps
   */
  runningSteps: Set<string>;
  
  /**
   * Error information
   */
  errors: Map<string, Error>;
  
  /**
   * Retry attempts per step
   */
  retryAttempts: Map<string, number>;
  
  /**
   * Shared execution data between steps
   */
  sharedData: Map<string, unknown>;
  
  /**
   * Execution metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Workflow execution statistics
 */
interface WorkflowExecutionStats {
  /**
   * Total execution time
   */
  totalExecutionTime: number;
  
  /**
   * Number of steps executed
   */
  stepsExecuted: number;
  
  /**
   * Number of steps failed
   */
  stepsFailed: number;
  
  /**
   * Number of steps skipped
   */
  stepsSkipped: number;
  
  /**
   * Agent utilization during workflow
   */
  agentUtilization: Record<string, number>;
  
  /**
   * Parallel execution efficiency
   */
  parallelEfficiency: number;
  
  /**
   * Error recovery attempts
   */
  recoveryAttempts: number;
  
  /**
   * Success rate
   */
  successRate: number;
}

/**
 * Workflow orchestrator configuration
 */
interface OrchestratorConfig {
  /**
   * Maximum concurrent workflows
   */
  maxConcurrentWorkflows: number;
  
  /**
   * Default step timeout (ms)
   */
  defaultStepTimeout: number;
  
  /**
   * Workflow monitoring interval (ms)
   */
  monitoringInterval: number;
  
  /**
   * Enable automatic recovery
   */
  enableAutoRecovery: boolean;
  
  /**
   * Maximum retry attempts per step
   */
  maxRetryAttempts: number;
  
  /**
   * Deadlock detection timeout (ms)
   */
  deadlockDetectionTimeout: number;
  
  /**
   * Resource allocation timeout (ms)
   */
  resourceAllocationTimeout: number;
}

/**
 * Workflow event types
 */
type WorkflowEventType = 
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_paused'
  | 'workflow_resumed'
  | 'workflow_cancelled'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_retried'
  | 'dependency_resolved'
  | 'error_recovered'
  | 'deadlock_detected'
  | 'resource_allocated'
  | 'coordination_message';

/**
 * Workflow event data
 */
interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  workflowId: string;
  stepId?: string;
  agentId?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Comprehensive Workflow Orchestrator
 */
export class WorkflowOrchestrator extends EventEmitter {
  private readonly logger = createLogger(LogLevel.INFO, 'WorkflowOrchestrator');

  /**
   * Active workflow execution contexts
   */
  private readonly activeWorkflows = new Map<string, WorkflowExecutionContext>();

  /**
   * Workflow execution statistics
   */
  private readonly workflowStats = new Map<string, WorkflowExecutionStats>();

  /**
   * Coordination state for inter-workflow communication
   */
  private readonly coordinationState = new Map<string, unknown>();

  /**
   * Orchestrator configuration
   */
  private readonly config: OrchestratorConfig;

  /**
   * Monitoring intervals
   */
  private monitoringInterval?: NodeJS.Timeout;
  private deadlockDetectionInterval?: NodeJS.Timeout;

  /**
   * Overall orchestrator statistics
   */
  private readonly globalStats = {
    totalWorkflowsExecuted: 0,
    successfulWorkflows: 0,
    failedWorkflows: 0,
    avgExecutionTime: 0,
    avgStepsPerWorkflow: 0,
    parallelExecutionEfficiency: 0,
    lastUpdated: Date.now()
  };

  constructor(
    private readonly taskRouter: TaskRouter,
    private readonly communicationHub: AgentCommunicationHub,
    private readonly agentRegistry: AgentRegistry,
    config?: Partial<OrchestratorConfig>
  ) {
    super();

    this.config = {
      maxConcurrentWorkflows: 10,
      defaultStepTimeout: 300000, // 5 minutes
      monitoringInterval: 5000,   // 5 seconds
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      deadlockDetectionTimeout: 600000, // 10 minutes
      resourceAllocationTimeout: 30000,  // 30 seconds
      ...config
    };

    this.initializeMonitoring();
    this.logger.info('WorkflowOrchestrator initialized', { config: this.config });
  }

  /**
   * Executes a workflow plan with comprehensive orchestration
   * 
   * @param plan - Workflow plan to execute
   * @param metadata - Optional execution metadata
   * @returns Promise resolving to execution context
   */
  async executeWorkflow(
    plan: WorkflowPlan,
    metadata?: Record<string, unknown>
  ): Promise<WorkflowExecutionContext> {
    const startTime = Date.now();

    try {
      // Check workflow limits
      if (this.activeWorkflows.size >= this.config.maxConcurrentWorkflows) {
        throw new Error(`Maximum concurrent workflows limit reached (${this.config.maxConcurrentWorkflows})`);
      }

      this.logger.info('Starting workflow execution', {
        workflowId: plan.id,
        stepsCount: plan.steps.length,
        executionPattern: plan.executionPattern
      });

      // Validate workflow plan
      this.validateWorkflowPlan(plan);

      // Create execution context
      const context = this.createExecutionContext(plan, metadata);
      
      // Register active workflow
      this.activeWorkflows.set(plan.id, context);

      // Initialize workflow statistics
      this.initializeWorkflowStats(plan.id);

      // Emit workflow started event
      this.emitWorkflowEvent({
        id: `workflow_start_${plan.id}_${Date.now()}`,
        type: 'workflow_started',
        workflowId: plan.id,
        data: { plan, metadata },
        timestamp: Date.now()
      });

      // Start execution based on pattern
      await this.startWorkflowExecution(context);

      return context;

    } catch (error) {
      this.logger.error('Failed to start workflow execution', {
        workflowId: plan.id,
        error: error instanceof Error ? error.message : error
      });

      // Clean up if workflow failed to start
      this.activeWorkflows.delete(plan.id);
      throw error;
    }
  }

  /**
   * Pauses a running workflow
   * 
   * @param workflowId - Workflow identifier
   * @returns Promise resolving when paused
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (context.state !== 'running') {
      throw new Error(`Workflow ${workflowId} is not running (current state: ${context.state})`);
    }

    this.logger.info('Pausing workflow', { workflowId });

    context.state = 'paused';

    this.emitWorkflowEvent({
      id: `workflow_pause_${workflowId}_${Date.now()}`,
      type: 'workflow_paused',
      workflowId,
      data: { pausedAt: Date.now() },
      timestamp: Date.now()
    });
  }

  /**
   * Resumes a paused workflow
   * 
   * @param workflowId - Workflow identifier
   * @returns Promise resolving when resumed
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (context.state !== 'paused') {
      throw new Error(`Workflow ${workflowId} is not paused (current state: ${context.state})`);
    }

    this.logger.info('Resuming workflow', { workflowId });

    context.state = 'running';
    
    // Continue execution
    await this.continueWorkflowExecution(context);

    this.emitWorkflowEvent({
      id: `workflow_resume_${workflowId}_${Date.now()}`,
      type: 'workflow_resumed',
      workflowId,
      data: { resumedAt: Date.now() },
      timestamp: Date.now()
    });
  }

  /**
   * Cancels a workflow execution
   * 
   * @param workflowId - Workflow identifier
   * @param reason - Cancellation reason
   * @returns Promise resolving when cancelled
   */
  async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    this.logger.info('Cancelling workflow', { workflowId, reason });

    context.state = 'cancelled';
    context.endTime = Date.now();

    // Cancel all running steps
    for (const stepId of context.runningSteps) {
      context.stepStates.set(stepId, 'cancelled');
    }

    // Clean up resources
    await this.cleanupWorkflowResources(context);

    // Emit cancellation event
    this.emitWorkflowEvent({
      id: `workflow_cancel_${workflowId}_${Date.now()}`,
      type: 'workflow_cancelled',
      workflowId,
      data: { reason, cancelledAt: Date.now() },
      timestamp: Date.now()
    });

    // Update statistics
    this.updateWorkflowStats(context);
    
    // Remove from active workflows
    this.activeWorkflows.delete(workflowId);
  }

  /**
   * Gets the current status of a workflow
   * 
   * @param workflowId - Workflow identifier
   * @returns Workflow status information
   */
  getWorkflowStatus(workflowId: string): {
    state: WorkflowExecutionState;
    progress: number;
    stepsCompleted: number;
    stepsTotal: number;
    runningSteps: string[];
    errors: string[];
    estimatedCompletion?: number;
  } | null {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      return null;
    }

    const stepsTotal = context.plan.steps.length;
    const stepsCompleted = Array.from(context.stepStates.values()).filter(state => state === 'completed').length;
    const progress = (stepsCompleted / stepsTotal) * 100;

    const errors = Array.from(context.errors.values()).map(error => error.message);

    let estimatedCompletion: number | undefined;
    if (context.state === 'running' && stepsCompleted > 0) {
      const elapsedTime = Date.now() - context.startTime;
      const avgTimePerStep = elapsedTime / stepsCompleted;
      const remainingSteps = stepsTotal - stepsCompleted;
      estimatedCompletion = Date.now() + (avgTimePerStep * remainingSteps);
    }

    return {
      state: context.state,
      progress,
      stepsCompleted,
      stepsTotal,
      runningSteps: Array.from(context.runningSteps),
      errors,
      estimatedCompletion
    };
  }

  /**
   * Gets execution statistics for a workflow
   * 
   * @param workflowId - Workflow identifier
   * @returns Workflow execution statistics
   */
  getWorkflowStatistics(workflowId: string): WorkflowExecutionStats | null {
    return this.workflowStats.get(workflowId) || null;
  }

  /**
   * Gets overall orchestrator statistics
   * 
   * @returns Global orchestrator statistics
   */
  getOrchestratorStatistics(): typeof this.globalStats {
    this.globalStats.lastUpdated = Date.now();
    return { ...this.globalStats };
  }

  /**
   * Sends coordination messages between workflow steps
   * 
   * @param fromStepId - Source step identifier
   * @param toStepId - Target step identifier
   * @param data - Coordination data
   * @param workflowId - Workflow identifier
   * @returns Promise resolving when message is sent
   */
  async sendCoordinationMessage(
    fromStepId: string,
    toStepId: string,
    data: Record<string, unknown>,
    workflowId: string
  ): Promise<void> {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const message: AgentMessage = {
      id: `coord_${fromStepId}_${toStepId}_${Date.now()}`,
      fromAgentId: fromStepId,
      toAgentId: toStepId,
      type: 'collaboration',
      content: 'Workflow coordination message',
      data,
      timestamp: Date.now(),
      priority: 'normal'
    };

    // Store coordination data
    const coordKey = `${workflowId}_${fromStepId}_${toStepId}`;
    this.coordinationState.set(coordKey, data);

    // Send through communication hub
    await this.communicationHub.sendMessage(fromStepId, toStepId, message);

    this.emitWorkflowEvent({
      id: `coord_msg_${Date.now()}`,
      type: 'coordination_message',
      workflowId,
      stepId: fromStepId,
      data: { toStepId, coordinationData: data },
      timestamp: Date.now()
    });

    this.logger.debug('Coordination message sent', {
      workflowId,
      fromStepId,
      toStepId,
      dataKeys: Object.keys(data)
    });
  }

  /**
   * Validates a workflow plan for correctness
   * 
   * @private
   */
  private validateWorkflowPlan(plan: WorkflowPlan): void {
    if (!plan.id || !plan.name) {
      throw new Error('Workflow plan must have id and name');
    }

    if (!plan.steps || plan.steps.length === 0) {
      throw new Error('Workflow plan must have at least one step');
    }

    // Validate step dependencies
    const stepIds = new Set(plan.steps.map(step => step.id));
    
    for (const step of plan.steps) {
      if (!step.id || !step.name) {
        throw new Error('Each workflow step must have id and name');
      }

      // Check dependencies exist
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          throw new Error(`Step ${step.id} depends on non-existent step ${depId}`);
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(plan.steps);

    this.logger.debug('Workflow plan validation passed', {
      workflowId: plan.id,
      stepsCount: plan.steps.length
    });
  }

  /**
   * Detects circular dependencies in workflow steps
   * 
   * @private
   */
  private detectCircularDependencies(steps: WorkflowStep[]): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const stepMap = new Map(steps.map(step => [step.id, step]));

    const visit = (stepId: string): void => {
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving step ${stepId}`);
      }

      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);
      
      const step = stepMap.get(stepId);
      if (step) {
        for (const depId of step.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }
  }

  /**
   * Creates execution context for a workflow
   * 
   * @private
   */
  private createExecutionContext(
    plan: WorkflowPlan,
    metadata?: Record<string, unknown>
  ): WorkflowExecutionContext {
    const stepStates = new Map<string, StepExecutionState>();
    
    // Initialize all steps as pending
    for (const step of plan.steps) {
      stepStates.set(step.id, 'pending');
    }

    return {
      plan,
      state: 'created',
      stepStates,
      stepResults: new Map(),
      stepRoutingDecisions: new Map(),
      startTime: Date.now(),
      runningSteps: new Set(),
      errors: new Map(),
      retryAttempts: new Map(),
      sharedData: new Map(),
      metadata: metadata || {}
    };
  }

  /**
   * Initializes workflow execution statistics
   * 
   * @private
   */
  private initializeWorkflowStats(workflowId: string): void {
    const stats: WorkflowExecutionStats = {
      totalExecutionTime: 0,
      stepsExecuted: 0,
      stepsFailed: 0,
      stepsSkipped: 0,
      agentUtilization: {},
      parallelExecutionEfficiency: 0,
      recoveryAttempts: 0,
      successRate: 0
    };

    this.workflowStats.set(workflowId, stats);
  }

  /**
   * Starts workflow execution based on execution pattern
   * 
   * @private
   */
  private async startWorkflowExecution(context: WorkflowExecutionContext): Promise<void> {
    context.state = 'running';

    switch (context.plan.executionPattern) {
      case 'sequential':
        await this.executeSequential(context);
        break;
      case 'parallel':
        await this.executeParallel(context);
        break;
      case 'pipeline':
        await this.executePipeline(context);
        break;
      case 'fan_out':
        await this.executeFanOut(context);
        break;
      case 'fan_in':
        await this.executeFanIn(context);
        break;
      case 'conditional':
        await this.executeConditional(context);
        break;
      case 'iterative':
        await this.executeIterative(context);
        break;
      default:
        await this.executeSequential(context); // Default to sequential
    }
  }

  /**
   * Continues workflow execution after pause
   * 
   * @private
   */
  private async continueWorkflowExecution(context: WorkflowExecutionContext): Promise<void> {
    // Find ready-to-run steps and continue execution
    await this.processReadySteps(context);
  }

  /**
   * Executes workflow steps sequentially
   * 
   * @private
   */
  private async executeSequential(context: WorkflowExecutionContext): Promise<void> {
    const sortedSteps = this.topologicalSort(context.plan.steps);

    for (const step of sortedSteps) {
      if (context.state !== 'running') break;

      await this.executeStep(step, context);
      
      // Wait for step completion
      await this.waitForStepCompletion(step.id, context);
    }

    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes workflow steps in parallel
   * 
   * @private
   */
  private async executeParallel(context: WorkflowExecutionContext): Promise<void> {
    const independentSteps = context.plan.steps.filter(step => step.dependencies.length === 0);
    const dependentSteps = context.plan.steps.filter(step => step.dependencies.length > 0);

    // Start all independent steps in parallel
    const promises = independentSteps.map(step => this.executeStep(step, context));
    await Promise.all(promises);

    // Process dependent steps as their dependencies complete
    await this.processStepsWithDependencies(dependentSteps, context);
    
    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes workflow steps in pipeline pattern
   * 
   * @private
   */
  private async executePipeline(context: WorkflowExecutionContext): Promise<void> {
    const sortedSteps = this.topologicalSort(context.plan.steps);

    for (const step of sortedSteps) {
      if (context.state !== 'running') break;

      await this.executeStep(step, context);
      
      // Don't wait for completion, let pipeline flow
      if (step === sortedSteps[sortedSteps.length - 1]) {
        await this.waitForStepCompletion(step.id, context);
      }
    }

    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes workflow in fan-out pattern
   * 
   * @private
   */
  private async executeFanOut(context: WorkflowExecutionContext): Promise<void> {
    // Find the root step (no dependencies)
    const rootSteps = context.plan.steps.filter(step => step.dependencies.length === 0);
    
    if (rootSteps.length !== 1) {
      throw new Error('Fan-out pattern requires exactly one root step');
    }

    const rootStep = rootSteps[0];
    await this.executeStep(rootStep, context);
    await this.waitForStepCompletion(rootStep.id, context);

    // Execute all dependent steps in parallel
    const fanOutSteps = context.plan.steps.filter(step => 
      step.dependencies.length === 1 && step.dependencies[0] === rootStep.id
    );

    const promises = fanOutSteps.map(step => this.executeStep(step, context));
    await Promise.all(promises);

    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes workflow in fan-in pattern
   * 
   * @private
   */
  private async executeFanIn(context: WorkflowExecutionContext): Promise<void> {
    // Execute all root steps in parallel
    const rootSteps = context.plan.steps.filter(step => step.dependencies.length === 0);
    const promises = rootSteps.map(step => this.executeStep(step, context));
    await Promise.all(promises);

    // Find the convergence step (depends on all roots)
    const convergenceSteps = context.plan.steps.filter(step =>
      rootSteps.every(root => step.dependencies.includes(root.id))
    );

    if (convergenceSteps.length === 1) {
      await this.executeStep(convergenceSteps[0], context);
      await this.waitForStepCompletion(convergenceSteps[0].id, context);
    }

    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes workflow with conditional logic
   * 
   * @private
   */
  private async executeConditional(context: WorkflowExecutionContext): Promise<void> {
    // Implement conditional execution based on step preconditions
    for (const step of context.plan.steps) {
      if (context.state !== 'running') break;

      const shouldExecute = await this.evaluatePreconditions(step, context);
      
      if (shouldExecute) {
        await this.executeStep(step, context);
        await this.waitForStepCompletion(step.id, context);
      } else {
        context.stepStates.set(step.id, 'skipped');
        this.logger.info('Step skipped due to failed preconditions', {
          workflowId: context.plan.id,
          stepId: step.id
        });
      }
    }

    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes workflow with iterative pattern
   * 
   * @private
   */
  private async executeIterative(context: WorkflowExecutionContext): Promise<void> {
    let iteration = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (iteration < maxIterations && context.state === 'running') {
      let allConditionsMet = true;

      for (const step of context.plan.steps) {
        const conditionsMet = await this.evaluatePostconditions(step, context);
        if (!conditionsMet) {
          allConditionsMet = false;
          await this.executeStep(step, context);
          await this.waitForStepCompletion(step.id, context);
        }
      }

      if (allConditionsMet) {
        break; // All postconditions satisfied
      }

      iteration++;
    }

    if (iteration >= maxIterations) {
      throw new Error('Maximum iterations exceeded in iterative workflow');
    }

    await this.completeWorkflowIfReady(context);
  }

  /**
   * Executes a single workflow step
   * 
   * @private
   */
  private async executeStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void> {
    const stepId = step.id;
    
    try {
      // Check if step can be executed
      if (!await this.canExecuteStep(step, context)) {
        context.stepStates.set(stepId, 'blocked');
        return;
      }

      this.logger.info('Executing workflow step', {
        workflowId: context.plan.id,
        stepId,
        stepName: step.name
      });

      context.stepStates.set(stepId, 'running');
      context.runningSteps.add(stepId);

      // Emit step started event
      this.emitWorkflowEvent({
        id: `step_start_${stepId}_${Date.now()}`,
        type: 'step_started',
        workflowId: context.plan.id,
        stepId,
        data: { step },
        timestamp: Date.now()
      });

      // Route the task
      const routingDecision = await this.taskRouter.routeTask(step.task);
      context.stepRoutingDecisions.set(stepId, routingDecision);

      if (routingDecision.assignments.length === 0) {
        throw new Error(`No suitable agents found for step ${stepId}`);
      }

      // Monitor step execution
      this.monitorStepExecution(step, context);

      // For now, simulate step completion (in real implementation, this would track actual agent execution)
      setTimeout(async () => {
        await this.handleStepCompletion(step, context, { success: true });
      }, Math.random() * 5000 + 1000); // Random delay 1-6 seconds

    } catch (error) {
      await this.handleStepError(step, context, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Checks if a step can be executed (dependencies met)
   * 
   * @private
   */
  private async canExecuteStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<boolean> {
    // Check dependencies
    for (const depId of step.dependencies) {
      const depState = context.stepStates.get(depId);
      if (depState !== 'completed') {
        return false;
      }
    }

    // Check preconditions
    return this.evaluatePreconditions(step, context);
  }

  /**
   * Evaluates step preconditions
   * 
   * @private
   */
  private async evaluatePreconditions(step: WorkflowStep, context: WorkflowExecutionContext): Promise<boolean> {
    for (const condition of step.preconditions) {
      const result = await this.evaluateCondition(condition, context);
      if (result !== condition.expectedValue) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluates step postconditions
   * 
   * @private
   */
  private async evaluatePostconditions(step: WorkflowStep, context: WorkflowExecutionContext): Promise<boolean> {
    for (const condition of step.postconditions) {
      const result = await this.evaluateCondition(condition, context);
      if (result !== condition.expectedValue) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluates a workflow condition
   * 
   * @private
   */
  private async evaluateCondition(condition: WorkflowCondition, context: WorkflowExecutionContext): Promise<boolean> {
    switch (condition.type) {
      case 'data_available':
        return context.sharedData.has(condition.expression);
      
      case 'agent_available':
        const agentProfile = this.agentRegistry.getAgentDetails(condition.expression);
        return agentProfile?.status === 'active';
      
      case 'time_constraint':
        const timeLimit = parseInt(condition.expression, 10);
        return (Date.now() - context.startTime) < timeLimit;
      
      case 'resource_available':
        // Check system resources
        return true; // Simplified
      
      case 'custom':
        // Custom condition evaluation would be implemented here
        return true; // Simplified
      
      default:
        return true;
    }
  }

  /**
   * Monitors step execution for timeout and health
   * 
   * @private
   */
  private monitorStepExecution(step: WorkflowStep, context: WorkflowExecutionContext): void {
    const timeout = step.timeout || this.config.defaultStepTimeout;
    
    setTimeout(() => {
      if (context.stepStates.get(step.id) === 'running') {
        this.logger.warn('Step execution timeout', {
          workflowId: context.plan.id,
          stepId: step.id,
          timeout
        });
        
        this.handleStepTimeout(step, context);
      }
    }, timeout);
  }

  /**
   * Handles step completion
   * 
   * @private
   */
  private async handleStepCompletion(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    result: unknown
  ): Promise<void> {
    const stepId = step.id;
    
    context.stepStates.set(stepId, 'completed');
    context.runningSteps.delete(stepId);
    context.stepResults.set(stepId, result);

    // Update statistics
    const stats = this.workflowStats.get(context.plan.id)!;
    stats.stepsExecuted++;

    this.emitWorkflowEvent({
      id: `step_complete_${stepId}_${Date.now()}`,
      type: 'step_completed',
      workflowId: context.plan.id,
      stepId,
      data: { result },
      timestamp: Date.now()
    });

    this.logger.info('Step completed successfully', {
      workflowId: context.plan.id,
      stepId,
      stepName: step.name
    });

    // Check if workflow is ready for completion
    await this.completeWorkflowIfReady(context);

    // Process any newly ready steps
    await this.processReadySteps(context);
  }

  /**
   * Handles step execution errors
   * 
   * @private
   */
  private async handleStepError(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    error: Error
  ): Promise<void> {
    const stepId = step.id;
    
    this.logger.error('Step execution failed', {
      workflowId: context.plan.id,
      stepId,
      error: error.message
    });

    context.errors.set(stepId, error);

    // Attempt recovery based on error handling strategy
    const recovered = await this.attemptStepRecovery(step, context, error);

    if (!recovered) {
      context.stepStates.set(stepId, 'failed');
      context.runningSteps.delete(stepId);

      // Update statistics
      const stats = this.workflowStats.get(context.plan.id)!;
      stats.stepsFailed++;

      this.emitWorkflowEvent({
        id: `step_failed_${stepId}_${Date.now()}`,
        type: 'step_failed',
        workflowId: context.plan.id,
        stepId,
        data: { error: error.message },
        timestamp: Date.now()
      });

      // Check if workflow should fail
      await this.checkWorkflowFailure(context);
    }
  }

  /**
   * Handles step timeout
   * 
   * @private
   */
  private async handleStepTimeout(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void> {
    const error = new Error(`Step execution timeout after ${step.timeout || this.config.defaultStepTimeout}ms`);
    await this.handleStepError(step, context, error);
  }

  /**
   * Attempts to recover from step failures
   * 
   * @private
   */
  private async attemptStepRecovery(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    error: Error
  ): Promise<boolean> {
    if (!this.config.enableAutoRecovery) {
      return false;
    }

    const stepId = step.id;
    const currentAttempts = context.retryAttempts.get(stepId) || 0;
    
    if (currentAttempts >= (step.retryConfig?.maxRetries || this.config.maxRetryAttempts)) {
      this.logger.info('Maximum retry attempts reached for step', {
        workflowId: context.plan.id,
        stepId,
        attempts: currentAttempts
      });
      return false;
    }

    const strategy = step.errorHandling;
    
    try {
      switch (strategy.strategy) {
        case 'retry':
          return await this.retryStep(step, context);
          
        case 'fallback':
          return await this.executeFallbackAgents(step, context);
          
        case 'escalate':
          return await this.escalateStepError(step, context, error);
          
        case 'skip':
          context.stepStates.set(stepId, 'skipped');
          return true;
          
        case 'compensate':
          return await this.executeCompensation(step, context);
          
        case 'fail_fast':
          return false;
          
        default:
          return false;
      }
      
    } catch (recoveryError) {
      this.logger.error('Step recovery failed', {
        workflowId: context.plan.id,
        stepId,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError
      });
      return false;
    }
  }

  /**
   * Retries a failed step
   * 
   * @private
   */
  private async retryStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<boolean> {
    const stepId = step.id;
    const attempts = (context.retryAttempts.get(stepId) || 0) + 1;
    
    context.retryAttempts.set(stepId, attempts);
    
    // Calculate retry delay
    const retryConfig = step.retryConfig || { 
      maxRetries: this.config.maxRetryAttempts,
      initialDelay: 1000,
      backoffStrategy: 'exponential' as const,
      maxDelay: 30000,
      retryOnDifferentAgent: false
    };
    
    let delay = retryConfig.initialDelay;
    
    switch (retryConfig.backoffStrategy) {
      case 'exponential':
        delay = Math.min(retryConfig.maxDelay, delay * Math.pow(2, attempts - 1));
        break;
      case 'linear':
        delay = Math.min(retryConfig.maxDelay, delay * attempts);
        break;
      case 'fixed':
        // Keep initial delay
        break;
    }

    if (retryConfig.jitter) {
      delay += Math.random() * retryConfig.jitter;
    }

    this.logger.info('Retrying step execution', {
      workflowId: context.plan.id,
      stepId,
      attempt: attempts,
      delay
    });

    // Update statistics
    const stats = this.workflowStats.get(context.plan.id)!;
    stats.recoveryAttempts++;

    this.emitWorkflowEvent({
      id: `step_retry_${stepId}_${Date.now()}`,
      type: 'step_retried',
      workflowId: context.plan.id,
      stepId,
      data: { attempt: attempts, delay },
      timestamp: Date.now()
    });

    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry the step
    await this.executeStep(step, context);
    return true;
  }

  /**
   * Executes fallback agents for a failed step
   * 
   * @private
   */
  private async executeFallbackAgents(step: WorkflowStep, context: WorkflowExecutionContext): Promise<boolean> {
    const routingDecision = context.stepRoutingDecisions.get(step.id);
    
    if (!routingDecision || routingDecision.fallbackOptions.length === 0) {
      return false;
    }

    // Try fallback agents
    for (const fallbackAgent of routingDecision.fallbackOptions) {
      try {
        // Simulate fallback execution
        this.logger.info('Trying fallback agent', {
          workflowId: context.plan.id,
          stepId: step.id,
          fallbackAgentId: fallbackAgent.agentId
        });

        // In real implementation, would execute with fallback agent
        await this.handleStepCompletion(step, context, { success: true, usedFallback: true });
        return true;

      } catch (fallbackError) {
        this.logger.warn('Fallback agent also failed', {
          workflowId: context.plan.id,
          stepId: step.id,
          fallbackAgentId: fallbackAgent.agentId,
          error: fallbackError instanceof Error ? fallbackError.message : fallbackError
        });
      }
    }

    return false;
  }

  /**
   * Escalates step error to a supervisor agent
   * 
   * @private
   */
  private async escalateStepError(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    error: Error
  ): Promise<boolean> {
    const escalationAgent = step.errorHandling.escalationAgent;
    
    if (!escalationAgent) {
      return false;
    }

    this.logger.info('Escalating step error', {
      workflowId: context.plan.id,
      stepId: step.id,
      escalationAgent
    });

    // Send escalation message
    const escalationMessage: AgentMessage = {
      id: `escalation_${step.id}_${Date.now()}`,
      fromAgentId: 'workflow_orchestrator',
      toAgentId: escalationAgent,
      type: 'request',
      content: `Step ${step.id} failed in workflow ${context.plan.id}`,
      data: { 
        step, 
        error: error.message,
        context: context.metadata
      },
      timestamp: Date.now(),
      priority: 'high'
    };

    await this.communicationHub.sendMessage('workflow_orchestrator', escalationAgent, escalationMessage);
    
    // In real implementation, would wait for escalation response
    return false; // Placeholder
  }

  /**
   * Executes compensation actions for a failed step
   * 
   * @private
   */
  private async executeCompensation(step: WorkflowStep, context: WorkflowExecutionContext): Promise<boolean> {
    const compensationActions = step.errorHandling.compensationActions;
    
    if (!compensationActions || compensationActions.length === 0) {
      return false;
    }

    this.logger.info('Executing compensation actions', {
      workflowId: context.plan.id,
      stepId: step.id,
      actionsCount: compensationActions.length
    });

    // Execute compensation actions
    for (const action of compensationActions) {
      // In real implementation, would execute actual compensation
      this.logger.debug('Executing compensation action', {
        workflowId: context.plan.id,
        stepId: step.id,
        action
      });
    }

    return true;
  }

  /**
   * Processes steps that are ready to run
   * 
   * @private
   */
  private async processReadySteps(context: WorkflowExecutionContext): Promise<void> {
    const readySteps = context.plan.steps.filter(step => {
      const state = context.stepStates.get(step.id);
      return state === 'pending' || state === 'blocked';
    }).filter(step => this.canExecuteStep(step, context));

    for (const step of readySteps) {
      if (context.state !== 'running') break;
      await this.executeStep(step, context);
    }
  }

  /**
   * Processes steps with dependencies as they complete
   * 
   * @private
   */
  private async processStepsWithDependencies(
    steps: WorkflowStep[],
    context: WorkflowExecutionContext
  ): Promise<void> {
    while (steps.length > 0 && context.state === 'running') {
      const readySteps = steps.filter(step => this.canExecuteStep(step, context));
      
      if (readySteps.length === 0) {
        // Wait for some steps to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Execute ready steps in parallel
      const promises = readySteps.map(step => this.executeStep(step, context));
      await Promise.all(promises);

      // Remove executed steps
      steps = steps.filter(step => !readySteps.includes(step));
    }
  }

  /**
   * Waits for a step to complete
   * 
   * @private
   */
  private async waitForStepCompletion(stepId: string, context: WorkflowExecutionContext): Promise<void> {
    while (context.state === 'running') {
      const state = context.stepStates.get(stepId);
      
      if (state === 'completed' || state === 'failed' || state === 'cancelled' || state === 'skipped') {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Completes the workflow if all steps are done
   * 
   * @private
   */
  private async completeWorkflowIfReady(context: WorkflowExecutionContext): Promise<void> {
    const allStatesResolved = Array.from(context.stepStates.values()).every(state => 
      ['completed', 'failed', 'cancelled', 'skipped'].includes(state)
    );

    if (!allStatesResolved) {
      return;
    }

    const hasFailures = Array.from(context.stepStates.values()).some(state => state === 'failed');

    if (hasFailures && !await this.shouldContinueWithFailures(context)) {
      context.state = 'failed';
    } else {
      context.state = 'completed';
    }

    context.endTime = Date.now();

    // Emit completion event
    this.emitWorkflowEvent({
      id: `workflow_${context.state}_${context.plan.id}_${Date.now()}`,
      type: context.state === 'completed' ? 'workflow_completed' : 'workflow_failed',
      workflowId: context.plan.id,
      data: { 
        executionTime: context.endTime - context.startTime,
        stepsCompleted: Array.from(context.stepStates.values()).filter(s => s === 'completed').length,
        stepsFailed: Array.from(context.stepStates.values()).filter(s => s === 'failed').length
      },
      timestamp: Date.now()
    });

    this.logger.info(`Workflow ${context.state}`, {
      workflowId: context.plan.id,
      executionTime: context.endTime - context.startTime,
      stepsCompleted: Array.from(context.stepStates.values()).filter(s => s === 'completed').length,
      stepsFailed: Array.from(context.stepStates.values()).filter(s => s === 'failed').length
    });

    // Clean up resources
    await this.cleanupWorkflowResources(context);

    // Update statistics
    this.updateWorkflowStats(context);

    // Remove from active workflows
    this.activeWorkflows.delete(context.plan.id);
  }

  /**
   * Checks if workflow should continue with some step failures
   * 
   * @private
   */
  private async shouldContinueWithFailures(context: WorkflowExecutionContext): Promise<boolean> {
    // Check global error handling strategy
    const globalStrategy = context.plan.globalErrorHandling;
    
    switch (globalStrategy.strategy) {
      case 'skip':
        return true; // Continue with failures
      case 'fail_fast':
        return false; // Fail on any step failure
      default:
        // Check if critical steps failed
        const criticalStepsFailed = context.plan.steps.some(step => {
          const state = context.stepStates.get(step.id);
          const isCritical = step.task.priority === 'critical';
          return isCritical && state === 'failed';
        });
        return !criticalStepsFailed;
    }
  }

  /**
   * Checks if workflow should fail due to step failures
   * 
   * @private
   */
  private async checkWorkflowFailure(context: WorkflowExecutionContext): Promise<void> {
    const globalStrategy = context.plan.globalErrorHandling;
    
    if (globalStrategy.strategy === 'fail_fast') {
      context.state = 'failed';
      context.endTime = Date.now();
      
      // Cancel all running steps
      for (const stepId of context.runningSteps) {
        context.stepStates.set(stepId, 'cancelled');
      }
      context.runningSteps.clear();

      await this.completeWorkflowIfReady(context);
    }
  }

  /**
   * Cleans up workflow resources
   * 
   * @private
   */
  private async cleanupWorkflowResources(context: WorkflowExecutionContext): Promise<void> {
    // Execute cleanup actions
    for (const action of context.plan.cleanupActions) {
      try {
        this.logger.debug('Executing cleanup action', {
          workflowId: context.plan.id,
          action
        });
        // In real implementation, would execute actual cleanup
      } catch (error) {
        this.logger.warn('Cleanup action failed', {
          workflowId: context.plan.id,
          action,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Updates workflow execution statistics
   * 
   * @private
   */
  private updateWorkflowStats(context: WorkflowExecutionContext): void {
    const stats = this.workflowStats.get(context.plan.id);
    if (!stats) return;

    const executionTime = (context.endTime || Date.now()) - context.startTime;
    stats.totalExecutionTime = executionTime;

    const completedSteps = Array.from(context.stepStates.values()).filter(s => s === 'completed').length;
    const failedSteps = Array.from(context.stepStates.values()).filter(s => s === 'failed').length;
    const skippedSteps = Array.from(context.stepStates.values()).filter(s => s === 'skipped').length;
    
    stats.stepsExecuted = completedSteps;
    stats.stepsFailed = failedSteps;
    stats.stepsSkipped = skippedSteps;
    stats.successRate = completedSteps / (completedSteps + failedSteps + skippedSteps);

    // Update global statistics
    this.globalStats.totalWorkflowsExecuted++;
    
    if (context.state === 'completed') {
      this.globalStats.successfulWorkflows++;
    } else {
      this.globalStats.failedWorkflows++;
    }

    this.globalStats.avgExecutionTime = 
      (this.globalStats.avgExecutionTime + executionTime) / this.globalStats.totalWorkflowsExecuted;
    
    this.globalStats.avgStepsPerWorkflow = 
      (this.globalStats.avgStepsPerWorkflow + context.plan.steps.length) / this.globalStats.totalWorkflowsExecuted;
  }

  /**
   * Performs topological sort on workflow steps
   * 
   * @private
   */
  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const sorted: WorkflowStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const stepMap = new Map(steps.map(step => [step.id, step]));

    const visit = (stepId: string): void => {
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving step ${stepId}`);
      }
      
      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);
      
      const step = stepMap.get(stepId);
      if (step) {
        for (const depId of step.dependencies) {
          visit(depId);
        }
        
        sorted.push(step);
        visited.add(stepId);
      }
      
      visiting.delete(stepId);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }

    return sorted;
  }

  /**
   * Initializes monitoring intervals
   * 
   * @private
   */
  private initializeMonitoring(): void {
    // Monitor active workflows
    this.monitoringInterval = setInterval(() => {
      this.monitorActiveWorkflows();
    }, this.config.monitoringInterval);

    // Detect deadlocks
    this.deadlockDetectionInterval = setInterval(() => {
      this.detectDeadlocks();
    }, this.config.deadlockDetectionTimeout);
  }

  /**
   * Monitors active workflows for health and progress
   * 
   * @private
   */
  private monitorActiveWorkflows(): void {
    for (const [workflowId, context] of this.activeWorkflows.entries()) {
      try {
        // Check for stuck workflows
        const runningTime = Date.now() - context.startTime;
        const expectedDuration = context.plan.estimatedDuration;
        
        if (expectedDuration && runningTime > expectedDuration * 2) {
          this.logger.warn('Workflow running longer than expected', {
            workflowId,
            runningTime,
            expectedDuration
          });
        }

        // Check for blocked steps
        const blockedSteps = Array.from(context.stepStates.entries())
          .filter(([_, state]) => state === 'blocked');
        
        if (blockedSteps.length > 0) {
          this.logger.debug('Workflow has blocked steps', {
            workflowId,
            blockedCount: blockedSteps.length
          });
        }

      } catch (error) {
        this.logger.error('Error monitoring workflow', {
          workflowId,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Detects deadlocks in workflow execution
   * 
   * @private
   */
  private detectDeadlocks(): void {
    for (const [workflowId, context] of this.activeWorkflows.entries()) {
      if (context.state !== 'running') continue;

      const allStepsBlocked = Array.from(context.stepStates.values())
        .every(state => ['blocked', 'completed', 'failed', 'cancelled', 'skipped'].includes(state));

      const hasRunningSteps = context.runningSteps.size > 0;

      if (allStepsBlocked && !hasRunningSteps) {
        this.logger.warn('Potential deadlock detected', { workflowId });

        this.emitWorkflowEvent({
          id: `deadlock_${workflowId}_${Date.now()}`,
          type: 'deadlock_detected',
          workflowId,
          data: { detectedAt: Date.now() },
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Emits workflow events
   * 
   * @private
   */
  private emitWorkflowEvent(event: WorkflowEvent): void {
    this.emit('workflowEvent', event);
    this.logger.debug('Workflow event emitted', {
      eventType: event.type,
      workflowId: event.workflowId,
      stepId: event.stepId
    });
  }

  /**
   * Shuts down the orchestrator and cleans up resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down WorkflowOrchestrator');

    // Clear monitoring intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.deadlockDetectionInterval) {
      clearInterval(this.deadlockDetectionInterval);
    }

    // Cancel all active workflows
    const workflowIds = Array.from(this.activeWorkflows.keys());
    for (const workflowId of workflowIds) {
      try {
        await this.cancelWorkflow(workflowId, 'Orchestrator shutdown');
      } catch (error) {
        this.logger.error('Error cancelling workflow during shutdown', {
          workflowId,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    // Clear all data structures
    this.activeWorkflows.clear();
    this.workflowStats.clear();
    this.coordinationState.clear();

    this.logger.info('WorkflowOrchestrator shutdown complete');
  }
}