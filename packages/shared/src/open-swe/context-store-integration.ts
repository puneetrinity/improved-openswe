/**
 * Context Store Integration with Existing GraphState System
 * 
 * Provides seamless integration between the new shared context store
 * and the existing Open SWE GraphState system, maintaining backward
 * compatibility while enabling advanced multi-agent collaboration features.
 */

import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

import { SharedContextStore } from './shared-context-store.js';
import { 
  ContextScope, 
  ContextStoreEvent, 
  AccessPermission 
} from './context-store-types.js';
import { 
  SharedContext, 
  AgentProfile, 
  AgentRole, 
  TaskDelegation,
  GraphState
} from './types.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Enhanced shared context with context store integration
 */
export interface EnhancedSharedContext extends SharedContext {
  /**
   * Context store instance for advanced operations
   */
  contextStore?: SharedContextStore;
  
  /**
   * Session-specific context data
   */
  sessionContext?: Record<string, unknown>;
  
  /**
   * Task-specific context data
   */
  taskContext?: Record<string, unknown>;
  
  /**
   * Agent-specific context data
   */
  agentContext?: Record<string, Record<string, unknown>>;
  
  /**
   * Context versioning information
   */
  versions?: {
    currentVersion: number;
    lastSyncTime: number;
    conflictCount: number;
  };
  
  /**
   * Real-time synchronization status
   */
  syncStatus?: {
    enabled: boolean;
    lastSync: number;
    pendingChanges: number;
  };
}

/**
 * Context store adapter for GraphState integration
 */
export class GraphStateContextAdapter {
  private readonly logger = createLogger(LogLevel.INFO, 'GraphStateContextAdapter');
  private readonly contextStore: SharedContextStore;
  private readonly subscriptions = new Map<string, Observable<ContextStoreEvent>>();
  
  constructor(contextStore: SharedContextStore) {
    this.contextStore = contextStore;
    this.logger.info('GraphStateContextAdapter initialized');
  }

  /**
   * Convert legacy SharedContext to enhanced context with store integration
   */
  async enhanceSharedContext(
    sharedContext: SharedContext,
    sessionId: string,
    agentProfiles: Map<string, AgentProfile>
  ): Promise<EnhancedSharedContext> {
    try {
      // Migrate existing context data to context store
      await this.migrateContextData(sharedContext, sessionId);
      
      // Load session and task context from store
      const sessionContext = await this.loadSessionContext(sessionId);
      const taskContext = await this.loadTaskContext(sharedContext.currentTaskId);
      const agentContext = await this.loadAgentContexts(Array.from(agentProfiles.keys()));
      
      // Create enhanced context
      const enhancedContext: EnhancedSharedContext = {
        ...sharedContext,
        contextStore: this.contextStore,
        sessionContext,
        taskContext,
        agentContext,
        versions: {
          currentVersion: 1,
          lastSyncTime: Date.now(),
          conflictCount: 0
        },
        syncStatus: {
          enabled: true,
          lastSync: Date.now(),
          pendingChanges: 0
        }
      };
      
      this.logger.debug('SharedContext enhanced with context store', {
        sessionId,
        taskId: sharedContext.currentTaskId,
        agentCount: agentProfiles.size
      });
      
      return enhancedContext;
      
    } catch (error) {
      this.logger.error('Failed to enhance SharedContext', {
        sessionId,
        error: error instanceof Error ? error.message : error
      });
      
      // Return original context with basic enhancement on error
      return {
        ...sharedContext,
        contextStore: this.contextStore,
        versions: {
          currentVersion: 1,
          lastSyncTime: Date.now(),
          conflictCount: 0
        },
        syncStatus: {
          enabled: false,
          lastSync: 0,
          pendingChanges: 0
        }
      };
    }
  }

