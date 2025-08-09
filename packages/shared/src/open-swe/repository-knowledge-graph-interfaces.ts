/**
 * Repository Knowledge Graph Interfaces
 * 
 * Interface definitions for the Repository Knowledge Graph implementation
 * that provides semantic understanding of codebases for enhanced developer experience.
 */

import { Observable } from 'rxjs';
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
  CodeEntityType,
  RelationshipType,
  Relationship
} from './repository-knowledge-graph-types.js';

/**
 * Result type for Repository Knowledge Graph operations
 */
export interface RepositoryKnowledgeGraphResult<T = any> {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Result data if successful
   */
  data?: T;

  /**
   * Error message if unsuccessful
   */
  error?: string;

  /**
   * Operation execution time in milliseconds
   */
  executionTime: number;

  /**
   * Additional metadata about the operation
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for semantic code parser that extracts entities from source code
 */
export interface ISemanticCodeParser {
  /**
   * Parse source code to extract entities
   * 
   * @param filePath - Path to the source file
   * @param content - Source code content
   * @param language - Programming language
   * @returns Promise resolving to extracted entities
   */
  parseFile(
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Parse multiple files concurrently
   * 
   * @param files - Array of file information
   * @returns Promise resolving to all extracted entities
   */
  parseFiles(files: Array<{
    path: string;
    content: string;
    language: SupportedLanguage;
  }>): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Get supported languages
   * 
   * @returns Array of supported programming languages
   */
  getSupportedLanguages(): SupportedLanguage[];

  /**
   * Validate if a language is supported
   * 
   * @param language - Language to validate
   * @returns True if language is supported
   */
  isLanguageSupported(language: string): boolean;

  /**
   * Configure parser settings
   * 
   * @param config - Parser configuration
   */
  configure(config: {
    depth?: 'shallow' | 'medium' | 'deep';
    includePrivate?: boolean;
    includeComments?: boolean;
    customPatterns?: string[];
  }): void;
}

/**
 * Interface for relationship mapping between code entities
 */
export interface IRelationshipMapper {
  /**
   * Analyze relationships between entities
   * 
   * @param entities - Array of code entities to analyze
   * @returns Promise resolving to discovered relationships
   */
  analyzeRelationships(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<Relationship[]>>;

  /**
   * Find relationships for a specific entity
   * 
   * @param entity - Entity to analyze
   * @param allEntities - All entities in the knowledge graph
   * @returns Promise resolving to relationships involving the entity
   */
  findEntityRelationships(
    entity: CodeEntity,
    allEntities: CodeEntity[]
  ): Promise<RepositoryKnowledgeGraphResult<Relationship[]>>;

  /**
   * Validate relationship integrity
   * 
   * @param relationships - Relationships to validate
   * @param entities - Available entities
   * @returns Promise resolving to validation results
   */
  validateRelationships(
    relationships: Relationship[],
    entities: CodeEntity[]
  ): Promise<RepositoryKnowledgeGraphResult<{
    valid: Relationship[];
    invalid: Relationship[];
    issues: string[];
  }>>;

  /**
   * Get supported relationship types
   * 
   * @returns Array of supported relationship types
   */
  getSupportedRelationshipTypes(): RelationshipType[];

  /**
   * Calculate relationship strength
   * 
   * @param relationship - Relationship to analyze
   * @returns Strength score (0-1)
   */
  calculateRelationshipStrength(relationship: Relationship): Promise<number>;
}

/**
 * Interface for semantic embedding generation
 */
export interface ISemanticEmbeddingGenerator {
  /**
   * Generate semantic embeddings for code entities
   * 
   * @param entities - Entities to generate embeddings for
   * @returns Promise resolving to entities with embeddings
   */
  generateEmbeddings(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Generate embedding for a single entity
   * 
   * @param entity - Entity to generate embedding for
   * @returns Promise resolving to embedding vector
   */
  generateEntityEmbedding(entity: CodeEntity): Promise<RepositoryKnowledgeGraphResult<number[]>>;

  /**
   * Calculate similarity between entities
   * 
   * @param entity1 - First entity
   * @param entity2 - Second entity
   * @returns Promise resolving to similarity score (0-1)
   */
  calculateSimilarity(entity1: CodeEntity, entity2: CodeEntity): Promise<number>;

  /**
   * Find similar entities
   * 
   * @param entity - Reference entity
   * @param candidates - Candidate entities to compare against
   * @param threshold - Minimum similarity threshold
   * @returns Promise resolving to similar entities with scores
   */
  findSimilarEntities(
    entity: CodeEntity,
    candidates: CodeEntity[],
    threshold?: number
  ): Promise<RepositoryKnowledgeGraphResult<Array<{
    entity: CodeEntity;
    similarity: number;
  }>>>;

  /**
   * Configure embedding generation
   * 
   * @param config - Embedding configuration
   */
  configure(config: {
    provider: 'openai' | 'huggingface' | 'local';
    model: string;
    apiKey?: string;
    dimensions?: number;
    batchSize?: number;
  }): void;
}

/**
 * Interface for graph storage backend
 */
export interface IKnowledgeGraphStorage {
  /**
   * Initialize the storage backend
   * 
   * @returns Promise resolving to initialization result
   */
  initialize(): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Store a code entity
   * 
   * @param entity - Entity to store
   * @returns Promise resolving to storage result
   */
  storeEntity(entity: CodeEntity): Promise<RepositoryKnowledgeGraphResult<string>>;

