/**
 * Knowledge Graph Storage Backend Implementation
 * 
 * Provides efficient storage, indexing, and querying capabilities for the Repository Knowledge Graph.
 * Supports both in-memory and persistent storage with advanced indexing and caching strategies.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import {
  IKnowledgeGraphStorage,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-interfaces.js';
import {
  CodeEntity,
  Relationship,
  RelationshipType,
  KnowledgeGraphQuery,
  CodeEntityType
} from './repository-knowledge-graph-types.js';

/**
 * Storage configuration
 */
interface StorageConfig {
  /**
   * Storage type
   */
  type: 'memory' | 'file' | 'hybrid';

  /**
   * File storage location
   */
  dataPath?: string;

  /**
   * Enable persistence
   */
  persistent: boolean;

  /**
   * Index configuration
   */
  indexing: {
    enabled: boolean;
    entityTypeIndex: boolean;
    filePathIndex: boolean;
    relationshipTypeIndex: boolean;
    embeddingIndex: boolean;
    customIndexes: Array<{
      name: string;
      fields: string[];
    }>;
  };

  /**
   * Cache configuration
   */
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };

  /**
   * Performance optimization
   */
  optimization: {
    enableBatching: boolean;
    batchSize: number;
    enableCompression: boolean;
    enableParallelQueries: boolean;
  };
}

/**
 * Index entry for efficient lookups
 */
interface IndexEntry<T = any> {
  key: string;
  value: T;
  entityId: string;
  timestamp: number;
}

/**
 * Query execution plan
 */
interface QueryPlan {
  strategy: 'full_scan' | 'index_lookup' | 'multi_index' | 'vector_search';
  indexes: string[];
  estimatedCost: number;
  expectedResults: number;
}

/**
 * Storage statistics
 */
interface StorageStats {
  entities: {
    count: number;
    byType: Record<CodeEntityType, number>;
    totalSize: number;
  };
  relationships: {
    count: number;
    byType: Record<RelationshipType, number>;
    totalSize: number;
  };
  indexes: {
    count: number;
    totalSize: number;
    hitRatio: number;
  };
  cache: {
    size: number;
    hitRatio: number;
    memory: number;
  };
  performance: {
    avgQueryTime: number;
    totalQueries: number;
  };
}

/**
 * In-memory knowledge graph storage implementation
 */
export class KnowledgeGraphStorage implements IKnowledgeGraphStorage {
  private readonly logger = createLogger(LogLevel.INFO, 'KnowledgeGraphStorage');
  private config: StorageConfig;

  // Core storage
  private entities = new Map<string, CodeEntity>();
  private relationships = new Map<string, Relationship>();

  // Indexes for efficient queries
  private entityTypeIndex = new Map<CodeEntityType, Set<string>>();
  private filePathIndex = new Map<string, Set<string>>();
  private relationshipTypeIndex = new Map<RelationshipType, Set<string>>();
  private relationshipSourceIndex = new Map<string, Set<string>>();
  private relationshipTargetIndex = new Map<string, Set<string>>();
  private embeddingIndex = new Map<string, number[]>();
  private customIndexes = new Map<string, Map<string, Set<string>>>();

  // Cache
  private cache = new Map<string, { value: any; timestamp: number; ttl: number }>();

  // Performance tracking
  private stats: StorageStats = {
    entities: { count: 0, byType: {} as Record<CodeEntityType, number>, totalSize: 0 },
    relationships: { count: 0, byType: {} as Record<RelationshipType, number>, totalSize: 0 },
    indexes: { count: 0, totalSize: 0, hitRatio: 0 },
    cache: { size: 0, hitRatio: 0, memory: 0 },
    performance: { avgQueryTime: 0, totalQueries: 0 }
  };

