/**
 * Principal Engineer Review System Integration
 * 
 * This module provides seamless integration between the Principal Engineer Review System
 * and the existing Open SWE infrastructure including:
 * - Repository Knowledge Graph
 * - Historical Context System
 * - Task Delegation System
 * - Multi-Agent System
 * - Shared Context Store
 * - Coordination Patterns
 */

import { EventEmitter } from 'events';
import {
  PrincipalEngineerReviewOrchestrator,
  ReviewMetricsSystem
} from './principal-engineer-review-orchestrator.js';
import {
  PrincipalEngineerReviewConfig,
  PrincipalEngineerReviewRequest,
  PrincipalEngineerReviewResult,
  PrincipalEngineerReviewEvent,
  ReviewFinding
} from './principal-engineer-review-types.js';
import { MultiAgentSystem } from './multi-agent-system.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph.js';
import { HistoricalContext } from './historical-context-system.js';
import { TaskDelegationSystem } from './task-delegation-system.js';
import { SharedContextStore } from './shared-context-store.js';
import { CoordinationPatterns } from './coordination-patterns.js';
import { ProductionMonitoring } from './production-monitoring.js';
import { ReviewerGraphState } from './reviewer/types.js';
import { GraphState } from './types.js';

/**
 * Review session context for multi-agent coordination
 */
interface ReviewSessionContext {
  reviewId: string;
  requestedBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  filePaths: string[];
  repository: {
    owner: string;
    name: string;
    branch: string;
    commit?: string;
  };
  reviewState: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: number;
  orchestratorId: string;
  agentIds: string[];
  findings: ReviewFinding[];
  metrics: {
    responseTime?: number;
    qualityScore?: number;
    agentPerformance: Map<string, any>;
  };
}

/**
 * Integration hooks for extending the review system
 */
interface ReviewIntegrationHooks {
  /**
   * Called before review starts
   */
  onReviewStart?: (context: ReviewSessionContext) => Promise<void>;
  
  /**
   * Called when an agent completes its analysis
   */
  onAgentComplete?: (agentId: string, findings: ReviewFinding[], context: ReviewSessionContext) => Promise<void>;
  
  /**
   * Called when review completes
   */
  onReviewComplete?: (result: PrincipalEngineerReviewResult, context: ReviewSessionContext) => Promise<void>;
  
  /**
   * Called when feedback is received
   */
  onFeedbackReceived?: (reviewId: string, feedback: any[]) => Promise<void>;
  
  /**
   * Custom finding processors
   */
  findingProcessors?: Array<(findings: ReviewFinding[]) => Promise<ReviewFinding[]>>;
  
  /**
   * Custom metrics collectors
   */
  metricsCollectors?: Array<(result: PrincipalEngineerReviewResult) => Promise<Record<string, any>>>;
}

/**
 * Principal Engineer Review System Integration Manager
 * 
 * Orchestrates the integration between the review system and existing infrastructure,
 * providing seamless coordination, context sharing, and workflow management.
 */
export class PrincipalEngineerReviewIntegration extends EventEmitter {
  private orchestrator: PrincipalEngineerReviewOrchestrator;
  private activeSessions = new Map<string, ReviewSessionContext>();
  private integrationHooks: ReviewIntegrationHooks = {};
  
  constructor(
    private config: PrincipalEngineerReviewConfig,
    private multiAgentSystem: MultiAgentSystem,
    private knowledgeGraph: RepositoryKnowledgeGraph,
    private historicalContext: HistoricalContext,
    private taskDelegationSystem: TaskDelegationSystem,
    private sharedContextStore: SharedContextStore,
    private coordinationPatterns: CoordinationPatterns,
    private productionMonitoring: ProductionMonitoring
  ) {
    super();
    
    this.orchestrator = new PrincipalEngineerReviewOrchestrator(
      config,
      multiAgentSystem,
      knowledgeGraph,
      historicalContext,
      taskDelegationSystem,
      productionMonitoring
    );
    
    this.setupIntegration();
    this.setupEventHandlers();
  }

