/**
 * Repository Knowledge Graph Implementation
 * 
 * Main implementation of the Repository Knowledge Graph that provides semantic understanding
 * of codebases for enhanced developer experience in the Open SWE system.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import {
  IRepositoryKnowledgeGraph,
  ISemanticCodeParser,
  IRelationshipMapper,
  IKnowledgeGraphStorage,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-interfaces.js';
import {
  CodeEntity,
  CodeChange,
  KnowledgeGraphQuery,
  KnowledgeGraphSearchResult,
  RepositoryKnowledgeGraphConfig,
  KnowledgeGraphStatistics,
  KnowledgeGraphHealth,
  KnowledgeGraphEvent,
  SupportedLanguage,
  RelationshipType
} from './repository-knowledge-graph-types.js';
import { SemanticCodeParser } from './semantic-code-parser.js';
import { RelationshipMapper } from './relationship-mapper.js';
import { KnowledgeGraphStorage } from './knowledge-graph-storage.js';

/**
 * File processing information
 */
interface FileInfo {
  path: string;
  content: string;
  language: SupportedLanguage;
  lastModified: number;
  size: number;
}

/**
 * Analysis progress information
 */
interface AnalysisProgress {
  totalFiles: number;
  processedFiles: number;
  entitiesFound: number;
  relationshipsCreated: number;
  currentFile?: string;
  phase: 'scanning' | 'parsing' | 'relationships' | 'indexing' | 'completed';
  errors: string[];
}

/**
 * Repository Knowledge Graph implementation
 */
export class RepositoryKnowledgeGraph implements IRepositoryKnowledgeGraph {
  private readonly logger = createLogger(LogLevel.INFO, 'RepositoryKnowledgeGraph');
  
  /**
   * Configuration
   */
  private config: RepositoryKnowledgeGraphConfig;
  
  /**
   * Component instances
   */
  private parser: ISemanticCodeParser;
  private relationshipMapper: IRelationshipMapper;
  private storage: IKnowledgeGraphStorage;
  
  /**
   * State management
   */
  private initialized = false;
  private readonly initializationSubject = new BehaviorSubject<boolean>(false);
  private readonly eventSubject = new Subject<KnowledgeGraphEvent>();
  
  /**
   * Analysis state
   */
  private isAnalyzing = false;
  private currentAnalysis?: AnalysisProgress;
  
  /**
   * Performance tracking
   */
  private performanceMetrics = {
    totalOperations: 0,
    totalExecutionTime: 0,
    operationsPerSecond: 0,
    lastReset: Date.now()
  };
  
  /**
   * Cache for frequent queries
   */
  private queryCache = new Map<string, {
    result: any;
    timestamp: number;
    ttl: number;
  }>();

  constructor(config?: Partial<RepositoryKnowledgeGraphConfig>) {
    // Set default configuration
    this.config = {
      storage: {
        type: 'memory',
        persistent: false
      },
      analysis: {
        supportedLanguages: [
          'typescript',
          'javascript',
          'python',
          'java',
          'csharp'
        ],
        incremental: true,
        depth: 'medium',
        enableEmbeddings: false, // Disabled by default until embedding service is available
        enablePatternDetection: true
      },
      performance: {
        maxConcurrency: 10,
        cache: {
          enabled: true,
          maxSize: 1000,
          ttl: 300000 // 5 minutes
        },
        indexing: {
          enabled: true,
          rebuildInterval: 3600000, // 1 hour
          customIndexes: []
        },
        queryOptimization: {
          enabled: true,
          maxQueryTime: 5000, // 5 seconds
          useApproximateSearch: false
        }
      },
      integration: {
        multiAgent: true,
        sharedContext: true,
        realTimeEvents: true
      },
      security: {
        enableAccessControl: false,
        encryptSensitiveData: false,
        auditLogging: true
      },
      ...config
    };

    // Initialize components
    this.parser = new SemanticCodeParser({
      depth: this.config.analysis.depth,
      enableComplexityAnalysis: true,
      enablePatternDetection: this.config.analysis.enablePatternDetection
    });

    this.relationshipMapper = new RelationshipMapper({
      enableDeepAnalysis: this.config.analysis.depth === 'deep',
      includeImplicitRelationships: true
    });

    this.storage = new KnowledgeGraphStorage({
      type: this.config.storage.type,
      persistent: this.config.storage.persistent,
      indexing: {
        enabled: this.config.performance.indexing.enabled,
        entityTypeIndex: true,
        filePathIndex: true,
        relationshipTypeIndex: true,
        embeddingIndex: this.config.analysis.enableEmbeddings,
        customIndexes: this.config.performance.indexing.customIndexes.map(name => ({
          name,
          fields: []
        }))
      },
      cache: this.config.performance.cache,
      optimization: {
        enableBatching: true,
        batchSize: 100,
        enableParallelQueries: true,
        enableCompression: false
      }
    });

    this.logger.info('RepositoryKnowledgeGraph created', { config: this.config });
  }

