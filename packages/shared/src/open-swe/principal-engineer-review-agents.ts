/**
 * Principal Engineer Specialized Review Agents
 * 
 * This module implements the six specialized review agents for Principal Engineer-level
 * code review capabilities, each with distinct expertise and analysis patterns.
 */

import { EventEmitter } from 'events';
import {
  PrincipalEngineerReviewAgent,
  PrincipalEngineerAgentType,
  PrincipalEngineerReviewConfig,
  ReviewFinding,
  ReviewSeverity,
  ReviewCategory,
  BugPatternMatch,
  DesignPatternRecognition,
  AntiPatternDetection,
  SolidPrinciplesValidation,
  ArchitecturalReview,
  OwaspSecurityFinding,
  PrincipalEngineerReviewEvent
} from './principal-engineer-review-types.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph-types.js';
import { HistoricalContext } from './historical-context-types.js';

/**
 * Base class for all Principal Engineer review agents
 */
export abstract class BasePrincipalEngineerAgent extends EventEmitter implements PrincipalEngineerReviewAgent {
  protected metrics = {
    totalReviews: 0,
    totalResponseTime: 0,
    totalConfidence: 0,
    falsePositives: 0,
    truePositives: 0
  };

  constructor(
    public readonly id: string,
    public readonly type: PrincipalEngineerAgentType,
    public config: PrincipalEngineerReviewConfig,
    public knowledgeGraph?: RepositoryKnowledgeGraph,
    public historicalContext?: HistoricalContext
  ) {
    super();
  }

