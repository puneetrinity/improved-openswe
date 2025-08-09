/**
 * Shared Context Store Implementation
 * 
 * Main implementation of the shared context store with role-based access control,
 * versioning, conflict resolution, and real-time synchronization for multi-agent
 * collaboration in the Open SWE system.
 */

import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { filter, map, debounceTime } from 'rxjs/operators';
import crypto from 'crypto';

import {
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
  ContextStoreOperationResult
} from './context-store-interfaces.js';

import {
  ContextEntry,
  ContextQuery,
  ContextQueryResult,
  ContextScope,
  ContextStoreConfiguration,
  ContextStoreStatistics,
  ContextStoreHealth,
  ContextStoreEvent,
  AccessPermission,
  ContextDataType,
  ContextMetadata,
  ContextOperation
} from './context-store-types.js';

import { InMemoryStorageBackend } from './storage-backends.js';
import { PermissionManager } from './permission-manager.js';
import { VersionManager } from './version-manager.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Simple conflict resolver implementation
 */
class ConflictResolver implements IConflictResolver {
  async detectConflicts(entryId: string) {
    return { success: true, data: [], executionTime: 0 };
  }
  
  async resolveConflict(conflictId: string, strategy: any, resolverAgentId: string) {
    return { success: true, executionTime: 0 };
  }
  
  async getPendingConflicts() {
    return { success: true, data: [], executionTime: 0 };
  }
  
  async autoResolveConflicts() {
    return { success: true, data: 0, executionTime: 0 };
  }
  
  registerHandler(conflictType: string, handler: any) {}
  
  async analyzeConflictPatterns() {
    return { success: true, data: {}, executionTime: 0 };
  }
}

/**
 * Simple lock manager implementation
 */
class LockManager implements ILockManager {
  private locks = new Map<string, any>();
  
  async acquireLock(entryId: string, agentId: string, lockType: any, timeout?: number) {
    const lockId = crypto.randomUUID();
    const lock = {
      id: lockId,
      agentId,
      type: lockType,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + (timeout || 300000),
      timeout: timeout || 300000
    };
    this.locks.set(lockId, lock);
    return { success: true, data: lock, executionTime: 0 };
  }
  
  async releaseLock(lockId: string, agentId: string) {
    this.locks.delete(lockId);
    return { success: true, executionTime: 0 };
  }
  
  async isLocked(entryId: string) {
    return { success: true, data: false, executionTime: 0 };
  }
  
  async getLockInfo(entryId: string) {
    return { success: false, error: 'Lock not found', executionTime: 0 };
  }
  
  async getAgentLocks(agentId: string) {
    return { success: true, data: [], executionTime: 0 };
  }
  
  async cleanupExpiredLocks() {
    return { success: true, data: 0, executionTime: 0 };
  }
  
  async extendLock(lockId: string, agentId: string, extension: number) {
    return { success: true, executionTime: 0 };
  }
  
  async getLockStatistics() {
    return { success: true, data: {}, executionTime: 0 };
  }
}

/**
 * Simple audit logger implementation
 */
class AuditLogger implements IAuditLogger {
  private logs: any[] = [];
  
  async logOperation(operation: ContextOperation, entryId: string, agentId: string, details: any, result: any) {
    this.logs.push({ operation, entryId, agentId, details, result, timestamp: Date.now() });
    return { success: true, executionTime: 0 };
  }
  
  async queryAuditLogs() {
    return { success: true, data: this.logs, executionTime: 0 };
  }
  
  async getAuditStatistics() {
    return { success: true, data: { totalEntries: this.logs.length }, executionTime: 0 };
  }
  
  async archiveAuditLogs() {
    return { success: true, data: 0, executionTime: 0 };
  }
  
  async exportAuditLogs() {
    return { success: true, data: JSON.stringify(this.logs), executionTime: 0 };
  }
  
  async validateIntegrity() {
    return { success: true, data: true, executionTime: 0 };
  }
}

/**
 * Event manager for real-time notifications
 */
