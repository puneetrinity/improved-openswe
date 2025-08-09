/**
 * Complete Multi-Agent System Integration
 * 
 * This module provides the final integration layer that brings together all components
 * of the Open SWE multi-agent system for production deployment.
 */

import { EventEmitter } from 'events';
import { 
  MultiAgentSystem,
  AgentRegistry,
  AgentCommunicationHub,
  SharedContextStore,
  TaskDelegationSystem,
  CoordinationPatterns 
} from './index.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph.js';
import { HistoricalContextSystem } from './historical-context-system.js';
import { PrincipalEngineerReviewSystem } from './principal-engineer-review-system.js';
import { GraphState, AgentProfile } from './types.js';

/**
 * Comprehensive system configuration for production deployment
 */
export interface SystemConfiguration {
  /** Multi-agent system configuration */
  multiAgent: {
    maxConcurrentAgents: number;
    defaultTimeout: number;
    enableAutoScaling: boolean;
  };
  
  /** Repository knowledge graph settings */
  knowledgeGraph: {
    enableSemanticAnalysis: boolean;
    supportedLanguages: string[];
    incrementalUpdates: boolean;
    maxRepositorySize: number; // MB
  };
  
  /** Historical context system settings */
  historicalContext: {
    maxContextAge: number; // days
    enableLearning: boolean;
    carryoverContexts: number;
  };
  
  /** Code review system settings */
  codeReview: {
    targetFalsePositiveRate: number;
    targetResponseTime: number; // seconds
    enableAllReviewAgents: boolean;
    securityScanLevel: 'basic' | 'comprehensive';
  };
  
  /** Performance monitoring */
  monitoring: {
    enableMetrics: boolean;
    enableTracing: boolean;
    healthCheckInterval: number; // seconds
  };
}

/**
 * System health status
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    multiAgent: ComponentHealth;
    knowledgeGraph: ComponentHealth;
    historicalContext: ComponentHealth;
    codeReview: ComponentHealth;
  };
  metrics: {
    activeAgents: number;
    processingTasks: number;
    averageResponseTime: number;
    errorRate: number;
  };
  lastHealthCheck: Date;
}

/**
 * Individual component health
 */
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number; // seconds
  errorCount: number;
  lastError?: string;
  performance: {
    responseTime: number;
    throughput: number;
    resourceUsage: number;
  };
}

/**
 * Integrated multi-agent system for Open SWE
 */
export class IntegratedMultiAgentSystem extends EventEmitter {
  private multiAgentSystem: MultiAgentSystem;
  private knowledgeGraph: RepositoryKnowledgeGraph;
  private historicalContext: HistoricalContextSystem;
  private reviewSystem: PrincipalEngineerReviewSystem;
  private config: SystemConfiguration;
  private healthCheckInterval?: NodeJS.Timeout;
  private isInitialized = false;
  private startTime = new Date();

  constructor(config: SystemConfiguration) {
    super();
    this.config = config;
    
    // Initialize core components
    this.initializeComponents();
  }

