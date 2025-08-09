/**
 * Version Manager for Context Store
 * 
 * Provides comprehensive versioning, change tracking, and collaborative
 * editing support with conflict detection and resolution capabilities.
 */

import crypto from 'crypto';
import { 
  IVersionManager,
  ContextStoreOperationResult
} from './context-store-interfaces.js';
import {
  ContextVersion,
  ContextChange,
  ConflictResolutionStrategy
} from './context-store-types.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Diff result for comparing versions
 */
interface DiffResult {
  /**
   * Changes between versions
   */
  changes: ContextChange[];
  
  /**
   * Similarity score (0-1)
   */
  similarity: number;
  
  /**
   * Merge complexity assessment
   */
  complexity: 'simple' | 'moderate' | 'complex';
  
  /**
   * Potential conflicts
   */
  conflicts: string[];
}

/**
 * Version merge result
 */
interface MergeResult {
  /**
   * Merged value
   */
  value: unknown;
  
  /**
   * Conflicts that occurred during merge
   */
  conflicts: string[];
  
  /**
   * Whether auto-merge was successful
   */
  autoMerged: boolean;
  
  /**
   * Merge strategy used
   */
  strategy: ConflictResolutionStrategy;
}

/**
 * Version statistics for analytics
 */
interface VersionStatistics {
  /**
   * Total versions across all entries
   */
  totalVersions: number;
  
  /**
   * Average versions per entry
   */
  avgVersionsPerEntry: number;
  
  /**
   * Most versioned entry
   */
  mostVersionedEntry: { entryId: string; versions: number };
  
  /**
   * Recent activity
   */
  recentActivity: {
    versionsCreated: number;
    mergesPerformed: number;
    conflictsResolved: number;
  };
  
  /**
   * Storage usage
   */
  storageUsage: {
    totalSize: number;
    averageChangeSize: number;
  };
}

/**
 * Version Manager Implementation
 */
export class VersionManager implements IVersionManager {
  private readonly logger = createLogger(LogLevel.INFO, 'VersionManager');
  
  /**
   * Version storage by entry ID
   */
  private readonly versionStorage = new Map<string, ContextVersion[]>();
  
  /**
   * Version metadata cache
   */
  private readonly versionCache = new Map<string, ContextVersion>();
  
  /**
   * Statistics tracking
   */
  private stats = {
    versionsCreated: 0,
    mergesPerformed: 0,
    conflictsResolved: 0,
    totalSize: 0,
    startTime: Date.now()
  };
  
  /**
   * Configuration
   */
  private config = {
    maxVersionsPerEntry: 100,
    enableCompression: true,
    autoCleanup: true,
    cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
  };

  constructor(config?: Partial<typeof VersionManager.prototype.config>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.setupCleanup();
    this.logger.info('VersionManager initialized', { config: this.config });
  }

