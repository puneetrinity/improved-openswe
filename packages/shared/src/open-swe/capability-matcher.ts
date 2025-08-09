/**
 * Capability Matcher for intelligent agent-task matching
 * 
 * Provides sophisticated algorithms for matching tasks to the most suitable agents
 * based on capabilities, performance history, current load, and other factors.
 */

import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import { AgentProfile, AgentRole, AgentMetrics } from './types.js';
import { AgentLoadInfo, AgentHealthCheck, RuntimeAgentProfile } from './agent-registry.js';
import {
  TaskDelegationRequest,
  CapabilityScore,
  TaskComplexity,
  TaskPriority,
  LoadBalancingConfig
} from './task-delegation-types.js';

/**
 * Machine learning-inspired scoring algorithm configuration
 */
interface ScoringAlgorithmConfig {
  /**
   * Weight factors for different scoring components
   */
  weights: {
    capabilityMatch: number;      // 0.35 - Most important factor
    performance: number;          // 0.25 - Historical performance
    availability: number;         // 0.20 - Current availability
    responseTime: number;         // 0.10 - Response time performance
    quality: number;              // 0.10 - Quality of past work
  };

  /**
   * Penalty factors for various negative conditions
   */
  penalties: {
    overload: number;             // Penalty for overloaded agents
    recentFailure: number;        // Penalty for recent failures
    mismatchedRole: number;       // Penalty for role mismatch
    highResponseTime: number;     // Penalty for slow response
    lowQuality: number;           // Penalty for poor quality work
  };

  /**
   * Bonus factors for positive conditions
   */
  bonuses: {
    perfectMatch: number;         // Bonus for perfect capability match
    highPerformance: number;      // Bonus for excellent performance
    lowLoad: number;              // Bonus for low current load
    fastResponse: number;         // Bonus for fast response times
    specialization: number;       // Bonus for specialized expertise
  };

  /**
   * Thresholds for various scoring decisions
   */
  thresholds: {
    minAcceptableScore: number;   // Minimum score to consider agent
    excellentScore: number;       // Score threshold for excellent match
    overloadThreshold: number;    // Load threshold for overload penalty
    slowResponseThreshold: number; // Response time threshold for penalty
    lowQualityThreshold: number;  // Quality threshold for penalty
  };
}

/**
 * Agent matching context for enhanced decision making
 */
interface MatchingContext {
  /**
   * Current system load
   */
  systemLoad: number;

  /**
   * Time constraints
   */
  timeConstraints: {
    urgent: boolean;
    deadline?: number;
    expectedDuration?: number;
  };

  /**
   * Quality requirements
   */
  qualityRequirements: {
    minQualityScore: number;
    reviewRequired: boolean;
    criticalTask: boolean;
  };

  /**
   * Collaboration context
   */
  collaboration: {
    teamTask: boolean;
    existingTeamMembers: string[];
    collaborationHistory: Record<string, number>; // agent pairs -> success rate
  };

  /**
   * Historical context
   */
  historical: {
    similarTasks: string[];
    pastPerformance: Record<string, AgentMetrics>;
    recentFailures: Record<string, number>;
  };
}

/**
 * Capability analysis result with detailed insights
 */
interface CapabilityAnalysis {
  /**
   * Exact capability matches
   */
  exactMatches: string[];

  /**
   * Partial capability matches
   */
  partialMatches: Array<{
    capability: string;
    similarity: number;
    reasons: string[];
  }>;

  /**
   * Missing critical capabilities
   */
  missingCapabilities: string[];

  /**
   * Additional beneficial capabilities
   */
  additionalCapabilities: string[];

  /**
   * Capability coverage percentage
   */
  coveragePercentage: number;

  /**
   * Specialization level for this task
   */
  specializationLevel: 'none' | 'low' | 'moderate' | 'high' | 'expert';
}

/**
 * Performance prediction based on historical data
 */
interface PerformancePrediction {
  /**
   * Predicted success probability (0-1)
   */
  successProbability: number;

  /**
   * Predicted completion time (milliseconds)
   */
  estimatedCompletionTime: number;

  /**
   * Predicted quality score (0-100)
   */
  predictedQuality: number;

  /**
   * Confidence in predictions (0-1)
   */
  confidence: number;

  /**
   * Risk factors
   */
  riskFactors: Array<{
    factor: string;
    impact: number;
    mitigation: string;
  }>;

