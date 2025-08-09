/**
 * Historical Context Integration
 * 
 * Integrates the Historical Context System with the existing Open SWE
 * multi-agent infrastructure, GraphState, and workflow patterns.
 */

import { HistoricalContextSystem, createHistoricalContextSystem } from './historical-context-system.js';
import { MultiAgentSystem } from './multi-agent-system.js';
import { SharedContextStore } from './shared-context-store.js';
import { GraphState, AgentProfile, SharedContext } from './types.js';
import { 
  HistoricalContext, 
  ContextContent,
  ContextType,
  PrivacyLevel,
  ContextQuery 
} from './historical-context-types.js';

/**
 * Integration adapter for GraphState integration
 */
export class GraphStateHistoricalContextAdapter {
  private contextSystem: HistoricalContextSystem;
  private activeSessionId: string | null = null;

  constructor(contextSystem: HistoricalContextSystem) {
    this.contextSystem = contextSystem;
  }

  /**
   * Initialize session context from GraphState
   */
  async initializeSession(sessionId: string, graphState: GraphState): Promise<void> {
    this.activeSessionId = sessionId;

    // Store initial session context
    await this.storeContext({
      sessionId,
      agentId: 'system',
      type: 'interaction',
      content: {
        summary: 'Session initialized',
        description: 'New session started',
        data: {
          targetRepository: graphState.targetRepository,
          taskPlan: graphState.taskPlan ? {
            id: graphState.taskPlan.id,
            status: graphState.taskPlan.status
          } : null
        }
      },
      metadata: {
        repository: graphState.targetRepository ? {
          name: graphState.targetRepository.name,
          url: graphState.targetRepository.url,
          branch: graphState.branchName || 'main'
        } : undefined
      },
      tags: ['session_start', 'initialization'],
      version: {
        version: 1,
        createdAt: new Date(),
        createdBy: 'system'
      },
      privacyLevel: 'shared'
    });
  }

  /**
   * Store context for agent interaction
   */
  async storeAgentInteraction(
    agentId: string,
    action: string,
    result: any,
    graphState: GraphState,
    success: boolean = true
  ): Promise<string> {
    if (!this.activeSessionId) {
      throw new Error('No active session. Call initializeSession first.');
    }

    const contextType: ContextType = this.determineContextType(action, success);
    
    return this.storeContext({
      sessionId: this.activeSessionId,
      agentId,
      type: contextType,
      content: {
        summary: `Agent ${agentId} performed ${action}`,
        description: `Action: ${action}`,
        data: {
          action,
          result,
          graphStateSnapshot: this.createGraphStateSnapshot(graphState)
        },
        outcome: {
          success,
          result: typeof result === 'string' ? result : JSON.stringify(result),
          metrics: {
            timestamp: Date.now()
          }
        }
      },
      metadata: {
        repository: graphState.targetRepository ? {
          name: graphState.targetRepository.name,
          url: graphState.targetRepository.url,
          branch: graphState.branchName || 'main'
        } : undefined,
        task: graphState.taskPlan ? {
          id: graphState.taskPlan.id,
          type: 'task_execution',
          complexity: this.calculateTaskComplexity(graphState.taskPlan),
          priority: 'normal'
        } : undefined
      },
      tags: this.generateTags(action, agentId, success),
      version: {
        version: 1,
        createdAt: new Date(),
        createdBy: agentId
      },
      privacyLevel: 'shared'
    });
  }

  /**
   * Store code review context
   */
  async storeCodeReviewContext(
    reviewerAgentId: string,
    changedFiles: string[],
    reviewComments: string[],
    graphState: GraphState,
    quality: number = 0.8
  ): Promise<string> {
    if (!this.activeSessionId) {
      throw new Error('No active session. Call initializeSession first.');
    }

    return this.storeContext({
      sessionId: this.activeSessionId,
      agentId: reviewerAgentId,
      type: 'code_review',
      content: {
        summary: `Code review completed for ${changedFiles.length} files`,
        description: `Review by ${reviewerAgentId}`,
        data: {
          changedFiles,
          reviewComments,
          qualityScore: quality
        },
        files: changedFiles,
        outcome: {
          success: quality > 0.7,
          result: `Review completed with quality score: ${quality}`,
          metrics: {
            filesReviewed: changedFiles.length,
            commentsGenerated: reviewComments.length,
            qualityScore: quality
          }
        }
      },
      metadata: {
        repository: graphState.targetRepository ? {
          name: graphState.targetRepository.name,
          url: graphState.targetRepository.url,
          branch: graphState.branchName || 'main'
        } : undefined,
        performance: {
          duration: 0, // Would be calculated from actual review time
          resourceUsage: changedFiles.length,
          quality
        }
      },
      tags: ['code_review', 'quality_assurance', ...changedFiles.map(f => `file:${f}`)],
      version: {
        version: 1,
        createdAt: new Date(),
        createdBy: reviewerAgentId
      },
      privacyLevel: 'shared'
    });
  }

