/**
 * Historical Context System
 * 
 * Provides context persistence, relevance scoring, and session carryover
 * mechanisms for the Open SWE multi-agent system.
 */

import { EventEmitter } from 'events';
import { Observable, Subject } from 'rxjs';
import { 
  HistoricalContext, 
  ContextQuery, 
  ContextSearchResult,
  RelevanceConfig,
  CarryoverConfig,
  ContextStatistics,
  PersistenceConfig,
  ContextFeedback,
  LearningPattern,
  MultiAgentIntegrationConfig,
  ContextType,
  PrivacyLevel,
  ContextContent
} from './historical-context-types.js';

/**
 * Main interface for historical context operations
 */
export interface IHistoricalContextSystem {
  // Core operations
  storeContext(context: Omit<HistoricalContext, 'id' | 'timestamp' | 'relevanceScore'>): Promise<string>;
  retrieveContext(id: string): Promise<HistoricalContext | null>;
  searchContexts(query: ContextQuery): Promise<ContextSearchResult>;
  deleteContext(id: string): Promise<boolean>;
  
  // Session management
  getSessionContexts(sessionId: string): Promise<HistoricalContext[]>;
  carryoverContexts(fromSessionId: string, toSessionId: string): Promise<HistoricalContext[]>;
  
  // Learning and feedback
  addFeedback(feedback: ContextFeedback): Promise<void>;
  getPatterns(agentId?: string): Promise<LearningPattern[]>;
  
  // Statistics and monitoring
  getStatistics(): Promise<ContextStatistics>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Context persistence layer
 */
export interface IContextPersistence {
  store(context: HistoricalContext): Promise<void>;
  retrieve(id: string): Promise<HistoricalContext | null>;
  search(query: ContextQuery): Promise<HistoricalContext[]>;
  delete(id: string): Promise<boolean>;
  getStatistics(): Promise<ContextStatistics>;
  cleanup(): Promise<void>;
}

/**
 * Relevance scoring engine
 */
export interface IRelevanceScorer {
  scoreContext(context: HistoricalContext, query: ContextQuery): Promise<number>;
  scoreContexts(contexts: HistoricalContext[], query: ContextQuery): Promise<Map<string, number>>;
  updateScores(feedback: ContextFeedback): Promise<void>;
  getConfig(): RelevanceConfig;
  updateConfig(config: Partial<RelevanceConfig>): Promise<void>;
}

/**
 * In-memory context persistence implementation
 */
export class MemoryContextPersistence implements IContextPersistence {
  private contexts = new Map<string, HistoricalContext>();
  private indexes = {
    bySession: new Map<string, Set<string>>(),
    byAgent: new Map<string, Set<string>>(),
    byType: new Map<ContextType, Set<string>>(),
    byRepository: new Map<string, Set<string>>(),
    byTags: new Map<string, Set<string>>()
  };

  async store(context: HistoricalContext): Promise<void> {
    this.contexts.set(context.id, context);
    this.updateIndexes(context);
  }

  async retrieve(id: string): Promise<HistoricalContext | null> {
    return this.contexts.get(id) || null;
  }

  async search(query: ContextQuery): Promise<HistoricalContext[]> {
    let candidateIds = new Set<string>(this.contexts.keys());

    // Apply filters
    if (query.sessionId) {
      const sessionIds = this.indexes.bySession.get(query.sessionId) || new Set();
      candidateIds = this.intersect(candidateIds, sessionIds);
    }

    if (query.agentId) {
      const agentIds = this.indexes.byAgent.get(query.agentId) || new Set();
      candidateIds = this.intersect(candidateIds, agentIds);
    }

    if (query.types && query.types.length > 0) {
      let typeIds = new Set<string>();
      for (const type of query.types) {
        const ids = this.indexes.byType.get(type) || new Set();
        typeIds = this.union(typeIds, ids);
      }
      candidateIds = this.intersect(candidateIds, typeIds);
    }

    if (query.repository) {
      const repoIds = this.indexes.byRepository.get(query.repository) || new Set();
      candidateIds = this.intersect(candidateIds, repoIds);
    }

    if (query.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        const tagIds = this.indexes.byTags.get(tag) || new Set();
        candidateIds = this.intersect(candidateIds, tagIds);
      }
    }

