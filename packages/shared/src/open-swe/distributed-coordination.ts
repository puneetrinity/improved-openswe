import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { filter, timeout, take, map } from 'rxjs/operators';
import { 
  AgentProfile, 
  AgentMessage,
  AgentRole
} from './types.js';
import {
  AgentRegistry,
  AgentCommunicationHub,
  AgentEvent,
  RegistryOperationResult
} from './agent-registry.js';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';

/**
 * Distributed lock types
 */
export type LockType = 'exclusive' | 'shared' | 'read_write';

/**
 * Lock acquisition mode
 */
export type AcquisitionMode = 'blocking' | 'non_blocking' | 'timeout';

/**
 * Distributed lock configuration
 */
export interface DistributedLockConfig {
  /**
   * Lock identifier
   */
  lockId: string;
  
  /**
   * Lock type
   */
  type: LockType;
  
  /**
   * Lock timeout in milliseconds
   */
  timeout: number;
  
  /**
   * Auto-release timeout
   */
  autoReleaseTimeout: number;
  
  /**
   * Enable deadlock detection
   */
  deadlockDetection: boolean;
  
  /**
   * Priority for lock acquisition
   */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Lease duration for auto-renewal
   */
  leaseDuration?: number;
}

/**
 * Lock state information
 */
export interface LockState {
  /**
   * Lock identifier
   */
  lockId: string;
  
  /**
   * Current lock holders
   */
  holders: Set<string>;
  
  /**
   * Lock type
   */
  type: LockType;
  
  /**
   * Queue of waiting agents
   */
  waitQueue: LockRequest[];
  
  /**
   * Lock acquisition timestamp
   */
  acquiredAt: number;
  
  /**
   * Auto-release timer
   */
  autoReleaseTimer?: NodeJS.Timeout;
  
  /**
   * Total number of acquisitions
   */
  acquisitionCount: number;
  
  /**
   * Lock statistics
   */
  statistics: {
    totalAcquisitions: number;
    totalReleases: number;
    avgHoldTime: number;
    contentionCount: number;
  };
}

/**
 * Lock request information
 */
export interface LockRequest {
  /**
   * Request identifier
   */
  requestId: string;
  
  /**
   * Requesting agent ID
   */
  agentId: string;
  
  /**
   * Lock configuration
   */
  config: DistributedLockConfig;
  
  /**
   * Request timestamp
   */
  requestedAt: number;
  
  /**
   * Request priority
   */
  priority: number;
  
  /**
   * Timeout handle
   */
  timeoutHandle?: NodeJS.Timeout;
  
  /**
   * Promise resolvers
   */
  resolvers: {
    resolve: (success: boolean) => void;
    reject: (error: Error) => void;
  };
}

/**
 * Semaphore configuration
 */
export interface SemaphoreConfig {
  /**
   * Semaphore identifier
   */
  semaphoreId: string;
  
  /**
   * Maximum permits available
   */
  maxPermits: number;
  
  /**
   * Permit timeout in milliseconds
   */
  timeout: number;
  
  /**
   * Fair queuing (FIFO)
   */
  fairQueuing: boolean;
  
  /**
   * Auto-release timeout for permits
   */
  autoReleaseTimeout: number;
}

/**
 * Semaphore state
 */
export interface SemaphoreState {
  /**
   * Semaphore identifier
   */
  semaphoreId: string;
  
  /**
   * Maximum permits
   */
  maxPermits: number;
  
  /**
   * Available permits
   */
  availablePermits: number;
  
  /**
   * Current permit holders
   */
  holders: Map<string, { acquiredAt: number; autoReleaseTimer?: NodeJS.Timeout }>;
  
  /**
   * Queue of waiting requests
   */
  waitQueue: SemaphoreRequest[];
  
  /**
   * Semaphore statistics
   */
  statistics: {
    totalAcquisitions: number;
    totalReleases: number;
    avgWaitTime: number;
    maxConcurrentHolders: number;
  };
}

/**
 * Semaphore request
 */
export interface SemaphoreRequest {
  /**
   * Request identifier
   */
  requestId: string;
  
  /**
   * Requesting agent ID
   */
  agentId: string;
  
  /**
   * Number of permits requested
   */
  permits: number;
  
  /**
   * Request timestamp
   */
  requestedAt: number;
  
  /**
   * Timeout handle
   */
  timeoutHandle?: NodeJS.Timeout;
  
  /**
   * Promise resolvers
   */
  resolvers: {
    resolve: (acquired: boolean) => void;
    reject: (error: Error) => void;
  };
}

/**
 * Barrier configuration
 */
export interface BarrierConfig {
  /**
   * Barrier identifier
   */
  barrierId: string;
  
  /**
   * Number of parties that must reach the barrier
   */
  parties: number;
  
  /**
   * Barrier timeout in milliseconds
   */
  timeout: number;
  
  /**
   * Auto-reset after all parties arrive
   */
  autoReset: boolean;
  
  /**
   * Barrier action to execute when all parties arrive
   */
  barrierAction?: () => Promise<void>;
}

/**
 * Barrier state
 */
export interface BarrierState {
  /**
   * Barrier identifier
   */
  barrierId: string;
  
  /**
   * Required number of parties
   */
  parties: number;
  
  /**
   * Current number of waiting parties
   */
  waiting: Set<string>;
  
  /**
   * Barrier generation (for reset tracking)
   */
  generation: number;
  
  /**
   * Broken state
   */
  broken: boolean;
  
  /**
   * Timeout handle
   */
  timeoutHandle?: NodeJS.Timeout;
  