  /**
   * Get relevant historical context for current task
   */
  async getRelevantContext(
    currentTask: string,
    agentId: string,
    graphState: GraphState,
    maxResults: number = 10
  ): Promise<HistoricalContext[]> {
    const query: ContextQuery = {
      query: currentTask,
      agentId, // Get contexts from same agent
      repository: graphState.targetRepository?.name,
      types: ['interaction', 'decision', 'success', 'pattern', 'insight', 'code_review'],
      minRelevance: 0.3,
      limit: maxResults,
      privacyLevels: ['public', 'shared'],
      includeRelated: true
    };

    const result = await this.contextSystem.searchContexts(query);
    return result.contexts;
  }

  /**
   * Carry over contexts from previous session
   */
  async carryOverFromPreviousSession(
    previousSessionId: string,
    newSessionId: string
  ): Promise<HistoricalContext[]> {
    this.activeSessionId = newSessionId;
    return this.contextSystem.carryoverContexts(previousSessionId, newSessionId);
  }

  private async storeContext(
    contextData: Omit<HistoricalContext, 'id' | 'timestamp' | 'relevanceScore'>
  ): Promise<string> {
    return this.contextSystem.storeContext(contextData);
  }

  private determineContextType(action: string, success: boolean): ContextType {
    if (!success) return 'error';
    
    if (action.includes('review') || action.includes('Review')) return 'code_review';
    if (action.includes('fix') || action.includes('Fix')) return 'bug_fix';
    if (action.includes('optimize') || action.includes('Optimize')) return 'optimization';
    if (action.includes('plan') || action.includes('Plan')) return 'decision';
    if (action.includes('architect') || action.includes('design')) return 'architectural_decision';
    
    return success ? 'success' : 'interaction';
  }

  private createGraphStateSnapshot(graphState: GraphState): any {
    // Create a lightweight snapshot of relevant GraphState data
    return {
      taskPlanId: graphState.taskPlan?.id,
      taskPlanStatus: graphState.taskPlan?.status,
      branchName: graphState.branchName,
      repositoryName: graphState.targetRepository?.name,
      activeAgentCount: graphState.activeAgents?.size || 0,
      reviewsCount: graphState.reviewsCount || 0
    };
  }

  private calculateTaskComplexity(taskPlan: any): number {
    // Simple complexity calculation based on task plan
    if (!taskPlan) return 1;
    
    const baseComplexity = 1;
    const taskCount = taskPlan.tasks?.length || 1;
    const revisionCount = taskPlan.revisions?.length || 0;
    
    return Math.min(10, baseComplexity + taskCount * 0.5 + revisionCount * 0.2);
  }

  private generateTags(action: string, agentId: string, success: boolean): string[] {
    const tags = [`agent:${agentId}`, `action:${action}`];
    
    if (success) tags.push('success');
    else tags.push('error');
    
    // Add action-specific tags
    if (action.includes('code')) tags.push('code_related');
    if (action.includes('test')) tags.push('testing');
    if (action.includes('review')) tags.push('review');
    if (action.includes('fix')) tags.push('bug_fix');
    if (action.includes('optimize')) tags.push('optimization');
    
    return tags;
  }
}

/**
 * Multi-agent system integration
 */
export class MultiAgentHistoricalContextIntegration {
  private contextSystem: HistoricalContextSystem;
  private multiAgentSystem: MultiAgentSystem;
  private adapters = new Map<string, GraphStateHistoricalContextAdapter>();

