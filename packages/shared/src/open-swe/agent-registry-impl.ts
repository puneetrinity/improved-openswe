import { EventEmitter } from 'events';
import { Observable, Subject, BehaviorSubject, interval, merge } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { 
  AgentProfile, 
  AgentRole, 
  AgentMetrics,
  AgentMessage
} from './types.js';
import {
  AgentStatus,
  AgentEvent,
  AgentEventType,
  AgentHealthCheck,
  AgentLoadInfo,
  CapabilityQuery,
  AgentDiscoveryResult,
  AgentRegistryConfig,
  RegistryOperationResult,
  RegistryStatistics,
  RuntimeAgentProfile,
  ExtendedAgentRegistryEntry,
  AgentCapability,
  PerformanceThresholds
} from './agent-registry.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Comprehensive Agent Registry with capability discovery, health monitoring,
 * and load balancing for multi-agent collaboration in Open SWE.
 * 
 * This registry manages the lifecycle of agents, tracks their capabilities,
 * monitors their health and performance, and provides intelligent agent
 * discovery based on requirements.
 */
export class AgentRegistry extends EventEmitter {
  private readonly logger = createLogger(LogLevel.INFO, 'AgentRegistry');
  
  /**
   * Registry of all agents by ID
   */
  private readonly agents = new Map<string, ExtendedAgentRegistryEntry>();
  
  /**
   * Capability index for fast discovery
   */
  private readonly capabilityIndex = new Map<string, Set<string>>();
  
  /**
   * Role index for role-based queries
   */
  private readonly roleIndex = new Map<AgentRole, Set<string>>();
  
  /**
   * Health check status by agent ID
   */
  private readonly healthStatus = new Map<string, AgentHealthCheck>();
  
  /**
   * Load information by agent ID
   */
  private readonly loadInfo = new Map<string, AgentLoadInfo>();
  
  /**
   * Performance metrics by agent ID
   */
  private readonly performanceMetrics = new Map<string, AgentMetrics>();
  
  /**
   * Registry configuration
   */
  private readonly config: AgentRegistryConfig;
  
  /**
   * Registry statistics
   */
  private readonly statistics: RegistryStatistics;
  
  /**
   * Health check intervals by agent ID
   */
  private readonly healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  
  /**
   * Event stream for registry events
   */
  private readonly eventStream = new Subject<AgentEvent>();
  
  /**
   * Registry start time for uptime calculation
   */
  private readonly startTime = Date.now();

  /**
   * Creates a new AgentRegistry instance
   * 
   * @param config - Registry configuration options
   */
  constructor(config?: Partial<AgentRegistryConfig>) {
    super();
    
    this.config = {
      maxAgents: 50,
      healthCheck: {
        interval: 30000, // 30 seconds
        timeout: 5000,   // 5 seconds
        failureThreshold: 3
      },
      performance: {
        maxResponseTime: 5000, // 5 seconds
        minSuccessRate: 0.95,  // 95%
        maxLoad: 0.8,          // 80%
        healthCheckInterval: 30000
      },
      autoCleanup: true,
      offlineTimeout: 300000, // 5 minutes
      ...config
    };

    this.statistics = {
      totalAgents: 0,
      agentsByStatus: {
        active: 0,
        idle: 0,
        busy: 0,
        offline: 0,
        error: 0
      },
      agentsByRole: {} as Record<AgentRole, number>,
      avgResponseTime: 0,
      totalMessagesProcessed: 0,
      uptime: 0,
      lastUpdated: Date.now()
    };

    this.initializeCleanupRoutines();
    this.logger.info('AgentRegistry initialized', { config: this.config });
  }

