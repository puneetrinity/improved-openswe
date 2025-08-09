/**
 * Role-Based Access Control (RBAC) Permission Manager
 * 
 * Provides fine-grained permission management with role inheritance,
 * conditional access, and performance-optimized permission checking.
 */

import { 
  IPermissionManager,
  ContextStoreOperationResult
} from './context-store-interfaces.js';
import {
  AccessPermission,
  Permission,
  AccessCondition
} from './context-store-types.js';
import { AgentProfile, AgentRole } from './types.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Permission cache entry for performance optimization
 */
interface PermissionCacheEntry {
  /**
   * Permission result
   */
  result: boolean;
  
  /**
   * Cache timestamp
   */
  timestamp: number;
  
  /**
   * Cache TTL
   */
  ttl: number;
  
  /**
   * Conditions evaluated for this result
   */
  conditions?: Record<string, unknown>;
}

/**
 * Role hierarchy definition for permission inheritance
 */
interface RoleHierarchy {
  /**
   * Parent roles (inherit permissions from these)
   */
  parents: AgentRole[];
  
  /**
   * Child roles (these roles inherit from this one)
   */
  children: AgentRole[];
  
  /**
   * Role priority level (higher values override lower)
   */
  priority: number;
  
  /**
   * Default permissions for this role
   */
  defaultPermissions: Permission[];
}

/**
 * Permission evaluation context
 */
interface PermissionContext {
  /**
   * Agent requesting access
   */
  agent: AgentProfile;
  
  /**
   * Context entry being accessed
   */
  entryId: string;
  
  /**
   * Operation being performed
   */
  operation: Permission;
  
  /**
   * Additional context data
   */
  data?: Record<string, unknown>;
  
  /**
   * Current timestamp
   */
  timestamp: number;
}

/**
 * RBAC Permission Manager implementation with advanced features
 */
export class PermissionManager implements IPermissionManager {
  private readonly logger = createLogger(LogLevel.INFO, 'PermissionManager');
  
  /**
   * Permission cache for performance optimization
   */
  private readonly permissionCache = new Map<string, PermissionCacheEntry>();
  
  /**
   * Entry permissions storage
   */
  private readonly entryPermissions = new Map<string, AccessPermission[]>();
  
  /**
   * Role hierarchy configuration
   */
  private readonly roleHierarchy = new Map<AgentRole, RoleHierarchy>();
  
  /**
   * Default cache TTL in milliseconds
   */
  private readonly defaultCacheTtl = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Agent profiles for role resolution
   */
  private readonly agentProfiles = new Map<string, AgentProfile>();

  constructor() {
    this.initializeRoleHierarchy();
    this.setupCacheCleanup();
    
    this.logger.info('PermissionManager initialized');
  }