  /**
   * Barrier statistics
   */
  statistics: {
    totalCycles: number;
    avgWaitTime: number;
    timeoutCount: number;
  };
}

/**
 * Leader election configuration
 */
export interface LeaderElectionConfig {
  /**
   * Election group identifier
   */
  groupId: string;
  
  /**
   * Election timeout in milliseconds
   */
  electionTimeout: number;
  
  /**
   * Heartbeat interval in milliseconds
   */
  heartbeatInterval: number;
  
  /**
   * Leader lease duration
   */
  leaseDuration: number;
  
  /**
   * Enable automatic re-election on leader failure
   */
  autoReElection: boolean;
}

/**
 * Leader election state
 */
export interface LeaderElectionState {
  /**
   * Group identifier
   */
  groupId: string;
  
  /**
   * Current leader agent ID
   */
  leaderId: string | null;
  
  /**
   * Leader term/generation
   */
  term: number;
  
  /**
   * Candidate agents
   */
  candidates: Set<string>;
  
  /**
   * Election state
   */
  state: 'idle' | 'election' | 'leader_active' | 'leader_failed';
  
  /**
   * Last heartbeat timestamp
   */
  lastHeartbeat: number;
  
  /**
   * Election statistics
   */
  statistics: {
    totalElections: number;
    avgElectionTime: number;
    leaderChanges: number;
  };
}

/**
 * Consensus protocol types
 */
export type ConsensusProtocol = 'raft' | 'pbft' | 'simple_majority';

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  /**
   * Protocol type
   */
  protocol: ConsensusProtocol;
  
  /**
   * Consensus group identifier
   */
  groupId: string;
  
  /**
   * Required quorum size
   */
  quorumSize: number;
  
  /**
   * Consensus timeout
   */
  timeout: number;
  
  /**
   * Maximum number of consensus rounds
   */
  maxRounds: number;
}

/**
 * Consensus proposal
 */
export interface ConsensusProposal {
  /**
   * Proposal identifier
   */
  proposalId: string;
  
  /**
   * Proposer agent ID
   */
  proposerId: string;
  
  /**
   * Proposal data
   */
  data: Record<string, unknown>;
  
  /**
   * Proposal timestamp
   */
  proposedAt: number;
  
  /**
   * Votes received
   */
  votes: Map<string, 'accept' | 'reject' | 'abstain'>;
  
  /**
   * Consensus round
   */
  round: number;
  
  /**
   * Proposal status
   */
  status: 'proposed' | 'accepted' | 'rejected' | 'timeout';
}

/**
 * Distributed coordination system providing locks, semaphores, barriers,
 * leader election, and consensus mechanisms for multi-agent environments.
 */
export class DistributedCoordination {
  private readonly logger = createLogger(LogLevel.INFO, 'DistributedCoordination');
  
  /**
   * Agent registry
   */
  private readonly registry: AgentRegistry;
  
  /**
   * Communication hub
   */
  private readonly communicationHub: AgentCommunicationHub;
  
  /**
   * Distributed locks state
   */
  private readonly locks = new Map<string, LockState>();
  
  /**
   * Semaphores state
   */
  private readonly semaphores = new Map<string, SemaphoreState>();
  
  /**
   * Barriers state
   */
  private readonly barriers = new Map<string, BarrierState>();
  
  /**
   * Leader election states
   */
  private readonly leaderElections = new Map<string, LeaderElectionState>();
  
  /**
   * Active consensus proposals
   */
  private readonly consensusProposals = new Map<string, ConsensusProposal>();
  
  /**
   * Event streams
   */
  private readonly lockEventStream = new Subject<AgentEvent>();
  private readonly semaphoreEventStream = new Subject<AgentEvent>();
  private readonly barrierEventStream = new Subject<AgentEvent>();
  private readonly leaderElectionEventStream = new Subject<AgentEvent>();
  private readonly consensusEventStream = new Subject<AgentEvent>();
  
  /**
   * Deadlock detection
   */
  private readonly deadlockDetectionInterval: NodeJS.Timeout;
  
  /**
   * System configuration
   */
  private readonly config = {
    deadlockDetectionInterval: 10000, // 10 seconds
    defaultLockTimeout: 30000, // 30 seconds
    defaultSemaphoreTimeout: 30000,
    defaultBarrierTimeout: 60000,
    maxLockHoldTime: 300000, // 5 minutes
    leaderHeartbeatInterval: 5000,
    consensusTimeout: 30000
  };

  constructor(registry: AgentRegistry, communicationHub: AgentCommunicationHub) {
    this.registry = registry;
    this.communicationHub = communicationHub;
    
    // Initialize deadlock detection
    this.deadlockDetectionInterval = setInterval(() => {
      this.detectDeadlocks();
    }, this.config.deadlockDetectionInterval);
    
    this.logger.info('DistributedCoordination system initialized');
  }