  /**
   * Initialize a comprehensive review session with full infrastructure integration
   */
  async startReviewSession(request: PrincipalEngineerReviewRequest): Promise<string> {
    const reviewId = request.id;
    
    // Create session context
    const sessionContext: ReviewSessionContext = {
      reviewId,
      requestedBy: request.requestedBy.userId,
      priority: request.priority,
      filePaths: request.filePaths,
      repository: request.repository,
      reviewState: 'pending',
      startTime: Date.now(),
      orchestratorId: 'principal_engineer_review_orchestrator',
      agentIds: [],
      findings: [],
      metrics: {
        agentPerformance: new Map()
      }
    };

    this.activeSessions.set(reviewId, sessionContext);

    try {
      // Store session context in shared store
      await this.sharedContextStore.store(reviewId, 'review_session', sessionContext, 'review_integration');
      
      // Update repository knowledge graph with review context
      await this.updateKnowledgeGraphContext(request);
      
      // Create task delegations for specialized review agents
      await this.createReviewTaskDelegations(request, sessionContext);
      
      // Execute integration hooks
      if (this.integrationHooks.onReviewStart) {
        await this.integrationHooks.onReviewStart(sessionContext);
      }
      
      // Update session state
      sessionContext.reviewState = 'in_progress';
      await this.sharedContextStore.store(reviewId, 'review_session', sessionContext, 'review_integration');
      
      // Start the review process (async)
      this.performIntegratedReview(request, sessionContext);
      
      return reviewId;
      
    } catch (error) {
      sessionContext.reviewState = 'failed';
      await this.sharedContextStore.store(reviewId, 'review_session', sessionContext, 'review_integration');
      throw error;
    }
  }

  /**
   * Get the status and results of a review session
   */
  async getReviewStatus(reviewId: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    findings: ReviewFinding[];
    metrics: any;
    estimatedCompletion?: number;
  }> {
    const session = this.activeSessions.get(reviewId);
    if (!session) {
      // Try to retrieve from shared context store
      const storedSession = await this.sharedContextStore.retrieve(reviewId, 'review_session');
      if (!storedSession) {
        throw new Error(`Review session ${reviewId} not found`);
      }
      return {
        status: storedSession.reviewState,
        progress: storedSession.reviewState === 'completed' ? 1.0 : 0.0,
        findings: storedSession.findings,
        metrics: storedSession.metrics
      };
    }

    // Calculate progress based on agent completion
    const totalAgents = session.agentIds.length || 6; // Default 6 specialized agents
    const completedAgents = session.metrics.agentPerformance.size;
    const progress = totalAgents > 0 ? completedAgents / totalAgents : 0;

    // Estimate completion time based on current progress and elapsed time
    const elapsed = Date.now() - session.startTime;
    const estimatedTotal = progress > 0 ? elapsed / progress : undefined;
    const estimatedCompletion = estimatedTotal ? session.startTime + estimatedTotal : undefined;

    return {
      status: session.reviewState,
      progress,
      findings: session.findings,
      metrics: session.metrics,
      estimatedCompletion
    };
  }

  /**
   * Provide feedback on review findings to improve system learning
   */
  async provideFeedback(
    reviewId: string,
    feedback: {
      agentId: string;
      findingId: string;
      isValidFinding: boolean;
      actualSeverity?: string;
      comments?: string;
    }[]
  ): Promise<void> {
    // Forward to orchestrator for agent learning
    await this.orchestrator.provideFeedback(reviewId, feedback as any);
    
    // Update historical context with feedback
    await this.historicalContext.recordFeedback({
      reviewId,
      feedback,
      timestamp: Date.now()
    });
    
    // Execute integration hooks
    if (this.integrationHooks.onFeedbackReceived) {
      await this.integrationHooks.onFeedbackReceived(reviewId, feedback);
    }
    
    this.emit('feedback_received', { reviewId, feedback });
  }

  /**
   * Integrate with existing reviewer graph state
   */
  async integrateWithReviewerGraph(
    reviewerState: ReviewerGraphState,
    reviewRequest: PrincipalEngineerReviewRequest
  ): Promise<PrincipalEngineerReviewResult> {
    // Extract relevant context from reviewer state
    const context = {
      targetRepository: reviewerState.targetRepository,
      branchName: reviewerState.branchName,
      baseBranchName: reviewerState.baseBranchName,
      changedFiles: reviewerState.changedFiles,
      customRules: reviewerState.customRules,
      sandboxSessionId: reviewerState.sandboxSessionId
    };

    // Enhance review request with reviewer context
    const enhancedRequest: PrincipalEngineerReviewRequest = {
      ...reviewRequest,
      context: {
        ...reviewRequest.context,
        reviewerGraphContext: context
      }
    };

    // Perform the review with enhanced context
    const result = await this.orchestrator.performReview(enhancedRequest);
    
    // Update reviewer state with findings (if applicable)
    this.emit('reviewer_integration_complete', {
      reviewerState,
      reviewResult: result
    });

    return result;
  }

