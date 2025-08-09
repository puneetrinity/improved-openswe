/**
 * Comprehensive types and interfaces for the Shared Context Store system
 * 
 * Provides secure, role-based access to hierarchical context storage for
 * multi-agent collaboration with versioning, conflict resolution, and real-time sync.
 */

import { AgentRole, AgentProfile } from './types.js';
import { Observable } from 'rxjs';

/**
 * Context hierarchy levels for organized information storage
 */
export type ContextScope = 'global' | 'session' | 'task' | 'agent';

/**
 * Context data types for structured and unstructured information
 */
export type ContextDataType = 'text' | 'json' | 'binary' | 'structured' | 'metadata';

/**
 * Permission types for fine-grained access control
 */
export type Permission = 'read' | 'write' | 'delete' | 'execute' | 'admin';

/**
 * Context operations for audit logging and event tracking
 */
export type ContextOperation = 
  | 'create' | 'read' | 'update' | 'delete' | 'version' | 'merge' | 'lock' | 'unlock';

/**
 * Conflict resolution strategies for concurrent modifications
 */
export type ConflictResolutionStrategy = 
  | 'last_write_wins' | 'first_write_wins' | 'merge_automatic' | 'merge_manual' | 'abort';

/**
 * Storage backend types for different deployment scenarios
 */
export type StorageBackend = 'memory' | 'file' | 'database' | 'redis' | 's3' | 'hybrid';

/**
 * Compression algorithms for large context data
 */
export type CompressionType = 'none' | 'gzip' | 'lz4' | 'zstd';

/**
 * Encryption algorithms for data security
 */
export type EncryptionType = 'none' | 'aes256' | 'chacha20' | 'rsa';

/**
 * Access permission definition with role-based inheritance
 */
export interface AccessPermission {
  /**
   * Agent roles that have this permission
   */
  roles: AgentRole[];
  
  /**
   * Specific agent IDs (overrides role permissions)
   */
  agentIds?: string[];
  
  /**
   * Permission type
   */
  permission: Permission;
  
  /**
   * Optional conditions for conditional access
   */
  conditions?: AccessCondition[];
  
  /**
   * Expiration timestamp for temporary permissions
   */
  expiresAt?: number;
  
  /**
   * Permission metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Access condition for conditional permissions
 */
export interface AccessCondition {
  /**
   * Condition type
   */
  type: 'time_range' | 'context_state' | 'task_status' | 'agent_status' | 'custom';
  
  /**
   * Condition expression or value
   */
  expression: string | Record<string, unknown>;
  
  /**
   * Whether condition should evaluate to true or false
   */
  expectedValue: boolean;
}

/**
 * Context entry metadata for versioning and tracking
 */
export interface ContextMetadata {
  /**
   * Entry creation timestamp
   */
  createdAt: number;
  
  /**
   * Last modification timestamp
   */
  updatedAt: number;
  
  /**
   * Agent who created this entry
   */
  createdBy: string;
  
  /**
   * Agent who last modified this entry
   */
  lastModifiedBy: string;
  
  /**
   * Current version number
   */
  version: number;
  
  /**
   * Entry size in bytes
   */
  size: number;
  
  /**
   * Content hash for integrity verification
   */
  contentHash: string;
  
  /**
   * Compression applied to the data
   */
  compression?: CompressionType;
  
  /**
   * Encryption applied to the data
   */
  encryption?: EncryptionType;
  
  /**
   * Tags for categorization and search
   */
  tags: string[];
  
  /**
   * Custom metadata properties
   */
  properties: Record<string, unknown>;
}

/**
 * Context version information for change tracking
 */
export interface ContextVersion {
  /**
   * Version identifier
   */
  id: string;
  
  /**
   * Version number
   */
  number: number;
  
  /**
   * Parent version ID
   */
  parentId?: string;
  
  /**
   * Version timestamp
   */
  timestamp: number;
  
  /**
   * Agent who created this version
   */
  author: string;
  
  /**
   * Version commit message
   */
  message: string;
  
  /**
   * Changes made in this version
   */
  changes: ContextChange[];
  
  /**
   * Version metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Individual change in a context version
 */
export interface ContextChange {
  /**
   * Type of change
   */
  type: 'add' | 'modify' | 'delete' | 'move';
  
  /**
   * Path to the changed data
   */
  path: string;
  
  /**
   * Old value (for modify/delete operations)
   */
  oldValue?: unknown;
  
  /**
   * New value (for add/modify operations)
   */
  newValue?: unknown;
  
