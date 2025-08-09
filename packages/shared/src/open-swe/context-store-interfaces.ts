/**
 * Core interfaces for the Shared Context Store system
 * 
 * Defines the contracts for storage backends, permission management, 
 * versioning, and conflict resolution in multi-agent environments.
 */

import { Observable } from 'rxjs';
import {
  ContextEntry,
  ContextQuery,
  ContextQueryResult,
  ContextScope,
  ContextOperation,
  ContextConflict,
  ContextAuditEntry,
  ContextStoreEvent,
  ContextLock,
  ContextVersion,
  AccessPermission,
  Permission,
  ConflictResolutionStrategy,
  ContextStoreConfiguration,
  ContextStoreStatistics,
  ContextStoreHealth,
  StorageBackend,
  CompressionType,
  EncryptionType
} from './context-store-types.js';
import { AgentProfile, AgentRole } from './types.js';

/**
 * Result of context store operations
 */
export interface ContextStoreOperationResult<T = unknown> {
  /**
   * Operation success status
   */
  success: boolean;
  
  /**
   * Result data (if applicable)
   */
  data?: T;
  
  /**
   * Error message if operation failed
   */
  error?: string;
  
  /**
   * Operation execution time in milliseconds
   */
  executionTime: number;
  
  /**
   * Operation metadata
   */
  metadata?: Record<string, unknown>;
  
  /**
   * Warnings or informational messages
   */
  warnings?: string[];
}

/**
 * Storage backend interface for pluggable storage implementations
 */
export interface IContextStorageBackend {
  /**
   * Storage backend type identifier
   */
  readonly type: StorageBackend;
  
  /**
   * Initialize the storage backend
   */
  initialize(config: Record<string, unknown>): Promise<ContextStoreOperationResult>;
  
  /**
   * Store a context entry
   */
  store(entry: ContextEntry): Promise<ContextStoreOperationResult>;
  
  /**
   * Retrieve a context entry by ID
   */
  retrieve(id: string): Promise<ContextStoreOperationResult<ContextEntry>>;
  
  /**
   * Update an existing context entry
   */
  update(id: string, entry: Partial<ContextEntry>): Promise<ContextStoreOperationResult>;
  
  /**
   * Delete a context entry
   */
  delete(id: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Query context entries
   */
  query(query: ContextQuery): Promise<ContextStoreOperationResult<ContextQueryResult>>;
  
  /**
   * List all entry IDs (for maintenance operations)
   */
  listEntries(): Promise<ContextStoreOperationResult<string[]>>;
  
  /**
   * Check if an entry exists
   */
  exists(id: string): Promise<ContextStoreOperationResult<boolean>>;
  
  /**
   * Get storage statistics
   */
  getStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
  
  /**
   * Perform maintenance operations (cleanup, optimization, etc.)
   */
  maintenance(): Promise<ContextStoreOperationResult>;
  
  /**
   * Shut down the storage backend
   */
  shutdown(): Promise<ContextStoreOperationResult>;
  
  /**
   * Health check for the storage backend
   */
  healthCheck(): Promise<ContextStoreOperationResult<{ status: string; details: Record<string, unknown> }>>;
}

/**
 * Permission manager interface for role-based access control
 */
export interface IPermissionManager {
  /**
   * Check if an agent has a specific permission for a context entry
   */
  checkPermission(
    agentId: string, 
    entryId: string, 
    permission: Permission,
    context?: Record<string, unknown>
  ): Promise<boolean>;
  
  /**
   * Get all permissions for an agent on a context entry
   */
  getPermissions(agentId: string, entryId: string): Promise<Permission[]>;
  
  /**
   * Set permissions for a context entry
   */
  setPermissions(entryId: string, permissions: AccessPermission[]): Promise<ContextStoreOperationResult>;
  
  /**
   * Add a permission to a context entry
   */
  addPermission(entryId: string, permission: AccessPermission): Promise<ContextStoreOperationResult>;
  