  /**
   * Acquires a distributed lock
   * 
   * @param agentId - Agent requesting the lock
   * @param config - Lock configuration
   * @param mode - Acquisition mode
   * @returns Promise resolving to acquisition success
   */
  async acquireLock(
    agentId: string,
    config: DistributedLockConfig,
    mode: AcquisitionMode = 'blocking'
  ): Promise<boolean> {
    const requestId = `lock_req_${config.lockId}_${agentId}_${Date.now()}`;
    
    this.logger.info('Lock acquisition requested', {
      requestId,
      agentId,
      lockId: config.lockId,
      type: config.type,
      mode
    });

    // Get or create lock state
    const lockState = this.getOrCreateLock(config);
    
    // Check if lock can be acquired immediately
    if (this.canAcquireLock(agentId, lockState, config.type)) {
      return this.grantLock(agentId, lockState, config);
    }
    
    // Handle non-blocking mode
    if (mode === 'non_blocking') {
      this.logger.info('Lock acquisition failed - non-blocking mode', { requestId });
      return false;
    }
    
    // Queue the request for blocking mode
    return new Promise<boolean>((resolve, reject) => {
      const request: LockRequest = {
        requestId,
        agentId,
        config,
        requestedAt: Date.now(),
        priority: this.getLockPriority(config.priority),
        resolvers: { resolve, reject }
      };
      
      // Set timeout if specified
      if (mode === 'timeout' || config.timeout > 0) {
        const timeoutMs = mode === 'timeout' ? config.timeout : this.config.defaultLockTimeout;
        request.timeoutHandle = setTimeout(() => {
          this.handleLockTimeout(request);
        }, timeoutMs);
      }
      
      // Add to queue (sorted by priority)
      lockState.waitQueue.push(request);
      lockState.waitQueue.sort((a, b) => b.priority - a.priority);
      
      lockState.statistics.contentionCount++;
      
      this.emitLockEvent({
        id: `lock_queued_${requestId}`,
        type: 'message_received',
        agentId,
        payload: {
          lockId: config.lockId,
          queuePosition: lockState.waitQueue.length
        },
        timestamp: Date.now(),
        priority: 'medium'
      });
    });
  }