    // Get contexts and apply additional filters
    let results: HistoricalContext[] = [];
    for (const id of candidateIds) {
      const context = this.contexts.get(id);
      if (!context) continue;

      // Date range filter
      if (query.dateRange) {
        if (context.timestamp < query.dateRange.from || 
            context.timestamp > query.dateRange.to) {
          continue;
        }
      }

      // Relevance filter
      if (query.minRelevance && 
          (!context.relevanceScore || context.relevanceScore < query.minRelevance)) {
        continue;
      }

      // Privacy filter
      if (query.privacyLevels && 
          !query.privacyLevels.includes(context.privacyLevel)) {
        continue;
      }

      // Text search (simple contains)
      if (query.query) {
        const searchText = `${context.content.summary} ${context.content.description || ''}`.toLowerCase();
        if (!searchText.includes(query.query.toLowerCase())) {
          continue;
        }
      }

      results.push(context);
    }

    // Sort by relevance score (descending) then by timestamp (descending)
    results.sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async delete(id: string): Promise<boolean> {
    const context = this.contexts.get(id);
    if (!context) return false;

    this.contexts.delete(id);
    this.removeFromIndexes(context);
    return true;
  }

  async getStatistics(): Promise<ContextStatistics> {
    const contexts = Array.from(this.contexts.values());
    const totalSize = JSON.stringify(contexts).length;

    const contextsByType: Record<ContextType, number> = {} as any;
    const contextsByAgent: Record<string, number> = {};
    let totalRelevance = 0;
    let relevanceCount = 0;

    for (const context of contexts) {
      // Count by type
      contextsByType[context.type] = (contextsByType[context.type] || 0) + 1;
      
      // Count by agent
      contextsByAgent[context.agentId] = (contextsByAgent[context.agentId] || 0) + 1;
      
      // Average relevance
      if (context.relevanceScore) {
        totalRelevance += context.relevanceScore;
        relevanceCount++;
      }
    }

    return {
      totalContexts: contexts.length,
      contextsByType,
      contextsByAgent,
      averageRelevance: relevanceCount > 0 ? totalRelevance / relevanceCount : 0,
      storage: {
        totalSize,
        averageContextSize: contexts.length > 0 ? totalSize / contexts.length : 0,
        compressionRatio: 1.0 // No compression in memory
      },
      performance: {
        averageQueryTime: 5, // Estimated
        averageIndexTime: 1, // Estimated
        cacheHitRate: 100 // Memory is cache
      },
      usage: {
        queriesPerHour: 0, // Would need tracking
        popularQueries: [],
        activeAgents: Object.keys(contextsByAgent)
      }
    };
  }

  async cleanup(): Promise<void> {
    // Implement retention policy cleanup
    const now = new Date();
    const contexts = Array.from(this.contexts.values());
    
    for (const context of contexts) {
      const ageHours = (now.getTime() - context.timestamp.getTime()) / (1000 * 60 * 60);
      
      // Default cleanup after 30 days for temporary contexts
      if (context.privacyLevel === 'temporary' && ageHours > 24 * 30) {
        await this.delete(context.id);
      }
    }
  }

  private updateIndexes(context: HistoricalContext): void {
    const id = context.id;
    
    // Session index
    if (!this.indexes.bySession.has(context.sessionId)) {
      this.indexes.bySession.set(context.sessionId, new Set());
    }
    this.indexes.bySession.get(context.sessionId)!.add(id);
    
    // Agent index
    if (!this.indexes.byAgent.has(context.agentId)) {
      this.indexes.byAgent.set(context.agentId, new Set());
    }
    this.indexes.byAgent.get(context.agentId)!.add(id);
    
    // Type index
    if (!this.indexes.byType.has(context.type)) {
      this.indexes.byType.set(context.type, new Set());
    }
    this.indexes.byType.get(context.type)!.add(id);
    
    // Repository index
    const repo = context.metadata.repository?.name;
    if (repo) {
      if (!this.indexes.byRepository.has(repo)) {
        this.indexes.byRepository.set(repo, new Set());
      }
      this.indexes.byRepository.get(repo)!.add(id);
    }
    
    // Tags index
    for (const tag of context.tags) {
      if (!this.indexes.byTags.has(tag)) {
        this.indexes.byTags.set(tag, new Set());
      }
      this.indexes.byTags.get(tag)!.add(id);
    }
  }