  /**
   * Remove a permission from a context entry
   */
  removePermission(entryId: string, permissionId: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Get effective permissions considering role inheritance
   */
  getEffectivePermissions(agentProfile: AgentProfile, entryId: string): Promise<Permission[]>;
  
  /**
   * Validate permission configuration
   */
  validatePermissions(permissions: AccessPermission[]): ContextStoreOperationResult<boolean>;
  
  /**
   * Cache permission results for performance
   */
  cachePermission(agentId: string, entryId: string, permission: Permission, result: boolean): void;
  
  /**
   * Clear permission cache
   */
  clearCache(agentId?: string, entryId?: string): void;
}

/**
 * Version manager interface for change tracking and history
 */
export interface IVersionManager {
  /**
   * Create a new version of a context entry
   */
  createVersion(
    entryId: string, 
    changes: Record<string, unknown>, 
    message: string, 
    authorId: string
  ): Promise<ContextStoreOperationResult<ContextVersion>>;
  
  /**
   * Get version history for a context entry
   */
  getVersionHistory(entryId: string, limit?: number): Promise<ContextStoreOperationResult<ContextVersion[]>>;
  
  /**
   * Get a specific version of a context entry
   */
  getVersion(entryId: string, versionId: string): Promise<ContextStoreOperationResult<ContextVersion>>;
  
  /**
   * Compare two versions of a context entry
   */
  compareVersions(
    entryId: string, 
    version1: string, 
    version2: string
  ): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
  
  /**
   * Revert to a previous version
   */
  revertToVersion(
    entryId: string, 
    versionId: string, 
    authorId: string
  ): Promise<ContextStoreOperationResult>;
  
  /**
   * Merge two versions (for conflict resolution)
   */
  mergeVersions(
    entryId: string,
    baseVersionId: string,
    version1Id: string,
    version2Id: string,
    strategy: ConflictResolutionStrategy
  ): Promise<ContextStoreOperationResult<ContextVersion>>;
  
  /**
   * Clean up old versions based on retention policy
   */
  cleanupVersions(entryId: string, keepCount: number): Promise<ContextStoreOperationResult>;
  
  /**
   * Get version statistics
   */
  getVersionStatistics(entryId?: string): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
}

/**
 * Conflict resolver interface for handling concurrent modifications
 */
export interface IConflictResolver {
  /**
   * Detect conflicts between concurrent modifications
   */
  detectConflicts(entryId: string): Promise<ContextStoreOperationResult<ContextConflict[]>>;
  
  /**
   * Resolve a specific conflict
   */
  resolveConflict(
    conflictId: string, 
    strategy: ConflictResolutionStrategy,
    resolverAgentId: string
  ): Promise<ContextStoreOperationResult>;
  
  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): Promise<ContextStoreOperationResult<ContextConflict[]>>;
  
  /**
   * Auto-resolve conflicts that can be safely merged
   */
  autoResolveConflicts(): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Register a custom conflict resolution handler
   */
  registerHandler(
    conflictType: string,
    handler: (conflict: ContextConflict) => Promise<ContextStoreOperationResult>
  ): void;
  
  /**
   * Analyze conflict resolution patterns for optimization
   */
  analyzeConflictPatterns(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
}

/**
 * Lock manager interface for coordinated access control
 */
export interface ILockManager {
  /**
   * Acquire a lock on a context entry
   */
  acquireLock(
    entryId: string, 
    agentId: string, 
    lockType: 'read' | 'write' | 'exclusive',
    timeout?: number
  ): Promise<ContextStoreOperationResult<ContextLock>>;
  
  /**
   * Release a lock
   */
  releaseLock(lockId: string, agentId: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Check if an entry is locked
   */
  isLocked(entryId: string): Promise<ContextStoreOperationResult<boolean>>;
  
  /**
   * Get lock information for an entry
   */
  getLockInfo(entryId: string): Promise<ContextStoreOperationResult<ContextLock>>;
  
  /**
   * List all locks held by an agent
   */
  getAgentLocks(agentId: string): Promise<ContextStoreOperationResult<ContextLock[]>>;
  
  /**
   * Force release expired locks
   */
  cleanupExpiredLocks(): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Extend lock timeout
   */
  extendLock(lockId: string, agentId: string, extension: number): Promise<ContextStoreOperationResult>;
  
  /**
   * Get lock statistics
   */
  getLockStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
}

/**
 * Audit logger interface for compliance and monitoring
 */
export interface IAuditLogger {
  /**
   * Log a context operation
   */
  logOperation(
    operation: ContextOperation,
    entryId: string,
    agentId: string,
    details: Record<string, unknown>,
    result: 'success' | 'failure' | 'partial'
  ): Promise<ContextStoreOperationResult>;
  
