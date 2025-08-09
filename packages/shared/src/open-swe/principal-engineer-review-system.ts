/**
 * Principal Engineer Code Review System - Main Entry Point
 * 
 * This is the main entry point for the Principal Engineer Code Review System,
 * the crown jewel of our multi-agent architecture that provides comprehensive,
 * sophisticated code review capabilities at Principal Engineer level.
 */

import { EventEmitter } from 'events';
import {
  PrincipalEngineerReviewConfig,
  PrincipalEngineerReviewRequest,
  PrincipalEngineerReviewResult,
  PerformanceThresholds,
  SecurityThresholds,
  CodeQualityThresholds
} from './principal-engineer-review-types.js';
import { PrincipalEngineerReviewIntegration } from './principal-engineer-review-integration.js';
import { MultiAgentSystem } from './multi-agent-system.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph.js';
import { HistoricalContext } from './historical-context-system.js';
import { TaskDelegationSystem } from './task-delegation-system.js';
import { SharedContextStore } from './shared-context-store.js';
import { CoordinationPatterns } from './coordination-patterns.js';
import { ProductionMonitoring } from './production-monitoring.js';
import { ReviewerGraphState } from './reviewer/types.js';

/**
 * Default configuration for the Principal Engineer Review System
 */
const DEFAULT_CONFIG: PrincipalEngineerReviewConfig = {
  performanceThresholds: {
    databaseQueryTime: 100, // ms
    indexHitRatio: 0.95,    // 95%
    cacheHitRatio: 0.90,    // 90%
    apiResponseTime: 200,   // ms
    memoryUsageThreshold: 512, // MB
    cpuUsageThreshold: 80   // %
  },
  securityThresholds: {
    sessionTimeoutMinutes: 30,
    passwordMinLength: 8,
    maxLoginAttempts: 3,
    rateLimitThreshold: 100, // requests per minute
    requiredSecurityHeaders: [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security'
    ]
  },
  codeQualityThresholds: {
    technicalDebtPercentage: 0.05,  // <5%
    maintainabilityIndex: 65,       // >65
    codeCoverage: {
      minimum: 80,  // 80%
      target: 90    // 90%
    },
    cyclomaticComplexity: 10,       // <10 per method
    linesOfCodePerMethod: 50,       // <50 lines
    duplicateCodePercentage: 0.03   // <3%
  },
  targetFalsePositiveRate: 0.05,    // <5%
  targetResponseTime: {
    standard: 30000,  // 30s for standard reviews
    complex: 300000   // 5 minutes for complex reviews
  },
  enableParallelExecution: true,
  maxConcurrentAgents: 6,
  enableHistoricalLearning: true,
  enableKnowledgeGraphIntegration: true,
  minimumConfidenceThreshold: 0.7
};

/**
 * Principal Engineer Code Review System
 * 
 * The crown jewel of the multi-agent system providing sophisticated,
 * comprehensive code review capabilities with Principal Engineer-level
 * expertise and intelligence.
 */
export class PrincipalEngineerReviewSystem extends EventEmitter {
  private integration: PrincipalEngineerReviewIntegration;
  private isInitialized = false;

  constructor(
    private config: PrincipalEngineerReviewConfig = DEFAULT_CONFIG,
    private multiAgentSystem?: MultiAgentSystem,
    private knowledgeGraph?: RepositoryKnowledgeGraph,
    private historicalContext?: HistoricalContext,
    private taskDelegationSystem?: TaskDelegationSystem,
    private sharedContextStore?: SharedContextStore,
    private coordinationPatterns?: CoordinationPatterns,
    private productionMonitoring?: ProductionMonitoring
  ) {
    super();
  }

