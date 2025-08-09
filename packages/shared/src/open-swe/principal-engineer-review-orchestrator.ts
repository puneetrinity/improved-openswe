/**
 * Principal Engineer Review Orchestrator
 * 
 * This is the crown jewel orchestrator that coordinates all specialized review agents,
 * manages parallel execution, integrates with existing infrastructure, and provides
 * Principal Engineer-level code review capabilities.
 */

import { EventEmitter } from 'events';
import {
  PrincipalEngineerReviewConfig,
  PrincipalEngineerReviewRequest,
  PrincipalEngineerReviewResult,
  PrincipalEngineerReviewAgent,
  PrincipalEngineerAgentType,
  ReviewFinding,
  ReviewSeverity,
  ReviewCategory,
  PrincipalEngineerReviewEvent
} from './principal-engineer-review-types.js';
import {
  CodeReviewAgent,
  BugPatternAnalyzerAgent,
  CodeSmellDetectorAgent,
  PerformanceOptimizerAgent,
  SecurityScannerAgent,
  ArchitecturalReviewerAgent
} from './principal-engineer-review-agents.js';
import { MultiAgentSystem } from './multi-agent-system.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph.js';
import { HistoricalContext } from './historical-context-system.js';
import { TaskDelegationSystem } from './task-delegation-system.js';
import { CoordinationPatterns } from './coordination-patterns.js';
import { ProductionMonitoring } from './production-monitoring.js';

/**
 * Advanced metrics collection and analysis system
 */
export class ReviewMetricsSystem {
  private metrics = {
    totalReviews: 0,
    totalResponseTime: 0,
    totalFindings: 0,
    findingsBySeverity: new Map<ReviewSeverity, number>(),
    findingsByCategory: new Map<ReviewCategory, number>(),
    agentPerformance: new Map<string, {
      responseTime: number[];
      findingsCount: number[];
      confidence: number[];
      falsePositives: number;
      truePositives: number;
    }>(),
    patternMatches: {
      total: 0,
      successful: 0,
      matchRate: 0
    },
    qualityScores: number[],
    targetMetrics: {
      falsePositiveRate: 0,
      responseTime: 0,
      patternMatchRate: 0
    }
  };

  constructor(private config: PrincipalEngineerReviewConfig) {
    // Initialize severity and category maps
    ['info', 'warning', 'error', 'critical'].forEach(severity => {
      this.metrics.findingsBySeverity.set(severity as ReviewSeverity, 0);
    });
    
    ['security', 'performance', 'maintainability', 'reliability', 'architecture', 'best_practices', 'code_style', 'testing', 'documentation'].forEach(category => {
      this.metrics.findingsByCategory.set(category as ReviewCategory, 0);
    });
  }

  recordReview(result: PrincipalEngineerReviewResult): void {
    this.metrics.totalReviews++;
    this.metrics.totalResponseTime += result.overallMetrics.reviewTimeMs;
    this.metrics.totalFindings += result.overallMetrics.totalFindings;
    this.metrics.qualityScores.push(result.overallMetrics.qualityScore);

    // Update severity and category metrics
    Object.entries(result.overallMetrics.findingsBySeverity).forEach(([severity, count]) => {
      const current = this.metrics.findingsBySeverity.get(severity as ReviewSeverity) || 0;
      this.metrics.findingsBySeverity.set(severity as ReviewSeverity, current + count);
    });

    Object.entries(result.overallMetrics.findingsByCategory).forEach(([category, count]) => {
      const current = this.metrics.findingsByCategory.get(category as ReviewCategory) || 0;
      this.metrics.findingsByCategory.set(category as ReviewCategory, current + count);
    });

    // Update agent performance metrics
    Object.entries(result.agentMetrics).forEach(([agentId, metrics]) => {
      if (!this.metrics.agentPerformance.has(agentId)) {
        this.metrics.agentPerformance.set(agentId, {
          responseTime: [],
          findingsCount: [],
          confidence: [],
          falsePositives: 0,
          truePositives: 0
        });
      }
      
      const agentMetrics = this.metrics.agentPerformance.get(agentId)!;
      agentMetrics.responseTime.push(metrics.responseTimeMs);
      agentMetrics.findingsCount.push(metrics.findingsGenerated);
      agentMetrics.confidence.push(metrics.confidenceScore);
    });

    // Update pattern matching metrics
    if (result.bugPatternAnalysis) {
      this.metrics.patternMatches.total += result.bugPatternAnalysis.matchedPatterns.length;
      this.metrics.patternMatches.successful += result.bugPatternAnalysis.matchedPatterns.filter(p => p.matchConfidence > 0.7).length;
      this.metrics.patternMatches.matchRate = result.bugPatternAnalysis.matchRate;
    }

    this.updateTargetMetrics();
  }