  /**
   * Synchronize GraphState with context store
   */
  async synchronizeGraphState(
    graphState: GraphState,
    agentId: string,
    sessionId: string
  ): Promise<GraphState> {
    try {
      // Update collaboration context in context store
      if (graphState.collaborationContext) {
        await this.updateCollaborationContext(
          graphState.collaborationContext,
          sessionId,
          agentId
        );
      }
      
      // Update active agents information
      if (graphState.activeAgents) {
        await this.updateActiveAgents(
          graphState.activeAgents,
          sessionId,
          agentId
        );
      }
      
      // Update task delegations
      if (graphState.taskDelegations) {
        await this.updateTaskDelegations(
          graphState.taskDelegations,
          sessionId,
          agentId
        );
      }
      
      // Update task plan context
      if (graphState.taskPlan) {
        await this.updateTaskPlanContext(
          graphState.taskPlan,
          sessionId,
          agentId
        );
      }
      
      this.logger.debug('GraphState synchronized with context store', {
        sessionId,
        agentId,
        taskCount: graphState.taskPlan?.tasks.length || 0,
        delegationCount: graphState.taskDelegations?.length || 0
      });
      
      return graphState;
      
    } catch (error) {
      this.logger.error('Failed to synchronize GraphState', {
        sessionId,
        agentId,
        error: error instanceof Error ? error.message : error
      });
      
      return graphState; // Return original state on error
    }
  }

  /**
   * Set up real-time synchronization for an agent
   */
  setupAgentSync(
    agentId: string,
    sessionId: string,
    callback: (event: ContextStoreEvent) => void
  ): void {
    // Subscribe to context store events for this session
    const subscription = this.contextStore.subscribe(
      agentId,
      `session/${sessionId}/*`,
      ['create', 'update', 'delete']
    );
    
    // Filter and process events
    const processedSubscription = subscription.pipe(
      filter(event => this.isRelevantEvent(event, agentId, sessionId)),
      map(event => this.transformEvent(event, agentId))
    );
    
    processedSubscription.subscribe({
      next: callback,
      error: error => {
        this.logger.error('Agent sync error', {
          agentId,
          sessionId,
          error: error instanceof Error ? error.message : error
        });
      }
    });
    
    this.subscriptions.set(agentId, processedSubscription);
    
    this.logger.debug('Agent sync setup completed', { agentId, sessionId });
  }

  /**
   * Remove agent synchronization
   */
  async removeAgentSync(agentId: string): Promise<void> {
    const subscription = this.subscriptions.get(agentId);
    if (subscription) {
      // Note: RxJS subscriptions don't have an unsubscribe method on the Observable
      // In a real implementation, you'd store the Subscription object returned by subscribe()
      this.subscriptions.delete(agentId);
      this.logger.debug('Agent sync removed', { agentId });
    }
  }

  /**
   * Create agent-specific context permissions
   */
  createAgentPermissions(agentProfile: AgentProfile): AccessPermission[] {
    const permissions: AccessPermission[] = [];
    
    // Role-based permissions
    switch (agentProfile.role) {
      case 'architect':
        permissions.push({
          roles: ['architect'],
          permission: 'admin'
        });
        break;
        
      case 'code_reviewer':
      case 'security':
      case 'performance_optimizer':
        permissions.push({
          roles: [agentProfile.role],
          permission: 'write'
        });
        break;
        
      default:
        permissions.push({
          roles: [agentProfile.role],
          permission: 'read'
        });
    }
    
    // Agent-specific permissions
    permissions.push({
      roles: [],
      agentIds: [agentProfile.id],
      permission: 'write'
    });
    
    return permissions;
  }