  /**
   * Check if an agent has a specific permission for a context entry
   */
  async checkPermission(
    agentId: string,
    entryId: string,
    permission: Permission,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(agentId, entryId, permission);
      const cached = this.getCachedPermission(cacheKey);
      if (cached !== null) {
        this.logger.debug('Permission check from cache', {
          agentId,
          entryId,
          permission,
          result: cached,
          executionTime: Date.now() - startTime
        });
        return cached;
      }

      // Get agent profile
      const agentProfile = await this.getAgentProfile(agentId);
      if (!agentProfile) {
        this.logger.warn('Agent profile not found', { agentId });
        return false;
      }

      // Get entry permissions
      const permissions = this.entryPermissions.get(entryId) || [];
      
      // Create evaluation context
      const evaluationContext: PermissionContext = {
        agent: agentProfile,
        entryId,
        operation: permission,
        data: context,
        timestamp: Date.now()
      };

      // Evaluate permissions
      const result = await this.evaluatePermissions(permissions, evaluationContext);
      
      // Cache the result
      this.cachePermission(agentId, entryId, permission, result);
      
      this.logger.debug('Permission check completed', {
        agentId,
        entryId,
        permission,
        result,
        executionTime: Date.now() - startTime
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Permission check failed', {
        agentId,
        entryId,
        permission,
        error: error instanceof Error ? error.message : error,
        executionTime: Date.now() - startTime
      });
      
      // Fail securely - deny access on error
      return false;
    }
  }

  /**
   * Get all permissions for an agent on a context entry
   */
  async getPermissions(agentId: string, entryId: string): Promise<Permission[]> {
    const agentProfile = await this.getAgentProfile(agentId);
    if (!agentProfile) {
      return [];
    }

    const permissions = this.entryPermissions.get(entryId) || [];
    const grantedPermissions: Permission[] = [];

    for (const perm of ['read', 'write', 'delete', 'execute', 'admin'] as Permission[]) {
      const evaluationContext: PermissionContext = {
        agent: agentProfile,
        entryId,
        operation: perm,
        timestamp: Date.now()
      };

      if (await this.evaluatePermissions(permissions, evaluationContext)) {
        grantedPermissions.push(perm);
      }
    }

    return grantedPermissions;
  }

  /**
   * Set permissions for a context entry
   */
  async setPermissions(entryId: string, permissions: AccessPermission[]): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      // Validate permissions
      const validationResult = this.validatePermissions(permissions);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error,
          executionTime: Date.now() - startTime
        };
      }

      // Store permissions
      this.entryPermissions.set(entryId, [...permissions]);
      
      // Clear cache for this entry
      this.clearCacheForEntry(entryId);
      
      this.logger.info('Permissions set for entry', {
        entryId,
        permissionCount: permissions.length,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        executionTime: Date.now() - startTime,
        metadata: { entryId, permissionCount: permissions.length }
      };
      
    } catch (error) {
      this.logger.error('Failed to set permissions', {
        entryId,
        error: error instanceof Error ? error.message : error,
        executionTime: Date.now() - startTime
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Add a permission to a context entry
   */
  async addPermission(entryId: string, permission: AccessPermission): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      const currentPermissions = this.entryPermissions.get(entryId) || [];
      currentPermissions.push(permission);
      
      return await this.setPermissions(entryId, currentPermissions);
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Remove a permission from a context entry
   */
  async removePermission(entryId: string, permissionId: string): Promise<ContextStoreOperationResult> {
    const startTime = Date.now();
    
    try {
      const currentPermissions = this.entryPermissions.get(entryId) || [];
      const updatedPermissions = currentPermissions.filter(p => 
        JSON.stringify(p) !== permissionId // Simple ID matching, could be improved
      );
      
      return await this.setPermissions(entryId, updatedPermissions);
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get effective permissions considering role inheritance
   */
  async getEffectivePermissions(agentProfile: AgentProfile, entryId: string): Promise<Permission[]> {
    const permissions = this.entryPermissions.get(entryId) || [];
    const effectivePermissions = new Set<Permission>();

    // Get role hierarchy
    const roleChain = this.getRoleHierarchyChain(agentProfile.role);
    
    // Evaluate permissions for each role in the hierarchy
    for (const role of roleChain) {
      const roleHierarchy = this.roleHierarchy.get(role);
      if (roleHierarchy) {
        roleHierarchy.defaultPermissions.forEach(p => effectivePermissions.add(p));
      }
    }

    // Evaluate specific permissions for this entry
    for (const permission of permissions) {
      if (await this.matchesPermission(permission, agentProfile)) {
        effectivePermissions.add(permission.permission);
      }
    }

    return Array.from(effectivePermissions);
  }

  /**
   * Validate permission configuration
   */
  validatePermissions(permissions: AccessPermission[]): ContextStoreOperationResult<boolean> {
    try {
      for (const permission of permissions) {
        // Validate permission type
        if (!['read', 'write', 'delete', 'execute', 'admin'].includes(permission.permission)) {
          return {
            success: false,
            error: `Invalid permission type: ${permission.permission}`,
            executionTime: 0
          };
        }

        // Validate roles
        for (const role of permission.roles) {
          if (!this.isValidRole(role)) {
            return {
              success: false,
              error: `Invalid role: ${role}`,
              executionTime: 0
            };
          }
        }

        // Validate conditions
        if (permission.conditions) {
          for (const condition of permission.conditions) {
            if (!this.isValidCondition(condition)) {
              return {
                success: false,
                error: `Invalid condition: ${JSON.stringify(condition)}`,
                executionTime: 0
              };
            }
          }
        }

        // Validate expiration
        if (permission.expiresAt && permission.expiresAt <= Date.now()) {
          return {
            success: false,
            error: 'Permission has expired',
            executionTime: 0
          };
        }
      }

      return {
        success: true,
        data: true,
        executionTime: 0
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        executionTime: 0
      };
    }
  }

  /**
   * Cache permission results for performance
   */
  cachePermission(agentId: string, entryId: string, permission: Permission, result: boolean): void {
    const cacheKey = this.getCacheKey(agentId, entryId, permission);
    this.permissionCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.defaultCacheTtl
    });
  }

  /**
   * Clear permission cache
   */
  clearCache(agentId?: string, entryId?: string): void {
    if (!agentId && !entryId) {
      this.permissionCache.clear();
      this.logger.info('Permission cache cleared completely');
      return;
    }

    const keysToDelete: string[] = [];
    
    for (const key of this.permissionCache.keys()) {
      if (agentId && key.includes(agentId)) {
        keysToDelete.push(key);
      } else if (entryId && key.includes(entryId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.permissionCache.delete(key));
    
    this.logger.info('Permission cache cleared', {
      agentId,
      entryId,
      clearedKeys: keysToDelete.length
    });
  }

  /**
   * Register an agent profile for permission evaluation
   */
  registerAgentProfile(agentProfile: AgentProfile): void {
    this.agentProfiles.set(agentProfile.id, agentProfile);
    this.clearCache(agentProfile.id);
  }

  /**
   * Update role hierarchy configuration
   */
  updateRoleHierarchy(role: AgentRole, hierarchy: RoleHierarchy): void {
    this.roleHierarchy.set(role, hierarchy);
    this.clearCache(); // Clear all cache as hierarchy affects all permissions
  }

  /**
   * Get permission statistics
   */
  getStatistics(): Record<string, unknown> {
    return {
      cacheSize: this.permissionCache.size,
      entryCount: this.entryPermissions.size,
      agentCount: this.agentProfiles.size,
      roleHierarchySize: this.roleHierarchy.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Evaluate permissions against an evaluation context
   */
  private async evaluatePermissions(
    permissions: AccessPermission[],
    context: PermissionContext
  ): Promise<boolean> {
    // Admin always has access
    if (await this.hasRolePermission(context.agent, 'admin')) {
      return true;
    }

    // Check each permission
    for (const permission of permissions) {
      if (await this.matchesPermission(permission, context.agent) && 
          permission.permission === context.operation) {
        
        // Check conditions if present
        if (permission.conditions && permission.conditions.length > 0) {
          const conditionResults = await Promise.all(
            permission.conditions.map(condition => this.evaluateCondition(condition, context))
          );
          
          // All conditions must be true
          if (conditionResults.every(result => result)) {
            return true;
          }
        } else {
          return true;
        }
      }
    }

    // Check role hierarchy permissions
    return await this.hasRolePermission(context.agent, context.operation);
  }

  /**
   * Check if an agent matches a permission rule
   */
  private async matchesPermission(permission: AccessPermission, agent: AgentProfile): Promise<boolean> {
    // Check expiration
    if (permission.expiresAt && permission.expiresAt <= Date.now()) {
      return false;
    }

    // Check specific agent IDs first (highest priority)
    if (permission.agentIds && permission.agentIds.includes(agent.id)) {
      return true;
    }

    // Check roles
    const agentRoles = this.getRoleHierarchyChain(agent.role);
    return permission.roles.some(role => agentRoles.includes(role));
  }

  /**
   * Evaluate an access condition
   */
  private async evaluateCondition(condition: AccessCondition, context: PermissionContext): Promise<boolean> {
    try {
      let result = false;
      
      switch (condition.type) {
        case 'time_range':
          result = this.evaluateTimeRangeCondition(condition, context.timestamp);
          break;
          
        case 'context_state':
          result = this.evaluateContextStateCondition(condition, context.data || {});
          break;
          
        case 'task_status':
          result = this.evaluateTaskStatusCondition(condition, context.data || {});
          break;
          
        case 'agent_status':
          result = this.evaluateAgentStatusCondition(condition, context.agent);
          break;
          
        case 'custom':
          result = await this.evaluateCustomCondition(condition, context);
          break;
          
        default:
          this.logger.warn('Unknown condition type', { type: condition.type });
          result = false;
      }
      
      return condition.expectedValue ? result : !result;
      
    } catch (error) {
      this.logger.error('Condition evaluation failed', {
        condition,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Check if agent has role-based permission
   */
  private async hasRolePermission(agent: AgentProfile, permission: Permission): Promise<boolean> {
    const roleChain = this.getRoleHierarchyChain(agent.role);
    
    for (const role of roleChain) {
      const roleHierarchy = this.roleHierarchy.get(role);
      if (roleHierarchy && roleHierarchy.defaultPermissions.includes(permission)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get role hierarchy chain including inherited roles
   */
  private getRoleHierarchyChain(role: AgentRole): AgentRole[] {
    const visited = new Set<AgentRole>();
    const chain: AgentRole[] = [];
    
    const traverse = (currentRole: AgentRole) => {
      if (visited.has(currentRole)) {
        return; // Prevent infinite loops
      }
      
      visited.add(currentRole);
      chain.push(currentRole);
      
      const hierarchy = this.roleHierarchy.get(currentRole);
      if (hierarchy) {
        hierarchy.parents.forEach(parentRole => traverse(parentRole));
      }
    };
    
    traverse(role);
    return chain;
  }

  /**
   * Evaluate time range condition
   */
  private evaluateTimeRangeCondition(condition: AccessCondition, timestamp: number): boolean {
    if (typeof condition.expression !== 'object') {
      return false;
    }
    
    const timeRange = condition.expression as { start?: number; end?: number };
    
    if (timeRange.start && timestamp < timeRange.start) {
      return false;
    }
    
    if (timeRange.end && timestamp > timeRange.end) {
      return false;
    }
    
    return true;
  }

  /**
   * Evaluate context state condition
   */
  private evaluateContextStateCondition(condition: AccessCondition, contextData: Record<string, unknown>): boolean {
    if (typeof condition.expression === 'string') {
      // Simple key existence check
      return condition.expression in contextData;
    }
    
    if (typeof condition.expression === 'object') {
      // Object match check
      const expected = condition.expression as Record<string, unknown>;
      return Object.entries(expected).every(([key, value]) => contextData[key] === value);
    }
    
    return false;
  }

  /**
   * Evaluate task status condition
   */
  private evaluateTaskStatusCondition(condition: AccessCondition, contextData: Record<string, unknown>): boolean {
    const taskStatus = contextData.taskStatus;
    return taskStatus === condition.expression;
  }

  /**
   * Evaluate agent status condition
   */
  private evaluateAgentStatusCondition(condition: AccessCondition, agent: AgentProfile): boolean {
    return agent.status === condition.expression;
  }

  /**
   * Evaluate custom condition (extensible)
   */
  private async evaluateCustomCondition(condition: AccessCondition, context: PermissionContext): Promise<boolean> {
    // This could be extended to support custom JavaScript expressions or external evaluators
    this.logger.warn('Custom condition evaluation not implemented', { condition });
    return false;
  }

  /**
   * Get agent profile
   */
  private async getAgentProfile(agentId: string): Promise<AgentProfile | null> {
    return this.agentProfiles.get(agentId) || null;
  }

  /**
   * Generate cache key for permission
   */
  private getCacheKey(agentId: string, entryId: string, permission: Permission): string {
    return `${agentId}:${entryId}:${permission}`;
  }

  /**
   * Get cached permission result
   */
  private getCachedPermission(cacheKey: string): boolean | null {
    const cached = this.permissionCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.permissionCache.delete(cacheKey);
      return null;
    }
    
    return cached.result;
  }

  /**
   * Clear cache for specific entry
   */
  private clearCacheForEntry(entryId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.permissionCache.keys()) {
      if (key.includes(entryId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }

  /**
   * Check if role is valid
   */
  private isValidRole(role: AgentRole): boolean {
    const validRoles: AgentRole[] = [
      'code_reviewer',
      'test_engineer', 
      'documentation',
      'security',
      'architect',
      'code_smell_detector',
      'bug_pattern_analyzer',
      'performance_optimizer',
      'architectural_reviewer',
      'solid_principles_validator'
    ];
    
    return validRoles.includes(role);
  }

  /**
   * Check if condition is valid
   */
  private isValidCondition(condition: AccessCondition): boolean {
    const validTypes = ['time_range', 'context_state', 'task_status', 'agent_status', 'custom'];
    return validTypes.includes(condition.type) && 
           condition.expression !== undefined &&
           typeof condition.expectedValue === 'boolean';
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // This would need additional tracking in a real implementation
    return 0.75; // Placeholder
  }

  /**
   * Initialize role hierarchy with default values
   */
  private initializeRoleHierarchy(): void {
    // Admin role - highest privileges
    this.roleHierarchy.set('architect', {
      parents: [],
      children: ['code_reviewer', 'security', 'performance_optimizer'],
      priority: 100,
      defaultPermissions: ['read', 'write', 'delete', 'execute', 'admin']
    });

    // Code reviewer - high privileges for code-related operations
    this.roleHierarchy.set('code_reviewer', {
      parents: ['architect'],
      children: ['code_smell_detector', 'bug_pattern_analyzer'],
      priority: 80,
      defaultPermissions: ['read', 'write', 'execute']
    });

    // Security - specialized permissions
    this.roleHierarchy.set('security', {
      parents: ['architect'],
      children: [],
      priority: 85,
      defaultPermissions: ['read', 'write', 'execute']
    });

    // Performance optimizer
    this.roleHierarchy.set('performance_optimizer', {
      parents: ['architect'],
      children: [],
      priority: 75,
      defaultPermissions: ['read', 'write', 'execute']
    });

    // Specialized analyzers
    this.roleHierarchy.set('code_smell_detector', {
      parents: ['code_reviewer'],
      children: [],
      priority: 60,
      defaultPermissions: ['read', 'execute']
    });

    this.roleHierarchy.set('bug_pattern_analyzer', {
      parents: ['code_reviewer'],
      children: [],
      priority: 60,
      defaultPermissions: ['read', 'execute']
    });

    // Other roles
    this.roleHierarchy.set('test_engineer', {
      parents: [],
      children: [],
      priority: 70,
      defaultPermissions: ['read', 'write']
    });

    this.roleHierarchy.set('documentation', {
      parents: [],
      children: [],
      priority: 50,
      defaultPermissions: ['read', 'write']
    });

    this.roleHierarchy.set('architectural_reviewer', {
      parents: ['architect'],
      children: [],
      priority: 90,
      defaultPermissions: ['read', 'write', 'execute']
    });

    this.roleHierarchy.set('solid_principles_validator', {
      parents: ['code_reviewer'],
      children: [],
      priority: 65,
      defaultPermissions: ['read', 'execute']
    });
  }

  /**
   * Setup cache cleanup interval
   */
  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of this.permissionCache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.permissionCache.delete(key));
      
      if (keysToDelete.length > 0) {
        this.logger.debug('Cleaned up expired cache entries', { 
          count: keysToDelete.length 
        });
      }
    }, 60000); // Run every minute
  }
}