  /**
   * Releases a distributed lock
   * 
   * @param agentId - Agent releasing the lock
   * @param lockId - Lock identifier
   * @returns Promise resolving to operation result
   */
  async releaseLock(agentId: string, lockId: string): Promise<RegistryOperationResult> {
    const lockState = this.locks.get(lockId);
    
    if (!lockState) {
      return {
        success: false,
        error: `Lock ${lockId} not found`,
        executionTime: 0
      };
    }
    
    if (!lockState.holders.has(agentId)) {
      return {
        success: false,
        error: `Agent ${agentId} does not hold lock ${lockId}`,
        executionTime: 0
      };
    }
    
    this.logger.info('Releasing lock', { agentId, lockId });
    
    // Remove from holders
    lockState.holders.delete(agentId);
    
    // Clear auto-release timer
    if (lockState.autoReleaseTimer) {
      clearTimeout(lockState.autoReleaseTimer);
      lockState.autoReleaseTimer = undefined;
    }
    
    // Update statistics
    const holdTime = Date.now() - lockState.acquiredAt;
    lockState.statistics.totalReleases++;
    lockState.statistics.avgHoldTime = 
      (lockState.statistics.avgHoldTime + holdTime) / 2;
    
    // Process waiting queue
    this.processLockQueue(lockState);
    
    this.emitLockEvent({
      id: `lock_released_${lockId}_${agentId}`,
      type: 'message_received',
      agentId,
      payload: { lockId, holdTime },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    return {
      success: true,
      metadata: { lockId, holdTime },
      executionTime: 0
    };
  }

  /**
   * Acquires semaphore permits
   * 
   * @param agentId - Agent requesting permits
   * @param config - Semaphore configuration
   * @param permits - Number of permits to acquire
   * @returns Promise resolving to acquisition success
   */
  async acquireSemaphore(
    agentId: string,
    config: SemaphoreConfig,
    permits: number = 1
  ): Promise<boolean> {
    const requestId = `sem_req_${config.semaphoreId}_${agentId}_${Date.now()}`;
    
    this.logger.info('Semaphore acquisition requested', {
      requestId,
      agentId,
      semaphoreId: config.semaphoreId,
      permits
    });
    
    if (permits <= 0 || permits > config.maxPermits) {
      throw new Error(`Invalid permit count: ${permits}`);
    }
    
    // Get or create semaphore state
    const semState = this.getOrCreateSemaphore(config);
    
    // Check if permits can be acquired immediately
    if (semState.availablePermits >= permits) {
      return this.grantSemaphorePermits(agentId, semState, permits, config);
    }
    
    // Queue the request
    return new Promise<boolean>((resolve, reject) => {
      const request: SemaphoreRequest = {
        requestId,
        agentId,
        permits,
        requestedAt: Date.now(),
        resolvers: { resolve, reject }
      };
      
      // Set timeout
      request.timeoutHandle = setTimeout(() => {
        this.handleSemaphoreTimeout(request);
      }, config.timeout || this.config.defaultSemaphoreTimeout);
      
      // Add to queue (FIFO if fair queuing)
      if (config.fairQueuing) {
        semState.waitQueue.push(request);
      } else {
        // Sort by permits (smaller requests first for better utilization)
        semState.waitQueue.push(request);
        semState.waitQueue.sort((a, b) => a.permits - b.permits);
      }
      
      this.emitSemaphoreEvent({
        id: `semaphore_queued_${requestId}`,
        type: 'message_received',
        agentId,
        payload: {
          semaphoreId: config.semaphoreId,
          permits,
          queuePosition: semState.waitQueue.length
        },
        timestamp: Date.now(),
        priority: 'medium'
      });
    });
  }

  /**
   * Releases semaphore permits
   * 
   * @param agentId - Agent releasing permits
   * @param semaphoreId - Semaphore identifier
   * @param permits - Number of permits to release
   * @returns Promise resolving to operation result
   */
  async releaseSemaphore(
    agentId: string,
    semaphoreId: string,
    permits: number = 1
  ): Promise<RegistryOperationResult> {
    const semState = this.semaphores.get(semaphoreId);
    
    if (!semState) {
      return {
        success: false,
        error: `Semaphore ${semaphoreId} not found`,
        executionTime: 0
      };
    }
    
    const holderInfo = semState.holders.get(agentId);
    if (!holderInfo) {
      return {
        success: false,
        error: `Agent ${agentId} does not hold permits for semaphore ${semaphoreId}`,
        executionTime: 0
      };
    }
    
    this.logger.info('Releasing semaphore permits', { agentId, semaphoreId, permits });
    
    // Remove from holders
    semState.holders.delete(agentId);
    
    // Clear auto-release timer
    if (holderInfo.autoReleaseTimer) {
      clearTimeout(holderInfo.autoReleaseTimer);
    }
    
    // Return permits to available pool
    semState.availablePermits = Math.min(
      semState.availablePermits + permits,
      semState.maxPermits
    );
    
    // Update statistics
    const holdTime = Date.now() - holderInfo.acquiredAt;
    semState.statistics.totalReleases++;
    
    // Process waiting queue
    this.processSemaphoreQueue(semState);
    
    this.emitSemaphoreEvent({
      id: `semaphore_released_${semaphoreId}_${agentId}`,
      type: 'message_received',
      agentId,
      payload: { semaphoreId, permits, holdTime },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    return {
      success: true,
      metadata: { semaphoreId, permits, holdTime },
      executionTime: 0
    };
  }

  /**
   * Waits at a barrier until all parties arrive
   * 
   * @param agentId - Agent waiting at barrier
   * @param config - Barrier configuration
   * @returns Promise resolving when all parties arrive
   */
  async awaitBarrier(agentId: string, config: BarrierConfig): Promise<boolean> {
    this.logger.info('Agent arrived at barrier', {
      agentId,
      barrierId: config.barrierId,
      parties: config.parties
    });
    
    // Get or create barrier state
    const barrierState = this.getOrCreateBarrier(config);
    
    // Check if barrier is broken
    if (barrierState.broken) {
      throw new Error(`Barrier ${config.barrierId} is broken`);
    }
    
    // Add agent to waiting list
    barrierState.waiting.add(agentId);
    
    this.emitBarrierEvent({
      id: `barrier_arrival_${config.barrierId}_${agentId}`,
      type: 'message_received',
      agentId,
      payload: {
        barrierId: config.barrierId,
        waitingCount: barrierState.waiting.size,
        totalParties: config.parties
      },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    // Check if all parties have arrived
    if (barrierState.waiting.size >= config.parties) {
      return this.releaseBarrier(barrierState, config);
    }
    
    // Wait for other parties
    return new Promise<boolean>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.handleBarrierTimeout(agentId, barrierState, reject);
      }, config.timeout || this.config.defaultBarrierTimeout);
      
      // Store resolver for later use
      (barrierState as any).resolvers = (barrierState as any).resolvers || [];
      (barrierState as any).resolvers.push({ resolve, reject, agentId, timeoutHandle });
    });
  }

  /**
   * Starts leader election for a group
   * 
   * @param agentId - Agent participating in election
   * @param config - Election configuration
   * @returns Promise resolving to election result
   */
  async startLeaderElection(
    agentId: string,
    config: LeaderElectionConfig
  ): Promise<{ isLeader: boolean; leaderId: string | null }> {
    this.logger.info('Starting leader election', {
      agentId,
      groupId: config.groupId
    });
    
    // Get or create election state
    const electionState = this.getOrCreateLeaderElection(config);
    
    // Add agent as candidate
    electionState.candidates.add(agentId);
    
    // Start election if not already in progress
    if (electionState.state === 'idle') {
      return this.conductElection(electionState, config);
    }
    
    // Wait for ongoing election to complete
    return new Promise((resolve) => {
      const checkElection = () => {
        if (electionState.state === 'leader_active') {
          resolve({
            isLeader: electionState.leaderId === agentId,
            leaderId: electionState.leaderId
          });
        } else {
          setTimeout(checkElection, 100);
        }
      };
      checkElection();
    });
  }

  /**
   * Proposes a value for consensus
   * 
   * @param agentId - Proposing agent
   * @param config - Consensus configuration
   * @param data - Proposal data
   * @returns Promise resolving to consensus result
   */
  async proposeConsensus(
    agentId: string,
    config: ConsensusConfig,
    data: Record<string, unknown>
  ): Promise<{ accepted: boolean; finalValue?: Record<string, unknown> }> {
    const proposalId = `consensus_${config.groupId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting consensus proposal', {
      proposalId,
      agentId,
      groupId: config.groupId,
      protocol: config.protocol
    });
    
    const proposal: ConsensusProposal = {
      proposalId,
      proposerId: agentId,
      data,
      proposedAt: Date.now(),
      votes: new Map(),
      round: 1,
      status: 'proposed'
    };
    
    this.consensusProposals.set(proposalId, proposal);
    
    // Conduct consensus based on protocol
    switch (config.protocol) {
      case 'simple_majority':
        return this.conductSimpleMajorityConsensus(proposal, config);
      case 'raft':
        return this.conductRaftConsensus(proposal, config);
      case 'pbft':
        return this.conductPBFTConsensus(proposal, config);
      default:
        throw new Error(`Unsupported consensus protocol: ${config.protocol}`);
    }
  }

  /**
   * Gets or creates a lock state
   * 
   * @private
   */
  private getOrCreateLock(config: DistributedLockConfig): LockState {
    let lockState = this.locks.get(config.lockId);
    
    if (!lockState) {
      lockState = {
        lockId: config.lockId,
        holders: new Set(),
        type: config.type,
        waitQueue: [],
        acquiredAt: 0,
        acquisitionCount: 0,
        statistics: {
          totalAcquisitions: 0,
          totalReleases: 0,
          avgHoldTime: 0,
          contentionCount: 0
        }
      };
      
      this.locks.set(config.lockId, lockState);
    }
    
    return lockState;
  }

  /**
   * Checks if a lock can be acquired
   * 
   * @private
   */
  private canAcquireLock(agentId: string, lockState: LockState, lockType: LockType): boolean {
    // If no current holders, lock can be acquired
    if (lockState.holders.size === 0) {
      return true;
    }
    
    // If agent already holds the lock
    if (lockState.holders.has(agentId)) {
      return true; // Re-entrant lock
    }
    
    // For shared locks, multiple readers can coexist
    if (lockType === 'shared' && lockState.type === 'shared') {
      return true;
    }
    
    // For read-write locks, multiple readers can coexist
    if (lockType === 'shared' && lockState.type === 'read_write') {
      // Check if all current holders are readers
      return lockState.holders.size > 0; // Simplified - would need to track reader vs writer
    }
    
    return false;
  }

  /**
   * Grants a lock to an agent
   * 
   * @private
   */
  private grantLock(agentId: string, lockState: LockState, config: DistributedLockConfig): boolean {
    lockState.holders.add(agentId);
    lockState.acquiredAt = Date.now();
    lockState.acquisitionCount++;
    lockState.statistics.totalAcquisitions++;
    
    // Set auto-release timer
    if (config.autoReleaseTimeout > 0) {
      lockState.autoReleaseTimer = setTimeout(() => {
        this.releaseLock(agentId, config.lockId);
      }, config.autoReleaseTimeout);
    }
    
    this.logger.info('Lock granted', { agentId, lockId: config.lockId });
    
    this.emitLockEvent({
      id: `lock_acquired_${config.lockId}_${agentId}`,
      type: 'message_received',
      agentId,
      payload: { lockId: config.lockId },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    return true;
  }

  /**
   * Processes the lock wait queue
   * 
   * @private
   */
  private processLockQueue(lockState: LockState): void {
    while (lockState.waitQueue.length > 0) {
      const request = lockState.waitQueue[0];
      
      if (this.canAcquireLock(request.agentId, lockState, request.config.type)) {
        // Remove from queue
        lockState.waitQueue.shift();
        
        // Clear timeout
        if (request.timeoutHandle) {
          clearTimeout(request.timeoutHandle);
        }
        
        // Grant lock
        const granted = this.grantLock(request.agentId, lockState, request.config);
        request.resolvers.resolve(granted);
      } else {
        break; // Cannot grant to first in queue, so stop processing
      }
    }
  }

  /**
   * Handles lock acquisition timeout
   * 
   * @private
   */
  private handleLockTimeout(request: LockRequest): void {
    this.logger.warn('Lock acquisition timeout', {
      requestId: request.requestId,
      agentId: request.agentId,
      lockId: request.config.lockId
    });
    
    // Remove from queue
    const lockState = this.locks.get(request.config.lockId);
    if (lockState) {
      const index = lockState.waitQueue.findIndex(r => r.requestId === request.requestId);
      if (index >= 0) {
        lockState.waitQueue.splice(index, 1);
      }
    }
    
    request.resolvers.resolve(false);
  }

  /**
   * Gets lock priority value
   * 
   * @private
   */
  private getLockPriority(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Gets or creates a semaphore state
   * 
   * @private
   */
  private getOrCreateSemaphore(config: SemaphoreConfig): SemaphoreState {
    let semState = this.semaphores.get(config.semaphoreId);
    
    if (!semState) {
      semState = {
        semaphoreId: config.semaphoreId,
        maxPermits: config.maxPermits,
        availablePermits: config.maxPermits,
        holders: new Map(),
        waitQueue: [],
        statistics: {
          totalAcquisitions: 0,
          totalReleases: 0,
          avgWaitTime: 0,
          maxConcurrentHolders: 0
        }
      };
      
      this.semaphores.set(config.semaphoreId, semState);
    }
    
    return semState;
  }

  /**
   * Grants semaphore permits to an agent
   * 
   * @private
   */
  private grantSemaphorePermits(
    agentId: string,
    semState: SemaphoreState,
    permits: number,
    config: SemaphoreConfig
  ): boolean {
    if (semState.availablePermits < permits) {
      return false;
    }
    
    semState.availablePermits -= permits;
    
    const holderInfo = {
      acquiredAt: Date.now(),
      autoReleaseTimer: undefined as NodeJS.Timeout | undefined
    };
    
    // Set auto-release timer
    if (config.autoReleaseTimeout > 0) {
      holderInfo.autoReleaseTimer = setTimeout(() => {
        this.releaseSemaphore(agentId, config.semaphoreId, permits);
      }, config.autoReleaseTimeout);
    }
    
    semState.holders.set(agentId, holderInfo);
    
    // Update statistics
    semState.statistics.totalAcquisitions++;
    semState.statistics.maxConcurrentHolders = Math.max(
      semState.statistics.maxConcurrentHolders,
      semState.holders.size
    );
    
    this.logger.info('Semaphore permits granted', {
      agentId,
      semaphoreId: config.semaphoreId,
      permits,
      availablePermits: semState.availablePermits
    });
    
    this.emitSemaphoreEvent({
      id: `semaphore_acquired_${config.semaphoreId}_${agentId}`,
      type: 'message_received',
      agentId,
      payload: {
        semaphoreId: config.semaphoreId,
        permits,
        availablePermits: semState.availablePermits
      },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    return true;
  }

  /**
   * Processes the semaphore wait queue
   * 
   * @private
   */
  private processSemaphoreQueue(semState: SemaphoreState): void {
    let processed = false;
    
    for (let i = 0; i < semState.waitQueue.length; i++) {
      const request = semState.waitQueue[i];
      
      if (semState.availablePermits >= request.permits) {
        // Remove from queue
        semState.waitQueue.splice(i, 1);
        i--; // Adjust index after removal
        
        // Clear timeout
        if (request.timeoutHandle) {
          clearTimeout(request.timeoutHandle);
        }
        
        // Grant permits (create temporary config)
        const tempConfig: SemaphoreConfig = {
          semaphoreId: semState.semaphoreId,
          maxPermits: semState.maxPermits,
          timeout: 0,
          fairQueuing: false,
          autoReleaseTimeout: 0
        };
        
        const granted = this.grantSemaphorePermits(
          request.agentId,
          semState,
          request.permits,
          tempConfig
        );
        
        request.resolvers.resolve(granted);
        processed = true;
        
        // If fair queuing, stop after processing one request
        if (processed && semState.waitQueue.length > 0) {
          // Check if this was a fair queuing scenario (would need to be tracked)
          break;
        }
      }
    }
  }

  /**
   * Handles semaphore timeout
   * 
   * @private
   */
  private handleSemaphoreTimeout(request: SemaphoreRequest): void {
    this.logger.warn('Semaphore acquisition timeout', {
      requestId: request.requestId,
      agentId: request.agentId
    });
    
    // Remove from queue
    const semState = this.semaphores.values();
    for (const state of semState) {
      const index = state.waitQueue.findIndex(r => r.requestId === request.requestId);
      if (index >= 0) {
        state.waitQueue.splice(index, 1);
        break;
      }
    }
    
    request.resolvers.resolve(false);
  }

  /**
   * Gets or creates a barrier state
   * 
   * @private
   */
  private getOrCreateBarrier(config: BarrierConfig): BarrierState {
    let barrierState = this.barriers.get(config.barrierId);
    
    if (!barrierState) {
      barrierState = {
        barrierId: config.barrierId,
        parties: config.parties,
        waiting: new Set(),
        generation: 0,
        broken: false,
        statistics: {
          totalCycles: 0,
          avgWaitTime: 0,
          timeoutCount: 0
        }
      };
      
      this.barriers.set(config.barrierId, barrierState);
    }
    
    return barrierState;
  }

  /**
   * Releases all parties waiting at a barrier
   * 
   * @private
   */
  private async releaseBarrier(barrierState: BarrierState, config: BarrierConfig): Promise<boolean> {
    this.logger.info('Releasing barrier', {
      barrierId: config.barrierId,
      waitingParties: barrierState.waiting.size
    });
    
    // Execute barrier action if provided
    if (config.barrierAction) {
      try {
        await config.barrierAction();
      } catch (error) {
        this.logger.error('Barrier action failed', {
          barrierId: config.barrierId,
          error: error instanceof Error ? error.message : error
        });
        
        // Break the barrier
        barrierState.broken = true;
        return false;
      }
    }
    
    // Release all waiting parties
    const resolvers = (barrierState as any).resolvers || [];
    resolvers.forEach((resolver: any) => {
      if (resolver.timeoutHandle) {
        clearTimeout(resolver.timeoutHandle);
      }
      resolver.resolve(true);
    });
    
    // Update statistics
    barrierState.statistics.totalCycles++;
    
    // Reset barrier if auto-reset is enabled
    if (config.autoReset) {
      barrierState.waiting.clear();
      barrierState.generation++;
      (barrierState as any).resolvers = [];
    }
    
    this.emitBarrierEvent({
      id: `barrier_released_${config.barrierId}`,
      type: 'message_received',
      agentId: 'system',
      payload: {
        barrierId: config.barrierId,
        generation: barrierState.generation,
        partiesReleased: barrierState.waiting.size
      },
      timestamp: Date.now(),
      priority: 'medium'
    });
    
    return true;
  }

  /**
   * Handles barrier timeout
   * 
   * @private
   */
  private handleBarrierTimeout(
    agentId: string,
    barrierState: BarrierState,
    reject: (error: Error) => void
  ): void {
    this.logger.warn('Barrier timeout', {
      agentId,
      barrierId: barrierState.barrierId
    });
    
    barrierState.statistics.timeoutCount++;
    barrierState.broken = true;
    
    reject(new Error(`Barrier ${barrierState.barrierId} timeout`));
  }

  /**
   * Gets or creates a leader election state
   * 
   * @private
   */
  private getOrCreateLeaderElection(config: LeaderElectionConfig): LeaderElectionState {
    let electionState = this.leaderElections.get(config.groupId);
    
    if (!electionState) {
      electionState = {
        groupId: config.groupId,
        leaderId: null,
        term: 0,
        candidates: new Set(),
        state: 'idle',
        lastHeartbeat: Date.now(),
        statistics: {
          totalElections: 0,
          avgElectionTime: 0,
          leaderChanges: 0
        }
      };
      
      this.leaderElections.set(config.groupId, electionState);
    }
    
    return electionState;
  }

  /**
   * Conducts a leader election
   * 
   * @private
   */
  private async conductElection(
    electionState: LeaderElectionState,
    config: LeaderElectionConfig
  ): Promise<{ isLeader: boolean; leaderId: string | null }> {
    electionState.state = 'election';
    electionState.term++;
    electionState.statistics.totalElections++;
    
    const electionStart = Date.now();
    
    this.logger.info('Conducting leader election', {
      groupId: config.groupId,
      term: electionState.term,
      candidates: Array.from(electionState.candidates)
    });
    
    // Simple election algorithm - highest priority agent becomes leader
    const candidateArray = Array.from(electionState.candidates);
    const selectedLeader = candidateArray.reduce((leader, candidate) => {
      // Simple priority based on agent ID (in real implementation, would use more sophisticated criteria)
      return candidate > leader ? candidate : leader;
    });
    
    electionState.leaderId = selectedLeader;
    electionState.state = 'leader_active';
    electionState.lastHeartbeat = Date.now();
    
    const electionTime = Date.now() - electionStart;
    electionState.statistics.avgElectionTime = 
      (electionState.statistics.avgElectionTime + electionTime) / 2;
    
    this.emitLeaderElectionEvent({
      id: `leader_elected_${config.groupId}_${electionState.term}`,
      type: 'message_received',
      agentId: selectedLeader,
      payload: {
        groupId: config.groupId,
        leaderId: selectedLeader,
        term: electionState.term,
        electionTime
      },
      timestamp: Date.now(),
      priority: 'high'
    });
    
    // Start leader heartbeat
    this.startLeaderHeartbeat(electionState, config);
    
    return {
      isLeader: true,
      leaderId: selectedLeader
    };
  }

  /**
   * Starts leader heartbeat monitoring
   * 
   * @private
   */
  private startLeaderHeartbeat(
    electionState: LeaderElectionState,
    config: LeaderElectionConfig
  ): void {
    const heartbeatInterval = setInterval(() => {
      if (electionState.state !== 'leader_active') {
        clearInterval(heartbeatInterval);
        return;
      }
      
      const now = Date.now();
      const timeSinceHeartbeat = now - electionState.lastHeartbeat;
      
      if (timeSinceHeartbeat > config.heartbeatInterval * 2) {
        // Leader failure detected
        this.logger.warn('Leader failure detected', {
          groupId: config.groupId,
          leaderId: electionState.leaderId,
          timeSinceHeartbeat
        });
        
        electionState.state = 'leader_failed';
        electionState.statistics.leaderChanges++;
        
        // Trigger re-election if auto re-election is enabled
        if (config.autoReElection) {
          setTimeout(() => {
            this.conductElection(electionState, config);
          }, config.electionTimeout);
        }
        
        clearInterval(heartbeatInterval);
      } else {
        // Send heartbeat
        electionState.lastHeartbeat = now;
      }
    }, config.heartbeatInterval);
  }

  /**
   * Conducts simple majority consensus
   * 
   * @private
   */
  private async conductSimpleMajorityConsensus(
    proposal: ConsensusProposal,
    config: ConsensusConfig
  ): Promise<{ accepted: boolean; finalValue?: Record<string, unknown> }> {
    this.logger.info('Starting simple majority consensus', {
      proposalId: proposal.proposalId,
      groupId: config.groupId
    });
    
    // Get all agents in the consensus group
    const allAgents = this.registry.getAllAgents();
    const groupAgents = allAgents.filter(agent => {
      // In a real implementation, agents would be filtered by group membership
      return agent.status === 'active';
    }).slice(0, config.quorumSize);
    
    // Simulate voting process
    return new Promise((resolve) => {
      let votesReceived = 0;
      let acceptVotes = 0;
      
      const processVote = (vote: 'accept' | 'reject' | 'abstain') => {
        votesReceived++;
        if (vote === 'accept') {
          acceptVotes++;
        }
        
        proposal.votes.set(`agent_${votesReceived}`, vote);
        
        // Check if we have a majority
        const majorityThreshold = Math.floor(groupAgents.length / 2) + 1;
        
        if (acceptVotes >= majorityThreshold) {
          proposal.status = 'accepted';
          resolve({ accepted: true, finalValue: proposal.data });
        } else if (votesReceived >= groupAgents.length) {
          // All votes received, check final result
          if (acceptVotes >= majorityThreshold) {
            proposal.status = 'accepted';
            resolve({ accepted: true, finalValue: proposal.data });
          } else {
            proposal.status = 'rejected';
            resolve({ accepted: false });
          }
        }
      };
      
      // Simulate vote collection
      groupAgents.forEach((_, index) => {
        setTimeout(() => {
          // Simulate vote (90% acceptance rate)
          const vote: 'accept' | 'reject' | 'abstain' = 
            Math.random() > 0.1 ? 'accept' : 'reject';
          processVote(vote);
        }, Math.random() * 1000); // Random delay up to 1 second
      });
      
      // Set overall timeout
      setTimeout(() => {
        if (proposal.status === 'proposed') {
          proposal.status = 'timeout';
          resolve({ accepted: false });
        }
      }, config.timeout || this.config.consensusTimeout);
    });
  }

  /**
   * Conducts Raft consensus (simplified)
   * 
   * @private
   */
  private async conductRaftConsensus(
    proposal: ConsensusProposal,
    config: ConsensusConfig
  ): Promise<{ accepted: boolean; finalValue?: Record<string, unknown> }> {
    // Simplified Raft implementation
    this.logger.info('Starting Raft consensus', {
      proposalId: proposal.proposalId,
      groupId: config.groupId
    });
    
    // In a real Raft implementation, this would involve leader election,
    // log replication, and commit acknowledgments
    
    // For now, simulate a simplified version
    return this.conductSimpleMajorityConsensus(proposal, config);
  }

  /**
   * Conducts PBFT consensus (simplified)
   * 
   * @private
   */
  private async conductPBFTConsensus(
    proposal: ConsensusProposal,
    config: ConsensusConfig
  ): Promise<{ accepted: boolean; finalValue?: Record<string, unknown> }> {
    // Simplified PBFT implementation
    this.logger.info('Starting PBFT consensus', {
      proposalId: proposal.proposalId,
      groupId: config.groupId
    });
    
    // PBFT requires 2f+1 nodes to tolerate f byzantine failures
    // For now, simulate a simplified version
    return this.conductSimpleMajorityConsensus(proposal, config);
  }

  /**
   * Detects potential deadlocks in the system
   * 
   * @private
   */
  private detectDeadlocks(): void {
    // Build dependency graph
    const dependencyGraph = new Map<string, Set<string>>();
    
    for (const lockState of this.locks.values()) {
      for (const request of lockState.waitQueue) {
        const waitingAgent = request.agentId;
        const holdingAgents = Array.from(lockState.holders);
        
        if (!dependencyGraph.has(waitingAgent)) {
          dependencyGraph.set(waitingAgent, new Set());
        }
        
        holdingAgents.forEach(holder => {
          dependencyGraph.get(waitingAgent)!.add(holder);
        });
      }
    }
    
    // Check for cycles (simplified cycle detection)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = dependencyGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && hasCycle(neighbor)) {
          return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of dependencyGraph.keys()) {
      if (!visited.has(node) && hasCycle(node)) {
        this.logger.warn('Deadlock detected', { node });
        // In a real implementation, would implement deadlock resolution
        break;
      }
    }
  }

  /**
   * Emits lock-related events
   * 
   * @private
   */
  private emitLockEvent(event: AgentEvent): void {
    this.lockEventStream.next(event);
  }

  /**
   * Emits semaphore-related events
   * 
   * @private
   */
  private emitSemaphoreEvent(event: AgentEvent): void {
    this.semaphoreEventStream.next(event);
  }

  /**
   * Emits barrier-related events
   * 
   * @private
   */
  private emitBarrierEvent(event: AgentEvent): void {
    this.barrierEventStream.next(event);
  }

  /**
   * Emits leader election events
   * 
   * @private
   */
  private emitLeaderElectionEvent(event: AgentEvent): void {
    this.leaderElectionEventStream.next(event);
  }

  /**
   * Emits consensus events
   * 
   * @private
   */
  private emitConsensusEvent(event: AgentEvent): void {
    this.consensusEventStream.next(event);
  }

  /**
   * Gets lock statistics
   */
  getLockStatistics(): Map<string, LockState['statistics'] & { currentHolders: number; queueSize: number }> {
    const stats = new Map();
    
    for (const [lockId, state] of this.locks) {
      stats.set(lockId, {
        ...state.statistics,
        currentHolders: state.holders.size,
        queueSize: state.waitQueue.length
      });
    }
    
    return stats;
  }

  /**
   * Gets semaphore statistics
   */
  getSemaphoreStatistics(): Map<string, SemaphoreState['statistics'] & { availablePermits: number; queueSize: number }> {
    const stats = new Map();
    
    for (const [semId, state] of this.semaphores) {
      stats.set(semId, {
        ...state.statistics,
        availablePermits: state.availablePermits,
        queueSize: state.waitQueue.length
      });
    }
    
    return stats;
  }

  /**
   * Subscribes to coordination events
   */
  subscribeToCoordinationEvents(type: 'lock' | 'semaphore' | 'barrier' | 'leader_election' | 'consensus'): Observable<AgentEvent> {
    switch (type) {
      case 'lock':
        return this.lockEventStream.asObservable();
      case 'semaphore':
        return this.semaphoreEventStream.asObservable();
      case 'barrier':
        return this.barrierEventStream.asObservable();
      case 'leader_election':
        return this.leaderElectionEventStream.asObservable();
      case 'consensus':
        return this.consensusEventStream.asObservable();
      default:
        throw new Error(`Unknown coordination event type: ${type}`);
    }
  }

  /**
   * Shuts down the coordination system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down DistributedCoordination system');
    
    // Clear deadlock detection interval
    clearInterval(this.deadlockDetectionInterval);
    
    // Release all locks
    for (const [lockId, lockState] of this.locks) {
      for (const holderId of lockState.holders) {
        await this.releaseLock(holderId, lockId);
      }
    }
    
    // Release all semaphore permits
    for (const [semId, semState] of this.semaphores) {
      for (const holderId of semState.holders.keys()) {
        await this.releaseSemaphore(holderId, semId);
      }
    }
    
    // Break all barriers
    for (const [, barrierState] of this.barriers) {
      barrierState.broken = true;
    }
    
    // Complete all event streams
    this.lockEventStream.complete();
    this.semaphoreEventStream.complete();
    this.barrierEventStream.complete();
    this.leaderElectionEventStream.complete();
    this.consensusEventStream.complete();
    
    // Clear all data structures
    this.locks.clear();
    this.semaphores.clear();
    this.barriers.clear();
    this.leaderElections.clear();
    this.consensusProposals.clear();
    
    this.logger.info('DistributedCoordination system shutdown complete');
  }
}