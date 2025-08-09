/**
 * Repository Knowledge Graph Types and Interfaces
 * 
 * Core type definitions for Phase 2 implementation of the Repository Knowledge Graph
 * that provides semantic understanding of codebases for enhanced developer experience.
 */

import { Observable } from 'rxjs';

/**
 * Types of code entities that can be analyzed and stored in the knowledge graph
 */
export type CodeEntityType = 
  | 'class'
  | 'function' 
  | 'module'
  | 'variable'
  | 'interface'
  | 'enum'
  | 'type'
  | 'method'
  | 'property'
  | 'constant'
  | 'namespace'
  | 'component'
  | 'service'
  | 'decorator'
  | 'annotation';

/**
 * Programming languages supported by the knowledge graph
 */
export type SupportedLanguage = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby';

/**
 * Types of relationships between code entities
 */
export type RelationshipType =
  | 'extends'
  | 'implements'
  | 'calls'
  | 'imports'
  | 'exports'
  | 'uses'
  | 'depends_on'
  | 'instantiates'
  | 'overrides'
  | 'throws'
  | 'returns'
  | 'accepts_parameter'
  | 'accesses'
  | 'modifies'
  | 'contains'
  | 'references'
  | 'composition'
  | 'aggregation'
  | 'association';

/**
 * Metadata for code entities including metrics and analysis results
 */
export interface EntityMetadata {
  /**
   * File path where the entity is defined
   */
  filePath: string;

  /**
   * Line number where entity starts
   */
  startLine: number;

  /**
   * Line number where entity ends
   */
  endLine: number;

  /**
   * Programming language
   */
  language: SupportedLanguage;

  /**
   * Visibility/access modifier
   */
  visibility: 'public' | 'private' | 'protected' | 'internal' | 'package';

  /**
   * Whether the entity is static
   */
  isStatic?: boolean;

  /**
   * Whether the entity is abstract
   */
  isAbstract?: boolean;

  /**
   * Whether the entity is deprecated
   */
  isDeprecated?: boolean;

  /**
   * Documentation comments
   */
  documentation?: string;

  /**
   * Code complexity metrics
   */
  complexity: {
    /**
     * Cyclomatic complexity
     */
    cyclomatic: number;

    /**
     * Lines of code
     */
    linesOfCode: number;

    /**
     * Number of parameters (for functions/methods)
     */
    parameterCount?: number;

    /**
     * Nesting depth
     */
    nestingDepth: number;
  };

  /**
   * Quality metrics
   */
  quality: {
    /**
     * Code coverage percentage (0-100)
     */
    testCoverage?: number;

    /**
     * Number of test cases
     */
    testCount?: number;

    /**
     * Code duplication score (0-1)
     */
    duplicationScore?: number;

    /**
     * Maintainability index (0-100)
     */
    maintainabilityIndex?: number;
  };

  /**
   * Usage statistics
   */
  usage: {
    /**
     * How many times this entity is referenced
     */
    referenceCount: number;

    /**
     * How many times this entity is modified
     */
    modificationCount: number;

    /**
     * Last modification timestamp
     */
    lastModified: number;

    /**
     * Frequency of access in recent period
     */
    accessFrequency: number;
  };

  /**
   * Additional custom properties
   */
  tags: string[];
  
  /**
   * Security annotations
   */
  security?: {
    hasSecurityAnnotations: boolean;
    securityLevel: 'low' | 'medium' | 'high' | 'critical';
    vulnerabilities: string[];
  };

  /**
   * Performance characteristics
   */
  performance?: {
    estimatedExecutionTime?: number;
    memoryUsage?: number;
    computationalComplexity?: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)' | 'O(2^n)';
  };
}

/**
 * Relationship between two code entities with metadata
 */
export interface Relationship {
  /**
   * Unique identifier for the relationship
   */
  id: string;

  /**
   * Type of relationship
   */
  type: RelationshipType;

  /**
   * Source entity ID
   */
  sourceId: string;

  /**
   * Target entity ID
   */
  targetId: string;

  /**
   * Strength of the relationship (0-1)
   */
  strength: number;

  /**
   * Confidence in the relationship (0-1)
   */
  confidence: number;

