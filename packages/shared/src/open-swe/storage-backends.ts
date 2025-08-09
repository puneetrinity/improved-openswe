/**
 * Storage Backend Implementations for Context Store
 * 
 * Provides multiple storage backends including in-memory, file-based,
 * and database storage with performance optimization and scalability.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { 
  IContextStorageBackend,
  ContextStoreOperationResult
} from './context-store-interfaces.js';
import {
  ContextEntry,
  ContextQuery,
  ContextQueryResult,
  StorageBackend,
  ContextScope,
  ContextDataType
} from './context-store-types.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * In-Memory Storage Backend
 * 
 * High-performance storage for development and testing,
 * with optional persistence to disk.
 */
export class InMemoryStorageBackend implements IContextStorageBackend {
  readonly type: StorageBackend = 'memory';
  private readonly logger = createLogger(LogLevel.INFO, 'InMemoryStorage');
  
  /**
   * Internal storage map
   */
  private readonly storage = new Map<string, ContextEntry>();
  
  /**
   * Configuration
   */
  private config: {
    persistToDisk?: boolean;
    diskPath?: string;
    autoSave?: boolean;
    saveInterval?: number;
  } = {};
  
  /**
   * Auto-save interval handle
   */
  private autoSaveInterval?: NodeJS.Timeout;
  
  /**
   * Statistics tracking
   */
  private stats = {
    totalOperations: 0,
    totalReads: 0,
    totalWrites: 0,
    totalDeletes: 0,
    startTime: Date.now()
  };

  async initialize(config: Record<string, unknown>): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      this.config = {
        persistToDisk: config.persistToDisk as boolean || false,
        diskPath: config.diskPath as string || './context-store-data.json',
        autoSave: config.autoSave as boolean || true,
        saveInterval: config.saveInterval as number || 60000
      };

      // Load from disk if persistence is enabled
      if (this.config.persistToDisk && this.config.diskPath) {
        await this.loadFromDisk();
      }

      // Setup auto-save
      if (this.config.autoSave && this.config.saveInterval) {
        this.setupAutoSave();
      }

      this.logger.info('InMemoryStorageBackend initialized', { config: this.config });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { storageType: 'memory', entries: this.storage.size }
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize InMemoryStorageBackend', {
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async store(entry: ContextEntry): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;
    this.stats.totalWrites++;
    
