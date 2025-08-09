import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { filter, map, timeout, mergeMap, retry, catchError } from 'rxjs/operators';
import { 
  AgentProfile, 
  AgentMessage,
  TaskDelegation
} from './types.js';
import {
  AgentRegistry,
  AgentCommunicationHub,
  AgentEvent,
  RegistryOperationResult
} from './agent-registry.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Concurrency control strategies
 */
export type ConcurrencyControlStrategy = 
  | 'optimistic'
  | 'pessimistic'
  | 'timestamp_ordering'
  | 'multiversion'
  | 'snapshot_isolation';

/**
 * Transaction isolation levels
 */
export type IsolationLevel = 
  | 'read_uncommitted'
  | 'read_committed'
  | 'repeatable_read'
  | 'serializable';

/**
 * Conflict detection strategies
 */
export type ConflictDetectionStrategy = 
  | 'timestamp_based'
  | 'version_based'
  | 'dependency_based'
  | 'semantic_based';

/**
 * Conflict resolution strategies
 */
export type ConflictResolutionStrategy = 
  | 'last_writer_wins'
  | 'first_writer_wins'
  | 'merge_based'
  | 'priority_based'
  | 'manual_resolution'
  | 'compensation_based';

/**
 * Resource lock information
 */
export interface ResourceLock {
  /**
   * Resource identifier
   */
  resourceId: string;
  
  /**
   * Lock type
   */
  lockType: 'read' | 'write' | 'exclusive';
  
  /**
   * Agent holding the lock
   */
  holderId: string;
  
  /**
   * Lock acquired timestamp
   */
  acquiredAt: number;
  
  /**
   * Lock expiration time
   */
  expiresAt: number;
  
  /**
   * Transaction ID
   */
  transactionId: string;
  
  /**
   * Lock priority
   */
  priority: number;
  
  /**
   * Lock metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Version information for optimistic concurrency control
 */
export interface ResourceVersion {
  /**
   * Resource identifier
   */
  resourceId: string;
  
  /**
   * Current version number
   */
  version: number;
  
  /**
   * Last modified timestamp
   */
  lastModified: number;
  
  /**
   * Agent that made the last modification
   */
  lastModifiedBy: string;
  
  /**
   * Checksum/hash of current state
   */
  checksum: string;
  
  /**
   * Version metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Distributed transaction information
 */
export interface DistributedTransaction {
  /**
   * Transaction identifier
   */
  id: string;
  
  /**
   * Transaction coordinator agent
   */
  coordinatorId: string;
  
  /**
   * Participating agents
   */
  participants: Set<string>;
  
  /**
   * Transaction state
   */
  state: 'active' | 'preparing' | 'prepared' | 'committed' | 'aborted';
  
  /**
   * Isolation level
   */
  isolationLevel: IsolationLevel;
  
  /**
   * Transaction timeout
   */
  timeout: number;
  
  /**
   * Start timestamp
   */
  startTime: number;
  
  /**
   * Resources accessed in this transaction
   */
  accessedResources: Set<string>;
  
  /**
   * Resource locks held
   */
  heldLocks: Map<string, ResourceLock>;
  
  /**
   * Transaction operations
   */
  operations: TransactionOperation[];
  
  /**
   * Compensation actions
   */
  compensations: CompensationAction[];
  
  /**
   * Transaction metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Transaction operation
 */
export interface TransactionOperation {
  /**
   * Operation identifier
   */
  id: string;
  
  /**
   * Operation type
   */
  type: 'read' | 'write' | 'delete' | 'create';
  
  /**
   * Target resource
   */
  resourceId: string;
  
  /**
   * Operation data
   */
  data: Record<string, unknown>;
  
  /**
   * Operation timestamp
   */
  timestamp: number;
  
  /**
   * Agent performing the operation
   */
  agentId: string;
  
  /**
   * Operation status
   */
  status: 'pending' | 'executed' | 'failed' | 'compensated';
  
  /**
   * Operation result
   */
  result?: Record<string, unknown>;
  
  /**
   * Error information if failed
   */
  error?: string;
}

/**
 * Compensation action for transaction rollback
 */
export interface CompensationAction {
  /**
   * Action identifier
   */
  id: string;
  
  /**
   * Target operation to compensate
   */
  targetOperationId: string;
  
  /**
   * Compensation logic
   */
  action: (operation: TransactionOperation) => Promise<void>;
  
  /**
   * Action priority for execution order
   */
  priority: number;
  
  /**
   * Whether action has been executed
   */
  executed: boolean;
}

/**
 * Conflict information
 */
export interface ResourceConflict {
  /**
   * Conflict identifier
   */
  id: string;
  
  /**
   * Conflicting resource
   */
  resourceId: string;
  
  /**
   * Conflict type
   */
  type: 'read_write' | 'write_write' | 'version_mismatch' | 'semantic_conflict';
  
  /**
   * Conflicting transactions/operations
   */
  conflictingOperations: {
    operation: TransactionOperation;
    transaction: string;
    agent: string;
  }[];
  
  /**
   * Detection timestamp
   */
  detectedAt: number;
  
  /**
   * Detection strategy used
   */
  detectionStrategy: ConflictDetectionStrategy;
  
  /**
   * Conflict severity
   */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Resolution status
   */
  resolutionStatus: 'pending' | 'resolving' | 'resolved' | 'escalated';
  
  /**
   * Resolution strategy applied
   */
  resolutionStrategy?: ConflictResolutionStrategy;
  