  /**
   * Store multiple entities
   * 
   * @param entities - Entities to store
   * @returns Promise resolving to storage results
   */
  storeEntities(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<string[]>>;

  /**
   * Retrieve an entity by ID
   * 
   * @param entityId - Entity identifier
   * @returns Promise resolving to the entity
   */
  getEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult<CodeEntity>>;

  /**
   * Retrieve multiple entities
   * 
   * @param entityIds - Entity identifiers
   * @returns Promise resolving to entities
   */
  getEntities(entityIds: string[]): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Update an entity
   * 
   * @param entityId - Entity identifier
   * @param updates - Updates to apply
   * @returns Promise resolving to update result
   */
  updateEntity(entityId: string, updates: Partial<CodeEntity>): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Delete an entity
   * 
   * @param entityId - Entity identifier
   * @returns Promise resolving to deletion result
   */
  deleteEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Query entities
   * 
   * @param query - Query parameters
   * @returns Promise resolving to query results
   */
  queryEntities(query: KnowledgeGraphQuery): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Store a relationship
   * 
   * @param relationship - Relationship to store
   * @returns Promise resolving to storage result
   */
  storeRelationship(relationship: Relationship): Promise<RepositoryKnowledgeGraphResult<string>>;

  /**
   * Get relationships for an entity
   * 
   * @param entityId - Entity identifier
   * @param relationshipTypes - Optional filter for relationship types
   * @returns Promise resolving to relationships
   */
  getEntityRelationships(
    entityId: string,
    relationshipTypes?: RelationshipType[]
  ): Promise<RepositoryKnowledgeGraphResult<Relationship[]>>;

  /**
   * Find related entities
   * 
   * @param entityId - Starting entity identifier
   * @param depth - Maximum traversal depth
   * @param relationshipTypes - Optional filter for relationship types
   * @returns Promise resolving to related entities
   */
  findRelatedEntities(
    entityId: string,
    depth: number,
    relationshipTypes?: RelationshipType[]
  ): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Perform vector similarity search
   * 
   * @param embedding - Query embedding vector
   * @param limit - Maximum number of results
   * @param threshold - Minimum similarity threshold
   * @returns Promise resolving to similar entities
   */
  vectorSearch(
    embedding: number[],
    limit?: number,
    threshold?: number
  ): Promise<RepositoryKnowledgeGraphResult<Array<{
    entity: CodeEntity;
    similarity: number;
  }>>>;

  /**
   * Create indexes for performance optimization
   * 
   * @param indexConfig - Index configuration
   * @returns Promise resolving to index creation result
   */
  createIndexes(indexConfig: {
    entityTypes?: boolean;
    filePaths?: boolean;
    relationships?: boolean;
    embeddings?: boolean;
    custom?: Array<{
      name: string;
      fields: string[];
    }>;
  }): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Get storage statistics
   * 
   * @returns Promise resolving to storage statistics
   */
  getStorageStatistics(): Promise<RepositoryKnowledgeGraphResult<{
    entityCount: number;
    relationshipCount: number;
    storageSize: number;
    indexSize: number;
  }>>;

  /**
   * Perform health check
   * 
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<RepositoryKnowledgeGraphResult<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }>>;

  /**
   * Backup the knowledge graph
   * 
   * @param location - Backup location
   * @returns Promise resolving to backup result
   */
  backup(location: string): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Restore from backup
   * 
   * @param location - Backup location
   * @returns Promise resolving to restore result
   */
  restore(location: string): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Shutdown the storage backend
   * 
   * @returns Promise resolving to shutdown result
   */
  shutdown(): Promise<RepositoryKnowledgeGraphResult>;
}

/**
 * Main Repository Knowledge Graph interface
 */
export interface IRepositoryKnowledgeGraph {
  /**
   * Initialize the knowledge graph
   * 
   * @param config - Configuration options
   * @returns Promise resolving to initialization result
   */
  initialize(config?: Partial<RepositoryKnowledgeGraphConfig>): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Add a code entity to the knowledge graph
   * 
   * @param entity - Entity to add
   * @returns Promise resolving to addition result
   */
  addEntity(entity: CodeEntity): Promise<RepositoryKnowledgeGraphResult<string>>;