  /**
   * Change timestamp
   */
  timestamp: number;
}

/**
 * Context entry in the shared store
 */
export interface ContextEntry<T = unknown> {
  /**
   * Unique entry identifier
   */
  id: string;
  
  /**
   * Context scope and hierarchy
   */
  scope: ContextScope;
  
  /**
   * Full path in the context hierarchy
   */
  path: string;
  
  /**
   * Entry key/name
   */
  key: string;
  
  /**
   * Stored data value
   */
  value: T;
  
  /**
   * Data type information
   */
  dataType: ContextDataType;
  
  /**
   * Access permissions
   */
  permissions: AccessPermission[];
  
  /**
   * Entry metadata
   */
  metadata: ContextMetadata;
  
  /**
   * Version history
   */
  versions: ContextVersion[];
  
  /**
   * Current lock information (if locked)
   */
  lock?: ContextLock;
  
  /**
   * Related entries for dependency tracking
   */
  dependencies: string[];
  
  /**
   * Entry schema for validation
   */
  schema?: Record<string, unknown>;
}

/**
 * Context lock for exclusive access during modifications
 */
export interface ContextLock {
  /**
   * Lock identifier
   */
  id: string;
  
  /**
   * Agent holding the lock
   */
  agentId: string;
  
  /**
   * Lock type
   */
  type: 'read' | 'write' | 'exclusive';
  
  /**
   * When the lock was acquired
   */
  acquiredAt: number;
  
  /**
   * Lock expiration timestamp
   */
  expiresAt: number;
  
  /**
   * Lock timeout in milliseconds
   */
  timeout: number;
  
  /**
   * Lock metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Query parameters for context search and retrieval
 */
export interface ContextQuery {
  /**
   * Scope filter
   */
  scope?: ContextScope | ContextScope[];
  
  /**
   * Path pattern (supports wildcards)
   */
  pathPattern?: string;
  
  /**
   * Key pattern (supports wildcards)
   */
  keyPattern?: string;
  
  /**
   * Data type filter
   */
  dataType?: ContextDataType | ContextDataType[];
  
  /**
   * Tag filters
   */
  tags?: string[];
  
  /**
   * Created date range
   */
  createdAfter?: number;
  createdBefore?: number;
  
  /**
   * Modified date range
   */
  modifiedAfter?: number;
  modifiedBefore?: number;
  
  /**
   * Version range
   */
  minVersion?: number;
  maxVersion?: number;
  
  /**
   * Full-text search query
   */
  textSearch?: string;
  
  /**
   * Structured query for JSON data
   */
  structuredQuery?: Record<string, unknown>;
  
  /**
   * Result limit
   */
  limit?: number;
  
  /**
   * Result offset for pagination
   */
  offset?: number;
  
  /**
   * Sort criteria
   */
  sortBy?: 'created' | 'modified' | 'size' | 'version' | 'relevance';
  
  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
  
  /**
   * Include version history in results
   */
  includeVersions?: boolean;
  
  /**
   * Include metadata in results
   */
  includeMetadata?: boolean;
}

/**
 * Context query result set
 */
export interface ContextQueryResult<T = unknown> {
  /**
   * Matching entries
   */
  entries: ContextEntry<T>[];
  
  /**
   * Total number of matches (before limit/offset)
   */
  totalCount: number;
  
  /**
   * Query execution time in milliseconds
   */
  queryTime: number;
  
  /**
   * Whether results are from cache
   */
  fromCache: boolean;
  
  /**
   * Search relevance scores (if applicable)
   */
  relevanceScores?: Map<string, number>;
  
  /**
   * Query metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Context conflict information for resolution
 */
export interface ContextConflict {
  /**
   * Conflict identifier
   */
  id: string;
  
  /**
   * Context entry in conflict
   */
  entryId: string;
  
  /**
   * Conflicting versions
   */
  conflictingVersions: ContextVersion[];
  
  /**
   * Conflict type
   */
  type: 'concurrent_modification' | 'merge_conflict' | 'permission_conflict' | 'schema_conflict';
  
  /**
   * Conflict description
   */
  description: string;
  
  /**
   * Suggested resolution strategy
   */
  suggestedResolution: ConflictResolutionStrategy;
  
  /**
   * Automatic resolution possible
   */
  autoResolvable: boolean;
  
  /**
   * Conflict metadata
   */
  metadata: Record<string, unknown>;
  
