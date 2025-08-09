import { Observable } from "rxjs";
import { 
  AgentProfile, 
  AgentMessage, 
  AgentRole, 
  AgentMetrics,
  TaskDelegation 
} from "./types.js";

/**
 * Status of an agent in the registry
 */
export type AgentStatus = 'active' | 'idle' | 'busy' | 'offline' | 'error';

/**
 * Event types for agent lifecycle and communication
 */
export type AgentEventType = 
  | 'agent_registered'
  | 'agent_deregistered'
  | 'agent_status_changed'
  | 'message_received'
  | 'task_delegated'
  | 'collaboration_requested'
  | 'health_check_failed'
  | 'performance_metric_updated';

/**
 * Health check result for monitoring agent status
 */
export interface AgentHealthCheck {
  /**
   * Agent identifier
   */
  agentId: string;
  /**
   * Health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /**
   * Response time in milliseconds
   */
  responseTime: number;
  /**
   * Current load (0-1, where 1 is maximum capacity)
   */
  load: number;
  /**
   * Error message if unhealthy
   */
  error?: string;
  /**
   * When the health check was performed
   */
  timestamp: number;
}

/**
 * Load balancing information for agent selection
 */
export interface AgentLoadInfo {
  /**
   * Agent identifier
   */
  agentId: string;
  /**
   * Current load percentage (0-100)
   */
  currentLoad: number;
  /**
   * Number of active tasks
   */
  activeTasks: number;
  /**
   * Maximum concurrent tasks
   */
  maxConcurrentTasks: number;
  /**
   * Agent response time performance
   */
  avgResponseTime: number;
  /**
   * Agent availability score (0-1)
   */
  availabilityScore: number;
}

/**
 * Agent event for communication and lifecycle tracking
 */