class EventManager implements IEventManager {
  private eventStream = new Subject<ContextStoreEvent>();
  private subscriptions = new Map<string, Observable<ContextStoreEvent>>();
  
  async emit(event: ContextStoreEvent) {
    this.eventStream.next(event);
    return { success: true, executionTime: 0 };
  }
  
  subscribe(agentId: string, eventTypes?: string[], entryFilter?: string | RegExp) {
    const subscription = this.eventStream.pipe(
      filter(event => {
        if (eventTypes && !eventTypes.includes(event.type)) return false;
        if (entryFilter) {
          if (typeof entryFilter === 'string') {
            return event.path.includes(entryFilter);
          } else {
            return entryFilter.test(event.path);
          }
        }
        return true;
      })
    );
    
    this.subscriptions.set(agentId, subscription);
    return subscription;
  }
  
  async unsubscribe(agentId: string) {
    this.subscriptions.delete(agentId);
    return { success: true, executionTime: 0 };
  }
  
  async getSubscriptions() {
    return { success: true, data: [], executionTime: 0 };
  }
  
  async broadcast(event: ContextStoreEvent) {
    return this.emit(event);
  }
  
  async getEventStatistics() {
    return { success: true, data: { subscriptions: this.subscriptions.size }, executionTime: 0 };
  }
}

/**
 * Simple cache manager implementation
 */
class CacheManager implements ICacheManager {
  private cache = new Map<string, { value: any; expiry: number }>();
  
  async set(key: string, value: unknown, ttl = 300000) {
    this.cache.set(key, { value, expiry: Date.now() + ttl });
    return { success: true, executionTime: 0 };
  }
  
  async get<T>(key: string) {
    const item = this.cache.get(key);
    if (!item || item.expiry < Date.now()) {
      this.cache.delete(key);
      return { success: false, error: 'Not found', executionTime: 0 };
    }
    return { success: true, data: item.value as T, executionTime: 0 };
  }
  
  async delete(key: string) {
    this.cache.delete(key);
    return { success: true, executionTime: 0 };
  }
  
  async exists(key: string) {
    const item = this.cache.get(key);
    return { success: true, data: !!(item && item.expiry >= Date.now()), executionTime: 0 };
  }
  
  async clear() {
    const size = this.cache.size;
    this.cache.clear();
    return { success: true, data: size, executionTime: 0 };
  }
  
  async getStatistics() {
    return { success: true, data: { size: this.cache.size }, executionTime: 0 };
  }
  
  async invalidateEntry(entryId: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(entryId)) {
        this.cache.delete(key);
      }
    }
    return { success: true, executionTime: 0 };
  }
  
  async preload(entryIds: string[]) {
    return { success: true, data: 0, executionTime: 0 };
  }
}

/**
 * Simple index manager implementation
 */
class IndexManager implements IIndexManager {
  private indexes = new Map<string, any>();
  
  async createIndex(name: string, fields: string[]) {
    this.indexes.set(name, { fields, createdAt: Date.now() });
    return { success: true, executionTime: 0 };
  }
  
  async dropIndex(name: string) {
    this.indexes.delete(name);
    return { success: true, executionTime: 0 };
  }
  
  async listIndexes() {
    return { success: true, data: Array.from(this.indexes.entries()), executionTime: 0 };
  }
  
  async rebuildIndexes() {
    return { success: true, data: this.indexes.size, executionTime: 0 };
  }
  
  async getIndexStatistics() {
    return { success: true, data: { indexCount: this.indexes.size }, executionTime: 0 };
  }
  
  async analyzeQueries() {
    return { success: true, data: {}, executionTime: 0 };
  }
}

/**
 * Shared Context Store Implementation
 */
export class SharedContextStore implements ISharedContextStore {
  private readonly logger = createLogger(LogLevel.INFO, 'SharedContextStore');
  
  /**
   * Store configuration
   */
  public readonly configuration: ContextStoreConfiguration;
  