  /**
   * When the conflict was detected
   */
  detectedAt: number;
}

/**
 * Audit log entry for context operations
 */
export interface ContextAuditEntry {
  /**
   * Audit entry identifier
   */
  id: string;
  
  /**
   * Operation performed
   */
  operation: ContextOperation;
  
  /**
   * Context entry affected
   */
  entryId: string;
  
  /**
   * Agent performing the operation
   */
  agentId: string;
  
  /**
   * Agent role at time of operation
   */
  agentRole: AgentRole;
  
  /**
   * Operation timestamp
   */
  timestamp: number;
  
  /**
   * Operation result
   */
  result: 'success' | 'failure' | 'partial';
  
  /**
   * Error message if operation failed
   */
  error?: string;
  
  /**
   * Operation details
   */
  details: {
    /**
     * Before state (for modifications)
     */
    before?: unknown;
    
    /**
     * After state (for modifications)
     */
    after?: unknown;
    
    /**
     * Operation parameters
     */
    parameters?: Record<string, unknown>;
  };
  
  /**
   * Request source information
   */
  source: {
    /**
     * IP address (if applicable)
     */
    ip?: string;
    
    /**
     * User agent or client identifier
     */
    userAgent?: string;
    
    /**
     * Session identifier
     */
    sessionId?: string;
  };
  
  /**
   * Audit metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Context store event for real-time notifications
 */
export interface ContextStoreEvent {
  /**
   * Event identifier
   */
  id: string;
  
  /**
   * Event type
   */
  type: ContextOperation | 'conflict_detected' | 'lock_acquired' | 'lock_released';
  
  /**
   * Context entry affected
   */
  entryId: string;
  
  /**
   * Entry path
   */
  path: string;
  
  /**
   * Agent triggering the event
   */
  agentId: string;
  
  /**
   * Event timestamp
   */
  timestamp: number;
  
  /**
   * Event payload
   */
  payload: Record<string, unknown>;
  
  /**
   * Event priority
   */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Storage backend configuration
 */
export interface StorageConfiguration {
  /**
   * Primary storage backend
   */
  primary: StorageBackend;
  
  /**
   * Backup storage backend
   */
  backup?: StorageBackend;
  
  /**
   * Cache configuration
   */
  cache: {
    /**
     * Enable caching
     */
    enabled: boolean;
    
    /**
     * Cache backend type
     */
    backend: 'memory' | 'redis';
    
    /**
     * Cache TTL in milliseconds
     */
    ttl: number;
    
    /**
     * Maximum cache size
     */
    maxSize: number;
    
    /**
     * Cache eviction policy
     */
    evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  };
  
  /**
   * Compression settings
   */
  compression: {
    /**
     * Default compression algorithm
     */
    algorithm: CompressionType;
    
    /**
     * Minimum size threshold for compression
     */
    threshold: number;
    
    /**
     * Compression level (algorithm-specific)
     */
    level?: number;
  };
  
  /**
   * Encryption settings
   */
  encryption: {
    /**
     * Default encryption algorithm
     */
    algorithm: EncryptionType;
    
    /**
     * Key management configuration
     */
    keyManagement: {
      /**
       * Key rotation interval in milliseconds
       */
      rotationInterval: number;
      
      /**
       * Key storage backend
       */
      keyStorage: 'memory' | 'file' | 'hsm' | 'kms';
    };
  };
  
  /**
   * Backup and recovery settings
   */
  backup: {
    /**
     * Enable automatic backups
     */
    enabled: boolean;
    
    /**
     * Backup interval in milliseconds
     */
    interval: number;
    
    /**
     * Number of backup versions to retain
     */
    retainCount: number;
    
    /**
     * Backup storage location
     */
    location: string;
  };
}

/**
 * Context store configuration
 */
export interface ContextStoreConfiguration {
  /**
   * Storage backend configuration
   */
  storage: StorageConfiguration;
  
  /**
   * Versioning settings
   */
  versioning: {
    /**
     * Enable versioning
     */
    enabled: boolean;
    
    /**
     * Maximum versions to keep per entry
     */
    maxVersions: number;
    
    /**
     * Version cleanup interval
     */
    cleanupInterval: number;
    
    /**
     * Enable automatic conflict detection
     */
    autoConflictDetection: boolean;
  };
  
  /**
   * Permission settings
   */
  permissions: {
    /**
     * Default permissions for new entries
     */
    defaultPermissions: AccessPermission[];
    
    /**
     * Enable permission inheritance
     */
    enableInheritance: boolean;
    
    /**
     * Permission cache TTL
     */
    cacheTtl: number;
  };
  
