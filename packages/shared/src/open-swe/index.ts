/**
 * Open SWE Multi-Agent System with Intelligent Task Delegation
 * 
 * This module provides a comprehensive multi-agent system for the Open SWE platform,
 * enabling sophisticated agent collaboration, capability discovery, health monitoring,
 * event-driven communication patterns, and intelligent task delegation.
 * 
 * Key Features:
 * - Agent Registry with capability discovery and health monitoring
 * - Communication Hub with reliable message routing and broadcasting
 * - Intelligent Task Delegation Engine with sophisticated routing algorithms
 * - Workflow Orchestration for complex multi-agent scenarios
 * - Load balancing and performance optimization
 * - Event-driven orchestration and coordination
 * - Production-ready monitoring and statistics
 * - Seamless LangGraph integration
 * 
 * @example
 * ```typescript
 * import { 
 *   MultiAgentSystem, 
 *   createTaskDelegationSystem,
 *   RepositoryKnowledgeGraph,
 *   MultiAgentKnowledgeGraphIntegration,
 *   AgentProfile,
 *   TaskDelegationUtils,
 *   MultiAgentUtils
 * } from '@open-swe/shared/open-swe';
 * 
 * // Create multi-agent system with task delegation
 * const system = new MultiAgentSystem({
 *   enableOrchestration: true,
 *   maxConcurrentOperations: 50
 * });
 * 
 * const delegationSystem = createTaskDelegationSystem({
 *   delegation: {
 *     enableIntelligentRouting: true,
 *     enableWorkflowOrchestration: true,
 *     defaultDelegationPattern: 'capability_matched'
 *   }
 * });
 * 
 * // Create Repository Knowledge Graph
 * const knowledgeGraph = new RepositoryKnowledgeGraph({
 *   analysis: {
 *     supportedLanguages: ['typescript', 'javascript', 'python'],
 *     enablePatternDetection: true,
 *     incremental: true
 *   },
 *   integration: {
 *     multiAgent: true,
 *     realTimeEvents: true
 *   }
 * });
 * 
 * // Initialize knowledge graph
 * await knowledgeGraph.initialize();
 * 
 * // Integrate with multi-agent system
 * const integration = new MultiAgentKnowledgeGraphIntegration();
 * await integration.registerWithMultiAgent(knowledgeGraph, system);
 * 
 * // Register agents
 * const agent: AgentProfile = {
 *   id: 'code-reviewer-1',
 *   role: 'code_reviewer',
 *   specialization: ['javascript', 'typescript'],
 *   tools: ['eslint', 'prettier'],
 *   collaborationRules: [],
 *   status: 'idle',
 *   createdAt: Date.now(),
 *   lastActiveAt: Date.now()
 * };
 * 
 * await system.registerAgent(agent);
 * await delegationSystem.agentRegistry.registerAgent(agent);
 * 
 * // Analyze repository
 * const analysisResult = await knowledgeGraph.analyzeRepository('./src', {
 *   languages: ['typescript', 'javascript'],
 *   includeTests: true
 * });
 * 
 * // Query knowledge graph
 * const query = MultiAgentUtils.createKnowledgeQuery('find function with high complexity', {
 *   entityTypes: ['function', 'method'],
 *   limit: 5
 * });
 * 
 * const searchResult = await knowledgeGraph.semanticSearch(query);
 * console.log('Found entities:', searchResult.data?.entities.length);
 * 
 * // Delegate a task with knowledge graph context
 * const taskRequest = TaskDelegationUtils.createSimpleRequest(
 *   'review-code-123',
 *   'Review TypeScript code for best practices',
 *   ['typescript', 'code_review'],
 *   'manager-agent'
 * );
 * 
 * const delegationResult = await delegationSystem.delegationEngine.delegateTask(taskRequest);
 * console.log('Task delegated:', delegationResult.success);
 * ```
 */

// Core system exports
export { MultiAgentSystem } from './multi-agent-system.js';
export { AgentRegistry } from './agent-registry-impl.js';
export { AgentCommunicationHub } from './agent-communication-hub.js';

// Task Delegation System exports
export {
  TaskDelegationEngine,
  CapabilityMatcher,
  TaskRouter,
  WorkflowOrchestrator,
  TaskDelegationIntegration,
  createTaskDelegationSystem,
  TaskDelegationUtils,
  DEFAULT_TASK_DELEGATION_CONFIG,
  TASK_DELEGATION_VERSION
} from './task-delegation-system.js';

// Shared Context Store exports
export { SharedContextStore } from './shared-context-store.js';
export { InMemoryStorageBackend } from './storage-backends.js';
export { PermissionManager } from './permission-manager.js';
export { VersionManager } from './version-manager.js';
export { 
  GraphStateContextAdapter,
  ContextIntegrationUtils
} from './context-store-integration.js';