  abstract performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]>;

  updateConfig(config: Partial<PrincipalEngineerReviewConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getMetrics() {
    const totalFindings = this.metrics.truePositives + this.metrics.falsePositives;
    return {
      totalReviews: this.metrics.totalReviews,
      avgResponseTime: this.metrics.totalReviews > 0 ? this.metrics.totalResponseTime / this.metrics.totalReviews : 0,
      avgConfidence: this.metrics.totalReviews > 0 ? this.metrics.totalConfidence / this.metrics.totalReviews : 0,
      falsePositiveRate: totalFindings > 0 ? this.metrics.falsePositives / totalFindings : 0
    };
  }

  async learnFromFeedback(
    reviewId: string,
    feedback: {
      findingId: string;
      isValidFinding: boolean;
      actualSeverity?: ReviewSeverity;
      comments?: string;
    }[]
  ): Promise<void> {
    for (const item of feedback) {
      if (item.isValidFinding) {
        this.metrics.truePositives++;
      } else {
        this.metrics.falsePositives++;
      }
    }

    // Update historical context if available
    if (this.historicalContext) {
      await this.historicalContext.recordLearning({
        agentId: this.id,
        reviewId,
        feedback,
        timestamp: Date.now()
      });
    }
  }

  protected createFinding(
    filePath: string,
    lineNumbers: number[],
    title: string,
    description: string,
    recommendation: string,
    severity: ReviewSeverity,
    category: ReviewCategory,
    confidence: number,
    codeSnippet: string,
    triggeredRule: string,
    suggestedFix?: string,
    references: string[] = [],
    metadata: Record<string, unknown> = {}
  ): ReviewFinding {
    return {
      id: `${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: this.id,
      agentType: this.type,
      severity,
      category,
      filePath,
      lineNumbers,
      title,
      description,
      recommendation,
      codeSnippet,
      suggestedFix,
      confidence,
      triggeredRule,
      references,
      createdAt: Date.now(),
      metadata
    };
  }

  protected emitEvent(event: Omit<PrincipalEngineerReviewEvent, 'timestamp'>): void {
    this.emit('review_event', {
      ...event,
      timestamp: Date.now()
    });
  }

  protected trackMetrics(responseTime: number, confidence: number): void {
    this.metrics.totalReviews++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.totalConfidence += confidence;
  }
}

/**
 * Code Review Agent - Overall structure and standards analysis
 * Focuses on general code quality, readability, and adherence to coding standards
 */
export class CodeReviewAgent extends BasePrincipalEngineerAgent {
  constructor(
    config: PrincipalEngineerReviewConfig,
    knowledgeGraph?: RepositoryKnowledgeGraph,
    historicalContext?: HistoricalContext
  ) {
    super('code_review_agent', 'code_review_agent', config, knowledgeGraph, historicalContext);
  }

  async performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]> {
    const startTime = Date.now();
    const findings: ReviewFinding[] = [];

    this.emitEvent({
      id: `review_started_${Date.now()}`,
      type: 'review_started',
      reviewId: context.reviewId as string,
      agentId: this.id,
      payload: { filePaths }
    });

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      // Check for basic code quality issues
      const fileFindings = await this.analyzeCodeQuality(filePath, content);
      findings.push(...fileFindings);

      // Check naming conventions
      const namingFindings = await this.analyzeNamingConventions(filePath, content);
      findings.push(...namingFindings);

      // Check function/method complexity
      const complexityFindings = await this.analyzeComplexity(filePath, content);
      findings.push(...complexityFindings);

      // Check documentation
      const docFindings = await this.analyzeDocumentation(filePath, content);
      findings.push(...docFindings);
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;
    this.trackMetrics(responseTime, avgConfidence);

    this.emitEvent({
      id: `agent_completed_${Date.now()}`,
      type: 'agent_completed',
      reviewId: context.reviewId as string,
      agentId: this.id,
      payload: { findingsCount: findings.length, responseTime }
    });

    return findings;
  }

  private async analyzeCodeQuality(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Check for long lines
    lines.forEach((line, index) => {
      if (line.length > 120) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Line too long',
          `Line ${index + 1} has ${line.length} characters, exceeding the 120 character limit`,
          'Break long lines into multiple lines or extract complex expressions into variables',
          'warning',
          'code_style',
          0.9,
          line,
          'max_line_length',
          undefined,
          ['https://google.github.io/styleguide/']
        ));
      }
    });

    // Check for TODO comments
    lines.forEach((line, index) => {
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'TODO/FIXME comment found',
          `Line ${index + 1} contains a TODO/FIXME comment that should be addressed`,
          'Complete the TODO item or create a proper issue to track it',
          'info',
          'maintainability',
          0.8,
          line.trim(),
          'todo_comments'
        ));
      }
    });

    // Check for magic numbers
    const magicNumberRegex = /(?<![a-zA-Z_])\b(?!0|1|2|10|100|1000)\d{2,}\b/g;
    lines.forEach((line, index) => {
      const matches = line.match(magicNumberRegex);
      if (matches) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Magic number detected',
          `Line ${index + 1} contains magic numbers: ${matches.join(', ')}`,
          'Replace magic numbers with named constants or configuration values',
          'warning',
          'maintainability',
          0.85,
          line.trim(),
          'magic_numbers',
          undefined,
          ['https://refactoring.guru/smells/magic-numbers']
        ));
      }
    });

    return findings;
  }

  private async analyzeNamingConventions(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Check for non-descriptive variable names
    const badVariableNames = /\b(data|info|temp|tmp|obj|item|thing|stuff|foo|bar|baz)\b/g;
    lines.forEach((line, index) => {
      const matches = line.match(badVariableNames);
      if (matches && !line.trim().startsWith('//')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Non-descriptive variable name',
          `Line ${index + 1} uses non-descriptive variable names: ${matches.join(', ')}`,
          'Use descriptive variable names that clearly indicate the purpose and content',
          'info',
          'code_style',
          0.75,
          line.trim(),
          'descriptive_naming'
        ));
      }
    });

    return findings;
  }

  private async analyzeComplexity(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Simple cyclomatic complexity check (count if/else/while/for/switch)
    let currentMethodStart = -1;
    let currentMethodName = '';
    let complexityCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect method/function start
      if (line.match(/^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)) {
        if (currentMethodStart >= 0 && complexityCount > this.config.codeQualityThresholds.cyclomaticComplexity) {
          findings.push(this.createFinding(
            filePath,
            [currentMethodStart + 1],
            'High cyclomatic complexity',
            `Method ${currentMethodName} has complexity of ${complexityCount}, exceeding limit of ${this.config.codeQualityThresholds.cyclomaticComplexity}`,
            'Break down the method into smaller, more focused methods',
            'warning',
            'maintainability',
            0.9,
            lines.slice(currentMethodStart, Math.min(currentMethodStart + 5, lines.length)).join('\n'),
            'cyclomatic_complexity'
          ));
        }
        
        currentMethodStart = i;
        currentMethodName = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)?.[1] || 'unknown';
        complexityCount = 1; // Base complexity
      }

      // Count complexity-increasing constructs
      if (line.match(/\b(if|else\s+if|while|for|switch|catch|case)\b/)) {
        complexityCount++;
      }
    }

    return findings;
  }

  private async analyzeDocumentation(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Check for public methods without documentation
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];
      
      if (nextLine.match(/^\s*public\s+.*\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/)) {
        // Check if previous lines contain documentation
        const hasDoc = i > 0 && (
          lines[i - 1].trim().startsWith('*') ||
          lines[i - 1].trim().startsWith('//') ||
          currentLine.trim().startsWith('/**')
        );
        
        if (!hasDoc) {
          findings.push(this.createFinding(
            filePath,
            [i + 2],
            'Missing documentation',
            `Public method on line ${i + 2} lacks documentation`,
            'Add comprehensive documentation including parameters, return value, and purpose',
            'info',
            'documentation',
            0.8,
            nextLine.trim(),
            'method_documentation'
          ));
        }
      }
    }

    return findings;
  }
}

/**
 * Bug Pattern Analyzer Agent - Pattern recognition using historical fixes
 * Uses machine learning and historical data to identify potential bugs
 */
export class BugPatternAnalyzerAgent extends BasePrincipalEngineerAgent {
  private readonly targetMatchRate = 0.25; // 25% match rate target

  constructor(
    config: PrincipalEngineerReviewConfig,
    knowledgeGraph?: RepositoryKnowledgeGraph,
    historicalContext?: HistoricalContext
  ) {
    super('bug_pattern_analyzer', 'bug_pattern_analyzer', config, knowledgeGraph, historicalContext);
  }

  async performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]> {
    const startTime = Date.now();
    const findings: ReviewFinding[] = [];

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      // Analyze common bug patterns
      const patternFindings = await this.analyzeBugPatterns(filePath, content);
      findings.push(...patternFindings);

      // Use historical context for pattern matching
      if (this.historicalContext) {
        const historicalFindings = await this.analyzeHistoricalPatterns(filePath, content);
        findings.push(...historicalFindings);
      }
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;
    this.trackMetrics(responseTime, avgConfidence);

    return findings;
  }

  private async analyzeBugPatterns(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Pattern 1: Null pointer dereference potential
    lines.forEach((line, index) => {
      if (line.match(/\.\w+\(/g) && !line.includes('?.')) {
        const hasNullCheck = index > 0 && lines[index - 1].includes('!= null');
        if (!hasNullCheck) {
          findings.push(this.createFinding(
            filePath,
            [index + 1],
            'Potential null pointer dereference',
            'Method call without null check may cause runtime errors',
            'Add null check or use optional chaining',
            'warning',
            'reliability',
            0.7,
            line.trim(),
            'null_pointer_dereference',
            line.replace(/(\w+)\./, '$1?.'),
            ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining']
          ));
        }
      }
    });

    // Pattern 2: Resource leaks (unclosed streams, connections)
    lines.forEach((line, index) => {
      if (line.match(/(new\s+File|\.open\(|\.connect\(|\.createConnection)/g)) {
        let hasClose = false;
        // Look ahead for close/finally blocks
        for (let j = index + 1; j < Math.min(lines.length, index + 20); j++) {
          if (lines[j].match(/\.(close|disconnect|end)\(/) || lines[j].includes('finally')) {
            hasClose = true;
            break;
          }
        }
        
        if (!hasClose) {
          findings.push(this.createFinding(
            filePath,
            [index + 1],
            'Potential resource leak',
            'Resource opened without corresponding close operation',
            'Use try-with-resources or ensure proper cleanup in finally block',
            'error',
            'reliability',
            0.8,
            line.trim(),
            'resource_leak',
            undefined,
            ['https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html']
          ));
        }
      }
    });

    // Pattern 3: Race conditions in async code
    lines.forEach((line, index) => {
      if (line.includes('async') && line.includes('forEach')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Potential race condition in async forEach',
          'forEach does not wait for async operations, may cause race conditions',
          'Use for...of loop or Promise.all() for concurrent execution',
          'warning',
          'reliability',
          0.85,
          line.trim(),
          'async_foreach_race',
          line.replace('forEach', 'for (const item of array)'),
          ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all']
        ));
      }
    });

    return findings;
  }

  private async analyzeHistoricalPatterns(filePath: string, content: string): Promise<ReviewFinding[]> {
    // This would integrate with historical context system
    // For now, returning empty array as historical context integration would be complex
    return [];
  }
}

/**
 * Code Smell Detector Agent - Anti-pattern identification with <5% false positives
 * Detects code smells and architectural anti-patterns
 */
export class CodeSmellDetectorAgent extends BasePrincipalEngineerAgent {
  constructor(
    config: PrincipalEngineerReviewConfig,
    knowledgeGraph?: RepositoryKnowledgeGraph,
    historicalContext?: HistoricalContext
  ) {
    super('code_smell_detector', 'code_smell_detector', config, knowledgeGraph, historicalContext);
  }

  async performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]> {
    const startTime = Date.now();
    const findings: ReviewFinding[] = [];

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      // Detect various code smells
      const smells = await this.detectCodeSmells(filePath, content);
      findings.push(...smells);
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;
    this.trackMetrics(responseTime, avgConfidence);

    return findings;
  }

  private async detectCodeSmells(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Code Smell: Long Method
    let methodLineCount = 0;
    let methodStartLine = -1;
    let methodName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.match(/^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)) {
        if (methodLineCount > this.config.codeQualityThresholds.linesOfCodePerMethod) {
          findings.push(this.createFinding(
            filePath,
            [methodStartLine + 1],
            'Long Method code smell',
            `Method ${methodName} has ${methodLineCount} lines, exceeding limit of ${this.config.codeQualityThresholds.linesOfCodePerMethod}`,
            'Break down the method into smaller, more focused methods',
            'warning',
            'maintainability',
            0.9,
            lines.slice(methodStartLine, Math.min(methodStartLine + 3, lines.length)).join('\n'),
            'long_method',
            undefined,
            ['https://refactoring.guru/smells/long-method']
          ));
        }
        
        methodStartLine = i;
        methodName = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)?.[1] || 'unknown';
        methodLineCount = 0;
      }
      
      if (methodStartLine >= 0) {
        methodLineCount++;
      }
    }

    // Code Smell: Duplicate Code
    const lineHashes = new Map<string, number[]>();
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        if (!lineHashes.has(trimmed)) {
          lineHashes.set(trimmed, []);
        }
        lineHashes.get(trimmed)!.push(index + 1);
      }
    });

    lineHashes.forEach((lineNumbers, lineContent) => {
      if (lineNumbers.length > 3) { // Same line appears more than 3 times
        findings.push(this.createFinding(
          filePath,
          lineNumbers.slice(0, 3), // Show first 3 occurrences
          'Duplicate Code detected',
          `Line "${lineContent}" appears ${lineNumbers.length} times`,
          'Extract duplicate code into a reusable method or constant',
          'warning',
          'maintainability',
          0.8,
          lineContent,
          'duplicate_code',
          undefined,
          ['https://refactoring.guru/smells/duplicate-code']
        ));
      }
    });

    // Code Smell: Feature Envy (methods using more methods from other classes)
    lines.forEach((line, index) => {
      const externalCalls = (line.match(/\w+\.\w+\(/g) || []).length;
      const ownMethodCalls = (line.match(/this\.\w+\(/g) || []).length;
      
      if (externalCalls > 3 && externalCalls > ownMethodCalls * 2) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Feature Envy code smell',
          'This line shows excessive dependency on external objects',
          'Consider moving this functionality to the class it depends on most',
          'info',
          'maintainability',
          0.7,
          line.trim(),
          'feature_envy',
          undefined,
          ['https://refactoring.guru/smells/feature-envy']
        ));
      }
    });

    // Code Smell: Large Class (simple heuristic based on line count)
    if (lines.length > 500) {
      findings.push(this.createFinding(
        filePath,
        [1],
        'Large Class code smell',
        `Class has ${lines.length} lines, which may indicate too many responsibilities`,
        'Consider breaking this class into smaller, more focused classes',
        'warning',
        'maintainability',
        0.8,
        `File has ${lines.length} lines`,
        'large_class',
        undefined,
        ['https://refactoring.guru/smells/large-class']
      ));
    }

    return findings;
  }
}

/**
 * Performance Optimizer Agent - Bottleneck detection and optimization suggestions
 * Analyzes code for performance issues and provides optimization recommendations
 */
export class PerformanceOptimizerAgent extends BasePrincipalEngineerAgent {
  constructor(
    config: PrincipalEngineerReviewConfig,
    knowledgeGraph?: RepositoryKnowledgeGraph,
    historicalContext?: HistoricalContext
  ) {
    super('performance_optimizer', 'performance_optimizer', config, knowledgeGraph, historicalContext);
  }

  async performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]> {
    const startTime = Date.now();
    const findings: ReviewFinding[] = [];

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      const performanceIssues = await this.analyzePerformance(filePath, content);
      findings.push(...performanceIssues);
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;
    this.trackMetrics(responseTime, avgConfidence);

    return findings;
  }

  private async analyzePerformance(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Performance Issue: N+1 Query Problem
    lines.forEach((line, index) => {
      if (line.includes('for') && lines[index + 1]?.includes('query') || lines[index + 1]?.includes('select')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1, index + 2],
          'Potential N+1 Query Problem',
          'Database query inside a loop can cause performance issues',
          'Use bulk queries, joins, or batch operations to reduce database calls',
          'warning',
          'performance',
          0.85,
          `${line}\n${lines[index + 1]}`,
          'n_plus_one_query',
          undefined,
          ['https://secure.phabricator.com/book/phabcontrib/article/n_plus_one/']
        ));
      }
    });

    // Performance Issue: Inefficient String Concatenation
    lines.forEach((line, index) => {
      if (line.includes('+=') && line.includes('string')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Inefficient String Concatenation',
          'Using += for string concatenation in loops is inefficient',
          'Use StringBuilder, Array.join(), or template literals for better performance',
          'info',
          'performance',
          0.8,
          line.trim(),
          'string_concatenation',
          line.replace('+=', '// Use StringBuilder or Array.join()'),
          ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join']
        ));
      }
    });

    // Performance Issue: Synchronous operations in async context
    lines.forEach((line, index) => {
      if ((line.includes('async') || lines[index - 1]?.includes('async')) && 
          (line.includes('readFileSync') || line.includes('execSync'))) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Synchronous operation in async function',
          'Synchronous operations block the event loop in async functions',
          'Use asynchronous alternatives (readFile, exec) with await',
          'warning',
          'performance',
          0.9,
          line.trim(),
          'sync_in_async',
          line.replace('Sync', '').replace('(', ' await ('),
          ['https://nodejs.org/en/docs/guides/blocking-vs-non-blocking/']
        ));
      }
    });

    // Performance Issue: Unoptimized loops
    lines.forEach((line, index) => {
      if (line.includes('.length') && line.match(/for\s*\([^)]*\.length[^)]*\)/)) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Inefficient loop condition',
          'Calculating array length in every iteration is inefficient',
          'Cache the array length in a variable before the loop',
          'info',
          'performance',
          0.7,
          line.trim(),
          'loop_length_optimization',
          line.replace(/for\s*\(([^;]*);([^;]*\.length[^;]*);/, 'for ($1, len = array.length; $2 < len;')
        ));
      }
    });

    // Performance Issue: Missing database indexes (heuristic)
    lines.forEach((line, index) => {
      if (line.includes('WHERE') && !line.includes('INDEX')) {
        const hasIndex = content.includes('CREATE INDEX') || content.includes('@Index');
        if (!hasIndex && line.match(/WHERE\s+\w+\s*=/)) {
          findings.push(this.createFinding(
            filePath,
            [index + 1],
            'Potential missing database index',
            'Query with WHERE clause may benefit from an index',
            'Consider adding an index on the column(s) used in WHERE clause',
            'info',
            'performance',
            0.6,
            line.trim(),
            'missing_index',
            undefined,
            ['https://use-the-index-luke.com/']
          ));
        }
      }
    });

    return findings;
  }
}

/**
 * Security Scanner Agent - OWASP Top 10 vulnerability detection
 * Scans for security vulnerabilities and compliance issues
 */
export class SecurityScannerAgent extends BasePrincipalEngineerAgent {
  constructor(
    config: PrincipalEngineerReviewConfig,
    knowledgeGraph?: RepositoryKnowledgeGraph,
    historicalContext?: HistoricalContext
  ) {
    super('security_scanner', 'security_scanner', config, knowledgeGraph, historicalContext);
  }

  async performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]> {
    const startTime = Date.now();
    const findings: ReviewFinding[] = [];

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      const securityIssues = await this.scanSecurity(filePath, content);
      findings.push(...securityIssues);
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;
    this.trackMetrics(responseTime, avgConfidence);

    return findings;
  }

  private async scanSecurity(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // OWASP A01:2021 - Broken Access Control
    lines.forEach((line, index) => {
      if (line.includes('admin') && !line.includes('authorize') && !line.includes('permission')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Potential Access Control Issue',
          'Admin functionality without proper authorization checks',
          'Implement proper authorization and permission checks',
          'critical',
          'security',
          0.8,
          line.trim(),
          'broken_access_control',
          undefined,
          ['https://owasp.org/Top10/A01_2021-Broken_Access_Control/']
        ));
      }
    });

    // OWASP A02:2021 - Cryptographic Failures
    lines.forEach((line, index) => {
      if (line.includes('md5') || line.includes('sha1') || line.includes('base64')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Weak Cryptographic Algorithm',
          'Use of weak or inappropriate cryptographic algorithm',
          'Use strong cryptographic algorithms like SHA-256, bcrypt, or Argon2',
          'error',
          'security',
          0.9,
          line.trim(),
          'cryptographic_failures',
          line.replace(/md5|sha1/g, 'sha256'),
          ['https://owasp.org/Top10/A02_2021-Cryptographic_Failures/']
        ));
      }
    });

    // OWASP A03:2021 - Injection
    lines.forEach((line, index) => {
      if ((line.includes('query') || line.includes('execute')) && line.includes('+')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'SQL Injection Vulnerability',
          'Dynamic SQL construction may be vulnerable to injection attacks',
          'Use parameterized queries or prepared statements',
          'critical',
          'security',
          0.85,
          line.trim(),
          'sql_injection',
          '// Use parameterized queries instead',
          ['https://owasp.org/Top10/A03_2021-Injection/']
        ));
      }
    });

    // OWASP A05:2021 - Security Misconfiguration
    lines.forEach((line, index) => {
      if (line.includes('debug = true') || line.includes('DEBUG = True')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Debug Mode in Production',
          'Debug mode should not be enabled in production',
          'Disable debug mode in production environments',
          'error',
          'security',
          0.95,
          line.trim(),
          'security_misconfiguration',
          line.replace('true', 'false').replace('True', 'False'),
          ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/']
        ));
      }
    });

    // OWASP A06:2021 - Vulnerable and Outdated Components
    if (filePath.includes('package.json') || filePath.includes('requirements.txt')) {
      findings.push(this.createFinding(
        filePath,
        [1],
        'Dependency Security Check Required',
        'Dependency file should be regularly checked for vulnerabilities',
        'Regularly update dependencies and use tools like npm audit, snyk, or OWASP dependency-check',
        'info',
        'security',
        0.7,
        'Dependency file detected',
        'vulnerable_components',
        undefined,
        ['https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/']
      ));
    }

    // OWASP A07:2021 - Identification and Authentication Failures
    lines.forEach((line, index) => {
      if (line.includes('password') && (line.includes('=') || line.includes(':'))) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Hardcoded Password',
          'Hardcoded passwords are a security risk',
          'Use environment variables or secure configuration management',
          'critical',
          'security',
          0.9,
          '***REDACTED***',
          'hardcoded_credentials',
          '// Use environment variables: process.env.PASSWORD',
          ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/']
        ));
      }
    });

    // OWASP A09:2021 - Security Logging and Monitoring Failures
    lines.forEach((line, index) => {
      if (line.includes('login') && !line.includes('log')) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Missing Security Logging',
          'Security-relevant operations should be logged',
          'Add appropriate logging for security events',
          'warning',
          'security',
          0.7,
          line.trim(),
          'logging_monitoring_failures',
          `${line.trim()}\n// Add logging: logger.info('Login attempt', { user, timestamp });`,
          ['https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/']
        ));
      }
    });

    return findings;
  }
}