  private removeFromIndexes(context: HistoricalContext): void {
    const id = context.id;
    
    this.indexes.bySession.get(context.sessionId)?.delete(id);
    this.indexes.byAgent.get(context.agentId)?.delete(id);
    this.indexes.byType.get(context.type)?.delete(id);
    
    const repo = context.metadata.repository?.name;
    if (repo) {
      this.indexes.byRepository.get(repo)?.delete(id);
    }
    
    for (const tag of context.tags) {
      this.indexes.byTags.get(tag)?.delete(id);
    }
  }

  private intersect<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA].filter(x => setB.has(x)));
  }

  private union<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA, ...setB]);
  }
}

/**
 * ML-based relevance scoring implementation
 */
export class MLRelevanceScorer implements IRelevanceScorer {
  private config: RelevanceConfig;
  private feedbackHistory = new Map<string, ContextFeedback[]>();

  constructor(config: RelevanceConfig) {
    this.config = config;
  }

  async scoreContext(context: HistoricalContext, query: ContextQuery): Promise<number> {
    let score = 0;
    let totalWeight = 0;

    // Temporal relevance (newer is better)
    if (this.config.temporalDecay > 0) {
      const ageHours = (Date.now() - context.timestamp.getTime()) / (1000 * 60 * 60);
      const temporalScore = Math.exp(-ageHours / (24 * 7)); // Week-based decay
      score += temporalScore * this.config.temporalDecay;
      totalWeight += this.config.temporalDecay;
    }

    // Semantic similarity (simplified - would use embeddings in production)
    if (this.config.semanticWeight > 0 && query.query) {
      const contextText = `${context.content.summary} ${context.content.description || ''}`.toLowerCase();
      const queryText = query.query.toLowerCase();
      const semanticScore = this.calculateTextSimilarity(contextText, queryText);
      score += semanticScore * this.config.semanticWeight;
      totalWeight += this.config.semanticWeight;
    }

    // Outcome weight (successful outcomes are more relevant)
    if (this.config.outcomeWeight > 0 && context.content.outcome) {
      const outcomeScore = context.content.outcome.success ? 1.0 : 0.3;
      score += outcomeScore * this.config.outcomeWeight;
      totalWeight += this.config.outcomeWeight;
    }

    // Feedback weight (contexts with positive feedback are more relevant)
    if (this.config.feedbackWeight > 0) {
      const feedback = this.feedbackHistory.get(context.id) || [];
      const avgFeedback = feedback.length > 0 
        ? feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length / 5 // Normalize to 0-1
        : 0.5; // Default neutral score
      score += avgFeedback * this.config.feedbackWeight;
      totalWeight += this.config.feedbackWeight;
    }

    // Type weight
    const typeWeight = this.config.typeWeights[context.type] || 0.5;
    score += typeWeight * 0.1; // Small contribution
    totalWeight += 0.1;

    // Normalize score
    const finalScore = totalWeight > 0 ? score / totalWeight : 0;
    
    return Math.max(0, Math.min(1, finalScore));
  }

  async scoreContexts(contexts: HistoricalContext[], query: ContextQuery): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    
    for (const context of contexts) {
      const score = await this.scoreContext(context, query);
      scores.set(context.id, score);
    }
    
    return scores;
  }

  async updateScores(feedback: ContextFeedback): Promise<void> {
    if (!this.feedbackHistory.has(feedback.contextId)) {
      this.feedbackHistory.set(feedback.contextId, []);
    }
    this.feedbackHistory.get(feedback.contextId)!.push(feedback);
  }

  getConfig(): RelevanceConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<RelevanceConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity (in production, would use embeddings)
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

/**
 * Main Historical Context System implementation
 */
export class HistoricalContextSystem extends EventEmitter implements IHistoricalContextSystem {
  private persistence: IContextPersistence;
  private relevanceScorer: IRelevanceScorer;
  private carryoverConfig: CarryoverConfig;
  private integrationConfig: MultiAgentIntegrationConfig;
  private eventSubject = new Subject<{type: string; context: HistoricalContext}>();
  private isInitialized = false;

  constructor(
    persistence: IContextPersistence,
    relevanceScorer: IRelevanceScorer,
    carryoverConfig: CarryoverConfig,
    integrationConfig: MultiAgentIntegrationConfig
  ) {
    super();
    this.persistence = persistence;
    this.relevanceScorer = relevanceScorer;
    this.carryoverConfig = carryoverConfig;
    this.integrationConfig = integrationConfig;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Initialize cleanup scheduling
    this.scheduleCleanup();
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    this.eventSubject.complete();
    this.isInitialized = false;
    this.emit('shutdown');
  }