  recordFeedback(agentId: string, feedback: { isValidFinding: boolean }[]): void {
    if (!this.metrics.agentPerformance.has(agentId)) return;
    
    const agentMetrics = this.metrics.agentPerformance.get(agentId)!;
    feedback.forEach(item => {
      if (item.isValidFinding) {
        agentMetrics.truePositives++;
      } else {
        agentMetrics.falsePositives++;
      }
    });

    this.updateTargetMetrics();
  }

  private updateTargetMetrics(): void {
    // Calculate false positive rate
    let totalFalsePositives = 0;
    let totalFindings = 0;
    
    this.metrics.agentPerformance.forEach(agentMetrics => {
      totalFalsePositives += agentMetrics.falsePositives;
      totalFindings += agentMetrics.falsePositives + agentMetrics.truePositives;
    });

    this.metrics.targetMetrics.falsePositiveRate = totalFindings > 0 ? totalFalsePositives / totalFindings : 0;
    this.metrics.targetMetrics.responseTime = this.metrics.totalReviews > 0 ? this.metrics.totalResponseTime / this.metrics.totalReviews : 0;
    this.metrics.targetMetrics.patternMatchRate = this.metrics.patternMatches.matchRate;
  }

  getMetrics() {
    const avgResponseTime = this.metrics.totalReviews > 0 ? this.metrics.totalResponseTime / this.metrics.totalReviews : 0;
    const avgQualityScore = this.metrics.qualityScores.length > 0 ? 
      this.metrics.qualityScores.reduce((a, b) => a + b, 0) / this.metrics.qualityScores.length : 0;

    return {
      overview: {
        totalReviews: this.metrics.totalReviews,
        avgResponseTime,
        avgQualityScore,
        totalFindings: this.metrics.totalFindings,
        targetMetrics: this.metrics.targetMetrics
      },
      findings: {
        bySeverity: Object.fromEntries(this.metrics.findingsBySeverity),
        byCategory: Object.fromEntries(this.metrics.findingsByCategory)
      },
      agents: Object.fromEntries(
        Array.from(this.metrics.agentPerformance.entries()).map(([agentId, metrics]) => [
          agentId,
          {
            avgResponseTime: metrics.responseTime.length > 0 ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length : 0,
            avgFindingsCount: metrics.findingsCount.length > 0 ? metrics.findingsCount.reduce((a, b) => a + b, 0) / metrics.findingsCount.length : 0,
            avgConfidence: metrics.confidence.length > 0 ? metrics.confidence.reduce((a, b) => a + b, 0) / metrics.confidence.length : 0,
            falsePositiveRate: (metrics.falsePositives + metrics.truePositives) > 0 ? metrics.falsePositives / (metrics.falsePositives + metrics.truePositives) : 0,
            totalReviews: metrics.responseTime.length
          }
        ])
      ),
      patterns: this.metrics.patternMatches,
      performance: {
        meetsFalsePositiveTarget: this.metrics.targetMetrics.falsePositiveRate <= this.config.targetFalsePositiveRate,
        meetsResponseTimeTarget: avgResponseTime <= this.config.targetResponseTime.standard,
        meetsPatternMatchTarget: this.metrics.patternMatches.matchRate >= 0.25, // 25% target
        healthScore: this.calculateHealthScore()
      }
    };
  }

  private calculateHealthScore(): number {
    let score = 100;
    
    // Deduct points for high false positive rate
    if (this.metrics.targetMetrics.falsePositiveRate > this.config.targetFalsePositiveRate) {
      score -= Math.min(30, (this.metrics.targetMetrics.falsePositiveRate - this.config.targetFalsePositiveRate) * 100);
    }
    
    // Deduct points for slow response time
    const avgResponseTime = this.metrics.totalReviews > 0 ? this.metrics.totalResponseTime / this.metrics.totalReviews : 0;
    if (avgResponseTime > this.config.targetResponseTime.standard) {
      score -= Math.min(20, (avgResponseTime - this.config.targetResponseTime.standard) / 1000);
    }
    
    // Deduct points for low pattern match rate
    if (this.metrics.patternMatches.matchRate < 0.25) {
      score -= Math.min(20, (0.25 - this.metrics.patternMatches.matchRate) * 100);
    }

    return Math.max(0, score);
  }
}

