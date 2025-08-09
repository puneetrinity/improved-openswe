/**
 * Principal Engineer Pattern Recognition System
 * 
 * Advanced pattern recognition for design patterns, anti-patterns, and architectural patterns.
 * This system uses sophisticated heuristics and code analysis to identify common patterns
 * and provide recommendations for improvement.
 */

import {
  DesignPatternRecognition,
  AntiPatternDetection,
  SolidPrinciplesValidation,
  ReviewSeverity,
  ReviewFinding,
  PrincipalEngineerReviewConfig
} from './principal-engineer-review-types.js';
import { RepositoryKnowledgeGraph } from './repository-knowledge-graph-types.js';

/**
 * Code structure analysis result
 */
interface CodeStructure {
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  methods: MethodInfo[];
  imports: ImportInfo[];
  complexity: number;
  lineCount: number;
}

interface ClassInfo {
  name: string;
  filePath: string;
  lineNumber: number;
  methods: MethodInfo[];
  fields: FieldInfo[];
  extends?: string;
  implements: string[];
  isAbstract: boolean;
  accessModifier: 'public' | 'private' | 'protected';
}

interface InterfaceInfo {
  name: string;
  filePath: string;
  lineNumber: number;
  methods: MethodSignature[];
  extends: string[];
}

interface MethodInfo {
  name: string;
  filePath: string;
  lineNumber: number;
  className?: string;
  parameters: ParameterInfo[];
  returnType?: string;
  accessModifier: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAbstract: boolean;
  complexity: number;
  lineCount: number;
}

interface FieldInfo {
  name: string;
  type?: string;
  accessModifier: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isFinal: boolean;
}

interface ParameterInfo {
  name: string;
  type?: string;
}

interface MethodSignature {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
}

interface ImportInfo {
  module: string;
  items: string[];
  filePath: string;
}

/**
 * Design Pattern Recognition Engine
 */
export class DesignPatternRecognizer {
  constructor(
    private config: PrincipalEngineerReviewConfig,
    private knowledgeGraph?: RepositoryKnowledgeGraph
  ) {}

