/**
 * Repository Knowledge Graph - Main Export Index
 * 
 * Central export point for all Repository Knowledge Graph components,
 * providing semantic understanding of codebases for enhanced developer experience.
 */

// Core types and interfaces
export * from './repository-knowledge-graph-types.js';
export * from './repository-knowledge-graph-interfaces.js';

// Main implementation
export { RepositoryKnowledgeGraph } from './repository-knowledge-graph.js';

// Component implementations
export { SemanticCodeParser } from './semantic-code-parser.js';
export { RelationshipMapper } from './relationship-mapper.js';
export { KnowledgeGraphStorage } from './knowledge-graph-storage.js';

// Re-export commonly used types for convenience
export type {
  CodeEntity,
  Relationship,
  KnowledgeGraphQuery,
  KnowledgeGraphSearchResult,
  RepositoryKnowledgeGraphConfig,
  KnowledgeGraphStatistics,
  KnowledgeGraphHealth,
  KnowledgeGraphEvent,
  CodeEntityType,
  RelationshipType,
  SupportedLanguage
} from './repository-knowledge-graph-types.js';

export type {
  IRepositoryKnowledgeGraph,
  ISemanticCodeParser,
  IRelationshipMapper,
  IKnowledgeGraphStorage,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-interfaces.js';

/**
 * Factory function to create a configured Repository Knowledge Graph instance
 * 
 * @param config - Optional configuration
 * @returns Configured RepositoryKnowledgeGraph instance
 */
export function createRepositoryKnowledgeGraph(
  config?: Partial<RepositoryKnowledgeGraphConfig>
): RepositoryKnowledgeGraph {
  return new RepositoryKnowledgeGraph(config);
}

/**
 * Default configuration for Repository Knowledge Graph
 */
export const DEFAULT_REPOSITORY_KNOWLEDGE_GRAPH_CONFIG: RepositoryKnowledgeGraphConfig = {
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
    enableEmbeddings: false,
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
  }
};