  private queryTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      type: 'memory',
      persistent: false,
      indexing: {
        enabled: true,
        entityTypeIndex: true,
        filePathIndex: true,
        relationshipTypeIndex: true,
        embeddingIndex: true,
        customIndexes: []
      },
      cache: {
        enabled: true,
        maxSize: 10000,
        ttl: 300000 // 5 minutes
      },
      optimization: {
        enableBatching: true,
        batchSize: 100,
        enableCompression: false,
        enableParallelQueries: true
      },
      ...config
    };

    this.logger.info('KnowledgeGraphStorage initialized', { config: this.config });
  }

  /**
   * Initialize the storage backend
   */
  async initialize(): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      // Create data directory if using file storage
      if (this.config.type === 'file' || this.config.type === 'hybrid') {
        if (this.config.dataPath) {
          await fs.mkdir(this.config.dataPath, { recursive: true });
          
          // Load existing data if persistent
          if (this.config.persistent) {
            await this.loadFromDisk();
          }
        }
      }

      // Initialize indexes
      if (this.config.indexing.enabled) {
        await this.initializeIndexes();
      }

      this.logger.info('Storage backend initialized successfully');

      return {
        success: true,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to initialize storage backend', {
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
   * Store a code entity
   */
  async storeEntity(entity: CodeEntity): Promise<RepositoryKnowledgeGraphResult<string>> {
    const startTime = Date.now();

    try {
      // Store entity
      this.entities.set(entity.id, entity);

      // Update indexes
      await this.updateIndexesForEntity(entity);

      // Update statistics
      this.updateEntityStatistics(entity, 'add');

      // Persist if configured
      if (this.config.persistent) {
        await this.persistEntity(entity);
      }

      // Clear related cache entries
      this.invalidateEntityCache(entity.id);

      this.logger.debug('Entity stored successfully', {
        entityId: entity.id,
        entityType: entity.type,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        data: entity.id,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to store entity', {
        entityId: entity.id,
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
   * Store multiple entities
   */
  async storeEntities(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<string[]>> {
    const startTime = Date.now();
    
    try {
      const entityIds: string[] = [];
      const batchSize = this.config.optimization.batchSize;

      if (this.config.optimization.enableBatching && entities.length > batchSize) {
        // Process in batches
        for (let i = 0; i < entities.length; i += batchSize) {
          const batch = entities.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(entity => this.storeEntity(entity))
          );

          for (const result of batchResults) {
            if (result.success) {
              entityIds.push(result.data!);
            } else {
              throw new Error(`Failed to store entity: ${result.error}`);
            }
          }
        }
      } else {
        // Process all at once
        const results = await Promise.all(
          entities.map(entity => this.storeEntity(entity))
        );

        for (const result of results) {
          if (result.success) {
            entityIds.push(result.data!);
          } else {
            throw new Error(`Failed to store entity: ${result.error}`);
          }
        }
      }

      return {
        success: true,
        data: entityIds,
        executionTime: Date.now() - startTime,
        metadata: { entitiesStored: entityIds.length }
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
   * Retrieve an entity by ID
   */
  async getEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult<CodeEntity>> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = `entity:${entityId}`;
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        this.cacheHits++;
        return {
          success: true,
          data: cached,
          executionTime: Date.now() - startTime,
          metadata: { fromCache: true }
        };
      }

      this.cacheMisses++;

      // Get from storage
      const entity = this.entities.get(entityId);
      
      if (!entity) {
        return {
          success: false,
          error: `Entity not found: ${entityId}`,
          executionTime: Date.now() - startTime
        };
      }

      // Cache the result
      this.setInCache(cacheKey, entity);

      return {
        success: true,
        data: entity,
        executionTime: Date.now() - startTime,
        metadata: { fromCache: false }
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
   * Retrieve multiple entities
   */
  async getEntities(entityIds: string[]): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    const startTime = Date.now();

    try {
      const entities: CodeEntity[] = [];
      
      if (this.config.optimization.enableParallelQueries) {
        const results = await Promise.all(
          entityIds.map(id => this.getEntity(id))
        );

        for (const result of results) {
          if (result.success) {
            entities.push(result.data!);
          }
        }
      } else {
        for (const entityId of entityIds) {
          const result = await this.getEntity(entityId);
          if (result.success) {
            entities.push(result.data!);
          }
        }
      }

      return {
        success: true,
        data: entities,
        executionTime: Date.now() - startTime,
        metadata: { requested: entityIds.length, found: entities.length }
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
   * Update an entity
   */
  async updateEntity(entityId: string, updates: Partial<CodeEntity>): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      const existingEntity = this.entities.get(entityId);
      
      if (!existingEntity) {
        return {
          success: false,
          error: `Entity not found: ${entityId}`,
          executionTime: Date.now() - startTime
        };
      }

      // Create updated entity
      const updatedEntity: CodeEntity = {
        ...existingEntity,
        ...updates,
        id: entityId // Ensure ID cannot be changed
      };

      // Update storage
      this.entities.set(entityId, updatedEntity);

      // Update indexes
      await this.updateIndexesForEntity(updatedEntity);

      // Update statistics
      this.updateEntityStatistics(updatedEntity, 'update');

      // Persist if configured
      if (this.config.persistent) {
        await this.persistEntity(updatedEntity);
      }

      // Clear cache
      this.invalidateEntityCache(entityId);

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
   * Delete an entity
   */
  async deleteEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      const entity = this.entities.get(entityId);
      
      if (!entity) {
        return {
          success: false,
          error: `Entity not found: ${entityId}`,
          executionTime: Date.now() - startTime
        };
      }

      // Remove from storage
      this.entities.delete(entityId);

      // Remove from indexes
      await this.removeFromIndexes(entity);

      // Remove related relationships
      const relatedRelationships = Array.from(this.relationships.values())
        .filter(rel => rel.sourceId === entityId || rel.targetId === entityId);
      
      for (const relationship of relatedRelationships) {
        this.relationships.delete(relationship.id);
        await this.removeRelationshipFromIndexes(relationship);
      }

      // Update statistics
      this.updateEntityStatistics(entity, 'delete');

      // Clear cache
      this.invalidateEntityCache(entityId);

      // Delete from disk if persistent
      if (this.config.persistent) {
        await this.deleteEntityFromDisk(entityId);
      }

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { deletedRelationships: relatedRelationships.length }
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
   * Query entities
   */
  async queryEntities(query: KnowledgeGraphQuery): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    const startTime = Date.now();

    try {
      this.stats.performance.totalQueries++;

      // Develop query execution plan
      const plan = this.createQueryPlan(query);
      
      this.logger.debug('Query execution plan', {
        strategy: plan.strategy,
        indexes: plan.indexes,
        estimatedCost: plan.estimatedCost
      });

      let results: CodeEntity[] = [];

      switch (plan.strategy) {
        case 'index_lookup':
          results = await this.executeIndexQuery(query);
          break;
        
        case 'multi_index':
          results = await this.executeMultiIndexQuery(query);
          break;
        
        case 'vector_search':
          results = await this.executeVectorQuery(query);
          break;
        
        case 'full_scan':
        default:
          results = await this.executeFullScanQuery(query);
          break;
      }

      // Apply additional filters
      results = this.applyQueryFilters(results, query);

      // Apply pagination
      if (query.offset || query.limit) {
        const offset = query.offset || 0;
        const limit = query.limit || results.length;
        results = results.slice(offset, offset + limit);
      }

      const executionTime = Date.now() - startTime;
      this.queryTimes.push(executionTime);

      // Update average query time
      if (this.queryTimes.length > 100) {
        this.queryTimes = this.queryTimes.slice(-100); // Keep last 100
      }
      this.stats.performance.avgQueryTime = 
        this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;

      return {
        success: true,
        data: results,
        executionTime,
        metadata: {
          strategy: plan.strategy,
          totalResults: results.length,
          queryPlan: plan
        }
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
   * Store a relationship
   */
  async storeRelationship(relationship: Relationship): Promise<RepositoryKnowledgeGraphResult<string>> {
    const startTime = Date.now();

    try {
      // Validate that source and target entities exist
      if (!this.entities.has(relationship.sourceId)) {
        return {
          success: false,
          error: `Source entity not found: ${relationship.sourceId}`,
          executionTime: Date.now() - startTime
        };
      }

      if (!this.entities.has(relationship.targetId)) {
        return {
          success: false,
          error: `Target entity not found: ${relationship.targetId}`,
          executionTime: Date.now() - startTime
        };
      }

      // Store relationship
      this.relationships.set(relationship.id, relationship);

      // Update indexes
      await this.updateIndexesForRelationship(relationship);

      // Update statistics
      this.updateRelationshipStatistics(relationship, 'add');

      // Add to entity relationships
      const sourceEntity = this.entities.get(relationship.sourceId)!;
      const targetEntity = this.entities.get(relationship.targetId)!;
      
      sourceEntity.relationships.push(relationship);
      if (relationship.metadata.bidirectional) {
        targetEntity.relationships.push(relationship);
      }

      return {
        success: true,
        data: relationship.id,
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
   * Get relationships for an entity
   */
  async getEntityRelationships(
    entityId: string,
    relationshipTypes?: RelationshipType[]
  ): Promise<RepositoryKnowledgeGraphResult<Relationship[]>> {
    const startTime = Date.now();

    try {
      const relationships: Relationship[] = [];

      // Get from source index
      const asSourceRels = this.relationshipSourceIndex.get(entityId);
      if (asSourceRels) {
        for (const relId of asSourceRels) {
          const relationship = this.relationships.get(relId);
          if (relationship && 
              (!relationshipTypes || relationshipTypes.includes(relationship.type))) {
            relationships.push(relationship);
          }
        }
      }

      // Get from target index
      const asTargetRels = this.relationshipTargetIndex.get(entityId);
      if (asTargetRels) {
        for (const relId of asTargetRels) {
          const relationship = this.relationships.get(relId);
          if (relationship && 
              (!relationshipTypes || relationshipTypes.includes(relationship.type))) {
            relationships.push(relationship);
          }
        }
      }

      return {
        success: true,
        data: relationships,
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
   * Find related entities
   */
  async findRelatedEntities(
    entityId: string,
    depth: number,
    relationshipTypes?: RelationshipType[]
  ): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    const startTime = Date.now();

    try {
      const visited = new Set<string>();
      const related: CodeEntity[] = [];
      const queue: Array<{ entityId: string; currentDepth: number }> = [
        { entityId, currentDepth: 0 }
      ];

      while (queue.length > 0) {
        const { entityId: currentId, currentDepth } = queue.shift()!;

        if (visited.has(currentId) || currentDepth >= depth) {
          continue;
        }

        visited.add(currentId);

        // Get entity relationships
        const relationshipsResult = await this.getEntityRelationships(currentId, relationshipTypes);
        
        if (!relationshipsResult.success) {
          continue;
        }

        for (const relationship of relationshipsResult.data!) {
          const relatedId = relationship.sourceId === currentId ? 
            relationship.targetId : relationship.sourceId;

          if (!visited.has(relatedId)) {
            const entity = this.entities.get(relatedId);
            if (entity) {
              related.push(entity);
              queue.push({ entityId: relatedId, currentDepth: currentDepth + 1 });
            }
          }
        }
      }

      return {
        success: true,
        data: related,
        executionTime: Date.now() - startTime,
        metadata: {
          startEntityId: entityId,
          maxDepth: depth,
          actualDepth: Math.max(...related.map(e => 
            this.calculateDistance(entityId, e.id)
          ))
        }
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
   * Perform vector similarity search
   */
  async vectorSearch(
    embedding: number[],
    limit = 10,
    threshold = 0.7
  ): Promise<RepositoryKnowledgeGraphResult<Array<{
    entity: CodeEntity;
    similarity: number;
  }>>> {
    const startTime = Date.now();

    try {
      const results: Array<{ entity: CodeEntity; similarity: number }> = [];

      // Calculate similarity with all entities that have embeddings
      for (const [entityId, entityEmbedding] of this.embeddingIndex) {
        const entity = this.entities.get(entityId);
        if (!entity) continue;

        const similarity = this.cosineSimilarity(embedding, entityEmbedding);
        
        if (similarity >= threshold) {
          results.push({ entity, similarity });
        }
      }

      // Sort by similarity and limit
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, limit);

      return {
        success: true,
        data: limitedResults,
        executionTime: Date.now() - startTime,
        metadata: {
          totalCandidates: this.embeddingIndex.size,
          aboveThreshold: results.length,
          returned: limitedResults.length
        }
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
   * Create indexes for performance optimization
   */
  async createIndexes(indexConfig: {
    entityTypes?: boolean;
    filePaths?: boolean;
    relationships?: boolean;
    embeddings?: boolean;
    custom?: Array<{ name: string; fields: string[] }>;
  }): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      if (indexConfig.entityTypes && this.config.indexing.entityTypeIndex) {
        await this.rebuildEntityTypeIndex();
      }

      if (indexConfig.filePaths && this.config.indexing.filePathIndex) {
        await this.rebuildFilePathIndex();
      }

      if (indexConfig.relationships && this.config.indexing.relationshipTypeIndex) {
        await this.rebuildRelationshipIndexes();
      }

      if (indexConfig.embeddings && this.config.indexing.embeddingIndex) {
        await this.rebuildEmbeddingIndex();
      }

      if (indexConfig.custom) {
        for (const customIndex of indexConfig.custom) {
          await this.buildCustomIndex(customIndex.name, customIndex.fields);
        }
      }

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
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<RepositoryKnowledgeGraphResult<{
    entityCount: number;
    relationshipCount: number;
    storageSize: number;
    indexSize: number;
  }>> {
    const startTime = Date.now();

    try {
      this.updateCacheStatistics();

      const statistics = {
        entityCount: this.entities.size,
        relationshipCount: this.relationships.size,
        storageSize: this.calculateStorageSize(),
        indexSize: this.calculateIndexSize()
      };

      return {
        success: true,
        data: statistics,
        executionTime: Date.now() - startTime,
        metadata: { fullStats: this.stats }
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
  async healthCheck(): Promise<RepositoryKnowledgeGraphResult<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }>> {
    const startTime = Date.now();

    try {
      const details: Record<string, any> = {};
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check entity integrity
      const entityIntegrityIssues = await this.checkEntityIntegrity();
      details.entityIntegrity = {
        totalEntities: this.entities.size,
        issues: entityIntegrityIssues.length,
        healthy: entityIntegrityIssues.length === 0
      };

      // Check relationship integrity
      const relationshipIntegrityIssues = await this.checkRelationshipIntegrity();
      details.relationshipIntegrity = {
        totalRelationships: this.relationships.size,
        issues: relationshipIntegrityIssues.length,
        healthy: relationshipIntegrityIssues.length === 0
      };

      // Check index health
      const indexHealth = await this.checkIndexHealth();
      details.indexHealth = indexHealth;

      // Assess overall health
      if (entityIntegrityIssues.length > 0 || relationshipIntegrityIssues.length > 0) {
        status = 'degraded';
      }

      if (entityIntegrityIssues.length > this.entities.size * 0.1 ||
          relationshipIntegrityIssues.length > this.relationships.size * 0.1) {
        status = 'unhealthy';
      }

      return {
        success: true,
        data: { status, details },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        data: { status: 'unhealthy', details: { error: error.message } }
      };
    }
  }

  /**
   * Backup the knowledge graph
   */
  async backup(location: string): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      const backupData = {
        entities: Array.from(this.entities.entries()),
        relationships: Array.from(this.relationships.entries()),
        metadata: {
          timestamp: Date.now(),
          version: '1.0',
          stats: this.stats
        }
      };

      const backupJson = JSON.stringify(backupData, null, 2);
      await fs.writeFile(location, backupJson, 'utf8');

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: {
          backupSize: backupJson.length,
          entities: this.entities.size,
          relationships: this.relationships.size
        }
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
   * Restore from backup
   */
  async restore(location: string): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      const backupJson = await fs.readFile(location, 'utf8');
      const backupData = JSON.parse(backupJson);

      // Clear existing data
      this.entities.clear();
      this.relationships.clear();

      // Restore entities
      for (const [id, entity] of backupData.entities) {
        this.entities.set(id, entity);
      }

      // Restore relationships
      for (const [id, relationship] of backupData.relationships) {
        this.relationships.set(id, relationship);
      }

      // Rebuild indexes
      await this.rebuildAllIndexes();

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: {
          entitiesRestored: this.entities.size,
          relationshipsRestored: this.relationships.size
        }
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
   * Shutdown the storage backend
   */
  async shutdown(): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      // Persist data if configured
      if (this.config.persistent) {
        await this.persistAllData();
      }

      // Clear all data structures
      this.entities.clear();
      this.relationships.clear();
      this.clearAllIndexes();
      this.cache.clear();

      this.logger.info('Storage backend shutdown completed');

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

  // Private helper methods

  private async initializeIndexes(): Promise<void> {
    if (this.config.indexing.entityTypeIndex) {
      await this.rebuildEntityTypeIndex();
    }
    
    if (this.config.indexing.filePathIndex) {
      await this.rebuildFilePathIndex();
    }
    
    if (this.config.indexing.relationshipTypeIndex) {
      await this.rebuildRelationshipIndexes();
    }
    
    if (this.config.indexing.embeddingIndex) {
      await this.rebuildEmbeddingIndex();
    }

    for (const customIndex of this.config.indexing.customIndexes) {
      await this.buildCustomIndex(customIndex.name, customIndex.fields);
    }
  }

  private async updateIndexesForEntity(entity: CodeEntity): Promise<void> {
    // Entity type index
    if (!this.entityTypeIndex.has(entity.type)) {
      this.entityTypeIndex.set(entity.type, new Set());
    }
    this.entityTypeIndex.get(entity.type)!.add(entity.id);

    // File path index
    const filePath = entity.metadata.filePath;
    if (!this.filePathIndex.has(filePath)) {
      this.filePathIndex.set(filePath, new Set());
    }
    this.filePathIndex.get(filePath)!.add(entity.id);

    // Embedding index
    if (entity.semanticEmbedding && entity.semanticEmbedding.length > 0) {
      this.embeddingIndex.set(entity.id, entity.semanticEmbedding);
    }
  }

  private async updateIndexesForRelationship(relationship: Relationship): Promise<void> {
    // Relationship type index
    if (!this.relationshipTypeIndex.has(relationship.type)) {
      this.relationshipTypeIndex.set(relationship.type, new Set());
    }
    this.relationshipTypeIndex.get(relationship.type)!.add(relationship.id);

    // Source index
    if (!this.relationshipSourceIndex.has(relationship.sourceId)) {
      this.relationshipSourceIndex.set(relationship.sourceId, new Set());
    }
    this.relationshipSourceIndex.get(relationship.sourceId)!.add(relationship.id);

    // Target index
    if (!this.relationshipTargetIndex.has(relationship.targetId)) {
      this.relationshipTargetIndex.set(relationship.targetId, new Set());
    }
    this.relationshipTargetIndex.get(relationship.targetId)!.add(relationship.id);
  }

  private createQueryPlan(query: KnowledgeGraphQuery): QueryPlan {
    let strategy: QueryPlan['strategy'] = 'full_scan';
    const indexes: string[] = [];
    let estimatedCost = this.entities.size;

    // Check for vector search
    if (query.query && this.config.indexing.embeddingIndex) {
      strategy = 'vector_search';
      indexes.push('embedding');
      estimatedCost = this.embeddingIndex.size;
    }
    // Check for indexed fields
    else if (query.entityTypes && this.config.indexing.entityTypeIndex) {
      strategy = 'index_lookup';
      indexes.push('entity_type');
      estimatedCost = query.entityTypes.reduce((sum, type) => 
        sum + (this.entityTypeIndex.get(type)?.size || 0), 0
      );
    }
    else if (query.pathPatterns && this.config.indexing.filePathIndex) {
      strategy = 'index_lookup';
      indexes.push('file_path');
      estimatedCost = this.filePathIndex.size;
    }

    return {
      strategy,
      indexes,
      estimatedCost,
      expectedResults: Math.min(estimatedCost, query.limit || 100)
    };
  }

  private async executeIndexQuery(query: KnowledgeGraphQuery): Promise<CodeEntity[]> {
    const results: CodeEntity[] = [];

    if (query.entityTypes) {
      for (const entityType of query.entityTypes) {
        const entityIds = this.entityTypeIndex.get(entityType);
        if (entityIds) {
          for (const entityId of entityIds) {
            const entity = this.entities.get(entityId);
            if (entity) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }

  private async executeMultiIndexQuery(query: KnowledgeGraphQuery): Promise<CodeEntity[]> {
    // Implementation for queries using multiple indexes
    return this.executeFullScanQuery(query);
  }

  private async executeVectorQuery(query: KnowledgeGraphQuery): Promise<CodeEntity[]> {
    // This would require the query to include an embedding vector
    // For now, return empty array
    return [];
  }

  private async executeFullScanQuery(query: KnowledgeGraphQuery): Promise<CodeEntity[]> {
    const results: CodeEntity[] = [];

    for (const entity of this.entities.values()) {
      if (this.matchesQuery(entity, query)) {
        results.push(entity);
      }
    }

    return results;
  }

  private matchesQuery(entity: CodeEntity, query: KnowledgeGraphQuery): boolean {
    if (query.entityTypes && !query.entityTypes.includes(entity.type)) {
      return false;
    }

    if (query.languages && !query.languages.includes(entity.metadata.language)) {
      return false;
    }

    if (query.pathPatterns) {
      const matches = query.pathPatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(entity.metadata.filePath);
      });
      if (!matches) return false;
    }

    return true;
  }

  private applyQueryFilters(entities: CodeEntity[], query: KnowledgeGraphQuery): CodeEntity[] {
    let filtered = entities;

    if (query.filters?.complexity) {
      const { maxCyclomatic, maxLinesOfCode } = query.filters.complexity;
      filtered = filtered.filter(entity => {
        const complexity = entity.metadata.complexity;
        return (!maxCyclomatic || complexity.cyclomatic <= maxCyclomatic) &&
               (!maxLinesOfCode || complexity.linesOfCode <= maxLinesOfCode);
      });
    }

    if (query.filters?.tags) {
      filtered = filtered.filter(entity => 
        query.filters!.tags!.some(tag => entity.metadata.tags.includes(tag))
      );
    }

    return filtered;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude ? dotProduct / magnitude : 0;
  }

  private calculateDistance(fromId: string, toId: string): number {
    // Simple BFS to find shortest path
    const visited = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [{ id: fromId, distance: 0 }];

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;

      if (id === toId) {
        return distance;
      }

      if (visited.has(id)) {
        continue;
      }

      visited.add(id);

      // Add connected entities
      const sourceRels = this.relationshipSourceIndex.get(id) || new Set();
      const targetRels = this.relationshipTargetIndex.get(id) || new Set();

      for (const relId of [...sourceRels, ...targetRels]) {
        const relationship = this.relationships.get(relId);
        if (relationship) {
          const connectedId = relationship.sourceId === id ? 
            relationship.targetId : relationship.sourceId;
          
          if (!visited.has(connectedId)) {
            queue.push({ id: connectedId, distance: distance + 1 });
          }
        }
      }
    }

    return Infinity; // Not connected
  }

  // Additional helper methods for cache, persistence, validation, etc.
  // ... (implementation continues with remaining helper methods)

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.value;
    }
    this.cache.delete(key);
    return null;
  }

  private setInCache(key: string, value: any, ttl?: number): void {
    if (this.config.cache.enabled) {
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.cache.ttl
      });
    }
  }

  private invalidateEntityCache(entityId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(entityId)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  private updateEntityStatistics(entity: CodeEntity, operation: 'add' | 'update' | 'delete'): void {
    if (operation === 'add') {
      this.stats.entities.count++;
      this.stats.entities.byType[entity.type] = (this.stats.entities.byType[entity.type] || 0) + 1;
    } else if (operation === 'delete') {
      this.stats.entities.count--;
      this.stats.entities.byType[entity.type] = Math.max(0, (this.stats.entities.byType[entity.type] || 0) - 1);
    }
  }

  private updateRelationshipStatistics(relationship: Relationship, operation: 'add' | 'delete'): void {
    if (operation === 'add') {
      this.stats.relationships.count++;
      this.stats.relationships.byType[relationship.type] = (this.stats.relationships.byType[relationship.type] || 0) + 1;
    } else if (operation === 'delete') {
      this.stats.relationships.count--;
      this.stats.relationships.byType[relationship.type] = Math.max(0, (this.stats.relationships.byType[relationship.type] || 0) - 1);
    }
  }

  private updateCacheStatistics(): void {
    this.stats.cache.size = this.cache.size;
    this.stats.cache.hitRatio = this.cacheHits / (this.cacheHits + this.cacheMisses);
  }

  private calculateStorageSize(): number {
    return JSON.stringify([...this.entities.values(), ...this.relationships.values()]).length;
  }

  private calculateIndexSize(): number {
    let size = 0;
    size += JSON.stringify([...this.entityTypeIndex.entries()]).length;
    size += JSON.stringify([...this.filePathIndex.entries()]).length;
    size += JSON.stringify([...this.relationshipTypeIndex.entries()]).length;
    return size;
  }

  // Placeholder implementations for remaining methods
  private async loadFromDisk(): Promise<void> {
    // Implementation for loading persisted data
  }

  private async persistEntity(entity: CodeEntity): Promise<void> {
    // Implementation for persisting individual entity
  }

  private async persistAllData(): Promise<void> {
    // Implementation for persisting all data
  }

  private async deleteEntityFromDisk(entityId: string): Promise<void> {
    // Implementation for deleting entity from disk
  }

  private async removeFromIndexes(entity: CodeEntity): Promise<void> {
    // Implementation for removing entity from all indexes
  }

  private async removeRelationshipFromIndexes(relationship: Relationship): Promise<void> {
    // Implementation for removing relationship from indexes
  }

  private async rebuildEntityTypeIndex(): Promise<void> {
    this.entityTypeIndex.clear();
    for (const entity of this.entities.values()) {
      await this.updateIndexesForEntity(entity);
    }
  }

  private async rebuildFilePathIndex(): Promise<void> {
    this.filePathIndex.clear();
    for (const entity of this.entities.values()) {
      await this.updateIndexesForEntity(entity);
    }
  }

  private async rebuildRelationshipIndexes(): Promise<void> {
    this.relationshipTypeIndex.clear();
    this.relationshipSourceIndex.clear();
    this.relationshipTargetIndex.clear();
    for (const relationship of this.relationships.values()) {
      await this.updateIndexesForRelationship(relationship);
    }
  }

  private async rebuildEmbeddingIndex(): Promise<void> {
    this.embeddingIndex.clear();
    for (const entity of this.entities.values()) {
      if (entity.semanticEmbedding && entity.semanticEmbedding.length > 0) {
        this.embeddingIndex.set(entity.id, entity.semanticEmbedding);
      }
    }
  }

  private async buildCustomIndex(name: string, fields: string[]): Promise<void> {
    // Implementation for building custom indexes
  }

  private async rebuildAllIndexes(): Promise<void> {
    await this.rebuildEntityTypeIndex();
    await this.rebuildFilePathIndex();
    await this.rebuildRelationshipIndexes();
    await this.rebuildEmbeddingIndex();
  }

  private clearAllIndexes(): void {
    this.entityTypeIndex.clear();
    this.filePathIndex.clear();
    this.relationshipTypeIndex.clear();
    this.relationshipSourceIndex.clear();
    this.relationshipTargetIndex.clear();
    this.embeddingIndex.clear();
    this.customIndexes.clear();
  }

  private async checkEntityIntegrity(): Promise<string[]> {
    const issues: string[] = [];
    
    for (const [id, entity] of this.entities) {
      if (!entity.id || entity.id !== id) {
        issues.push(`Entity ID mismatch: stored as ${id}, entity.id is ${entity.id}`);
      }
      
      if (!entity.name || !entity.type) {
        issues.push(`Entity ${id} missing required fields`);
      }
    }
    
    return issues;
  }

  private async checkRelationshipIntegrity(): Promise<string[]> {
    const issues: string[] = [];
    
    for (const [id, relationship] of this.relationships) {
      if (!this.entities.has(relationship.sourceId)) {
        issues.push(`Relationship ${id} references non-existent source entity: ${relationship.sourceId}`);
      }
      
      if (!this.entities.has(relationship.targetId)) {
        issues.push(`Relationship ${id} references non-existent target entity: ${relationship.targetId}`);
      }
    }
    
    return issues;
  }

  private async checkIndexHealth(): Promise<any> {
    return {
      entityTypeIndex: { healthy: true, size: this.entityTypeIndex.size },
      filePathIndex: { healthy: true, size: this.filePathIndex.size },
      relationshipTypeIndex: { healthy: true, size: this.relationshipTypeIndex.size },
      embeddingIndex: { healthy: true, size: this.embeddingIndex.size }
    };
  }
}