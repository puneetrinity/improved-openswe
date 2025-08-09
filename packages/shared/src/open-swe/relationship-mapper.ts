/**
 * Relationship Mapper Implementation
 * 
 * Analyzes and maps relationships between code entities for the Repository Knowledge Graph.
 * Detects dependencies, calls, imports, inheritance, data flow, and other semantic relationships.
 */

import crypto from 'crypto';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import {
  IRelationshipMapper,
  RepositoryKnowledgeGraphResult
} from './repository-knowledge-graph-interfaces.js';
import {
  CodeEntity,
  Relationship,
  RelationshipType,
  SupportedLanguage
} from './repository-knowledge-graph-types.js';

/**
 * Configuration for relationship analysis
 */
interface RelationshipMapperConfig {
  /**
   * Maximum depth for transitive relationship discovery
   */
  maxDepth: number;

  /**
   * Minimum confidence threshold for relationships
   */
  minConfidence: number;

  /**
   * Enable deep analysis (slower but more accurate)
   */
  enableDeepAnalysis: boolean;

  /**
   * Include implicit relationships
   */
  includeImplicitRelationships: boolean;

  /**
   * Relationship types to analyze
   */
  enabledRelationshipTypes: RelationshipType[];

  /**
   * Language-specific analysis options
   */
  languageOptions: {
    [key in SupportedLanguage]?: {
      analyzeImports: boolean;
      analyzeInheritance: boolean;
      analyzeCalls: boolean;
      analyzeDataFlow: boolean;
    };
  };
}

/**
 * Analysis context for relationship detection
 */
interface AnalysisContext {
  /**
   * All entities being analyzed
   */
  entities: Map<string, CodeEntity>;

  /**
   * File content by path
   */
  fileContents: Map<string, string>;

  /**
   * Import statements by file
   */
  imports: Map<string, ImportStatement[]>;

  /**
   * Export statements by file
   */
  exports: Map<string, ExportStatement[]>;

  /**
   * Call graph information
   */
  callGraph: Map<string, string[]>;
}

/**
 * Import statement representation
 */
interface ImportStatement {
  source: string;
  specifiers: Array<{
    name: string;
    alias?: string;
    type: 'default' | 'named' | 'namespace';
  }>;
  filePath: string;
  line: number;
}

/**
 * Export statement representation
 */
interface ExportStatement {
  name: string;
  type: 'default' | 'named';
  filePath: string;
  line: number;
}

/**
 * Relationship analysis result
 */
interface RelationshipAnalysis {
  relationships: Relationship[];
  confidence: number;
  analysisTime: number;
  metadata: Record<string, any>;
}

/**
 * Relationship Mapper implementation
 */
export class RelationshipMapper implements IRelationshipMapper {
  private readonly logger = createLogger(LogLevel.INFO, 'RelationshipMapper');
  private config: RelationshipMapperConfig;

  constructor(config?: Partial<RelationshipMapperConfig>) {
    this.config = {
      maxDepth: 10,
      minConfidence: 0.7,
      enableDeepAnalysis: true,
      includeImplicitRelationships: true,
      enabledRelationshipTypes: [
        'extends',
        'implements',
        'calls',
        'imports',
        'exports',
        'uses',
        'depends_on',
        'instantiates',
        'overrides',
        'returns',
        'accepts_parameter',
        'accesses',
        'modifies',
        'contains',
        'references'
      ],
      languageOptions: {
        typescript: {
          analyzeImports: true,
          analyzeInheritance: true,
          analyzeCalls: true,
          analyzeDataFlow: true
        },
        javascript: {
          analyzeImports: true,
          analyzeInheritance: false,
          analyzeCalls: true,
          analyzeDataFlow: true
        },
        python: {
          analyzeImports: true,
          analyzeInheritance: true,
          analyzeCalls: true,
          analyzeDataFlow: true
        },
        java: {
          analyzeImports: true,
          analyzeInheritance: true,
          analyzeCalls: true,
          analyzeDataFlow: true
        },
        csharp: {
          analyzeImports: true,
          analyzeInheritance: true,
          analyzeCalls: true,
          analyzeDataFlow: true
        }
      },
      ...config
    };

    this.logger.info('RelationshipMapper initialized', { config: this.config });
  }