  /**
   * Add multiple entities
   * 
   * @param entities - Entities to add
   * @returns Promise resolving to addition results
   */
  addEntities(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<string[]>>;

  /**
   * Find related entities within specified depth
   * 
   * @param entityId - Starting entity identifier
   * @param depth - Maximum traversal depth
   * @param relationshipTypes - Optional filter for relationship types
   * @returns Promise resolving to related entities
   */
  findRelated(
    entityId: string,
    depth: number,
    relationshipTypes?: RelationshipType[]
  ): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>>;

  /**
   * Perform semantic search
   * 
   * @param query - Search query (text or structured)
   * @returns Promise resolving to search results
   */
  semanticSearch(query: string | KnowledgeGraphQuery): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphSearchResult>>;

  /**
   * Update the knowledge graph based on code changes
   * 
   * @param changes - Array of code changes
   * @returns Promise resolving to update result
   */
  updateOnChange(changes: CodeChange[]): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Analyze a repository and build the knowledge graph
   * 
   * @param repositoryPath - Path to the repository
   * @param options - Analysis options
   * @returns Promise resolving to analysis result
   */
  analyzeRepository(
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
  }>>;

  /**
   * Get entity by identifier
   * 
   * @param entityId - Entity identifier
   * @returns Promise resolving to the entity
   */
  getEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult<CodeEntity>>;

  /**
   * Update an entity
   * 
   * @param entityId - Entity identifier
   * @param updates - Updates to apply
   * @returns Promise resolving to update result
   */
  updateEntity(entityId: string, updates: Partial<CodeEntity>): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Delete an entity
   * 
   * @param entityId - Entity identifier
   * @returns Promise resolving to deletion result
   */
  deleteEntity(entityId: string): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Get recommendations based on context
   * 
   * @param context - Context information
   * @returns Promise resolving to recommendations
   */
  getRecommendations(context: {
    currentEntity?: string;
    currentFile?: string;
    currentFunction?: string;
    taskContext?: string;
    similarityThreshold?: number;
  }): Promise<RepositoryKnowledgeGraphResult<Array<{
    entity: CodeEntity;
    reason: string;
    confidence: number;
  }>>>;

  /**
   * Detect code patterns
   * 
   * @param entityIds - Optional specific entities to analyze
   * @returns Promise resolving to detected patterns
   */
  detectPatterns(entityIds?: string[]): Promise<RepositoryKnowledgeGraphResult<Array<{
    pattern: string;
    entities: CodeEntity[];
    confidence: number;
  }>>>;

  /**
   * Get knowledge graph statistics
   * 
   * @returns Promise resolving to statistics
   */
  getStatistics(): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphStatistics>>;

  /**
   * Perform health check
   * 
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphHealth>>;

  /**
   * Subscribe to knowledge graph events
   * 
   * @param eventTypes - Optional filter for event types
   * @returns Observable stream of events
   */
  subscribeToEvents(eventTypes?: string[]): Observable<KnowledgeGraphEvent>;

  /**
   * Export knowledge graph data
   * 
   * @param format - Export format
   * @param options - Export options
   * @returns Promise resolving to exported data
   */
  export(format: 'json' | 'graphml' | 'cypher', options?: {
    includeEmbeddings?: boolean;
    includeMetadata?: boolean;
    filterByTypes?: CodeEntityType[];
  }): Promise<RepositoryKnowledgeGraphResult<string>>;

  /**
   * Import knowledge graph data
   * 
   * @param data - Data to import
   * @param format - Data format
   * @returns Promise resolving to import result
   */
  import(data: string, format: 'json' | 'graphml' | 'cypher'): Promise<RepositoryKnowledgeGraphResult<{
    entitiesImported: number;
    relationshipsImported: number;
  }>>;

  /**
   * Clear the knowledge graph
   * 
   * @param options - Clear options
   * @returns Promise resolving to clear result
   */
  clear(options?: {
    retainConfiguration?: boolean;
    retainIndexes?: boolean;
  }): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Shutdown the knowledge graph
   * 
   * @returns Promise resolving to shutdown result
   */
  shutdown(): Promise<RepositoryKnowledgeGraphResult>;
}

/**
 * Interface for incremental analysis engine
 */
export interface IIncrementalAnalysisEngine {
  /**
   * Process code changes incrementally
   * 
   * @param changes - Array of code changes
   * @param knowledgeGraph - Knowledge graph instance
   * @returns Promise resolving to processing result
   */
  processChanges(
    changes: CodeChange[],
    knowledgeGraph: IRepositoryKnowledgeGraph
  ): Promise<RepositoryKnowledgeGraphResult<{
    entitiesUpdated: number;
    entitiesAdded: number;
    entitiesDeleted: number;
    relationshipsUpdated: number;
  }>>;