  /**
   * Create a new version of a context entry
   */
  async createVersion(
    entryId: string,
    changes: Record<string, unknown>,
    message: string,
    authorId: string
  ): Promise<ContextStoreOperationResult<ContextVersion>> {
    const startTime = Date.now();
    this.stats.versionsCreated++;
    
    try {
      // Get existing versions
      const versions = this.versionStorage.get(entryId) || [];
      const parentVersion = versions.length > 0 ? versions[versions.length - 1] : undefined;
      
      // Generate version ID
      const versionId = this.generateVersionId(entryId, versions.length + 1);
      
      // Calculate changes from parent version
      const contextChanges = this.calculateChanges(
        parentVersion?.changes || [],
        changes
      );
      
      // Create new version
      const newVersion: ContextVersion = {
        id: versionId,
        number: versions.length + 1,
        parentId: parentVersion?.id,
        timestamp: Date.now(),
        author: authorId,
        message,
        changes: contextChanges,
        metadata: {
          size: this.calculateSize(contextChanges),
          hash: this.calculateHash(contextChanges),
          compressed: this.config.enableCompression
        }
      };
      
      // Store version
      versions.push(newVersion);
      this.versionStorage.set(entryId, versions);
      this.versionCache.set(versionId, newVersion);
      
      // Update statistics
      this.stats.totalSize += newVersion.metadata.size || 0;
      
      // Cleanup old versions if needed
      if (versions.length > this.config.maxVersionsPerEntry) {
        await this.cleanupVersions(entryId, this.config.maxVersionsPerEntry);
      }
      
      this.logger.debug('Version created', {
        entryId,
        versionId,
        version: newVersion.number,
        author: authorId,
        changeCount: contextChanges.length
      });

      return {
        success: true,
        data: newVersion,
        executionTime: Date.now() - startTime,
        metadata: {
          entryId,
          versionId,
          versionNumber: newVersion.number,
          changeCount: contextChanges.length
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to create version', {
        entryId,
        authorId,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown version creation error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get version history for a context entry
   */
  async getVersionHistory(entryId: string, limit?: number): Promise<ContextStoreOperationResult<ContextVersion[]>> {
    const startTime = Date.now();
    
    try {
      let versions = this.versionStorage.get(entryId) || [];
      
      // Apply limit if specified
      if (limit && limit > 0) {
        versions = versions.slice(-limit);
      }
      
      // Sort by version number (newest first)
      const sortedVersions = [...versions].sort((a, b) => b.number - a.number);
      
      this.logger.debug('Version history retrieved', {
        entryId,
        totalVersions: versions.length,
        returnedVersions: sortedVersions.length
      });

      return {
        success: true,
        data: sortedVersions,
        executionTime: Date.now() - startTime,
        metadata: {
          entryId,
          totalVersions: versions.length,
          returnedVersions: sortedVersions.length
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get version history', {
        entryId,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown history retrieval error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get a specific version of a context entry
   */
  async getVersion(entryId: string, versionId: string): Promise<ContextStoreOperationResult<ContextVersion>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      let version = this.versionCache.get(versionId);
      
      if (!version) {
        // Search in storage
        const versions = this.versionStorage.get(entryId) || [];
        version = versions.find(v => v.id === versionId);
        
        if (version) {
          // Cache for future use
          this.versionCache.set(versionId, version);
        }
      }
      
      if (!version) {
        return {
          success: false,
          error: `Version not found: ${versionId}`,
          executionTime: Date.now() - startTime
        };
      }
      
      this.logger.debug('Version retrieved', {
        entryId,
        versionId,
        versionNumber: version.number
      });

      return {
        success: true,
        data: version,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to get version', {
        entryId,
        versionId,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown version retrieval error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Compare two versions of a context entry
   */
  async compareVersions(
    entryId: string,
    version1: string,
    version2: string
  ): Promise<ContextStoreOperationResult<Record<string, unknown>>> {
    const startTime = Date.now();
    
    try {
      const [v1Result, v2Result] = await Promise.all([
        this.getVersion(entryId, version1),
        this.getVersion(entryId, version2)
      ]);
      
      if (!v1Result.success || !v2Result.success) {
        return {
          success: false,
          error: 'One or both versions not found',
          executionTime: Date.now() - startTime
        };
      }
      
      const diff = this.generateDiff(v1Result.data!, v2Result.data!);
      
      const comparison = {
        version1: v1Result.data!,
        version2: v2Result.data!,
        diff,
        summary: {
          totalChanges: diff.changes.length,
          similarity: diff.similarity,
          complexity: diff.complexity,
          conflicts: diff.conflicts
        }
      };
      
      this.logger.debug('Versions compared', {
        entryId,
        version1,
        version2,
        changes: diff.changes.length,
        similarity: diff.similarity
      });

      return {
        success: true,
        data: comparison,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to compare versions', {
        entryId,
        version1,
        version2,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown comparison error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Revert to a previous version
   */
  async revertToVersion(
    entryId: string,
    versionId: string,
    authorId: string
  ): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      const versionResult = await this.getVersion(entryId, versionId);
      
      if (!versionResult.success) {
        return {
          success: false,
          error: `Version not found: ${versionId}`,
          executionTime: Date.now() - startTime
        };
      }
      
      const targetVersion = versionResult.data!;
      
      // Reconstruct value from version changes
      const reconstructedValue = this.reconstructValue(entryId, targetVersion.number);
      
      // Create a new version with the reverted changes
      const revertResult = await this.createVersion(
        entryId,
        reconstructedValue,
        `Reverted to version ${targetVersion.number}`,
        authorId
      );
      
      if (revertResult.success) {
        this.logger.info('Version reverted', {
          entryId,
          revertedToVersion: targetVersion.number,
          newVersionId: revertResult.data!.id,
          author: authorId
        });
      }
      
      return revertResult;
      
    } catch (error) {
      this.logger.error('Failed to revert version', {
        entryId,
        versionId,
        authorId,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown revert error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Merge two versions (for conflict resolution)
   */
  async mergeVersions(
    entryId: string,
    baseVersionId: string,
    version1Id: string,
    version2Id: string,
    strategy: ConflictResolutionStrategy
  ): Promise<ContextStoreOperationResult<ContextVersion>> {
    const startTime = Date.now();
    this.stats.mergesPerformed++;
    
    try {
      // Get all versions involved in the merge
      const [baseResult, v1Result, v2Result] = await Promise.all([
        this.getVersion(entryId, baseVersionId),
        this.getVersion(entryId, version1Id),
        this.getVersion(entryId, version2Id)
      ]);
      
      if (!baseResult.success || !v1Result.success || !v2Result.success) {
        return {
          success: false,
          error: 'One or more versions not found',
          executionTime: Date.now() - startTime
        };
      }
      
      // Perform three-way merge
      const mergeResult = this.performThreeWayMerge(
        baseResult.data!,
        v1Result.data!,
        v2Result.data!,
        strategy
      );
      
      // Create merged version
      const mergedVersionResult = await this.createVersion(
        entryId,
        mergeResult.value as Record<string, unknown>,
        `Merged versions ${v1Result.data!.number} and ${v2Result.data!.number}`,
        'system'
      );
      
      if (mergedVersionResult.success) {
        // Update statistics
        if (mergeResult.conflicts.length > 0) {
          this.stats.conflictsResolved += mergeResult.conflicts.length;
        }
        
        this.logger.info('Versions merged', {
          entryId,
          baseVersion: baseResult.data!.number,
          version1: v1Result.data!.number,
          version2: v2Result.data!.number,
          mergedVersion: mergedVersionResult.data!.number,
          strategy,
          conflicts: mergeResult.conflicts.length,
          autoMerged: mergeResult.autoMerged
        });
        
        // Add merge metadata to the version
        mergedVersionResult.data!.metadata = {
          ...mergedVersionResult.data!.metadata,
          merge: {
            baseVersion: baseVersionId,
            mergedVersions: [version1Id, version2Id],
            strategy,
            conflicts: mergeResult.conflicts,
            autoMerged: mergeResult.autoMerged
          }
        };
      }
      
      return mergedVersionResult;
      
    } catch (error) {
      this.logger.error('Failed to merge versions', {
        entryId,
        baseVersionId,
        version1Id,
        version2Id,
        strategy,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown merge error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Clean up old versions based on retention policy
   */
  async cleanupVersions(entryId: string, keepCount: number): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      const versions = this.versionStorage.get(entryId) || [];
      
      if (versions.length <= keepCount) {
        return {
          success: true,
          executionTime: Date.now() - startTime,
          metadata: { removedCount: 0, remainingCount: versions.length }
        };
      }
      
      // Keep the most recent versions
      const versionsToRemove = versions.slice(0, versions.length - keepCount);
      const versionsToKeep = versions.slice(-keepCount);
      
      // Remove from cache
      versionsToRemove.forEach(version => {
        this.versionCache.delete(version.id);
      });
      
      // Update storage
      this.versionStorage.set(entryId, versionsToKeep);
      
      this.logger.info('Versions cleaned up', {
        entryId,
        removedCount: versionsToRemove.length,
        remainingCount: versionsToKeep.length
      });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { 
          removedCount: versionsToRemove.length, 
          remainingCount: versionsToKeep.length 
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to cleanup versions', {
        entryId,
        keepCount,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cleanup error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get version statistics
   */
  async getVersionStatistics(entryId?: string): Promise<ContextStoreOperationResult<Record<string, unknown>>> {
    const startTime = Date.now();
    
    try {
      let statistics: VersionStatistics;
      
      if (entryId) {
        // Statistics for specific entry
        const versions = this.versionStorage.get(entryId) || [];
        statistics = {
          totalVersions: versions.length,
          avgVersionsPerEntry: versions.length,
          mostVersionedEntry: { entryId, versions: versions.length },
          recentActivity: this.getRecentActivity(entryId),
          storageUsage: this.getStorageUsage(entryId)
        };
      } else {
        // System-wide statistics
        statistics = this.calculateSystemStatistics();
      }
      
      return {
        success: true,
        data: statistics,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to get version statistics', {
        entryId,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown statistics error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Calculate changes between two sets of changes
   */
  private calculateChanges(
    parentChanges: ContextChange[],
    newData: Record<string, unknown>
  ): ContextChange[] {
    const changes: ContextChange[] = [];
    const timestamp = Date.now();
    
    // Simple implementation - could be enhanced with more sophisticated diffing
    for (const [path, newValue] of Object.entries(newData)) {
      const parentChange = parentChanges.find(c => c.path === path);
      const oldValue = parentChange?.newValue;
      
      if (!parentChange) {
        changes.push({
          type: 'add',
          path,
          newValue,
          timestamp
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          type: 'modify',
          path,
          oldValue,
          newValue,
          timestamp
        });
      }
    }
    
    return changes;
  }

  /**
   * Generate a unique version ID
   */
  private generateVersionId(entryId: string, versionNumber: number): string {
    const timestamp = Date.now();
    const data = `${entryId}:${versionNumber}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Calculate size of version data
   */
  private calculateSize(changes: ContextChange[]): number {
    return Buffer.byteLength(JSON.stringify(changes), 'utf8');
  }

  /**
   * Calculate hash of version data
   */
  private calculateHash(changes: ContextChange[]): string {
    return crypto.createHash('sha256').update(JSON.stringify(changes)).digest('hex');
  }

  /**
   * Generate diff between two versions
   */
  private generateDiff(version1: ContextVersion, version2: ContextVersion): DiffResult {
    const changes: ContextChange[] = [];
    const conflicts: string[] = [];
    
    // Compare changes between versions
    const v1Changes = new Map(version1.changes.map(c => [c.path, c]));
    const v2Changes = new Map(version2.changes.map(c => [c.path, c]));
    
    // Find different changes
    for (const [path, change] of v2Changes) {
      const v1Change = v1Changes.get(path);
      if (!v1Change || JSON.stringify(v1Change.newValue) !== JSON.stringify(change.newValue)) {
        changes.push(change);
      }
    }
    
    // Calculate similarity (simple implementation)
    const totalPaths = new Set([...v1Changes.keys(), ...v2Changes.keys()]).size;
    const commonPaths = [...v1Changes.keys()].filter(path => {
      const v2Change = v2Changes.get(path);
      return v2Change && JSON.stringify(v1Changes.get(path)?.newValue) === JSON.stringify(v2Change.newValue);
    }).length;
    
    const similarity = totalPaths > 0 ? commonPaths / totalPaths : 1;
    
    // Assess complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (changes.length > 10) complexity = 'moderate';
    if (changes.length > 25 || conflicts.length > 0) complexity = 'complex';
    
    return { changes, similarity, complexity, conflicts };
  }

  /**
   * Reconstruct value from version history up to a specific version
   */
  private reconstructValue(entryId: string, versionNumber: number): Record<string, unknown> {
    const versions = this.versionStorage.get(entryId) || [];
    const targetVersions = versions.filter(v => v.number <= versionNumber);
    
    let reconstructed: Record<string, unknown> = {};
    
    // Apply changes in order
    for (const version of targetVersions) {
      for (const change of version.changes) {
        switch (change.type) {
          case 'add':
          case 'modify':
            reconstructed[change.path] = change.newValue;
            break;
          case 'delete':
            delete reconstructed[change.path];
            break;
        }
      }
    }
    
    return reconstructed;
  }

  /**
   * Perform three-way merge of versions
   */
  private performThreeWayMerge(
    base: ContextVersion,
    version1: ContextVersion,
    version2: ContextVersion,
    strategy: ConflictResolutionStrategy
  ): MergeResult {
    const conflicts: string[] = [];
    let mergedValue: Record<string, unknown> = {};
    
    // Reconstruct values for all versions
    const baseValue = this.reconstructVersionValue(base);
    const v1Value = this.reconstructVersionValue(version1);
    const v2Value = this.reconstructVersionValue(version2);
    
    // Get all unique paths
    const allPaths = new Set([
      ...Object.keys(baseValue),
      ...Object.keys(v1Value),
      ...Object.keys(v2Value)
    ]);
    
    for (const path of allPaths) {
      const baseVal = baseValue[path];
      const v1Val = v1Value[path];
      const v2Val = v2Value[path];
      
      if (JSON.stringify(v1Val) === JSON.stringify(v2Val)) {
        // No conflict - both versions have the same value
        if (v1Val !== undefined) {
          mergedValue[path] = v1Val;
        }
      } else if (JSON.stringify(v1Val) === JSON.stringify(baseVal)) {
        // Version 1 unchanged, use version 2
        if (v2Val !== undefined) {
          mergedValue[path] = v2Val;
        }
      } else if (JSON.stringify(v2Val) === JSON.stringify(baseVal)) {
        // Version 2 unchanged, use version 1
        if (v1Val !== undefined) {
          mergedValue[path] = v1Val;
        }
      } else {
        // Conflict - both versions changed differently
        conflicts.push(path);
        
        // Apply conflict resolution strategy
        switch (strategy) {
          case 'last_write_wins':
            mergedValue[path] = version1.timestamp > version2.timestamp ? v1Val : v2Val;
            break;
          case 'first_write_wins':
            mergedValue[path] = version1.timestamp < version2.timestamp ? v1Val : v2Val;
            break;
          case 'merge_automatic':
            // Try to merge if both are objects
            if (typeof v1Val === 'object' && typeof v2Val === 'object' && v1Val && v2Val) {
              mergedValue[path] = { ...v1Val as object, ...v2Val as object };
            } else {
              mergedValue[path] = v1Val; // Fallback
            }
            break;
          default:
            mergedValue[path] = v1Val; // Default fallback
        }
      }
    }
    
    return {
      value: mergedValue,
      conflicts,
      autoMerged: conflicts.length === 0 || strategy !== 'merge_manual',
      strategy
    };
  }

  /**
   * Reconstruct value from a single version
   */
  private reconstructVersionValue(version: ContextVersion): Record<string, unknown> {
    const value: Record<string, unknown> = {};
    
    for (const change of version.changes) {
      switch (change.type) {
        case 'add':
        case 'modify':
          value[change.path] = change.newValue;
          break;
        case 'delete':
          delete value[change.path];
          break;
      }
    }
    
    return value;
  }

  /**
   * Get recent activity statistics for an entry
   */
  private getRecentActivity(entryId: string): VersionStatistics['recentActivity'] {
    const versions = this.versionStorage.get(entryId) || [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const recentVersions = versions.filter(v => v.timestamp > oneDayAgo);
    
    return {
      versionsCreated: recentVersions.length,
      mergesPerformed: recentVersions.filter(v => v.metadata.merge).length,
      conflictsResolved: 0 // Would need to track this separately
    };
  }

  /**
   * Get storage usage for an entry
   */
  private getStorageUsage(entryId: string): VersionStatistics['storageUsage'] {
    const versions = this.versionStorage.get(entryId) || [];
    const totalSize = versions.reduce((sum, v) => sum + (v.metadata.size || 0), 0);
    
    return {
      totalSize,
      averageChangeSize: versions.length > 0 ? totalSize / versions.length : 0
    };
  }

  /**
   * Calculate system-wide statistics
   */
  private calculateSystemStatistics(): VersionStatistics {
    let totalVersions = 0;
    let maxVersions = 0;
    let maxVersionsEntry = '';
    let totalSize = 0;
    
    for (const [entryId, versions] of this.versionStorage.entries()) {
      totalVersions += versions.length;
      
      if (versions.length > maxVersions) {
        maxVersions = versions.length;
        maxVersionsEntry = entryId;
      }
      
      totalSize += versions.reduce((sum, v) => sum + (v.metadata.size || 0), 0);
    }
    
    const entryCount = this.versionStorage.size;
    
    return {
      totalVersions,
      avgVersionsPerEntry: entryCount > 0 ? totalVersions / entryCount : 0,
      mostVersionedEntry: { entryId: maxVersionsEntry, versions: maxVersions },
      recentActivity: {
        versionsCreated: this.stats.versionsCreated,
        mergesPerformed: this.stats.mergesPerformed,
        conflictsResolved: this.stats.conflictsResolved
      },
      storageUsage: {
        totalSize,
        averageChangeSize: totalVersions > 0 ? totalSize / totalVersions : 0
      }
    };
  }

  /**
   * Setup cleanup interval for old versions
   */
  private setupCleanup(): void {
    if (this.config.autoCleanup) {
      setInterval(() => {
        this.performAutoCleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Perform automatic cleanup of old versions
   */
  private async performAutoCleanup(): Promise<void> {
    let totalCleaned = 0;
    
    for (const entryId of this.versionStorage.keys()) {
      const result = await this.cleanupVersions(entryId, this.config.maxVersionsPerEntry);
      if (result.success && result.metadata?.removedCount) {
        totalCleaned += result.metadata.removedCount as number;
      }
    }
    
    if (totalCleaned > 0) {
      this.logger.info('Auto cleanup completed', { versionsRemoved: totalCleaned });
    }
  }
}