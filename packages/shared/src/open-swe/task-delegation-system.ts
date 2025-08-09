/**
 * Task Delegation System - Main Export Module
 * 
 * Comprehensive task delegation system with intelligent routing,
 * agent matching, workflow orchestration, and Open SWE integration.
 */

// Core Components
export { TaskDelegationEngine } from './task-delegation-engine.js';
export { CapabilityMatcher } from './capability-matcher.js';
export { TaskRouter } from './task-router.js';
export { WorkflowOrchestrator } from './workflow-orchestrator.js';
export { TaskDelegationIntegration } from './task-delegation-integration.js';

// Types and Interfaces
export type {
  // Core types
  TaskDelegationRequest,
  TaskDelegationResult,
  TaskRoutingDecision,
  AgentAssignment,
  TaskRisk,
  CapabilityScore,

  // Workflow types
  WorkflowPlan,
  WorkflowStep,
  WorkflowCondition,
  ErrorHandlingStrategy,
  RetryConfig,

  // Configuration types
  TaskDelegationConfig,
  LoadBalancingConfig,
  PerformanceMonitoringConfig,
  AuctionConfig,
  NotificationConfig,

  // Enums
  TaskComplexity,
  TaskPriority,
  TaskStatus,
  DelegationPattern,
  ExecutionPattern,

  // Statistics and monitoring
  TaskDelegationStatistics,
  ConflictResolutionContext,
  AgentBid
} from './task-delegation-types.js';

// Re-export existing types that are used
export type {
  AgentProfile,
  AgentRole,
  AgentMessage,
  TaskDelegation,
  Task,
  GraphState,
  GraphUpdate
} from './types.js';

// Re-export registry and communication components
export { AgentRegistry } from './agent-registry-impl.js';
export { AgentCommunicationHub } from './agent-communication-hub.js';
export type {
  AgentStatus,
  AgentEvent,
  AgentEventType,
  AgentHealthCheck,
  AgentLoadInfo,
  RuntimeAgentProfile,
  AgentRegistryConfig,
  CommunicationHubConfig
} from './agent-registry.js';

/**
 * Factory function to create a complete task delegation system
 */
export function createTaskDelegationSystem(config?: {
  registry?: Partial<import('./agent-registry.js').AgentRegistryConfig>;
  communication?: Partial<import('./agent-registry.js').CommunicationHubConfig>;
  delegation?: Partial<import('./task-delegation-types.js').TaskDelegationConfig>;
  integration?: Partial<{
    enableTaskDelegation: boolean;
    enableWorkflowOrchestration: boolean;
    autoDelegationComplexityThreshold: import('./task-delegation-types.js').TaskComplexity;
    defaultDelegationPattern: import('./task-delegation-types.js').DelegationPattern;
    enableMultiAgentCollaboration: boolean;
    maxAgentsPerTask: number;
    defaultTaskTimeout: number;
    enableAutoProvisioning: boolean;
  }>;
}) {
  // Create core components
  const agentRegistry = new AgentRegistry(config?.registry);
  const communicationHub = new AgentCommunicationHub(config?.communication);
  const delegationEngine = new TaskDelegationEngine(
    agentRegistry,
    communicationHub,
    config?.delegation
  );
  const integrationLayer = new TaskDelegationIntegration(
    agentRegistry,
    communicationHub,
    config?.integration
  );

  return {
    agentRegistry,
    communicationHub,
    delegationEngine,
    integrationLayer,
    
    // Convenience methods
    async delegateTask(task: import('./types.js').Task, requestedBy: string) {
      return integrationLayer.delegateTask(task, requestedBy);
    },

    async executeWorkflow(tasks: import('./types.js').Task[], requestedBy: string) {
      return integrationLayer.executeTaskPlanAsWorkflow(tasks, requestedBy);
    },

    async integrateWithGraphState(
      state: import('./types.js').GraphState, 
      update: import('./types.js').GraphUpdate
    ) {
      return integrationLayer.integrateWithGraphState(state, update);
    },

    getStatistics() {
      return {
        delegation: delegationEngine.getStatistics(),
        integration: integrationLayer.getIntegrationStatistics(),
        registry: agentRegistry.getRegistryStatistics(),
        communication: communicationHub.getStatistics()
      };
    },

    async shutdown() {
      await Promise.all([
        delegationEngine.shutdown(),
        integrationLayer.shutdown(),
        agentRegistry.shutdown(),
        communicationHub.shutdown()
      ]);
    }
  };
}

/**
 * Default configuration for the task delegation system
 */