  /**
   * Resolution result
   */
  resolution?: ConflictResolution;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /**
   * Resolution identifier
   */
  id: string;
  
  /**
   * Winning operation/transaction
   */
  winner?: {
    operationId: string;
    transactionId: string;
    agentId: string;
  };
  
  /**
   * Losing operations/transactions
   */
  losers: {
    operationId: string;
    transactionId: string;
    agentId: string;
    compensationRequired: boolean;
  }[];
  
  /**
   * Merged result (for merge-based resolution)
   */
  mergedResult?: Record<string, unknown>;
  
  /**
   * Resolution timestamp
   */
  resolvedAt: number;
  
  /**
   * Resolution rationale
   */
  rationale: string;
  
  /**
   * Manual resolution required
   */
  manualResolutionRequired: boolean;
}

/**
 * Deadlock information
 */
export interface DeadlockInfo {
  /**
   * Deadlock identifier
   */
  id: string;
  
  /**
   * Transactions involved in deadlock
   */
  transactions: string[];
  
  /**
   * Resources involved in deadlock cycle
   */
  resources: string[];
  
  /**
   * Deadlock detection timestamp
   */
  detectedAt: number;
  
  /**
   * Chosen victim transaction for abortion
   */
  victimTransaction?: string;
  
  /**
   * Resolution status
   */
  resolved: boolean;
}

/**
 * Transaction statistics
 */
export interface TransactionStatistics {
  /**
   * Total transactions started
   */
  totalStarted: number;
  
  /**
   * Total transactions committed
   */
  totalCommitted: number;
  
  /**
   * Total transactions aborted
   */
  totalAborted: number;
  
  /**
   * Average transaction duration
   */
  avgDuration: number;
  
  /**
   * Conflict statistics
   */
  conflicts: {
    total: number;
    resolved: number;
    escalated: number;
    avgResolutionTime: number;
  };
  
  /**
   * Deadlock statistics
   */
  deadlocks: {
    total: number;
    resolved: number;
    avgDetectionTime: number;
  };
  
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Comprehensive conflict resolution system providing optimistic and pessimistic
 * concurrency control, distributed transaction management, deadlock detection,
 * and various conflict resolution strategies.
 */
export class ConflictResolution {
  private readonly logger = createLogger(LogLevel.INFO, 'ConflictResolution');
  
  /**
   * Agent registry
   */
  private readonly registry: AgentRegistry;
  
  /**
   * Communication hub
   */
  private readonly communicationHub: AgentCommunicationHub;
  
  /**
   * Active distributed transactions
   */
  private readonly transactions = new Map<string, DistributedTransaction>();
  
  /**
   * Resource locks
   */
  private readonly resourceLocks = new Map<string, ResourceLock>();
  
  /**
   * Resource versions for optimistic concurrency control
   */
  private readonly resourceVersions = new Map<string, ResourceVersion>();
  
  /**
   * Active conflicts
   */
  private readonly activeConflicts = new Map<string, ResourceConflict>();
  
  /**
   * Detected deadlocks
   */
  private readonly deadlocks = new Map<string, DeadlockInfo>();
  
  /**
   * Transaction wait-for graph for deadlock detection
   */
  private readonly waitForGraph = new Map<string, Set<string>>();
  
  /**
   * Event streams
   */
  private readonly transactionEventStream = new Subject<AgentEvent>();
  private readonly conflictEventStream = new Subject<AgentEvent>();
  private readonly deadlockEventStream = new Subject<AgentEvent>();
  
  /**
   * System statistics
   */
  private readonly statistics: TransactionStatistics = {
    totalStarted: 0,
    totalCommitted: 0,
    totalAborted: 0,
    avgDuration: 0,
    conflicts: {
      total: 0,
      resolved: 0,
      escalated: 0,
      avgResolutionTime: 0
    },
    deadlocks: {
      total: 0,
      resolved: 0,
      avgDetectionTime: 0
    },
    lastUpdated: Date.now()
  };
  
  /**
   * Configuration
   */
  private readonly config = {
    defaultTransactionTimeout: 300000, // 5 minutes
    defaultLockTimeout: 60000, // 1 minute
    deadlockDetectionInterval: 10000, // 10 seconds
    conflictResolutionTimeout: 30000, // 30 seconds
    maxRetryAttempts: 3,
    lockCleanupInterval: 60000, // 1 minute
    transactionCleanupInterval: 120000 // 2 minutes
  };
  
  /**
   * Background task intervals
   */
  private readonly deadlockDetectionTimer: NodeJS.Timeout;
  private readonly lockCleanupTimer: NodeJS.Timeout;
  private readonly transactionCleanupTimer: NodeJS.Timeout;

  constructor(registry: AgentRegistry, communicationHub: AgentCommunicationHub) {
    this.registry = registry;
    this.communicationHub = communicationHub;
    
    // Start background tasks
    this.deadlockDetectionTimer = setInterval(() => {
      this.detectDeadlocks();
    }, this.config.deadlockDetectionInterval);
    
    this.lockCleanupTimer = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.config.lockCleanupInterval);
    
    this.transactionCleanupTimer = setInterval(() => {
      this.cleanupTimeoutTransactions();
    }, this.config.transactionCleanupInterval);
    
    this.logger.info('ConflictResolution system initialized');
  }