  /**
   * Prediction model used
   */
  modelUsed: 'simple_average' | 'weighted_history' | 'trend_analysis' | 'ml_regression';
}

/**
 * Comprehensive Capability Matcher with ML-inspired algorithms
 */
export class CapabilityMatcher {
  private readonly logger = createLogger(LogLevel.INFO, 'CapabilityMatcher');

  /**
   * Scoring algorithm configuration
   */
  private readonly config: ScoringAlgorithmConfig;

  /**
   * Capability similarity cache for performance
   */
  private readonly similarityCache = new Map<string, Map<string, number>>();

  /**
   * Performance prediction cache
   */
  private readonly predictionCache = new Map<string, PerformancePrediction>();

  /**
   * Statistical data for normalization
   */
  private readonly statistics = {
    avgResponseTime: 1000,
    avgSuccessRate: 0.95,
    avgQualityScore: 85,
    avgLoad: 0.3,
    lastUpdated: Date.now()
  };

  constructor(config?: Partial<ScoringAlgorithmConfig>) {
    this.config = {
      weights: {
        capabilityMatch: 0.35,
        performance: 0.25,
        availability: 0.20,
        responseTime: 0.10,
        quality: 0.10
      },
      penalties: {
        overload: 0.30,
        recentFailure: 0.25,
        mismatchedRole: 0.20,
        highResponseTime: 0.15,
        lowQuality: 0.20
      },
      bonuses: {
        perfectMatch: 0.25,
        highPerformance: 0.20,
        lowLoad: 0.15,
        fastResponse: 0.10,
        specialization: 0.30
      },
      thresholds: {
        minAcceptableScore: 40,
        excellentScore: 85,
        overloadThreshold: 0.8,
        slowResponseThreshold: 3000,
        lowQualityThreshold: 70
      },
      ...config
    };

    this.logger.info('CapabilityMatcher initialized', { config: this.config });
  }

