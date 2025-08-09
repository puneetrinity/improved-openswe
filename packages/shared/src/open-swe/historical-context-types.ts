/**
 * Historical Context System Types
 * 
 * Provides comprehensive type definitions for the Historical Context System
 * that enables agents to learn from past interactions and maintain context
 * across sessions.
 */

import { AgentProfile, SharedContext, TaskDelegation } from './types.js';

/**
 * Historical context entry representing a stored interaction
 */
export interface HistoricalContext {
  /** Unique identifier for the context entry */
  id: string;
  
  /** Session identifier */
  sessionId: string;
  
  /** Agent that created this context */
  agentId: string;
  
  /** Timestamp when context was created */
  timestamp: Date;
  
  /** Type of context entry */
  type: ContextType;
  
  /** Main content of the context */
  content: ContextContent;
  
  /** Metadata about the context */
  metadata: ContextMetadata;
  
  /** Relevance score (0-1) */
  relevanceScore?: number;
  
  /** Tags for categorization */
  tags: string[];
  
  /** Version information */
  version: ContextVersion;
  
  /** Privacy level */
  privacyLevel: PrivacyLevel;
}

/**
 * Types of historical contexts
 */
export type ContextType = 
  | 'interaction'
  | 'decision'
  | 'error'
  | 'success'
  | 'pattern'
  | 'insight'
  | 'feedback'
  | 'task_completion'
  | 'code_review'
  | 'bug_fix'
  | 'optimization'
  | 'architectural_decision';

/**
 * Content of a historical context entry
 */
export interface ContextContent {
  /** Human-readable summary */
  summary: string;
  
  /** Detailed description */
  description?: string;
  
  /** Structured data */
  data?: Record<string, unknown>;
  
  /** Related code snippets */
  codeSnippets?: CodeSnippet[];
  
  /** Related files */
  files?: string[];
  
  /** Conversation messages */
  messages?: ContextMessage[];
  
  /** Outcome or result */
  outcome?: ContextOutcome;
}

/**
 * Code snippet in historical context
 */
export interface CodeSnippet {
  /** File path */
  filePath: string;
  
  /** Language */
  language: string;
  
  /** Code content */
  content: string;
  
  /** Line range */
  lineRange?: { start: number; end: number };
  
  /** Purpose or description */
  purpose?: string;
}

/**
 * Context message for conversations
 */
export interface ContextMessage {
  /** Role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system' | 'agent';
  
  /** Message content */
  content: string;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Agent ID if from agent */
  agentId?: string;
}

/**
 * Outcome of a context interaction
 */
export interface ContextOutcome {
  /** Success status */
  success: boolean;
  
  /** Result description */
  result?: string;
  
  /** Metrics or measurements */
  metrics?: Record<string, number>;
  
  /** User satisfaction (1-5) */
  satisfaction?: number;
  
  /** Follow-up actions needed */
  followUpActions?: string[];
}

/**
 * Context metadata
 */
export interface ContextMetadata {
  /** Repository information */
  repository?: {
    name: string;
    url?: string;
    branch?: string;
    commit?: string;
  };
  
  /** Task information */
  task?: {
    id: string;
    type: string;
    complexity: number;
    priority: string;
  };
  
  /** Performance metrics */
  performance?: {
    duration: number;
    resourceUsage: number;
    quality: number;
  };
  
  /** User context */
  user?: {
    experience: string;
    preferences: string[];
  };
  
  /** Environment info */
  environment?: {
    platform: string;
    version: string;
    config: Record<string, unknown>;
  };
}

/**
 * Context version information
 */
export interface ContextVersion {
  /** Version number */
  version: number;
  
  /** Parent version ID */
  parentId?: string;
  
  /** Branch name if applicable */
  branch?: string;
  
  /** Change description */
  changes?: string[];
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Creator agent/user */
  createdBy: string;
}

/**
 * Privacy levels for context entries
 */
export type PrivacyLevel = 
  | 'public'      // Available to all agents
  | 'shared'      // Available to agents in same session
  | 'private'     // Available only to creating agent
  | 'confidential' // Encrypted storage, restricted access
  | 'temporary';  // Auto-delete after session

/**
 * Query for searching historical contexts
 */
export interface ContextQuery {
  /** Text search query */
  query?: string;
  
  /** Context types to search */
  types?: ContextType[];
  
  /** Agent ID filter */
  agentId?: string;
  
  /** Session ID filter */
  sessionId?: string;
  
  /** Date range */
  dateRange?: {
    from: Date;
    to: Date;
  };
  
  /** Tag filters */
  tags?: string[];
  
  /** Minimum relevance score */
  minRelevance?: number;
  
  /** Maximum results */
  limit?: number;
  
  /** Privacy level restrictions */
  privacyLevels?: PrivacyLevel[];
  
  /** Repository filter */
  repository?: string;
  
  /** Include related contexts */
  includeRelated?: boolean;
}

/**
 * Search results for historical contexts
 */
export interface ContextSearchResult {
  /** Found contexts */
  contexts: HistoricalContext[];
  
  /** Total count (may be larger than returned results) */
  totalCount: number;
  
  /** Search metadata */
  searchMetadata: {
    /** Query execution time */
    executionTime: number;
    
    /** Relevance scores distribution */
    relevanceDistribution: {
      min: number;
      max: number;
      avg: number;
    };
    
    /** Applied filters */
    appliedFilters: Record<string, unknown>;
  };
  
