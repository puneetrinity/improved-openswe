/**
 * Comprehensive test suite for the Shared Context Store system
 * 
 * Tests all major functionality including RBAC, versioning, conflict resolution,
 * performance, and integration with the existing GraphState system.
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { SharedContextStore } from '../open-swe/shared-context-store.js';
import { GraphStateContextAdapter } from '../open-swe/context-store-integration.js';
import { PermissionManager } from '../open-swe/permission-manager.js';
import { VersionManager } from '../open-swe/version-manager.js';
import { 
  ContextScope, 
  AccessPermission, 
  ContextQuery 
} from '../open-swe/context-store-types.js';
import { AgentProfile, AgentRole } from '../open-swe/types.js';

// Test fixtures
const createTestAgent = (id: string, role: AgentRole): AgentProfile => ({
  id,
  role,
  specialization: [`${role}_specialist`],
  tools: ['test_tool'],
  collaborationRules: [],
  status: 'active',
  createdAt: Date.now(),
  lastActiveAt: Date.now()
});

const testAgents = {
  architect: createTestAgent('agent_architect', 'architect'),
  reviewer: createTestAgent('agent_reviewer', 'code_reviewer'),
  security: createTestAgent('agent_security', 'security'),
  tester: createTestAgent('agent_tester', 'test_engineer'),
  detector: createTestAgent('agent_detector', 'code_smell_detector')
};

describe('SharedContextStore', () => {
  let contextStore: SharedContextStore;
  let adapter: GraphStateContextAdapter;
  
  beforeEach(async () => {
    contextStore = new SharedContextStore();
    adapter = new GraphStateContextAdapter(contextStore);
    await contextStore.initialize();
    
    // Register test agents
    for (const agent of Object.values(testAgents)) {
      (contextStore.permissions as any).registerAgentProfile(agent);
    }
  });

  afterEach(async () => {
    await contextStore.shutdown();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve context values', async () => {
      const testData = { message: 'Hello World', timestamp: Date.now() };
      
      const setResult = await contextStore.set(
        'session',
        'test',
        'greeting',
        testData
      );
      
      expect(setResult.success).toBe(true);
      expect(setResult.data).toBeTruthy();
      
      const getResult = await contextStore.get(setResult.data!, testAgents.architect.id);
      
      expect(getResult.success).toBe(true);
      expect(getResult.data).toEqual(testData);
    });

    test('should update existing context values', async () => {
      const originalData = { version: 1, content: 'original' };
      const updatedData = { version: 2, content: 'updated' };
      
      const setResult = await contextStore.set(
        'task',
        'test',
        'document',
        originalData
      );
      
      expect(setResult.success).toBe(true);
      
      const updateResult = await contextStore.update(
        setResult.data!,
        updatedData,
        testAgents.reviewer.id,
        'Updated document'
      );
      
      expect(updateResult.success).toBe(true);
      
      const getResult = await contextStore.get(setResult.data!, testAgents.reviewer.id);
      
      expect(getResult.success).toBe(true);
      expect(getResult.data).toEqual(updatedData);
    });

    test('should delete context values', async () => {
      const testData = { temp: 'data' };
      
      const setResult = await contextStore.set(
        'global',
        'temp',
        'data',
        testData
      );
      
      expect(setResult.success).toBe(true);
      
      const deleteResult = await contextStore.delete(
        setResult.data!,
        testAgents.architect.id
      );
      
      expect(deleteResult.success).toBe(true);
      
      const getResult = await contextStore.get(setResult.data!, testAgents.architect.id);
      
      expect(getResult.success).toBe(false);
    });
  });

  describe('Role-Based Access Control', () => {
    test('should enforce read permissions', async () => {
      const sensitiveData = { secret: 'classified' };
      const permissions: AccessPermission[] = [
        {
          roles: ['architect', 'security'],
          permission: 'read'
        }
      ];
      
      const setResult = await contextStore.set(
        'global',
        'security',
        'classified',
        sensitiveData,
        permissions
      );
      
      expect(setResult.success).toBe(true);
      
      // Architect should have access
      const architectAccess = await contextStore.get(setResult.data!, testAgents.architect.id);
      expect(architectAccess.success).toBe(true);
      
      // Security agent should have access
      const securityAccess = await contextStore.get(setResult.data!, testAgents.security.id);
      expect(securityAccess.success).toBe(true);
      
      // Test engineer should NOT have access
      const testerAccess = await contextStore.get(setResult.data!, testAgents.tester.id);
      expect(testerAccess.success).toBe(false);
      expect(testerAccess.error).toBe('Access denied');
    });

    test('should enforce write permissions', async () => {
      const codeData = { code: 'function test() {}' };
      const permissions: AccessPermission[] = [
        {
          roles: ['code_reviewer'],
          permission: 'write'
        },
        {
          roles: ['test_engineer'],
          permission: 'read'
        }
      ];
      
      const setResult = await contextStore.set(
        'task',
        'code',
        'function',
        codeData,
        permissions
      );
      
      expect(setResult.success).toBe(true);
      
      const updatedCode = { code: 'function test() { return true; }' };
      
      // Code reviewer should be able to update
      const reviewerUpdate = await contextStore.update(
        setResult.data!,
        updatedCode,
        testAgents.reviewer.id,
        'Added return statement'
      );
      expect(reviewerUpdate.success).toBe(true);
      
      // Test engineer should NOT be able to update
      const testerUpdate = await contextStore.update(
        setResult.data!,
        { code: 'malicious code' },
        testAgents.tester.id,
        'Attempted change'
      );
      expect(testerUpdate.success).toBe(false);
      expect(testerUpdate.error).toBe('Access denied');
    });

    test('should support role hierarchy', async () => {
      const permissionManager = contextStore.permissions as PermissionManager;
      
      // Register role hierarchy
      permissionManager.updateRoleHierarchy('architect', {
        parents: [],
        children: ['code_reviewer'],
        priority: 100,
        defaultPermissions: ['read', 'write', 'delete', 'execute', 'admin']
      });
      
      permissionManager.updateRoleHierarchy('code_reviewer', {
        parents: ['architect'],
        children: ['code_smell_detector'],
        priority: 80,
        defaultPermissions: ['read', 'write', 'execute']
      });
      
      const testData = { test: 'hierarchy' };
      const permissions: AccessPermission[] = [
        {
          roles: ['code_reviewer'],
          permission: 'write'
        }
      ];
      
      const setResult = await contextStore.set(
        'global',
        'hierarchy',
        'test',
        testData,
        permissions
      );
      
      expect(setResult.success).toBe(true);
      
      // Architect should inherit permissions from child role
      const architectAccess = await contextStore.get(setResult.data!, testAgents.architect.id);
      expect(architectAccess.success).toBe(true);
      
      // Code smell detector should inherit from parent role
      const detectorAccess = await contextStore.get(setResult.data!, testAgents.detector.id);
      expect(detectorAccess.success).toBe(true);
    });
  });

  describe('Versioning and Conflict Resolution', () => {
    test('should create versions on updates', async () => {
      const versionManager = contextStore.versions as VersionManager;
      
      const originalData = { counter: 1 };
      
      const setResult = await contextStore.set(
        'task',
        'versioning',
        'counter',
        originalData
      );
      
      expect(setResult.success).toBe(true);
      
      // Update multiple times
      for (let i = 2; i <= 5; i++) {
        await contextStore.update(
          setResult.data!,
          { counter: i },
          testAgents.reviewer.id,
          `Updated to ${i}`
        );
      }
      
      // Check version history
      const historyResult = await versionManager.getVersionHistory(setResult.data!);
      
      expect(historyResult.success).toBe(true);
      expect(historyResult.data!.length).toBe(5); // Initial + 4 updates
    });

    test('should handle version comparison', async () => {
      const versionManager = contextStore.versions as VersionManager;
      
      const setResult = await contextStore.set(
        'global',
        'comparison',
        'data',
        { value: 'initial' }
      );
      
      expect(setResult.success).toBe(true);
      
      // Create two versions
      await contextStore.update(
        setResult.data!,
        { value: 'version1' },
        testAgents.reviewer.id,
        'Version 1'
      );
      
      await contextStore.update(
        setResult.data!,
        { value: 'version2' },
        testAgents.reviewer.id,
        'Version 2'
      );
      
      // Get version history
      const historyResult = await versionManager.getVersionHistory(setResult.data!);
      expect(historyResult.success).toBe(true);
      
      const versions = historyResult.data!;
      expect(versions.length).toBeGreaterThanOrEqual(2);
      
      // Compare versions
      const compareResult = await versionManager.compareVersions(
        setResult.data!,
        versions[0].id,
        versions[1].id
      );
      
      expect(compareResult.success).toBe(true);
      expect(compareResult.data!).toHaveProperty('diff');
    });

    test('should support version reversion', async () => {
      const versionManager = contextStore.versions as VersionManager;
      
      const originalData = { state: 'good' };
      
      const setResult = await contextStore.set(
        'task',
        'revert',
        'state',
        originalData
      );
      
      expect(setResult.success).toBe(true);
      
      // Make a bad update
      await contextStore.update(
        setResult.data!,
        { state: 'bad' },
        testAgents.reviewer.id,
        'Bad update'
      );
      
      // Get version history
      const historyResult = await versionManager.getVersionHistory(setResult.data!);
      expect(historyResult.success).toBe(true);
      
      const versions = historyResult.data!;
      const originalVersion = versions.find(v => v.message === 'Initial version');
      expect(originalVersion).toBeTruthy();
      
      // Revert to original
      const revertResult = await versionManager.revertToVersion(
        setResult.data!,
        originalVersion!.id,
        testAgents.architect.id
      );
      
      expect(revertResult.success).toBe(true);
      
      // Verify data is reverted
      const getResult = await contextStore.get(setResult.data!, testAgents.architect.id);
      expect(getResult.success).toBe(true);
      expect(getResult.data).toEqual(originalData);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Set up test data
      const testData = [
        { scope: 'global' as ContextScope, path: 'config', key: 'app', value: { name: 'test-app' } },
        { scope: 'session' as ContextScope, path: 'user/123', key: 'profile', value: { name: 'John' } },
        { scope: 'task' as ContextScope, path: 'task-1', key: 'status', value: 'in_progress' },
        { scope: 'task' as ContextScope, path: 'task-2', key: 'status', value: 'completed' },
        { scope: 'agent' as ContextScope, path: 'agent-1', key: 'state', value: { active: true } }
      ];
      
      for (const data of testData) {
        await contextStore.set(data.scope, data.path, data.key, data.value);
      }
    });

    test('should query by scope', async () => {
      const query: ContextQuery = {
        scope: 'task'
      };
      
      const result = await contextStore.query(query, testAgents.architect.id);
      
      expect(result.success).toBe(true);
      expect(result.data!.entries).toHaveLength(2);
      expect(result.data!.entries.every(e => e.scope === 'task')).toBe(true);
    });

    test('should query by path pattern', async () => {
      const query: ContextQuery = {
        pathPattern: 'task*'
      };
      
      const result = await contextStore.query(query, testAgents.architect.id);
      
      expect(result.success).toBe(true);
      expect(result.data!.entries).toHaveLength(2);
      expect(result.data!.entries.every(e => e.path.includes('task'))).toBe(true);
    });

    test('should query with text search', async () => {
      const query: ContextQuery = {
        textSearch: 'progress'
      };
      
      const result = await contextStore.query(query, testAgents.architect.id);
      
      expect(result.success).toBe(true);
      expect(result.data!.entries.length).toBeGreaterThan(0);
    });

    test('should support pagination', async () => {
      const query: ContextQuery = {
        limit: 2,
        offset: 1
      };
      
      const result = await contextStore.query(query, testAgents.architect.id);
      
      expect(result.success).toBe(true);
      expect(result.data!.entries).toHaveLength(2);
      expect(result.data!.totalCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Real-time Synchronization', () => {
    test('should emit events on context changes', (done) => {
      const subscription = contextStore.subscribe(
        testAgents.architect.id,
        'session/*',
        ['create', 'update']
      );
      
      let eventCount = 0;
      subscription.subscribe(event => {
        eventCount++;
        expect(event.type).toMatch(/create|update/);
        
        if (eventCount === 2) {
          done();
        }
      });
      
      // Trigger events
      contextStore.set('session', 'realtime', 'test1', { data: 'event1' });
      setTimeout(() => {
        contextStore.set('session', 'realtime', 'test2', { data: 'event2' });
      }, 10);
    });

    test('should filter events by path pattern', (done) => {
      const subscription = contextStore.subscribe(
        testAgents.reviewer.id,
        'task/specific/*'
      );
      
      let receivedEvents: any[] = [];
      subscription.subscribe(event => {
        receivedEvents.push(event);
        
        if (receivedEvents.length === 1) {
          expect(event.path).toContain('task/specific');
          done();
        }
      });
      
      // This should NOT trigger the subscription
      contextStore.set('session', 'other', 'test', { data: 'ignored' });
      
      // This SHOULD trigger the subscription
      setTimeout(() => {
        contextStore.set('task', 'specific/item', 'test', { data: 'received' });
      }, 10);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent operations', async () => {
      const operations = [];
      const dataCount = 50;
      
      // Create concurrent set operations
      for (let i = 0; i < dataCount; i++) {
        operations.push(
          contextStore.set(
            'global',
            'performance',
            `item_${i}`,
            { index: i, timestamp: Date.now() }
          )
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(dataCount);
      
      // Verify all data was stored
      const query: ContextQuery = {
        pathPattern: 'performance*'
      };
      
      const queryResult = await contextStore.query(query, testAgents.architect.id);
      
      expect(queryResult.success).toBe(true);
      expect(queryResult.data!.entries).toHaveLength(dataCount);
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const operationCount = 100;
      
      const operations = [];
      for (let i = 0; i < operationCount; i++) {
        operations.push(
          contextStore.set(
            'global',
            'load_test',
            `item_${i}`,
            { 
              data: `test_data_${i}`.repeat(10), // Some payload
              timestamp: Date.now()
            }
          )
        );
      }
      
      await Promise.all(operations);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const opsPerSecond = operationCount / (duration / 1000);
      
      // Should handle at least 10 operations per second
      expect(opsPerSecond).toBeGreaterThan(10);
      
      console.log(`Performance test: ${operationCount} operations in ${duration}ms (${opsPerSecond.toFixed(2)} ops/sec)`);
    });

    test('should provide accurate statistics', async () => {
      // Create some test data
      await contextStore.set('global', 'stats', 'test1', { data: 'value1' });
      await contextStore.set('session', 'stats', 'test2', { data: 'value2' });
      await contextStore.set('task', 'stats', 'test3', { data: 'value3' });
      
      const statsResult = await contextStore.getStatistics();
      
      expect(statsResult.success).toBe(true);
      expect(statsResult.data!).toHaveProperty('totalEntries');
      expect(statsResult.data!).toHaveProperty('entriesByScope');
      expect(statsResult.data!).toHaveProperty('storage');
      expect(statsResult.data!).toHaveProperty('performance');
      expect(statsResult.data!.totalEntries).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring', () => {
    test('should report system health', async () => {
      const healthResult = await contextStore.healthCheck();
      
      expect(healthResult.success).toBe(true);
      expect(healthResult.data!.status).toMatch(/healthy|degraded|unhealthy/);
      expect(healthResult.data!.components).toHaveProperty('storage');
      expect(healthResult.data!.components).toHaveProperty('cache');
      expect(healthResult.data!.metrics).toHaveProperty('responseTime');
      expect(healthResult.data!.metrics.responseTime).toBeGreaterThan(0);
    });

    test('should perform maintenance operations', async () => {
      const maintenanceResult = await contextStore.maintenance();
      
      expect(maintenanceResult.success).toBe(true);
    });
  });

  describe('GraphState Integration', () => {
    test('should enhance shared context', async () => {
      const sharedContext = {
        currentTaskId: 'task-123',
        knowledgeBase: {
          'project_info': { name: 'Test Project', version: '1.0.0' },
          'requirements': ['feature A', 'feature B']
        },
        communicationHistory: [
          {
            id: 'msg-1',
            fromAgentId: testAgents.architect.id,
            type: 'notification' as const,
            content: 'Task started',
            timestamp: Date.now(),
            priority: 'medium' as const
          }
        ],
        workspaceState: {
          currentFile: 'src/main.ts',
          openTabs: ['main.ts', 'utils.ts']
        }
      };
      
      const sessionId = 'session-123';
      const agentProfiles = new Map([
        [testAgents.architect.id, testAgents.architect],
        [testAgents.reviewer.id, testAgents.reviewer]
      ]);
      
      const enhanced = await adapter.enhanceSharedContext(
        sharedContext,
        sessionId,
        agentProfiles
      );
      
      expect(enhanced).toHaveProperty('contextStore');
      expect(enhanced).toHaveProperty('sessionContext');
      expect(enhanced).toHaveProperty('taskContext');
      expect(enhanced).toHaveProperty('versions');
      expect(enhanced).toHaveProperty('syncStatus');
      expect(enhanced.contextStore).toBe(contextStore);
    });

    test('should create appropriate agent permissions', async () => {
      const architectPermissions = adapter.createAgentPermissions(testAgents.architect);
      const reviewerPermissions = adapter.createAgentPermissions(testAgents.reviewer);
      const testerPermissions = adapter.createAgentPermissions(testAgents.tester);
      
      // Architect should have admin permissions
      expect(architectPermissions.some(p => p.permission === 'admin')).toBe(true);
      
      // Reviewer should have write permissions
      expect(reviewerPermissions.some(p => p.permission === 'write')).toBe(true);
      
      // All agents should have agent-specific write permissions
      expect(architectPermissions.some(p => 
        p.agentIds?.includes(testAgents.architect.id) && p.permission === 'write'
      )).toBe(true);
      
      expect(reviewerPermissions.some(p => 
        p.agentIds?.includes(testAgents.reviewer.id) && p.permission === 'write'
      )).toBe(true);
      
      expect(testerPermissions.some(p => 
        p.agentIds?.includes(testAgents.tester.id) && p.permission === 'write'
      )).toBe(true);
    });

    test('should setup and manage agent synchronization', (done) => {
      const sessionId = 'sync-session-123';
      let eventCount = 0;
      
      adapter.setupAgentSync(
        testAgents.reviewer.id,
        sessionId,
        (event) => {
          eventCount++;
          expect(event).toHaveProperty('type');
          expect(event).toHaveProperty('entryId');
          expect(event.payload).toHaveProperty('targetAgent', testAgents.reviewer.id);
          
          if (eventCount === 1) {
            done();
          }
        }
      );
      
      // Trigger an event that should be picked up by the sync
      setTimeout(() => {
        contextStore.set(
          'session',
          `data/${sessionId}`,
          'sync_test',
          { message: 'sync test' }
        );
      }, 50);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent entries gracefully', async () => {
      const getResult = await contextStore.get('non-existent-id', testAgents.architect.id);
      
      expect(getResult.success).toBe(false);
      expect(getResult.error).toBeTruthy();
    });

    test('should handle invalid permissions gracefully', async () => {
      const invalidPermissions: AccessPermission[] = [
        {
          roles: ['invalid_role' as AgentRole],
          permission: 'invalid_permission' as any
        }
      ];
      
      const permissionManager = contextStore.permissions as PermissionManager;
      const validationResult = permissionManager.validatePermissions(invalidPermissions);
      
      expect(validationResult.success).toBe(false);
    });

    test('should handle large data payloads', async () => {
      const largeData = {
        content: 'x'.repeat(100000), // 100KB of data
        metadata: {
          size: 'large',
          timestamp: Date.now()
        }
      };
      
      const setResult = await contextStore.set(
        'global',
        'large_data',
        'test',
        largeData
      );
      
      expect(setResult.success).toBe(true);
      
      const getResult = await contextStore.get(setResult.data!, testAgents.architect.id);
      
      expect(getResult.success).toBe(true);
      expect(getResult.data).toEqual(largeData);
    });

    test('should handle concurrent access to same entry', async () => {
      const setResult = await contextStore.set(
        'global',
        'concurrent',
        'counter',
        { value: 0 }
      );
      
      expect(setResult.success).toBe(true);
      
      // Simulate concurrent updates
      const updates = [];
      for (let i = 1; i <= 10; i++) {
        updates.push(
          contextStore.update(
            setResult.data!,
            { value: i },
            testAgents.reviewer.id,
            `Update to ${i}`
          )
        );
      }
      
      const results = await Promise.all(updates);
      
      // At least some updates should succeed
      expect(results.some(r => r.success)).toBe(true);
      
      // Final value should be consistent
      const finalResult = await contextStore.get(setResult.data!, testAgents.architect.id);
      expect(finalResult.success).toBe(true);
      expect(typeof finalResult.data).toBe('object');
    });
  });
});

describe('Performance Benchmarks', () => {
  let contextStore: SharedContextStore;
  
  beforeAll(async () => {
    contextStore = new SharedContextStore();
    await contextStore.initialize();
  });

  afterAll(async () => {
    await contextStore.shutdown();
  });

  test('benchmark: 1000 sequential operations', async () => {
    const startTime = Date.now();
    const operationCount = 1000;
    
    for (let i = 0; i < operationCount; i++) {
      await contextStore.set(
        'global',
        'benchmark',
        `item_${i}`,
        { index: i, data: `test_${i}` }
      );
    }
    
    const duration = Date.now() - startTime;
    const opsPerSecond = operationCount / (duration / 1000);
    
    console.log(`Sequential benchmark: ${operationCount} operations in ${duration}ms (${opsPerSecond.toFixed(2)} ops/sec)`);
    
    // Should handle at least 50 operations per second sequentially
    expect(opsPerSecond).toBeGreaterThan(50);
  }, 30000);

  test('benchmark: 500 concurrent operations', async () => {
    const startTime = Date.now();
    const operationCount = 500;
    
    const operations = [];
    for (let i = 0; i < operationCount; i++) {
      operations.push(
        contextStore.set(
          'global',
          'concurrent_benchmark',
          `item_${i}`,
          { index: i, data: `test_${i}` }
        )
      );
    }
    
    await Promise.all(operations);
    
    const duration = Date.now() - startTime;
    const opsPerSecond = operationCount / (duration / 1000);
    
    console.log(`Concurrent benchmark: ${operationCount} operations in ${duration}ms (${opsPerSecond.toFixed(2)} ops/sec)`);
    
    // Should handle at least 100 operations per second concurrently
    expect(opsPerSecond).toBeGreaterThan(100);
  }, 30000);

  test('benchmark: complex queries', async () => {
    // Set up test data
    const dataCount = 1000;
    for (let i = 0; i < dataCount; i++) {
      await contextStore.set(
        i % 2 === 0 ? 'global' : 'session',
        `benchmark_${Math.floor(i / 100)}`,
        `item_${i}`,
        {
          index: i,
          category: i % 5,
          priority: i % 3 === 0 ? 'high' : 'normal',
          timestamp: Date.now() - (i * 1000)
        }
      );
    }
    
    const startTime = Date.now();
    
    // Complex query
    const queryResult = await contextStore.query({
      scope: ['global', 'session'],
      pathPattern: 'benchmark_*',
      textSearch: 'high',
      limit: 100,
      sortBy: 'created',
      sortOrder: 'desc'
    }, 'system');
    
    const queryDuration = Date.now() - startTime;
    
    expect(queryResult.success).toBe(true);
    expect(queryResult.data!.entries.length).toBeGreaterThan(0);
    expect(queryDuration).toBeLessThan(1000); // Should complete within 1 second
    
    console.log(`Complex query benchmark: ${dataCount} entries queried in ${queryDuration}ms`);
  }, 30000);
});