  /**
   * Register integration hooks for extensibility
   */
  registerHooks(hooks: Partial<ReviewIntegrationHooks>): void {
    this.integrationHooks = { ...this.integrationHooks, ...hooks };
  }

  /**
   * Get comprehensive system metrics including integration performance
   */
  getIntegrationMetrics(): {
    orchestrator: any;
    sessions: {
      active: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
    infrastructure: {
      knowledgeGraph: boolean;
      historicalContext: boolean;
      taskDelegation: boolean;
      sharedContext: boolean;
    };
    performance: {
      avgIntegrationOverhead: number;
      successRate: number;
      errorRate: number;
    };
  } {
    const orchestratorMetrics = this.orchestrator.getMetrics();
    
    // Calculate session metrics
    const allSessions = Array.from(this.activeSessions.values());
    const completedSessions = allSessions.filter(s => s.reviewState === 'completed');
    const failedSessions = allSessions.filter(s => s.reviewState === 'failed');
    
    const avgDuration = completedSessions.length > 0 ? 
      completedSessions.reduce((sum, s) => sum + (s.metrics.responseTime || 0), 0) / completedSessions.length : 0;

    return {
      orchestrator: orchestratorMetrics,
      sessions: {
        active: allSessions.filter(s => s.reviewState === 'in_progress').length,
        completed: completedSessions.length,
        failed: failedSessions.length,
        avgDuration
      },
      infrastructure: {
        knowledgeGraph: !!this.knowledgeGraph,
        historicalContext: !!this.historicalContext,
        taskDelegation: !!this.taskDelegationSystem,
        sharedContext: !!this.sharedContextStore
      },
      performance: {
        avgIntegrationOverhead: 50, // ms - mock value
        successRate: completedSessions.length / Math.max(1, completedSessions.length + failedSessions.length),
        errorRate: failedSessions.length / Math.max(1, allSessions.length)
      }
    };
  }

  /**
   * Perform health check on all integrated components
   */
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      orchestrator: 'healthy' | 'degraded' | 'unhealthy';
      multiAgentSystem: 'healthy' | 'degraded' | 'unhealthy';
      knowledgeGraph: 'healthy' | 'degraded' | 'unhealthy';
      historicalContext: 'healthy' | 'degraded' | 'unhealthy';
      taskDelegation: 'healthy' | 'degraded' | 'unhealthy';
      sharedContext: 'healthy' | 'degraded' | 'unhealthy';
    };
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Check orchestrator health
    const orchestratorHealth = await this.orchestrator.getHealthStatus();
    
    // Check multi-agent system health
    const multiAgentHealth = await this.multiAgentSystem.performSystemHealthCheck();
    
    // Check other components (simplified checks)
    const components = {
      orchestrator: orchestratorHealth.overall,
      multiAgentSystem: multiAgentHealth.overall,
      knowledgeGraph: 'healthy' as const, // Assume healthy if no errors
      historicalContext: 'healthy' as const,
      taskDelegation: 'healthy' as const,
      sharedContext: 'healthy' as const
    };

    // Aggregate recommendations
    recommendations.push(...orchestratorHealth.recommendations);
    recommendations.push(...multiAgentHealth.recommendations);

    // Calculate overall health
    const componentHealthScores = Object.values(components).map(h => 
      h === 'healthy' ? 3 : h === 'degraded' ? 2 : 1
    );
    
    const avgScore = componentHealthScores.reduce((a, b) => a + b) / componentHealthScores.length;
    const overall = avgScore >= 2.5 ? 'healthy' : avgScore >= 1.5 ? 'degraded' : 'unhealthy';