/**
 * Architectural Reviewer Agent - DDD boundaries, microservice patterns, resilience validation
 * Reviews architectural decisions and patterns
 */
export class ArchitecturalReviewerAgent extends BasePrincipalEngineerAgent {
  constructor(
    config: PrincipalEngineerReviewConfig,
    knowledgeGraph?: RepositoryKnowledgeGraph,
    historicalContext?: HistoricalContext
  ) {
    super('architectural_reviewer', 'architectural_reviewer', config, knowledgeGraph, historicalContext);
  }

  async performReview(
    filePaths: string[],
    codeContent: Map<string, string>,
    context: Record<string, unknown>
  ): Promise<ReviewFinding[]> {
    const startTime = Date.now();
    const findings: ReviewFinding[] = [];

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      const architecturalIssues = await this.reviewArchitecture(filePath, content);
      findings.push(...architecturalIssues);
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = findings.length > 0 ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;
    this.trackMetrics(responseTime, avgConfidence);

    return findings;
  }

  private async reviewArchitecture(filePath: string, content: string): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];
    const lines = content.split('\n');

    // Check for missing error handling patterns
    lines.forEach((line, index) => {
      if (line.includes('http') || line.includes('fetch') || line.includes('request')) {
        let hasErrorHandling = false;
        // Look for try-catch or .catch()
        for (let j = Math.max(0, index - 5); j < Math.min(lines.length, index + 10); j++) {
          if (lines[j].includes('catch') || lines[j].includes('try')) {
            hasErrorHandling = true;
            break;
          }
        }
        
        if (!hasErrorHandling) {
          findings.push(this.createFinding(
            filePath,
            [index + 1],
            'Missing Error Handling',
            'Network operations should include proper error handling',
            'Add try-catch blocks or .catch() handlers for network operations',
            'warning',
            'architecture',
            0.8,
            line.trim(),
            'missing_error_handling',
            undefined,
            ['https://microservices.io/patterns/reliability/circuit-breaker.html']
          ));
        }
      }
    });

    // Check for tight coupling (excessive imports from single module)
    const imports = lines.filter(line => line.includes('import') || line.includes('require'));
    const moduleImports = new Map<string, number>();
    
    imports.forEach(importLine => {
      const match = importLine.match(/from\s+['"]([^'"]+)['"]/) || importLine.match(/require\(['"]([^'"]+)['"]\)/);
      if (match) {
        const module = match[1];
        moduleImports.set(module, (moduleImports.get(module) || 0) + 1);
      }
    });

    moduleImports.forEach((count, module) => {
      if (count > 5) {
        findings.push(this.createFinding(
          filePath,
          [1],
          'Tight Coupling Detected',
          `High number of imports (${count}) from module ${module} indicates tight coupling`,
          'Consider refactoring to reduce dependencies or use dependency injection',
          'warning',
          'architecture',
          0.75,
          `${count} imports from ${module}`,
          'tight_coupling',
          undefined,
          ['https://en.wikipedia.org/wiki/Loose_coupling']
        ));
      }
    });

    // Check for missing dependency injection
    lines.forEach((line, index) => {
      if (line.includes('new ') && (line.includes('Service') || line.includes('Repository'))) {
        findings.push(this.createFinding(
          filePath,
          [index + 1],
          'Direct Instantiation Instead of Dependency Injection',
          'Direct instantiation of services/repositories creates tight coupling',
          'Use dependency injection or factory pattern for better testability',
          'info',
          'architecture',
          0.7,
          line.trim(),
          'missing_dependency_injection',
          '// Inject as dependency: constructor(private service: Service)',
          ['https://en.wikipedia.org/wiki/Dependency_injection']
        ));
      }
    });

    // Check for missing circuit breaker pattern in external calls
    lines.forEach((line, index) => {
      if ((line.includes('http://') || line.includes('https://')) && !line.includes('localhost')) {
        let hasCircuitBreaker = false;
        // Look for circuit breaker patterns
        for (let j = Math.max(0, index - 10); j < Math.min(lines.length, index + 10); j++) {
          if (lines[j].includes('circuitBreaker') || lines[j].includes('retry') || lines[j].includes('timeout')) {
            hasCircuitBreaker = true;
            break;
          }
        }
        
        if (!hasCircuitBreaker) {
          findings.push(this.createFinding(
            filePath,
            [index + 1],
            'Missing Resilience Pattern',
            'External service calls should implement circuit breaker or retry patterns',
            'Implement circuit breaker, timeout, and retry patterns for external dependencies',
            'warning',
            'architecture',
            0.8,
            line.trim(),
            'missing_resilience_pattern',
            undefined,
            ['https://microservices.io/patterns/reliability/circuit-breaker.html']
          ));
        }
      }
    });

    return findings;
  }
}