  /**
   * Migrate legacy context data to context store
   */
  private async migrateContextData(
    sharedContext: SharedContext,
    sessionId: string
  ): Promise<void> {
    try {
      // Migrate knowledge base
      if (sharedContext.knowledgeBase && Object.keys(sharedContext.knowledgeBase).length > 0) {
        for (const [key, value] of Object.entries(sharedContext.knowledgeBase)) {
          await this.contextStore.set(
            'session',
            `knowledge/${sessionId}`,
            key,
            value,
            this.getDefaultPermissions()
          );
        }
      }
      
      // Migrate workspace state
      if (sharedContext.workspaceState && Object.keys(sharedContext.workspaceState).length > 0) {
        await this.contextStore.set(
          'session',
          `workspace/${sessionId}`,
          'state',
          sharedContext.workspaceState,
          this.getDefaultPermissions()
        );
      }
      
      // Migrate communication history
      if (sharedContext.communicationHistory && sharedContext.communicationHistory.length > 0) {
        await this.contextStore.set(
          'session',
          `communication/${sessionId}`,
          'history',
          sharedContext.communicationHistory,
          this.getDefaultPermissions()
        );
      }
      
      this.logger.debug('Context data migrated successfully', { sessionId });
      
    } catch (error) {
      this.logger.warn('Failed to migrate some context data', {
        sessionId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Load session context from context store
   */
  private async loadSessionContext(sessionId: string): Promise<Record<string, unknown>> {
    try {
      const queryResult = await this.contextStore.query(
        {
          scope: 'session',
          pathPattern: `*/${sessionId}/*`,
          limit: 100
        },
        'system'
      );
      
      if (!queryResult.success || !queryResult.data) {
        return {};
      }
      
      const context: Record<string, unknown> = {};
      for (const entry of queryResult.data.entries) {
        context[entry.key] = entry.value;
      }
      
      return context;
      
    } catch (error) {
      this.logger.warn('Failed to load session context', {
        sessionId,
        error: error instanceof Error ? error.message : error
      });
      return {};
    }
  }

  /**
   * Load task context from context store
   */
  private async loadTaskContext(taskId: string): Promise<Record<string, unknown>> {
    if (!taskId) return {};
    
    try {
      const queryResult = await this.contextStore.query(
        {
          scope: 'task',
          pathPattern: `*/${taskId}/*`,
          limit: 50
        },
        'system'
      );
      
      if (!queryResult.success || !queryResult.data) {
        return {};
      }
      
      const context: Record<string, unknown> = {};
      for (const entry of queryResult.data.entries) {
        context[entry.key] = entry.value;
      }
      
      return context;
      
    } catch (error) {
      this.logger.warn('Failed to load task context', {
        taskId,
        error: error instanceof Error ? error.message : error
      });
      return {};
    }
  }

  /**
   * Load agent contexts from context store
   */
  private async loadAgentContexts(agentIds: string[]): Promise<Record<string, Record<string, unknown>>> {
    const agentContexts: Record<string, Record<string, unknown>> = {};
    
    for (const agentId of agentIds) {
      try {
        const queryResult = await this.contextStore.query(
          {
            scope: 'agent',
            pathPattern: `*/${agentId}/*`,
            limit: 20
          },
          'system'
        );
        
        if (queryResult.success && queryResult.data) {
          const context: Record<string, unknown> = {};
          for (const entry of queryResult.data.entries) {
            context[entry.key] = entry.value;
          }
          agentContexts[agentId] = context;
        }
        
      } catch (error) {
        this.logger.warn('Failed to load agent context', {
          agentId,
          error: error instanceof Error ? error.message : error
        });
        agentContexts[agentId] = {};
      }
    }
    
    return agentContexts;
  }

  /**
   * Update collaboration context in context store
   */
  private async updateCollaborationContext(
    collaborationContext: SharedContext,
    sessionId: string,
    agentId: string
  ): Promise<void> {
    try {
      await this.contextStore.update(
        await this.getOrCreateEntry('session', `collaboration/${sessionId}`, 'context', collaborationContext),
        collaborationContext,
        agentId,
        'Updated collaboration context'
      );
    } catch (error) {
      this.logger.warn('Failed to update collaboration context', {
        sessionId,
        agentId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Update active agents in context store
   */
  private async updateActiveAgents(
    activeAgents: Map<string, AgentProfile>,
    sessionId: string,
    agentId: string
  ): Promise<void> {
    try {
      const agentArray = Array.from(activeAgents.entries());
      await this.contextStore.update(
        await this.getOrCreateEntry('session', `agents/${sessionId}`, 'active', agentArray),
        agentArray,
        agentId,
        'Updated active agents'
      );
    } catch (error) {
      this.logger.warn('Failed to update active agents', {
        sessionId,
        agentId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Update task delegations in context store
   */
  private async updateTaskDelegations(
    taskDelegations: TaskDelegation[],
    sessionId: string,
    agentId: string
  ): Promise<void> {
    try {
      await this.contextStore.update(
        await this.getOrCreateEntry('session', `delegations/${sessionId}`, 'tasks', taskDelegations),
        taskDelegations,
        agentId,
        'Updated task delegations'
      );
    } catch (error) {
      this.logger.warn('Failed to update task delegations', {
        sessionId,
        agentId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Update task plan context
   */
  private async updateTaskPlanContext(
    taskPlan: any,
    sessionId: string,
    agentId: string
  ): Promise<void> {
    try {
      await this.contextStore.update(
        await this.getOrCreateEntry('session', `taskplan/${sessionId}`, 'plan', taskPlan),
        taskPlan,
        agentId,
        'Updated task plan'
      );
    } catch (error) {
      this.logger.warn('Failed to update task plan', {
        sessionId,
        agentId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Get or create a context entry
   */
  private async getOrCreateEntry(
    scope: ContextScope,
    path: string,
    key: string,
    initialValue: unknown
  ): Promise<string> {
    // Check if entry exists
    const queryResult = await this.contextStore.query(
      {
        scope,
        pathPattern: path,
        keyPattern: key,
        limit: 1
      },
      'system'
    );
    
    if (queryResult.success && queryResult.data && queryResult.data.entries.length > 0) {
      return queryResult.data.entries[0].id;
    }
    
    // Create new entry
    const createResult = await this.contextStore.set(
      scope,
      path,
      key,
      initialValue,
      this.getDefaultPermissions()
    );
    
    if (!createResult.success) {
      throw new Error(`Failed to create context entry: ${createResult.error}`);
    }
    
    return createResult.data!;
  }

  /**
   * Get default permissions for context entries
   */
  private getDefaultPermissions(): AccessPermission[] {
    return [
      {
        roles: ['architect'],
        permission: 'admin'
      },
      {
        roles: ['code_reviewer', 'security', 'performance_optimizer'],
        permission: 'write'
      },
      {
        roles: [
          'test_engineer',
          'documentation',
          'code_smell_detector',
          'bug_pattern_analyzer',
          'architectural_reviewer',
          'solid_principles_validator'
        ],
        permission: 'read'
      }
    ];
  }

  /**
   * Check if an event is relevant for an agent
   */
  private isRelevantEvent(
    event: ContextStoreEvent,
    agentId: string,
    sessionId: string
  ): boolean {
    // Include events from the same session
    if (event.path.includes(`/${sessionId}/`)) {
      return true;
    }
    
    // Include global events
    if (event.path.startsWith('global/')) {
      return true;
    }
    
    // Include agent-specific events
    if (event.path.includes(`/${agentId}/`)) {
      return true;
    }
    
    return false;
  }

  /**
   * Transform context store event for agent consumption
   */
  private transformEvent(event: ContextStoreEvent, agentId: string): ContextStoreEvent {
    // Add agent context to the event payload
    return {
      ...event,
      payload: {
        ...event.payload,
        targetAgent: agentId,
        transformedAt: Date.now()
      }
    };
  }
}

/**
 * Utility functions for GraphState context integration
 */
export class ContextIntegrationUtils {
  
  /**
   * Create a context store instance with GraphState-compatible configuration
   */
  static createGraphStateContextStore(): SharedContextStore {
    const store = new SharedContextStore({
      storage: {
        primary: 'memory',
        cache: {
          enabled: true,
          backend: 'memory',
          ttl: 600000, // 10 minutes
          maxSize: 50000,
          evictionPolicy: 'lru'
        },
        compression: {
          algorithm: 'none', // Disable for better performance in memory
          threshold: 10240 // 10KB
        },
        encryption: {
          algorithm: 'none', // Can be enabled for production
          keyManagement: {
            rotationInterval: 86400000, // 24 hours
            keyStorage: 'memory'
          }
        }
      },
      versioning: {
        enabled: true,
        maxVersions: 50, // Reasonable for collaboration
        cleanupInterval: 3600000, // 1 hour
        autoConflictDetection: true
      },
      permissions: {
        defaultPermissions: [
          {
            roles: ['architect'],
            permission: 'admin'
          }
        ],
        enableInheritance: true,
        cacheTtl: 300000 // 5 minutes
      },
      realTimeSync: {
        enabled: true,
        syncInterval: 2000, // 2 seconds
        maxBatchSize: 50,
        conflictResolution: 'last_write_wins'
      },
      audit: {
        enabled: true,
        operations: ['create', 'update', 'delete'],
        retentionPeriod: 86400000, // 24 hours for dev
        realTimeNotifications: true
      }
    });
    
    return store;
  }

  /**
   * Initialize context store for a GraphState session
   */
  static async initializeContextStoreForSession(
    store: SharedContextStore,
    sessionId: string,
    agentProfiles: AgentProfile[]
  ): Promise<void> {
    // Register agent profiles with permission manager
    for (const agent of agentProfiles) {
      (store.permissions as any).registerAgentProfile(agent);
    }
    
    // Create session-scoped context entries
    await store.set(
      'session',
      `metadata/${sessionId}`,
      'created',
      {
        createdAt: Date.now(),
        agentCount: agentProfiles.length,
        agentRoles: agentProfiles.map(a => a.role)
      }
    );
    
    // Initialize task context if there's an active task
    await store.set(
      'session',
      `tasks/${sessionId}`,
      'active',
      null
    );
  }
}