  constructor(
    contextSystem: HistoricalContextSystem,
    multiAgentSystem: MultiAgentSystem
  ) {
    this.contextSystem = contextSystem;
    this.multiAgentSystem = multiAgentSystem;
    this.setupEventListeners();
  }

  /**
   * Register session adapter
   */
  registerSessionAdapter(sessionId: string): GraphStateHistoricalContextAdapter {
    const adapter = new GraphStateHistoricalContextAdapter(this.contextSystem);
    this.adapters.set(sessionId, adapter);
    return adapter;
  }

  /**
   * Get adapter for session
   */
  getSessionAdapter(sessionId: string): GraphStateHistoricalContextAdapter | null {
    return this.adapters.get(sessionId) || null;
  }

  /**
   * Get historical insights for agent
   */
  async getAgentInsights(agentId: string): Promise<{
    recentSuccesses: HistoricalContext[];
    commonErrors: HistoricalContext[];
    bestPractices: HistoricalContext[];
    expertise: string[];
  }> {
    const [successes, errors, practices] = await Promise.all([
      this.contextSystem.searchContexts({
        agentId,
        types: ['success'],
        limit: 5,
        minRelevance: 0.4
      }),
      this.contextSystem.searchContexts({
        agentId,
        types: ['error'],
        limit: 5,
        minRelevance: 0.3
      }),
      this.contextSystem.searchContexts({
        agentId,
        types: ['pattern', 'insight'],
        limit: 5,
        minRelevance: 0.5
      })
    ]);

    // Extract expertise areas from tags
    const allContexts = [...successes.contexts, ...practices.contexts];
    const tagCounts = new Map<string, number>();
    
    for (const context of allContexts) {
      for (const tag of context.tags) {
        if (!tag.startsWith('agent:') && !tag.startsWith('action:')) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    const expertise = Array.from(tagCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      recentSuccesses: successes.contexts,
      commonErrors: errors.contexts,
      bestPractices: practices.contexts,
      expertise
    };
  }

  /**
   * Share insights across agents
   */
  async shareInsightAcrossAgents(
    sourceAgentId: string,
    insight: string,
    relatedTags: string[],
    sessionId: string
  ): Promise<void> {
    const adapter = this.adapters.get(sessionId);
    if (!adapter) {
      throw new Error(`No adapter found for session ${sessionId}`);
    }

    await adapter.storeContext({
      sessionId,
      agentId: sourceAgentId,
      type: 'insight',
      content: {
        summary: `Insight shared by ${sourceAgentId}`,
        description: insight,
        data: {
          sharedAt: new Date(),
          sourceAgent: sourceAgentId
        },
        outcome: {
          success: true,
          result: 'Insight shared successfully'
        }
      },
      metadata: {},
      tags: ['shared_insight', `source:${sourceAgentId}`, ...relatedTags],
      version: {
        version: 1,
        createdAt: new Date(),
        createdBy: sourceAgentId
      },
      privacyLevel: 'shared'
    });
  }

  private setupEventListeners(): void {
    // Listen to context system events
    this.contextSystem.on('contextStored', (context: HistoricalContext) => {
      this.onContextStored(context);
    });

    this.contextSystem.on('feedbackAdded', (feedback: any) => {
      this.onFeedbackAdded(feedback);
    });

    // Listen to multi-agent system events
    this.multiAgentSystem.on('taskCompleted', (event: any) => {
      this.onTaskCompleted(event);
    });

    this.multiAgentSystem.on('agentCollaboration', (event: any) => {
      this.onAgentCollaboration(event);
    });
  }

  private async onContextStored(context: HistoricalContext): Promise<void> {
    // Notify relevant agents about new context
    if (context.type === 'insight' || context.type === 'pattern') {
      // Share insights with similar agents
      const insights = await this.getAgentInsights(context.agentId);
      // Could implement recommendation system here
    }
  }

  private async onFeedbackAdded(feedback: any): Promise<void> {
    // Update agent learning based on feedback
    // Could implement learning algorithms here
  }

  private async onTaskCompleted(event: any): Promise<void> {
    // Store task completion context
    const adapter = this.adapters.get(event.sessionId);
    if (adapter) {
      await adapter.storeAgentInteraction(
        event.agentId,
        'task_completion',
        event.result,
        event.graphState,
        event.success
      );
    }
  }

  private async onAgentCollaboration(event: any): Promise<void> {
    // Store collaboration context
    const adapter = this.adapters.get(event.sessionId);
    if (adapter) {
      await adapter.storeContext({
        sessionId: event.sessionId,
        agentId: 'collaboration_system',
        type: 'interaction',
        content: {
          summary: `Collaboration between agents: ${event.agents.join(', ')}`,
          description: event.description || 'Agent collaboration event',
          data: event,
          outcome: {
            success: true,
            result: 'Collaboration recorded'
          }
        },
        metadata: {},
        tags: ['collaboration', ...event.agents.map((a: string) => `agent:${a}`)],
        version: {
          version: 1,
          createdAt: new Date(),
          createdBy: 'collaboration_system'
        },
        privacyLevel: 'shared'
      });
    }
  }
}

/**
 * Utility functions for historical context integration
 */
export class HistoricalContextUtils {
  /**
   * Create historical context system with Open SWE defaults
   */
  static createForOpenSWE(): HistoricalContextSystem {
    return createHistoricalContextSystem({
      relevanceConfig: {
        temporalDecay: 0.2, // Slower decay for development contexts
        semanticWeight: 0.5, // Higher semantic importance
        outcomeWeight: 0.2,
        feedbackWeight: 0.1,
        typeWeights: {
          code_review: 1.0,
          architectural_decision: 0.9,
          bug_fix: 0.8,
          success: 0.8,
          optimization: 0.7,
          decision: 0.9,
          pattern: 0.8,
          insight: 0.9,
          interaction: 0.6,
          error: 0.5,
          feedback: 0.4,
          task_completion: 0.7
        }
      },
      carryoverConfig: {
        maxContexts: 15, // Reasonable for development sessions
        minRelevance: 0.4,
        includedTypes: ['code_review', 'architectural_decision', 'success', 'pattern', 'insight'],
        maxAge: 48, // 2 days
        allowedPrivacyLevels: ['public', 'shared']
      }
    });
  }

  /**
   * Create integration for multi-agent system
   */
  static createIntegration(
    contextSystem: HistoricalContextSystem,
    multiAgentSystem: MultiAgentSystem
  ): MultiAgentHistoricalContextIntegration {
    return new MultiAgentHistoricalContextIntegration(contextSystem, multiAgentSystem);
  }

  /**
   * Extract context from GraphState update
   */
  static extractContextFromGraphState(
    previousState: GraphState,
    newState: GraphState,
    agentId: string
  ): Partial<ContextContent> {
    const changes: string[] = [];
    
    if (previousState.taskPlan?.status !== newState.taskPlan?.status) {
      changes.push(`Task status changed: ${previousState.taskPlan?.status} → ${newState.taskPlan?.status}`);
    }
    
    if (previousState.branchName !== newState.branchName) {
      changes.push(`Branch changed: ${previousState.branchName} → ${newState.branchName}`);
    }
    
    if ((previousState.reviewsCount || 0) !== (newState.reviewsCount || 0)) {
      changes.push(`Reviews count changed: ${previousState.reviewsCount || 0} → ${newState.reviewsCount || 0}`);
    }

    return {
      summary: `GraphState updated by ${agentId}`,
      description: changes.join('; '),
      data: {
        previousState: {
          taskPlanStatus: previousState.taskPlan?.status,
          branchName: previousState.branchName,
          reviewsCount: previousState.reviewsCount
        },
        newState: {
          taskPlanStatus: newState.taskPlan?.status,
          branchName: newState.branchName,
          reviewsCount: newState.reviewsCount
        },
        changes
      }
    };
  }
}

// Export factory function for easy integration
export function createHistoricalContextIntegration(
  multiAgentSystem: MultiAgentSystem
): {
  contextSystem: HistoricalContextSystem;
  integration: MultiAgentHistoricalContextIntegration;
} {
  const contextSystem = HistoricalContextUtils.createForOpenSWE();
  const integration = HistoricalContextUtils.createIntegration(contextSystem, multiAgentSystem);
  
  return { contextSystem, integration };
}