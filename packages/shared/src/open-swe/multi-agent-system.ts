import { Observable, Subject, merge, combineLatest } from 'rxjs';
import { map, filter, debounceTime } from 'rxjs/operators';
import { 
  AgentProfile, 
  AgentRole, 
  AgentMessage,
  AgentMetrics,
  TaskDelegation
} from './types.js';
import {
  AgentRegistry,
  AgentCommunicationHub,
  AgentStatus,
  AgentEvent,
  AgentEventType,
  CapabilityQuery,
  AgentDiscoveryResult,
  AgentRegistryConfig,
  CommunicationHubConfig,
  RegistryOperationResult,
  RuntimeAgentProfile,
  AgentCapability
} from './agent-registry.js';
import { AgentRegistry as AgentRegistryImpl } from './agent-registry-impl.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Configuration for the multi-agent system
 */
export interface MultiAgentSystemConfig {
  /**
   * Agent registry configuration
   */
  registry?: Partial<AgentRegistryConfig>;
  
  /**
   * Communication hub configuration
   */
  communication?: Partial<CommunicationHubConfig>;
  
  /**
   * Enable automatic agent orchestration
   */
  enableOrchestration?: boolean;
  
  /**
   * Maximum system-wide concurrent operations
   */
  maxConcurrentOperations?: number;
  
  /**
   * Enable comprehensive logging
   */
  enableDetailedLogging?: boolean;
}

/**
 * System-wide statistics for the multi-agent system
 */
export interface MultiAgentSystemStats {
  /**
   * Registry statistics
   */
  registry: {
    totalAgents: number;
    agentsByStatus: Record<AgentStatus, number>;
    agentsByRole: Record<AgentRole, number>;
    avgResponseTime: number;
  };
  
  /**
   * Communication statistics
   */
  communication: {
    totalMessagesProcessed: number;
    totalBroadcasts: number;
    activeSubscriptions: number;
    failedDeliveries: number;
    avgDeliveryTime: number;
  };
  
  /**
   * System performance metrics
   */
  performance: {
    systemUptime: number;
    memoryUsage: number;
    cpuLoad: number;
    operationsPerSecond: number;
  };
  
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Orchestration rule for automatic agent coordination
 */
export interface OrchestrationRule {
  /**
   * Rule identifier
   */
  id: string;
  
  /**
   * Rule name
   */
  name: string;
  
  /**
   * Trigger conditions
   */
  triggers: {
    /**
     * Event types that trigger this rule
     */
    eventTypes: AgentEventType[];
    
    /**
     * Agent roles involved
     */
    agentRoles?: AgentRole[];
    
    /**
     * Custom trigger condition
     */
    condition?: (event: AgentEvent) => boolean;
  };
  
  /**
   * Actions to take when rule is triggered
   */
  actions: {
    /**
     * Agents to notify
     */
    notifyAgents?: string[];
    
    /**
     * Roles to broadcast to
     */
    broadcastToRoles?: AgentRole[];
    
    /**
     * Custom action handler
     */
    handler?: (event: AgentEvent, system: MultiAgentSystem) => Promise<void>;
  };
  
  /**
   * Rule priority for conflict resolution
   */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Whether the rule is active
   */
  active: boolean;
}

/**
 * Comprehensive Multi-Agent System that orchestrates agent registration,
 * communication, and collaboration in the Open SWE environment.
 * 
 * This system provides a unified interface for managing multiple agents,
 * their capabilities, health monitoring, message routing, and automated
 * coordination patterns.
 */
export class MultiAgentSystem {
  private readonly logger = createLogger(LogLevel.INFO, 'MultiAgentSystem');
  
  /**
   * Agent registry for capability discovery and lifecycle management
   */
  public readonly registry: AgentRegistryImpl;
  
  /**
   * Communication hub for message routing and event management
   */
  public readonly communicationHub: AgentCommunicationHub;
  
  /**
   * System configuration
   */
  private readonly config: MultiAgentSystemConfig;
  
  /**
   * Orchestration rules for automatic coordination
   */
  private readonly orchestrationRules = new Map<string, OrchestrationRule>();
  
  /**
   * System event stream
   */
  private readonly systemEventStream = new Subject<AgentEvent>();
  
  /**
   * Performance monitoring
   */
  private readonly performanceMonitor = {
    operationsPerSecond: 0,
    operationCount: 0,
    lastReset: Date.now()
  };
  
  /**
   * System start time
   */
  private readonly startTime = Date.now();
  
