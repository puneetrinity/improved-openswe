/**
 * Multi-Agent Knowledge Graph Integration
 * 
 * Integrates the Repository Knowledge Graph with the Open SWE multi-agent system,
 * enabling agents to query and share code knowledge for enhanced collaboration.
 */

import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import {
  IMultiAgentKnowledgeGraphIntegration,
  IRepositoryKnowledgeGraph,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-interfaces.js';
import {
  KnowledgeGraphQuery,
  KnowledgeGraphSearchResult,
  KnowledgeGraphEvent,
  CodeEntity
} from './repository-knowledge-graph-types.js';
import { MultiAgentSystem } from './multi-agent-system.js';
import { SharedContextStore } from './shared-context-store.js';
import {
  AgentProfile,
  AgentMessage,
  AgentRole,
  SharedContext
} from './types.js';

/**
 * Knowledge query from an agent
 */
interface AgentKnowledgeQuery {
  /**
   * Requesting agent ID
   */
  agentId: string;

  /**
   * Query identifier for tracking
   */
  queryId: string;

  /**
   * Knowledge query
   */
  query: KnowledgeGraphQuery;

  /**
   * Context about the query
   */
  context: {
    /**
     * Current task the agent is working on
     */
    taskId?: string;

    /**
     * Purpose of the query
     */
    purpose: 'code_review' | 'implementation' | 'testing' | 'documentation' | 'architecture' | 'debugging';

    /**
     * Additional context information
     */
    metadata?: Record<string, unknown>;
  };

  /**
   * When the query was made
   */
  timestamp: number;
}

/**
 * Knowledge insight to share with agents
 */
interface KnowledgeInsight {
  /**
   * Insight identifier
   */
  id: string;

  /**
   * Type of insight
   */
  type: 'pattern' | 'issue' | 'recommendation' | 'similarity' | 'dependency' | 'complexity';

  /**
   * Related entities
   */
  entities: CodeEntity[];

  /**
   * Insight data
   */
  data: {
    /**
     * Description of the insight
     */
    description: string;

    /**
     * Detailed findings
     */
    details: any;

    /**
     * Actionable recommendations
     */
    recommendations?: string[];

    /**
     * Severity or importance level
     */
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };

  /**
   * Confidence in the insight (0-1)
   */
  confidence: number;

  /**
   * When the insight was generated
   */
  timestamp: number;

  /**
   * Source of the insight
   */
  source: string;
}

/**
 * Task context information
 */
interface TaskContext {
  /**
   * Task identifier
   */
  taskId: string;

  /**
   * Task description
   */
  description: string;

  /**
   * Related code entities
   */
  relatedEntities: CodeEntity[];

  /**
   * Relevant insights
   */
  insights: KnowledgeInsight[];

  /**
   * Task metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Multi-Agent Knowledge Graph Integration implementation
 */
export class MultiAgentKnowledgeGraphIntegration implements IMultiAgentKnowledgeGraphIntegration {
  private readonly logger = createLogger(LogLevel.INFO, 'MultiAgentKnowledgeGraphIntegration');

  /**
   * Knowledge graph instance
   */
  private knowledgeGraph?: IRepositoryKnowledgeGraph;

  /**
   * Multi-agent system instance
   */
  private multiAgentSystem?: MultiAgentSystem;

  /**
   * Shared context store instance
   */
  private sharedContextStore?: SharedContextStore;

  /**
   * Event streams
   */
  private readonly agentEventSubject = new Subject<any>();
  private readonly knowledgeEventSubject = new Subject<KnowledgeGraphEvent>();

  /**
   * Query tracking
   */
  private activeQueries = new Map<string, AgentKnowledgeQuery>();
  private queryHistory: AgentKnowledgeQuery[] = [];

  /**
   * Insights cache
   */
  private insightsCache = new Map<string, KnowledgeInsight[]>();
  private taskContexts = new Map<string, TaskContext>();

  /**
   * Performance metrics
   */
  private metrics = {
    totalQueries: 0,
    successfulQueries: 0,
    averageResponseTime: 0,
    insightsGenerated: 0,
    agentCollaborations: 0
  };

  constructor() {
    this.logger.info('MultiAgentKnowledgeGraphIntegration initialized');
  }

  /**
   * Register the knowledge graph with the multi-agent system
   */
  async registerWithMultiAgent(
    knowledgeGraph: IRepositoryKnowledgeGraph,
    multiAgentSystem: MultiAgentSystem
  ): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      this.knowledgeGraph = knowledgeGraph;
      this.multiAgentSystem = multiAgentSystem;

      // Subscribe to knowledge graph events
      knowledgeGraph.subscribeToEvents().subscribe(event => {
        this.handleKnowledgeGraphEvent(event);
      });

      // Subscribe to multi-agent system events
      multiAgentSystem.subscribeToSystemEvents().subscribe(event => {
        this.handleAgentEvent(event);
      });

      // Register as a specialized service agent
      const knowledgeAgent: AgentProfile = {
        id: 'knowledge-graph-service',
        role: 'architect', // Closest role for knowledge management
        specialization: [
          'code_analysis',
          'pattern_detection',
          'dependency_mapping',
          'semantic_search',
          'knowledge_management'
        ],
        tools: [
          'semantic_search',
          'pattern_analysis',
          'relationship_mapping',
          'code_insights'
        ],
        collaborationRules: [
          {
            trigger: 'code_review_request',
            targetRoles: ['code_reviewer'],
            priority: 'high'
          },
          {
            trigger: 'architecture_question',
            targetRoles: ['architect'],
            priority: 'medium'
          },
          {
            trigger: 'implementation_help',
            targetRoles: ['code_reviewer', 'test_engineer'],
            priority: 'medium'
          }
        ],
        status: 'active',
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      const registrationResult = await multiAgentSystem.registerAgent(knowledgeAgent);
      
      if (!registrationResult.success) {
        throw new Error(`Failed to register knowledge service agent: ${registrationResult.error}`);
      }

      this.logger.info('Knowledge graph registered with multi-agent system', {
        agentId: knowledgeAgent.id,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: {
          knowledgeAgentId: knowledgeAgent.id,
          registrationStatus: 'active'
        }
      };

    } catch (error) {
      this.logger.error('Failed to register with multi-agent system', {
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
   * Handle agent queries for code knowledge
   */
  async handleAgentQuery(
    agentId: string,
    query: KnowledgeGraphQuery
  ): Promise<RepositoryKnowledgeGraphResult<KnowledgeGraphSearchResult>> {
    const startTime = Date.now();
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.metrics.totalQueries++;

      if (!this.knowledgeGraph) {
        throw new Error('Knowledge graph not registered');
      }

      // Create agent knowledge query
      const agentQuery: AgentKnowledgeQuery = {
        agentId,
        queryId,
        query,
        context: {
          purpose: this.inferQueryPurpose(query, agentId),
          metadata: {
            requestedAt: Date.now(),
            agentRole: await this.getAgentRole(agentId)
          }
        },
        timestamp: Date.now()
      };

      this.activeQueries.set(queryId, agentQuery);

      this.logger.debug('Processing agent knowledge query', {
        agentId,
        queryId,
        purpose: agentQuery.context.purpose
      });

      // Execute the query
      const searchResult = await this.knowledgeGraph.semanticSearch(query);

      if (!searchResult.success) {
        throw new Error(searchResult.error);
      }

      this.metrics.successfulQueries++;

      // Enhance results with agent-specific context
      const enhancedResult = await this.enhanceResultsForAgent(searchResult.data!, agentId);

      // Update context store with query results if configured
      if (this.sharedContextStore && agentQuery.context.taskId) {
        await this.updateSharedContext(agentQuery.context.taskId, enhancedResult);
      }

      // Generate insights from the query
      const insights = await this.generateInsightsFromQuery(agentQuery, enhancedResult);
      if (insights.length > 0) {
        await this.shareInsights(insights, [agentId]);
      }

      // Clean up tracking
      this.activeQueries.delete(queryId);
      this.queryHistory.push(agentQuery);

      // Keep history bounded
      if (this.queryHistory.length > 1000) {
        this.queryHistory = this.queryHistory.slice(-1000);
      }

      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime);

      this.logger.debug('Agent knowledge query completed', {
        agentId,
        queryId,
        resultsCount: enhancedResult.entities.length,
        insightsGenerated: insights.length,
        executionTime
      });

      return {
        success: true,
        data: enhancedResult,
        executionTime,
        metadata: {
          queryId,
          purpose: agentQuery.context.purpose,
          insightsGenerated: insights.length
        }
      };

    } catch (error) {
      this.activeQueries.delete(queryId);
      
      this.logger.error('Agent knowledge query failed', {
        agentId,
        queryId,
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
   * Provide context to agents based on current task
   */
  async provideTaskContext(
    taskId: string,
    agentIds: string[]
  ): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      if (!this.knowledgeGraph || !this.multiAgentSystem) {
        throw new Error('Knowledge graph or multi-agent system not registered');
      }

      // Get or create task context
      let taskContext = this.taskContexts.get(taskId);
      
      if (!taskContext) {
        taskContext = await this.buildTaskContext(taskId);
        this.taskContexts.set(taskId, taskContext);
      }

      this.logger.debug('Providing task context to agents', {
        taskId,
        agentIds,
        relatedEntities: taskContext.relatedEntities.length,
        insights: taskContext.insights.length
      });

      // Send context to each agent
      for (const agentId of agentIds) {
        const contextMessage: AgentMessage = {
          id: `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fromAgentId: 'knowledge-graph-service',
          toAgentId: agentId,
          type: 'collaboration',
          content: `Task context for ${taskId}`,
          data: {
            taskContext,
            type: 'task_context',
            entities: taskContext.relatedEntities.slice(0, 10), // Limit for performance
            insights: taskContext.insights
          },
          timestamp: Date.now(),
          priority: 'medium'
        };

        await this.multiAgentSystem.sendMessage(
          'knowledge-graph-service',
          agentId,
          contextMessage
        );
      }

      this.metrics.agentCollaborations++;

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: {
          taskId,
          agentsNotified: agentIds.length,
          contextEntities: taskContext.relatedEntities.length,
          insights: taskContext.insights.length
        }
      };

    } catch (error) {
      this.logger.error('Failed to provide task context', {
        taskId,
        agentIds,
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
   * Subscribe to multi-agent events
   */
  subscribeToAgentEvents(eventTypes?: string[]): Observable<any> {
    if (eventTypes) {
      return this.agentEventSubject.asObservable().pipe(
        filter(event => eventTypes.includes(event.type))
      );
    }
    
    return this.agentEventSubject.asObservable();
  }

  /**
   * Share knowledge graph insights with agents
   */
  async shareInsights(
    insights: KnowledgeInsight[],
    targetAgents: string[]
  ): Promise<RepositoryKnowledgeGraphResult> {
    const startTime = Date.now();

    try {
      if (!this.multiAgentSystem) {
        throw new Error('Multi-agent system not registered');
      }

      this.logger.debug('Sharing insights with agents', {
        insightCount: insights.length,
        targetAgents
      });

      // Group insights by type for better organization
      const insightsByType = insights.reduce((acc, insight) => {
        if (!acc[insight.type]) {
          acc[insight.type] = [];
        }
        acc[insight.type].push(insight);
        return acc;
      }, {} as Record<string, KnowledgeInsight[]>);

      // Send insights to target agents
      for (const agentId of targetAgents) {
        const insightMessage: AgentMessage = {
          id: `insights_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fromAgentId: 'knowledge-graph-service',
          toAgentId: agentId,
          type: 'collaboration',
          content: `Knowledge insights available`,
          data: {
            type: 'knowledge_insights',
            insights: insightsByType,
            totalInsights: insights.length,
            categories: Object.keys(insightsByType)
          },
          timestamp: Date.now(),
          priority: this.calculateInsightPriority(insights)
        };

        await this.multiAgentSystem.sendMessage(
          'knowledge-graph-service',
          agentId,
          insightMessage
        );
      }

      // Cache insights for future reference
      for (const insight of insights) {
        const entityIds = insight.entities.map(e => e.id);
        for (const entityId of entityIds) {
          if (!this.insightsCache.has(entityId)) {
            this.insightsCache.set(entityId, []);
          }
          this.insightsCache.get(entityId)!.push(insight);
        }
      }

      this.metrics.insightsGenerated += insights.length;

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: {
          insightsShared: insights.length,
          targetAgents: targetAgents.length,
          insightTypes: Object.keys(insightsByType)
        }
      };

    } catch (error) {
      this.logger.error('Failed to share insights', {
        insightCount: insights.length,
        targetAgents,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  // Private helper methods

  private handleKnowledgeGraphEvent(event: KnowledgeGraphEvent): void {
    this.knowledgeEventSubject.next(event);

    // React to specific events
    switch (event.type) {
      case 'entity_added':
      case 'entity_updated':
        this.onEntityChange(event);
        break;
      
      case 'pattern_detected':
        this.onPatternDetected(event);
        break;
      
      case 'issue_found':
        this.onIssueFound(event);
        break;
    }
  }

  private handleAgentEvent(event: any): void {
    this.agentEventSubject.next(event);

    // React to agent events that might require knowledge graph updates
    if (event.type === 'task_started') {
      this.onTaskStarted(event);
    } else if (event.type === 'task_completed') {
      this.onTaskCompleted(event);
    }
  }

  private inferQueryPurpose(
    query: KnowledgeGraphQuery,
    agentId: string
  ): AgentKnowledgeQuery['context']['purpose'] {
    // Simple heuristic to infer query purpose
    if (query.query?.toLowerCase().includes('test')) {
      return 'testing';
    } else if (query.query?.toLowerCase().includes('review')) {
      return 'code_review';
    } else if (query.query?.toLowerCase().includes('architecture')) {
      return 'architecture';
    } else if (query.query?.toLowerCase().includes('bug') || query.query?.toLowerCase().includes('error')) {
      return 'debugging';
    } else if (query.query?.toLowerCase().includes('doc')) {
      return 'documentation';
    }
    
    return 'implementation';
  }

  private async getAgentRole(agentId: string): Promise<AgentRole | undefined> {
    if (!this.multiAgentSystem) return undefined;
    
    const agents = this.multiAgentSystem.registry.getAllAgents();
    const agent = agents.find(a => a.id === agentId);
    return agent?.role;
  }

  private async enhanceResultsForAgent(
    searchResult: KnowledgeGraphSearchResult,
    agentId: string
  ): Promise<KnowledgeGraphSearchResult> {
    // Enhance results based on agent role and context
    const agentRole = await this.getAgentRole(agentId);
    
    // Add role-specific metadata
    const enhancedMetadata = {
      ...searchResult.searchMetadata,
      agentRole,
      relevanceScores: new Map<string, number>()
    };

    // Calculate relevance scores based on agent role
    for (const entity of searchResult.entities) {
      let relevanceScore = 1.0;
      
      if (agentRole === 'code_reviewer' && entity.analysis.issues.length > 0) {
        relevanceScore += 0.3;
      } else if (agentRole === 'architect' && entity.type === 'class') {
        relevanceScore += 0.2;
      } else if (agentRole === 'test_engineer' && entity.name.toLowerCase().includes('test')) {
        relevanceScore += 0.4;
      }
      
      enhancedMetadata.relevanceScores.set(entity.id, relevanceScore);
    }

    // Sort entities by relevance
    const enhancedEntities = [...searchResult.entities].sort((a, b) => {
      const scoreA = enhancedMetadata.relevanceScores.get(a.id) || 0;
      const scoreB = enhancedMetadata.relevanceScores.get(b.id) || 0;
      return scoreB - scoreA;
    });

    return {
      ...searchResult,
      entities: enhancedEntities,
      searchMetadata: enhancedMetadata
    };
  }

  private async updateSharedContext(taskId: string, searchResult: KnowledgeGraphSearchResult): Promise<void> {
    if (!this.sharedContextStore) return;

    const contextData = {
      searchResults: searchResult.entities.slice(0, 5), // Limit stored results
      lastUpdated: Date.now(),
      queryMetadata: searchResult.searchMetadata
    };

    await this.sharedContextStore.set(
      'task',
      `knowledge/${taskId}`,
      'search_results',
      contextData
    );
  }

  private async generateInsightsFromQuery(
    agentQuery: AgentKnowledgeQuery,
    searchResult: KnowledgeGraphSearchResult
  ): Promise<KnowledgeInsight[]> {
    const insights: KnowledgeInsight[] = [];

    // Generate complexity insights
    const highComplexityEntities = searchResult.entities.filter(
      e => e.metadata.complexity.cyclomatic > 10
    );

    if (highComplexityEntities.length > 0) {
      insights.push({
        id: `complexity_${Date.now()}`,
        type: 'complexity',
        entities: highComplexityEntities,
        data: {
          description: `Found ${highComplexityEntities.length} entities with high complexity`,
          details: {
            averageComplexity: highComplexityEntities.reduce(
              (sum, e) => sum + e.metadata.complexity.cyclomatic, 0
            ) / highComplexityEntities.length,
            maxComplexity: Math.max(...highComplexityEntities.map(e => e.metadata.complexity.cyclomatic))
          },
          recommendations: [
            'Consider refactoring high-complexity methods',
            'Add unit tests for complex code paths',
            'Document complex algorithms'
          ],
          severity: 'medium'
        },
        confidence: 0.8,
        timestamp: Date.now(),
        source: 'MultiAgentKnowledgeGraphIntegration'
      });
    }

    // Generate pattern insights
    const patternEntities = searchResult.entities.filter(
      e => e.analysis.patterns.length > 0
    );

    if (patternEntities.length > 0) {
      const patterns = [...new Set(patternEntities.flatMap(e => e.analysis.patterns))];
      
      insights.push({
        id: `patterns_${Date.now()}`,
        type: 'pattern',
        entities: patternEntities,
        data: {
          description: `Detected ${patterns.length} design patterns in results`,
          details: {
            patterns,
            usage: patterns.map(pattern => ({
              pattern,
              count: patternEntities.filter(e => e.analysis.patterns.includes(pattern)).length
            }))
          },
          recommendations: [
            'Leverage existing patterns for consistency',
            'Consider pattern alternatives where appropriate'
          ]
        },
        confidence: 0.7,
        timestamp: Date.now(),
        source: 'MultiAgentKnowledgeGraphIntegration'
      });
    }

    return insights;
  }

  private async buildTaskContext(taskId: string): Promise<TaskContext> {
    // This would typically query the shared context store or task management system
    // For now, return a basic context
    return {
      taskId,
      description: `Task context for ${taskId}`,
      relatedEntities: [],
      insights: [],
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now()
      }
    };
  }

  private calculateInsightPriority(insights: KnowledgeInsight[]): AgentMessage['priority'] {
    const hasCritical = insights.some(i => i.data.severity === 'critical');
    const hasHigh = insights.some(i => i.data.severity === 'high');
    
    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    
    return 'medium';
  }

  private onEntityChange(event: KnowledgeGraphEvent): void {
    // Invalidate relevant insights cache
    if (event.entityId) {
      this.insightsCache.delete(event.entityId);
    }
  }

  private onPatternDetected(event: KnowledgeGraphEvent): void {
    // Notify relevant agents about pattern detection
    if (this.multiAgentSystem) {
      this.multiAgentSystem.broadcastToRole(
        'knowledge-graph-service',
        'architect',
        {
          id: `pattern_notification_${Date.now()}`,
          fromAgentId: 'knowledge-graph-service',
          type: 'notification',
          content: 'New code pattern detected',
          data: event.payload,
          timestamp: Date.now(),
          priority: 'medium'
        }
      );
    }
  }

  private onIssueFound(event: KnowledgeGraphEvent): void {
    // Notify relevant agents about issues
    if (this.multiAgentSystem) {
      this.multiAgentSystem.broadcastToRole(
        'knowledge-graph-service',
        'code_reviewer',
        {
          id: `issue_notification_${Date.now()}`,
          fromAgentId: 'knowledge-graph-service',
          type: 'notification',
          content: 'Code issue detected',
          data: event.payload,
          timestamp: Date.now(),
          priority: 'high'
        }
      );
    }
  }

  private onTaskStarted(event: any): void {
    // Prepare context for new task
    if (event.taskId) {
      this.buildTaskContext(event.taskId).then(context => {
        this.taskContexts.set(event.taskId, context);
      });
    }
  }

  private onTaskCompleted(event: any): void {
    // Clean up task context
    if (event.taskId) {
      this.taskContexts.delete(event.taskId);
    }
  }

  private updateMetrics(executionTime: number): void {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + executionTime) / 
      this.metrics.totalQueries;
  }

  /**
   * Get integration metrics
   */
  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Set shared context store instance
   */
  public setSharedContextStore(store: SharedContextStore): void {
    this.sharedContextStore = store;
    this.logger.info('Shared context store registered with knowledge graph integration');
  }
}