  /**
   * Analyze code structure and recognize design patterns
   */
  async analyzePatterns(
    filePaths: string[],
    codeContent: Map<string, string>
  ): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];
    
    // Parse code structure
    const codeStructure = await this.parseCodeStructure(filePaths, codeContent);
    
    // Recognize each pattern type
    patterns.push(...await this.recognizeSingletonPattern(codeStructure));
    patterns.push(...await this.recognizeFactoryPattern(codeStructure));
    patterns.push(...await this.recognizeObserverPattern(codeStructure));
    patterns.push(...await this.recognizeStrategyPattern(codeStructure));
    patterns.push(...await this.recognizeDecoratorPattern(codeStructure));
    patterns.push(...await this.recognizeAdapterPattern(codeStructure));
    patterns.push(...await this.recognizeCommandPattern(codeStructure));
    patterns.push(...await this.recognizeFacadePattern(codeStructure));
    patterns.push(...await this.recognizeBuilderPattern(codeStructure));
    patterns.push(...await this.recognizeTemplateMethodPattern(codeStructure));
    
    return patterns;
  }

  private async parseCodeStructure(
    filePaths: string[],
    codeContent: Map<string, string>
  ): Promise<CodeStructure> {
    const structure: CodeStructure = {
      classes: [],
      interfaces: [],
      methods: [],
      imports: [],
      complexity: 0,
      lineCount: 0
    };

    for (const filePath of filePaths) {
      const content = codeContent.get(filePath);
      if (!content) continue;

      const lines = content.split('\n');
      structure.lineCount += lines.length;

      // Parse classes
      structure.classes.push(...this.parseClasses(filePath, content));
      
      // Parse interfaces
      structure.interfaces.push(...this.parseInterfaces(filePath, content));
      
      // Parse imports
      structure.imports.push(...this.parseImports(filePath, content));
      
      // Calculate complexity
      structure.complexity += this.calculateComplexity(content);
    }

    // Extract all methods from classes
    structure.classes.forEach(cls => {
      structure.methods.push(...cls.methods);
    });

    return structure;
  }

  private parseClasses(filePath: string, content: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const classMatch = line.match(/^(public|private|protected)?\s*(abstract)?\s*class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+([\w,\s]+))?/);
      
      if (classMatch) {
        const className = classMatch[3];
        const extendsClass = classMatch[5];
        const implementsInterfaces = classMatch[7] ? classMatch[7].split(',').map(i => i.trim()) : [];
        
        const classInfo: ClassInfo = {
          name: className,
          filePath,
          lineNumber: i + 1,
          methods: [],
          fields: [],
          extends: extendsClass,
          implements: implementsInterfaces,
          isAbstract: !!classMatch[2],
          accessModifier: (classMatch[1] as 'public' | 'private' | 'protected') || 'public'
        };

        // Parse methods and fields within the class
        let braceCount = 0;
        let inClass = false;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          
          if (currentLine.includes('{')) {
            braceCount += (currentLine.match(/{/g) || []).length;
            inClass = true;
          }
          if (currentLine.includes('}')) {
            braceCount -= (currentLine.match(/}/g) || []).length;
          }
          
          if (inClass && braceCount > 0) {
            // Parse methods
            const methodMatch = currentLine.match(/^\s*(public|private|protected)?\s*(static)?\s*(abstract)?\s*(async)?\s*(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?/);
            if (methodMatch && !currentLine.includes('class')) {
              const method: MethodInfo = {
                name: methodMatch[5],
                filePath,
                lineNumber: j + 1,
                className,
                parameters: this.parseParameters(currentLine),
                accessModifier: (methodMatch[1] as 'public' | 'private' | 'protected') || 'public',
                isStatic: !!methodMatch[2],
                isAbstract: !!methodMatch[3],
                complexity: 1, // Base complexity
                lineCount: 1
              };
              
              classInfo.methods.push(method);
            }
            
            // Parse fields
            const fieldMatch = currentLine.match(/^\s*(public|private|protected)?\s*(static)?\s*(readonly|final)?\s*(\w+)\s*:\s*(\w+)/);
            if (fieldMatch) {
              const field: FieldInfo = {
                name: fieldMatch[4],
                type: fieldMatch[5],
                accessModifier: (fieldMatch[1] as 'public' | 'private' | 'protected') || 'public',
                isStatic: !!fieldMatch[2],
                isFinal: !!fieldMatch[3]
              };
              
              classInfo.fields.push(field);
            }
          }
          
          if (inClass && braceCount === 0) {
            break;
          }
        }
        
        classes.push(classInfo);
      }
    }

    return classes;
  }

  private parseInterfaces(filePath: string, content: string): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const interfaceMatch = line.match(/^interface\s+(\w+)(\s+extends\s+([\w,\s]+))?/);
      
      if (interfaceMatch) {
        const interfaceName = interfaceMatch[1];
        const extendsInterfaces = interfaceMatch[3] ? interfaceMatch[3].split(',').map(i => i.trim()) : [];
        
        const interfaceInfo: InterfaceInfo = {
          name: interfaceName,
          filePath,
          lineNumber: i + 1,
          methods: [],
          extends: extendsInterfaces
        };

        // Parse method signatures
        let braceCount = 0;
        let inInterface = false;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          
          if (currentLine.includes('{')) {
            braceCount += (currentLine.match(/{/g) || []).length;
            inInterface = true;
          }
          if (currentLine.includes('}')) {
            braceCount -= (currentLine.match(/}/g) || []).length;
          }
          
          if (inInterface && braceCount > 0) {
            const methodMatch = currentLine.match(/^\s*(\w+)\s*\([^)]*\)\s*(?::\s*(\w+))?/);
            if (methodMatch) {
              const method: MethodSignature = {
                name: methodMatch[1],
                parameters: this.parseParameters(currentLine),
                returnType: methodMatch[2]
              };
              
              interfaceInfo.methods.push(method);
            }
          }
          
          if (inInterface && braceCount === 0) {
            break;
          }
        }
        
        interfaces.push(interfaceInfo);
      }
    }

    return interfaces;
  }

  private parseImports(filePath: string, content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    lines.forEach(line => {
      const importMatch = line.match(/^import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const items = importMatch[1] ? importMatch[1].split(',').map(i => i.trim()) : 
                     importMatch[2] ? [importMatch[2]] :
                     importMatch[3] ? [importMatch[3]] : [];
        
        imports.push({
          module: importMatch[4],
          items,
          filePath
        });
      }
    });

    return imports;
  }

  private parseParameters(methodSignature: string): ParameterInfo[] {
    const paramMatch = methodSignature.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1].trim()) return [];

    return paramMatch[1].split(',').map(param => {
      const paramTrim = param.trim();
      const paramParts = paramTrim.split(':');
      return {
        name: paramParts[0]?.trim() || '',
        type: paramParts[1]?.trim()
      };
    }).filter(p => p.name);
  }

  private calculateComplexity(content: string): number {
    // Simple cyclomatic complexity calculation
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcatch\b/g,
      /\bcase\b/g
    ];

    let complexity = 0;
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  private async recognizeSingletonPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    for (const cls of structure.classes) {
      let hasSingletonCharacteristics = 0;
      let hasPrivateConstructor = false;
      let hasStaticInstance = false;
      let hasGetInstanceMethod = false;
      
      // Check for private constructor
      const constructorMethod = cls.methods.find(m => m.name === 'constructor');
      if (constructorMethod && constructorMethod.accessModifier === 'private') {
        hasPrivateConstructor = true;
        hasSingletonCharacteristics++;
      }
      
      // Check for static instance field
      const staticInstanceField = cls.fields.find(f => f.isStatic && f.name.toLowerCase().includes('instance'));
      if (staticInstanceField) {
        hasStaticInstance = true;
        hasSingletonCharacteristics++;
      }
      
      // Check for getInstance method
      const getInstanceMethod = cls.methods.find(m => 
        m.isStatic && 
        (m.name === 'getInstance' || m.name === 'instance')
      );
      if (getInstanceMethod) {
        hasGetInstanceMethod = true;
        hasSingletonCharacteristics++;
      }

      if (hasSingletonCharacteristics >= 2) {
        const implementationQuality = hasSingletonCharacteristics / 3;
        const isCorrect = hasPrivateConstructor && hasGetInstanceMethod;
        
        const improvements: string[] = [];
        if (!hasPrivateConstructor) improvements.push('Add private constructor to prevent direct instantiation');
        if (!hasStaticInstance) improvements.push('Add static instance field');
        if (!hasGetInstanceMethod) improvements.push('Add static getInstance method');
        
        patterns.push({
          patternType: 'singleton',
          implementationQuality,
          correctlyApplied: isCorrect,
          improvements,
          involvedFiles: [cls.filePath]
        });
      }
    }

    return patterns;
  }

  private async recognizeFactoryPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    for (const cls of structure.classes) {
      let hasFactoryCharacteristics = 0;
      const factoryMethods = cls.methods.filter(m => 
        m.name.toLowerCase().includes('create') || 
        m.name.toLowerCase().includes('make') ||
        m.name.toLowerCase().includes('build')
      );
      
      if (factoryMethods.length > 0) {
        hasFactoryCharacteristics++;
      }
      
      // Check if class name suggests factory
      if (cls.name.toLowerCase().includes('factory')) {
        hasFactoryCharacteristics++;
      }
      
      // Check for abstract products (interfaces/classes being created)
      const abstractProducts = structure.interfaces.length + structure.classes.filter(c => c.isAbstract).length;
      if (abstractProducts > 0 && factoryMethods.length > 0) {
        hasFactoryCharacteristics++;
      }

      if (hasFactoryCharacteristics >= 2) {
        const implementationQuality = Math.min(hasFactoryCharacteristics / 3, 1);
        
        patterns.push({
          patternType: 'factory',
          implementationQuality,
          correctlyApplied: factoryMethods.length > 0,
          improvements: factoryMethods.length === 0 ? ['Add factory methods for object creation'] : [],
          involvedFiles: [cls.filePath]
        });
      }
    }

    return patterns;
  }

  private async recognizeObserverPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for observer interface or abstract class
    const observerInterfaces = structure.interfaces.filter(i => 
      i.name.toLowerCase().includes('observer') || 
      i.name.toLowerCase().includes('listener')
    );
    
    const observableClasses = structure.classes.filter(c => {
      const hasObserverList = c.fields.some(f => 
        f.name.toLowerCase().includes('observer') || 
        f.name.toLowerCase().includes('listener')
      );
      
      const hasNotifyMethod = c.methods.some(m => 
        m.name.toLowerCase().includes('notify') || 
        m.name.toLowerCase().includes('update')
      );
      
      const hasSubscribeMethod = c.methods.some(m => 
        m.name.toLowerCase().includes('subscribe') || 
        m.name.toLowerCase().includes('add') ||
        m.name.toLowerCase().includes('register')
      );
      
      return hasObserverList && (hasNotifyMethod || hasSubscribeMethod);
    });

    if (observerInterfaces.length > 0 && observableClasses.length > 0) {
      const implementationQuality = Math.min((observerInterfaces.length + observableClasses.length) / 4, 1);
      
      patterns.push({
        patternType: 'observer',
        implementationQuality,
        correctlyApplied: true,
        improvements: [],
        involvedFiles: [
          ...observerInterfaces.map(i => i.filePath),
          ...observableClasses.map(c => c.filePath)
        ]
      });
    }

    return patterns;
  }

  private async recognizeStrategyPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for strategy interface
    const strategyInterfaces = structure.interfaces.filter(i => 
      i.name.toLowerCase().includes('strategy') ||
      i.methods.some(m => m.name.toLowerCase().includes('execute') || m.name.toLowerCase().includes('apply'))
    );
    
    if (strategyInterfaces.length > 0) {
      // Look for concrete strategy implementations
      const concreteStrategies = structure.classes.filter(c => 
        c.implements.some(impl => strategyInterfaces.some(si => si.name === impl))
      );
      
      // Look for context class
      const contextClasses = structure.classes.filter(c => 
        c.fields.some(f => strategyInterfaces.some(si => f.type === si.name))
      );

      if (concreteStrategies.length > 1 && contextClasses.length > 0) {
        const implementationQuality = Math.min((concreteStrategies.length + contextClasses.length) / 4, 1);
        
        patterns.push({
          patternType: 'strategy',
          implementationQuality,
          correctlyApplied: true,
          improvements: concreteStrategies.length < 2 ? ['Add more concrete strategy implementations'] : [],
          involvedFiles: [
            ...strategyInterfaces.map(i => i.filePath),
            ...concreteStrategies.map(c => c.filePath),
            ...contextClasses.map(c => c.filePath)
          ]
        });
      }
    }

    return patterns;
  }

  private async recognizeDecoratorPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for component interface/abstract class
    const componentInterfaces = structure.interfaces.filter(i => 
      structure.classes.some(c => c.implements.includes(i.name))
    );

    for (const componentInterface of componentInterfaces) {
      // Look for decorator classes
      const decoratorClasses = structure.classes.filter(c => {
        const implementsComponent = c.implements.includes(componentInterface.name);
        const hasComponentField = c.fields.some(f => f.type === componentInterface.name);
        const wrapsComponent = c.methods.length > 0 && hasComponentField;
        
        return implementsComponent && hasComponentField && wrapsComponent;
      });

      if (decoratorClasses.length > 0) {
        const implementationQuality = Math.min(decoratorClasses.length / 2, 1);
        
        patterns.push({
          patternType: 'decorator',
          implementationQuality,
          correctlyApplied: true,
          improvements: [],
          involvedFiles: [
            componentInterface.filePath,
            ...decoratorClasses.map(c => c.filePath)
          ]
        });
      }
    }

    return patterns;
  }

  private async recognizeAdapterPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for adapter classes (classes that implement an interface and wrap another class)
    const adapterClasses = structure.classes.filter(c => {
      const implementsInterface = c.implements.length > 0;
      const hasAdapteeField = c.fields.some(f => 
        structure.classes.some(otherClass => otherClass.name === f.type && otherClass !== c)
      );
      const nameIndicatesAdapter = c.name.toLowerCase().includes('adapter') || c.name.toLowerCase().includes('wrapper');
      
      return (implementsInterface && hasAdapteeField) || nameIndicatesAdapter;
    });

    if (adapterClasses.length > 0) {
      patterns.push({
        patternType: 'adapter',
        implementationQuality: 0.8,
        correctlyApplied: true,
        improvements: [],
        involvedFiles: adapterClasses.map(c => c.filePath)
      });
    }

    return patterns;
  }

  private async recognizeCommandPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for command interface with execute method
    const commandInterfaces = structure.interfaces.filter(i => 
      i.methods.some(m => m.name.toLowerCase().includes('execute'))
    );

    if (commandInterfaces.length > 0) {
      // Look for concrete command implementations
      const concreteCommands = structure.classes.filter(c => 
        c.implements.some(impl => commandInterfaces.some(ci => ci.name === impl))
      );

      // Look for invoker classes
      const invokerClasses = structure.classes.filter(c => 
        c.fields.some(f => commandInterfaces.some(ci => f.type === ci.name)) ||
        c.methods.some(m => m.name.toLowerCase().includes('execute'))
      );

      if (concreteCommands.length > 0 && invokerClasses.length > 0) {
        patterns.push({
          patternType: 'command',
          implementationQuality: 0.9,
          correctlyApplied: true,
          improvements: [],
          involvedFiles: [
            ...commandInterfaces.map(i => i.filePath),
            ...concreteCommands.map(c => c.filePath),
            ...invokerClasses.map(c => c.filePath)
          ]
        });
      }
    }

    return patterns;
  }

  private async recognizeFacadePattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for facade classes (classes that coordinate multiple subsystem classes)
    const facadeClasses = structure.classes.filter(c => {
      const nameIndicatesFacade = c.name.toLowerCase().includes('facade') || 
                                  c.name.toLowerCase().includes('service');
      
      const coordinatesMultipleClasses = c.fields.length > 2 || 
                                        c.methods.some(m => m.complexity > 3);
      
      return nameIndicatesFacade || coordinatesMultipleClasses;
    });

    if (facadeClasses.length > 0) {
      patterns.push({
        patternType: 'facade',
        implementationQuality: 0.7,
        correctlyApplied: true,
        improvements: [],
        involvedFiles: facadeClasses.map(c => c.filePath)
      });
    }

    return patterns;
  }

  private async recognizeBuilderPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for builder classes
    const builderClasses = structure.classes.filter(c => {
      const nameIndicatesBuilder = c.name.toLowerCase().includes('builder');
      
      const hasBuildMethod = c.methods.some(m => m.name.toLowerCase().includes('build'));
      
      const hasFluentInterface = c.methods.filter(m => 
        m.returnType === c.name || !m.returnType
      ).length > 2;
      
      return nameIndicatesBuilder || (hasBuildMethod && hasFluentInterface);
    });

    if (builderClasses.length > 0) {
      patterns.push({
        patternType: 'builder',
        implementationQuality: 0.8,
        correctlyApplied: true,
        improvements: [],
        involvedFiles: builderClasses.map(c => c.filePath)
      });
    }

    return patterns;
  }

  private async recognizeTemplateMethodPattern(structure: CodeStructure): Promise<DesignPatternRecognition[]> {
    const patterns: DesignPatternRecognition[] = [];

    // Look for abstract classes with template methods
    const abstractClasses = structure.classes.filter(c => c.isAbstract);

    for (const abstractClass of abstractClasses) {
      const hasTemplateMethod = abstractClass.methods.some(m => 
        !m.isAbstract && m.accessModifier === 'public'
      );
      
      const hasAbstractMethods = abstractClass.methods.some(m => m.isAbstract);
      
      if (hasTemplateMethod && hasAbstractMethods) {
        // Look for concrete implementations
        const concreteClasses = structure.classes.filter(c => c.extends === abstractClass.name);
        
        if (concreteClasses.length > 0) {
          patterns.push({
            patternType: 'template_method',
            implementationQuality: 0.9,
            correctlyApplied: true,
            improvements: [],
            involvedFiles: [
              abstractClass.filePath,
              ...concreteClasses.map(c => c.filePath)
            ]
          });
        }
      }
    }

    return patterns;
  }
}