export interface AgentEvent {
  /**
   * Unique event identifier
   */
  id: string;
  /**
   * Event type
   */
  type: AgentEventType;
  /**
   * Agent involved in the event
   */
  agentId: string;
  /**
   * Event payload
   */
  payload: Record<string, unknown>;
  /**
   * Event timestamp
   */
  timestamp: number;
  /**
   * Event priority
   */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Capability query for agent discovery
 */
export interface CapabilityQuery {
  /**
   * Required capabilities (all must be present)
   */
  required: string[];
  /**
   * Optional capabilities (nice to have)
   */
  optional?: string[];
  /**
   * Specific agent role required
   */
  role?: AgentRole;
  /**
   * Minimum availability score required (0-1)
   */
  minAvailabilityScore?: number;
  /**
   * Maximum response time allowed (milliseconds)
   */
  maxResponseTime?: number;
}

/**
 * Result of agent discovery query
 */
export interface AgentDiscoveryResult {
  /**
   * Matching agent profiles
   */
  agents: AgentProfile[];
  /**
   * Load information for each agent
   */
  loadInfo: Map<string, AgentLoadInfo>;
  /**
   * Total number of agents found
   */
  totalFound: number;
  /**
   * Query execution time in milliseconds
   */
  queryTime: number;
}

/**
 * Performance threshold configuration for agents
 */
export interface PerformanceThresholds {
  /**
   * Maximum acceptable response time (ms)
   */
  maxResponseTime: number;
  /**
   * Minimum success rate (0-1)
   */
  minSuccessRate: number;
  /**
   * Maximum load before marking as overloaded (0-1)
   */
  maxLoad: number;
  /**
   * Minimum health check interval (ms)
   */
  healthCheckInterval: number;
}

/**
 * Registry configuration options
 */
export interface AgentRegistryConfig {
  /**
   * Maximum number of agents that can be registered
   */
  maxAgents: number;
  /**
   * Health check configuration
   */
  healthCheck: {
    /**
     * Interval between health checks (ms)
     */
    interval: number;
    /**
     * Timeout for health check responses (ms)
     */
    timeout: number;
    /**
     * Number of failed checks before marking as unhealthy
     */
    failureThreshold: number;
  };
  /**
   * Performance monitoring settings
   */
  performance: PerformanceThresholds;
  /**
   * Enable automatic cleanup of offline agents
   */
  autoCleanup: boolean;
  /**
   * Time before offline agents are removed (ms)
   */
  offlineTimeout: number;
}

/**
 * Communication hub configuration
 */
export interface CommunicationHubConfig {
  /**
   * Maximum number of queued messages per agent
   */
  maxQueueSize: number;
  /**
   * Message timeout before retry (ms)
   */
  messageTimeout: number;
  /**
   * Maximum retry attempts for failed messages
   */
  maxRetryAttempts: number;
  /**
   * Enable message persistence
   */
  enablePersistence: boolean;
  /**
   * Message history retention time (ms)
   */
  messageRetentionTime: number;
}

/**
 * Message delivery status
 */
export type MessageDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'timeout';

/**
 * Message envelope with delivery metadata
 */
export interface MessageEnvelope {
  /**
   * The actual message
   */
  message: AgentMessage;
  /**
   * Delivery status
   */
  status: MessageDeliveryStatus;
  /**
   * Number of delivery attempts
   */
  attempts: number;
  /**
   * When the message was queued
   */
  queuedAt: number;
  /**
   * When the message was delivered (if successful)
   */
  deliveredAt?: number;
  /**
   * Retry schedule
   */
  retryAt?: number;
  /**
   * Delivery error if failed
   */
  error?: string;
}

/**
 * Broadcast subscription information
 */
export interface BroadcastSubscription {
  /**
   * Subscription identifier
   */
  id: string;
  /**
   * Subscriber agent ID
   */
  agentId: string;
  /**
   * Role filter for broadcasts
   */
  roleFilter?: AgentRole;
  /**
   * Event type filter
   */
  eventTypeFilter?: AgentEventType[];
  /**
   * When the subscription was created
   */
  createdAt: number;
  /**
   * Whether the subscription is active
   */
  active: boolean;
}

/**
 * Registry operation result
 */
export interface RegistryOperationResult {
  /**
   * Whether the operation was successful
   */
  success: boolean;
  /**
   * Error message if operation failed
   */
  error?: string;
  /**
   * Additional operation metadata
   */
  metadata?: Record<string, unknown>;
  /**
   * Operation execution time (ms)
   */
  executionTime: number;
}

/**
 * Agent registry statistics
 */
export interface RegistryStatistics {
  /**
   * Total number of registered agents
   */
  totalAgents: number;
  /**
   * Agents by status
   */
  agentsByStatus: Record<AgentStatus, number>;
  /**
   * Agents by role
   */
  agentsByRole: Record<AgentRole, number>;
  /**
   * Average response time across all agents
   */
  avgResponseTime: number;
  /**
   * Total messages processed
   */
  totalMessagesProcessed: number;
  /**
   * Registry uptime in milliseconds
   */
  uptime: number;
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Extended agent profile with runtime information
 */
export interface RuntimeAgentProfile extends AgentProfile {
  /**
   * Current health status
   */
  healthStatus: AgentHealthCheck;
  /**
   * Load information
   */
  loadInfo: AgentLoadInfo;
  /**
   * Performance metrics
   */
  metrics: AgentMetrics;
  /**
   * Number of active subscriptions
   */
  activeSubscriptions: number;
  /**
   * Queue size for pending messages
   */
  messageQueueSize: number;
}

/**
 * Agent capability metadata
 */
export interface AgentCapability {
  /**
   * Capability identifier
   */
  name: string;
  /**
   * Capability version
   */
  version: string;
  /**
   * Description of the capability
   */
  description: string;
  /**
   * Required dependencies
   */
  dependencies: string[];
  /**
   * Performance characteristics
   */
  performance: {
    /**
     * Typical execution time (ms)
     */
    avgExecutionTime: number;
    /**
     * Resource requirements (CPU, memory, etc.)
     */
    resourceRequirements: Record<string, number>;
  };
}

/**
 * Extended agent registry entry with comprehensive metadata
 */
export interface ExtendedAgentRegistryEntry {
  /**
   * Agent runtime profile
   */
  profile: RuntimeAgentProfile;
  /**
   * Detailed capability information
   */
  capabilities: AgentCapability[];
  /**
   * Registration timestamp
   */
  registeredAt: number;
  /**
   * Last activity timestamp
   */
  lastActiveAt: number;
  /**
   * Registration metadata
   */
  registrationMetadata: Record<string, unknown>;
}