  async storeContext(
    contextData: Omit<HistoricalContext, 'id' | 'timestamp' | 'relevanceScore'>
  ): Promise<string> {
    const id = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    
    const context: HistoricalContext = {
      ...contextData,
      id,
      timestamp,
      relevanceScore: 0.5 // Default score, will be updated by relevance scorer
    };

    await this.persistence.store(context);
    
    // Update relevance score asynchronously
    this.updateContextRelevance(context);
    
    this.eventSubject.next({ type: 'context_stored', context });
    this.emit('contextStored', context);
    
    return id;
  }

  async retrieveContext(id: string): Promise<HistoricalContext | null> {
    return this.persistence.retrieve(id);
  }

  async searchContexts(query: ContextQuery): Promise<ContextSearchResult> {
    const startTime = Date.now();
    
    // Get contexts from persistence
    const contexts = await this.persistence.search(query);
    
    // Score contexts for relevance
    const scores = await this.relevanceScorer.scoreContexts(contexts, query);
    
    // Update contexts with scores and filter by minimum threshold
    const scoredContexts: HistoricalContext[] = [];
    for (const context of contexts) {
      const score = scores.get(context.id) || 0;
      if (score >= (query.minRelevance || 0)) {
        scoredContexts.push({
          ...context,
          relevanceScore: score
        });
      }
    }

    // Sort by relevance score
    scoredContexts.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    const executionTime = Date.now() - startTime;
    const relevanceScores = scoredContexts.map(c => c.relevanceScore || 0);
    
    const result: ContextSearchResult = {
      contexts: scoredContexts,
      totalCount: scoredContexts.length,
      searchMetadata: {
        executionTime,
        relevanceDistribution: {
          min: Math.min(...relevanceScores, 0),
          max: Math.max(...relevanceScores, 0),
          avg: relevanceScores.length > 0 
            ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length 
            : 0
        },
        appliedFilters: query
      },
      suggestedQueries: this.generateSuggestedQueries(query, scoredContexts)
    };

    return result;
  }

  async deleteContext(id: string): Promise<boolean> {
    const result = await this.persistence.delete(id);
    if (result) {
      this.eventSubject.next({ type: 'context_deleted', context: { id } as any });
      this.emit('contextDeleted', id);
    }
    return result;
  }

  async getSessionContexts(sessionId: string): Promise<HistoricalContext[]> {
    return this.searchContexts({ sessionId }).then(result => result.contexts);
  }

  async carryoverContexts(fromSessionId: string, toSessionId: string): Promise<HistoricalContext[]> {
    const query: ContextQuery = {
      sessionId: fromSessionId,
      types: this.carryoverConfig.includedTypes,
      minRelevance: this.carryoverConfig.minRelevance,
      limit: this.carryoverConfig.maxContexts,
      privacyLevels: this.carryoverConfig.allowedPrivacyLevels
    };

    // Get contexts to carry over
    const searchResult = await this.searchContexts(query);
    const contextsToCarry = searchResult.contexts;

    // Filter by age
    const maxAgeMs = this.carryoverConfig.maxAge * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    const recentContexts = contextsToCarry.filter(c => c.timestamp >= cutoffTime);

    // Create new contexts for the new session
    const carriedContexts: HistoricalContext[] = [];
    for (const context of recentContexts) {
      const newContextData = {
        ...context,
        sessionId: toSessionId,
        tags: [...context.tags, 'carried_over'],
        metadata: {
          ...context.metadata,
          carryover: {
            fromSessionId,
            originalContextId: context.id,
            carriedAt: new Date()
          }
        }
      };

      // Remove fields that will be regenerated
      delete (newContextData as any).id;
      delete (newContextData as any).timestamp;
      delete (newContextData as any).relevanceScore;

      const newId = await this.storeContext(newContextData);
      const newContext = await this.retrieveContext(newId);
      if (newContext) {
        carriedContexts.push(newContext);
      }
    }

    this.emit('contextsCarriedOver', { fromSessionId, toSessionId, contexts: carriedContexts });
    
    return carriedContexts;
  }

  async addFeedback(feedback: ContextFeedback): Promise<void> {
    await this.relevanceScorer.updateScores(feedback);
    
    // Update context relevance based on feedback
    const context = await this.retrieveContext(feedback.contextId);
    if (context) {
      this.updateContextRelevance(context);
    }
    
    this.emit('feedbackAdded', feedback);
  }

