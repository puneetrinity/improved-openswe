/**
 * Principal Engineer Code Review System Types
 * 
 * This module defines comprehensive types for the Principal Engineer-level 
 * code review system, including specialized review agents, metrics, and
 * advanced analysis capabilities.
 */

import { AgentRole, AgentProfile, AgentMessage } from './types.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph-types.js';
import { HistoricalContext } from './historical-context-types.js';

/**
 * Specialized review agent types for Principal Engineer-level analysis
 */
export type PrincipalEngineerAgentType = 
  | 'code_review_agent'
  | 'bug_pattern_analyzer' 
  | 'code_smell_detector'
  | 'performance_optimizer'
  | 'security_scanner'
  | 'architectural_reviewer'
  | 'solid_principles_validator'
  | 'design_pattern_recognizer';

/**
 * Performance metrics thresholds for code quality validation
 */
export interface PerformanceThresholds {
  /**
   * Database query performance (<100ms)
   */
  databaseQueryTime: number;
  
  /**
   * Index hit ratio (>95%)
   */
  indexHitRatio: number;
  
  /**
   * Cache hit ratio (>90%)
   */
  cacheHitRatio: number;
  
  /**
   * API response time (<200ms)
   */
  apiResponseTime: number;
  
  /**
   * Memory usage threshold (MB)
   */
  memoryUsageThreshold: number;
  
  /**
   * CPU usage threshold (%)
   */
  cpuUsageThreshold: number;
}

/**
 * Security validation thresholds
 */
export interface SecurityThresholds {
  /**
   * Session timeout (<30 minutes)
   */
  sessionTimeoutMinutes: number;
  
  /**
   * Password complexity (minimum 8 characters)
   */
  passwordMinLength: number;
  
  /**
   * Maximum login attempts
   */
  maxLoginAttempts: number;
  
  /**
   * Rate limiting threshold (requests per minute)
   */
  rateLimitThreshold: number;
  
  /**
   * Required security headers
   */
  requiredSecurityHeaders: string[];
}

/**
 * Code quality metrics thresholds
 */
export interface CodeQualityThresholds {
  /**
   * Technical debt percentage (<5%)
   */
  technicalDebtPercentage: number;
  
  /**
   * Maintainability index (>65)
   */
  maintainabilityIndex: number;
  
  /**
   * Code coverage percentage (80-90%)
   */
  codeCoverage: {
    minimum: number;
    target: number;
  };
  
  /**
   * Cyclomatic complexity (<10 per method)
   */
  cyclomaticComplexity: number;
  
  /**
   * Lines of code per method (<50)
   */
  linesOfCodePerMethod: number;
  
  /**
   * Duplicate code percentage (<3%)
   */
  duplicateCodePercentage: number;
}

/**
 * Review severity levels
 */
export type ReviewSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Review finding categories
 */
export type ReviewCategory = 
  | 'security'
  | 'performance' 
  | 'maintainability'
  | 'reliability'
  | 'architecture'
  | 'best_practices'
  | 'code_style'
  | 'testing'
  | 'documentation';

/**
 * Individual review finding from a specialized agent
 */
export interface ReviewFinding {
  /**
   * Unique finding identifier
   */
  id: string;
  
  /**
   * Agent that generated this finding
   */
  agentId: string;
  
  /**
   * Agent type
   */
  agentType: PrincipalEngineerAgentType;
  
  /**
   * Finding severity
   */
  severity: ReviewSeverity;
  
  /**
   * Finding category
   */
  category: ReviewCategory;
  
  /**
   * File path where issue was found
   */
  filePath: string;
  
  /**
   * Line number(s) affected
   */
  lineNumbers: number[];
  
  /**
   * Issue title
   */
  title: string;
  
  /**
   * Detailed description
   */
  description: string;
  
  /**
   * Recommended fix or improvement
   */
  recommendation: string;
  
  /**
   * Code snippet showing the issue
   */
  codeSnippet: string;
  
  /**
   * Suggested code fix
   */
  suggestedFix?: string;
  
  /**
   * Confidence level (0-1)
   */
  confidence: number;
  
  /**
   * Pattern or rule that triggered this finding
   */
  triggeredRule: string;
  
  /**
   * Historical context reference (if applicable)
   */
  historicalContextId?: string;
  
  /**
   * Links to documentation or best practices
   */
  references: string[];
  
  /**
   * Timestamp when finding was generated
   */
  createdAt: number;
  