  /**
   * Analyze relationships between entities
   */
  async analyzeRelationships(entities: CodeEntity[]): Promise<RepositoryKnowledgeGraphResult<Relationship[]>> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting relationship analysis', { entityCount: entities.length });

      // Build analysis context
      const context = await this.buildAnalysisContext(entities);
      
      // Analyze different types of relationships
      const analysisResults = await Promise.all([
        this.analyzeImportRelationships(context),
        this.analyzeInheritanceRelationships(context),
        this.analyzeCallRelationships(context),
        this.analyzeDataFlowRelationships(context),
        this.analyzeContainmentRelationships(context),
        this.analyzeReferenceRelationships(context)
      ]);

      // Combine all relationships
      const allRelationships: Relationship[] = [];
      let totalConfidence = 0;
      
      for (const result of analysisResults) {
        allRelationships.push(...result.relationships);
        totalConfidence += result.confidence;
      }

      // Remove duplicates and validate
      const uniqueRelationships = this.deduplicateRelationships(allRelationships);
      const validatedRelationships = await this.validateRelationships(uniqueRelationships, entities);

      if (!validatedRelationships.success) {
        return validatedRelationships as any;
      }

      const finalRelationships = validatedRelationships.data!.valid;
      const avgConfidence = totalConfidence / analysisResults.length;