  /**
   * Begins a new distributed transaction
   * 
   * @param coordinatorId - Agent coordinating the transaction
   * @param participants - Participating agents
   * @param isolationLevel - Transaction isolation level
   * @param timeout - Transaction timeout
   * @returns Transaction ID
   */
  async beginTransaction(
    coordinatorId: string,
    participants: string[],
    isolationLevel: IsolationLevel = 'read_committed',
    timeout: number = this.config.defaultTransactionTimeout
  ): Promise<string> {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction: DistributedTransaction = {
      id: transactionId,
      coordinatorId,
      participants: new Set(participants),
      state: 'active',
      isolationLevel,
      timeout,
      startTime: Date.now(),
      accessedResources: new Set(),
      heldLocks: new Map(),
      operations: [],
      compensations: [],
      metadata: {}
    };
    
    this.transactions.set(transactionId, transaction);
    
    // Initialize wait-for graph entry
    this.waitForGraph.set(transactionId, new Set());
    
    this.statistics.totalStarted++;
    this.updateStatistics();
    
    this.logger.info('Transaction started', {
      transactionId,
      coordinatorId,
      participants: Array.from(participants),
      isolationLevel
    });
    
    this.emitTransactionEvent({
      id: `txn_started_${transactionId}`,
      type: 'task_delegated',
      agentId: coordinatorId,
      payload: {
        transactionId,
        participants: Array.from(participants),
        isolationLevel
      },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    return transactionId;
  }

  /**
   * Performs a read operation within a transaction
   * 
   * @param transactionId - Transaction ID
   * @param resourceId - Resource to read
   * @param agentId - Agent performing the read
   * @returns Promise resolving to read result
   */
  async performRead(
    transactionId: string,
    resourceId: string,
    agentId: string
  ): Promise<{ data: Record<string, unknown>; version?: number }> {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.state !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    
    // Check if lock is needed based on isolation level
    const needsLock = this.needsReadLock(transaction.isolationLevel);
    
    let lockAcquired = false;
    if (needsLock) {
      lockAcquired = await this.acquireResourceLock(
        resourceId,
        'read',
        agentId,
        transactionId
      );
      
      if (!lockAcquired) {
        throw new Error(`Could not acquire read lock on resource ${resourceId}`);
      }
    }
    
    try {
      // Get resource version for optimistic concurrency control
      const resourceVersion = this.resourceVersions.get(resourceId) || {
        resourceId,
        version: 0,
        lastModified: 0,
        lastModifiedBy: 'system',
        checksum: '',
        metadata: {}
      };
      
      // Simulate reading data (in real implementation, would read from actual storage)
      const data = await this.readResourceData(resourceId);
      
      // Record the operation
      const operation: TransactionOperation = {
        id: `op_read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'read',
        resourceId,
        data,
        timestamp: Date.now(),
        agentId,
        status: 'executed'
      };
      
      transaction.operations.push(operation);
      transaction.accessedResources.add(resourceId);
      
      this.logger.info('Read operation performed', {
        transactionId,
        resourceId,
        agentId,
        version: resourceVersion.version
      });
      
      return {
        data,
        version: resourceVersion.version
      };
      
    } finally {
      // Release read lock if isolation level allows
      if (lockAcquired && transaction.isolationLevel === 'read_committed') {
        await this.releaseResourceLock(resourceId, transactionId);
      }
    }
  }

  /**
   * Performs a write operation within a transaction
   * 
   * @param transactionId - Transaction ID
   * @param resourceId - Resource to write
   * @param data - Data to write
   * @param agentId - Agent performing the write
   * @param expectedVersion - Expected version for optimistic concurrency control
   * @returns Promise resolving to write result
   */
  async performWrite(
    transactionId: string,
    resourceId: string,
    data: Record<string, unknown>,
    agentId: string,
    expectedVersion?: number
  ): Promise<{ success: boolean; newVersion: number; conflicts?: ResourceConflict[] }> {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.state !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    
    // Acquire write lock
    const lockAcquired = await this.acquireResourceLock(
      resourceId,
      'write',
      agentId,
      transactionId
    );
    
    if (!lockAcquired) {
      throw new Error(`Could not acquire write lock on resource ${resourceId}`);
    }
    
    try {
      // Check for conflicts
      const conflicts = await this.detectConflicts(
        transactionId,
        resourceId,
        'write',
        expectedVersion
      );
      
      if (conflicts.length > 0) {
        // Attempt to resolve conflicts
        const resolutionResults = await Promise.all(
          conflicts.map(conflict => this.resolveConflict(conflict))
        );
        
        const unresolvedConflicts = resolutionResults
          .filter(result => !result.success)
          .map(result => result.conflict);
        
        if (unresolvedConflicts.length > 0) {
          this.logger.warn('Write operation has unresolved conflicts', {
            transactionId,
            resourceId,
            conflictCount: unresolvedConflicts.length
          });
          
          return {
            success: false,
            newVersion: 0,
            conflicts: unresolvedConflicts
          };
        }
      }
      
      // Perform the write
      const currentVersion = this.resourceVersions.get(resourceId)?.version || 0;
      const newVersion = currentVersion + 1;
      
      // Update resource version
      this.resourceVersions.set(resourceId, {
        resourceId,
        version: newVersion,
        lastModified: Date.now(),
        lastModifiedBy: agentId,
        checksum: this.calculateChecksum(data),
        metadata: { transactionId }
      });
      
      // Record the operation
      const operation: TransactionOperation = {
        id: `op_write_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'write',
        resourceId,
        data,
        timestamp: Date.now(),
        agentId,
        status: 'executed',
        result: { newVersion }
      };
      
      transaction.operations.push(operation);
      transaction.accessedResources.add(resourceId);
      
      // Add compensation action
      const compensation: CompensationAction = {
        id: `comp_${operation.id}`,
        targetOperationId: operation.id,
        action: async (op) => {
          // Restore previous version (simplified)
          await this.restoreResourceVersion(resourceId, currentVersion);
        },
        priority: transaction.operations.length,
        executed: false
      };
      
      transaction.compensations.push(compensation);
      
      this.logger.info('Write operation performed', {
        transactionId,
        resourceId,
        agentId,
        newVersion
      });
      
      return {
        success: true,
        newVersion
      };
      
    } catch (error) {
      this.logger.error('Write operation failed', {
        transactionId,
        resourceId,
        agentId,
        error: error instanceof Error ? error.message : error
      });
      
      throw error;
    }
  }

  /**
   * Commits a distributed transaction using two-phase commit protocol
   * 
   * @param transactionId - Transaction ID
   * @returns Promise resolving to commit result
   */
  async commitTransaction(transactionId: string): Promise<RegistryOperationResult> {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      return {
        success: false,
        error: `Transaction ${transactionId} not found`,
        executionTime: 0
      };
    }
    
    if (transaction.state !== 'active') {
      return {
        success: false,
        error: `Transaction ${transactionId} is not active`,
        executionTime: 0
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Phase 1: Prepare
      transaction.state = 'preparing';
      
      this.logger.info('Starting transaction commit - prepare phase', {
        transactionId,
        participantCount: transaction.participants.size
      });
      
      const prepareResults = await this.sendPrepareMessages(transaction);
      const allPrepared = prepareResults.every(result => result.success);
      
      if (!allPrepared) {
        // Abort transaction
        await this.abortTransaction(transactionId);
        
        return {
          success: false,
          error: 'Not all participants could prepare for commit',
          executionTime: Date.now() - startTime
        };
      }
      
      transaction.state = 'prepared';
      
      // Phase 2: Commit
      this.logger.info('Starting transaction commit - commit phase', { transactionId });
      
      const commitResults = await this.sendCommitMessages(transaction);
      const allCommitted = commitResults.every(result => result.success);
      
      if (allCommitted) {
        transaction.state = 'committed';
        
        // Release all locks
        for (const [resourceId] of transaction.heldLocks) {
          await this.releaseResourceLock(resourceId, transactionId);
        }
        
        // Update statistics
        this.statistics.totalCommitted++;
        const duration = Date.now() - transaction.startTime;
        this.statistics.avgDuration = (this.statistics.avgDuration + duration) / 2;
        
        this.updateStatistics();
        
        this.logger.info('Transaction committed successfully', {
          transactionId,
          duration,
          operationCount: transaction.operations.length
        });
        
        this.emitTransactionEvent({
          id: `txn_committed_${transactionId}`,
          type: 'task_delegated',
          agentId: transaction.coordinatorId,
          payload: {
            transactionId,
            duration,
            operationCount: transaction.operations.length
          },
          timestamp: Date.now(),
          priority: 'medium'
        });
        
        // Clean up
        this.transactions.delete(transactionId);
        this.waitForGraph.delete(transactionId);
        
        return {
          success: true,
          metadata: { transactionId, duration, operationCount: transaction.operations.length },
          executionTime: Date.now() - startTime
        };
        
      } else {
        // Partial commit failure - need manual intervention
        this.logger.error('Partial commit failure detected', {
          transactionId,
          commitResults
        });
        
        return {
          success: false,
          error: 'Partial commit failure - manual intervention required',
          executionTime: Date.now() - startTime
        };
      }
      
    } catch (error) {
      this.logger.error('Transaction commit failed', {
        transactionId,
        error: error instanceof Error ? error.message : error
      });
      
      await this.abortTransaction(transactionId);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Aborts a distributed transaction with compensation
   * 
   * @param transactionId - Transaction ID
   * @returns Promise resolving to abort result
   */
  async abortTransaction(transactionId: string): Promise<RegistryOperationResult> {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      return {
        success: false,
        error: `Transaction ${transactionId} not found`,
        executionTime: 0
      };
    }
    
    const startTime = Date.now();
    
    try {
      transaction.state = 'aborted';
      
      this.logger.info('Aborting transaction', {
        transactionId,
        operationCount: transaction.operations.length,
        compensationCount: transaction.compensations.length
      });
      
      // Execute compensations in reverse order
      const sortedCompensations = [...transaction.compensations]
        .sort((a, b) => b.priority - a.priority);
      
      for (const compensation of sortedCompensations) {
        if (!compensation.executed) {
          try {
            const targetOperation = transaction.operations.find(
              op => op.id === compensation.targetOperationId
            );
            
            if (targetOperation) {
              await compensation.action(targetOperation);
              compensation.executed = true;
              
              this.logger.debug('Compensation executed', {
                transactionId,
                compensationId: compensation.id,
                operationId: targetOperation.id
              });
            }
            
          } catch (error) {
            this.logger.error('Compensation execution failed', {
              transactionId,
              compensationId: compensation.id,
              error: error instanceof Error ? error.message : error
            });
          }
        }
      }
      
      // Send abort messages to participants
      await this.sendAbortMessages(transaction);
      
      // Release all locks
      for (const [resourceId] of transaction.heldLocks) {
        await this.releaseResourceLock(resourceId, transactionId);
      }
      
      // Update statistics
      this.statistics.totalAborted++;
      this.updateStatistics();
      
      this.emitTransactionEvent({
        id: `txn_aborted_${transactionId}`,
        type: 'task_delegated',
        agentId: transaction.coordinatorId,
        payload: {
          transactionId,
          compensationsExecuted: sortedCompensations.filter(c => c.executed).length
        },
        timestamp: Date.now(),
        priority: 'medium'
      });
      
      // Clean up
      this.transactions.delete(transactionId);
      this.waitForGraph.delete(transactionId);
      
      return {
        success: true,
        metadata: { transactionId },
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Transaction abort failed', {
        transactionId,
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
   * Acquires a resource lock
   * 
   * @private
   */
  private async acquireResourceLock(
    resourceId: string,
    lockType: ResourceLock['lockType'],
    agentId: string,
    transactionId: string,
    timeout: number = this.config.defaultLockTimeout
  ): Promise<boolean> {
    const existingLock = this.resourceLocks.get(resourceId);
    
    // Check if lock can be acquired
    if (existingLock) {
      // Check if same transaction already holds the lock
      if (existingLock.transactionId === transactionId) {
        return true; // Re-entrant lock
      }
      
      // Check lock compatibility
      if (!this.areLocksCompatible(existingLock.lockType, lockType)) {
        // Add to wait-for graph for deadlock detection
        const waitingTransaction = transactionId;
        const holdingTransaction = existingLock.transactionId;
        
        if (!this.waitForGraph.has(waitingTransaction)) {
          this.waitForGraph.set(waitingTransaction, new Set());
        }
        this.waitForGraph.get(waitingTransaction)!.add(holdingTransaction);
        
        this.logger.warn('Lock conflict detected', {
          resourceId,
          existingLockType: existingLock.lockType,
          requestedLockType: lockType,
          holdingTransaction,
          waitingTransaction
        });
        
        return false;
      }
    }
    
    // Acquire the lock
    const lock: ResourceLock = {
      resourceId,
      lockType,
      holderId: agentId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + timeout,
      transactionId,
      priority: 1, // Default priority
      metadata: {}
    };
    
    this.resourceLocks.set(resourceId, lock);
    
    // Update transaction's held locks
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.heldLocks.set(resourceId, lock);
    }
    
    this.logger.debug('Resource lock acquired', {
      resourceId,
      lockType,
      agentId,
      transactionId
    });
    
    return true;
  }

  /**
   * Releases a resource lock
   * 
   * @private
   */
  private async releaseResourceLock(resourceId: string, transactionId: string): Promise<void> {
    const lock = this.resourceLocks.get(resourceId);
    
    if (lock && lock.transactionId === transactionId) {
      this.resourceLocks.delete(resourceId);
      
      // Remove from transaction's held locks
      const transaction = this.transactions.get(transactionId);
      if (transaction) {
        transaction.heldLocks.delete(resourceId);
      }
      
      // Remove from wait-for graph
      for (const [waitingTxn, waitingFor] of this.waitForGraph) {
        waitingFor.delete(transactionId);
      }
      
      this.logger.debug('Resource lock released', {
        resourceId,
        transactionId
      });
    }
  }

  /**
   * Checks if two lock types are compatible
   * 
   * @private
   */
  private areLocksCompatible(
    existingLockType: ResourceLock['lockType'],
    requestedLockType: ResourceLock['lockType']
  ): boolean {
    // Exclusive locks are incompatible with everything
    if (existingLockType === 'exclusive' || requestedLockType === 'exclusive') {
      return false;
    }
    
    // Write locks are incompatible with read and write
    if (existingLockType === 'write' || requestedLockType === 'write') {
      return false;
    }
    
    // Read locks are compatible with read locks
    return existingLockType === 'read' && requestedLockType === 'read';
  }

  /**
   * Detects conflicts for an operation
   * 
   * @private
   */
  private async detectConflicts(
    transactionId: string,
    resourceId: string,
    operationType: 'read' | 'write',
    expectedVersion?: number
  ): Promise<ResourceConflict[]> {
    const conflicts: ResourceConflict[] = [];
    const currentVersion = this.resourceVersions.get(resourceId);
    
    // Version-based conflict detection (optimistic concurrency control)
    if (operationType === 'write' && expectedVersion !== undefined && currentVersion) {
      if (currentVersion.version !== expectedVersion) {
        const conflict: ResourceConflict = {
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          resourceId,
          type: 'version_mismatch',
          conflictingOperations: [{
            operation: {
              id: 'version_conflict',
              type: 'write',
              resourceId,
              data: {},
              timestamp: currentVersion.lastModified,
              agentId: currentVersion.lastModifiedBy,
              status: 'executed'
            },
            transaction: 'unknown',
            agent: currentVersion.lastModifiedBy
          }],
          detectedAt: Date.now(),
          detectionStrategy: 'version_based',
          severity: 'medium',
          resolutionStatus: 'pending'
        };
        
        conflicts.push(conflict);
        this.activeConflicts.set(conflict.id, conflict);
      }
    }
    
    // Lock-based conflict detection
    const existingLock = this.resourceLocks.get(resourceId);
    if (existingLock && existingLock.transactionId !== transactionId) {
      const requestedLockType = operationType === 'read' ? 'read' : 'write';
      
      if (!this.areLocksCompatible(existingLock.lockType, requestedLockType)) {
        const conflict: ResourceConflict = {
          id: `conflict_lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          resourceId,
          type: operationType === 'read' ? 'read_write' : 'write_write',
          conflictingOperations: [{
            operation: {
              id: 'lock_conflict',
              type: existingLock.lockType === 'read' ? 'read' : 'write',
              resourceId,
              data: {},
              timestamp: existingLock.acquiredAt,
              agentId: existingLock.holderId,
              status: 'executed'
            },
            transaction: existingLock.transactionId,
            agent: existingLock.holderId
          }],
          detectedAt: Date.now(),
          detectionStrategy: 'dependency_based',
          severity: 'high',
          resolutionStatus: 'pending'
        };
        
        conflicts.push(conflict);
        this.activeConflicts.set(conflict.id, conflict);
      }
    }
    
    return conflicts;
  }

  /**
   * Resolves a resource conflict
   * 
   * @private
   */
  private async resolveConflict(conflict: ResourceConflict): Promise<{
    success: boolean;
    conflict: ResourceConflict;
    resolution?: ConflictResolution;
  }> {
    conflict.resolutionStatus = 'resolving';
    
    this.logger.info('Resolving conflict', {
      conflictId: conflict.id,
      resourceId: conflict.resourceId,
      conflictType: conflict.type
    });
    
    let resolutionStrategy: ConflictResolutionStrategy;
    
    // Determine resolution strategy based on conflict type and severity
    switch (conflict.type) {
      case 'version_mismatch':
        resolutionStrategy = 'last_writer_wins'; // Could be configurable
        break;
      case 'read_write':
        resolutionStrategy = 'priority_based';
        break;
      case 'write_write':
        resolutionStrategy = 'first_writer_wins';
        break;
      case 'semantic_conflict':
        resolutionStrategy = 'manual_resolution';
        break;
      default:
        resolutionStrategy = 'last_writer_wins';
    }
    
    try {
      const resolution = await this.applyResolutionStrategy(conflict, resolutionStrategy);
      
      conflict.resolutionStatus = 'resolved';
      conflict.resolutionStrategy = resolutionStrategy;
      conflict.resolution = resolution;
      
      this.statistics.conflicts.resolved++;
      this.updateStatistics();
      
      this.emitConflictEvent({
        id: `conflict_resolved_${conflict.id}`,
        type: 'message_received',
        agentId: 'conflict_resolver',
        payload: {
          conflictId: conflict.id,
          resourceId: conflict.resourceId,
          resolutionStrategy,
          winner: resolution.winner
        },
        timestamp: Date.now(),
        priority: 'medium'
      });
      
      return {
        success: true,
        conflict,
        resolution
      };
      
    } catch (error) {
      this.logger.error('Conflict resolution failed', {
        conflictId: conflict.id,
        error: error instanceof Error ? error.message : error
      });
      
      conflict.resolutionStatus = 'escalated';
      this.statistics.conflicts.escalated++;
      
      return {
        success: false,
        conflict
      };
    }
  }

  /**
   * Applies a specific resolution strategy
   * 
   * @private
   */
  private async applyResolutionStrategy(
    conflict: ResourceConflict,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    const resolution: ConflictResolution = {
      id: `resolution_${conflict.id}`,
      losers: [],
      resolvedAt: Date.now(),
      rationale: `Applied ${strategy} strategy`,
      manualResolutionRequired: false
    };
    
    switch (strategy) {
      case 'last_writer_wins':
        // Latest operation wins
        const latestOperation = conflict.conflictingOperations
          .sort((a, b) => b.operation.timestamp - a.operation.timestamp)[0];
        
        resolution.winner = {
          operationId: latestOperation.operation.id,
          transactionId: latestOperation.transaction,
          agentId: latestOperation.agent
        };
        
        resolution.losers = conflict.conflictingOperations
          .filter(op => op !== latestOperation)
          .map(op => ({
            operationId: op.operation.id,
            transactionId: op.transaction,
            agentId: op.agent,
            compensationRequired: true
          }));
        break;
        
      case 'first_writer_wins':
        // Earliest operation wins
        const earliestOperation = conflict.conflictingOperations
          .sort((a, b) => a.operation.timestamp - b.operation.timestamp)[0];
        
        resolution.winner = {
          operationId: earliestOperation.operation.id,
          transactionId: earliestOperation.transaction,
          agentId: earliestOperation.agent
        };
        
        resolution.losers = conflict.conflictingOperations
          .filter(op => op !== earliestOperation)
          .map(op => ({
            operationId: op.operation.id,
            transactionId: op.transaction,
            agentId: op.agent,
            compensationRequired: true
          }));
        break;
        
      case 'priority_based':
        // Agent/transaction with higher priority wins (simplified)
        const priorityWinner = conflict.conflictingOperations[0]; // Simplified
        
        resolution.winner = {
          operationId: priorityWinner.operation.id,
          transactionId: priorityWinner.transaction,
          agentId: priorityWinner.agent
        };
        
        resolution.losers = conflict.conflictingOperations
          .filter(op => op !== priorityWinner)
          .map(op => ({
            operationId: op.operation.id,
            transactionId: op.transaction,
            agentId: op.agent,
            compensationRequired: true
          }));
        break;
        
      case 'manual_resolution':
        resolution.manualResolutionRequired = true;
        resolution.rationale = 'Conflict requires manual intervention';
        break;
        
      default:
        throw new Error(`Unsupported resolution strategy: ${strategy}`);
    }
    
    return resolution;
  }

  /**
   * Detects deadlocks in the system
   * 
   * @private
   */
  private async detectDeadlocks(): Promise<void> {
    if (this.waitForGraph.size === 0) return;
    
    // Use DFS to detect cycles in wait-for graph
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const detectCycle = (node: string, path: string[]): string[] | null => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const neighbors = this.waitForGraph.get(node) || new Set();
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = detectCycle(neighbor, [...path]);
          if (cycle) return cycle;
        } else if (recursionStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = path.indexOf(neighbor);
          return path.slice(cycleStart);
        }
      }
      
      recursionStack.delete(node);
      return null;
    };
    
    for (const transaction of this.waitForGraph.keys()) {
      if (!visited.has(transaction)) {
        const cycle = detectCycle(transaction, []);
        
        if (cycle && cycle.length > 0) {
          await this.handleDeadlock(cycle);
        }
      }
    }
  }

  /**
   * Handles detected deadlock
   * 
   * @private
   */
  private async handleDeadlock(cycle: string[]): Promise<void> {
    const deadlockId = `deadlock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.warn('Deadlock detected', {
      deadlockId,
      transactions: cycle
    });
    
    // Choose victim transaction (youngest transaction in cycle)
    const victimTransaction = cycle.reduce((victim, current) => {
      const victimTxn = this.transactions.get(victim);
      const currentTxn = this.transactions.get(current);
      
      if (!victimTxn || !currentTxn) return victim;
      
      return currentTxn.startTime > victimTxn.startTime ? current : victim;
    });
    
    const deadlock: DeadlockInfo = {
      id: deadlockId,
      transactions: cycle,
      resources: Array.from(new Set(
        cycle.flatMap(txnId => {
          const txn = this.transactions.get(txnId);
          return txn ? Array.from(txn.heldLocks.keys()) : [];
        })
      )),
      detectedAt: Date.now(),
      victimTransaction,
      resolved: false
    };
    
    this.deadlocks.set(deadlockId, deadlock);
    
    // Abort victim transaction to break the deadlock
    try {
      await this.abortTransaction(victimTransaction);
      deadlock.resolved = true;
      
      this.statistics.deadlocks.resolved++;
      this.updateStatistics();
      
      this.logger.info('Deadlock resolved by aborting victim transaction', {
        deadlockId,
        victimTransaction
      });
      
      this.emitDeadlockEvent({
        id: `deadlock_resolved_${deadlockId}`,
        type: 'message_received',
        agentId: 'deadlock_detector',
        payload: {
          deadlockId,
          transactions: cycle,
          victimTransaction,
          resolved: true
        },
        timestamp: Date.now(),
        priority: 'high'
      });
      
    } catch (error) {
      this.logger.error('Failed to resolve deadlock', {
        deadlockId,
        victimTransaction,
        error: error instanceof Error ? error.message : error
      });
    }
    
    this.statistics.deadlocks.total++;
  }

  /**
   * Determines if read lock is needed based on isolation level
   * 
   * @private
   */
  private needsReadLock(isolationLevel: IsolationLevel): boolean {
    return isolationLevel === 'repeatable_read' || isolationLevel === 'serializable';
  }

  /**
   * Reads resource data (simulated)
   * 
   * @private
   */
  private async readResourceData(resourceId: string): Promise<Record<string, unknown>> {
    // Simulate reading from storage
    return {
      resourceId,
      data: `Resource data for ${resourceId}`,
      lastAccessed: Date.now()
    };
  }

  /**
   * Calculates checksum for data
   * 
   * @private
   */
  private calculateChecksum(data: Record<string, unknown>): string {
    // Simple checksum calculation (in real implementation, would use proper hashing)
    return JSON.stringify(data).length.toString(16);
  }

  /**
   * Restores resource to previous version
   * 
   * @private
   */
  private async restoreResourceVersion(resourceId: string, version: number): Promise<void> {
    // Simulate version restoration
    const resourceVersion = this.resourceVersions.get(resourceId);
    if (resourceVersion) {
      resourceVersion.version = version;
      resourceVersion.lastModified = Date.now();
      resourceVersion.lastModifiedBy = 'system';
    }
  }

  /**
   * Sends prepare messages to transaction participants
   * 
   * @private
   */
  private async sendPrepareMessages(
    transaction: DistributedTransaction
  ): Promise<RegistryOperationResult[]> {
    const preparePromises = Array.from(transaction.participants).map(async (participantId) => {
      const message: AgentMessage = {
        id: `prepare_${transaction.id}_${participantId}`,
        fromAgentId: transaction.coordinatorId,
        toAgentId: participantId,
        type: 'collaboration',
        content: 'Transaction prepare request',
        data: {
          transactionId: transaction.id,
          phase: 'prepare'
        },
        timestamp: Date.now(),
        priority: 'high'
      };
      
      return this.communicationHub.sendMessage(
        transaction.coordinatorId,
        participantId,
        message
      );
    });
    
    return Promise.all(preparePromises);
  }

  /**
   * Sends commit messages to transaction participants
   * 
   * @private
   */
  private async sendCommitMessages(
    transaction: DistributedTransaction
  ): Promise<RegistryOperationResult[]> {
    const commitPromises = Array.from(transaction.participants).map(async (participantId) => {
      const message: AgentMessage = {
        id: `commit_${transaction.id}_${participantId}`,
        fromAgentId: transaction.coordinatorId,
        toAgentId: participantId,
        type: 'collaboration',
        content: 'Transaction commit request',
        data: {
          transactionId: transaction.id,
          phase: 'commit'
        },
        timestamp: Date.now(),
        priority: 'high'
      };
      
      return this.communicationHub.sendMessage(
        transaction.coordinatorId,
        participantId,
        message
      );
    });
    
    return Promise.all(commitPromises);
  }

  /**
   * Sends abort messages to transaction participants
   * 
   * @private
   */
  private async sendAbortMessages(
    transaction: DistributedTransaction
  ): Promise<RegistryOperationResult[]> {
    const abortPromises = Array.from(transaction.participants).map(async (participantId) => {
      const message: AgentMessage = {
        id: `abort_${transaction.id}_${participantId}`,
        fromAgentId: transaction.coordinatorId,
        toAgentId: participantId,
        type: 'collaboration',
        content: 'Transaction abort request',
        data: {
          transactionId: transaction.id,
          phase: 'abort'
        },
        timestamp: Date.now(),
        priority: 'high'
      };
      
      return this.communicationHub.sendMessage(
        transaction.coordinatorId,
        participantId,
        message
      );
    });
    
    return Promise.all(abortPromises);
  }

  /**
   * Cleans up expired locks
   * 
   * @private
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    const expiredLocks: string[] = [];
    
    for (const [resourceId, lock] of this.resourceLocks) {
      if (lock.expiresAt <= now) {
        expiredLocks.push(resourceId);
      }
    }
    
    for (const resourceId of expiredLocks) {
      const lock = this.resourceLocks.get(resourceId);
      if (lock) {
        this.resourceLocks.delete(resourceId);
        
        // Remove from transaction
        const transaction = this.transactions.get(lock.transactionId);
        if (transaction) {
          transaction.heldLocks.delete(resourceId);
        }
        
        this.logger.info('Expired lock cleaned up', {
          resourceId,
          transactionId: lock.transactionId,
          holderId: lock.holderId
        });
      }
    }
  }

  /**
   * Cleans up timed out transactions
   * 
   * @private
   */
  private cleanupTimeoutTransactions(): void {
    const now = Date.now();
    const timedOutTransactions: string[] = [];
    
    for (const [transactionId, transaction] of this.transactions) {
      const age = now - transaction.startTime;
      if (age > transaction.timeout) {
        timedOutTransactions.push(transactionId);
      }
    }
    
    for (const transactionId of timedOutTransactions) {
      this.logger.warn('Transaction timeout detected', { transactionId });
      this.abortTransaction(transactionId).catch(error => {
        this.logger.error('Failed to abort timed out transaction', {
          transactionId,
          error: error instanceof Error ? error.message : error
        });
      });
    }
  }

  /**
   * Updates system statistics
   * 
   * @private
   */
  private updateStatistics(): void {
    this.statistics.lastUpdated = Date.now();
  }

  /**
   * Emits transaction event
   * 
   * @private
   */
  private emitTransactionEvent(event: AgentEvent): void {
    this.transactionEventStream.next(event);
  }

  /**
   * Emits conflict event
   * 
   * @private
   */
  private emitConflictEvent(event: AgentEvent): void {
    this.conflictEventStream.next(event);
  }

  /**
   * Emits deadlock event
   * 
   * @private
   */
  private emitDeadlockEvent(event: AgentEvent): void {
    this.deadlockEventStream.next(event);
  }

  /**
   * Gets active transactions
   */
  getActiveTransactions(): Map<string, DistributedTransaction> {
    return new Map(this.transactions);
  }

  /**
   * Gets active conflicts
   */
  getActiveConflicts(): Map<string, ResourceConflict> {
    return new Map(this.activeConflicts);
  }

  /**
   * Gets detected deadlocks
   */
  getDeadlocks(): Map<string, DeadlockInfo> {
    return new Map(this.deadlocks);
  }

  /**
   * Gets system statistics
   */
  getStatistics(): TransactionStatistics {
    return { ...this.statistics };
  }

  /**
   * Subscribes to conflict resolution events
   */
  subscribeToConflictEvents(type: 'transaction' | 'conflict' | 'deadlock'): Observable<AgentEvent> {
    switch (type) {
      case 'transaction':
        return this.transactionEventStream.asObservable();
      case 'conflict':
        return this.conflictEventStream.asObservable();
      case 'deadlock':
        return this.deadlockEventStream.asObservable();
      default:
        throw new Error(`Unknown event type: ${type}`);
    }
  }

  /**
   * Shuts down the conflict resolution system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ConflictResolution system');
    
    // Clear timers
    clearInterval(this.deadlockDetectionTimer);
    clearInterval(this.lockCleanupTimer);
    clearInterval(this.transactionCleanupTimer);
    
    // Abort all active transactions
    const activeTransactionIds = Array.from(this.transactions.keys());
    for (const transactionId of activeTransactionIds) {
      await this.abortTransaction(transactionId);
    }
    
    // Complete event streams
    this.transactionEventStream.complete();
    this.conflictEventStream.complete();
    this.deadlockEventStream.complete();
    
    // Clear data structures
    this.transactions.clear();
    this.resourceLocks.clear();
    this.resourceVersions.clear();
    this.activeConflicts.clear();
    this.deadlocks.clear();
    this.waitForGraph.clear();
    
    this.logger.info('ConflictResolution system shutdown complete');
  }
}