  /**
   * Additional metadata about the relationship
   */
  metadata: {
    /**
     * File path where relationship is established
     */
    definitionPath?: string;

    /**
     * Line number where relationship is defined
     */
    definitionLine?: number;

    /**
     * Context or reason for the relationship
     */
    context?: string;

    /**
     * Bidirectional relationship flag
     */
    bidirectional: boolean;

    /**
     * Relationship cardinality
     */
    cardinality?: '1:1' | '1:n' | 'n:1' | 'n:n';

    /**
     * When the relationship was discovered
     */
    discoveredAt: number;

    /**
     * Last verification timestamp
     */
    lastVerified: number;
  };
}

/**
 * Code entity representing a semantic element in the codebase
 */
export interface CodeEntity {
  /**
   * Unique identifier for the entity
   */
  id: string;

  /**
   * Type of the code entity
   */
  type: CodeEntityType;

  /**
   * Name of the entity
   */
  name: string;

  /**
   * Fully qualified name including namespace/module path
   */
  fullyQualifiedName: string;

  /**
   * Relationships to other entities
   */
  relationships: Relationship[];

  /**
   * Semantic embedding vector for similarity search
   */
  semanticEmbedding: number[];

  /**
   * Entity metadata including metrics and analysis
   */
  metadata: EntityMetadata;

  /**
   * Raw source code of the entity
   */
  sourceCode: string;

  /**
   * Normalized/processed code for analysis
   */
  normalizedCode?: string;

  /**
   * Abstract syntax tree representation
   */
  ast?: any; // Could be more specific based on parser used

  /**
   * Hash of the source code for change detection
   */
  contentHash: string;

  /**
   * Version information
   */
  version: {
    /**
     * Current version number
     */
    current: number;

    /**
     * Version history for change tracking
     */
    history: EntityVersion[];
  };

  /**
   * Analysis results and insights
   */
  analysis: {
    /**
     * Detected patterns
     */
    patterns: string[];

    /**
     * Potential issues or code smells
     */
    issues: CodeIssue[];

    /**
     * Suggestions for improvement
     */
    suggestions: string[];

    /**
     * Similarity to known patterns
     */
    patternSimilarity: PatternMatch[];
  };
}

/**
 * Version information for an entity
 */
export interface EntityVersion {
  /**
   * Version number
   */
  version: number;

  /**
   * Timestamp of this version
   */
  timestamp: number;

  /**
   * Content hash at this version
   */
  contentHash: string;

  /**
   * Changes made in this version
   */
  changes: ChangeInfo[];

  /**
   * Author of the changes
   */
  author?: string;

  /**
   * Commit or changeset identifier
   */
  commitId?: string;
}

/**
 * Information about changes to an entity
 */
export interface ChangeInfo {
  /**
   * Type of change
   */
  type: 'added' | 'modified' | 'deleted' | 'moved' | 'renamed';

  /**
   * Description of the change
   */
  description: string;

  /**
   * Impact score of the change (0-1)
   */
  impact: number;

  /**
   * Affected relationships
   */
  affectedRelationships: string[];
}

/**
 * Code issue detected during analysis
 */
export interface CodeIssue {
  /**
   * Issue identifier
   */
  id: string;

  /**
   * Type of issue
   */
  type: 'code_smell' | 'anti_pattern' | 'security' | 'performance' | 'maintainability' | 'complexity';

  /**
   * Severity level
   */
  severity: 'info' | 'warning' | 'error' | 'critical';

  /**
   * Issue description
   */
  description: string;

  /**
   * Suggested fix
   */
  suggestion?: string;

  /**
   * Confidence in the detection (0-1)
   */
  confidence: number;

  /**
   * Location information
   */
  location: {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  };
}

/**
 * Pattern matching result
 */
export interface PatternMatch {
  /**
   * Pattern identifier
   */
  patternId: string;

  /**
   * Pattern name
   */
  patternName: string;

  /**
   * Similarity score (0-1)
   */
  similarity: number;

  /**
   * Confidence in the match (0-1)
   */
  confidence: number;