  /**
   * Query audit logs
   */
  queryAuditLogs(
    entryId?: string,
    agentId?: string,
    operation?: ContextOperation,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<ContextStoreOperationResult<ContextAuditEntry[]>>;
  
  /**
   * Get audit statistics
   */
  getAuditStatistics(
    startTime?: number,
    endTime?: number
  ): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
  
  /**
   * Archive old audit logs
   */
  archiveAuditLogs(beforeDate: number): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Export audit logs for compliance
   */
  exportAuditLogs(
    format: 'json' | 'csv' | 'xml',
    filter?: Record<string, unknown>
  ): Promise<ContextStoreOperationResult<string>>;
  
  /**
   * Validate audit log integrity
   */
  validateIntegrity(): Promise<ContextStoreOperationResult<boolean>>;
}

/**
 * Encryption manager interface for data security
 */
export interface IEncryptionManager {
  /**
   * Encrypt data using specified algorithm
   */
  encrypt(
    data: Buffer | string, 
    algorithm: EncryptionType,
    keyId?: string
  ): Promise<ContextStoreOperationResult<{ encrypted: Buffer; metadata: Record<string, unknown> }>>;
  
  /**
   * Decrypt data
   */
  decrypt(
    encryptedData: Buffer, 
    metadata: Record<string, unknown>
  ): Promise<ContextStoreOperationResult<Buffer>>;
  
  /**
   * Generate a new encryption key
   */
  generateKey(algorithm: EncryptionType): Promise<ContextStoreOperationResult<string>>;
  
  /**
   * Rotate encryption keys
   */
  rotateKeys(): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Get encryption statistics
   */
  getEncryptionStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
  
  /**
   * Validate encryption configuration
   */
  validateConfiguration(): ContextStoreOperationResult<boolean>;
}

/**
 * Compression manager interface for data optimization
 */
export interface ICompressionManager {
  /**
   * Compress data using specified algorithm
   */
  compress(
    data: Buffer | string,
    algorithm: CompressionType,
    level?: number
  ): Promise<ContextStoreOperationResult<{ compressed: Buffer; metadata: Record<string, unknown> }>>;
  
  /**
   * Decompress data
   */
  decompress(
    compressedData: Buffer,
    metadata: Record<string, unknown>
  ): Promise<ContextStoreOperationResult<Buffer>>;
  
  /**
   * Analyze compression effectiveness
   */
  analyzeCompression(data: Buffer | string): Promise<ContextStoreOperationResult<Record<string, number>>>;
  
  /**
   * Get compression statistics
   */
  getCompressionStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
}

/**
 * Cache manager interface for performance optimization
 */
export interface ICacheManager {
  /**
   * Store data in cache
   */
  set(key: string, value: unknown, ttl?: number): Promise<ContextStoreOperationResult>;
  
  /**
   * Retrieve data from cache
   */
  get<T = unknown>(key: string): Promise<ContextStoreOperationResult<T>>;
  