  /**
   * Additional metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Bug pattern match information
 */
export interface BugPatternMatch {
  /**
   * Pattern identifier
   */
  patternId: string;
  
  /**
   * Pattern name/description
   */
  patternName: string;
  
  /**
   * Historical occurrences of this pattern
   */
  historicalMatches: number;
  
  /**
   * Match confidence (0-1)
   */
  matchConfidence: number;
  
  /**
   * Similar historical fixes
   */
  similarFixes: string[];
  
  /**
   * Pattern severity based on historical data
   */
  historicalSeverity: ReviewSeverity;
}

/**
 * Design pattern recognition result
 */
export interface DesignPatternRecognition {
  /**
   * Recognized pattern type
   */
  patternType: 'singleton' | 'factory' | 'observer' | 'strategy' | 'decorator' | 'adapter' | 'command' | 'facade' | 'proxy' | 'builder' | 'prototype' | 'chain_of_responsibility' | 'mediator' | 'memento' | 'state' | 'template_method' | 'visitor' | 'abstract_factory' | 'bridge' | 'composite' | 'flyweight' | 'interpreter' | 'iterator';
  
  /**
   * Implementation quality (0-1)
   */
  implementationQuality: number;
  
  /**
   * Whether pattern is correctly applied
   */
  correctlyApplied: boolean;
  
  /**
   * Improvement suggestions
   */
  improvements: string[];
  
  /**
   * Files involved in the pattern
   */
  involvedFiles: string[];
}

/**
 * Anti-pattern detection result
 */
export interface AntiPatternDetection {
  /**
   * Anti-pattern type
   */
  antiPatternType: 'god_object' | 'spaghetti_code' | 'copy_paste' | 'golden_hammer' | 'lava_flow' | 'magic_numbers' | 'hard_coding' | 'dead_code' | 'shotgun_surgery' | 'feature_envy' | 'inappropriate_intimacy' | 'refuse_bequest' | 'speculative_generality';
  
  /**
   * Severity of the anti-pattern
   */
  severity: ReviewSeverity;
  
  /**
   * Impact assessment
   */
  impact: {
    maintainability: number; // 0-1
    testability: number; // 0-1
    performance: number; // 0-1
    reliability: number; // 0-1
  };
  
  /**
   * Refactoring suggestions
   */
  refactoringSuggestions: string[];
  
  /**
   * Files affected
   */
  affectedFiles: string[];
}

/**
 * SOLID principles validation result
 */
export interface SolidPrinciplesValidation {
  /**
   * Single Responsibility Principle validation
   */
  singleResponsibility: {
    compliant: boolean;
    violations: string[];
    suggestions: string[];
  };
  
  /**
   * Open-Closed Principle validation
   */
  openClosed: {
    compliant: boolean;
    violations: string[];
    suggestions: string[];
  };
  
  /**
   * Liskov Substitution Principle validation
   */
  liskovSubstitution: {
    compliant: boolean;
    violations: string[];
    suggestions: string[];
  };
  
  /**
   * Interface Segregation Principle validation
   */
  interfaceSegregation: {
    compliant: boolean;
    violations: string[];
    suggestions: string[];
  };
  
  /**
   * Dependency Inversion Principle validation
   */
  dependencyInversion: {
    compliant: boolean;
    violations: string[];
    suggestions: string[];
  };
  
  /**
   * Overall SOLID compliance score (0-1)
   */
  overallScore: number;
}

/**
 * Architecture review result
 */
export interface ArchitecturalReview {
  /**
   * Domain-Driven Design boundary validation
   */
  dddBoundaries: {
    wellDefined: boolean;
    violations: string[];
    improvements: string[];
  };
  
  /**
   * Microservice patterns validation
   */
  microservicePatterns: {
    patternsUsed: string[];
    missingPatterns: string[];
    incorrectImplementations: string[];
  };
  
  /**
   * Resilience patterns validation
   */
  resiliencePatterns: {
    circuitBreaker: boolean;
    retry: boolean;
    timeout: boolean;
    bulkhead: boolean;
    rateLimit: boolean;
    suggestions: string[];
  };
  
  /**
   * Dependency analysis
   */
  dependencyAnalysis: {
    cyclicDependencies: string[];
    highCoupling: string[];
    suggestions: string[];
  };
  