  /**
   * Initialize the Principal Engineer Review System
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Principal Engineer Review System is already initialized');
    }

    try {
      // Initialize infrastructure components if not provided
      await this.initializeInfrastructure();

      // Create integration layer
      this.integration = new PrincipalEngineerReviewIntegration(
        this.config,
        this.multiAgentSystem!,
        this.knowledgeGraph!,
        this.historicalContext!,
        this.taskDelegationSystem!,
        this.sharedContextStore!,
        this.coordinationPatterns!,
        this.productionMonitoring!
      );

      // Setup event forwarding
      this.setupEventHandlers();

      this.isInitialized = true;

      this.emit('initialized', {
        timestamp: Date.now(),
        config: this.config
      });

    } catch (error) {
      this.emit('initialization_failed', { error });
      throw error;
    }
  }

  /**
   * Perform comprehensive Principal Engineer-level code review
   */
  async performReview(
    filePaths: string[],
    repository: {
      owner: string;
      name: string;
      branch: string;
      commit?: string;
    },
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      requestedAgents?: string[];
      context?: Record<string, unknown>;
      configOverrides?: Partial<PrincipalEngineerReviewConfig>;
    } = {}
  ): Promise<PrincipalEngineerReviewResult> {
    this.ensureInitialized();

    const request: PrincipalEngineerReviewRequest = {
      id: `pe_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filePaths,
      repository,
      configOverrides: options.configOverrides,
      context: {
        description: 'Comprehensive Principal Engineer review',
        ...options.context
      },
      priority: options.priority || 'medium',
      requestedAgents: options.requestedAgents as any,
      createdAt: Date.now(),
      requestedBy: {
        userId: 'system',
        type: 'automated'
      }
    };

    // Start review session
    const reviewId = await this.integration.startReviewSession(request);

    // Wait for completion and return result
    return this.waitForReviewCompletion(reviewId);
  }

  /**
   * Perform review integrated with existing reviewer graph
   */
  async performIntegratedReview(
    reviewerState: ReviewerGraphState,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      requestedAgents?: string[];
      configOverrides?: Partial<PrincipalEngineerReviewConfig>;
    } = {}
  ): Promise<PrincipalEngineerReviewResult> {
    this.ensureInitialized();

    const request: PrincipalEngineerReviewRequest = {
      id: `pe_integrated_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filePaths: reviewerState.changedFiles.split('\n').filter(f => f.trim()),
      repository: {
        owner: reviewerState.targetRepository.owner,
        name: reviewerState.targetRepository.repo,
        branch: reviewerState.branchName,
        commit: reviewerState.targetRepository.baseCommit
      },
      configOverrides: options.configOverrides,
      context: {
        description: 'Principal Engineer review integrated with existing reviewer',
        reviewerGraphContext: reviewerState,
        pullRequestNumber: reviewerState.githubIssueId
      },
      priority: options.priority || 'high',
      requestedAgents: options.requestedAgents as any,
      createdAt: Date.now(),
      requestedBy: {
        userId: 'reviewer_graph',
        type: 'automated'
      }
    };

    return this.integration.integrateWithReviewerGraph(reviewerState, request);
  }

  /**
   * Get review status and progress
   */
  async getReviewStatus(reviewId: string) {
    this.ensureInitialized();
    return this.integration.getReviewStatus(reviewId);
  }

  /**
   * Provide feedback to improve system learning
   */
  async provideFeedback(
    reviewId: string,
    feedback: {
      agentId: string;
      findingId: string;
      isValidFinding: boolean;
      actualSeverity?: 'info' | 'warning' | 'error' | 'critical';
      comments?: string;
    }[]
  ): Promise<void> {
    this.ensureInitialized();
    return this.integration.provideFeedback(reviewId, feedback);
  }

  /**
   * Get comprehensive system metrics
   */
  getMetrics() {
    this.ensureInitialized();
    return this.integration.getIntegrationMetrics();
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    this.ensureInitialized();
    return this.integration.performHealthCheck();
  }

  /**
   * Update system configuration
   */
  updateConfiguration(configUpdates: Partial<PrincipalEngineerReviewConfig>): void {
    this.config = { ...this.config, ...configUpdates };
    
    if (this.isInitialized) {
      // Update integration configuration
      this.integration.orchestrator?.updateConfig(this.config);
    }

    this.emit('configuration_updated', {
      timestamp: Date.now(),
      updates: configUpdates
    });
  }

  /**
   * Register custom hooks for extending the system
   */
  registerHooks(hooks: {
    onReviewStart?: (context: any) => Promise<void>;
    onAgentComplete?: (agentId: string, findings: any[], context: any) => Promise<void>;
    onReviewComplete?: (result: PrincipalEngineerReviewResult, context: any) => Promise<void>;
    onFeedbackReceived?: (reviewId: string, feedback: any[]) => Promise<void>;
    findingProcessors?: Array<(findings: any[]) => Promise<any[]>>;
    metricsCollectors?: Array<(result: PrincipalEngineerReviewResult) => Promise<Record<string, any>>>;
  }): void {
    this.ensureInitialized();
    this.integration.registerHooks(hooks);
  }

  /**
   * Create a specialized review configuration for specific scenarios
   */
  static createSpecializedConfig(scenario: 'security-focused' | 'performance-focused' | 'architecture-focused' | 'comprehensive'): PrincipalEngineerReviewConfig {
    const baseConfig = { ...DEFAULT_CONFIG };

    switch (scenario) {
      case 'security-focused':
        return {
          ...baseConfig,
          targetFalsePositiveRate: 0.02, // Even lower false positive rate for security
          enableParallelExecution: false, // Sequential for thorough security analysis
          requestedAgents: ['security_scanner', 'code_review_agent'],
          securityThresholds: {
            ...baseConfig.securityThresholds,
            sessionTimeoutMinutes: 15, // Stricter timeouts
            passwordMinLength: 12,      // Stronger passwords
            maxLoginAttempts: 2         // Fewer attempts
          }
        };

      case 'performance-focused':
        return {
          ...baseConfig,
          requestedAgents: ['performance_optimizer', 'code_review_agent', 'architectural_reviewer'],
          performanceThresholds: {
            ...baseConfig.performanceThresholds,
            databaseQueryTime: 50,    // Stricter query time
            cacheHitRatio: 0.95,      // Higher cache hit ratio
            memoryUsageThreshold: 256 // Lower memory threshold
          }
        };

      case 'architecture-focused':
        return {
          ...baseConfig,
          requestedAgents: ['architectural_reviewer', 'code_review_agent', 'code_smell_detector'],
          targetResponseTime: {
            standard: 60000,  // Allow more time for architectural analysis
            complex: 600000   // 10 minutes for complex architectural reviews
          }
        };

      case 'comprehensive':
      default:
        return {
          ...baseConfig,
          targetFalsePositiveRate: 0.03, // Slightly relaxed for comprehensive coverage
          enableParallelExecution: true,
          maxConcurrentAgents: 6 // Use all agents
        };
    }
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.integration.shutdown();
      
      this.removeAllListeners();
      this.isInitialized = false;

      this.emit('shutdown_complete', { timestamp: Date.now() });

    } catch (error) {
      this.emit('shutdown_failed', { error });
      throw error;
    }
  }

  private async initializeInfrastructure(): Promise<void> {
    // Initialize components that weren't provided
    if (!this.multiAgentSystem) {
      this.multiAgentSystem = new MultiAgentSystem({
        enableOrchestration: true,
        maxConcurrentOperations: 50,
        enableDetailedLogging: true
      });
    }

    if (!this.knowledgeGraph) {
      this.knowledgeGraph = new RepositoryKnowledgeGraph();
      await this.knowledgeGraph.initialize();
    }

    if (!this.historicalContext) {
      this.historicalContext = new HistoricalContext();
      await this.historicalContext.initialize();
    }

    if (!this.taskDelegationSystem) {
      this.taskDelegationSystem = new TaskDelegationSystem(
        this.multiAgentSystem,
        this.sharedContextStore
      );
      await this.taskDelegationSystem.initialize();
    }

    if (!this.sharedContextStore) {
      this.sharedContextStore = new SharedContextStore();
      await this.sharedContextStore.initialize();
    }

    if (!this.coordinationPatterns) {
      this.coordinationPatterns = new CoordinationPatterns();
    }

    if (!this.productionMonitoring) {
      this.productionMonitoring = new ProductionMonitoring({
        metricsCollectionInterval: 30000, // 30 seconds
        alertThresholds: {
          errorRate: 0.05,
          responseTime: 5000,
          memoryUsage: 0.8
        }
      });
      await this.productionMonitoring.initialize();
    }
  }

  private setupEventHandlers(): void {
    // Forward integration events
    this.integration.on('review_event', (event) => {
      this.emit('review_event', event);
    });

    this.integration.on('review_completed', (data) => {
      this.emit('review_completed', data);
    });

    this.integration.on('review_failed', (data) => {
      this.emit('review_failed', data);
    });

    this.integration.on('feedback_received', (data) => {
      this.emit('feedback_received', data);
    });
  }

  private async waitForReviewCompletion(reviewId: string, timeoutMs: number = 600000): Promise<PrincipalEngineerReviewResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Review ${reviewId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkCompletion = async () => {
        try {
          const status = await this.integration.getReviewStatus(reviewId);
          
          if (status.status === 'completed') {
            clearTimeout(timeout);
            clearInterval(pollInterval);
            
            // Retrieve the full result
            const result = await this.sharedContextStore!.retrieve(reviewId, 'review_result');
            resolve(result);
            
          } else if (status.status === 'failed') {
            clearTimeout(timeout);
            clearInterval(pollInterval);
            reject(new Error(`Review ${reviewId} failed`));
          }
          
        } catch (error) {
          clearTimeout(timeout);
          clearInterval(pollInterval);
          reject(error);
        }
      };

      // Poll every 2 seconds
      const pollInterval = setInterval(checkCompletion, 2000);
      
      // Initial check
      checkCompletion();
    });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Principal Engineer Review System must be initialized before use. Call initialize() first.');
    }
  }
}

/**
 * Factory function to create a pre-configured Principal Engineer Review System
 */
export async function createPrincipalEngineerReviewSystem(
  scenario: 'security-focused' | 'performance-focused' | 'architecture-focused' | 'comprehensive' = 'comprehensive',
  customConfig?: Partial<PrincipalEngineerReviewConfig>
): Promise<PrincipalEngineerReviewSystem> {
  const config = {
    ...PrincipalEngineerReviewSystem.createSpecializedConfig(scenario),
    ...customConfig
  };

  const system = new PrincipalEngineerReviewSystem(config);
  await system.initialize();
  
  return system;
}

/**
 * Export default configuration for easy customization
 */
export { DEFAULT_CONFIG as DefaultPrincipalEngineerConfig };

/**
 * Export all types for external use
 */
export * from './principal-engineer-review-types.js';
export * from './principal-engineer-review-agents.js';
export * from './principal-engineer-review-orchestrator.js';
export * from './principal-engineer-pattern-recognition.js';
export * from './principal-engineer-review-integration.js';