  /**
   * Active operation tracking
   */
  private activeOperations = 0;

  /**
   * Creates a new MultiAgentSystem instance
   * 
   * @param config - System configuration options
   */
  constructor(config?: MultiAgentSystemConfig) {
    this.config = {
      enableOrchestration: true,
      maxConcurrentOperations: 100,
      enableDetailedLogging: true,
      ...config
    };

    // Initialize registry and communication hub
    this.registry = new AgentRegistryImpl(this.config.registry);
    this.communicationHub = new AgentCommunicationHub(this.config.communication);

    this.initializeSystemIntegration();
    this.initializeDefaultOrchestrationRules();
    
    this.logger.info('MultiAgentSystem initialized', { 
      config: this.config,
      enableOrchestration: this.config.enableOrchestration
    });
  }

  /**
   * Registers a new agent with automatic capability discovery and monitoring setup
   * 
   * @param profile - Agent profile with capabilities
   * @param capabilities - Optional detailed capability information
   * @param metadata - Optional registration metadata
   * @returns Promise resolving to registration result
   */
  async registerAgent(
    profile: AgentProfile,
    capabilities?: AgentCapability[],
    metadata?: Record<string, unknown>
  ): Promise<RegistryOperationResult> {
    if (this.activeOperations >= this.config.maxConcurrentOperations!) {
      return {
        success: false,
        error: 'System at maximum concurrent operations capacity',
        executionTime: 0
      };
    }

    this.activeOperations++;
    this.performanceMonitor.operationCount++;

    try {
      const result = await this.registry.registerAgent(profile, capabilities, metadata);
      
      if (result.success) {
        // Set up communication subscriptions for the new agent
        await this.setupAgentCommunication(profile.id);
        
        this.logger.info('Agent registered and communication setup completed', {
          agentId: profile.id,
          role: profile.role
        });
      }

      return result;
      
    } finally {
      this.activeOperations--;
    }
  }

  /**
   * Discovers agents with enhanced scoring and automatic load balancing
   * 
   * @param query - Capability query with requirements
   * @param loadBalance - Whether to apply load balancing to results
   * @returns Promise resolving to discovery results
   */
  async discoverAgents(
    query: CapabilityQuery,
    loadBalance: boolean = true
  ): Promise<AgentDiscoveryResult> {
    this.performanceMonitor.operationCount++;

    const result = await this.registry.discoverAgents(query);

    if (loadBalance && result.agents.length > 1) {
      // Sort by load and availability for better distribution
      result.agents.sort((a, b) => {
        const loadInfoA = result.loadInfo.get(a.id);
        const loadInfoB = result.loadInfo.get(b.id);
        
        if (!loadInfoA && !loadInfoB) return 0;
        if (!loadInfoA) return 1;
        if (!loadInfoB) return -1;
        
        // Prioritize agents with lower load and higher availability
        const scoreA = loadInfoA.availabilityScore - (loadInfoA.currentLoad / 100);
        const scoreB = loadInfoB.availabilityScore - (loadInfoB.currentLoad / 100);
        
        return scoreB - scoreA;
      });
    }

    return result;
  }

  /**
   * Sends a message between agents with enhanced routing and delivery guarantees
   * 
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param message - Message to send
   * @returns Promise resolving to delivery result
   */
  async sendMessage(from: string, to: string, message: AgentMessage): Promise<RegistryOperationResult> {
    this.performanceMonitor.operationCount++;

    // Validate agents exist
    const senderStatus = this.registry.getAgentStatus(from);
    const recipientStatus = this.registry.getAgentStatus(to);

    if (!senderStatus) {
      return {
        success: false,
        error: `Sender agent ${from} not found`,
        executionTime: 0
      };
    }

    if (!recipientStatus) {
      return {
        success: false,
        error: `Recipient agent ${to} not found`,
        executionTime: 0
      };
    }

    return await this.communicationHub.sendMessage(from, to, message);
  }

  /**
   * Broadcasts a message to all agents with a specific role
   * 
   * @param senderAgentId - Sender agent ID
   * @param role - Target agent role
   * @param message - Message to broadcast
   * @param excludeSender - Whether to exclude sender from broadcast
   * @returns Promise resolving to broadcast result
   */
  async broadcastToRole(
    senderAgentId: string,
    role: AgentRole,
    message: AgentMessage,
    excludeSender: boolean = true
  ): Promise<RegistryOperationResult> {
    this.performanceMonitor.operationCount++;

    return await this.communicationHub.broadcastToRole(senderAgentId, role, message, excludeSender);
  }