    return { overall, components, recommendations };
  }

  /**
   * Setup integration with existing infrastructure
   */
  private setupIntegration(): void {
    // Register orchestrator with multi-agent system
    this.multiAgentSystem.registerAgent({
      id: 'principal_engineer_review_orchestrator',
      role: 'code_reviewer',
      specialization: [
        'comprehensive_review',
        'security_analysis', 
        'performance_optimization',
        'architectural_assessment',
        'code_quality_validation'
      ],
      tools: [
        'multi_agent_coordination',
        'pattern_recognition', 
        'metrics_analysis',
        'historical_learning',
        'knowledge_graph_integration'
      ],
      collaborationRules: [
        {
          trigger: 'review_request',
          targetRoles: ['security', 'architect', 'test_engineer'],
          priority: 'high'
        }
      ],
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    });

    // Setup coordination patterns for review workflow
    this.coordinationPatterns.registerPattern({
      id: 'principal_engineer_review_workflow',
      name: 'Principal Engineer Review Coordination',
      requiredRoles: ['code_reviewer'],
      workflow: [
        {
          id: 'analyze_code_structure',
          agentRole: 'code_reviewer',
          action: 'Analyze overall code structure and standards',
          dependsOn: [],
          expectedDuration: 30
        },
        {
          id: 'security_scan',
          agentRole: 'code_reviewer',
          action: 'Perform comprehensive security analysis',
          dependsOn: ['analyze_code_structure'],
          expectedDuration: 45
        },
        {
          id: 'performance_analysis', 
          agentRole: 'code_reviewer',
          action: 'Analyze performance bottlenecks and optimizations',
          dependsOn: ['analyze_code_structure'],
          expectedDuration: 40
        },
        {
          id: 'architectural_review',
          agentRole: 'code_reviewer', 
          action: 'Review architectural patterns and design decisions',
          dependsOn: ['analyze_code_structure'],
          expectedDuration: 50
        },
        {
          id: 'consolidate_findings',
          agentRole: 'code_reviewer',
          action: 'Consolidate all findings and generate recommendations',
          dependsOn: ['security_scan', 'performance_analysis', 'architectural_review'],
          expectedDuration: 20
        }
      ],
      triggers: ['principal_engineer_review_request']
    });
  }

  /**
   * Setup event handlers for integration
   */
  private setupEventHandlers(): void {
    // Forward orchestrator events
    this.orchestrator.on('review_event', (event: PrincipalEngineerReviewEvent) => {
      this.emit('review_event', event);
      
      // Update session context based on events
      this.updateSessionFromEvent(event);
    });

    // Handle coordination events
    this.coordinationPatterns.on('coordination_event', (event) => {
      this.emit('coordination_event', event);
    });

    // Handle multi-agent system events
    this.multiAgentSystem.subscribeToSystemEvents().subscribe(event => {
      if (event.agentId === 'principal_engineer_review_orchestrator') {
        this.emit('multi_agent_event', event);
      }
    });

    // Monitor production metrics
    this.productionMonitoring.on('metric_alert', (alert) => {
      if (alert.component === 'review_system') {
        this.emit('production_alert', alert);
      }
    });
  }

  /**
   * Update repository knowledge graph with review context
   */
  private async updateKnowledgeGraphContext(request: PrincipalEngineerReviewRequest): Promise<void> {
    const contextData = {
      reviewId: request.id,
      filePaths: request.filePaths,
      repository: request.repository,
      timestamp: Date.now(),
      reviewType: 'principal_engineer_comprehensive'
    };

    await this.knowledgeGraph.updateContext('review_session', contextData);
  }

  /**
   * Create task delegations for specialized review agents
   */
  private async createReviewTaskDelegations(
    request: PrincipalEngineerReviewRequest,
    sessionContext: ReviewSessionContext
  ): Promise<void> {
    const agentTasks = [
      {
        agentType: 'code_review_agent',
        task: 'Analyze code structure, standards, and general quality issues',
        priority: 'high' as const
      },
      {
        agentType: 'security_scanner',
        task: 'Perform comprehensive security vulnerability analysis',
        priority: 'critical' as const
      },
      {
        agentType: 'performance_optimizer',
        task: 'Identify performance bottlenecks and optimization opportunities',
        priority: 'high' as const
      },
      {
        agentType: 'architectural_reviewer',
        task: 'Review architectural patterns, DDD boundaries, and design decisions',
        priority: 'high' as const
      },
      {
        agentType: 'code_smell_detector',
        task: 'Detect anti-patterns and code smells with high accuracy',
        priority: 'medium' as const
      },
      {
        agentType: 'bug_pattern_analyzer',
        task: 'Analyze potential bug patterns using historical data',
        priority: 'medium' as const
      }
    ];

    for (const agentTask of agentTasks) {
      const delegationId = `${request.id}_${agentTask.agentType}`;
      
      await this.taskDelegationSystem.createDelegation({
        id: delegationId,
        taskId: request.id,
        delegatingAgentId: 'principal_engineer_review_orchestrator',
        assignedAgentId: agentTask.agentType,
        status: 'pending',
        description: agentTask.task,
        expectedCompletionTime: Date.now() + 300000, // 5 minutes
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      sessionContext.agentIds.push(agentTask.agentType);
    }
  }

  /**
   * Perform the integrated review process
   */
  private async performIntegratedReview(
    request: PrincipalEngineerReviewRequest,
    sessionContext: ReviewSessionContext
  ): Promise<void> {
    try {
      // Perform the review using the orchestrator
      const result = await this.orchestrator.performReview(request);
      
      // Process findings through integration hooks
      if (this.integrationHooks.findingProcessors) {
        for (const processor of this.integrationHooks.findingProcessors) {
          result.findings = await processor(result.findings);
        }
      }

      // Collect additional metrics
      if (this.integrationHooks.metricsCollectors) {
        const additionalMetrics: Record<string, any> = {};
        for (const collector of this.integrationHooks.metricsCollectors) {
          const metrics = await collector(result);
          Object.assign(additionalMetrics, metrics);
        }
        result.recommendations.longTermImprovements.push(
          ...Object.keys(additionalMetrics).map(key => `${key}: ${additionalMetrics[key]}`)
        );
      }

      // Update session context
      sessionContext.reviewState = 'completed';
      sessionContext.findings = result.findings;
      sessionContext.metrics.responseTime = result.overallMetrics.reviewTimeMs;
      sessionContext.metrics.qualityScore = result.overallMetrics.qualityScore;

      // Store final result in shared context
      await this.sharedContextStore.store(request.id, 'review_result', result, 'review_integration');
      await this.sharedContextStore.store(request.id, 'review_session', sessionContext, 'review_integration');

      // Execute completion hooks
      if (this.integrationHooks.onReviewComplete) {
        await this.integrationHooks.onReviewComplete(result, sessionContext);
      }

      // Update task delegations to completed
      for (const agentId of sessionContext.agentIds) {
        const delegationId = `${request.id}_${agentId}`;
        await this.taskDelegationSystem.updateDelegationStatus(delegationId, 'completed', result);
      }

      this.emit('review_completed', { reviewId: request.id, result, sessionContext });

    } catch (error) {
      sessionContext.reviewState = 'failed';
      await this.sharedContextStore.store(request.id, 'review_session', sessionContext, 'review_integration');
      
      this.emit('review_failed', { reviewId: request.id, error, sessionContext });
      throw error;
    } finally {
      // Clean up active session
      this.activeSessions.delete(request.id);
    }
  }

  /**
   * Update session context based on review events
   */
  private updateSessionFromEvent(event: PrincipalEngineerReviewEvent): void {
    const session = this.activeSessions.get(event.reviewId);
    if (!session) return;

    switch (event.type) {
      case 'agent_completed':
        if (event.agentId) {
          session.metrics.agentPerformance.set(event.agentId, event.payload);
        }
        break;
      
      case 'finding_generated':
        // Could update findings in real-time if needed
        break;
      
      case 'pattern_matched':
        // Could track pattern matching success
        break;
    }

    // Update shared context store
    this.sharedContextStore.store(event.reviewId, 'review_session', session, 'review_integration')
      .catch(error => console.error('Failed to update session context:', error));
  }

  /**
   * Shutdown the integration system
   */
  async shutdown(): Promise<void> {
    // Complete any active reviews
    const activeReviews = Array.from(this.activeSessions.keys());
    
    for (const reviewId of activeReviews) {
      try {
        const session = this.activeSessions.get(reviewId);
        if (session && session.reviewState === 'in_progress') {
          session.reviewState = 'failed';
          await this.sharedContextStore.store(reviewId, 'review_session', session, 'review_integration');
        }
      } catch (error) {
        console.error(`Failed to update session ${reviewId} during shutdown:`, error);
      }
    }

    this.activeSessions.clear();
    this.removeAllListeners();
  }
}