/**
 * Anti-Pattern Detection Engine
 */
export class AntiPatternDetector {
  constructor(
    private config: PrincipalEngineerReviewConfig,
    private knowledgeGraph?: RepositoryKnowledgeGraph
  ) {}

  /**
   * Detect anti-patterns in the codebase
   */
  async detectAntiPatterns(
    filePaths: string[],
    codeContent: Map<string, string>
  ): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    
    // Parse code structure for analysis
    const patternRecognizer = new DesignPatternRecognizer(this.config, this.knowledgeGraph);
    const codeStructure = await (patternRecognizer as any).parseCodeStructure(filePaths, codeContent);
    
    // Detect different anti-patterns
    antiPatterns.push(...await this.detectGodObject(codeStructure));
    antiPatterns.push(...await this.detectSpaghettiCode(codeStructure, codeContent));
    antiPatterns.push(...await this.detectCopyPasteCode(codeContent));
    antiPatterns.push(...await this.detectMagicNumbers(codeContent));
    antiPatterns.push(...await this.detectDeadCode(codeStructure, codeContent));
    antiPatterns.push(...await this.detectShotgunSurgery(codeStructure));
    antiPatterns.push(...await this.detectFeatureEnvy(codeStructure, codeContent));
    
    return antiPatterns;
  }

  private async detectGodObject(structure: CodeStructure): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    
    const godClasses = structure.classes.filter(cls => 
      cls.methods.length > 20 || 
      cls.fields.length > 15 || 
      cls.methods.reduce((sum, m) => sum + m.lineCount, 0) > 500
    );

    for (const godClass of godClasses) {
      const totalLines = godClass.methods.reduce((sum, m) => sum + m.lineCount, 0);
      const severity: ReviewSeverity = totalLines > 1000 ? 'critical' : totalLines > 500 ? 'error' : 'warning';
      
      antiPatterns.push({
        antiPatternType: 'god_object',
        severity,
        impact: {
          maintainability: 0.3,
          testability: 0.4,
          performance: 0.7,
          reliability: 0.6
        },
        refactoringSuggestions: [
          'Break down the class using Single Responsibility Principle',
          'Extract related methods into separate classes',
          'Use composition instead of having everything in one class',
          'Consider using facade pattern if this is coordinating multiple concerns'
        ],
        affectedFiles: [godClass.filePath]
      });
    }

    return antiPatterns;
  }

  private async detectSpaghettiCode(
    structure: CodeStructure,
    codeContent: Map<string, string>
  ): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    
    // High complexity methods with low cohesion
    const complexMethods = structure.methods.filter(method => method.complexity > 15);
    
    for (const method of complexMethods) {
      const filePath = method.filePath;
      const content = codeContent.get(filePath);
      if (!content) continue;
      
      // Simple heuristic: count nested control structures
      const lines = content.split('\n');
      let nestedLevel = 0;
      let maxNesting = 0;
      let inMethod = false;
      
      for (const line of lines) {
        if (line.includes(method.name) && line.includes('(')) {
          inMethod = true;
          continue;
        }
        
        if (inMethod) {
          if (line.includes('{')) nestedLevel++;
          if (line.includes('}')) {
            nestedLevel--;
            if (nestedLevel === 0) break;
          }
          maxNesting = Math.max(maxNesting, nestedLevel);
        }
      }
      
      if (maxNesting > 4) {
        antiPatterns.push({
          antiPatternType: 'spaghetti_code',
          severity: 'warning',
          impact: {
            maintainability: 0.4,
            testability: 0.3,
            performance: 0.8,
            reliability: 0.5
          },
          refactoringSuggestions: [
            'Break down complex methods into smaller functions',
            'Use early returns to reduce nesting',
            'Extract conditional logic into separate methods',
            'Consider using strategy pattern for complex branching'
          ],
          affectedFiles: [filePath]
        });
      }
    }

    return antiPatterns;
  }

  private async detectCopyPasteCode(codeContent: Map<string, string>): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    const codeBlocks = new Map<string, { files: string[], count: number }>();
    
    // Simple duplicate detection by comparing normalized lines
    for (const [filePath, content] of codeContent) {
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 20 && !line.startsWith('//') && !line.startsWith('*'));
      
      // Check for blocks of 3+ similar lines
      for (let i = 0; i < lines.length - 2; i++) {
        const block = lines.slice(i, i + 3).join('\n');
        const normalizedBlock = block.replace(/\s+/g, ' ').toLowerCase();
        
        if (!codeBlocks.has(normalizedBlock)) {
          codeBlocks.set(normalizedBlock, { files: [], count: 0 });
        }
        
        const blockInfo = codeBlocks.get(normalizedBlock)!;
        if (!blockInfo.files.includes(filePath)) {
          blockInfo.files.push(filePath);
        }
        blockInfo.count++;
      }
    }
    
    // Find blocks that appear in multiple files or multiple times
    for (const [block, info] of codeBlocks) {
      if (info.files.length > 1 || info.count > 3) {
        antiPatterns.push({
          antiPatternType: 'copy_paste',
          severity: info.files.length > 2 ? 'error' : 'warning',
          impact: {
            maintainability: 0.3,
            testability: 0.7,
            performance: 0.9,
            reliability: 0.6
          },
          refactoringSuggestions: [
            'Extract duplicate code into a shared function or method',
            'Create a utility class for common operations',
            'Use inheritance or composition to share common behavior',
            'Consider using template method pattern for similar algorithms'
          ],
          affectedFiles: info.files
        });
      }
    }

    return antiPatterns;
  }

  private async detectMagicNumbers(codeContent: Map<string, string>): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    const magicNumberFiles: string[] = [];
    
    for (const [filePath, content] of codeContent) {
      const magicNumbers = content.match(/(?<![a-zA-Z_])\b(?!0|1|2|10|100|1000)\d{3,}\b/g);
      
      if (magicNumbers && magicNumbers.length > 2) {
        magicNumberFiles.push(filePath);
      }
    }
    
    if (magicNumberFiles.length > 0) {
      antiPatterns.push({
        antiPatternType: 'magic_numbers',
        severity: 'warning',
        impact: {
          maintainability: 0.5,
          testability: 0.8,
          performance: 1.0,
          reliability: 0.7
        },
        refactoringSuggestions: [
          'Replace magic numbers with named constants',
          'Use configuration files for configurable values',
          'Define constants in a dedicated constants file',
          'Use enums for related constant values'
        ],
        affectedFiles: magicNumberFiles
      });
    }

    return antiPatterns;
  }

  private async detectDeadCode(
    structure: CodeStructure,
    codeContent: Map<string, string>
  ): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    const allMethodNames = new Set(structure.methods.map(m => m.name));
    const calledMethods = new Set<string>();
    
    // Simple dead code detection - find methods that are never called
    for (const [filePath, content] of codeContent) {
      for (const methodName of allMethodNames) {
        if (content.includes(`${methodName}(`) && !content.includes(`function ${methodName}`) && !content.includes(`${methodName} =`)) {
          calledMethods.add(methodName);
        }
      }
    }
    
    const deadMethods = structure.methods.filter(m => 
      !calledMethods.has(m.name) && 
      m.name !== 'constructor' && 
      m.name !== 'main' &&
      m.accessModifier === 'private'
    );
    
    if (deadMethods.length > 0) {
      const affectedFiles = [...new Set(deadMethods.map(m => m.filePath))];
      
      antiPatterns.push({
        antiPatternType: 'dead_code',
        severity: 'info',
        impact: {
          maintainability: 0.7,
          testability: 0.8,
          performance: 0.9,
          reliability: 0.9
        },
        refactoringSuggestions: [
          'Remove unused private methods',
          'Use static analysis tools to identify dead code',
          'Regularly review and clean up unused code',
          'Consider if methods should be protected instead of private'
        ],
        affectedFiles
      });
    }

    return antiPatterns;
  }

  private async detectShotgunSurgery(structure: CodeStructure): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    
    // Find methods that are very similar across different classes
    const methodSignatures = new Map<string, string[]>();
    
    structure.methods.forEach(method => {
      const signature = `${method.name}(${method.parameters.map(p => p.type || 'any').join(', ')})`;
      if (!methodSignatures.has(signature)) {
        methodSignatures.set(signature, []);
      }
      methodSignatures.get(signature)!.push(method.className || 'unknown');
    });
    
    // Find signatures that appear in many classes
    const widespreadMethods = Array.from(methodSignatures.entries())
      .filter(([signature, classes]) => new Set(classes).size > 3);
    
    if (widespreadMethods.length > 2) {
      const affectedFiles = [...new Set(
        structure.classes
          .filter(cls => widespreadMethods.some(([sig, classes]) => classes.includes(cls.name)))
          .map(cls => cls.filePath)
      )];
      
      antiPatterns.push({
        antiPatternType: 'shotgun_surgery',
        severity: 'warning',
        impact: {
          maintainability: 0.4,
          testability: 0.6,
          performance: 0.8,
          reliability: 0.5
        },
        refactoringSuggestions: [
          'Extract common behavior into a base class or interface',
          'Use composition instead of duplicating methods',
          'Create utility classes for shared functionality',
          'Consider using mixins or traits for cross-cutting concerns'
        ],
        affectedFiles
      });
    }

    return antiPatterns;
  }

  private async detectFeatureEnvy(
    structure: CodeStructure,
    codeContent: Map<string, string>
  ): Promise<AntiPatternDetection[]> {
    const antiPatterns: AntiPatternDetection[] = [];
    const envyMethods: { method: MethodInfo, externalCalls: number, ownCalls: number }[] = [];
    
    for (const method of structure.methods) {
      const content = codeContent.get(method.filePath);
      if (!content) continue;
      
      const lines = content.split('\n');
      const methodLines = lines.slice(method.lineNumber - 1, method.lineNumber + method.lineCount);
      const methodContent = methodLines.join('\n');
      
      const externalCalls = (methodContent.match(/\w+\.\w+\(/g) || []).length;
      const ownCalls = (methodContent.match(/this\.\w+\(/g) || []).length;
      
      if (externalCalls > 3 && externalCalls > ownCalls * 2) {
        envyMethods.push({ method, externalCalls, ownCalls });
      }
    }
    
    if (envyMethods.length > 0) {
      const affectedFiles = [...new Set(envyMethods.map(em => em.method.filePath))];
      
      antiPatterns.push({
        antiPatternType: 'feature_envy',
        severity: 'info',
        impact: {
          maintainability: 0.6,
          testability: 0.7,
          performance: 0.8,
          reliability: 0.8
        },
        refactoringSuggestions: [
          'Move methods closer to the data they operate on',
          'Consider if the method belongs in the other class',
          'Use dependency injection to reduce coupling',
          'Extract interface to define contracts between classes'
        ],
        affectedFiles
      });
    }

    return antiPatterns;
  }
}

/**
 * SOLID Principles Validator
 */
export class SolidPrinciplesValidator {
  constructor(
    private config: PrincipalEngineerReviewConfig,
    private knowledgeGraph?: RepositoryKnowledgeGraph
  ) {}

  /**
   * Validate SOLID principles compliance
   */
  async validateSolidPrinciples(
    filePaths: string[],
    codeContent: Map<string, string>
  ): Promise<SolidPrinciplesValidation> {
    // Parse code structure for analysis
    const patternRecognizer = new DesignPatternRecognizer(this.config, this.knowledgeGraph);
    const codeStructure = await (patternRecognizer as any).parseCodeStructure(filePaths, codeContent);
    
    // Validate each SOLID principle
    const singleResponsibility = await this.validateSingleResponsibility(codeStructure);
    const openClosed = await this.validateOpenClosed(codeStructure);
    const liskovSubstitution = await this.validateLiskovSubstitution(codeStructure);
    const interfaceSegregation = await this.validateInterfaceSegregation(codeStructure);
    const dependencyInversion = await this.validateDependencyInversion(codeStructure, codeContent);
    
    // Calculate overall score
    const principles = [singleResponsibility, openClosed, liskovSubstitution, interfaceSegregation, dependencyInversion];
    const compliantCount = principles.filter(p => p.compliant).length;
    const overallScore = compliantCount / principles.length;
    
    return {
      singleResponsibility,
      openClosed,
      liskovSubstitution,
      interfaceSegregation,
      dependencyInversion,
      overallScore
    };
  }

  private async validateSingleResponsibility(structure: CodeStructure) {
    const violations: string[] = [];
    const suggestions: string[] = [];
    
    // Check for classes with too many responsibilities (heuristic: too many methods or mixed concerns)
    const violatingClasses = structure.classes.filter(cls => {
      const methodCount = cls.methods.length;
      const fieldCount = cls.fields.length;
      
      // Simple heuristic: classes with many methods and fields likely have multiple responsibilities
      return methodCount > 15 || fieldCount > 10;
    });
    
    violatingClasses.forEach(cls => {
      violations.push(`Class ${cls.name} appears to have multiple responsibilities (${cls.methods.length} methods, ${cls.fields.length} fields)`);
      suggestions.push(`Consider breaking down ${cls.name} into smaller, more focused classes`);
    });
    
    return {
      compliant: violations.length === 0,
      violations,
      suggestions: suggestions.length === 0 ? ['Classes follow Single Responsibility Principle well'] : suggestions
    };
  }

  private async validateOpenClosed(structure: CodeStructure) {
    const violations: string[] = [];
    const suggestions: string[] = [];
    
    // Check for classes that might benefit from being open for extension
    const concreteClasses = structure.classes.filter(cls => 
      !cls.isAbstract && 
      cls.methods.some(m => m.accessModifier === 'public') &&
      !structure.classes.some(other => other.extends === cls.name)
    );
    
    // Look for switch statements or long if-else chains that might indicate violation
    structure.methods.forEach(method => {
      if (method.complexity > 10) {
        violations.push(`Method ${method.name} has high complexity, might benefit from polymorphism`);
        suggestions.push(`Consider using Strategy or State pattern in ${method.name} to make it open for extension`);
      }
    });
    
    return {
      compliant: violations.length < structure.classes.length * 0.2, // Allow some violations
      violations,
      suggestions: suggestions.length === 0 ? ['Code structure supports extension well'] : suggestions
    };
  }

  private async validateLiskovSubstitution(structure: CodeStructure) {
    const violations: string[] = [];
    const suggestions: string[] = [];
    
    // Check inheritance hierarchies
    const inheritanceChains = structure.classes.filter(cls => cls.extends);
    
    inheritanceChains.forEach(subClass => {
      const superClass = structure.classes.find(cls => cls.name === subClass.extends);
      if (superClass) {
        // Simple check: subclass should not have more restrictive access modifiers
        subClass.methods.forEach(subMethod => {
          const superMethod = superClass.methods.find(m => m.name === subMethod.name);
          if (superMethod) {
            const accessLevels = { 'public': 3, 'protected': 2, 'private': 1 };
            if (accessLevels[subMethod.accessModifier] < accessLevels[superMethod.accessModifier]) {
              violations.push(`Method ${subMethod.name} in ${subClass.name} has more restrictive access than in ${superClass.name}`);
              suggestions.push(`Make ${subMethod.name} in ${subClass.name} at least ${superMethod.accessModifier}`);
            }
          }
        });
      }
    });
    
    return {
      compliant: violations.length === 0,
      violations,
      suggestions: suggestions.length === 0 ? ['Inheritance hierarchies respect substitutability'] : suggestions
    };
  }

  private async validateInterfaceSegregation(structure: CodeStructure) {
    const violations: string[] = [];
    const suggestions: string[] = [];
    
    // Check for fat interfaces (interfaces with too many methods)
    const fatInterfaces = structure.interfaces.filter(iface => iface.methods.length > 10);
    
    fatInterfaces.forEach(iface => {
      violations.push(`Interface ${iface.name} has ${iface.methods.length} methods, might be too broad`);
      suggestions.push(`Consider splitting ${iface.name} into smaller, more focused interfaces`);
    });
    
    // Check for classes implementing many interfaces
    const busyClasses = structure.classes.filter(cls => cls.implements.length > 5);
    
    busyClasses.forEach(cls => {
      violations.push(`Class ${cls.name} implements ${cls.implements.length} interfaces, might indicate interface segregation issues`);
      suggestions.push(`Review if ${cls.name} really needs to implement all ${cls.implements.length} interfaces`);
    });
    
    return {
      compliant: violations.length === 0,
      violations,
      suggestions: suggestions.length === 0 ? ['Interfaces are well-segregated'] : suggestions
    };
  }

  private async validateDependencyInversion(structure: CodeStructure, codeContent: Map<string, string>) {
    const violations: string[] = [];
    const suggestions: string[] = [];
    
    // Check for direct instantiation of concrete classes (should depend on abstractions)
    for (const [filePath, content] of codeContent) {
      const concreteInstantiations = content.match(/new\s+[A-Z]\w+\(/g);
      if (concreteInstantiations && concreteInstantiations.length > 3) {
        violations.push(`File ${filePath} has many direct instantiations, consider dependency injection`);
        suggestions.push(`Use dependency injection or factory pattern in ${filePath}`);
      }
    }
    
    // Check for high-level modules depending on low-level modules
    structure.classes.forEach(cls => {
      const utilityDependencies = cls.fields.filter(field => 
        field.type?.toLowerCase().includes('util') || 
        field.type?.toLowerCase().includes('helper')
      );
      
      if (utilityDependencies.length > 2) {
        violations.push(`Class ${cls.name} depends on many utility classes directly`);
        suggestions.push(`Abstract utility dependencies behind interfaces in ${cls.name}`);
      }
    });
    
    return {
      compliant: violations.length < structure.classes.length * 0.3, // Allow some violations
      violations,
      suggestions: suggestions.length === 0 ? ['Dependencies are well-inverted'] : suggestions
    };
  }
}