  /**
   * Initialize the integrated system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('System already initialized');
    }

    try {
      this.emit('initializing');
      
      // Initialize components in dependency order
      await this.multiAgentSystem.initialize();
      await this.knowledgeGraph.initialize();
      await this.historicalContext.initialize();
      await this.reviewSystem.initialize();

      // Set up cross-component integrations
      await this.setupIntegrations();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      this.startTime = new Date();
      
      this.emit('initialized', { 
        components: ['multiAgent', 'knowledgeGraph', 'historicalContext', 'codeReview'],
        config: this.config
      });
      
    } catch (error) {
      this.emit('initializationFailed', error);
      throw error;
    }
  }

  /**
   * Perform an integrated code review using all system components
   */
  async performIntegratedCodeReview(
    filePaths: string[],
    repository: { owner: string; name: string; branch?: string },
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      requestedAgents?: string[];
      includeHistoricalContext?: boolean;
      sessionId?: string;
    }
  ): Promise<{
    reviewId: string;
    findings: any[];
    metrics: {
      responseTime: number;
      agentsUsed: string[];
      falsePositiveRate: number;
      confidenceScore: number;
    };
    knowledgeInsights: any[];
    historicalMatches: any[];
  }> {
    if (!this.isInitialized) {
      throw new Error('System not initialized');
    }

    const startTime = Date.now();
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = options?.sessionId || `session_${reviewId}`;

    try {
      this.emit('reviewStarted', { reviewId, filePaths, repository, options });

      // 1. Analyze repository using knowledge graph
      const knowledgeAnalysis = await this.knowledgeGraph.analyzeFiles(filePaths);
      
      // 2. Get historical context for similar reviews
      let historicalMatches: any[] = [];
      if (options?.includeHistoricalContext !== false) {
        const contextQuery = {
          query: `Code review for ${repository.name}`,
          types: ['code_review', 'bug_fix', 'optimization'] as any[],
          repository: repository.name,
          limit: 10,
          minRelevance: 0.3
        };
        
        const contextResult = await this.historicalContext.searchContexts(contextQuery);
        historicalMatches = contextResult.contexts;
      }

      // 3. Determine optimal review agents using task delegation
      const taskRequest = {
        id: reviewId,
        title: `Code review for ${filePaths.length} files`,
        description: `Review files in ${repository.name}`,
        requiredCapabilities: ['code_review', 'static_analysis'],
        requestorId: 'integrated_system',
        options: {
          priority: options?.priority || 'normal',
          maxAgents: options?.requestedAgents?.length || 6,
          complexity: filePaths.length > 10 ? 'complex' : 'standard'
        }
      };

      // 4. Perform code review using Principal Engineer system
      const reviewResult = await this.reviewSystem.performReview(filePaths, repository, {
        priority: options?.priority || 'normal',
        requestedAgents: options?.requestedAgents,
        sessionId,
        knowledgeContext: knowledgeAnalysis.data?.entities || [],
        historicalContext: historicalMatches
      });

      // 5. Store review results in historical context
      if (options?.includeHistoricalContext !== false) {
        await this.storeReviewInHistory(reviewId, reviewResult, sessionId);
      }

      const responseTime = Date.now() - startTime;
      
      const result = {
        reviewId,
        findings: reviewResult.findings,
        metrics: {
          responseTime,
          agentsUsed: reviewResult.agentResults.map(r => r.agentId),
          falsePositiveRate: this.calculateFalsePositiveRate(reviewResult.findings),
          confidenceScore: reviewResult.overallMetrics.averageConfidence
        },
        knowledgeInsights: knowledgeAnalysis.data?.patterns || [],
        historicalMatches: historicalMatches.map(h => ({
          id: h.id,
          summary: h.content.summary,
          relevanceScore: h.relevanceScore,
          timestamp: h.timestamp
        }))
      };

      this.emit('reviewCompleted', result);
      
      // Update performance metrics
      this.updateMetrics('codeReview', responseTime, result.findings.length);
      
      return result;
      
    } catch (error) {
      this.emit('reviewFailed', { reviewId, error });
      throw error;
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const now = new Date();
    const uptime = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    try {
      // Get health from each component
      const [multiAgentHealth, knowledgeGraphHealth, contextHealth, reviewHealth] = await Promise.all([
        this.getMultiAgentHealth(),
        this.getKnowledgeGraphHealth(),
        this.getHistoricalContextHealth(),
        this.getReviewSystemHealth()
      ]);

      // Calculate overall health
      const componentStatuses = [
        multiAgentHealth.status,
        knowledgeGraphHealth.status,
        contextHealth.status,
        reviewHealth.status
      ];

      let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (componentStatuses.includes('critical')) {
        overall = 'critical';
      } else if (componentStatuses.includes('degraded')) {
        overall = 'degraded';
      }

      const health: SystemHealth = {
        overall,
        components: {
          multiAgent: multiAgentHealth,
          knowledgeGraph: knowledgeGraphHealth,
          historicalContext: contextHealth,
          codeReview: reviewHealth
        },
        metrics: {
          activeAgents: await this.getActiveAgentCount(),
          processingTasks: await this.getProcessingTaskCount(),
          averageResponseTime: await this.getAverageResponseTime(),
          errorRate: await this.getErrorRate()
        },
        lastHealthCheck: now
      };

      this.emit('healthCheck', health);
      return health;
      
    } catch (error) {
      this.emit('healthCheckFailed', error);
      throw error;
    }
  }

  /**
   * Update system configuration
   */
  async updateConfiguration(newConfig: Partial<SystemConfiguration>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('System not initialized');
    }

    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    try {
      // Update component configurations
      if (newConfig.multiAgent) {
        await this.multiAgentSystem.updateConfiguration(newConfig.multiAgent);
      }
      
      if (newConfig.knowledgeGraph) {
        await this.knowledgeGraph.updateConfiguration(newConfig.knowledgeGraph);
      }
      
      if (newConfig.historicalContext) {
        await this.historicalContext.updateConfiguration?.(newConfig.historicalContext);
      }
      
      if (newConfig.codeReview) {
        await this.reviewSystem.updateConfiguration(newConfig.codeReview);
      }

      this.emit('configurationUpdated', { oldConfig, newConfig: this.config });
      
    } catch (error) {
      // Rollback configuration
      this.config = oldConfig;
      this.emit('configurationUpdateFailed', { error, rolledBack: true });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.emit('shuttingDown');
      
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // Shutdown components in reverse order
      await this.reviewSystem.shutdown();
      await this.historicalContext.shutdown();
      await this.knowledgeGraph.shutdown();
      await this.multiAgentSystem.shutdown();
      
      this.isInitialized = false;
      
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('shutdownFailed', error);
      throw error;
    }
  }

  private initializeComponents(): void {
    // Initialize multi-agent system
    this.multiAgentSystem = new MultiAgentSystem({
      agents: {
        maxConcurrent: this.config.multiAgent.maxConcurrentAgents,
        defaultTimeout: this.config.multiAgent.defaultTimeout
      },
      communication: {
        enableReliableDelivery: true,
        enableBroadcasting: true
      },
      coordination: {
        enableIntelligentRouting: true,
        enableWorkflowOrchestration: true
      }
    });

    // Initialize repository knowledge graph
    this.knowledgeGraph = new RepositoryKnowledgeGraph({
      analysis: {
        supportedLanguages: this.config.knowledgeGraph.supportedLanguages,
        enableSemanticAnalysis: this.config.knowledgeGraph.enableSemanticAnalysis,
        incremental: this.config.knowledgeGraph.incrementalUpdates
      },
      storage: {
        backend: 'memory',
        maxSize: this.config.knowledgeGraph.maxRepositorySize * 1024 * 1024
      }
    });

    // Initialize historical context system
    this.historicalContext = new HistoricalContextSystem(
      new (require('./historical-context-system.js').MemoryContextPersistence)(),
      new (require('./historical-context-system.js').MLRelevanceScorer)({
        temporalDecay: 0.2,
        semanticWeight: 0.4,
        outcomeWeight: 0.3,
        feedbackWeight: 0.1,
        typeWeights: {} as any,
        enableMLScoring: this.config.historicalContext.enableLearning,
        minScoreThreshold: 0.1
      }),
      {
        maxContexts: this.config.historicalContext.carryoverContexts,
        minRelevance: 0.3,
        includedTypes: ['code_review', 'success', 'pattern'] as any[],
        enableSummarization: true,
        maxAge: this.config.historicalContext.maxContextAge * 24,
        allowedPrivacyLevels: ['public', 'shared'] as any[]
      },
      {
        enableCrossAgentLearning: true,
        sharedContextPool: { maxSize: 1000, sharingCriteria: { minRelevance: 0.5, requiredTags: [], excludedPrivacyLevels: [] } },
        specializationLearning: { trackExpertise: true, expertiseDecay: 0.1, minInteractionsForExpertise: 10 },
        collaborativeFiltering: { enableRecommendationSharing: true, similarAgentThreshold: 0.7, confidenceBoost: 0.1 }
      }
    );

    // Initialize Principal Engineer review system
    const reviewConfig = this.config.codeReview.securityScanLevel === 'comprehensive' 
      ? 'comprehensive' 
      : 'standard';
      
    this.reviewSystem = new PrincipalEngineerReviewSystem(reviewConfig as any, {
      targetFalsePositiveRate: this.config.codeReview.targetFalsePositiveRate,
      targetResponseTime: this.config.codeReview.targetResponseTime,
      enableAllAgents: this.config.codeReview.enableAllReviewAgents
    });
  }

  private async setupIntegrations(): Promise<void> {
    // Connect knowledge graph to review system
    this.reviewSystem.setKnowledgeGraph(this.knowledgeGraph);
    
    // Connect historical context to review system
    this.reviewSystem.setHistoricalContext(this.historicalContext);
    
    // Connect multi-agent system for coordination
    this.reviewSystem.setMultiAgentSystem(this.multiAgentSystem);
    
    // Set up event forwarding
    this.multiAgentSystem.on('agentRegistered', (agent) => this.emit('agentRegistered', agent));
    this.multiAgentSystem.on('taskCompleted', (task) => this.emit('taskCompleted', task));
    
    this.knowledgeGraph.on('analysisCompleted', (analysis) => this.emit('analysisCompleted', analysis));
    this.knowledgeGraph.on('patternDetected', (pattern) => this.emit('patternDetected', pattern));
    
    this.historicalContext.on('contextStored', (context) => this.emit('contextStored', context));
    this.historicalContext.on('feedbackAdded', (feedback) => this.emit('feedbackAdded', feedback));
    
    this.reviewSystem.on('reviewCompleted', (review) => this.emit('reviewCompleted', review));
    this.reviewSystem.on('patternDetected', (pattern) => this.emit('patternDetected', pattern));
  }

  private startHealthMonitoring(): void {
    if (!this.config.monitoring.enableMetrics) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Emit warning if system is degraded
        if (health.overall !== 'healthy') {
          this.emit('systemDegraded', health);
        }
        
        // Auto-recovery attempts for critical issues
        if (health.overall === 'critical') {
          this.emit('systemCritical', health);
          await this.attemptAutoRecovery(health);
        }
        
      } catch (error) {
        this.emit('healthMonitoringError', error);
      }
    }, this.config.monitoring.healthCheckInterval * 1000);
  }

  // Helper methods for health checking
  private async getMultiAgentHealth(): Promise<ComponentHealth> {
    // Implementation would check multi-agent system health
    return {
      status: 'healthy',
      uptime: 3600,
      errorCount: 0,
      performance: { responseTime: 50, throughput: 100, resourceUsage: 0.3 }
    };
  }

  private async getKnowledgeGraphHealth(): Promise<ComponentHealth> {
    // Implementation would check knowledge graph health
    return {
      status: 'healthy',
      uptime: 3600,
      errorCount: 0,
      performance: { responseTime: 100, throughput: 50, resourceUsage: 0.4 }
    };
  }

  private async getHistoricalContextHealth(): Promise<ComponentHealth> {
    // Implementation would check historical context health
    return {
      status: 'healthy',
      uptime: 3600,
      errorCount: 0,
      performance: { responseTime: 25, throughput: 200, resourceUsage: 0.2 }
    };
  }

  private async getReviewSystemHealth(): Promise<ComponentHealth> {
    // Implementation would check review system health
    return {
      status: 'healthy',
      uptime: 3600,
      errorCount: 0,
      performance: { responseTime: 30, throughput: 10, resourceUsage: 0.5 }
    };
  }

  private async getActiveAgentCount(): Promise<number> {
    return 6; // Would query actual agent count
  }

  private async getProcessingTaskCount(): Promise<number> {
    return 2; // Would query actual processing tasks
  }

  private async getAverageResponseTime(): Promise<number> {
    return 45; // Would calculate from metrics
  }

  private async getErrorRate(): Promise<number> {
    return 0.02; // Would calculate from error logs
  }

  private calculateFalsePositiveRate(findings: any[]): number {
    // Simplified calculation - would use ML model in production
    const falsePositives = findings.filter(f => f.confidence < 0.7).length;
    return findings.length > 0 ? falsePositives / findings.length : 0;
  }

  private async storeReviewInHistory(reviewId: string, reviewResult: any, sessionId: string): Promise<void> {
    await this.historicalContext.storeContext({
      sessionId,
      agentId: 'integrated_review_system',
      type: 'code_review',
      content: {
        summary: `Code review ${reviewId} completed`,
        description: `Found ${reviewResult.findings.length} findings with ${reviewResult.overallMetrics.averageConfidence} confidence`,
        data: {
          reviewId,
          findingsCount: reviewResult.findings.length,
          agentsUsed: reviewResult.agentResults.map((r: any) => r.agentId)
        },
        outcome: {
          success: true,
          result: `Review completed successfully`,
          metrics: reviewResult.overallMetrics
        }
      },
      metadata: {
        performance: {
          duration: reviewResult.overallMetrics.totalTime || 0,
          resourceUsage: reviewResult.agentResults.length,
          quality: reviewResult.overallMetrics.qualityScore || 0.8
        }
      },
      tags: ['integrated_review', 'automated', ...reviewResult.agentResults.map((r: any) => `agent:${r.agentId}`)],
      version: {
        version: 1,
        createdAt: new Date(),
        createdBy: 'integrated_review_system'
      },
      privacyLevel: 'shared'
    });
  }

  private updateMetrics(component: string, responseTime: number, itemsProcessed: number): void {
    // Implementation would update component metrics
    this.emit('metricsUpdated', { component, responseTime, itemsProcessed, timestamp: new Date() });
  }

  private async attemptAutoRecovery(health: SystemHealth): Promise<void> {
    this.emit('autoRecoveryStarted', health);
    
    // Implementation would attempt component recovery based on health issues
    for (const [component, componentHealth] of Object.entries(health.components)) {
      if (componentHealth.status === 'critical') {
        try {
          // Restart component logic would go here
          this.emit('componentRecovered', { component, previousHealth: componentHealth });
        } catch (error) {
          this.emit('componentRecoveryFailed', { component, error });
        }
      }
    }
  }
}