  /**
   * Locking configuration
   */
  locking: {
    /**
     * Default lock timeout in milliseconds
     */
    defaultTimeout: number;
    
    /**
     * Maximum lock timeout
     */
    maxTimeout: number;
    
    /**
     * Lock cleanup interval
     */
    cleanupInterval: number;
  };
  
  /**
   * Audit logging settings
   */
  audit: {
    /**
     * Enable audit logging
     */
    enabled: boolean;
    
    /**
     * Operations to audit
     */
    operations: ContextOperation[];
    
    /**
     * Audit log retention period
     */
    retentionPeriod: number;
    
    /**
     * Enable real-time audit notifications
     */
    realTimeNotifications: boolean;
  };
  
  /**
   * Performance optimization settings
   */
  performance: {
    /**
     * Maximum concurrent operations
     */
    maxConcurrentOperations: number;
    
    /**
     * Query timeout in milliseconds
     */
    queryTimeout: number;
    
    /**
     * Enable query optimization
     */
    enableQueryOptimization: boolean;
    
    /**
     * Index refresh interval
     */
    indexRefreshInterval: number;
  };
  
  /**
   * Real-time synchronization settings
   */
  realTimeSync: {
    /**
     * Enable real-time synchronization
     */
    enabled: boolean;
    
    /**
     * Sync interval in milliseconds
     */
    syncInterval: number;
    
    /**
     * Maximum sync batch size
     */
    maxBatchSize: number;
    
    /**
     * Conflict resolution strategy
     */
    conflictResolution: ConflictResolutionStrategy;
  };
}

/**
 * Context store statistics for monitoring
 */
export interface ContextStoreStatistics {
  /**
   * Total number of entries
   */
  totalEntries: number;
  
  /**
   * Entries by scope
   */
  entriesByScope: Record<ContextScope, number>;
  
  /**
   * Entries by data type
   */
  entriesByDataType: Record<ContextDataType, number>;
  
  /**
   * Storage usage statistics
   */
  storage: {
    /**
     * Total storage used in bytes
     */
    totalSize: number;
    
    /**
     * Storage by scope
     */
    sizeByScope: Record<ContextScope, number>;
    
    /**
     * Compression ratio achieved
     */
    compressionRatio: number;
    
    /**
     * Cache hit ratio
     */
    cacheHitRatio: number;
  };
  
  /**
   * Performance statistics
   */
  performance: {
    /**
     * Average query time in milliseconds
     */
    avgQueryTime: number;
    
    /**
     * Operations per second
     */
    operationsPerSecond: number;
    
    /**
     * Active locks count
     */
    activeLocks: number;
    
    /**
     * Pending conflicts count
     */
    pendingConflicts: number;
  };
  
  /**
   * Version statistics
   */
  versioning: {
    /**
     * Total versions across all entries
     */
    totalVersions: number;
    
    /**
     * Average versions per entry
     */
    avgVersionsPerEntry: number;
    
    /**
     * Conflicts resolved count
     */
    conflictsResolved: number;
  };
  
  /**
   * Audit statistics
   */
  audit: {
    /**
     * Total audit entries
     */
    totalAuditEntries: number;
    
    /**
     * Operations by type
     */
    operationsByType: Record<ContextOperation, number>;
    
    /**
     * Failed operations count
     */
    failedOperations: number;
  };
  
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Context store health check result
 */
export interface ContextStoreHealth {
  /**
   * Overall health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /**
   * Component health details
   */
  components: {
    /**
     * Storage backend health
     */
    storage: 'healthy' | 'degraded' | 'unhealthy';
    
    /**
     * Cache system health
     */
    cache: 'healthy' | 'degraded' | 'unhealthy';
    
    /**
     * Permission system health
     */
    permissions: 'healthy' | 'degraded' | 'unhealthy';
    
    /**
     * Versioning system health
     */
    versioning: 'healthy' | 'degraded' | 'unhealthy';
    
    /**
     * Audit system health
     */
    audit: 'healthy' | 'degraded' | 'unhealthy';
  };
  
  /**
   * Performance metrics
   */
  metrics: {
    /**
     * Response time in milliseconds
     */
    responseTime: number;
    
    /**
     * Error rate percentage
     */
    errorRate: number;
    
    /**
     * Resource utilization percentage
     */
    resourceUtilization: number;
  };
  
  /**
   * Health check recommendations
   */
  recommendations: string[];
  
  /**
   * Last health check timestamp
   */
  lastChecked: number;
}