      this.logger.info('Relationship analysis completed', {
        totalRelationships: finalRelationships.length,
        averageConfidence: avgConfidence,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        data: finalRelationships,
        executionTime: Date.now() - startTime,
        metadata: {
          totalEntities: entities.length,
          relationshipsFound: finalRelationships.length,
          averageConfidence: avgConfidence,
          analysisTypes: analysisResults.length
        }
      };

    } catch (error) {
      this.logger.error('Relationship analysis failed', {
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
   * Find relationships for a specific entity
   */
  async findEntityRelationships(
    entity: CodeEntity,
    allEntities: CodeEntity[]
  ): Promise<RepositoryKnowledgeGraphResult<Relationship[]>> {
    const startTime = Date.now();

    try {
      // Filter entities to analyze (entity and its potential connections)
      const relevantEntities = this.filterRelevantEntities(entity, allEntities);
      
      // Use the main analysis method but filter results
      const analysisResult = await this.analyzeRelationships(relevantEntities);
      
      if (!analysisResult.success) {
        return analysisResult;
      }

      // Filter relationships that involve the target entity
      const entityRelationships = analysisResult.data!.filter(rel => 
        rel.sourceId === entity.id || rel.targetId === entity.id
      );

      return {
        success: true,
        data: entityRelationships,
        executionTime: Date.now() - startTime,
        metadata: {
          entityId: entity.id,
          relationshipsFound: entityRelationships.length
        }
      };

    } catch (error) {
      this.logger.error('Failed to find entity relationships', {
        entityId: entity.id,
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
   * Validate relationship integrity
   */
  async validateRelationships(
    relationships: Relationship[],
    entities: CodeEntity[]
  ): Promise<RepositoryKnowledgeGraphResult<{
    valid: Relationship[];
    invalid: Relationship[];
    issues: string[];
  }>> {
    const startTime = Date.now();
    
    try {
      const entityMap = new Map(entities.map(e => [e.id, e]));
      const valid: Relationship[] = [];
      const invalid: Relationship[] = [];
      const issues: string[] = [];

      for (const relationship of relationships) {
        // Check if source and target entities exist
        if (!entityMap.has(relationship.sourceId)) {
          invalid.push(relationship);
          issues.push(`Source entity not found: ${relationship.sourceId}`);
          continue;
        }

        if (!entityMap.has(relationship.targetId)) {
          invalid.push(relationship);
          issues.push(`Target entity not found: ${relationship.targetId}`);
          continue;
        }

        // Check if relationship makes semantic sense
        const sourceEntity = entityMap.get(relationship.sourceId)!;
        const targetEntity = entityMap.get(relationship.targetId)!;
        
        if (!this.isValidRelationship(relationship.type, sourceEntity, targetEntity)) {
          invalid.push(relationship);
          issues.push(`Invalid relationship type ${relationship.type} between ${sourceEntity.type} and ${targetEntity.type}`);
          continue;
        }

        // Check confidence threshold
        if (relationship.confidence < this.config.minConfidence) {
          invalid.push(relationship);
          issues.push(`Relationship confidence ${relationship.confidence} below threshold ${this.config.minConfidence}`);
          continue;
        }

        valid.push(relationship);
      }

      this.logger.debug('Relationship validation completed', {
        total: relationships.length,
        valid: valid.length,
        invalid: invalid.length,
        issues: issues.length
      });

      return {
        success: true,
        data: { valid, invalid, issues },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get supported relationship types
   */
  getSupportedRelationshipTypes(): RelationshipType[] {
    return [
      'extends',
      'implements',
      'calls',
      'imports',
      'exports',
      'uses',
      'depends_on',
      'instantiates',
      'overrides',
      'throws',
      'returns',
      'accepts_parameter',
      'accesses',
      'modifies',
      'contains',
      'references',
      'composition',
      'aggregation',
      'association'
    ];
  }

  /**
   * Calculate relationship strength
   */
  async calculateRelationshipStrength(relationship: Relationship): Promise<number> {
    let strength = relationship.confidence;

    // Adjust strength based on relationship type
    switch (relationship.type) {
      case 'extends':
      case 'implements':
        strength *= 1.2; // Strong semantic relationships
        break;
      case 'calls':
      case 'uses':
        strength *= 1.0; // Normal strength
        break;
      case 'references':
        strength *= 0.8; // Weaker relationship
        break;
      default:
        strength *= 1.0;
    }

    // Adjust based on bidirectionality
    if (relationship.metadata.bidirectional) {
      strength *= 1.1;
    }

    return Math.min(1.0, strength);
  }

  /**
   * Build analysis context from entities
   */
  private async buildAnalysisContext(entities: CodeEntity[]): Promise<AnalysisContext> {
    const context: AnalysisContext = {
      entities: new Map(entities.map(e => [e.id, e])),
      fileContents: new Map(),
      imports: new Map(),
      exports: new Map(),
      callGraph: new Map()
    };

    // Group entities by file
    const entitiesByFile = new Map<string, CodeEntity[]>();
    for (const entity of entities) {
      const filePath = entity.metadata.filePath;
      if (!entitiesByFile.has(filePath)) {
        entitiesByFile.set(filePath, []);
      }
      entitiesByFile.get(filePath)!.push(entity);
    }

    // Analyze each file
    for (const [filePath, fileEntities] of entitiesByFile) {
      // Get file content (would normally read from filesystem)
      const content = fileEntities[0]?.sourceCode || '';
      context.fileContents.set(filePath, content);

      // Extract imports and exports
      const language = fileEntities[0]?.metadata.language;
      if (language) {
        const imports = this.extractImports(content, filePath, language);
        const exports = this.extractExports(content, filePath, language);
        
        context.imports.set(filePath, imports);
        context.exports.set(filePath, exports);
      }
    }

    return context;
  }

  /**
   * Analyze import/export relationships
   */
  private async analyzeImportRelationships(context: AnalysisContext): Promise<RelationshipAnalysis> {
    const relationships: Relationship[] = [];
    
    for (const [filePath, imports] of context.imports) {
      for (const importStmt of imports) {
        // Find entities that match the import
        for (const [entityId, entity] of context.entities) {
          if (this.matchesImport(entity, importStmt)) {
            // Find importing entities in the same file
            const importingEntities = Array.from(context.entities.values())
              .filter(e => e.metadata.filePath === filePath);
            
            for (const importingEntity of importingEntities) {
              const relationship: Relationship = {
                id: this.generateRelationshipId(importingEntity.id, entity.id, 'imports'),
                type: 'imports',
                sourceId: importingEntity.id,
                targetId: entity.id,
                strength: 0.8,
                confidence: 0.9,
                metadata: {
                  definitionPath: filePath,
                  definitionLine: importStmt.line,
                  context: `import ${importStmt.specifiers.map(s => s.name).join(', ')} from '${importStmt.source}'`,
                  bidirectional: false,
                  discoveredAt: Date.now(),
                  lastVerified: Date.now()
                }
              };
              relationships.push(relationship);
            }
          }
        }
      }
    }

    return {
      relationships,
      confidence: 0.9,
      analysisTime: 0,
      metadata: { type: 'import_analysis' }
    };
  }

  /**
   * Analyze inheritance relationships
   */
  private async analyzeInheritanceRelationships(context: AnalysisContext): Promise<RelationshipAnalysis> {
    const relationships: Relationship[] = [];
    
    for (const [entityId, entity] of context.entities) {
      if (entity.type === 'class') {
        // Look for extends relationships
        const extendsMatch = entity.sourceCode.match(/class\s+\w+\s+extends\s+(\w+)/);
        if (extendsMatch) {
          const parentClassName = extendsMatch[1];
          const parentEntity = this.findEntityByName(context.entities, parentClassName);
          
          if (parentEntity) {
            const relationship: Relationship = {
              id: this.generateRelationshipId(entity.id, parentEntity.id, 'extends'),
              type: 'extends',
              sourceId: entity.id,
              targetId: parentEntity.id,
              strength: 1.0,
              confidence: 0.95,
              metadata: {
                definitionPath: entity.metadata.filePath,
                definitionLine: entity.metadata.startLine,
                context: `${entity.name} extends ${parentEntity.name}`,
                bidirectional: false,
                discoveredAt: Date.now(),
                lastVerified: Date.now()
              }
            };
            relationships.push(relationship);
          }
        }

        // Look for implements relationships
        const implementsMatch = entity.sourceCode.match(/implements\s+([\w\s,]+)/);
        if (implementsMatch) {
          const interfaceNames = implementsMatch[1].split(',').map(name => name.trim());
          
          for (const interfaceName of interfaceNames) {
            const interfaceEntity = this.findEntityByName(context.entities, interfaceName);
            
            if (interfaceEntity && interfaceEntity.type === 'interface') {
              const relationship: Relationship = {
                id: this.generateRelationshipId(entity.id, interfaceEntity.id, 'implements'),
                type: 'implements',
                sourceId: entity.id,
                targetId: interfaceEntity.id,
                strength: 1.0,
                confidence: 0.95,
                metadata: {
                  definitionPath: entity.metadata.filePath,
                  definitionLine: entity.metadata.startLine,
                  context: `${entity.name} implements ${interfaceEntity.name}`,
                  bidirectional: false,
                  discoveredAt: Date.now(),
                  lastVerified: Date.now()
                }
              };
              relationships.push(relationship);
            }
          }
        }
      }
    }

    return {
      relationships,
      confidence: 0.95,
      analysisTime: 0,
      metadata: { type: 'inheritance_analysis' }
    };
  }

  /**
   * Analyze function/method call relationships
   */
  private async analyzeCallRelationships(context: AnalysisContext): Promise<RelationshipAnalysis> {
    const relationships: Relationship[] = [];
    
    for (const [entityId, entity] of context.entities) {
      if (entity.type === 'function' || entity.type === 'method') {
        // Find function/method calls in the source code
        const callMatches = entity.sourceCode.matchAll(/(\w+)\s*\(/g);
        
        for (const match of callMatches) {
          const calledName = match[1];
          const calledEntity = this.findEntityByName(context.entities, calledName);
          
          if (calledEntity && calledEntity.id !== entity.id) {
            const relationship: Relationship = {
              id: this.generateRelationshipId(entity.id, calledEntity.id, 'calls'),
              type: 'calls',
              sourceId: entity.id,
              targetId: calledEntity.id,
              strength: 0.8,
              confidence: 0.7, // Lower confidence for regex-based detection
              metadata: {
                definitionPath: entity.metadata.filePath,
                context: `${entity.name} calls ${calledEntity.name}`,
                bidirectional: false,
                discoveredAt: Date.now(),
                lastVerified: Date.now()
              }
            };
            relationships.push(relationship);
          }
        }
      }
    }

    return {
      relationships,
      confidence: 0.7,
      analysisTime: 0,
      metadata: { type: 'call_analysis' }
    };
  }

  /**
   * Analyze data flow relationships
   */
  private async analyzeDataFlowRelationships(context: AnalysisContext): Promise<RelationshipAnalysis> {
    const relationships: Relationship[] = [];
    
    // This is a simplified implementation
    // In practice, you'd want more sophisticated data flow analysis
    
    return {
      relationships,
      confidence: 0.6,
      analysisTime: 0,
      metadata: { type: 'data_flow_analysis' }
    };
  }

  /**
   * Analyze containment relationships
   */
  private async analyzeContainmentRelationships(context: AnalysisContext): Promise<RelationshipAnalysis> {
    const relationships: Relationship[] = [];
    
    // Find entities that are defined within other entities
    for (const [entityId, entity] of context.entities) {
      for (const [otherId, other] of context.entities) {
        if (entity.id !== other.id && entity.metadata.filePath === other.metadata.filePath) {
          // Check if entity is contained within other entity
          if (this.isContainedWithin(entity, other)) {
            const relationship: Relationship = {
              id: this.generateRelationshipId(other.id, entity.id, 'contains'),
              type: 'contains',
              sourceId: other.id,
              targetId: entity.id,
              strength: 0.9,
              confidence: 0.8,
              metadata: {
                definitionPath: entity.metadata.filePath,
                context: `${other.name} contains ${entity.name}`,
                bidirectional: false,
                discoveredAt: Date.now(),
                lastVerified: Date.now()
              }
            };
            relationships.push(relationship);
          }
        }
      }
    }

    return {
      relationships,
      confidence: 0.8,
      analysisTime: 0,
      metadata: { type: 'containment_analysis' }
    };
  }

  /**
   * Analyze reference relationships
   */
  private async analyzeReferenceRelationships(context: AnalysisContext): Promise<RelationshipAnalysis> {
    const relationships: Relationship[] = [];
    
    for (const [entityId, entity] of context.entities) {
      // Find references to other entities in the source code
      for (const [otherId, other] of context.entities) {
        if (entity.id !== other.id) {
          const referenceCount = this.countReferences(entity.sourceCode, other.name);
          
          if (referenceCount > 0) {
            const relationship: Relationship = {
              id: this.generateRelationshipId(entity.id, other.id, 'references'),
              type: 'references',
              sourceId: entity.id,
              targetId: other.id,
              strength: Math.min(1.0, referenceCount * 0.1),
              confidence: 0.6,
              metadata: {
                definitionPath: entity.metadata.filePath,
                context: `${entity.name} references ${other.name} (${referenceCount} times)`,
                bidirectional: false,
                discoveredAt: Date.now(),
                lastVerified: Date.now()
              }
            };
            relationships.push(relationship);
          }
        }
      }
    }

    return {
      relationships,
      confidence: 0.6,
      analysisTime: 0,
      metadata: { type: 'reference_analysis' }
    };
  }

  /**
   * Remove duplicate relationships
   */
  private deduplicateRelationships(relationships: Relationship[]): Relationship[] {
    const seen = new Set<string>();
    const unique: Relationship[] = [];

    for (const relationship of relationships) {
      const key = `${relationship.sourceId}-${relationship.targetId}-${relationship.type}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(relationship);
      }
    }

    return unique;
  }

  /**
   * Filter entities relevant to a specific entity
   */
  private filterRelevantEntities(entity: CodeEntity, allEntities: CodeEntity[]): CodeEntity[] {
    const relevant = [entity];
    const entityName = entity.name;
    
    // Add entities from the same file
    for (const other of allEntities) {
      if (other.id !== entity.id && other.metadata.filePath === entity.metadata.filePath) {
        relevant.push(other);
      }
    }

    // Add entities that might be referenced
    for (const other of allEntities) {
      if (other.id !== entity.id && 
          (entity.sourceCode.includes(other.name) || other.sourceCode.includes(entityName))) {
        relevant.push(other);
      }
    }

    return relevant;
  }

  /**
   * Extract import statements from source code
   */
  private extractImports(content: string, filePath: string, language: SupportedLanguage): ImportStatement[] {
    const imports: ImportStatement[] = [];
    
    if (language === 'typescript' || language === 'javascript') {
      // ES6 imports
      const importRegex = /import\s+(?:(\w+)|{([^}]+)}|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        const source = match[4];
        const specifiers = [];
        
        if (match[1]) { // Default import
          specifiers.push({ name: match[1], type: 'default' as const });
        } else if (match[2]) { // Named imports
          const namedImports = match[2].split(',').map(s => s.trim());
          for (const namedImport of namedImports) {
            const parts = namedImport.split(' as ');
            specifiers.push({
              name: parts[0].trim(),
              alias: parts[1]?.trim(),
              type: 'named' as const
            });
          }
        } else if (match[3]) { // Namespace import
          specifiers.push({ name: match[3], type: 'namespace' as const });
        }
        
        imports.push({ source, specifiers, filePath, line });
      }
    } else if (language === 'python') {
      // Python imports
      const importRegex = /^(?:from\s+([\w.]+)\s+)?import\s+([\w\s,*]+)/gm;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        const source = match[1] || '';
        const importList = match[2];
        const specifiers = [];
        
        if (importList.includes('*')) {
          specifiers.push({ name: '*', type: 'namespace' as const });
        } else {
          const names = importList.split(',').map(s => s.trim());
          for (const name of names) {
            const parts = name.split(' as ');
            specifiers.push({
              name: parts[0].trim(),
              alias: parts[1]?.trim(),
              type: 'named' as const
            });
          }
        }
        
        imports.push({ source, specifiers, filePath, line });
      }
    }

    return imports;
  }

  /**
   * Extract export statements from source code
   */
  private extractExports(content: string, filePath: string, language: SupportedLanguage): ExportStatement[] {
    const exports: ExportStatement[] = [];
    
    if (language === 'typescript' || language === 'javascript') {
      // Named exports
      const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
      let match;
      
      while ((match = namedExportRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        exports.push({
          name: match[1],
          type: 'named',
          filePath,
          line
        });
      }

      // Default exports
      const defaultExportRegex = /export\s+default\s+(?:class\s+(\w+)|function\s+(\w+)|(\w+))/g;
      while ((match = defaultExportRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        const name = match[1] || match[2] || match[3];
        exports.push({
          name,
          type: 'default',
          filePath,
          line
        });
      }
    }

    return exports;
  }

  /**
   * Check if entity matches import statement
   */
  private matchesImport(entity: CodeEntity, importStmt: ImportStatement): boolean {
    return importStmt.specifiers.some(spec => 
      spec.name === entity.name || spec.alias === entity.name
    );
  }

  /**
   * Find entity by name
   */
  private findEntityByName(entities: Map<string, CodeEntity>, name: string): CodeEntity | undefined {
    for (const entity of entities.values()) {
      if (entity.name === name) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * Check if one entity is contained within another
   */
  private isContainedWithin(inner: CodeEntity, outer: CodeEntity): boolean {
    return inner.metadata.startLine >= outer.metadata.startLine &&
           inner.metadata.endLine <= outer.metadata.endLine;
  }

  /**
   * Count references to a name in source code
   */
  private countReferences(sourceCode: string, name: string): number {
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    const matches = sourceCode.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Check if a relationship is semantically valid
   */
  private isValidRelationship(
    relationshipType: RelationshipType,
    sourceEntity: CodeEntity,
    targetEntity: CodeEntity
  ): boolean {
    switch (relationshipType) {
      case 'extends':
        return sourceEntity.type === 'class' && targetEntity.type === 'class';
      
      case 'implements':
        return sourceEntity.type === 'class' && targetEntity.type === 'interface';
      
      case 'calls':
        return (sourceEntity.type === 'function' || sourceEntity.type === 'method') &&
               (targetEntity.type === 'function' || targetEntity.type === 'method');
      
      case 'contains':
        return sourceEntity.type === 'class' || sourceEntity.type === 'module';
      
      default:
        return true; // Allow other relationships by default
    }
  }

  /**
   * Generate unique relationship ID
   */
  private generateRelationshipId(sourceId: string, targetId: string, type: RelationshipType): string {
    const data = `${sourceId}-${targetId}-${type}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
}