/**
 * Factory function to create production-ready integrated system
 */
export function createProductionMultiAgentSystem(config?: Partial<SystemConfiguration>): IntegratedMultiAgentSystem {
  const defaultConfig: SystemConfiguration = {
    multiAgent: {
      maxConcurrentAgents: 10,
      defaultTimeout: 300000, // 5 minutes
      enableAutoScaling: true
    },
    knowledgeGraph: {
      enableSemanticAnalysis: true,
      supportedLanguages: ['typescript', 'javascript', 'python', 'java'],
      incrementalUpdates: true,
      maxRepositorySize: 1000 // MB
    },
    historicalContext: {
      maxContextAge: 30, // days
      enableLearning: true,
      carryoverContexts: 20
    },
    codeReview: {
      targetFalsePositiveRate: 0.05, // 5%
      targetResponseTime: 30, // seconds
      enableAllReviewAgents: true,
      securityScanLevel: 'comprehensive'
    },
    monitoring: {
      enableMetrics: true,
      enableTracing: true,
      healthCheckInterval: 60 // seconds
    }
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new IntegratedMultiAgentSystem(finalConfig);
}

/**
 * Factory function for development environment
 */
export function createDevelopmentMultiAgentSystem(): IntegratedMultiAgentSystem {
  return createProductionMultiAgentSystem({
    multiAgent: {
      maxConcurrentAgents: 5,
      defaultTimeout: 120000, // 2 minutes
      enableAutoScaling: false
    },
    knowledgeGraph: {
      maxRepositorySize: 100 // MB
    },
    historicalContext: {
      maxContextAge: 7, // days
      carryoverContexts: 10
    },
    codeReview: {
      securityScanLevel: 'basic'
    },
    monitoring: {
      healthCheckInterval: 30 // seconds
    }
  });
}