  /**
   * Creates a task delegation between agents with automatic routing
   * 
   * @param delegation - Task delegation information
   * @returns Promise resolving to delegation result
   */
  async delegateTask(delegation: TaskDelegation): Promise<RegistryOperationResult> {
    this.performanceMonitor.operationCount++;

    try {
      // Find the best agent for the task if not specified
      if (!delegation.assignedAgentId) {
        // This would typically involve more sophisticated task-capability matching
        const query: CapabilityQuery = {
          required: ['task_execution'], // Basic requirement
          role: 'code_reviewer' // Default role, could be inferred from task
        };

        const discovery = await this.discoverAgents(query);
        if (discovery.agents.length === 0) {
          return {
            success: false,
            error: 'No suitable agents found for task delegation',
            executionTime: 0
          };
        }

        delegation.assignedAgentId = discovery.agents[0].id;
      }

      // Create delegation message
      const delegationMessage: AgentMessage = {
        id: `delegation_${delegation.id}`,
        fromAgentId: delegation.delegatingAgentId,
        toAgentId: delegation.assignedAgentId,
        type: 'collaboration',
        content: `Task delegation: ${delegation.description}`,
        data: { delegation },
        timestamp: Date.now(),
        priority: 'high'
      };

      // Send delegation message
      const messageResult = await this.sendMessage(
        delegation.delegatingAgentId,
        delegation.assignedAgentId,
        delegationMessage
      );

      if (messageResult.success) {
        // Emit task delegation event
        this.emitSystemEvent({
          id: `task_delegated_${delegation.id}`,
          type: 'task_delegated',
          agentId: delegation.assignedAgentId,
          payload: { delegation },
          timestamp: Date.now(),
          priority: 'medium'
        });
      }

      return messageResult;

    } catch (error) {
      this.logger.error('Task delegation failed', {
        delegationId: delegation.id,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  }

  /**
   * Adds an orchestration rule for automatic agent coordination
   * 
   * @param rule - Orchestration rule definition
   * @returns Operation result
   */
  addOrchestrationRule(rule: OrchestrationRule): RegistryOperationResult {
    try {
      if (this.orchestrationRules.has(rule.id)) {
        return {
          success: false,
          error: `Orchestration rule ${rule.id} already exists`,
          executionTime: 0
        };
      }

      this.orchestrationRules.set(rule.id, rule);

      this.logger.info('Orchestration rule added', {
        ruleId: rule.id,
        name: rule.name,
        priority: rule.priority
      });

      return {
        success: true,
        metadata: { ruleId: rule.id },
        executionTime: 0
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  }

  /**
   * Removes an orchestration rule
   * 
   * @param ruleId - Rule identifier
   * @returns Operation result
   */
  removeOrchestrationRule(ruleId: string): RegistryOperationResult {
    const removed = this.orchestrationRules.delete(ruleId);
    
    if (removed) {
      this.logger.info('Orchestration rule removed', { ruleId });
    }

    return {
      success: removed,
      error: removed ? undefined : `Rule ${ruleId} not found`,
      executionTime: 0
    };
  }

  /**
   * Creates a comprehensive event subscription for system monitoring
   * 
   * @param filter - Optional event filter
   * @returns Observable stream of system events
   */
  subscribeToSystemEvents(filter?: {
    agentId?: string;
    eventType?: AgentEventType;
    role?: AgentRole;
  }): Observable<AgentEvent> {
    const registryEvents = this.registry.subscribeToEvents(filter?.agentId, filter?.eventType);
    const commHubEvents = this.communicationHub.subscribeToEvents(filter?.agentId, filter?.eventType);
    const systemEvents = this.systemEventStream.asObservable();

    return merge(registryEvents, commHubEvents, systemEvents).pipe(
      filter(event => {
        if (filter?.agentId && event.agentId !== filter.agentId) {
          return false;
        }
        if (filter?.eventType && event.type !== filter.eventType) {
          return false;
        }
        // Role filtering would need additional context
        return true;
      })
    );
  }

  /**
   * Gets comprehensive system statistics
   * 
   * @returns Current system statistics
   */
  getSystemStatistics(): MultiAgentSystemStats {
    const registryStats = this.registry.getRegistryStatistics();
    const commStats = this.communicationHub.getStatistics();

    // Calculate operations per second
    const now = Date.now();
    const timeDiff = now - this.performanceMonitor.lastReset;
    const opsPerSecond = timeDiff > 0 ? 
      (this.performanceMonitor.operationCount / (timeDiff / 1000)) : 0;

    // Reset performance counter every minute
    if (timeDiff > 60000) {
      this.performanceMonitor.operationCount = 0;
      this.performanceMonitor.lastReset = now;
      this.performanceMonitor.operationsPerSecond = opsPerSecond;
    }

    return {
      registry: {
        totalAgents: registryStats.totalAgents,
        agentsByStatus: registryStats.agentsByStatus,
        agentsByRole: registryStats.agentsByRole,
        avgResponseTime: registryStats.avgResponseTime
      },
      communication: {
        totalMessagesProcessed: commStats.totalMessagesProcessed,
        totalBroadcasts: commStats.totalBroadcasts,
        activeSubscriptions: commStats.activeSubscriptions,
        failedDeliveries: commStats.failedDeliveries,
        avgDeliveryTime: commStats.avgDeliveryTime
      },
      performance: {
        systemUptime: now - this.startTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuLoad: process.cpuUsage().system / 1000000, // Convert to seconds
        operationsPerSecond: this.performanceMonitor.operationsPerSecond
      },
      lastUpdated: now
    };
  }

  /**
   * Gets the status of all agents in the system
   * 
   * @returns Map of agent IDs to their current status
   */
  getSystemStatus(): Map<string, AgentStatus | null> {
    const agents = this.registry.getAllAgents();
    const statusMap = new Map<string, AgentStatus | null>();

    for (const agent of agents) {
      const status = this.registry.getAgentStatus(agent.id);
      statusMap.set(agent.id, status);
    }

    return statusMap;
  }

  /**
   * Performs system health check across all components
   * 
   * @returns Promise resolving to comprehensive health report
   */
  async performSystemHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      registry: 'healthy' | 'degraded' | 'unhealthy';
      communication: 'healthy' | 'degraded' | 'unhealthy';
      agents: { [agentId: string]: 'healthy' | 'degraded' | 'unhealthy' };
    };
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Check agent health
    const agentHealthChecks = await this.registry.performHealthCheck();
    const agentHealthStatus: { [agentId: string]: 'healthy' | 'degraded' | 'unhealthy' } = {};
    
    let healthyAgents = 0;
    let degradedAgents = 0;
    let unhealthyAgents = 0;

    for (const [agentId, healthCheck] of agentHealthChecks.entries()) {
      agentHealthStatus[agentId] = healthCheck.status;
      
      switch (healthCheck.status) {
        case 'healthy':
          healthyAgents++;
          break;
        case 'degraded':
          degradedAgents++;
          recommendations.push(`Agent ${agentId} is experiencing performance degradation`);
          break;
        case 'unhealthy':
          unhealthyAgents++;
          recommendations.push(`Agent ${agentId} is unhealthy and may need attention`);
          break;
      }
    }

    // Assess component health
    const registryHealth: 'healthy' | 'degraded' | 'unhealthy' = 
      unhealthyAgents > healthyAgents ? 'unhealthy' :
      degradedAgents > healthyAgents / 2 ? 'degraded' : 'healthy';

    const commStats = this.communicationHub.getStatistics();
    const failureRate = commStats.totalMessagesProcessed > 0 ? 
      commStats.failedDeliveries / commStats.totalMessagesProcessed : 0;
    
    const communicationHealth: 'healthy' | 'degraded' | 'unhealthy' = 
      failureRate > 0.1 ? 'unhealthy' :
      failureRate > 0.05 ? 'degraded' : 'healthy';

    if (communicationHealth !== 'healthy') {
      recommendations.push(`Communication system has ${(failureRate * 100).toFixed(1)}% failure rate`);
    }

    // Assess overall health
    const componentHealthScores = [registryHealth, communicationHealth].map(h => 
      h === 'healthy' ? 3 : h === 'degraded' ? 2 : 1
    );
    
    const avgScore = componentHealthScores.reduce((a, b) => a + b) / componentHealthScores.length;
    const overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 
      avgScore >= 2.5 ? 'healthy' : avgScore >= 1.5 ? 'degraded' : 'unhealthy';

    if (this.activeOperations > this.config.maxConcurrentOperations! * 0.8) {
      recommendations.push('System approaching maximum concurrent operations capacity');
    }

    return {
      overall: overallHealth,
      components: {
        registry: registryHealth,
        communication: communicationHealth,
        agents: agentHealthStatus
      },
      recommendations
    };
  }

  /**
   * Initializes integration between registry and communication hub
   * 
   * @private
   */
  private initializeSystemIntegration(): void {
    // Forward registry events to system event stream
    this.registry.subscribeToEvents().subscribe(event => {
      this.systemEventStream.next(event);
      
      if (this.config.enableOrchestration) {
        this.processOrchestrationRules(event);
      }
    });

    // Forward communication hub events to system event stream
    this.communicationHub.subscribeToEvents().subscribe(event => {
      this.systemEventStream.next(event);
      
      if (this.config.enableOrchestration) {
        this.processOrchestrationRules(event);
      }
    });

    this.logger.info('System integration initialized');
  }

  /**
   * Sets up communication subscriptions for a newly registered agent
   * 
   * @private
   */
  private async setupAgentCommunication(agentId: string): Promise<void> {
    // Subscribe agent to relevant events
    this.communicationHub.subscribeToEvents(agentId);
    
    this.logger.info('Communication setup completed for agent', { agentId });
  }

  /**
   * Processes orchestration rules for an event
   * 
   * @private
   */
  private async processOrchestrationRules(event: AgentEvent): Promise<void> {
    for (const rule of this.orchestrationRules.values()) {
      if (!rule.active) continue;

      // Check if rule triggers match
      if (!rule.triggers.eventTypes.includes(event.type)) {
        continue;
      }

      // Apply custom condition if present
      if (rule.triggers.condition && !rule.triggers.condition(event)) {
        continue;
      }

      try {
        // Execute rule actions
        if (rule.actions.notifyAgents) {
          const notificationMessage: AgentMessage = {
            id: `orchestration_${rule.id}_${Date.now()}`,
            fromAgentId: 'system',
            type: 'notification',
            content: `Orchestration rule '${rule.name}' triggered`,
            data: { rule: rule.id, triggerEvent: event },
            timestamp: Date.now(),
            priority: rule.priority
          };

          for (const agentId of rule.actions.notifyAgents) {
            await this.communicationHub.sendMessage('system', agentId, notificationMessage);
          }
        }

        if (rule.actions.broadcastToRoles) {
          const broadcastMessage: AgentMessage = {
            id: `orchestration_broadcast_${rule.id}_${Date.now()}`,
            fromAgentId: 'system',
            type: 'notification',
            content: `System orchestration: ${rule.name}`,
            data: { rule: rule.id, triggerEvent: event },
            timestamp: Date.now(),
            priority: rule.priority
          };

          for (const role of rule.actions.broadcastToRoles) {
            await this.communicationHub.broadcastToRole('system', role, broadcastMessage, false);
          }
        }

        if (rule.actions.handler) {
          await rule.actions.handler(event, this);
        }

        this.logger.info('Orchestration rule executed', {
          ruleId: rule.id,
          eventType: event.type,
          agentId: event.agentId
        });

      } catch (error) {
        this.logger.error('Orchestration rule execution failed', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Initializes default orchestration rules for common scenarios
   * 
   * @private
   */
  private initializeDefaultOrchestrationRules(): void {
    if (!this.config.enableOrchestration) {
      return;
    }

    // Rule: Notify architects when new agents are registered
    this.addOrchestrationRule({
      id: 'notify_architects_on_registration',
      name: 'Notify Architects on Agent Registration',
      triggers: {
        eventTypes: ['agent_registered']
      },
      actions: {
        broadcastToRoles: ['architect']
      },
      priority: 'low',
      active: true
    });

    // Rule: Alert on agent health failures
    this.addOrchestrationRule({
      id: 'alert_on_health_failure',
      name: 'Alert on Agent Health Failure',
      triggers: {
        eventTypes: ['health_check_failed']
      },
      actions: {
        broadcastToRoles: ['architect', 'code_reviewer']
      },
      priority: 'high',
      active: true
    });

    this.logger.info('Default orchestration rules initialized');
  }

  /**
   * Emits a system-level event
   * 
   * @private
   */
  private emitSystemEvent(event: AgentEvent): void {
    this.systemEventStream.next(event);
  }

  /**
   * Shuts down the entire multi-agent system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MultiAgentSystem');

    await Promise.all([
      this.registry.shutdown(),
      this.communicationHub.shutdown()
    ]);

    this.systemEventStream.complete();
    this.orchestrationRules.clear();

    this.logger.info('MultiAgentSystem shutdown complete');
  }
}