  /**
   * Remove data from cache
   */
  delete(key: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Check if key exists in cache
   */
  exists(key: string): Promise<ContextStoreOperationResult<boolean>>;
  
  /**
   * Clear all cache or entries matching pattern
   */
  clear(pattern?: string): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Get cache statistics
   */
  getStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
  
  /**
   * Invalidate cache entries for an entry
   */
  invalidateEntry(entryId: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Preload frequently accessed entries
   */
  preload(entryIds: string[]): Promise<ContextStoreOperationResult<number>>;
}

/**
 * Event manager interface for real-time notifications
 */
export interface IEventManager {
  /**
   * Emit a context store event
   */
  emit(event: ContextStoreEvent): Promise<ContextStoreOperationResult>;
  
  /**
   * Subscribe to context store events
   */
  subscribe(
    agentId: string,
    eventTypes?: string[],
    entryFilter?: string | RegExp
  ): Observable<ContextStoreEvent>;
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(agentId: string, subscriptionId?: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Get active subscriptions
   */
  getSubscriptions(agentId?: string): Promise<ContextStoreOperationResult<Record<string, unknown>[]>>;
  
  /**
   * Broadcast event to multiple subscribers
   */
  broadcast(event: ContextStoreEvent, targetAgents?: string[]): Promise<ContextStoreOperationResult>;
  
  /**
   * Get event statistics
   */
  getEventStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
}

/**
 * Index manager interface for efficient querying
 */
export interface IIndexManager {
  /**
   * Create an index on specific fields
   */
  createIndex(
    name: string,
    fields: string[],
    options?: Record<string, unknown>
  ): Promise<ContextStoreOperationResult>;
  
  /**
   * Drop an index
   */
  dropIndex(name: string): Promise<ContextStoreOperationResult>;
  
  /**
   * List all indexes
   */
  listIndexes(): Promise<ContextStoreOperationResult<Record<string, unknown>[]>>;
  
  /**
   * Rebuild indexes for optimization
   */
  rebuildIndexes(): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Get index statistics and usage
   */
  getIndexStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
  
  /**
   * Analyze query performance and suggest indexes
   */
  analyzeQueries(): Promise<ContextStoreOperationResult<Record<string, unknown>>>;
}

/**
 * Main shared context store interface
 */
export interface ISharedContextStore {
  /**
   * Store configuration
   */
  readonly configuration: ContextStoreConfiguration;
  
  /**
   * Storage backend
   */
  readonly storage: IContextStorageBackend;
  
  /**
   * Permission manager
   */
  readonly permissions: IPermissionManager;
  
  /**
   * Version manager
   */
  readonly versions: IVersionManager;
  
  /**
   * Conflict resolver
   */
  readonly conflicts: IConflictResolver;
  
  /**
   * Lock manager
   */
  readonly locks: ILockManager;
  
  /**
   * Audit logger
   */
  readonly audit: IAuditLogger;
  
  /**
   * Event manager
   */
  readonly events: IEventManager;
  
  /**
   * Cache manager
   */
  readonly cache: ICacheManager;
  
  /**
   * Index manager
   */
  readonly indexes: IIndexManager;
  
  /**
   * Initialize the context store
   */
  initialize(): Promise<ContextStoreOperationResult>;
  
  /**
   * Store a value in the context
   */
  set<T = unknown>(
    scope: ContextScope,
    path: string,
    key: string,
    value: T,
    permissions?: AccessPermission[],
    metadata?: Record<string, unknown>
  ): Promise<ContextStoreOperationResult<string>>;
  
  /**
   * Retrieve a value from the context
   */
  get<T = unknown>(
    entryId: string,
    agentId: string
  ): Promise<ContextStoreOperationResult<T>>;
  
  /**
   * Update an existing context entry
   */
  update<T = unknown>(
    entryId: string,
    value: T,
    agentId: string,
    message?: string
  ): Promise<ContextStoreOperationResult>;
  
  /**
   * Delete a context entry
   */
  delete(entryId: string, agentId: string): Promise<ContextStoreOperationResult>;
  
  /**
   * Query context entries
   */
  query<T = unknown>(
    query: ContextQuery,
    agentId: string
  ): Promise<ContextStoreOperationResult<ContextQueryResult<T>>>;
  
  /**
   * Subscribe to real-time context changes
   */
  subscribe(
    agentId: string,
    pathPattern?: string,
    eventTypes?: string[]
  ): Observable<ContextStoreEvent>;
  
  /**
   * Create a hierarchical path
   */
  createPath(scope: ContextScope, ...segments: string[]): string;
  
  /**
   * List entries at a specific path
   */
  listPath(path: string, agentId: string): Promise<ContextStoreOperationResult<string[]>>;
  
  /**
   * Check if a path exists
   */
  pathExists(path: string, agentId: string): Promise<ContextStoreOperationResult<boolean>>;
  
  /**
   * Get context store statistics
   */
  getStatistics(): Promise<ContextStoreOperationResult<ContextStoreStatistics>>;
  
  /**
   * Perform health check
   */
  healthCheck(): Promise<ContextStoreOperationResult<ContextStoreHealth>>;
  
  /**
   * Perform maintenance operations
   */
  maintenance(): Promise<ContextStoreOperationResult>;
  
  /**
   * Export context data
   */
  export(
    format: 'json' | 'xml',
    filter?: ContextQuery
  ): Promise<ContextStoreOperationResult<string>>;
  
  /**
   * Import context data
   */
  import(
    data: string,
    format: 'json' | 'xml',
    agentId: string
  ): Promise<ContextStoreOperationResult<number>>;
  
  /**
   * Shutdown the context store
   */
  shutdown(): Promise<ContextStoreOperationResult>;
}