  async getPatterns(agentId?: string): Promise<LearningPattern[]> {
    // This would implement pattern detection algorithms
    // For now, return empty array (would be implemented with ML models)
    return [];
  }

  async getStatistics(): Promise<ContextStatistics> {
    return this.persistence.getStatistics();
  }

  // Observable for real-time updates
  getEventStream(): Observable<{type: string; context: HistoricalContext}> {
    return this.eventSubject.asObservable();
  }

  private async updateContextRelevance(context: HistoricalContext): Promise<void> {
    // Create a generic query for relevance scoring
    const query: ContextQuery = {
      types: [context.type],
      sessionId: context.sessionId
    };

    const score = await this.relevanceScorer.scoreContext(context, query);
    
    // Update stored context with new score
    const updatedContext = { ...context, relevanceScore: score };
    await this.persistence.store(updatedContext);
  }

  private generateSuggestedQueries(query: ContextQuery, results: HistoricalContext[]): string[] {
    // Generate suggested queries based on search results
    const suggestions: string[] = [];
    
    // Suggest by common tags
    const tagCounts = new Map<string, number>();
    for (const context of results) {
      for (const tag of context.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    const popularTags = Array.from(tagCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tag]) => tag);
    
    for (const tag of popularTags) {
      suggestions.push(`Related: ${tag}`);
    }
    
    return suggestions;
  }

  private scheduleCleanup(): void {
    // Schedule periodic cleanup
    const cleanupInterval = setInterval(async () => {
      try {
        await this.persistence.cleanup();
      } catch (error) {
        this.emit('error', { type: 'cleanup_failed', error });
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    // Clean up interval on shutdown
    this.once('shutdown', () => {
      clearInterval(cleanupInterval);
    });
  }
}

/**
 * Factory function to create a configured historical context system
 */
export function createHistoricalContextSystem(config?: {
  persistence?: IContextPersistence;
  relevanceConfig?: Partial<RelevanceConfig>;
  carryoverConfig?: Partial<CarryoverConfig>;
  integrationConfig?: Partial<MultiAgentIntegrationConfig>;
}): HistoricalContextSystem {
  const persistence = config?.persistence || new MemoryContextPersistence();
  
  const defaultRelevanceConfig: RelevanceConfig = {
    temporalDecay: 0.3,
    semanticWeight: 0.4,
    outcomeWeight: 0.2,
    feedbackWeight: 0.1,
    typeWeights: {
      interaction: 1.0,
      decision: 0.9,
      success: 0.8,
      error: 0.7,
      pattern: 0.8,
      insight: 0.9,
      feedback: 0.6,
      task_completion: 0.8,
      code_review: 0.9,
      bug_fix: 0.8,
      optimization: 0.7,
      architectural_decision: 1.0
    },
    enableMLScoring: true,
    minScoreThreshold: 0.1
  };

  const defaultCarryoverConfig: CarryoverConfig = {
    maxContexts: 20,
    minRelevance: 0.3,
    includedTypes: ['interaction', 'decision', 'success', 'pattern', 'insight'],
    enableSummarization: true,
    maxAge: 24, // hours
    allowedPrivacyLevels: ['public', 'shared']
  };

  const defaultIntegrationConfig: MultiAgentIntegrationConfig = {
    enableCrossAgentLearning: true,
    sharedContextPool: {
      maxSize: 1000,
      sharingCriteria: {
        minRelevance: 0.5,
        requiredTags: [],
        excludedPrivacyLevels: ['private', 'confidential']
      }
    },
    specializationLearning: {
      trackExpertise: true,
      expertiseDecay: 0.1,
      minInteractionsForExpertise: 10
    },
    collaborativeFiltering: {
      enableRecommendationSharing: true,
      similarAgentThreshold: 0.7,
      confidenceBoost: 0.1
    }
  };

  const relevanceConfig = { ...defaultRelevanceConfig, ...config?.relevanceConfig };
  const carryoverConfig = { ...defaultCarryoverConfig, ...config?.carryoverConfig };
  const integrationConfig = { ...defaultIntegrationConfig, ...config?.integrationConfig };

  const relevanceScorer = new MLRelevanceScorer(relevanceConfig);

  return new HistoricalContextSystem(
    persistence,
    relevanceScorer,
    carryoverConfig,
    integrationConfig
  );
}