  /**
   * Finds and scores the best matching agents for a task request
   * 
   * @param request - Task delegation request with requirements
   * @param availableAgents - List of available agent profiles
   * @param context - Additional context for enhanced matching
   * @returns Array of capability scores sorted by suitability
   */
  async findBestMatches(
    request: TaskDelegationRequest,
    availableAgents: RuntimeAgentProfile[],
    context?: Partial<MatchingContext>
  ): Promise<CapabilityScore[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting agent matching process', {
        taskId: request.taskId,
        agentsCount: availableAgents.length,
        requiredCapabilities: request.requiredCapabilities.length
      });

      // Build complete matching context
      const matchingContext = await this.buildMatchingContext(request, availableAgents, context);

      // Calculate capability scores for all agents
      const scores: CapabilityScore[] = [];

      for (const agent of availableAgents) {
        try {
          const score = await this.calculateAgentScore(request, agent, matchingContext);
          
          // Only include agents above minimum threshold
          if (score.overallScore >= this.config.thresholds.minAcceptableScore) {
            scores.push(score);
          }

        } catch (error) {
          this.logger.warn('Failed to score agent', {
            agentId: agent.id,
            error: error instanceof Error ? error.message : error
          });
        }
      }

      // Sort by overall score (descending)
      scores.sort((a, b) => b.overallScore - a.overallScore);

      // Apply diversity and collaboration optimization
      const optimizedScores = this.optimizeForDiversity(scores, request, matchingContext);

      const executionTime = Date.now() - startTime;
      
      this.logger.info('Agent matching completed', {
        taskId: request.taskId,
        candidatesFound: optimizedScores.length,
        executionTime,
        topScore: optimizedScores[0]?.overallScore || 0
      });

      return optimizedScores;

    } catch (error) {
      this.logger.error('Agent matching failed', {
        taskId: request.taskId,
        error: error instanceof Error ? error.message : error
      });

      throw new Error(`Agent matching failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Analyzes agent capabilities against task requirements
   * 
   * @param requirements - Required and preferred capabilities
   * @param agent - Agent profile to analyze
   * @returns Detailed capability analysis
   */
  async analyzeCapabilities(
    requirements: { required: string[]; preferred?: string[] },
    agent: RuntimeAgentProfile
  ): Promise<CapabilityAnalysis> {
    const agentCapabilities = [
      ...agent.specialization,
      ...agent.tools,
      agent.role // Include role as a capability
    ];

    const analysis: CapabilityAnalysis = {
      exactMatches: [],
      partialMatches: [],
      missingCapabilities: [],
      additionalCapabilities: [],
      coveragePercentage: 0,
      specializationLevel: 'none'
    };

    // Find exact matches
    for (const required of requirements.required) {
      if (agentCapabilities.includes(required)) {
        analysis.exactMatches.push(required);
      } else {
        // Look for partial matches using similarity
        const similarity = this.calculateCapabilitySimilarity(required, agentCapabilities);
        if (similarity.score > 0.6) {
          analysis.partialMatches.push({
            capability: required,
            similarity: similarity.score,
            reasons: similarity.reasons
          });
        } else {
          analysis.missingCapabilities.push(required);
        }
      }
    }

    // Calculate coverage percentage
    const totalRequired = requirements.required.length;
    const covered = analysis.exactMatches.length + (analysis.partialMatches.length * 0.7);
    analysis.coveragePercentage = Math.min(100, (covered / totalRequired) * 100);

    // Determine specialization level
    analysis.specializationLevel = this.determineSpecializationLevel(analysis.coveragePercentage);

    // Find additional capabilities
    analysis.additionalCapabilities = agentCapabilities.filter(cap => 
      !analysis.exactMatches.includes(cap) && 
      !requirements.required.includes(cap)
    );

    return analysis;
  }

  /**
   * Predicts agent performance for a specific task
   * 
   * @param agent - Agent to analyze
   * @param request - Task request
   * @param context - Matching context
   * @returns Performance prediction with confidence
   */
  async predictPerformance(
    agent: RuntimeAgentProfile,
    request: TaskDelegationRequest,
    context: MatchingContext
  ): Promise<PerformancePrediction> {
    const cacheKey = `${agent.id}_${request.taskId}_${request.complexity}`;
    
    // Check cache first
    if (this.predictionCache.has(cacheKey)) {
      return this.predictionCache.get(cacheKey)!;
    }

    const metrics = agent.metrics;
    const loadInfo = agent.loadInfo;

    // Base predictions on historical data
    let successProbability = metrics.successRate;
    let estimatedCompletionTime = request.expectedDuration || this.estimateCompletionTime(request, agent);
    let predictedQuality = metrics.qualityScore;
    let confidence = 0.7; // Base confidence

    const riskFactors: Array<{ factor: string; impact: number; mitigation: string }> = [];

    // Adjust based on task complexity
    const complexityMultiplier = this.getComplexityMultiplier(request.complexity);
    estimatedCompletionTime *= complexityMultiplier;
    
    if (complexityMultiplier > 1.5) {
      successProbability *= 0.9; // Reduce success probability for complex tasks
      riskFactors.push({
        factor: 'High task complexity',
        impact: 0.1,
        mitigation: 'Provide additional resources or break down into smaller tasks'
      });
    }

    // Adjust based on current load
    if (loadInfo.currentLoad > this.config.thresholds.overloadThreshold * 100) {
      successProbability *= 0.85;
      estimatedCompletionTime *= 1.3;
      riskFactors.push({
        factor: 'High current load',
        impact: 0.15,
        mitigation: 'Wait for load to decrease or assign to different agent'
      });
    }

    // Adjust based on recent failures
    const recentFailures = context.historical.recentFailures[agent.id] || 0;
    if (recentFailures > 0) {
      const failurePenalty = Math.min(0.3, recentFailures * 0.1);
      successProbability *= (1 - failurePenalty);
      riskFactors.push({
        factor: `Recent failures (${recentFailures})`,
        impact: failurePenalty,
        mitigation: 'Monitor closely and provide additional support'
      });
    }

    // Boost confidence for specialized agents
    const capabilityAnalysis = await this.analyzeCapabilities(
      { required: request.requiredCapabilities, preferred: request.preferredCapabilities },
      agent
    );

    if (capabilityAnalysis.specializationLevel === 'expert') {
      successProbability = Math.min(1, successProbability * 1.1);
      predictedQuality = Math.min(100, predictedQuality * 1.1);
      confidence = Math.min(1, confidence * 1.3);
    }

    // Adjust for team collaboration
    if (context.collaboration.teamTask) {
      const collaborationSuccess = this.calculateCollaborationSuccess(
        agent.id,
        context.collaboration.existingTeamMembers,
        context.collaboration.collaborationHistory
      );
      successProbability *= collaborationSuccess;
      confidence *= collaborationSuccess;
    }

    const prediction: PerformancePrediction = {
      successProbability: Math.max(0, Math.min(1, successProbability)),
      estimatedCompletionTime,
      predictedQuality: Math.max(0, Math.min(100, predictedQuality)),
      confidence: Math.max(0, Math.min(1, confidence)),
      riskFactors,
      modelUsed: 'weighted_history'
    };

    // Cache the prediction
    this.predictionCache.set(cacheKey, prediction);

    return prediction;
  }

  /**
   * Calculates comprehensive score for an agent-task match
   * 
   * @private
   */
  private async calculateAgentScore(
    request: TaskDelegationRequest,
    agent: RuntimeAgentProfile,
    context: MatchingContext
  ): Promise<CapabilityScore> {
    const reasoning: string[] = [];

    // 1. Capability Matching Score (35%)
    const capabilityAnalysis = await this.analyzeCapabilities(
      { required: request.requiredCapabilities, preferred: request.preferredCapabilities },
      agent
    );
    
    const capabilityScore = this.calculateCapabilityScore(capabilityAnalysis, reasoning);

    // 2. Performance Score (25%)
    const performancePrediction = await this.predictPerformance(agent, request, context);
    const performanceScore = performancePrediction.successProbability * 100;
    reasoning.push(`Performance score: ${performanceScore.toFixed(1)} (based on ${performancePrediction.confidence.toFixed(2)} confidence)`);

    // 3. Availability Score (20%)
    const availabilityScore = this.calculateAvailabilityScore(agent.loadInfo, reasoning);

    // 4. Response Time Score (10%)
    const responseTimeScore = this.calculateResponseTimeScore(agent.loadInfo, reasoning);

    // 5. Quality Score (10%)
    const qualityScore = this.normalizeQualityScore(agent.metrics.qualityScore, reasoning);

    // Calculate weighted overall score
    let overallScore = 
      (capabilityScore * this.config.weights.capabilityMatch) +
      (performanceScore * this.config.weights.performance) +
      (availabilityScore * this.config.weights.availability) +
      (responseTimeScore * this.config.weights.responseTime) +
      (qualityScore * this.config.weights.quality);

    // Apply bonuses and penalties
    overallScore = this.applyBonusesAndPenalties(
      overallScore, 
      agent, 
      capabilityAnalysis, 
      context, 
      reasoning
    );

    // Individual capability scores for detailed analysis
    const capabilityScores: Record<string, number> = {};
    for (const capability of request.requiredCapabilities) {
      capabilityScores[capability] = this.getCapabilitySpecificScore(capability, agent);
    }

    return {
      agentId: agent.id,
      overallScore: Math.max(0, Math.min(100, overallScore)),
      capabilityMatch: capabilityScore,
      availabilityScore,
      performanceScore,
      responseTimeScore,
      qualityScore,
      capabilityScores,
      reasoning,
      confidence: performancePrediction.confidence
    };
  }

  /**
   * Calculates capability matching score
   * 
   * @private
   */
  private calculateCapabilityScore(analysis: CapabilityAnalysis, reasoning: string[]): number {
    let score = analysis.coveragePercentage;

    // Bonus for exact matches
    const exactMatchBonus = (analysis.exactMatches.length / Math.max(1, analysis.exactMatches.length + analysis.missingCapabilities.length)) * 20;
    score += exactMatchBonus;

    // Specialization bonus
    const specializationBonus = this.getSpecializationBonus(analysis.specializationLevel);
    score += specializationBonus;

    reasoning.push(`Capability score: ${score.toFixed(1)} (${analysis.coveragePercentage.toFixed(1)}% coverage + ${exactMatchBonus.toFixed(1)} exact match bonus + ${specializationBonus.toFixed(1)} specialization bonus)`);

    return Math.min(100, score);
  }

  /**
   * Calculates availability score based on current load
   * 
   * @private
   */
  private calculateAvailabilityScore(loadInfo: AgentLoadInfo, reasoning: string[]): number {
    const loadPercentage = loadInfo.currentLoad;
    const availabilityScore = Math.max(0, 100 - loadPercentage);
    
    reasoning.push(`Availability score: ${availabilityScore.toFixed(1)} (${loadPercentage.toFixed(1)}% current load)`);
    
    return availabilityScore;
  }

  /**
   * Calculates response time score
   * 
   * @private
   */
  private calculateResponseTimeScore(loadInfo: AgentLoadInfo, reasoning: string[]): number {
    const normalizedTime = Math.min(1, loadInfo.avgResponseTime / this.statistics.avgResponseTime);
    const responseTimeScore = Math.max(0, 100 * (1 - normalizedTime));
    
    reasoning.push(`Response time score: ${responseTimeScore.toFixed(1)} (${loadInfo.avgResponseTime}ms avg response time)`);
    
    return responseTimeScore;
  }

  /**
   * Normalizes quality score
   * 
   * @private
   */
  private normalizeQualityScore(qualityScore: number, reasoning: string[]): number {
    const normalized = Math.min(100, qualityScore);
    reasoning.push(`Quality score: ${normalized.toFixed(1)}`);
    return normalized;
  }

  /**
   * Applies bonuses and penalties to the base score
   * 
   * @private
   */
  private applyBonusesAndPenalties(
    baseScore: number,
    agent: RuntimeAgentProfile,
    analysis: CapabilityAnalysis,
    context: MatchingContext,
    reasoning: string[]
  ): number {
    let adjustedScore = baseScore;
    const adjustments: string[] = [];

    // Perfect match bonus
    if (analysis.coveragePercentage === 100 && analysis.missingCapabilities.length === 0) {
      const bonus = this.config.bonuses.perfectMatch;
      adjustedScore += bonus;
      adjustments.push(`Perfect match bonus: +${bonus}`);
    }

    // High performance bonus
    if (agent.metrics.successRate > 0.98) {
      const bonus = this.config.bonuses.highPerformance;
      adjustedScore += bonus;
      adjustments.push(`High performance bonus: +${bonus}`);
    }

    // Low load bonus
    if (agent.loadInfo.currentLoad < 20) {
      const bonus = this.config.bonuses.lowLoad;
      adjustedScore += bonus;
      adjustments.push(`Low load bonus: +${bonus}`);
    }

    // Overload penalty
    if (agent.loadInfo.currentLoad > this.config.thresholds.overloadThreshold * 100) {
      const penalty = this.config.penalties.overload;
      adjustedScore -= penalty;
      adjustments.push(`Overload penalty: -${penalty}`);
    }

    // Recent failure penalty
    const recentFailures = context.historical.recentFailures[agent.id] || 0;
    if (recentFailures > 0) {
      const penalty = this.config.penalties.recentFailure * Math.min(3, recentFailures);
      adjustedScore -= penalty;
      adjustments.push(`Recent failure penalty: -${penalty} (${recentFailures} failures)`);
    }

    // Quality penalty
    if (agent.metrics.qualityScore < this.config.thresholds.lowQualityThreshold) {
      const penalty = this.config.penalties.lowQuality;
      adjustedScore -= penalty;
      adjustments.push(`Low quality penalty: -${penalty}`);
    }

    // Specialization bonus
    if (analysis.specializationLevel === 'expert') {
      const bonus = this.config.bonuses.specialization;
      adjustedScore += bonus;
      adjustments.push(`Specialization bonus: +${bonus}`);
    }

    if (adjustments.length > 0) {
      reasoning.push(`Adjustments: ${adjustments.join(', ')}`);
    }

    return adjustedScore;
  }

  /**
   * Calculates capability similarity using advanced string matching
   * 
   * @private
   */
  private calculateCapabilitySimilarity(
    required: string,
    agentCapabilities: string[]
  ): { score: number; reasons: string[] } {
    const cacheKey = `${required}_${agentCapabilities.join(',')}`);
    
    if (this.similarityCache.has(required)) {
      const cached = this.similarityCache.get(required)?.get(cacheKey);
      if (cached !== undefined) {
        return { score: cached, reasons: ['Cached similarity'] };
      }
    }

    let maxSimilarity = 0;
    const reasons: string[] = [];

    for (const capability of agentCapabilities) {
      const similarity = this.stringSimilarity(required.toLowerCase(), capability.toLowerCase());
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        reasons.length = 0; // Clear previous reasons
        reasons.push(`Best match: '${capability}' (${(similarity * 100).toFixed(1)}% similar)`);
      }
    }

    // Cache the result
    if (!this.similarityCache.has(required)) {
      this.similarityCache.set(required, new Map());
    }
    this.similarityCache.get(required)!.set(cacheKey, maxSimilarity);

    return { score: maxSimilarity, reasons };
  }

  /**
   * Calculates string similarity using Levenshtein distance and other metrics
   * 
   * @private
   */
  private stringSimilarity(str1: string, str2: string): number {
    // Quick exact match
    if (str1 === str2) return 1.0;

    // Check if one contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }

    // Levenshtein distance calculation
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Builds comprehensive matching context
   * 
   * @private
   */
  private async buildMatchingContext(
    request: TaskDelegationRequest,
    availableAgents: RuntimeAgentProfile[],
    partialContext?: Partial<MatchingContext>
  ): Promise<MatchingContext> {
    const avgLoad = availableAgents.reduce((sum, agent) => sum + agent.loadInfo.currentLoad, 0) / availableAgents.length;

    return {
      systemLoad: avgLoad / 100, // Convert to 0-1 range
      timeConstraints: {
        urgent: request.priority === 'urgent' || request.priority === 'critical',
        deadline: request.deadline,
        expectedDuration: request.expectedDuration
      },
      qualityRequirements: {
        minQualityScore: request.complexity === 'critical' ? 90 : 75,
        reviewRequired: request.complexity === 'complex' || request.complexity === 'critical',
        criticalTask: request.priority === 'critical'
      },
      collaboration: {
        teamTask: (request.maxAgents || 1) > 1,
        existingTeamMembers: [],
        collaborationHistory: {}
      },
      historical: {
        similarTasks: [],
        pastPerformance: availableAgents.reduce((acc, agent) => {
          acc[agent.id] = agent.metrics;
          return acc;
        }, {} as Record<string, AgentMetrics>),
        recentFailures: {}
      },
      ...partialContext
    };
  }

  /**
   * Optimizes agent selection for diversity and collaboration
   * 
   * @private
   */
  private optimizeForDiversity(
    scores: CapabilityScore[],
    request: TaskDelegationRequest,
    context: MatchingContext
  ): CapabilityScore[] {
    // If single agent needed or not many candidates, return as-is
    if ((request.maxAgents || 1) === 1 || scores.length <= 3) {
      return scores;
    }

    // For team tasks, optimize for complementary skills and collaboration history
    if (context.collaboration.teamTask) {
      return this.optimizeForTeamWork(scores, request, context);
    }

    return scores;
  }

  /**
   * Optimizes agent selection for team work
   * 
   * @private
   */
  private optimizeForTeamWork(
    scores: CapabilityScore[],
    request: TaskDelegationRequest,
    context: MatchingContext
  ): CapabilityScore[] {
    const optimized = [...scores];

    // Sort by a combination of individual score and team compatibility
    optimized.sort((a, b) => {
      const teamScoreA = this.calculateTeamScore(a.agentId, request, context);
      const teamScoreB = this.calculateTeamScore(b.agentId, request, context);
      
      const combinedA = a.overallScore * 0.7 + teamScoreA * 0.3;
      const combinedB = b.overallScore * 0.7 + teamScoreB * 0.3;
      
      return combinedB - combinedA;
    });

    return optimized;
  }

  /**
   * Calculates team compatibility score
   * 
   * @private
   */
  private calculateTeamScore(
    agentId: string,
    request: TaskDelegationRequest,
    context: MatchingContext
  ): number {
    // Base team score
    let teamScore = 50;

    // Check collaboration history with existing team members
    for (const existingMember of context.collaboration.existingTeamMembers) {
      const collaborationKey = `${agentId}_${existingMember}`;
      const reverseKey = `${existingMember}_${agentId}`;
      
      const successRate = 
        context.collaboration.collaborationHistory[collaborationKey] ||
        context.collaboration.collaborationHistory[reverseKey] ||
        0.7; // Default neutral score
      
      teamScore += (successRate - 0.5) * 40; // Adjust based on past collaboration
    }

    return Math.max(0, Math.min(100, teamScore));
  }

  /**
   * Determines specialization level from coverage percentage
   * 
   * @private
   */
  private determineSpecializationLevel(coveragePercentage: number): CapabilityAnalysis['specializationLevel'] {
    if (coveragePercentage >= 95) return 'expert';
    if (coveragePercentage >= 80) return 'high';
    if (coveragePercentage >= 60) return 'moderate';
    if (coveragePercentage >= 30) return 'low';
    return 'none';
  }

  /**
   * Gets complexity multiplier for time estimation
   * 
   * @private
   */
  private getComplexityMultiplier(complexity: TaskComplexity): number {
    switch (complexity) {
      case 'trivial': return 0.5;
      case 'simple': return 0.8;
      case 'moderate': return 1.0;
      case 'complex': return 1.5;
      case 'critical': return 2.0;
      default: return 1.0;
    }
  }

  /**
   * Gets specialization bonus based on level
   * 
   * @private
   */
  private getSpecializationBonus(level: CapabilityAnalysis['specializationLevel']): number {
    switch (level) {
      case 'expert': return 15;
      case 'high': return 10;
      case 'moderate': return 5;
      case 'low': return 2;
      case 'none': return 0;
      default: return 0;
    }
  }

  /**
   * Gets capability-specific score for an agent
   * 
   * @private
   */
  private getCapabilitySpecificScore(capability: string, agent: RuntimeAgentProfile): number {
    const capabilities = [...agent.specialization, ...agent.tools];
    
    if (capabilities.includes(capability)) {
      return 100; // Exact match
    }

    // Calculate similarity-based score
    const similarity = this.calculateCapabilitySimilarity(capability, capabilities);
    return similarity.score * 100;
  }

  /**
   * Estimates completion time for a task
   * 
   * @private
   */
  private estimateCompletionTime(request: TaskDelegationRequest, agent: RuntimeAgentProfile): number {
    // Base time estimation based on complexity
    let baseTime = 3600000; // 1 hour default

    switch (request.complexity) {
      case 'trivial':
        baseTime = 900000; // 15 minutes
        break;
      case 'simple':
        baseTime = 1800000; // 30 minutes
        break;
      case 'moderate':
        baseTime = 3600000; // 1 hour
        break;
      case 'complex':
        baseTime = 7200000; // 2 hours
        break;
      case 'critical':
        baseTime = 14400000; // 4 hours
        break;
    }

    // Adjust based on agent performance
    const performanceFactor = agent.metrics.successRate * (100 / Math.max(1, agent.metrics.qualityScore));
    baseTime *= (2 - performanceFactor); // Better performance = shorter time

    // Adjust for current load
    const loadFactor = 1 + (agent.loadInfo.currentLoad / 100);
    baseTime *= loadFactor;

    return Math.round(baseTime);
  }

  /**
   * Calculates collaboration success rate between agents
   * 
   * @private
   */
  private calculateCollaborationSuccess(
    agentId: string,
    teamMembers: string[],
    collaborationHistory: Record<string, number>
  ): number {
    if (teamMembers.length === 0) return 1.0;

    let totalSuccessRate = 0;
    let pairCount = 0;

    for (const member of teamMembers) {
      const key1 = `${agentId}_${member}`;
      const key2 = `${member}_${agentId}`;
      
      const successRate = collaborationHistory[key1] || collaborationHistory[key2] || 0.8; // Default
      totalSuccessRate += successRate;
      pairCount++;
    }

    return pairCount > 0 ? totalSuccessRate / pairCount : 1.0;
  }

  /**
   * Updates internal statistics for better scoring normalization
   * 
   * @param agents - Current agent pool for statistics
   */
  updateStatistics(agents: RuntimeAgentProfile[]): void {
    if (agents.length === 0) return;

    const totalResponseTime = agents.reduce((sum, agent) => sum + agent.loadInfo.avgResponseTime, 0);
    const totalSuccessRate = agents.reduce((sum, agent) => sum + agent.metrics.successRate, 0);
    const totalQualityScore = agents.reduce((sum, agent) => sum + agent.metrics.qualityScore, 0);
    const totalLoad = agents.reduce((sum, agent) => sum + agent.loadInfo.currentLoad, 0);

    this.statistics.avgResponseTime = totalResponseTime / agents.length;
    this.statistics.avgSuccessRate = totalSuccessRate / agents.length;
    this.statistics.avgQualityScore = totalQualityScore / agents.length;
    this.statistics.avgLoad = totalLoad / agents.length / 100; // Convert to 0-1 range
    this.statistics.lastUpdated = Date.now();

    this.logger.debug('Updated capability matcher statistics', this.statistics);
  }

  /**
   * Clears internal caches (useful for testing or memory management)
   */
  clearCaches(): void {
    this.similarityCache.clear();
    this.predictionCache.clear();
    this.logger.debug('Cleared capability matcher caches');
  }
}