/**
 * Principal Engineer Review Orchestrator
 * 
 * Coordinates all specialized review agents to provide comprehensive,
 * Principal Engineer-level code review capabilities with advanced metrics,
 * learning capabilities, and integration with the existing multi-agent infrastructure.
 */
export class PrincipalEngineerReviewOrchestrator extends EventEmitter {
  private agents = new Map<PrincipalEngineerAgentType, PrincipalEngineerReviewAgent>();
  private metricsSystem: ReviewMetricsSystem;
  private activeReviews = new Map<string, PrincipalEngineerReviewResult>();
  private coordinationPatterns: CoordinationPatterns;
  
  constructor(
    private config: PrincipalEngineerReviewConfig,
    private multiAgentSystem: MultiAgentSystem,
    private knowledgeGraph?: RepositoryKnowledgeGraph,
    private historicalContext?: HistoricalContext,
    private taskDelegationSystem?: TaskDelegationSystem,
    private productionMonitoring?: ProductionMonitoring
  ) {
    super();
    
    this.metricsSystem = new ReviewMetricsSystem(config);
    this.coordinationPatterns = new CoordinationPatterns();
    
    this.initializeAgents();
    this.setupEventHandlers();
    this.registerWithMultiAgentSystem();
  }

  /**
   * Perform comprehensive Principal Engineer-level code review
   */
  async performReview(request: PrincipalEngineerReviewRequest): Promise<PrincipalEngineerReviewResult> {
    const reviewId = `pe_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.emitEvent({
      id: `review_started_${reviewId}`,
      type: 'review_started',
      reviewId,
      payload: { 
        filePaths: request.filePaths,
        priority: request.priority,
        requestedAgents: request.requestedAgents 
      }
    });

    try {
      // Initialize review result
      const reviewResult: PrincipalEngineerReviewResult = {
        reviewId,
        reviewedFiles: request.filePaths,
        overallMetrics: {
          totalFindings: 0,
          findingsBySeverity: { info: 0, warning: 0, error: 0, critical: 0 },
          findingsByCategory: { 
            security: 0, 
            performance: 0, 
            maintainability: 0, 
            reliability: 0, 
            architecture: 0, 
            best_practices: 0, 
            code_style: 0, 
            testing: 0, 
            documentation: 0 
          },
          estimatedFalsePositiveRate: 0,
          reviewTimeMs: 0,
          qualityScore: 0
        },
        findings: [],
        bugPatternAnalysis: {
          matchedPatterns: [],
          matchRate: 0,
          learningInsights: []
        },
        codeSmellAnalysis: {
          detectedSmells: [],
          refactoringSuggestions: [],
          severityDistribution: { info: 0, warning: 0, error: 0, critical: 0 }
        },
        performanceAnalysis: {
          issues: [],
          optimizations: [],
          metricsValidation: {}
        },
        securityAnalysis: {
          owaspFindings: [],
          securityScore: 100,
          criticalVulnerabilities: 0
        },
        architecturalAnalysis: {
          dddBoundaries: { wellDefined: true, violations: [], improvements: [] },
          microservicePatterns: { patternsUsed: [], missingPatterns: [], incorrectImplementations: [] },
          resiliencePatterns: { circuitBreaker: false, retry: false, timeout: false, bulkhead: false, rateLimit: false, suggestions: [] },
          dependencyAnalysis: { cyclicDependencies: [], highCoupling: [], suggestions: [] },
          scalabilityAssessment: { score: 0.8, bottlenecks: [], recommendations: [] }
        },
        designPatternAnalysis: {
          recognizedPatterns: [],
          antiPatterns: []
        },
        solidAnalysis: {
          singleResponsibility: { compliant: true, violations: [], suggestions: [] },
          openClosed: { compliant: true, violations: [], suggestions: [] },
          liskovSubstitution: { compliant: true, violations: [], suggestions: [] },
          interfaceSegregation: { compliant: true, violations: [], suggestions: [] },
          dependencyInversion: { compliant: true, violations: [], suggestions: [] },
          overallScore: 1.0
        },
        agentMetrics: {},
        historicalContext: {
          similarReviewsReferenced: 0,
          historicalPatternsMatched: 0,
          learningsApplied: []
        },
        recommendations: {
          priorityActions: [],
          longTermImprovements: [],
          trainingRecommendations: []
        },
        createdAt: startTime,
        completedAt: 0,
        status: 'in_progress'
      };

      this.activeReviews.set(reviewId, reviewResult);

      // Fetch file contents
      const codeContent = await this.fetchFileContents(request.filePaths, request.repository);

      // Determine which agents to run
      const agentsToRun = this.selectAgents(request);

      // Execute agents in parallel if enabled
      if (this.config.enableParallelExecution) {
        await this.executeAgentsInParallel(agentsToRun, request.filePaths, codeContent, { reviewId }, reviewResult);
      } else {
        await this.executeAgentsSequentially(agentsToRun, request.filePaths, codeContent, { reviewId }, reviewResult);
      }

      // Post-process results
      await this.postProcessResults(reviewResult);

      // Finalize review
      const completedAt = Date.now();
      reviewResult.completedAt = completedAt;
      reviewResult.overallMetrics.reviewTimeMs = completedAt - startTime;
      reviewResult.status = 'completed';

      // Record metrics
      this.metricsSystem.recordReview(reviewResult);

      // Update historical context
      if (this.historicalContext) {
        await this.historicalContext.recordReview({
          reviewId,
          findings: reviewResult.findings,
          metrics: reviewResult.overallMetrics,
          timestamp: completedAt
        });
      }

      this.emitEvent({
        id: `review_completed_${reviewId}`,
        type: 'review_completed',
        reviewId,
        payload: { 
          totalFindings: reviewResult.overallMetrics.totalFindings,
          qualityScore: reviewResult.overallMetrics.qualityScore,
          reviewTime: reviewResult.overallMetrics.reviewTimeMs
        }
      });

      // Clean up active reviews
      this.activeReviews.delete(reviewId);

      return reviewResult;

    } catch (error) {
      this.activeReviews.delete(reviewId);
      throw error;
    }
  }

  /**
   * Get system metrics and performance statistics
   */
  getMetrics() {
    return this.metricsSystem.getMetrics();
  }

  /**
   * Provide feedback on review findings to improve agent learning
   */
  async provideFeedback(
    reviewId: string,
    feedback: {
      agentId: string;
      findingId: string;
      isValidFinding: boolean;
      actualSeverity?: ReviewSeverity;
      comments?: string;
    }[]
  ): Promise<void> {
    // Group feedback by agent
    const feedbackByAgent = new Map<string, typeof feedback>();
    feedback.forEach(item => {
      if (!feedbackByAgent.has(item.agentId)) {
        feedbackByAgent.set(item.agentId, []);
      }
      feedbackByAgent.get(item.agentId)!.push(item);
    });

    // Send feedback to each agent
    for (const [agentId, agentFeedback] of feedbackByAgent) {
      const agent = Array.from(this.agents.values()).find(a => a.id === agentId);
      if (agent) {
        await agent.learnFromFeedback(reviewId, agentFeedback);
      }

      // Record metrics
      this.metricsSystem.recordFeedback(agentId, agentFeedback);
    }

    this.emitEvent({
      id: `learning_updated_${Date.now()}`,
      type: 'learning_updated',
      reviewId,
      payload: { feedbackCount: feedback.length }
    });
  }

  /**
   * Update orchestrator configuration
   */
  updateConfig(config: Partial<PrincipalEngineerReviewConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update agent configurations
    this.agents.forEach(agent => {
      agent.updateConfig(this.config);
    });
  }

  /**
   * Get health status of all agents
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    agents: { [agentId: string]: 'healthy' | 'degraded' | 'unhealthy' };
    recommendations: string[];
  }> {
    const agentHealth: { [agentId: string]: 'healthy' | 'degraded' | 'unhealthy' } = {};
    const recommendations: string[] = [];
    
    for (const [agentType, agent] of this.agents) {
      const metrics = agent.getMetrics();
      
      let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (metrics.falsePositiveRate > this.config.targetFalsePositiveRate * 1.5) {
        health = 'unhealthy';
        recommendations.push(`Agent ${agent.id} has high false positive rate: ${(metrics.falsePositiveRate * 100).toFixed(1)}%`);
      } else if (metrics.falsePositiveRate > this.config.targetFalsePositiveRate) {
        health = 'degraded';
        recommendations.push(`Agent ${agent.id} false positive rate above target: ${(metrics.falsePositiveRate * 100).toFixed(1)}%`);
      }
      
      if (metrics.avgResponseTime > this.config.targetResponseTime.standard * 2) {
        health = 'unhealthy';
        recommendations.push(`Agent ${agent.id} response time too slow: ${metrics.avgResponseTime}ms`);
      } else if (metrics.avgResponseTime > this.config.targetResponseTime.standard) {
        health = 'degraded';
      }
      
      agentHealth[agent.id] = health;
    }

    const healthValues = Object.values(agentHealth);
    const unhealthyCount = healthValues.filter(h => h === 'unhealthy').length;
    const degradedCount = healthValues.filter(h => h === 'degraded').length;
    
    const overall = 
      unhealthyCount > 0 ? 'unhealthy' :
      degradedCount > healthValues.length / 2 ? 'degraded' : 'healthy';

    return { overall, agents: agentHealth, recommendations };
  }

  private initializeAgents(): void {
    // Initialize all specialized agents
    this.agents.set('code_review_agent', new CodeReviewAgent(this.config, this.knowledgeGraph, this.historicalContext));
    this.agents.set('bug_pattern_analyzer', new BugPatternAnalyzerAgent(this.config, this.knowledgeGraph, this.historicalContext));
    this.agents.set('code_smell_detector', new CodeSmellDetectorAgent(this.config, this.knowledgeGraph, this.historicalContext));
    this.agents.set('performance_optimizer', new PerformanceOptimizerAgent(this.config, this.knowledgeGraph, this.historicalContext));
    this.agents.set('security_scanner', new SecurityScannerAgent(this.config, this.knowledgeGraph, this.historicalContext));
    this.agents.set('architectural_reviewer', new ArchitecturalReviewerAgent(this.config, this.knowledgeGraph, this.historicalContext));

    // Set up event forwarding from agents
    this.agents.forEach(agent => {
      agent.on('review_event', (event) => {
        this.emit('review_event', event);
      });
    });
  }

  private setupEventHandlers(): void {
    // Handle coordination patterns for agent synchronization
    this.coordinationPatterns.on('coordination_event', (event) => {
      this.emit('coordination_event', event);
    });
  }

  private async registerWithMultiAgentSystem(): Promise<void> {
    // Register this orchestrator as a specialized agent in the multi-agent system
    await this.multiAgentSystem.registerAgent({
      id: 'principal_engineer_review_orchestrator',
      role: 'code_reviewer',
      specialization: ['code_review', 'architecture', 'security', 'performance'],
      tools: ['review_orchestration', 'pattern_analysis', 'metrics_analysis'],
      collaborationRules: [],
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }, [
      { name: 'comprehensive_code_review', type: 'analysis', priority: 1 },
      { name: 'security_scanning', type: 'validation', priority: 1 },
      { name: 'performance_analysis', type: 'optimization', priority: 1 },
      { name: 'architectural_review', type: 'design', priority: 1 }
    ]);
  }

  private selectAgents(request: PrincipalEngineerReviewRequest): PrincipalEngineerAgentType[] {
    if (request.requestedAgents) {
      return request.requestedAgents;
    }

    // Default to all agents for comprehensive review
    return Array.from(this.agents.keys());
  }

  private async executeAgentsInParallel(
    agentTypes: PrincipalEngineerAgentType[],
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>,
    reviewResult: PrincipalEngineerReviewResult
  ): Promise<void> {
    const agentPromises = agentTypes.map(async (agentType) => {
      const agent = this.agents.get(agentType);
      if (!agent) return [];

      const startTime = Date.now();
      try {
        const findings = await agent.performReview(filePaths, codeContent, context);
        const responseTime = Date.now() - startTime;
        const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;

        reviewResult.agentMetrics[agent.id] = {
          responseTimeMs: responseTime,
          findingsGenerated: findings.length,
          confidenceScore: avgConfidence
        };

        return findings;
      } catch (error) {
        console.error(`Agent ${agentType} failed:`, error);
        return [];
      }
    });

    const allFindings = await Promise.all(agentPromises);
    reviewResult.findings = allFindings.flat();
  }

  private async executeAgentsSequentially(
    agentTypes: PrincipalEngineerAgentType[],
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>,
    reviewResult: PrincipalEngineerReviewResult
  ): Promise<void> {
    for (const agentType of agentTypes) {
      const agent = this.agents.get(agentType);
      if (!agent) continue;

      const startTime = Date.now();
      try {
        const findings = await agent.performReview(filePaths, codeContent, context);
        const responseTime = Date.now() - startTime;
        const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;

        reviewResult.agentMetrics[agent.id] = {
          responseTimeMs: responseTime,
          findingsGenerated: findings.length,
          confidenceScore: avgConfidence
        };

        reviewResult.findings.push(...findings);
      } catch (error) {
        console.error(`Agent ${agentType} failed:`, error);
      }
    }
  }

  private async fetchFileContents(
    filePaths: string[],
    repository: { owner: string; name: string; branch: string; commit?: string }
  ): Promise<Map<string, string>> {
    // This would typically fetch from Git/GitHub API
    // For now, returning mock data
    const codeContent = new Map<string, string>();
    
    filePaths.forEach(filePath => {
      // Mock file content - in real implementation, this would fetch from repository
      codeContent.set(filePath, `// Mock content for ${filePath}\n// This would be actual file content`);
    });

    return codeContent;
  }

  private async postProcessResults(reviewResult: PrincipalEngineerReviewResult): Promise<void> {
    // Calculate overall metrics
    reviewResult.overallMetrics.totalFindings = reviewResult.findings.length;

    // Group findings by severity and category
    reviewResult.findings.forEach(finding => {
      reviewResult.overallMetrics.findingsBySeverity[finding.severity]++;
      reviewResult.overallMetrics.findingsByCategory[finding.category]++;
    });

    // Calculate quality score (0-100)
    const criticalCount = reviewResult.overallMetrics.findingsBySeverity.critical;
    const errorCount = reviewResult.overallMetrics.findingsBySeverity.error;
    const warningCount = reviewResult.overallMetrics.findingsBySeverity.warning;
    
    let qualityScore = 100;
    qualityScore -= criticalCount * 20; // Critical issues heavily penalized
    qualityScore -= errorCount * 10;    // Error issues moderately penalized
    qualityScore -= warningCount * 2;   // Warning issues lightly penalized
    
    reviewResult.overallMetrics.qualityScore = Math.max(0, qualityScore);

    // Estimate false positive rate based on confidence levels
    const avgConfidence = reviewResult.findings.length > 0 ? 
      reviewResult.findings.reduce((sum, f) => sum + f.confidence, 0) / reviewResult.findings.length : 1;
    reviewResult.overallMetrics.estimatedFalsePositiveRate = Math.max(0, 1 - avgConfidence);

    // Generate recommendations
    this.generateRecommendations(reviewResult);
  }

  private generateRecommendations(reviewResult: PrincipalEngineerReviewResult): void {
    const { findings, overallMetrics } = reviewResult;

    // Priority actions based on critical and error findings
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const errorFindings = findings.filter(f => f.severity === 'error');

    if (criticalFindings.length > 0) {
      reviewResult.recommendations.priorityActions.push(
        `Address ${criticalFindings.length} critical security/reliability issues immediately`
      );
    }

    if (errorFindings.length > 0) {
      reviewResult.recommendations.priorityActions.push(
        `Fix ${errorFindings.length} error-level issues before deployment`
      );
    }

    // Long-term improvements based on patterns
    const securityFindings = findings.filter(f => f.category === 'security');
    const performanceFindings = findings.filter(f => f.category === 'performance');
    const maintainabilityFindings = findings.filter(f => f.category === 'maintainability');

    if (securityFindings.length > 5) {
      reviewResult.recommendations.longTermImprovements.push(
        'Implement comprehensive security training and secure coding practices'
      );
    }

    if (performanceFindings.length > 5) {
      reviewResult.recommendations.longTermImprovements.push(
        'Establish performance monitoring and optimization processes'
      );
    }

    if (maintainabilityFindings.length > 10) {
      reviewResult.recommendations.longTermImprovements.push(
        'Refactor codebase to improve maintainability and reduce technical debt'
      );
    }

    // Training recommendations
    if (overallMetrics.qualityScore < 70) {
      reviewResult.recommendations.trainingRecommendations.push(
        'Code quality training focusing on best practices and design patterns'
      );
    }

    if (securityFindings.length > 0) {
      reviewResult.recommendations.trainingRecommendations.push(
        'Security awareness training covering OWASP Top 10 vulnerabilities'
      );
    }
  }

  private emitEvent(event: Omit<PrincipalEngineerReviewEvent, 'timestamp'>): void {
    this.emit('review_event', {
      ...event,
      timestamp: Date.now()
    });
  }
}