// Type exports for agent registry and communication
export type {
  AgentStatus,
  AgentEvent,
  AgentEventType,
  AgentHealthCheck,
  AgentLoadInfo,
  CapabilityQuery,
  AgentDiscoveryResult,
  AgentRegistryConfig,
  CommunicationHubConfig,
  RegistryOperationResult,
  RegistryStatistics,
  RuntimeAgentProfile,
  ExtendedAgentRegistryEntry,
  AgentCapability,
  PerformanceThresholds,
  MessageEnvelope,
  MessageDeliveryStatus,
  BroadcastSubscription
} from './agent-registry.js';

// Task Delegation type exports
export type {
  TaskDelegationRequest,
  TaskDelegationResult,
  TaskRoutingDecision,
  AgentAssignment,
  TaskRisk,
  CapabilityScore,
  WorkflowPlan,
  WorkflowStep,
  WorkflowCondition,
  ErrorHandlingStrategy,
  RetryConfig,
  TaskDelegationConfig,
  LoadBalancingConfig,
  PerformanceMonitoringConfig,
  AuctionConfig,
  NotificationConfig,
  TaskComplexity,
  TaskPriority,
  TaskStatus,
  DelegationPattern,
  ExecutionPattern,
  TaskDelegationStatistics,
  ConflictResolutionContext,
  AgentBid
} from './task-delegation-system.js';

// Context Store type exports
export type {
  // Core types
  ContextEntry,
  ContextQuery,
  ContextQueryResult,
  ContextScope,
  ContextDataType,
  ContextOperation,
  ContextStoreEvent,
  ContextStoreConfiguration,
  ContextStoreStatistics,
  ContextStoreHealth,
  // Permission types
  AccessPermission,
  AccessCondition,
  Permission,
  // Versioning types
  ContextVersion,
  ContextChange,
  ConflictResolutionStrategy,
  ContextConflict,
  // Storage types
  StorageBackend,
  CompressionType,
  EncryptionType,
  // Metadata types
  ContextMetadata,
  ContextLock,
  ContextAuditEntry
} from './context-store-types.js';

// Context Store interface exports
export type {
  // Core interfaces
  ISharedContextStore,
  IContextStorageBackend,
  IPermissionManager,
  IVersionManager,
  IConflictResolver,
  ILockManager,
  IAuditLogger,
  IEventManager,
  ICacheManager,
  IIndexManager,
  // Operation result
  ContextStoreOperationResult,
  // Enhanced context
  EnhancedSharedContext
} from './context-store-interfaces.js';

// Multi-agent system specific types
export type {
  MultiAgentSystemConfig,
  MultiAgentSystemStats,
  OrchestrationRule
} from './multi-agent-system.js';

// Repository Knowledge Graph exports
export {
  RepositoryKnowledgeGraph,
  SemanticCodeParser,
  RelationshipMapper,
  KnowledgeGraphStorage,
  MultiAgentKnowledgeGraphIntegration,
  createRepositoryKnowledgeGraph,
  DEFAULT_REPOSITORY_KNOWLEDGE_GRAPH_CONFIG
} from './repository-knowledge-graph-index.js';