  /**
   * Scalability assessment
   */
  scalabilityAssessment: {
    score: number; // 0-1
    bottlenecks: string[];
    recommendations: string[];
  };
}

/**
 * OWASP Top 10 security finding
 */
export interface OwaspSecurityFinding {
  /**
   * OWASP Top 10 category
   */
  owaspCategory: 'A01:2021' | 'A02:2021' | 'A03:2021' | 'A04:2021' | 'A05:2021' | 'A06:2021' | 'A07:2021' | 'A08:2021' | 'A09:2021' | 'A10:2021';
  
  /**
   * Category description
   */
  categoryDescription: string;
  
  /**
   * Specific vulnerability type
   */
  vulnerabilityType: string;
  
  /**
   * Risk level
   */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * CWE identifier (if applicable)
   */
  cweId?: string;
  
  /**
   * Remediation steps
   */
  remediation: string[];
  
  /**
   * Example of secure implementation
   */
  secureExample?: string;
}

/**
 * Comprehensive review result from all specialized agents
 */
export interface PrincipalEngineerReviewResult {
  /**
   * Unique review session identifier
   */
  reviewId: string;
  
  /**
   * Files reviewed
   */
  reviewedFiles: string[];
  
  /**
   * Overall review metrics
   */
  overallMetrics: {
    /**
     * Total findings count
     */
    totalFindings: number;
    
    /**
     * Findings by severity
     */
    findingsBySeverity: Record<ReviewSeverity, number>;
    
    /**
     * Findings by category
     */
    findingsByCategory: Record<ReviewCategory, number>;
    
    /**
     * False positive rate estimate
     */
    estimatedFalsePositiveRate: number;
    
    /**
     * Review completion time (ms)
     */
    reviewTimeMs: number;
    
    /**
     * Overall quality score (0-100)
     */
    qualityScore: number;
  };
  
  /**
   * Individual findings from all agents
   */
  findings: ReviewFinding[];
  
  /**
   * Bug pattern analysis results
   */
  bugPatternAnalysis: {
    /**
     * Matched patterns
     */
    matchedPatterns: BugPatternMatch[];
    
    /**
     * Target match rate achieved (should be ~25%)
     */
    matchRate: number;
    
    /**
     * Historical learning insights
     */
    learningInsights: string[];
  };
  
  /**
   * Code smell detection results
   */
  codeSmellAnalysis: {
    /**
     * Detected smells
     */
    detectedSmells: string[];
    
    /**
     * Refactoring suggestions
     */
    refactoringSuggestions: string[];
    
    /**
     * Severity distribution
     */
    severityDistribution: Record<ReviewSeverity, number>;
  };
  
  /**
   * Performance analysis results
   */
  performanceAnalysis: {
    /**
     * Performance issues found
     */
    issues: string[];
    
    /**
     * Optimization suggestions
     */
    optimizations: string[];
    
    /**
     * Metrics validation
     */
    metricsValidation: Record<string, boolean>;
  };
  
  /**
   * Security scan results
   */
  securityAnalysis: {
    /**
     * OWASP findings
     */
    owaspFindings: OwaspSecurityFinding[];
    
    /**
     * Security score (0-100)
     */
    securityScore: number;
    
    /**
     * Critical vulnerabilities
     */
    criticalVulnerabilities: number;
  };
  
  /**
   * Architectural review results
   */
  architecturalAnalysis: ArchitecturalReview;
  
  /**
   * Design pattern analysis
   */
  designPatternAnalysis: {
    /**
     * Recognized patterns
     */
    recognizedPatterns: DesignPatternRecognition[];
    
    /**
     * Detected anti-patterns
     */
    antiPatterns: AntiPatternDetection[];
  };
  
  /**
   * SOLID principles validation
   */
  solidAnalysis: SolidPrinciplesValidation;
  
  /**
   * Agent performance metrics
   */
  agentMetrics: {
    [agentId: string]: {
      responseTimeMs: number;
      findingsGenerated: number;
      confidenceScore: number;
    };
  };
  
  /**
   * Historical context utilized
   */
  historicalContext: {
    similarReviewsReferenced: number;
    historicalPatternsMatched: number;
    learningsApplied: string[];
  };
  
  /**
   * Review recommendations
   */
  recommendations: {
    /**
     * Priority actions to take
     */
    priorityActions: string[];
    
    /**
     * Long-term improvements
     */
    longTermImprovements: string[];
    
    /**
     * Training recommendations for team
     */
    trainingRecommendations: string[];
  };
  
  /**
   * Review timestamp
   */
  createdAt: number;
  