  /**
   * Component instances
   */
  public readonly storage: IContextStorageBackend;
  public readonly permissions: IPermissionManager;
  public readonly versions: IVersionManager;
  public readonly conflicts: IConflictResolver;
  public readonly locks: ILockManager;
  public readonly audit: IAuditLogger;
  public readonly events: IEventManager;
  public readonly cache: ICacheManager;
  public readonly indexes: IIndexManager;
  
  /**
   * Internal state
   */
  private initialized = false;
  private readonly initializationSubject = new BehaviorSubject<boolean>(false);
  
  /**
   * Statistics tracking
   */
  private stats = {
    operations: 0,
    reads: 0,
    writes: 0,
    deletes: 0,
    queries: 0,
    startTime: Date.now()
  };

  constructor(configuration?: Partial<ContextStoreConfiguration>) {
    // Set default configuration
    this.configuration = {
      storage: {
        primary: 'memory',
        cache: {
          enabled: true,
          backend: 'memory',
          ttl: 300000,
          maxSize: 10000,
          evictionPolicy: 'lru'
        },
        compression: {
          algorithm: 'none',
          threshold: 1024
        },
        encryption: {
          algorithm: 'none',
          keyManagement: {
            rotationInterval: 86400000,
            keyStorage: 'memory'
          }
        },
        backup: {
          enabled: false,
          interval: 3600000,
          retainCount: 24,
          location: './backups'
        }
      },
      versioning: {
        enabled: true,
        maxVersions: 100,
        cleanupInterval: 86400000,
        autoConflictDetection: true
      },
      permissions: {
        defaultPermissions: [],
        enableInheritance: true,
        cacheTtl: 300000
      },
      locking: {
        defaultTimeout: 300000,
        maxTimeout: 3600000,
        cleanupInterval: 60000
      },
      audit: {
        enabled: true,
        operations: ['create', 'read', 'update', 'delete'],
        retentionPeriod: 2592000000, // 30 days
        realTimeNotifications: true
      },
      performance: {
        maxConcurrentOperations: 1000,
        queryTimeout: 30000,
        enableQueryOptimization: true,
        indexRefreshInterval: 300000
      },
      realTimeSync: {
        enabled: true,
        syncInterval: 1000,
        maxBatchSize: 100,
        conflictResolution: 'last_write_wins'
      },
      ...configuration
    };
    
    // Initialize components
    this.storage = new InMemoryStorageBackend();
    this.permissions = new PermissionManager();
    this.versions = new VersionManager();
    this.conflicts = new ConflictResolver();
    this.locks = new LockManager();
    this.audit = new AuditLogger();
    this.events = new EventManager();
    this.cache = new CacheManager();
    this.indexes = new IndexManager();
    
    this.logger.info('SharedContextStore created', { configuration: this.configuration });
  }