// Repository Knowledge Graph type exports
export type {
  CodeEntity,
  Relationship,
  KnowledgeGraphQuery,
  KnowledgeGraphSearchResult,
  RepositoryKnowledgeGraphConfig,
  KnowledgeGraphStatistics,
  KnowledgeGraphHealth,
  KnowledgeGraphEvent,
  CodeEntityType,
  RelationshipType,
  SupportedLanguage,
  IRepositoryKnowledgeGraph,
  ISemanticCodeParser,
  IRelationshipMapper,
  IKnowledgeGraphStorage,
  IMultiAgentKnowledgeGraphIntegration,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-index.js';

// Re-export existing types from the main types file for convenience
export type {
  AgentProfile,
  AgentRole,
  AgentMessage,
  AgentMetrics,
  TaskDelegation,
  CollaborationRule,
  ReviewThresholds,
  SharedContext,
  MultiAgentState,
  MultiAgentGraphUpdate,
  // Core Open SWE types
  GraphState,
  GraphConfig,
  Task,
  TaskPlan,
  PlanItem,
  PlanRevision,
  TargetRepository,
  CustomRules,
  ModelTokenData,
  CacheMetrics
} from './types.js';

/**
 * Utility functions for common multi-agent operations
 */
export const MultiAgentUtils = {
  /**
   * Creates a default agent profile with reasonable defaults
   * 
   * @param id - Agent identifier
   * @param role - Agent role
   * @param specialization - Areas of specialization
   * @param tools - Available tools
   * @returns Complete agent profile
   */
  createDefaultAgentProfile(
    id: string,
    role: import('./types.js').AgentRole,
    specialization: string[] = [],
    tools: string[] = []
  ): import('./types.js').AgentProfile {
    return {
      id,
      role,
      specialization,
      tools,
      collaborationRules: [],
      status: 'idle',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
  },

  /**
   * Creates a basic capability query for agent discovery
   * 
   * @param required - Required capabilities
   * @param role - Optional role filter
   * @param optional - Optional capabilities
   * @returns Capability query object
   */
  createCapabilityQuery(
    required: string[],
    role?: import('./types.js').AgentRole,
    optional?: string[]
  ): CapabilityQuery {
    return {
      required,
      role,
      optional
    };
  },

  /**
   * Creates a standard agent message
   * 
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param content - Message content
   * @param type - Message type
   * @param priority - Message priority
   * @param data - Optional additional data
   * @returns Complete agent message
   */
  createAgentMessage(
    from: string,
    to: string,
    content: string,
    type: 'request' | 'response' | 'notification' | 'collaboration' = 'request',
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    data?: Record<string, unknown>
  ): import('./types.js').AgentMessage {
    return {
      id: `msg_${from}_${to}_${Date.now()}`,
      fromAgentId: from,
      toAgentId: to,
      type,
      content,
      data,
      timestamp: Date.now(),
      priority
    };
  },

  /**
   * Creates a task delegation object
   * 
   * @param taskId - Task identifier
   * @param delegatingAgent - Agent delegating the task
   * @param assignedAgent - Agent receiving the task
   * @param description - Task description
   * @returns Complete task delegation
   */
  createTaskDelegation(
    taskId: string,
    delegatingAgent: string,
    assignedAgent: string,
    description: string
  ): import('./types.js').TaskDelegation {
    return {
      id: `delegation_${taskId}_${Date.now()}`,
      taskId,
      delegatingAgentId: delegatingAgent,
      assignedAgentId: assignedAgent,
      status: 'pending',
      description,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  },

  /**
   * Creates a basic orchestration rule
   * 
   * @param id - Rule identifier
   * @param name - Rule name
   * @param eventTypes - Event types that trigger this rule
   * @param actions - Actions to take when triggered
   * @param priority - Rule priority
   * @returns Complete orchestration rule
   */
  createOrchestrationRule(
    id: string,
    name: string,
    eventTypes: AgentEventType[],
    actions: {
      notifyAgents?: string[];
      broadcastToRoles?: import('./types.js').AgentRole[];
      handler?: (event: AgentEvent, system: MultiAgentSystem) => Promise<void>;
    },
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): OrchestrationRule {
    return {
      id,
      name,
      triggers: { eventTypes },
      actions,
      priority,
      active: true
    };
  },

  /**
   * Creates a knowledge graph query for semantic search
   * 
   * @param query - Text query or structured query parameters
   * @param options - Additional query options
   * @returns Complete knowledge graph query
   */
  createKnowledgeQuery(
    query: string | Partial<KnowledgeGraphQuery>,
    options: {
      entityTypes?: CodeEntityType[];
      languages?: SupportedLanguage[];
      limit?: number;
      includeRelationships?: boolean;
    } = {}
  ): KnowledgeGraphQuery {
    const baseQuery: KnowledgeGraphQuery = typeof query === 'string' 
      ? { query } 
      : query;

    return {
      ...baseQuery,
      entityTypes: options.entityTypes,
      languages: options.languages,
      limit: options.limit || 10,
      includeRelationships: options.includeRelationships || false
    };
  },

  /**
   * Creates a default repository knowledge graph configuration
   * 
   * @param overrides - Configuration overrides
   * @returns Complete knowledge graph configuration
   */
  createKnowledgeGraphConfig(
    overrides: Partial<RepositoryKnowledgeGraphConfig> = {}
  ): RepositoryKnowledgeGraphConfig {
    return {
      ...DEFAULT_REPOSITORY_KNOWLEDGE_GRAPH_CONFIG,
      ...overrides
    };
  }
};

/**
 * Default configuration presets for common use cases
 */
export const MultiAgentPresets = {
  /**
   * Development configuration with relaxed limits and verbose logging
   */
  development: {
    registry: {
      maxAgents: 50,
      healthCheck: {
        interval: 30000,
        timeout: 5000,
        failureThreshold: 3
      },
      performance: {
        maxResponseTime: 10000,
        minSuccessRate: 0.8,
        maxLoad: 0.9,
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
      messageRetentionTime: 3600000 // 1 hour
    },
    enableOrchestration: true,
    maxConcurrentOperations: 100,
    enableDetailedLogging: true
  } as MultiAgentSystemConfig,

  /**
   * Production configuration with strict limits and optimized performance
   */
  production: {
    registry: {
      maxAgents: 200,
      healthCheck: {
        interval: 15000,
        timeout: 3000,
        failureThreshold: 2
      },
      performance: {
        maxResponseTime: 5000,
        minSuccessRate: 0.95,
        maxLoad: 0.8,
        healthCheckInterval: 15000
      },
      autoCleanup: true,
      offlineTimeout: 180000
    },
    communication: {
      maxQueueSize: 500,
      messageTimeout: 10000,
      maxRetryAttempts: 2,
      enablePersistence: false, // Disable for performance
      messageRetentionTime: 1800000 // 30 minutes
    },
    enableOrchestration: true,
    maxConcurrentOperations: 200,
    enableDetailedLogging: false
  } as MultiAgentSystemConfig,

  /**
   * Testing configuration with minimal overhead and fast execution
   */
  testing: {
    registry: {
      maxAgents: 10,
      healthCheck: {
        interval: 5000,
        timeout: 1000,
        failureThreshold: 1
      },
      performance: {
        maxResponseTime: 2000,
        minSuccessRate: 0.9,
        maxLoad: 0.7,
        healthCheckInterval: 5000
      },
      autoCleanup: false, // Manual cleanup in tests
      offlineTimeout: 60000
    },
    communication: {
      maxQueueSize: 50,
      messageTimeout: 5000,
      maxRetryAttempts: 1,
      enablePersistence: false,
      messageRetentionTime: 60000 // 1 minute
    },
    enableOrchestration: false, // Disable for predictable testing
    maxConcurrentOperations: 20,
    enableDetailedLogging: false
  } as MultiAgentSystemConfig
};

/**
 * Version information for the multi-agent system
 */
export const VERSION = '1.0.0';

// ============================================================================
// HISTORICAL CONTEXT SYSTEM EXPORTS
// ============================================================================

// Export historical context system
export * from './historical-context-types.js';
export * from './historical-context-system.js';
export * from './historical-context-integration.js';

// ============================================================================
// PRINCIPAL ENGINEER CODE REVIEW SYSTEM EXPORTS
// ============================================================================

// Export Principal Engineer Code Review System - Crown Jewel
export * from './principal-engineer-review-types.js';
export * from './principal-engineer-review-agents.js';
export * from './principal-engineer-review-orchestrator.js';
export * from './principal-engineer-pattern-recognition.js';
export * from './principal-engineer-review-integration.js';
export * from './principal-engineer-review-system.js';

// ============================================================================
// COMPLETE SYSTEM INTEGRATION
// ============================================================================

// Export complete integrated system
export * from './multi-agent-system-integration.js';

/**
 * Feature flags for enabling/disabling specific functionality
 */
export const FeatureFlags = {
  ENABLE_ADVANCED_ORCHESTRATION: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_MESSAGE_PERSISTENCE: true,
  ENABLE_LOAD_BALANCING: true,
  ENABLE_HEALTH_MONITORING: true,
  ENABLE_EVENT_STREAMING: true,
  ENABLE_TASK_DELEGATION: true,
  ENABLE_WORKFLOW_ORCHESTRATION: true,
  ENABLE_INTELLIGENT_ROUTING: true,
  ENABLE_AUTO_PROVISIONING: true,
  ENABLE_AUCTION_BASED_DELEGATION: true,
  ENABLE_CONSENSUS_BASED_DELEGATION: true,
  // Repository Knowledge Graph features
  ENABLE_REPOSITORY_KNOWLEDGE_GRAPH: true,
  ENABLE_SEMANTIC_CODE_ANALYSIS: true,
  ENABLE_RELATIONSHIP_MAPPING: true,
  ENABLE_SEMANTIC_EMBEDDINGS: false, // Disabled until embedding service available
  ENABLE_PATTERN_DETECTION: true,
  ENABLE_CODE_RECOMMENDATIONS: true,
  ENABLE_INCREMENTAL_ANALYSIS: true,
  ENABLE_KNOWLEDGE_GRAPH_CACHING: true,
  ENABLE_MULTI_LANGUAGE_SUPPORT: true,
  // Principal Engineer Review System features
  ENABLE_PRINCIPAL_ENGINEER_REVIEWS: true,
  ENABLE_SPECIALIZED_REVIEW_AGENTS: true,
  ENABLE_PATTERN_RECOGNITION: true,
  ENABLE_BUG_PATTERN_ANALYSIS: true,
  ENABLE_SECURITY_SCANNING: true,
  ENABLE_PERFORMANCE_OPTIMIZATION: true,
  ENABLE_ARCHITECTURAL_REVIEW: true,
  ENABLE_CODE_SMELL_DETECTION: true,
  ENABLE_SOLID_PRINCIPLES_VALIDATION: true,
  ENABLE_DESIGN_PATTERN_RECOGNITION: true,
  ENABLE_ANTI_PATTERN_DETECTION: true,
  ENABLE_HISTORICAL_LEARNING: true,
  ENABLE_PARALLEL_AGENT_EXECUTION: true
} as const;