  /** Suggested related queries */
  suggestedQueries?: string[];
}

/**
 * Relevance scoring configuration
 */
export interface RelevanceConfig {
  /** Temporal decay factor (0-1) */
  temporalDecay: number;
  
  /** Semantic similarity weight (0-1) */
  semanticWeight: number;
  
  /** Interaction outcome weight (0-1) */
  outcomeWeight: number;
  
  /** User feedback weight (0-1) */
  feedbackWeight: number;
  
  /** Context type preference weights */
  typeWeights: Record<ContextType, number>;
  
  /** Enable machine learning scoring */
  enableMLScoring: boolean;
  
  /** Minimum score threshold for inclusion */
  minScoreThreshold: number;
}

/**
 * Session carryover configuration
 */
export interface CarryoverConfig {
  /** Maximum contexts to carry over */
  maxContexts: number;
  
  /** Minimum relevance for carryover */
  minRelevance: number;
  
  /** Context types to include */
  includedTypes: ContextType[];
  
  /** Enable context summarization */
  enableSummarization: boolean;
  
  /** Maximum age for carryover contexts */
  maxAge: number; // in hours
  
  /** Privacy levels allowed for carryover */
  allowedPrivacyLevels: PrivacyLevel[];
}

/**
 * Historical context statistics
 */
export interface ContextStatistics {
  /** Total contexts stored */
  totalContexts: number;
  
  /** Contexts by type */
  contextsByType: Record<ContextType, number>;
  
  /** Contexts by agent */
  contextsByAgent: Record<string, number>;
  
  /** Average relevance score */
  averageRelevance: number;
  
  /** Storage size metrics */
  storage: {
    totalSize: number; // bytes
    averageContextSize: number;
    compressionRatio: number;
  };
  
  /** Performance metrics */
  performance: {
    averageQueryTime: number; // ms
    averageIndexTime: number; // ms
    cacheHitRate: number; // percentage
  };
  
  /** Usage patterns */
  usage: {
    queriesPerHour: number;
    popularQueries: string[];
    activeAgents: string[];
  };
}

/**
 * Context persistence configuration
 */
export interface PersistenceConfig {
  /** Storage backend type */
  backend: 'memory' | 'file' | 'database' | 'cloud';
  
  /** Connection settings for backend */
  connection?: Record<string, unknown>;
  
  /** Retention policy */
  retention: {
    /** Default retention period (days) */
    defaultPeriod: number;
    
    /** Retention by context type */
    typeSpecific: Record<ContextType, number>;
    
    /** Auto-cleanup enabled */
    autoCleanup: boolean;
    
    /** Cleanup frequency (hours) */
    cleanupFrequency: number;
  };
  
  /** Compression settings */
  compression: {
    /** Enable compression */
    enabled: boolean;
    
    /** Algorithm */
    algorithm: 'gzip' | 'brotli' | 'lz4';
    
    /** Compression level */
    level: number;
  };
  
  /** Backup settings */
  backup: {
    /** Enable automatic backups */
    enabled: boolean;
    
    /** Backup frequency (hours) */
    frequency: number;
    
    /** Backup location */
    location: string;
    
    /** Keep backup count */
    keepCount: number;
  };
}

/**
 * Context learning feedback
 */
export interface ContextFeedback {
  /** Context ID */
  contextId: string;
  
  /** Agent providing feedback */
  agentId: string;
  
  /** Feedback type */
  type: 'helpful' | 'not_helpful' | 'incorrect' | 'outdated' | 'irrelevant';
  
  /** Feedback score (1-5) */
  score: number;
  
  /** Optional comment */
  comment?: string;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Context in which feedback was given */
  feedbackContext?: {
    query: string;
    taskType: string;
    expectedOutcome: string;
  };
}

/**
 * Learning pattern detected in historical data
 */
export interface LearningPattern {
  /** Pattern ID */
  id: string;
  
  /** Pattern type */
  type: 'success_sequence' | 'error_pattern' | 'user_preference' | 'optimization_opportunity';
  
  /** Pattern description */
  description: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Supporting contexts */
  supportingContexts: string[];
  
  /** Recommended actions */
  recommendations: string[];
  
  /** Pattern metadata */
  metadata: {
    frequency: number;
    lastSeen: Date;
    agents: string[];
    repositories: string[];
  };
}

/**
 * Integration settings for multi-agent system
 */
export interface MultiAgentIntegrationConfig {
  /** Enable cross-agent learning */
  enableCrossAgentLearning: boolean;
  
  /** Shared context pool */
  sharedContextPool: {
    /** Maximum shared contexts */
    maxSize: number;
    
    /** Sharing criteria */
    sharingCriteria: {
      minRelevance: number;
      requiredTags: string[];
      excludedPrivacyLevels: PrivacyLevel[];
    };
  };
  
  /** Agent specialization learning */
  specializationLearning: {
    /** Track agent expertise areas */
    trackExpertise: boolean;
    
    /** Expertise decay factor */
    expertiseDecay: number;
    
    /** Minimum interactions for expertise */
    minInteractionsForExpertise: number;
  };
  
  /** Collaborative filtering */
  collaborativeFiltering: {
    /** Enable recommendation sharing */
    enableRecommendationSharing: boolean;
    
    /** Similar agent threshold */
    similarAgentThreshold: number;
    
    /** Recommendation confidence boost */
    confidenceBoost: number;
  };
}