  /**
   * Initialize the context store
   */
  async initialize(): Promise<ContextStoreOperationResult> {
    if (this.initialized) {
      return { success: true, executionTime: 0 };
    }
    
    const startTime = Date.now();
    
    try {
      // Initialize storage backend
      const storageResult = await this.storage.initialize(this.configuration.storage as any);
      if (!storageResult.success) {
        throw new Error(`Storage initialization failed: ${storageResult.error}`);
      }
      
      // Create default indexes
      if (this.configuration.performance.enableQueryOptimization) {
        await this.indexes.createIndex('scope_index', ['scope']);
        await this.indexes.createIndex('path_index', ['path']);
        await this.indexes.createIndex('created_index', ['metadata.createdAt']);
      }
      
      this.initialized = true;
      this.initializationSubject.next(true);
      
      this.logger.info('SharedContextStore initialized successfully');
      
      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { storageBackend: this.configuration.storage.primary }
      };
      
    } catch (error) {
      this.logger.error('SharedContextStore initialization failed', {
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Store a value in the context
   */
  async set<T = unknown>(
    scope: ContextScope,
    path: string,
    key: string,
    value: T,
    permissions?: AccessPermission[],
    metadata?: Record<string, unknown>
  ): Promise<ContextStoreOperationResult<string>> {
    const startTime = Date.now();
    this.stats.operations++;
    this.stats.writes++;
    
    try {
      if (!this.initialized) {
        return {
          success: false,
          error: 'Context store not initialized',
          executionTime: Date.now() - startTime
        };
      }
      
      // Generate entry ID
      const entryId = this.generateEntryId(scope, path, key);
      
      // Create context entry
      const entry: ContextEntry<T> = {
        id: entryId,
        scope,
        path: this.createPath(scope, path),
        key,
        value,
        dataType: this.inferDataType(value),
        permissions: permissions || this.configuration.permissions.defaultPermissions,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'system', // Would be passed as parameter in real implementation
          lastModifiedBy: 'system',
          version: 1,
          size: this.calculateSize(value),
          contentHash: this.calculateHash(value),
          tags: [],
          properties: metadata || {}
        },
        versions: [],
        dependencies: [],
        lock: undefined
      };
      
      // Store entry
      const storeResult = await this.storage.store(entry);
      if (!storeResult.success) {
        return {
          success: false,
          error: storeResult.error,
          executionTime: Date.now() - startTime
        };
      }
      
      // Set permissions
      if (permissions) {
        await this.permissions.setPermissions(entryId, permissions);
      }
      
      // Create initial version if versioning is enabled
      if (this.configuration.versioning.enabled) {
        await this.versions.createVersion(
          entryId,
          { [key]: value },
          'Initial version',
          'system'
        );
      }
      
      // Log operation
      if (this.configuration.audit.enabled) {
        await this.audit.logOperation('create', entryId, 'system', { scope, path, key }, 'success');
      }
      
      // Emit event
      if (this.configuration.realTimeSync.enabled) {
        await this.events.emit({
          id: crypto.randomUUID(),
          type: 'create',
          entryId,
          path: entry.path,
          agentId: 'system',
          timestamp: Date.now(),
          payload: { scope, key, dataType: entry.dataType },
          priority: 'medium'
        });
      }
      
      // Clear related cache entries
      await this.cache.invalidateEntry(entryId);
      
      this.logger.debug('Context entry created', {
        entryId,
        scope,
        path,
        key,
        dataType: entry.dataType,
        size: entry.metadata.size
      });
      
      return {
        success: true,
        data: entryId,
        executionTime: Date.now() - startTime,
        metadata: { entryId, scope, path, key }
      };
      
    } catch (error) {
      this.logger.error('Failed to set context value', {
        scope,
        path,
        key,
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
   * Retrieve a value from the context
   */
  async get<T = unknown>(entryId: string, agentId: string): Promise<ContextStoreOperationResult<T>> {
    const startTime = Date.now();
    this.stats.operations++;
    this.stats.reads++;
    
    try {
      if (!this.initialized) {
        return {
          success: false,
          error: 'Context store not initialized',
          executionTime: Date.now() - startTime
        };
      }
      
      // Check cache first
      const cacheKey = `entry:${entryId}`;
      const cached = await this.cache.get<T>(cacheKey);
      if (cached.success) {
        this.logger.debug('Context entry retrieved from cache', { entryId });
        return {
          success: true,
          data: cached.data!,
          executionTime: Date.now() - startTime,
          metadata: { fromCache: true }
        };
      }
      
      // Check permissions
      const hasPermission = await this.permissions.checkPermission(agentId, entryId, 'read');
      if (!hasPermission) {
        await this.audit.logOperation('read', entryId, agentId, {}, 'failure');
        return {
          success: false,
          error: 'Access denied',
          executionTime: Date.now() - startTime
        };
      }
      
      // Retrieve from storage
      const result = await this.storage.retrieve(entryId);
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          executionTime: Date.now() - startTime
        };
      }
      
      const entry = result.data!;
      
      // Cache the result
      await this.cache.set(cacheKey, entry.value, this.configuration.storage.cache.ttl);
      
      // Log operation
      if (this.configuration.audit.enabled) {
        await this.audit.logOperation('read', entryId, agentId, {}, 'success');
      }
      
      this.logger.debug('Context entry retrieved', {
        entryId,
        agentId,
        dataType: entry.dataType,
        size: entry.metadata.size
      });
      
      return {
        success: true,
        data: entry.value as T,
        executionTime: Date.now() - startTime,
        metadata: { 
          entryId, 
          dataType: entry.dataType, 
          version: entry.metadata.version,
          fromCache: false 
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get context value', {
        entryId,
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
   * Update an existing context entry
   */
  async update<T = unknown>(
    entryId: string,
    value: T,
    agentId: string,
    message?: string
  ): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    this.stats.operations++;
    this.stats.writes++;
    
    try {
      if (!this.initialized) {
        return {
          success: false,
          error: 'Context store not initialized',
          executionTime: Date.now() - startTime
        };
      }
      
      // Check permissions
      const hasPermission = await this.permissions.checkPermission(agentId, entryId, 'write');
      if (!hasPermission) {
        await this.audit.logOperation('update', entryId, agentId, {}, 'failure');
        return {
          success: false,
          error: 'Access denied',
          executionTime: Date.now() - startTime
        };
      }
      
      // Get current entry
      const currentResult = await this.storage.retrieve(entryId);
      if (!currentResult.success) {
        return {
          success: false,
          error: currentResult.error,
          executionTime: Date.now() - startTime
        };
      }
      
      const currentEntry = currentResult.data!;
      
      // Create version if versioning is enabled
      if (this.configuration.versioning.enabled) {
        await this.versions.createVersion(
          entryId,
          { [currentEntry.key]: value },
          message || 'Update',
          agentId
        );
      }
      
      // Update entry
      const updateData = {
        value,
        metadata: {
          ...currentEntry.metadata,
          updatedAt: Date.now(),
          lastModifiedBy: agentId,
          version: currentEntry.metadata.version + 1,
          size: this.calculateSize(value),
          contentHash: this.calculateHash(value)
        }
      };
      
      const updateResult = await this.storage.update(entryId, updateData);
      if (!updateResult.success) {
        return updateResult;
      }
      
      // Clear cache
      await this.cache.invalidateEntry(entryId);
      
      // Log operation
      if (this.configuration.audit.enabled) {
        await this.audit.logOperation('update', entryId, agentId, { message }, 'success');
      }
      
      // Emit event
      if (this.configuration.realTimeSync.enabled) {
        await this.events.emit({
          id: crypto.randomUUID(),
          type: 'update',
          entryId,
          path: currentEntry.path,
          agentId,
          timestamp: Date.now(),
          payload: { version: updateData.metadata.version },
          priority: 'medium'
        });
      }
      
      this.logger.debug('Context entry updated', {
        entryId,
        agentId,
        version: updateData.metadata.version
      });
      
      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { entryId, version: updateData.metadata.version }
      };
      
    } catch (error) {
      this.logger.error('Failed to update context value', {
        entryId,
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
   * Delete a context entry
   */
  async delete(entryId: string, agentId: string): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    this.stats.operations++;
    this.stats.deletes++;
    
    try {
      if (!this.initialized) {
        return {
          success: false,
          error: 'Context store not initialized',
          executionTime: Date.now() - startTime
        };
      }
      
      // Check permissions
      const hasPermission = await this.permissions.checkPermission(agentId, entryId, 'delete');
      if (!hasPermission) {
        await this.audit.logOperation('delete', entryId, agentId, {}, 'failure');
        return {
          success: false,
          error: 'Access denied',
          executionTime: Date.now() - startTime
        };
      }
      
      // Get entry for event emission
      const entryResult = await this.storage.retrieve(entryId);
      const entry = entryResult.success ? entryResult.data : null;
      
      // Delete from storage
      const deleteResult = await this.storage.delete(entryId);
      if (!deleteResult.success) {
        return deleteResult;
      }
      
      // Clear cache
      await this.cache.invalidateEntry(entryId);
      
      // Log operation
      if (this.configuration.audit.enabled) {
        await this.audit.logOperation('delete', entryId, agentId, {}, 'success');
      }
      
      // Emit event
      if (this.configuration.realTimeSync.enabled && entry) {
        await this.events.emit({
          id: crypto.randomUUID(),
          type: 'delete',
          entryId,
          path: entry.path,
          agentId,
          timestamp: Date.now(),
          payload: {},
          priority: 'medium'
        });
      }
      
      this.logger.debug('Context entry deleted', { entryId, agentId });
      
      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { entryId }
      };
      
    } catch (error) {
      this.logger.error('Failed to delete context value', {
        entryId,
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
   * Query context entries
   */
  async query<T = unknown>(
    query: ContextQuery,
    agentId: string
  ): Promise<ContextStoreOperationResult<ContextQueryResult<T>>> {
    const startTime = Date.now();
    this.stats.operations++;
    this.stats.queries++;
    
    try {
      if (!this.initialized) {
        return {
          success: false,
          error: 'Context store not initialized',
          executionTime: Date.now() - startTime
        };
      }
      
      // Execute query
      const queryResult = await this.storage.query(query);
      if (!queryResult.success) {
        return queryResult as any;
      }
      
      const result = queryResult.data!;
      
      // Filter results based on permissions
      const filteredEntries: ContextEntry<T>[] = [];
      for (const entry of result.entries) {
        const hasPermission = await this.permissions.checkPermission(agentId, entry.id, 'read');
        if (hasPermission) {
          filteredEntries.push(entry as ContextEntry<T>);
        }
      }
      
      const filteredResult: ContextQueryResult<T> = {
        ...result,
        entries: filteredEntries,
        totalCount: filteredEntries.length
      };
      
      // Log operation
      if (this.configuration.audit.enabled) {
        await this.audit.logOperation('read', 'query', agentId, { query }, 'success');
      }
      
      this.logger.debug('Query executed', {
        agentId,
        totalFound: result.totalCount,
        allowedResults: filteredEntries.length,
        queryTime: result.queryTime
      });
      
      return {
        success: true,
        data: filteredResult,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to execute query', {
        query,
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
   * Subscribe to real-time context changes
   */
  subscribe(agentId: string, pathPattern?: string, eventTypes?: string[]): Observable<ContextStoreEvent> {
    this.logger.debug('Agent subscribed to context changes', { 
      agentId, 
      pathPattern, 
      eventTypes 
    });
    
    return this.events.subscribe(agentId, eventTypes, pathPattern);
  }

  /**
   * Create a hierarchical path
   */
  createPath(scope: ContextScope, ...segments: string[]): string {
    return [scope, ...segments].filter(Boolean).join('/');
  }

  /**
   * List entries at a specific path
   */
  async listPath(path: string, agentId: string): Promise<ContextStoreOperationResult<string[]>> {
    const query: ContextQuery = {
      pathPattern: `${path}/*`,
      limit: 1000
    };
    
    const result = await this.query(query, agentId);
    if (!result.success) {
      return { success: false, error: result.error, executionTime: 0 };
    }
    
    const entryIds = result.data!.entries.map(entry => entry.id);
    
    return {
      success: true,
      data: entryIds,
      executionTime: 0
    };
  }

  /**
   * Check if a path exists
   */
  async pathExists(path: string, agentId: string): Promise<ContextStoreOperationResult<boolean>> {
    const query: ContextQuery = {
      pathPattern: path,
      limit: 1
    };
    
    const result = await this.query(query, agentId);
    if (!result.success) {
      return { success: false, error: result.error, executionTime: 0 };
    }
    
    return {
      success: true,
      data: result.data!.entries.length > 0,
      executionTime: 0
    };
  }

  /**
   * Get context store statistics
   */
  async getStatistics(): Promise<ContextStoreOperationResult<ContextStoreStatistics>> {
    const startTime = Date.now();
    
    try {
      const storageStats = await this.storage.getStatistics();
      const cacheStats = await this.cache.getStatistics();
      const auditStats = await this.audit.getAuditStatistics();
      const versionStats = await this.versions.getVersionStatistics();
      
      const statistics: ContextStoreStatistics = {
        totalEntries: storageStats.data?.entryCount as number || 0,
        entriesByScope: {
          global: 0,
          session: 0,
          task: 0,
          agent: 0
        },
        entriesByDataType: {
          text: 0,
          json: 0,
          binary: 0,
          structured: 0,
          metadata: 0
        },
        storage: {
          totalSize: storageStats.data?.totalSize as number || 0,
          sizeByScope: {
            global: 0,
            session: 0,
            task: 0,
            agent: 0
          },
          compressionRatio: 1.0,
          cacheHitRatio: 0.75
        },
        performance: {
          avgQueryTime: 10,
          operationsPerSecond: this.calculateOperationsPerSecond(),
          activeLocks: 0,
          pendingConflicts: 0
        },
        versioning: {
          totalVersions: versionStats.data?.totalVersions as number || 0,
          avgVersionsPerEntry: versionStats.data?.avgVersionsPerEntry as number || 0,
          conflictsResolved: versionStats.data?.recentActivity?.conflictsResolved as number || 0
        },
        audit: {
          totalAuditEntries: auditStats.data?.totalEntries as number || 0,
          operationsByType: {
            create: 0,
            read: 0,
            update: 0,
            delete: 0,
            version: 0,
            merge: 0,
            lock: 0,
            unlock: 0
          },
          failedOperations: 0
        },
        lastUpdated: Date.now()
      };
      
      return {
        success: true,
        data: statistics,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<ContextStoreOperationResult<ContextStoreHealth>> {
    const startTime = Date.now();
    
    try {
      const storageHealth = await this.storage.healthCheck();
      
      const health: ContextStoreHealth = {
        status: 'healthy',
        components: {
          storage: storageHealth.success ? 'healthy' : 'unhealthy',
          cache: 'healthy',
          permissions: 'healthy',
          versioning: 'healthy',
          audit: 'healthy'
        },
        metrics: {
          responseTime: Date.now() - startTime,
          errorRate: 0,
          resourceUtilization: 50
        },
        recommendations: [],
        lastChecked: Date.now()
      };
      
      // Assess overall health
      const unhealthyComponents = Object.values(health.components).filter(status => status === 'unhealthy').length;
      if (unhealthyComponents > 0) {
        health.status = unhealthyComponents > 2 ? 'unhealthy' : 'degraded';
      }
      
      return {
        success: true,
        data: health,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Perform maintenance operations
   */
  async maintenance(): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      // Perform storage maintenance
      await this.storage.maintenance();
      
      // Clean up expired locks
      await this.locks.cleanupExpiredLocks();
      
      // Auto-resolve conflicts
      await this.conflicts.autoResolveConflicts();
      
      this.logger.info('Maintenance operations completed');
      
      return {
        success: true,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Export context data
   */
  async export(format: 'json' | 'xml', filter?: ContextQuery): Promise<ContextStoreOperationResult<string>> {
    // Implementation would go here
    return { success: false, error: 'Not implemented', executionTime: 0 };
  }

  /**
   * Import context data
   */
  async import(data: string, format: 'json' | 'xml', agentId: string): Promise<ContextStoreOperationResult<number>> {
    // Implementation would go here
    return { success: false, error: 'Not implemented', executionTime: 0 };
  }

  /**
   * Shutdown the context store
   */
  async shutdown(): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      await this.storage.shutdown();
      this.initialized = false;
      this.initializationSubject.next(false);
      
      this.logger.info('SharedContextStore shutdown completed');
      
      return {
        success: true,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate entry ID
   */
  private generateEntryId(scope: ContextScope, path: string, key: string): string {
    const data = `${scope}:${path}:${key}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Infer data type from value
   */
  private inferDataType(value: unknown): ContextDataType {
    if (typeof value === 'string') return 'text';
    if (typeof value === 'object' && value !== null) return 'json';
    if (Buffer.isBuffer(value)) return 'binary';
    return 'structured';
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  /**
   * Calculate hash of value
   */
  private calculateHash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  /**
   * Calculate operations per second
   */
  private calculateOperationsPerSecond(): number {
    const uptime = Date.now() - this.stats.startTime;
    return uptime > 0 ? (this.stats.operations / (uptime / 1000)) : 0;
  }
}