export const DEFAULT_TASK_DELEGATION_CONFIG = {
  registry: {
    maxAgents: 50,
    healthCheck: {
      interval: 30000,
      timeout: 5000,
      failureThreshold: 3
    },
    performance: {
      maxResponseTime: 5000,
      minSuccessRate: 0.95,
      maxLoad: 0.8,
      healthCheckInterval: 30000
    },
    autoCleanup: true,
    offlineTimeout: 300000
  },
  communication: {
    maxQueueSize: 1000,
    messageTimeout: 30000,
    maxRetryAttempts: 3,
    enablePersistence: true,
    messageRetentionTime: 86400000
  },
  delegation: {
    maxConcurrentTasksPerAgent: 5,
    defaultTaskTimeout: 300000,
    enableIntelligentRouting: true,
    enableWorkflowOrchestration: true,
    defaultDelegationPattern: 'capability_matched' as import('./task-delegation-types.js').DelegationPattern,
    conflictResolution: 'capability_based' as const,
    loadBalancing: {
      algorithm: 'capability_based' as const,
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
      historyRetention: 86400000,
      enableAdaptiveOptimization: true,
      anomalyThresholds: {
        responseTime: 5000,
        successRate: 0.9,
        loadSpike: 0.8
      },
      optimizationTriggers: {
        failedDelegationRate: 0.1,
        avgResponseTime: 3000,
        overloadFrequency: 0.3
      }
    }
  },
  integration: {
    enableTaskDelegation: true,
    enableWorkflowOrchestration: true,
    autoDelegationComplexityThreshold: 'moderate' as import('./task-delegation-types.js').TaskComplexity,
    defaultDelegationPattern: 'capability_matched' as import('./task-delegation-types.js').DelegationPattern,
    enableMultiAgentCollaboration: true,
    maxAgentsPerTask: 3,
    defaultTaskTimeout: 300000,
    enableAutoProvisioning: true
  }
} as const;

/**
 * Utility functions for task delegation
 */
export const TaskDelegationUtils = {
  /**
   * Creates a simple task delegation request
   */
  createSimpleRequest(
    taskId: string,
    description: string,
    capabilities: string[],
    requestedBy: string,
    options?: {
      complexity?: import('./task-delegation-types.js').TaskComplexity;
      priority?: import('./task-delegation-types.js').TaskPriority;
      maxAgents?: number;
      timeout?: number;
    }
  ): import('./task-delegation-types.js').TaskDelegationRequest {
    return {
      taskId,
      description,
      complexity: options?.complexity || 'moderate',
      priority: options?.priority || 'normal',
      requiredCapabilities: capabilities,
      maxAgents: options?.maxAgents || 1,
      expectedDuration: options?.timeout || 300000,
      requestedBy,
      createdAt: Date.now()
    };
  },

  /**
   * Creates a workflow plan from multiple tasks
   */
  createSimpleWorkflow(
    workflowId: string,
    tasks: Array<{
      id: string;
      name: string;
      description: string;
      capabilities: string[];
      dependencies?: string[];
    }>,
    requestedBy: string
  ): import('./task-delegation-types.js').WorkflowPlan {
    const steps: import('./task-delegation-types.js').WorkflowStep[] = tasks.map(task => ({
      id: task.id,
      name: task.name,
      task: TaskDelegationUtils.createSimpleRequest(
        task.id,
        task.description,
        task.capabilities,
        requestedBy
      ),
      dependencies: task.dependencies || [],
      executionPattern: 'sequential',
      preconditions: [],
      postconditions: [],
      errorHandling: {
        strategy: 'retry',
        maxAttempts: 3
      },
      retryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        backoffStrategy: 'exponential',
        maxDelay: 30000,
        retryOnDifferentAgent: true
      },
      timeout: 300000
    }));

    return {
      id: workflowId,
      name: `Workflow: ${workflowId}`,
      steps,
      executionPattern: 'sequential',
      estimatedDuration: steps.length * 300000,
      requiredAgents: [],
      globalErrorHandling: {
        strategy: 'escalate',
        maxAttempts: 1,
        escalationAgent: requestedBy
      },
      successCriteria: [],
      cleanupActions: [],
      createdAt: Date.now(),
      createdBy: requestedBy
    };
  },

  /**
   * Complexity level utilities
   */
  getComplexityLevel(complexity: import('./task-delegation-types.js').TaskComplexity): number {
    switch (complexity) {
      case 'trivial': return 1;
      case 'simple': return 2;
      case 'moderate': return 3;
      case 'complex': return 4;
      case 'critical': return 5;
      default: return 3;
    }
  },

  /**
   * Priority level utilities
   */
  getPriorityLevel(priority: import('./task-delegation-types.js').TaskPriority): number {
    switch (priority) {
      case 'low': return 1;
      case 'normal': return 2;
      case 'high': return 3;
      case 'urgent': return 4;
      case 'critical': return 5;
      default: return 2;
    }
  }
};

/**
 * Task delegation system version
 */
export const TASK_DELEGATION_VERSION = '1.0.0';

/**
 * Export everything from the task delegation system
 */
export * from './task-delegation-types.js';
export * from './capability-matcher.js';
export * from './task-router.js';
export * from './workflow-orchestrator.js';
export * from './task-delegation-engine.js';
export * from './task-delegation-integration.js';