    try {
      // Create a deep copy to prevent external modifications
      const storedEntry: ContextEntry = JSON.parse(JSON.stringify(entry));
      
      // Update metadata
      storedEntry.metadata.updatedAt = Date.now();
      storedEntry.metadata.size = this.calculateSize(storedEntry.value);
      storedEntry.metadata.contentHash = this.calculateHash(storedEntry.value);
      
      this.storage.set(entry.id, storedEntry);
      
      this.logger.debug('Entry stored', { entryId: entry.id, size: storedEntry.metadata.size });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { entryId: entry.id, size: storedEntry.metadata.size }
      };
      
    } catch (error) {
      this.logger.error('Failed to store entry', {
        entryId: entry.id,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown storage error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async retrieve(id: string): Promise<ContextStoreOperationResult<ContextEntry>> {
    const startTime = Date.now();
    this.stats.totalOperations++;
    this.stats.totalReads++;
    
    try {
      const entry = this.storage.get(id);
      
      if (!entry) {
        return {
          success: false,
          error: `Entry not found: ${id}`,
          executionTime: Date.now() - startTime
        };
      }

      // Return a deep copy to prevent external modifications
      const result: ContextEntry = JSON.parse(JSON.stringify(entry));
      
      this.logger.debug('Entry retrieved', { entryId: id });

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to retrieve entry', {
        entryId: id,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown retrieval error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async update(id: string, entry: Partial<ContextEntry>): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;
    this.stats.totalWrites++;
    
    try {
      const existingEntry = this.storage.get(id);
      
      if (!existingEntry) {
        return {
          success: false,
          error: `Entry not found: ${id}`,
          executionTime: Date.now() - startTime
        };
      }

      // Merge updates
      const updatedEntry: ContextEntry = {
        ...existingEntry,
        ...entry,
        id, // Ensure ID cannot be changed
        metadata: {
          ...existingEntry.metadata,
          ...entry.metadata,
          updatedAt: Date.now(),
          version: existingEntry.metadata.version + 1
        }
      };

      // Recalculate size and hash if value changed
      if (entry.value !== undefined) {
        updatedEntry.metadata.size = this.calculateSize(updatedEntry.value);
        updatedEntry.metadata.contentHash = this.calculateHash(updatedEntry.value);
      }

      this.storage.set(id, updatedEntry);
      
      this.logger.debug('Entry updated', { entryId: id, version: updatedEntry.metadata.version });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { entryId: id, version: updatedEntry.metadata.version }
      };
      
    } catch (error) {
      this.logger.error('Failed to update entry', {
        entryId: id,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown update error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async delete(id: string): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;
    this.stats.totalDeletes++;
    
    try {
      const existed = this.storage.delete(id);
      
      if (!existed) {
        return {
          success: false,
          error: `Entry not found: ${id}`,
          executionTime: Date.now() - startTime
        };
      }
      
      this.logger.debug('Entry deleted', { entryId: id });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { entryId: id }
      };
      
    } catch (error) {
      this.logger.error('Failed to delete entry', {
        entryId: id,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async query(query: ContextQuery): Promise<ContextStoreOperationResult<ContextQueryResult>> {
    const startTime = Date.now();
    this.stats.totalOperations++;
    this.stats.totalReads++;
    
    try {
      let entries = Array.from(this.storage.values());
      
      // Apply filters
      entries = entries.filter(entry => this.matchesQuery(entry, query));
      
      // Apply sorting
      if (query.sortBy) {
        entries = this.sortEntries(entries, query.sortBy, query.sortOrder || 'desc');
      }
      
      // Track total before pagination
      const totalCount = entries.length;
      
      // Apply pagination
      if (query.offset) {
        entries = entries.slice(query.offset);
      }
      if (query.limit) {
        entries = entries.slice(0, query.limit);
      }
      
      // Calculate relevance scores if text search was used
      const relevanceScores = new Map<string, number>();
      if (query.textSearch) {
        entries.forEach(entry => {
          const score = this.calculateRelevanceScore(entry, query.textSearch!);
          relevanceScores.set(entry.id, score);
        });
      }

      const result: ContextQueryResult = {
        entries,
        totalCount,
        queryTime: Date.now() - startTime,
        fromCache: false,
        relevanceScores,
        metadata: { queryType: 'memory_scan' }
      };
      
      this.logger.debug('Query executed', { 
        totalFound: totalCount, 
        returned: entries.length, 
        queryTime: result.queryTime 
      });

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to execute query', {
        query,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown query error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async listEntries(): Promise<ContextStoreOperationResult<string[]>> {
    const startTime = Date.now();
    
    try {
      const entryIds = Array.from(this.storage.keys());
      
      return {
        success: true,
        data: entryIds,
        executionTime: Date.now() - startTime,
        metadata: { count: entryIds.length }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async exists(id: string): Promise<ContextStoreOperationResult<boolean>> {
    const startTime = Date.now();
    
    try {
      const exists = this.storage.has(id);
      
      return {
        success: true,
        data: exists,
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

  async getStatistics(): Promise<ContextStoreOperationResult<Record<string, unknown>>> {
    const startTime = Date.now();
    
    try {
      const uptime = Date.now() - this.stats.startTime;
      const totalSize = Array.from(this.storage.values())
        .reduce((sum, entry) => sum + entry.metadata.size, 0);

      const statistics = {
        entryCount: this.storage.size,
        totalSize,
        totalOperations: this.stats.totalOperations,
        totalReads: this.stats.totalReads,
        totalWrites: this.stats.totalWrites,
        totalDeletes: this.stats.totalDeletes,
        uptime,
        operationsPerSecond: this.stats.totalOperations / (uptime / 1000),
        avgEntrySize: this.storage.size > 0 ? totalSize / this.storage.size : 0
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

  async maintenance(): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      let operationsPerformed = 0;

      // Save to disk if persistence is enabled
      if (this.config.persistToDisk) {
        await this.saveToDisk();
        operationsPerformed++;
      }

      // Validate data integrity
      let corruptedEntries = 0;
      for (const [id, entry] of this.storage.entries()) {
        const expectedHash = this.calculateHash(entry.value);
        if (entry.metadata.contentHash !== expectedHash) {
          this.logger.warn('Data integrity issue detected', { entryId: id });
          corruptedEntries++;
          
          // Fix the hash
          entry.metadata.contentHash = expectedHash;
          operationsPerformed++;
        }
      }

      this.logger.info('Maintenance completed', { 
        operationsPerformed, 
        corruptedEntries,
        totalEntries: this.storage.size 
      });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { 
          operationsPerformed, 
          corruptedEntries, 
          totalEntries: this.storage.size 
        }
      };
      
    } catch (error) {
      this.logger.error('Maintenance failed', {
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown maintenance error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async shutdown(): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      // Clear auto-save interval
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = undefined;
      }

      // Final save to disk if persistence is enabled
      if (this.config.persistToDisk) {
        await this.saveToDisk();
      }

      this.logger.info('InMemoryStorageBackend shutdown completed');

      return {
        success: true,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Shutdown failed', {
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown shutdown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  async healthCheck(): Promise<ContextStoreOperationResult<{ status: string; details: Record<string, unknown> }>> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = Date.now() - this.stats.startTime;
      
      // Check for potential issues
      const issues: string[] = [];
      
      if (this.storage.size > 100000) {
        issues.push('High entry count may impact performance');
      }
      
      if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
        issues.push('High memory usage detected');
      }

      const status = issues.length === 0 ? 'healthy' : 
                     issues.length < 3 ? 'degraded' : 'unhealthy';

      const details = {
        entryCount: this.storage.size,
        uptime,
        memoryUsage: memoryUsage.heapUsed,
        operationsPerSecond: this.stats.totalOperations / (uptime / 1000),
        issues,
        persistToDisk: this.config.persistToDisk,
        autoSave: this.config.autoSave
      };
      
      return {
        success: true,
        data: { status, details },
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
   * Check if an entry matches the query criteria
   */
  private matchesQuery(entry: ContextEntry, query: ContextQuery): boolean {
    // Scope filter
    if (query.scope) {
      const scopes = Array.isArray(query.scope) ? query.scope : [query.scope];
      if (!scopes.includes(entry.scope)) {
        return false;
      }
    }

    // Path pattern filter
    if (query.pathPattern) {
      const pattern = new RegExp(query.pathPattern.replace(/\*/g, '.*'));
      if (!pattern.test(entry.path)) {
        return false;
      }
    }

    // Key pattern filter
    if (query.keyPattern) {
      const pattern = new RegExp(query.keyPattern.replace(/\*/g, '.*'));
      if (!pattern.test(entry.key)) {
        return false;
      }
    }

    // Data type filter
    if (query.dataType) {
      const types = Array.isArray(query.dataType) ? query.dataType : [query.dataType];
      if (!types.includes(entry.dataType)) {
        return false;
      }
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      if (!query.tags.every(tag => entry.metadata.tags.includes(tag))) {
        return false;
      }
    }

    // Date filters
    if (query.createdAfter && entry.metadata.createdAt < query.createdAfter) {
      return false;
    }
    if (query.createdBefore && entry.metadata.createdAt > query.createdBefore) {
      return false;
    }
    if (query.modifiedAfter && entry.metadata.updatedAt < query.modifiedAfter) {
      return false;
    }
    if (query.modifiedBefore && entry.metadata.updatedAt > query.modifiedBefore) {
      return false;
    }

    // Version filters
    if (query.minVersion && entry.metadata.version < query.minVersion) {
      return false;
    }
    if (query.maxVersion && entry.metadata.version > query.maxVersion) {
      return false;
    }

    // Text search
    if (query.textSearch) {
      const searchText = query.textSearch.toLowerCase();
      const entryText = JSON.stringify(entry.value).toLowerCase();
      if (!entryText.includes(searchText)) {
        return false;
      }
    }

    // Structured query (basic implementation)
    if (query.structuredQuery) {
      try {
        const entryValue = entry.value as Record<string, unknown>;
        if (!this.matchesStructuredQuery(entryValue, query.structuredQuery)) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if entry value matches structured query
   */
  private matchesStructuredQuery(value: Record<string, unknown>, query: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(query)) {
      if (value[key] !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sort entries based on criteria
   */
  private sortEntries(entries: ContextEntry[], sortBy: string, sortOrder: 'asc' | 'desc'): ContextEntry[] {
    return entries.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'created':
          comparison = a.metadata.createdAt - b.metadata.createdAt;
          break;
        case 'modified':
          comparison = a.metadata.updatedAt - b.metadata.updatedAt;
          break;
        case 'size':
          comparison = a.metadata.size - b.metadata.size;
          break;
        case 'version':
          comparison = a.metadata.version - b.metadata.version;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Calculate relevance score for text search
   */
  private calculateRelevanceScore(entry: ContextEntry, searchText: string): number {
    const text = JSON.stringify(entry.value).toLowerCase();
    const search = searchText.toLowerCase();
    
    // Simple relevance scoring based on occurrence count and position
    const occurrences = (text.match(new RegExp(search, 'g')) || []).length;
    const firstOccurrence = text.indexOf(search);
    
    let score = occurrences * 10;
    if (firstOccurrence !== -1) {
      score += Math.max(0, 100 - firstOccurrence / 10); // Boost for early occurrence
    }
    
    return score;
  }

  /**
   * Calculate size of a value in bytes
   */
  private calculateSize(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  /**
   * Calculate content hash for integrity verification
   */
  private calculateHash(value: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
  }

  /**
   * Save data to disk
   */
  private async saveToDisk(): Promise<void> {
    if (!this.config.diskPath) {
      return;
    }

    const data = {
      metadata: {
        version: '1.0.0',
        savedAt: Date.now(),
        entryCount: this.storage.size
      },
      entries: Array.from(this.storage.entries())
    };

    const dir = path.dirname(this.config.diskPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(this.config.diskPath, JSON.stringify(data, null, 2));
    
    this.logger.info('Data saved to disk', { 
      path: this.config.diskPath, 
      entries: this.storage.size 
    });
  }

  /**
   * Load data from disk
   */
  private async loadFromDisk(): Promise<void> {
    if (!this.config.diskPath) {
      return;
    }

    try {
      const content = await fs.readFile(this.config.diskPath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.entries) {
        this.storage.clear();
        for (const [id, entry] of data.entries) {
          this.storage.set(id, entry);
        }
        
        this.logger.info('Data loaded from disk', { 
          path: this.config.diskPath, 
          entries: this.storage.size 
        });
      }
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Failed to load data from disk', {
          path: this.config.diskPath,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Setup automatic saving to disk
   */
  private setupAutoSave(): void {
    if (this.config.saveInterval && this.config.persistToDisk) {
      this.autoSaveInterval = setInterval(async () => {
        try {
          await this.saveToDisk();
        } catch (error) {
          this.logger.error('Auto-save failed', {
            error: error instanceof Error ? error.message : error
          });
        }
      }, this.config.saveInterval);
    }
  }
}