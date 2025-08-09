/**
 * Semantic Code Parser Implementation
 * 
 * Extracts semantic entities from source code in multiple programming languages
 * for the Repository Knowledge Graph system.
 */

import crypto from 'crypto';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import {
  ISemanticCodeParser,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-interfaces.js';
import {
  CodeEntity,
  CodeEntityType,
  SupportedLanguage,
  EntityMetadata,
  CodeIssue,
  PatternMatch
} from './repository-knowledge-graph-types.js';

/**
 * Parser configuration
 */
interface ParserConfig {
  depth: 'shallow' | 'medium' | 'deep';
  includePrivate: boolean;
  includeComments: boolean;
  customPatterns: string[];
  enableComplexityAnalysis: boolean;
  enablePatternDetection: boolean;
  maxFileSize: number; // Maximum file size to parse in bytes
}

/**
 * AST node representation
 */
interface ASTNode {
  type: string;
  name?: string;
  start: number;
  end: number;
  line: number;
  column: number;
  children?: ASTNode[];
  properties?: Record<string, any>;
}

/**
 * Semantic Code Parser implementation
 */
export class SemanticCodeParser implements ISemanticCodeParser {
  private readonly logger = createLogger(LogLevel.INFO, 'SemanticCodeParser');
  private config: ParserConfig;

  constructor(config?: Partial<ParserConfig>) {
    this.config = {
      depth: 'medium',
      includePrivate: true,
      includeComments: false,
      customPatterns: [],
      enableComplexityAnalysis: true,
      enablePatternDetection: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...config
    };

    this.logger.info('SemanticCodeParser initialized', { config: this.config });
  }

  /**
   * Parse source code to extract entities
   */
  async parseFile(
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!this.isLanguageSupported(language)) {
        return {
          success: false,
          error: `Unsupported language: ${language}`,
          executionTime: Date.now() - startTime
        };
      }

      if (content.length > this.config.maxFileSize) {
        return {
          success: false,
          error: `File too large: ${content.length} bytes exceeds maximum of ${this.config.maxFileSize} bytes`,
          executionTime: Date.now() - startTime
        };
      }

      // Parse based on language
      let entities: CodeEntity[];
      switch (language) {
        case 'typescript':
        case 'javascript':
          entities = await this.parseJavaScript(filePath, content, language);
          break;
        case 'python':
          entities = await this.parsePython(filePath, content);
          break;
        case 'java':
          entities = await this.parseJava(filePath, content);
          break;
        case 'csharp':
          entities = await this.parseCSharp(filePath, content);
          break;
        default:
          entities = await this.parseGeneric(filePath, content, language);
          break;
      }

      // Post-process entities
      entities = await this.postProcessEntities(entities, content);

      this.logger.debug('File parsed successfully', {
        filePath,
        language,
        entitiesFound: entities.length,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        data: entities,
        executionTime: Date.now() - startTime,
        metadata: {
          filePath,
          language,
          entitiesFound: entities.length,
          fileSize: content.length
        }
      };

    } catch (error) {
      this.logger.error('Failed to parse file', {
        filePath,
        language,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Parse multiple files concurrently
   */
  async parseFiles(files: Array<{
    path: string;
    content: string;
    language: SupportedLanguage;
  }>): Promise<RepositoryKnowledgeGraphResult<CodeEntity[]>> {
    const startTime = Date.now();
    const allEntities: CodeEntity[] = [];
    const errors: string[] = [];

    try {
      // Process files in batches to avoid overwhelming the system
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(file => 
          this.parseFile(file.path, file.content, file.language)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            allEntities.push(...result.value.data!);
          } else if (result.status === 'fulfilled') {
            errors.push(result.value.error!);
          } else {
            errors.push(result.reason?.message || 'Unknown error');
          }
        }
      }

      this.logger.info('Multiple files parsed', {
        totalFiles: files.length,
        successfulFiles: files.length - errors.length,
        totalEntities: allEntities.length,
        errors: errors.length
      });

      return {
        success: true,
        data: allEntities,
        executionTime: Date.now() - startTime,
        metadata: {
          totalFiles: files.length,
          successfulFiles: files.length - errors.length,
          errors: errors.length > 0 ? errors : undefined
        }
      };

    } catch (error) {
      this.logger.error('Failed to parse multiple files', {
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
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [
      'typescript',
      'javascript', 
      'python',
      'java',
      'csharp',
      'cpp',
      'go',
      'rust',
      'php',
      'ruby'
    ];
  }

  /**
   * Validate if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.getSupportedLanguages().includes(language as SupportedLanguage);
  }

  /**
   * Configure parser settings
   */
  configure(config: Partial<ParserConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Parser configuration updated', { config: this.config });
  }

  /**
   * Parse JavaScript/TypeScript files
   */
  private async parseJavaScript(
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];

    try {
      // Simple regex-based parsing for demo purposes
      // In production, you'd use a proper AST parser like @typescript-eslint/parser
      
      // Extract classes
      const classMatches = content.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*{/g);
      for (const match of classMatches) {
        const entity = await this.createJavaScriptEntity(
          'class',
          match[1],
          match.index!,
          filePath,
          content,
          language
        );
        entities.push(entity);
      }

      // Extract interfaces (TypeScript)
      if (language === 'typescript') {
        const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w\s,]+))?\s*{/g);
        for (const match of interfaceMatches) {
          const entity = await this.createJavaScriptEntity(
            'interface',
            match[1],
            match.index!,
            filePath,
            content,
            language
          );
          entities.push(entity);
        }
      }

      // Extract functions
      const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g);
      for (const match of functionMatches) {
        const entity = await this.createJavaScriptEntity(
          'function',
          match[1],
          match.index!,
          filePath,
          content,
          language
        );
        entities.push(entity);
      }

      // Extract arrow functions assigned to variables
      const arrowFunctionMatches = content.matchAll(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*|\w+\s*)=>\s*/g);
      for (const match of arrowFunctionMatches) {
        const entity = await this.createJavaScriptEntity(
          'function',
          match[1],
          match.index!,
          filePath,
          content,
          language
        );
        entities.push(entity);
      }

      // Extract methods within classes
      const methodMatches = content.matchAll(/(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g);
      for (const match of methodMatches) {
        if (!['class', 'function', 'interface'].includes(match[1])) {
          const entity = await this.createJavaScriptEntity(
            'method',
            match[1],
            match.index!,
            filePath,
            content,
            language
          );
          entities.push(entity);
        }
      }

      // Extract variables and constants
      const variableMatches = content.matchAll(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/g);
      for (const match of variableMatches) {
        const entity = await this.createJavaScriptEntity(
          match[0].includes('const') ? 'constant' : 'variable',
          match[1],
          match.index!,
          filePath,
          content,
          language
        );
        entities.push(entity);
      }

      // Extract enums (TypeScript)
      if (language === 'typescript') {
        const enumMatches = content.matchAll(/(?:export\s+)?enum\s+(\w+)\s*{/g);
        for (const match of enumMatches) {
          const entity = await this.createJavaScriptEntity(
            'enum',
            match[1],
            match.index!,
            filePath,
            content,
            language
          );
          entities.push(entity);
        }
      }

      return entities;

    } catch (error) {
      this.logger.error('Failed to parse JavaScript/TypeScript', {
        filePath,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Parse Python files
   */
  private async parsePython(filePath: string, content: string): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];

    try {
      // Extract classes
      const classMatches = content.matchAll(/^class\s+(\w+)(?:\([^)]*\))?\s*:/gm);
      for (const match of classMatches) {
        const entity = await this.createPythonEntity(
          'class',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      // Extract functions
      const functionMatches = content.matchAll(/^(?:\s*)def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/gm);
      for (const match of functionMatches) {
        const entity = await this.createPythonEntity(
          'function',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      // Extract variables (module-level assignments)
      const variableMatches = content.matchAll(/^(\w+)\s*=\s*[^#\n]+/gm);
      for (const match of variableMatches) {
        if (!match[1].startsWith('_')) { // Ignore private variables unless configured
          const entity = await this.createPythonEntity(
            'variable',
            match[1],
            match.index!,
            filePath,
            content
          );
          entities.push(entity);
        }
      }

      return entities;

    } catch (error) {
      this.logger.error('Failed to parse Python', {
        filePath,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Parse Java files
   */
  private async parseJava(filePath: string, content: string): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];

    try {
      // Extract classes
      const classMatches = content.matchAll(/(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*{/g);
      for (const match of classMatches) {
        const entity = await this.createJavaEntity(
          'class',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      // Extract interfaces
      const interfaceMatches = content.matchAll(/(?:public|private|protected)?\s*interface\s+(\w+)(?:\s+extends\s+([\w\s,]+))?\s*{/g);
      for (const match of interfaceMatches) {
        const entity = await this.createJavaEntity(
          'interface',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      // Extract methods
      const methodMatches = content.matchAll(/(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?[\w<>[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*{/g);
      for (const match of methodMatches) {
        const entity = await this.createJavaEntity(
          'method',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      return entities;

    } catch (error) {
      this.logger.error('Failed to parse Java', {
        filePath,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Parse C# files
   */
  private async parseCSharp(filePath: string, content: string): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];

    try {
      // Extract classes
      const classMatches = content.matchAll(/(?:public|private|protected|internal)?\s*(?:abstract|sealed|static|partial)?\s*class\s+(\w+)(?:\s*:\s*([\w\s,]+))?\s*{/g);
      for (const match of classMatches) {
        const entity = await this.createCSharpEntity(
          'class',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      // Extract interfaces
      const interfaceMatches = content.matchAll(/(?:public|private|protected|internal)?\s*interface\s+(\w+)(?:\s*:\s*([\w\s,]+))?\s*{/g);
      for (const match of interfaceMatches) {
        const entity = await this.createCSharpEntity(
          'interface',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      // Extract methods
      const methodMatches = content.matchAll(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:virtual\s+)?(?:override\s+)?[\w<>[\]?]+\s+(\w+)\s*\([^)]*\)\s*{/g);
      for (const match of methodMatches) {
        const entity = await this.createCSharpEntity(
          'method',
          match[1],
          match.index!,
          filePath,
          content
        );
        entities.push(entity);
      }

      return entities;

    } catch (error) {
      this.logger.error('Failed to parse C#', {
        filePath,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Generic parser for unsupported languages
   */
  private async parseGeneric(
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];

    // Basic function extraction for most languages
    const functionMatches = content.matchAll(/(?:function|def|fn)\s+(\w+)/g);
    for (const match of functionMatches) {
      const entity = await this.createGenericEntity(
        'function',
        match[1],
        match.index!,
        filePath,
        content,
        language
      );
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Create JavaScript/TypeScript entity
   */
  private async createJavaScriptEntity(
    type: CodeEntityType,
    name: string,
    startIndex: number,
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): Promise<CodeEntity> {
    const lines = content.substring(0, startIndex).split('\n');
    const startLine = lines.length;
    const endLine = this.findEntityEndLine(content, startIndex);

    const sourceCode = this.extractSourceCode(content, startIndex, endLine);
    const complexity = this.calculateComplexity(sourceCode);
    const issues = this.detectIssues(sourceCode, type);
    const patterns = this.detectPatterns(sourceCode, type);

    return {
      id: this.generateEntityId(filePath, type, name, startLine),
      type,
      name,
      fullyQualifiedName: `${filePath}::${name}`,
      relationships: [],
      semanticEmbedding: [], // Will be populated by embedding generator
      metadata: {
        filePath,
        startLine,
        endLine,
        language,
        visibility: this.extractVisibility(sourceCode),
        isStatic: sourceCode.includes('static'),
        isAbstract: sourceCode.includes('abstract'),
        isDeprecated: sourceCode.includes('@deprecated'),
        documentation: this.extractDocumentation(content, startIndex),
        complexity,
        quality: {
          testCoverage: undefined,
          testCount: undefined,
          duplicationScore: undefined,
          maintainabilityIndex: this.calculateMaintainabilityIndex(complexity, sourceCode.length)
        },
        usage: {
          referenceCount: 0,
          modificationCount: 0,
          lastModified: Date.now(),
          accessFrequency: 0
        },
        tags: this.extractTags(sourceCode),
        security: this.analyzeSecurityFeatures(sourceCode),
        performance: this.analyzePerformanceCharacteristics(sourceCode)
      },
      sourceCode,
      normalizedCode: this.normalizeCode(sourceCode),
      contentHash: this.calculateContentHash(sourceCode),
      version: {
        current: 1,
        history: []
      },
      analysis: {
        patterns,
        issues,
        suggestions: this.generateSuggestions(sourceCode, issues),
        patternSimilarity: []
      }
    };
  }

  /**
   * Create Python entity
   */
  private async createPythonEntity(
    type: CodeEntityType,
    name: string,
    startIndex: number,
    filePath: string,
    content: string
  ): Promise<CodeEntity> {
    // Similar to createJavaScriptEntity but with Python-specific logic
    return this.createJavaScriptEntity(type, name, startIndex, filePath, content, 'python');
  }

  /**
   * Create Java entity
   */
  private async createJavaEntity(
    type: CodeEntityType,
    name: string,
    startIndex: number,
    filePath: string,
    content: string
  ): Promise<CodeEntity> {
    // Similar to createJavaScriptEntity but with Java-specific logic
    return this.createJavaScriptEntity(type, name, startIndex, filePath, content, 'java');
  }

  /**
   * Create C# entity
   */
  private async createCSharpEntity(
    type: CodeEntityType,
    name: string,
    startIndex: number,
    filePath: string,
    content: string
  ): Promise<CodeEntity> {
    // Similar to createJavaScriptEntity but with C#-specific logic
    return this.createJavaScriptEntity(type, name, startIndex, filePath, content, 'csharp');
  }

  /**
   * Create generic entity
   */
  private async createGenericEntity(
    type: CodeEntityType,
    name: string,
    startIndex: number,
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): Promise<CodeEntity> {
    return this.createJavaScriptEntity(type, name, startIndex, filePath, content, language);
  }

  /**
   * Post-process entities to add additional analysis
   */
  private async postProcessEntities(entities: CodeEntity[], content: string): Promise<CodeEntity[]> {
    return entities.map(entity => {
      // Add cross-references
      entity.analysis.suggestions = this.generateSuggestions(entity.sourceCode, entity.analysis.issues);
      
      // Update usage statistics based on content analysis
      const referenceCount = this.countReferences(content, entity.name);
      entity.metadata.usage.referenceCount = referenceCount;

      return entity;
    });
  }

  /**
   * Generate unique entity ID
   */
  private generateEntityId(filePath: string, type: CodeEntityType, name: string, line: number): string {
    const data = `${filePath}:${type}:${name}:${line}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Find the end line of an entity
   */
  private findEntityEndLine(content: string, startIndex: number): number {
    // Simple brace matching for now
    const substring = content.substring(startIndex);
    let braceCount = 0;
    let inString = false;
    let endIndex = 0;

    for (let i = 0; i < substring.length; i++) {
      const char = substring[i];
      
      if (char === '"' || char === "'" || char === '`') {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        
        if (braceCount === 0 && char === '}') {
          endIndex = i;
          break;
        }
      }
    }

    const lines = content.substring(0, startIndex + endIndex).split('\n');
    return lines.length;
  }

  /**
   * Extract source code for an entity
   */
  private extractSourceCode(content: string, startIndex: number, endLine: number): string {
    const lines = content.split('\n');
    const startLines = content.substring(0, startIndex).split('\n');
    const startLineIndex = startLines.length - 1;
    
    return lines.slice(startLineIndex, endLine).join('\n');
  }

  /**
   * Calculate code complexity metrics
   */
  private calculateComplexity(sourceCode: string): EntityMetadata['complexity'] {
    // Simple complexity calculation
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(sourceCode);
    const linesOfCode = sourceCode.split('\n').filter(line => line.trim().length > 0).length;
    const nestingDepth = this.calculateNestingDepth(sourceCode);
    const parameterCount = this.countParameters(sourceCode);

    return {
      cyclomatic: cyclomaticComplexity,
      linesOfCode,
      parameterCount,
      nestingDepth
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(sourceCode: string): number {
    // Count decision points
    const decisionPoints = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*.*?\s*:/g, // Ternary operator
      /&&/g,
      /\|\|/g
    ];

    let complexity = 1; // Base complexity
    
    for (const pattern of decisionPoints) {
      const matches = sourceCode.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Calculate nesting depth
   */
  private calculateNestingDepth(sourceCode: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sourceCode.length; i++) {
      const char = sourceCode[i];
      const prevChar = i > 0 ? sourceCode[i - 1] : '';

      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      if (!inString) {
        if (char === '{' || char === '(' || char === '[') {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === '}' || char === ')' || char === ']') {
          currentDepth--;
        }
      }
    }

    return maxDepth;
  }

  /**
   * Count function parameters
   */
  private countParameters(sourceCode: string): number | undefined {
    const functionMatch = sourceCode.match(/\([^)]*\)/);
    if (!functionMatch) return undefined;

    const paramString = functionMatch[0].slice(1, -1).trim();
    if (!paramString) return 0;

    return paramString.split(',').length;
  }

  /**
   * Extract visibility modifier
   */
  private extractVisibility(sourceCode: string): EntityMetadata['visibility'] {
    if (sourceCode.includes('private')) return 'private';
    if (sourceCode.includes('protected')) return 'protected';
    if (sourceCode.includes('internal')) return 'internal';
    if (sourceCode.includes('package')) return 'package';
    return 'public';
  }

  /**
   * Extract documentation
   */
  private extractDocumentation(content: string, startIndex: number): string | undefined {
    const beforeEntity = content.substring(0, startIndex);
    const lines = beforeEntity.split('\n');
    
    // Look for JSDoc or similar documentation
    const docLines: string[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('*/')) {
        continue;
      } else if (line.startsWith('*') || line.startsWith('/**')) {
        docLines.unshift(line);
      } else if (line.startsWith('//')) {
        docLines.unshift(line);
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }

    return docLines.length > 0 ? docLines.join('\n') : undefined;
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainabilityIndex(complexity: EntityMetadata['complexity'], codeLength: number): number {
    // Simplified maintainability index calculation
    const halsteadVolume = Math.log2(codeLength) * codeLength; // Approximation
    const cyclomaticComplexity = complexity.cyclomatic;
    const linesOfCode = complexity.linesOfCode;

    const maintainabilityIndex = Math.max(0, 
      (171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)) * 100 / 171
    );

    return Math.round(maintainabilityIndex);
  }

  /**
   * Extract tags from source code
   */
  private extractTags(sourceCode: string): string[] {
    const tags: string[] = [];
    
    // Extract JSDoc tags
    const jsdocTags = sourceCode.match(/@\w+/g);
    if (jsdocTags) {
      tags.push(...jsdocTags.map(tag => tag.substring(1)));
    }

    // Extract custom patterns
    for (const pattern of this.config.customPatterns) {
      const regex = new RegExp(pattern, 'g');
      const matches = sourceCode.match(regex);
      if (matches) {
        tags.push(...matches);
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Detect code issues
   */
  private detectIssues(sourceCode: string, type: CodeEntityType): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Detect long methods/functions
    const lines = sourceCode.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 50) {
      issues.push({
        id: crypto.randomUUID(),
        type: 'maintainability',
        severity: 'warning',
        description: 'Method/function is too long',
        suggestion: 'Consider breaking this into smaller functions',
        confidence: 0.8,
        location: { startLine: 1, endLine: lines.length }
      });
    }

    // Detect high complexity
    const complexity = this.calculateCyclomaticComplexity(sourceCode);
    if (complexity > 10) {
      issues.push({
        id: crypto.randomUUID(),
        type: 'complexity',
        severity: complexity > 15 ? 'error' : 'warning',
        description: `Cyclomatic complexity too high: ${complexity}`,
        suggestion: 'Consider refactoring to reduce complexity',
        confidence: 0.9,
        location: { startLine: 1, endLine: lines.length }
      });
    }

    // Detect potential security issues
    if (sourceCode.includes('eval(')) {
      issues.push({
        id: crypto.randomUUID(),
        type: 'security',
        severity: 'critical',
        description: 'Use of eval() function detected',
        suggestion: 'Avoid using eval() due to security risks',
        confidence: 0.95,
        location: { startLine: 1, endLine: lines.length }
      });
    }

    return issues;
  }

  /**
   * Detect code patterns
   */
  private detectPatterns(sourceCode: string, type: CodeEntityType): string[] {
    const patterns: string[] = [];

    // Singleton pattern
    if (sourceCode.includes('getInstance') && sourceCode.includes('private') && type === 'class') {
      patterns.push('singleton');
    }

    // Factory pattern
    if (sourceCode.includes('create') && sourceCode.includes('return new')) {
      patterns.push('factory');
    }

    // Observer pattern
    if (sourceCode.includes('subscribe') || sourceCode.includes('addEventListener')) {
      patterns.push('observer');
    }

    return patterns;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(sourceCode: string, issues: CodeIssue[]): string[] {
    const suggestions: string[] = [];

    // Add suggestions based on detected issues
    suggestions.push(...issues.map(issue => issue.suggestion || '').filter(Boolean));

    // Add general suggestions
    if (sourceCode.includes('console.log')) {
      suggestions.push('Consider using a proper logging framework instead of console.log');
    }

    if (!sourceCode.includes('/**') && sourceCode.split('\n').length > 10) {
      suggestions.push('Consider adding documentation for this entity');
    }

    return suggestions;
  }

  /**
   * Count references to an entity in content
   */
  private countReferences(content: string, entityName: string): number {
    const regex = new RegExp(`\\b${entityName}\\b`, 'g');
    const matches = content.match(regex);
    return matches ? matches.length - 1 : 0; // Subtract 1 for the definition itself
  }

  /**
   * Analyze security features
   */
  private analyzeSecurityFeatures(sourceCode: string): EntityMetadata['security'] {
    const vulnerabilities: string[] = [];
    let securityLevel: EntityMetadata['security']['securityLevel'] = 'low';
    
    // Check for potential vulnerabilities
    if (sourceCode.includes('eval(')) {
      vulnerabilities.push('Code injection via eval()');
      securityLevel = 'critical';
    }

    if (sourceCode.includes('innerHTML')) {
      vulnerabilities.push('Potential XSS via innerHTML');
      securityLevel = Math.max(securityLevel === 'low' ? 0 : securityLevel === 'medium' ? 1 : securityLevel === 'high' ? 2 : 3, 1) === 1 ? 'medium' : securityLevel === 'high' ? 'high' : 'critical';
    }

    return {
      hasSecurityAnnotations: sourceCode.includes('@security') || sourceCode.includes('@secure'),
      securityLevel,
      vulnerabilities
    };
  }

  /**
   * Analyze performance characteristics
   */
  private analyzePerformanceCharacteristics(sourceCode: string): EntityMetadata['performance'] {
    let computationalComplexity: EntityMetadata['performance']['computationalComplexity'] = 'O(1)';

    // Simple complexity detection based on loops
    if (sourceCode.includes('for') && sourceCode.includes('for')) {
      computationalComplexity = 'O(n²)';
    } else if (sourceCode.includes('for') || sourceCode.includes('while')) {
      computationalComplexity = 'O(n)';
    }

    return {
      computationalComplexity,
      estimatedExecutionTime: undefined,
      memoryUsage: undefined
    };
  }

  /**
   * Normalize code for analysis
   */
  private normalizeCode(sourceCode: string): string {
    return sourceCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate content hash
   */
  private calculateContentHash(sourceCode: string): string {
    return crypto.createHash('sha256').update(sourceCode).digest('hex');
  }
}