  /**
   * Detect impact of changes
   * 
   * @param changes - Code changes to analyze
   * @param knowledgeGraph - Knowledge graph instance
   * @returns Promise resolving to impact analysis
   */
  analyzeImpact(
    changes: CodeChange[],
    knowledgeGraph: IRepositoryKnowledgeGraph
  ): Promise<RepositoryKnowledgeGraphResult<{
    affectedEntities: CodeEntity[];
    impactScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  }>>;

  /**
   * Optimize incremental processing
   * 
   * @param config - Optimization configuration
   * @returns Optimization result
   */
  optimize(config: {
    batchSize?: number;
    concurrency?: number;
    prioritizeRecent?: boolean;
    smartCaching?: boolean;
  }): RepositoryKnowledgeGraphResult;
}

/**
 * Interface for integration with Open SWE multi-agent system
 */
export interface IMultiAgentKnowledgeGraphIntegration {
  /**
   * Register the knowledge graph with the multi-agent system
   * 
   * @param knowledgeGraph - Knowledge graph instance
   * @param multiAgentSystem - Multi-agent system instance
   * @returns Promise resolving to registration result
   */
  registerWithMultiAgent(
    knowledgeGraph: IRepositoryKnowledgeGraph,
    multiAgentSystem: any // Would import proper type from multi-agent system
  ): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Handle agent queries for code knowledge
   * 
   * @param agentId - Requesting agent ID
   * @param query - Knowledge query
   * @returns Promise resolving to query results
   */
  handleAgentQuery(
    agentId: string,
    query: KnowledgeGraphQuery
  ): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphSearchResult>>;

  /**
   * Provide context to agents based on current task
   * 
   * @param taskId - Current task identifier
   * @param agentIds - Agent IDs to provide context to
   * @returns Promise resolving to context provision result
   */
  provideTaskContext(
    taskId: string,
    agentIds: string[]
  ): Promise<RepositoryKnowledgeGraphResult>;

  /**
   * Subscribe to multi-agent events
   * 
   * @param eventTypes - Event types to subscribe to
   * @returns Observable stream of relevant events
   */
  subscribeToAgentEvents(eventTypes?: string[]): Observable<any>;

  /**
   * Share knowledge graph insights with agents
   * 
   * @param insights - Insights to share
   * @param targetAgents - Target agent IDs
   * @returns Promise resolving to sharing result
   */
  shareInsights(
    insights: Array<{
      type: 'pattern' | 'issue' | 'recommendation' | 'similarity';
      data: any;
      confidence: number;
    }>,
    targetAgents: string[]
  ): Promise<RepositoryKnowledgeGraphResult>;
}