  /**
   * Review completion timestamp
   */
  completedAt: number;
  
  /**
   * Review status
   */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Configuration for the Principal Engineer review system
 */
export interface PrincipalEngineerReviewConfig {
  /**
   * Performance thresholds
   */
  performanceThresholds: PerformanceThresholds;
  
  /**
   * Security thresholds
   */
  securityThresholds: SecurityThresholds;
  
  /**
   * Code quality thresholds
   */
  codeQualityThresholds: CodeQualityThresholds;
  
  /**
   * Target false positive rate (<5%)
   */
  targetFalsePositiveRate: number;
  
  /**
   * Target response time for reviews (<30s standard, <300s complex)
   */
  targetResponseTime: {
    standard: number;
    complex: number;
  };
  
  /**
   * Enable parallel agent execution
   */
  enableParallelExecution: boolean;
  
  /**
   * Maximum concurrent agents
   */
  maxConcurrentAgents: number;
  
  /**
   * Enable historical learning
   */
  enableHistoricalLearning: boolean;
  
  /**
   * Enable repository knowledge graph integration
   */
  enableKnowledgeGraphIntegration: boolean;
  
  /**
   * Minimum confidence threshold for findings (0-1)
   */
  minimumConfidenceThreshold: number;
}

/**
 * Specialized review agent interface
 */
export interface PrincipalEngineerReviewAgent {
  /**
   * Agent identifier
   */
  id: string;
  
  /**
   * Agent type
   */
  type: PrincipalEngineerAgentType;
  
  /**
   * Agent configuration
   */
  config: PrincipalEngineerReviewConfig;
  
  /**
   * Repository knowledge graph reference
   */
  knowledgeGraph?: RepositoryKnowledgeGraph;
  
  /**
   * Historical context reference
   */
  historicalContext?: HistoricalContext;
  
  /**
   * Perform specialized review
   * 
   * @param filePaths - Files to review
   * @param codeContent - Map of file paths to content
   * @param context - Additional context information
   * @returns Promise resolving to review findings
   */
  performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]>;
  
  /**
   * Update agent configuration
   * 
   * @param config - New configuration
   */
  updateConfig(config: Partial<PrincipalEngineerReviewConfig>): void;
  
  /**
   * Get agent metrics
   * 
   * @returns Current agent performance metrics
   */
  getMetrics(): {
    totalReviews: number;
    avgResponseTime: number;
    avgConfidence: number;
    falsePositiveRate: number;
  };
  
  /**
   * Learn from feedback
   * 
   * @param reviewId - Review identifier
   * @param feedback - Feedback on findings
   */
  learnFromFeedback(
    reviewId: string,
    feedback: {
      findingId: string;
      isValidFinding: boolean;
      actualSeverity?: ReviewSeverity;
      comments?: string;
    }[]
  ): Promise<void>;
}

/**
 * Event types for the Principal Engineer review system
 */
export interface PrincipalEngineerReviewEvent {
  /**
   * Event identifier
   */
  id: string;
  
  /**
   * Event type
   */
  type: 'review_started' | 'agent_completed' | 'review_completed' | 'finding_generated' | 'pattern_matched' | 'learning_updated';
  
  /**
   * Review session identifier
   */
  reviewId: string;
  
  /**
   * Agent identifier (if applicable)
   */
  agentId?: string;
  
  /**
   * Event payload
   */
  payload: Record<string, unknown>;
  
  /**
   * Event timestamp
   */
  timestamp: number;
}

/**
 * Principal Engineer review request
 */
export interface PrincipalEngineerReviewRequest {
  /**
   * Request identifier
   */
  id: string;
  
  /**
   * Files to review
   */
  filePaths: string[];
  
  /**
   * Repository information
   */
  repository: {
    owner: string;
    name: string;
    branch: string;
    commit?: string;
  };
  
  /**
   * Review configuration overrides
   */
  configOverrides?: Partial<PrincipalEngineerReviewConfig>;
  
  /**
   * Additional context
   */
  context: {
    pullRequestNumber?: number;
    targetBranch?: string;
    description?: string;
    labels?: string[];
  };
  
  /**
   * Priority level
   */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Requested agent types (if specific agents needed)
   */
  requestedAgents?: PrincipalEngineerAgentType[];
  
  /**
   * Request timestamp
   */
  createdAt: number;
  
  /**
   * Requestor information
   */
  requestedBy: {
    userId: string;
    type: 'human' | 'automated' | 'ci_cd';
  };
}