  /**
   * Pattern category
   */
  category: 'design_pattern' | 'architectural_pattern' | 'anti_pattern' | 'code_pattern';
}

/**
 * Code change information for incremental updates
 */
export interface CodeChange {
  /**
   * Change identifier
   */
  id: string;

  /**
   * Type of change
   */
  type: 'file_added' | 'file_modified' | 'file_deleted' | 'file_moved' | 'file_renamed';

  /**
   * File path affected
   */
  filePath: string;

  /**
   * New file path (for moves/renames)
   */
  newFilePath?: string;

  /**
   * Content before change
   */
  oldContent?: string;

  /**
   * Content after change
   */
  newContent?: string;

  /**
   * Timestamp of change
   */
  timestamp: number;

  /**
   * Author of the change
   */
  author?: string;

  /**
   * Commit identifier
   */
  commitId?: string;

  /**
   * Affected entities
   */
  affectedEntities: string[];

  /**
   * New entities created
   */
  newEntities?: string[];

  /**
   * Entities deleted
   */
  deletedEntities?: string[];
}

/**
 * Query parameters for searching the knowledge graph
 */
export interface KnowledgeGraphQuery {
  /**
   * Text query for semantic search
   */
  query?: string;

  /**
   * Entity types to search for
   */
  entityTypes?: CodeEntityType[];

  /**
   * Programming languages to include
   */
  languages?: SupportedLanguage[];

  /**
   * File path patterns to include
   */
  pathPatterns?: string[];

  /**
   * Minimum similarity threshold for semantic search
   */
  minSimilarity?: number;

  /**
   * Maximum number of results
   */
  limit?: number;

  /**
   * Skip number of results (for pagination)
   */
  offset?: number;

  /**
   * Include relationships in results
   */
  includeRelationships?: boolean;

  /**
   * Maximum relationship depth to traverse
   */
  maxDepth?: number;

  /**
   * Relationship types to consider
   */
  relationshipTypes?: RelationshipType[];

  /**
   * Filters for entity metadata
   */
  filters?: {
    complexity?: {
      maxCyclomatic?: number;
      maxLinesOfCode?: number;
    };
    quality?: {
      minTestCoverage?: number;
      maxDuplicationScore?: number;
    };
    usage?: {
      minReferenceCount?: number;
      recentlyModified?: boolean;
    };
    tags?: string[];
  };
}

/**
 * Search results from the knowledge graph
 */
export interface KnowledgeGraphSearchResult {
  /**
   * Found entities
   */
  entities: CodeEntity[];

  /**
   * Total number of matching entities (for pagination)
   */
  totalCount: number;

  /**
   * Search execution time in milliseconds
   */
  executionTime: number;

  /**
   * Related entities if requested
   */
  relatedEntities?: Map<string, CodeEntity[]>;

  /**
   * Search metadata
   */
  searchMetadata: {
    /**
     * Query type used
     */
    queryType: 'semantic' | 'structural' | 'hybrid';

    /**
     * Confidence scores for results
     */
    confidenceScores: Map<string, number>;

    /**
     * Search statistics
     */
    statistics: {
      entitiesScanned: number;
      indexesUsed: string[];
      cacheHitRatio: number;
    };
  };
}

/**
 * Configuration for the Repository Knowledge Graph
 */
export interface RepositoryKnowledgeGraphConfig {
  /**
   * Storage configuration
   */
  storage: {
    /**
     * Storage backend type
     */
    type: 'memory' | 'file' | 'database' | 'distributed';

    /**
     * Connection or file path
     */
    location?: string;

    /**
     * Enable persistence
     */
    persistent: boolean;

    /**
     * Backup configuration
     */
    backup?: {
      enabled: boolean;
      interval: number;
      location: string;
    };
  };

  /**
   * Analysis configuration
   */
  analysis: {
    /**
     * Languages to analyze
     */
    supportedLanguages: SupportedLanguage[];

    /**
     * Enable incremental analysis
     */
    incremental: boolean;

    /**
     * Analysis depth
     */
    depth: 'shallow' | 'medium' | 'deep';

    /**
     * Enable semantic embeddings
     */
    enableEmbeddings: boolean;

    /**
     * Embedding model configuration
     */
    embeddingModel?: {
      provider: 'openai' | 'huggingface' | 'local';
      model: string;
      apiKey?: string;
    };

    /**
     * Enable pattern detection
     */
    enablePatternDetection: boolean;

    /**
     * Custom patterns to detect
     */
    customPatterns?: string[];
  };