  /**
   * Registers a new agent in the registry with comprehensive capability discovery
   * 
   * @param profile - Agent profile with capabilities and configuration
   * @param capabilities - Detailed capability information
   * @param metadata - Additional registration metadata
   * @returns Promise resolving to operation result
   */
  async registerAgent(
    profile: AgentProfile,
    capabilities?: AgentCapability[],
    metadata?: Record<string, unknown>
  ): Promise<RegistryOperationResult> {
    const startTime = Date.now();
    
    try {
      // Validate agent profile
      if (!profile.id || !profile.role) {
        return {
          success: false,
          error: 'Invalid agent profile: missing required fields',
          executionTime: Date.now() - startTime
        };
      }

      // Check registry capacity
      if (this.agents.size >= this.config.maxAgents) {
        return {
          success: false,
          error: `Registry at maximum capacity (${this.config.maxAgents} agents)`,
          executionTime: Date.now() - startTime
        };
      }

      // Check for duplicate agent ID
      if (this.agents.has(profile.id)) {
        return {
          success: false,
          error: `Agent with ID ${profile.id} already registered`,
          executionTime: Date.now() - startTime
        };
      }

      const now = Date.now();
      
      // Create extended registry entry
      const runtimeProfile: RuntimeAgentProfile = {
        ...profile,
        healthStatus: {
          agentId: profile.id,
          status: 'healthy',
          responseTime: 0,
          load: 0,
          timestamp: now
        },
        loadInfo: {
          agentId: profile.id,
          currentLoad: 0,
          activeTasks: 0,
          maxConcurrentTasks: 10, // Default
          avgResponseTime: 0,
          availabilityScore: 1.0
        },
        metrics: {
          agentId: profile.id,
          tasksCompleted: 0,
          avgResponseTime: 0,
          successRate: 1.0,
          qualityScore: 100,
          lastUpdated: now
        },
        activeSubscriptions: 0,
        messageQueueSize: 0
      };

      const registryEntry: ExtendedAgentRegistryEntry = {
        profile: runtimeProfile,
        capabilities: capabilities || this.inferCapabilitiesFromProfile(profile),
        registeredAt: now,
        lastActiveAt: now,
        registrationMetadata: metadata || {}
      };

      // Add agent to registry
      this.agents.set(profile.id, registryEntry);

      // Update indexes
      this.updateCapabilityIndex(profile.id, registryEntry.capabilities);
      this.updateRoleIndex(profile.id, profile.role);

      // Initialize monitoring
      this.initializeAgentMonitoring(profile.id);

      // Update statistics
      this.updateStatistics();

      // Emit registration event
      this.emitEvent({
        id: `reg_${profile.id}_${now}`,
        type: 'agent_registered',
        agentId: profile.id,
        payload: { profile, capabilities: registryEntry.capabilities },
        timestamp: now,
        priority: 'medium'
      });

      this.logger.info('Agent registered successfully', {
        agentId: profile.id,
        role: profile.role,
        capabilities: registryEntry.capabilities.length
      });

      return {
        success: true,
        metadata: { 
          agentId: profile.id,
          capabilities: registryEntry.capabilities.map(c => c.name)
        },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to register agent', {
        agentId: profile.id,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Discovers agents based on capability requirements with intelligent scoring
   * 
   * @param query - Capability query with requirements
   * @returns Promise resolving to discovery results with ranked agents
   */
  async discoverAgents(query: CapabilityQuery): Promise<AgentDiscoveryResult> {
    const startTime = Date.now();
    
    try {
      let candidateAgents = new Set<string>();

      // Find agents with required capabilities
      if (query.required.length > 0) {
        // Start with agents having the first capability
        const firstCapability = query.required[0];
        if (this.capabilityIndex.has(firstCapability)) {
          candidateAgents = new Set(this.capabilityIndex.get(firstCapability));
        } else {
          // No agents have the first required capability
          return {
            agents: [],
            loadInfo: new Map(),
            totalFound: 0,
            queryTime: Date.now() - startTime
          };
        }

        // Intersect with agents having other required capabilities
        for (let i = 1; i < query.required.length; i++) {
          const capability = query.required[i];
          if (this.capabilityIndex.has(capability)) {
            const capabilityAgents = this.capabilityIndex.get(capability)!;
            candidateAgents = new Set([...candidateAgents].filter(id => capabilityAgents.has(id)));
          } else {
            // No agents have this required capability
            return {
              agents: [],
              loadInfo: new Map(),
              totalFound: 0,
              queryTime: Date.now() - startTime
            };
          }
        }
      } else {
        // No specific capabilities required, include all agents
        candidateAgents = new Set(this.agents.keys());
      }

      // Apply role filter
      if (query.role) {
        if (this.roleIndex.has(query.role)) {
          const roleAgents = this.roleIndex.get(query.role)!;
          candidateAgents = new Set([...candidateAgents].filter(id => roleAgents.has(id)));
        } else {
          return {
            agents: [],
            loadInfo: new Map(),
            totalFound: 0,
            queryTime: Date.now() - startTime
          };
        }
      }

      // Score and filter candidates
      const scoredCandidates: Array<{ agent: AgentProfile; score: number }> = [];
      const loadInfoMap = new Map<string, AgentLoadInfo>();

      for (const agentId of candidateAgents) {
        const entry = this.agents.get(agentId);
        if (!entry) continue;

        const health = this.healthStatus.get(agentId);
        const load = this.loadInfo.get(agentId);
        
        // Skip unhealthy agents
        if (health && health.status === 'unhealthy') {
          continue;
        }

        // Apply availability score filter
        if (query.minAvailabilityScore && load && load.availabilityScore < query.minAvailabilityScore) {
          continue;
        }

        // Apply response time filter
        if (query.maxResponseTime && load && load.avgResponseTime > query.maxResponseTime) {
          continue;
        }

        // Calculate agent score
        const score = this.calculateAgentScore(entry, query, health, load);
        scoredCandidates.push({ agent: entry.profile, score });
        
        if (load) {
          loadInfoMap.set(agentId, load);
        }
      }

      // Sort by score (descending)
      scoredCandidates.sort((a, b) => b.score - a.score);

      const results = scoredCandidates.map(c => c.agent);

      this.logger.info('Agent discovery completed', {
        query,
        totalFound: results.length,
        queryTime: Date.now() - startTime
      });

      return {
        agents: results,
        loadInfo: loadInfoMap,
        totalFound: results.length,
        queryTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Agent discovery failed', {
        query,
        error: error instanceof Error ? error.message : error
      });

      return {
        agents: [],
        loadInfo: new Map(),
        totalFound: 0,
        queryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Gets the current status of an agent with comprehensive information
   * 
   * @param agentId - Agent identifier
   * @returns Agent status with health and load information
   */
  getAgentStatus(agentId: string): AgentStatus | null {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return null;
    }

    const health = this.healthStatus.get(agentId);
    if (!health) {
      return entry.profile.status;
    }

    // Determine status based on health and load
    if (health.status === 'unhealthy') {
      return 'error';
    }

    const load = this.loadInfo.get(agentId);
    if (load && load.currentLoad > this.config.performance.maxLoad * 100) {
      return 'busy';
    }

    return entry.profile.status;
  }

  /**
   * Gets detailed agent information including runtime metrics
   * 
   * @param agentId - Agent identifier
   * @returns Complete agent information or null if not found
   */
  getAgentDetails(agentId: string): RuntimeAgentProfile | null {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return null;
    }

    // Update runtime information
    const health = this.healthStatus.get(agentId);
    const load = this.loadInfo.get(agentId);
    const metrics = this.performanceMetrics.get(agentId);

    return {
      ...entry.profile,
      healthStatus: health || entry.profile.healthStatus,
      loadInfo: load || entry.profile.loadInfo,
      metrics: metrics || entry.profile.metrics
    };
  }

  /**
   * Deregisters an agent from the registry
   * 
   * @param agentId - Agent identifier
   * @returns Operation result
   */
  async deregisterAgent(agentId: string): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      const entry = this.agents.get(agentId);
      if (!entry) {
        return {
          success: false,
          error: `Agent ${agentId} not found`,
          executionTime: Date.now() - startTime
        };
      }

      // Clean up monitoring
      this.cleanupAgentMonitoring(agentId);

      // Remove from indexes
      this.removeFromCapabilityIndex(agentId, entry.capabilities);
      this.removeFromRoleIndex(agentId, entry.profile.role);

      // Remove from registry
      this.agents.delete(agentId);
      this.healthStatus.delete(agentId);
      this.loadInfo.delete(agentId);
      this.performanceMetrics.delete(agentId);

      // Update statistics
      this.updateStatistics();

      // Emit deregistration event
      this.emitEvent({
        id: `dereg_${agentId}_${Date.now()}`,
        type: 'agent_deregistered',
        agentId,
        payload: { profile: entry.profile },
        timestamp: Date.now(),
        priority: 'medium'
      });

      this.logger.info('Agent deregistered successfully', { agentId });

      return {
        success: true,
        metadata: { agentId },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to deregister agent', {
        agentId,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Updates agent status with automatic health monitoring integration
   * 
   * @param agentId - Agent identifier
   * @param status - New agent status
   * @returns Operation result
   */
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      const entry = this.agents.get(agentId);
      if (!entry) {
        return {
          success: false,
          error: `Agent ${agentId} not found`,
          executionTime: Date.now() - startTime
        };
      }

      const oldStatus = entry.profile.status;
      entry.profile.status = status;
      entry.lastActiveAt = Date.now();

      // Update statistics if status changed
      if (oldStatus !== status) {
        this.updateStatistics();

        // Emit status change event
        this.emitEvent({
          id: `status_${agentId}_${Date.now()}`,
          type: 'agent_status_changed',
          agentId,
          payload: { oldStatus, newStatus: status },
          timestamp: Date.now(),
          priority: 'low'
        });
      }

      return {
        success: true,
        metadata: { agentId, oldStatus, newStatus: status },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to update agent status', {
        agentId,
        status,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Gets registry statistics and health overview
   * 
   * @returns Current registry statistics
   */
  getRegistryStatistics(): RegistryStatistics {
    this.statistics.uptime = Date.now() - this.startTime;
    this.statistics.lastUpdated = Date.now();
    return { ...this.statistics };
  }

  /**
   * Gets all registered agents with optional filtering
   * 
   * @param filter - Optional filter criteria
   * @returns Array of agent profiles matching criteria
   */
  getAllAgents(filter?: { role?: AgentRole; status?: AgentStatus }): AgentProfile[] {
    const agents: AgentProfile[] = [];

    for (const entry of this.agents.values()) {
      let include = true;

      if (filter?.role && entry.profile.role !== filter.role) {
        include = false;
      }

      if (filter?.status && entry.profile.status !== filter.status) {
        include = false;
      }

      if (include) {
        agents.push(entry.profile);
      }
    }

    return agents;
  }

  /**
   * Creates an observable stream of agent events
   * 
   * @param agentId - Optional agent ID filter
   * @param eventType - Optional event type filter
   * @returns Observable stream of filtered events
   */
  subscribeToEvents(agentId?: string, eventType?: AgentEventType): Observable<AgentEvent> {
    return this.eventStream.asObservable().pipe(
      filter(event => {
        if (agentId && event.agentId !== agentId) {
          return false;
        }
        if (eventType && event.type !== eventType) {
          return false;
        }
        return true;
      })
    );
  }

  /**
   * Performs manual health check on all or specific agents
   * 
   * @param agentId - Optional specific agent ID
   * @returns Promise resolving to health check results
   */
  async performHealthCheck(agentId?: string): Promise<Map<string, AgentHealthCheck>> {
    const results = new Map<string, AgentHealthCheck>();
    const agents = agentId ? [agentId] : Array.from(this.agents.keys());

    const promises = agents.map(async (id) => {
      const result = await this.performSingleHealthCheck(id);
      if (result) {
        results.set(id, result);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Initializes cleanup routines for offline agents and registry maintenance
   * 
   * @private
   */
  private initializeCleanupRoutines(): void {
    if (this.config.autoCleanup) {
      // Run cleanup every 60 seconds
      setInterval(() => {
        this.performCleanup();
      }, 60000);
    }

    // Update statistics every 30 seconds
    setInterval(() => {
      this.updateStatistics();
    }, 30000);
  }

  /**
   * Performs registry cleanup, removing stale agents
   * 
   * @private
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const agentsToRemove: string[] = [];

    for (const [agentId, entry] of this.agents.entries()) {
      const timeSinceLastActive = now - entry.lastActiveAt;
      
      if (entry.profile.status === 'offline' && timeSinceLastActive > this.config.offlineTimeout) {
        agentsToRemove.push(agentId);
      }
    }

    for (const agentId of agentsToRemove) {
      await this.deregisterAgent(agentId);
      this.logger.info('Automatically cleaned up stale agent', { agentId });
    }
  }

  /**
   * Initializes monitoring for a newly registered agent
   * 
   * @private
   */
  private initializeAgentMonitoring(agentId: string): void {
    // Start periodic health checks
    const interval = setInterval(async () => {
      await this.performSingleHealthCheck(agentId);
    }, this.config.healthCheck.interval);

    this.healthCheckIntervals.set(agentId, interval);

    // Initialize health and load tracking
    const now = Date.now();
    
    this.healthStatus.set(agentId, {
      agentId,
      status: 'healthy',
      responseTime: 0,
      load: 0,
      timestamp: now
    });

    this.loadInfo.set(agentId, {
      agentId,
      currentLoad: 0,
      activeTasks: 0,
      maxConcurrentTasks: 10,
      avgResponseTime: 0,
      availabilityScore: 1.0
    });

    this.performanceMetrics.set(agentId, {
      agentId,
      tasksCompleted: 0,
      avgResponseTime: 0,
      successRate: 1.0,
      qualityScore: 100,
      lastUpdated: now
    });
  }

  /**
   * Cleans up monitoring for an agent being deregistered
   * 
   * @private
   */
  private cleanupAgentMonitoring(agentId: string): void {
    const interval = this.healthCheckIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(agentId);
    }
  }

  /**
   * Performs a single health check on an agent
   * 
   * @private
   */
  private async performSingleHealthCheck(agentId: string): Promise<AgentHealthCheck | null> {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return null;
    }

    const startTime = Date.now();
    
    try {
      // Mock health check - in real implementation, this would ping the agent
      const responseTime = Math.random() * 100; // Simulate response time
      const load = Math.random() * 0.5; // Simulate current load
      
      const healthCheck: AgentHealthCheck = {
        agentId,
        status: responseTime < this.config.healthCheck.timeout ? 'healthy' : 'degraded',
        responseTime,
        load,
        timestamp: Date.now()
      };

      this.healthStatus.set(agentId, healthCheck);

      // Update load info
      const loadInfo = this.loadInfo.get(agentId);
      if (loadInfo) {
        loadInfo.avgResponseTime = (loadInfo.avgResponseTime + responseTime) / 2;
        loadInfo.currentLoad = load * 100;
        loadInfo.availabilityScore = healthCheck.status === 'healthy' ? 1.0 : 0.5;
      }

      return healthCheck;

    } catch (error) {
      const healthCheck: AgentHealthCheck = {
        agentId,
        status: 'unhealthy',
        responseTime: this.config.healthCheck.timeout,
        load: 1.0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };

      this.healthStatus.set(agentId, healthCheck);

      // Emit health check failed event
      this.emitEvent({
        id: `health_fail_${agentId}_${Date.now()}`,
        type: 'health_check_failed',
        agentId,
        payload: { error: healthCheck.error },
        timestamp: Date.now(),
        priority: 'high'
      });

      return healthCheck;
    }
  }

  /**
   * Calculates an agent's suitability score for a query
   * 
   * @private
   */
  private calculateAgentScore(
    entry: ExtendedAgentRegistryEntry,
    query: CapabilityQuery,
    health?: AgentHealthCheck,
    load?: AgentLoadInfo
  ): number {
    let score = 100; // Base score

    // Health score (40% of total)
    if (health) {
      switch (health.status) {
        case 'healthy':
          score += 40;
          break;
        case 'degraded':
          score += 20;
          break;
        case 'unhealthy':
          score -= 40;
          break;
      }
    }

    // Load score (30% of total)
    if (load) {
      const loadFactor = 1 - (load.currentLoad / 100);
      score += loadFactor * 30;
      
      // Availability bonus
      score += load.availabilityScore * 10;
    }

    // Capability match score (20% of total)
    const capabilities = entry.capabilities.map(c => c.name);
    const requiredMatches = query.required.filter(cap => capabilities.includes(cap)).length;
    const requiredScore = (requiredMatches / Math.max(query.required.length, 1)) * 15;
    score += requiredScore;

    // Optional capability bonus (10% of total)
    if (query.optional) {
      const optionalMatches = query.optional.filter(cap => capabilities.includes(cap)).length;
      const optionalScore = (optionalMatches / query.optional.length) * 10;
      score += optionalScore;
    }

    // Performance bonus (based on metrics)
    const metrics = this.performanceMetrics.get(entry.profile.id);
    if (metrics) {
      score += (metrics.successRate - 0.95) * 50; // Bonus for high success rate
      score += Math.max(0, (100 - metrics.qualityScore) * -0.1); // Penalty for low quality
    }

    return Math.max(0, score);
  }

  /**
   * Updates capability index for an agent
   * 
   * @private
   */
  private updateCapabilityIndex(agentId: string, capabilities: AgentCapability[]): void {
    for (const capability of capabilities) {
      if (!this.capabilityIndex.has(capability.name)) {
        this.capabilityIndex.set(capability.name, new Set());
      }
      this.capabilityIndex.get(capability.name)!.add(agentId);
    }
  }

  /**
   * Updates role index for an agent
   * 
   * @private
   */
  private updateRoleIndex(agentId: string, role: AgentRole): void {
    if (!this.roleIndex.has(role)) {
      this.roleIndex.set(role, new Set());
    }
    this.roleIndex.get(role)!.add(agentId);
  }

  /**
   * Removes agent from capability index
   * 
   * @private
   */
  private removeFromCapabilityIndex(agentId: string, capabilities: AgentCapability[]): void {
    for (const capability of capabilities) {
      const agentSet = this.capabilityIndex.get(capability.name);
      if (agentSet) {
        agentSet.delete(agentId);
        if (agentSet.size === 0) {
          this.capabilityIndex.delete(capability.name);
        }
      }
    }
  }

  /**
   * Removes agent from role index
   * 
   * @private
   */
  private removeFromRoleIndex(agentId: string, role: AgentRole): void {
    const agentSet = this.roleIndex.get(role);
    if (agentSet) {
      agentSet.delete(agentId);
      if (agentSet.size === 0) {
        this.roleIndex.delete(role);
      }
    }
  }

  /**
   * Infers capabilities from agent profile
   * 
   * @private
   */
  private inferCapabilitiesFromProfile(profile: AgentProfile): AgentCapability[] {
    const capabilities: AgentCapability[] = [];

    // Create capabilities from specialization and tools
    for (const spec of profile.specialization) {
      capabilities.push({
        name: spec,
        version: '1.0.0',
        description: `${spec} capability`,
        dependencies: [],
        performance: {
          avgExecutionTime: 1000,
          resourceRequirements: { cpu: 0.1, memory: 0.1 }
        }
      });
    }

    for (const tool of profile.tools) {
      capabilities.push({
        name: tool,
        version: '1.0.0',
        description: `${tool} tool capability`,
        dependencies: [],
        performance: {
          avgExecutionTime: 500,
          resourceRequirements: { cpu: 0.05, memory: 0.05 }
        }
      });
    }

    return capabilities;
  }

  /**
   * Updates registry statistics
   * 
   * @private
   */
  private updateStatistics(): void {
    this.statistics.totalAgents = this.agents.size;
    
    // Reset counters
    Object.keys(this.statistics.agentsByStatus).forEach(status => {
      this.statistics.agentsByStatus[status as AgentStatus] = 0;
    });
    
    // Clear role statistics
    this.statistics.agentsByRole = {} as Record<AgentRole, number>;

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    // Count agents by status and role
    for (const entry of this.agents.values()) {
      const status = this.getAgentStatus(entry.profile.id) || entry.profile.status;
      this.statistics.agentsByStatus[status]++;
      
      const role = entry.profile.role;
      this.statistics.agentsByRole[role] = (this.statistics.agentsByRole[role] || 0) + 1;

      // Calculate average response time
      const load = this.loadInfo.get(entry.profile.id);
      if (load && load.avgResponseTime > 0) {
        totalResponseTime += load.avgResponseTime;
        responseTimeCount++;
      }
    }

    this.statistics.avgResponseTime = responseTimeCount > 0 
      ? totalResponseTime / responseTimeCount 
      : 0;
    
    this.statistics.lastUpdated = Date.now();
  }

  /**
   * Emits an event through the event stream
   * 
   * @private
   */
  private emitEvent(event: AgentEvent): void {
    this.eventStream.next(event);
    this.emit('event', event);
  }

  /**
   * Shuts down the registry and cleans up resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down AgentRegistry');

    // Clear all intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Complete event stream
    this.eventStream.complete();

    // Clear all data structures
    this.agents.clear();
    this.capabilityIndex.clear();
    this.roleIndex.clear();
    this.healthStatus.clear();
    this.loadInfo.clear();
    this.performanceMetrics.clear();

    this.logger.info('AgentRegistry shutdown complete');
  }
}