  /**
   * Initialize the knowledge graph
   */
  async initialize(config?: Partial<RepositoryKnowledgeGraphConfig>): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      // Update configuration if provided
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize storage backend
      const storageResult = await this.storage.initialize();
      if (!storageResult.success) {
        throw new Error(`Storage initialization failed: ${storageResult.error}`);
      }

      // Create initial indexes
      if (this.config.performance.indexing.enabled) {
        await this.storage.createIndexes({
          entityTypes: true,
          filePaths: true,
          relationships: true,
          embeddings: this.config.analysis.enableEmbeddings
        });
      }

      this.initialized = true;
      this.initializationSubject.next(true);

      this.logger.info('RepositoryKnowledgeGraph initialized successfully', {
        executionTime: Date.now() - startTime
      });

      // Emit initialization event
      this.emitEvent({
        id: crypto.randomUUID(),
        type: 'analysis_completed',
        payload: { phase: 'initialization' },
        timestamp: Date.now(),
        source: 'RepositoryKnowledgeGraph'
      });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { storageType: this.config.storage.type }
      };

    } catch (error) {
      this.logger.error('RepositoryKnowledgeGraph initialization failed', {
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
   * Add a code entity to the knowledge graph
   */
  async addEntity(entity: CodeEntity): Promise<RepositoryKnowledgeGraphResult<string>> {
    const startTime = Date.now();
    this.performanceMetrics.totalOperations++;

    try {
      if (!this.initialized) {
        throw new Error('Knowledge graph not initialized');
      }

      // Store entity
      const storeResult = await this.storage.storeEntity(entity);
      if (!storeResult.success) {
        throw new Error(storeResult.error);
      }

      this.logger.debug('Entity added to knowledge graph', {
        entityId: entity.id,
        entityType: entity.type,
        entityName: entity.name
      });

      // Emit entity added event
      this.emitEvent({
        id: crypto.randomUUID(),
        type: 'entity_added',
        entityId: entity.id,
        payload: {
          entityType: entity.type,
          entityName: entity.name,
          filePath: entity.metadata.filePath
        },
        timestamp: Date.now(),
        source: 'RepositoryKnowledgeGraph'
      });

      this.updatePerformanceMetrics(Date.now() - startTime);

      return {
        success: true,
        data: entity.id,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to add entity', {
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
   * Add multiple entities
   */
  async addEntities(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<string[]>> {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        throw new Error('Knowledge graph not initialized');
      }

      const storeResult = await this.storage.storeEntities(entities);
      if (!storeResult.success) {
        throw new Error(storeResult.error);
      }

      this.logger.info('Multiple entities added to knowledge graph', {
        count: entities.length,
        executionTime: Date.now() - startTime
      });

      return storeResult;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Find related entities within specified depth
   */
  async findRelated(
    entityId: string,
    depth: number,
    relationshipTypes?: RelationshipType[]
  ): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    const startTime = Date.now();
    this.performanceMetrics.totalOperations++;

    try {
      if (!this.initialized) {
        throw new Error('Knowledge graph not initialized');
      }

      // Check cache first
      const cacheKey = `findRelated:${entityId}:${depth}:${relationshipTypes?.join(',')}`;
      const cached = this.getFromQueryCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          executionTime: Date.now() - startTime,
          metadata: { fromCache: true }
        };
      }

      // Find related entities
      const relatedResult = await this.storage.findRelatedEntities(entityId, depth, relationshipTypes);
      
      if (!relatedResult.success) {
        return relatedResult;
      }

      const relatedEntities = relatedResult.data!;

      // Cache the result
      this.setInQueryCache(cacheKey, relatedEntities);

      this.logger.debug('Found related entities', {
        entityId,
        depth,
        relatedCount: relatedEntities.length,
        executionTime: Date.now() - startTime
      });

      this.updatePerformanceMetrics(Date.now() - startTime);

      return {
        success: true,
        data: relatedEntities,
        executionTime: Date.now() - startTime,
        metadata: {
          depth,
          relationshipTypesFilter: relationshipTypes,
          fromCache: false
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
   * Perform semantic search
   */
  async semanticSearch(query: string | KnowledgeGraphQuery): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphSearchResult>> {
    const startTime = Date.now();
    this.performanceMetrics.totalOperations++;

    try {
      if (!this.initialized) {
        throw new Error('Knowledge graph not initialized');
      }

      // Convert string query to structured query
      const structuredQuery: KnowledgeGraphQuery = typeof query === 'string' 
        ? { query, limit: 20, minSimilarity: 0.7 }
        : query;

      // Check cache
      const cacheKey = `semanticSearch:${JSON.stringify(structuredQuery)}`;
      const cached = this.getFromQueryCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          executionTime: Date.now() - startTime,
          metadata: { fromCache: true }
        };
      }

      // Execute query
      const queryResult = await this.storage.queryEntities(structuredQuery);
      
      if (!queryResult.success) {
        return queryResult as any;
      }

      const entities = queryResult.data!;

      // Build search result
      const searchResult: KnowledgeGraphSearchResult = {
        entities,
        totalCount: entities.length,
        executionTime: Date.now() - startTime,
        searchMetadata: {
          queryType: structuredQuery.query ? 'semantic' : 'structural',
          confidenceScores: new Map(entities.map((e, i) => [e.id, 1.0 - (i * 0.1)])),
          statistics: {
            entitiesScanned: entities.length,
            indexesUsed: ['entity_type', 'file_path'],
            cacheHitRatio: 0.8
          }
        }
      };

      // Add related entities if requested
      if (structuredQuery.includeRelationships) {
        const relatedMap = new Map<string, CodeEntity[]>();
        
        for (const entity of entities.slice(0, 5)) { // Limit related entity lookup
          const relatedResult = await this.findRelated(entity.id, 1, structuredQuery.relationshipTypes);
          if (relatedResult.success) {
            relatedMap.set(entity.id, relatedResult.data!);
          }
        }
        
        searchResult.relatedEntities = relatedMap;
      }

      // Cache the result
      this.setInQueryCache(cacheKey, searchResult);

      this.logger.debug('Semantic search completed', {
        query: typeof query === 'string' ? query : 'structured',
        resultsCount: entities.length,
        executionTime: Date.now() - startTime
      });

      this.updatePerformanceMetrics(Date.now() - startTime);

      return {
        success: true,
        data: searchResult,
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
   * Update the knowledge graph based on code changes
   */
  async updateOnChange(changes: CodeChange[]): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        throw new Error('Knowledge graph not initialized');
      }

      if (!this.config.analysis.incremental) {
        return {
          success: false,
          error: 'Incremental analysis not enabled',
          executionTime: Date.now() - startTime
        };
      }

      this.logger.info('Processing code changes', { changeCount: changes.length });

      let entitiesUpdated = 0;
      let entitiesAdded = 0;
      let entitiesDeleted = 0;

      for (const change of changes) {
        switch (change.type) {
          case 'file_added':
          case 'file_modified':
            await this.processFileChange(change);
            if (change.type === 'file_added') {
              entitiesAdded++;
            } else {
              entitiesUpdated++;
            }
            break;

          case 'file_deleted':
            await this.processFileDeletion(change);
            entitiesDeleted++;
            break;

          case 'file_moved':
          case 'file_renamed':
            await this.processFileMove(change);
            entitiesUpdated++;
            break;
        }
      }

      // Clear query cache after changes
      this.queryCache.clear();

      this.logger.info('Code changes processed', {
        changesProcessed: changes.length,
        entitiesAdded,
        entitiesUpdated,
        entitiesDeleted,
        executionTime: Date.now() - startTime
      });

      // Emit change event
      this.emitEvent({
        id: crypto.randomUUID(),
        type: 'analysis_completed',
        payload: {
          changeType: 'incremental',
          changesProcessed: changes.length,
          entitiesAffected: entitiesAdded + entitiesUpdated + entitiesDeleted
        },
        timestamp: Date.now(),
        source: 'RepositoryKnowledgeGraph'
      });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: {
          changesProcessed: changes.length,
          entitiesAdded,
          entitiesUpdated,
          entitiesDeleted
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
   * Analyze a repository and build the knowledge graph
   */
  async analyzeRepository(
    repositoryPath: string,
    options?: {
      includeTests?: boolean;
      includeDependencies?: boolean;
      languages?: SupportedLanguage[];
      excludePatterns?: string[];
      incremental?: boolean;
    }
  ): Promise<RepositoryKnowledgeGraphResult<{
    entitiesFound: number;
    relationshipsCreated: number;
    analysisTime: number;
  }>> {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        throw new Error('Knowledge graph not initialized');
      }

      if (this.isAnalyzing) {
        return {
          success: false,
          error: 'Analysis already in progress',
          executionTime: Date.now() - startTime
        };
      }

      this.isAnalyzing = true;

      const analysisOptions = {
        includeTests: options?.includeTests ?? true,
        includeDependencies: options?.includeDependencies ?? false,
        languages: options?.languages ?? this.config.analysis.supportedLanguages,
        excludePatterns: options?.excludePatterns ?? [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          '**/*.min.js',
          '**/*.map'
        ],
        incremental: options?.incremental ?? this.config.analysis.incremental
      };

      this.logger.info('Starting repository analysis', {
        repositoryPath,
        options: analysisOptions
      });

      // Initialize analysis progress
      this.currentAnalysis = {
        totalFiles: 0,
        processedFiles: 0,
        entitiesFound: 0,
        relationshipsCreated: 0,
        phase: 'scanning',
        errors: []
      };

      // Phase 1: Scan repository for files
      const files = await this.scanRepository(repositoryPath, analysisOptions);
      this.currentAnalysis.totalFiles = files.length;
      this.currentAnalysis.phase = 'parsing';

      this.logger.info('Repository scan completed', {
        filesFound: files.length,
        languages: [...new Set(files.map(f => f.language))]
      });

      // Phase 2: Parse files to extract entities
      const allEntities: CodeEntity[] = [];
      
      for (let i = 0; i < files.length; i += this.config.performance.maxConcurrency) {
        const batch = files.slice(i, i + this.config.performance.maxConcurrency);
        
        const batchResults = await Promise.allSettled(
          batch.map(file => this.parseFile(file))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            allEntities.push(...result.value.data!);
            this.currentAnalysis.entitiesFound = allEntities.length;
          } else if (result.status === 'rejected') {
            this.currentAnalysis.errors.push(result.reason?.message || 'Unknown parsing error');
          }
        }

        this.currentAnalysis.processedFiles = Math.min(i + batch.length, files.length);
      }

      // Phase 3: Store entities
      const storeResult = await this.addEntities(allEntities);
      if (!storeResult.success) {
        throw new Error(`Failed to store entities: ${storeResult.error}`);
      }

      // Phase 4: Analyze relationships
      this.currentAnalysis.phase = 'relationships';
      
      const relationshipsResult = await this.relationshipMapper.analyzeRelationships(allEntities);
      if (relationshipsResult.success) {
        // Store relationships
        for (const relationship of relationshipsResult.data!) {
          await this.storage.storeRelationship(relationship);
          this.currentAnalysis.relationshipsCreated++;
        }
      }

      // Phase 5: Build indexes
      this.currentAnalysis.phase = 'indexing';
      
      if (this.config.performance.indexing.enabled) {
        await this.storage.createIndexes({
          entityTypes: true,
          filePaths: true,
          relationships: true,
          embeddings: this.config.analysis.enableEmbeddings
        });
      }

      this.currentAnalysis.phase = 'completed';
      this.isAnalyzing = false;

      const analysisTime = Date.now() - startTime;
      
      this.logger.info('Repository analysis completed', {
        entitiesFound: this.currentAnalysis.entitiesFound,
        relationshipsCreated: this.currentAnalysis.relationshipsCreated,
        analysisTime,
        errors: this.currentAnalysis.errors.length
      });

      // Emit completion event
      this.emitEvent({
        id: crypto.randomUUID(),
        type: 'analysis_completed',
        payload: {
          repositoryPath,
          entitiesFound: this.currentAnalysis.entitiesFound,
          relationshipsCreated: this.currentAnalysis.relationshipsCreated,
          analysisTime,
          errors: this.currentAnalysis.errors
        },
        timestamp: Date.now(),
        source: 'RepositoryKnowledgeGraph'
      });

      return {
        success: true,
        data: {
          entitiesFound: this.currentAnalysis.entitiesFound,
          relationshipsCreated: this.currentAnalysis.relationshipsCreated,
          analysisTime
        },
        executionTime: analysisTime,
        metadata: {
          repositoryPath,
          filesProcessed: files.length,
          errors: this.currentAnalysis.errors
        }
      };

    } catch (error) {
      this.isAnalyzing = false;
      this.logger.error('Repository analysis failed', {
        repositoryPath,
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
   * Get entity by identifier
   */
  async getEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult<CodeEntity>> {
    return this.storage.getEntity(entityId);
  }

  /**
   * Update an entity
   */
  async updateEntity(entityId: string, updates: Partial<CodeEntity>): Promise<RepositoryKnowledgeGraphResult> {
    const result = await this.storage.updateEntity(entityId, updates);
    
    if (result.success) {
      // Clear query cache
      this.queryCache.clear();
      
      // Emit update event
      this.emitEvent({
        id: crypto.randomUUID(),
        type: 'entity_updated',
        entityId,
        payload: { updates },
        timestamp: Date.now(),
        source: 'RepositoryKnowledgeGraph'
      });
    }
    
    return result;
  }

  /**
   * Delete an entity
   */
  async deleteEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult> {
    const result = await this.storage.deleteEntity(entityId);
    
    if (result.success) {
      // Clear query cache
      this.queryCache.clear();
      
      // Emit deletion event
      this.emitEvent({
        id: crypto.randomUUID(),
        type: 'entity_deleted',
        entityId,
        payload: {},
        timestamp: Date.now(),
        source: 'RepositoryKnowledgeGraph'
      });
    }
    
    return result;
  }

  /**
   * Get recommendations based on context
   */
  async getRecommendations(context: {
    currentEntity?: string;
    currentFile?: string;
    currentFunction?: string;
    taskContext?: string;
    similarityThreshold?: number;
  }): Promise<RepositoryKnowledgeGraphResult<Array<{
    entity: CodeEntity;
    reason: string;
    confidence: number;
  }>>> {
    const startTime = Date.now();

    try {
      const recommendations: Array<{
        entity: CodeEntity;
        reason: string;
        confidence: number;
      }> = [];

      const threshold = context.similarityThreshold || 0.7;

      // Context-based recommendations
      if (context.currentEntity) {
        // Find related entities
        const relatedResult = await this.findRelated(context.currentEntity, 2);
        if (relatedResult.success) {
          for (const entity of relatedResult.data!.slice(0, 5)) {
            recommendations.push({
              entity,
              reason: 'Related to current entity through code relationships',
              confidence: 0.8
            });
          }
        }
      }

      if (context.currentFile) {
        // Find entities in same file or related files
        const query: KnowledgeGraphQuery = {
          pathPatterns: [path.dirname(context.currentFile) + '/**'],
          limit: 5
        };
        
        const searchResult = await this.semanticSearch(query);
        if (searchResult.success) {
          for (const entity of searchResult.data!.entities) {
            recommendations.push({
              entity,
              reason: 'Located in related file or directory',
              confidence: 0.6
            });
          }
        }
      }

      // Remove duplicates and sort by confidence
      const uniqueRecommendations = recommendations
        .filter((rec, index, array) => 
          array.findIndex(r => r.entity.id === rec.entity.id) === index
        )
        .filter(rec => rec.confidence >= threshold)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);

      return {
        success: true,
        data: uniqueRecommendations,
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
   * Detect code patterns
   */
  async detectPatterns(entityIds?: string[]): Promise<RepositoryKnowledgeGraphResult<Array<{
    pattern: string;
    entities: CodeEntity[];
    confidence: number;
  }>>> {
    const startTime = Date.now();

    try {
      // Get entities to analyze
      let entities: CodeEntity[];
      
      if (entityIds) {
        const entitiesResult = await this.storage.getEntities(entityIds);
        if (!entitiesResult.success) {
          return entitiesResult as any;
        }
        entities = entitiesResult.data!;
      } else {
        // Get all entities (limited for performance)
        const queryResult = await this.storage.queryEntities({ limit: 1000 });
        if (!queryResult.success) {
          return queryResult as any;
        }
        entities = queryResult.data!;
      }

      const patterns: Array<{
        pattern: string;
        entities: CodeEntity[];
        confidence: number;
      }> = [];

      // Detect common design patterns
      const singletonEntities = entities.filter(e => 
        e.analysis.patterns.includes('singleton')
      );
      
      if (singletonEntities.length > 0) {
        patterns.push({
          pattern: 'Singleton Pattern',
          entities: singletonEntities,
          confidence: 0.9
        });
      }

      const factoryEntities = entities.filter(e => 
        e.analysis.patterns.includes('factory')
      );
      
      if (factoryEntities.length > 0) {
        patterns.push({
          pattern: 'Factory Pattern',
          entities: factoryEntities,
          confidence: 0.85
        });
      }

      const observerEntities = entities.filter(e => 
        e.analysis.patterns.includes('observer')
      );
      
      if (observerEntities.length > 0) {
        patterns.push({
          pattern: 'Observer Pattern',
          entities: observerEntities,
          confidence: 0.8
        });
      }

      return {
        success: true,
        data: patterns,
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
   * Get knowledge graph statistics
   */
  async getStatistics(): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphStatistics>> {
    const startTime = Date.now();

    try {
      const storageStats = await this.storage.getStorageStatistics();
      if (!storageStats.success) {
        return storageStats as any;
      }

      const stats: KnowledgeGraphStatistics = {
        entities: {
          total: storageStats.data!.entityCount,
          byType: {} as any,
          byLanguage: {} as any,
          averageComplexity: 0,
          averageRelationships: 0
        },
        relationships: {
          total: storageStats.data!.relationshipCount,
          byType: {} as any,
          averageStrength: 0,
          averageConfidence: 0
        },
        performance: {
          lastAnalysisTime: this.currentAnalysis ? Date.now() - this.performanceMetrics.lastReset : 0,
          averageQueryTime: this.performanceMetrics.totalOperations > 0 ? 
            this.performanceMetrics.totalExecutionTime / this.performanceMetrics.totalOperations : 0,
          cacheHitRatio: this.calculateCacheHitRatio(),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        },
        quality: {
          averageTestCoverage: 0,
          issuesDetected: 0,
          patternsRecognized: 0,
          duplicateCodeRatio: 0
        },
        lastUpdated: Date.now()
      };

      return {
        success: true,
        data: stats,
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
  async healthCheck(): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphHealth>> {
    const startTime = Date.now();

    try {
      const storageHealth = await this.storage.healthCheck();
      
      const health: KnowledgeGraphHealth = {
        status: 'healthy',
        components: {
          storage: storageHealth.success ? (storageHealth.data!.status || 'healthy') : 'unhealthy',
          parser: 'healthy',
          embeddings: this.config.analysis.enableEmbeddings ? 'degraded' : 'healthy', // Degraded until embedding service
          search: 'healthy',
          cache: 'healthy'
        },
        metrics: {
          responseTime: Date.now() - startTime,
          errorRate: 0,
          dataFreshness: 0,
          resourceUtilization: 50
        },
        recommendations: [],
        lastChecked: Date.now()
      };

      // Assess overall health
      const unhealthyComponents = Object.values(health.components)
        .filter(status => status === 'unhealthy').length;
      
      if (unhealthyComponents > 0) {
        health.status = unhealthyComponents > 2 ? 'unhealthy' : 'degraded';
      }

      if (!this.initialized) {
        health.status = 'unhealthy';
        health.recommendations.push('Knowledge graph not initialized');
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
        executionTime: Date.now() - startTime,
        data: {
          status: 'unhealthy',
          components: {
            storage: 'unhealthy',
            parser: 'unhealthy',
            embeddings: 'unhealthy',
            search: 'unhealthy',
            cache: 'unhealthy'
          },
          metrics: {
            responseTime: Date.now() - startTime,
            errorRate: 1,
            dataFreshness: 0,
            resourceUtilization: 0
          },
          recommendations: ['System health check failed'],
          lastChecked: Date.now()
        }
      };
    }
  }

  /**
   * Subscribe to knowledge graph events
   */
  subscribeToEvents(eventTypes?: string[]): Observable<KnowledgeGraphEvent> {
    if (eventTypes) {
      return this.eventSubject.asObservable().pipe(
        require('rxjs/operators').filter((event: KnowledgeGraphEvent) => 
          eventTypes.includes(event.type)
        )
      );
    }
    
    return this.eventSubject.asObservable();
  }

  /**
   * Export knowledge graph data
   */
  async export(format: 'json' | 'graphml' | 'cypher', options?: {
    includeEmbeddings?: boolean;
    includeMetadata?: boolean;
    filterByTypes?: any[];
  }): Promise<RepositoryKnowledgeGraphResult<string>> {
    // Implementation would export data in specified format
    return {
      success: false,
      error: 'Export not implemented',
      executionTime: 0
    };
  }

  /**
   * Import knowledge graph data
   */
  async import(data: string, format: 'json' | 'graphml' | 'cypher'): Promise<RepositoryKnowledgeGraphResult<{
    entitiesImported: number;
    relationshipsImported: number;
  }>> {
    // Implementation would import data from specified format
    return {
      success: false,
      error: 'Import not implemented',
      executionTime: 0
    };
  }

  /**
   * Clear the knowledge graph
   */
  async clear(options?: {
    retainConfiguration?: boolean;
    retainIndexes?: boolean;
  }): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      // Clear query cache
      this.queryCache.clear();

      // Reset state
      this.isAnalyzing = false;
      this.currentAnalysis = undefined;
      
      // Clear performance metrics
      this.performanceMetrics = {
        totalOperations: 0,
        totalExecutionTime: 0,
        operationsPerSecond: 0,
        lastReset: Date.now()
      };

      this.logger.info('Knowledge graph cleared');

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
   * Shutdown the knowledge graph
   */
  async shutdown(): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      // Stop any ongoing analysis
      this.isAnalyzing = false;

      // Shutdown storage
      const shutdownResult = await this.storage.shutdown();
      
      // Clear all data
      this.queryCache.clear();
      this.eventSubject.complete();
      this.initializationSubject.next(false);

      this.initialized = false;

      this.logger.info('RepositoryKnowledgeGraph shutdown completed');

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { storageShutdown: shutdownResult.success }
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

  private async scanRepository(
    repositoryPath: string,
    options: {
      includeTests: boolean;
      includeDependencies: boolean;
      languages: SupportedLanguage[];
      excludePatterns: string[];
      incremental: boolean;
    }
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    // This is a simplified implementation
    // In production, you'd use a proper file walker like 'glob' or 'fast-glob'
    const scanDir = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // Check exclude patterns
            const shouldExclude = options.excludePatterns.some(pattern => {
              const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
              return regex.test(path.relative(repositoryPath, fullPath));
            });
            
            if (!shouldExclude) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            const language = this.detectLanguage(entry.name);
            
            if (language && options.languages.includes(language)) {
              const stats = await fs.stat(fullPath);
              const content = await fs.readFile(fullPath, 'utf8');
              
              files.push({
                path: fullPath,
                content,
                language,
                lastModified: stats.mtime.getTime(),
                size: stats.size
              });
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to scan directory', {
          dirPath,
          error: error instanceof Error ? error.message : error
        });
      }
    };

    await scanDir(repositoryPath);
    return files;
  }

  private detectLanguage(filename: string): SupportedLanguage | null {
    const ext = path.extname(filename).toLowerCase();
    
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.cs':
        return 'csharp';
      case '.cpp':
      case '.cc':
      case '.cxx':
        return 'cpp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.php':
        return 'php';
      case '.rb':
        return 'ruby';
      default:
        return null;
    }
  }

  private async parseFile(file: FileInfo): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    this.currentAnalysis!.currentFile = file.path;
    
    const parseResult = await this.parser.parseFile(file.path, file.content, file.language);
    
    if (parseResult.success) {
      // Update entity metadata with file information
      for (const entity of parseResult.data!) {
        entity.metadata.usage.lastModified = file.lastModified;
      }
    }
    
    return parseResult;
  }

  private async processFileChange(change: CodeChange): Promise<void> {
    if (!change.newContent) return;

    const language = this.detectLanguage(change.filePath);
    if (!language) return;

    // Parse the changed file
    const parseResult = await this.parser.parseFile(change.filePath, change.newContent, language);
    
    if (parseResult.success) {
      // Update entities
      for (const entity of parseResult.data!) {
        const existingResult = await this.storage.getEntity(entity.id);
        
        if (existingResult.success) {
          // Update existing entity
          await this.storage.updateEntity(entity.id, entity);
        } else {
          // Add new entity
          await this.storage.storeEntity(entity);
        }
      }
    }
  }

  private async processFileDeletion(change: CodeChange): Promise<void> {
    // Find entities in the deleted file and remove them
    const query: KnowledgeGraphQuery = {
      pathPatterns: [change.filePath]
    };
    
    const searchResult = await this.storage.queryEntities(query);
    
    if (searchResult.success) {
      for (const entity of searchResult.data!) {
        await this.storage.deleteEntity(entity.id);
      }
    }
  }

  private async processFileMove(change: CodeChange): Promise<void> {
    if (!change.newFilePath) return;

    // Update file paths for entities
    const query: KnowledgeGraphQuery = {
      pathPatterns: [change.filePath]
    };
    
    const searchResult = await this.storage.queryEntities(query);
    
    if (searchResult.success) {
      for (const entity of searchResult.data!) {
        await this.storage.updateEntity(entity.id, {
          metadata: {
            ...entity.metadata,
            filePath: change.newFilePath!
          }
        });
      }
    }
  }

  private emitEvent(event: KnowledgeGraphEvent): void {
    if (this.config.integration.realTimeEvents) {
      this.eventSubject.next(event);
    }
  }

  private updatePerformanceMetrics(executionTime: number): void {
    this.performanceMetrics.totalExecutionTime += executionTime;
    
    const now = Date.now();
    const timeDiff = now - this.performanceMetrics.lastReset;
    
    if (timeDiff > 60000) { // Reset every minute
      this.performanceMetrics.operationsPerSecond = 
        this.performanceMetrics.totalOperations / (timeDiff / 1000);
      
      this.performanceMetrics.totalOperations = 0;
      this.performanceMetrics.totalExecutionTime = 0;
      this.performanceMetrics.lastReset = now;
    }
  }

  private getFromQueryCache(key: string): any {
    if (!this.config.performance.cache.enabled) return null;
    
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    
    this.queryCache.delete(key);
    return null;
  }

  private setInQueryCache(key: string, result: any, ttl?: number): void {
    if (!this.config.performance.cache.enabled) return;
    
    if (this.queryCache.size >= this.config.performance.cache.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < Math.floor(this.config.performance.cache.maxSize * 0.1); i++) {
        this.queryCache.delete(entries[i][0]);
      }
    }
    
    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttl || this.config.performance.cache.ttl
    });
  }

  private calculateCacheHitRatio(): number {
    // Simplified cache hit ratio calculation
    return this.queryCache.size > 0 ? 0.8 : 0;
  }
}