  /**
   * Performance configuration
   */
  performance: {
    /**
     * Maximum entities to process concurrently
     */
    maxConcurrency: number;

    /**
     * Cache configuration
     */
    cache: {
      enabled: boolean;
      maxSize: number;
      ttl: number; // Time to live in milliseconds
    };

    /**
     * Index configuration
     */
    indexing: {
      enabled: boolean;
      rebuildInterval: number; // Milliseconds
      customIndexes: string[];
    };

    /**
     * Query optimization
     */
    queryOptimization: {
      enabled: boolean;
      maxQueryTime: number; // Milliseconds
      useApproximateSearch: boolean;
    };
  };

  /**
   * Integration configuration
   */
  integration: {
    /**
     * Enable multi-agent integration
     */
    multiAgent: boolean;

    /**
     * Shared context store integration
     */
    sharedContext: boolean;

    /**
     * Event emission for real-time updates
     */
    realTimeEvents: boolean;

    /**
     * Webhook endpoints for external systems
     */
    webhooks?: string[];
  };

  /**
   * Security configuration
   */
  security: {
    /**
     * Enable access control
     */
    enableAccessControl: boolean;

    /**
     * Encrypt sensitive data
     */
    encryptSensitiveData: boolean;

    /**
     * Audit logging
     */
    auditLogging: boolean;
  };
}

/**
 * Statistics about the knowledge graph
 */
export interface KnowledgeGraphStatistics {
  /**
   * Entity statistics
   */
  entities: {
    total: number;
    byType: Record<CodeEntityType, number>;
    byLanguage: Record<SupportedLanguage, number>;
    averageComplexity: number;
    averageRelationships: number;
  };

  /**
   * Relationship statistics
   */
  relationships: {
    total: number;
    byType: Record<RelationshipType, number>;
    averageStrength: number;
    averageConfidence: number;
  };

  /**
   * Performance statistics
   */
  performance: {
    lastAnalysisTime: number;
    averageQueryTime: number;
    cacheHitRatio: number;
    memoryUsage: number; // In MB
  };

  /**
   * Quality statistics
   */
  quality: {
    averageTestCoverage: number;
    issuesDetected: number;
    patternsRecognized: number;
    duplicateCodeRatio: number;
  };

  /**
   * Last update timestamp
   */
  lastUpdated: number;
}

/**
 * Health status of the knowledge graph
 */
export interface KnowledgeGraphHealth {
  /**
   * Overall health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * Component health
   */
  components: {
    storage: 'healthy' | 'degraded' | 'unhealthy';
    parser: 'healthy' | 'degraded' | 'unhealthy';
    embeddings: 'healthy' | 'degraded' | 'unhealthy';
    search: 'healthy' | 'degraded' | 'unhealthy';
    cache: 'healthy' | 'degraded' | 'unhealthy';
  };

  /**
   * Health metrics
   */
  metrics: {
    responseTime: number;
    errorRate: number;
    dataFreshness: number; // Age of oldest unprocessed change in minutes
    resourceUtilization: number; // Percentage
  };

  /**
   * Health recommendations
   */
  recommendations: string[];

  /**
   * Last health check timestamp
   */
  lastChecked: number;
}

/**
 * Event emitted by the knowledge graph
 */
export interface KnowledgeGraphEvent {
  /**
   * Event identifier
   */
  id: string;

  /**
   * Event type
   */
  type: 'entity_added' | 'entity_updated' | 'entity_deleted' | 'relationship_added' | 'relationship_updated' | 'relationship_deleted' | 'analysis_completed' | 'pattern_detected' | 'issue_found';

  /**
   * Related entity ID
   */
  entityId?: string;

  /**
   * Related relationship ID
   */
  relationshipId?: string;

  /**
   * Event payload
   */
  payload: any;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Source of the event
   */
  source: string;
}