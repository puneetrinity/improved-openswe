import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { 
  map, 
  filter, 
  debounceTime, 
  scan, 
  windowTime,
  switchMap,
  retry,
  catchError,
  timeout
} from 'rxjs/operators';
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
 * Circuit breaker states
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

/**
 * Bulkhead isolation strategies
 */
export type BulkheadStrategy = 'thread_pool' | 'semaphore' | 'queue_based' | 'resource_pool';

/**
 * Adaptive optimization strategies
 */
export type OptimizationStrategy = 
  | 'load_based'
  | 'latency_based' 
  | 'throughput_based'
  | 'resource_based'
  | 'ml_based';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Circuit breaker identifier
   */
  id: string;
  
  /**
   * Failure threshold to open circuit
   */
  failureThreshold: number;
  
  /**
   * Success threshold to close circuit from half-open
   */
  successThreshold: number;
  
  /**
   * Timeout before attempting to close circuit
   */
  timeout: number;
  
  /**
   * Monitoring window size
   */
  monitoringWindowSize: number;
  
  /**
   * Minimum request threshold
   */
  minimumRequestThreshold: number;
  
  /**
   * Slow call threshold
   */
  slowCallThreshold: number;
  
  /**
   * Slow call duration threshold (ms)
   */
  slowCallDurationThreshold: number;
}

/**
 * Circuit breaker state information
 */
export interface CircuitBreakerState {
  /**
   * Circuit breaker ID
   */
  id: string;
  
  /**
   * Current state
   */
  state: CircuitBreakerState;
  
  /**
   * Failure count in current window
   */
  failureCount: number;
  
  /**
   * Success count in current window
   */
  successCount: number;
  
  /**
   * Total request count in current window
   */
  requestCount: number;
  
  /**
   * Last failure timestamp
   */
  lastFailureTime: number;
  
  /**
   * Last success timestamp
   */
  lastSuccessTime: number;
  
  /**
   * Next retry timestamp (for open state)
   */
  nextRetryTime: number;
  
  /**
   * Request history window
   */
  requestHistory: CircuitBreakerRequest[];
  
  /**
   * Circuit breaker statistics
   */
  statistics: {
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    avgResponseTime: number;
    slowCallCount: number;
  };
}

/**
 * Circuit breaker request information
 */
export interface CircuitBreakerRequest {
  /**
   * Request timestamp
   */
  timestamp: number;
  
  /**
   * Request success status
   */
  success: boolean;
  
  /**
   * Request duration
   */
  duration: number;
  
  /**
   * Error if failed
   */
  error?: string;
}

/**
 * Bulkhead configuration
 */
export interface BulkheadConfig {
  /**
   * Bulkhead identifier
   */
  id: string;
  
  /**
   * Isolation strategy
   */
  strategy: BulkheadStrategy;
  
  /**
   * Maximum concurrent operations
   */
  maxConcurrentOperations: number;
  
  /**
   * Queue size for queued operations
   */
  queueSize: number;
  
  /**
   * Operation timeout
   */
  operationTimeout: number;
  
  /**
   * Queue timeout
   */
  queueTimeout: number;
  
  /**
   * Resource pool configuration (for resource_pool strategy)
   */
  resourcePoolConfig?: {
    minResources: number;
    maxResources: number;
    resourceIdleTimeout: number;
    resourceCreationTimeout: number;
  };
}

/**
 * Bulkhead state information
 */
export interface BulkheadState {
  /**
   * Bulkhead ID
   */
  id: string;
  
  /**
   * Current active operations
   */
  activeOperations: number;
  
  /**
   * Queued operations
   */
  queuedOperations: number;
  
  /**
   * Available resources
   */
  availableResources: number;
  
  /**
   * Resource pool (for resource_pool strategy)
   */
  resourcePool: Map<string, BulkheadResource>;
  
  /**
   * Operation queue
   */
  operationQueue: BulkheadOperation[];
  
  /**
   * Statistics
   */
  statistics: {
    totalOperations: number;
    totalTimeouts: number;
    totalRejections: number;
    avgWaitTime: number;
    avgExecutionTime: number;
    maxConcurrentOperations: number;
  };
}

/**
 * Bulkhead resource
 */
export interface BulkheadResource {
  /**
   * Resource ID
   */
  id: string;
  
  /**
   * Resource availability
   */
  available: boolean;
  
  /**
   * Last used timestamp
   */
  lastUsed: number;
  
  /**
   * Current operation ID (if in use)
   */
  currentOperationId?: string;
  
  /**
   * Resource metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Bulkhead operation
 */
export interface BulkheadOperation {
  /**
   * Operation ID
   */
  id: string;
  
  /**
   * Operation function
   */
  operation: () => Promise<unknown>;
  
  /**
   * Operation priority
   */
  priority: number;
  
  /**
   * Queued timestamp
   */
  queuedAt: number;
  
  /**
   * Timeout handle
   */
  timeoutHandle?: NodeJS.Timeout;
  
  /**
   * Promise resolvers
   */
  resolvers: {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  };
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /**
   * System load metrics
   */
  load: {
    cpuUsage: number;
    memoryUsage: number;
    activeOperations: number;
    queueSize: number;
  };
  
  /**
   * Latency metrics
   */
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
  };
  
  /**
   * Throughput metrics
   */
  throughput: {
    requestsPerSecond: number;
    operationsPerSecond: number;
    messagesPerSecond: number;
  };
  
  /**
   * Error metrics
   */
  errors: {
    errorRate: number;
    timeoutRate: number;
    rejectionRate: number;
  };
  
  /**
   * Resource utilization
   */
  resources: {
    agentUtilization: Map<string, number>;
    resourcePoolUtilization: number;
    connectionUtilization: number;
  };
  
  /**
   * Timestamp when metrics were collected
   */
  timestamp: number;
}

/**
 * Adaptive optimization configuration
 */
export interface AdaptiveOptimizationConfig {
  /**
   * Optimization strategy
   */
  strategy: OptimizationStrategy;
  
  /**
   * Optimization interval (ms)
   */
  optimizationInterval: number;
  
  /**
   * Metrics collection interval (ms)
   */
  metricsInterval: number;
  
  /**
   * Optimization thresholds
   */
  thresholds: {
    highLoad: number;
    lowLoad: number;
    highLatency: number;
    lowThroughput: number;
    highErrorRate: number;
  };
  
  /**
   * Optimization actions
   */
  actions: {
    scaleUp: boolean;
    scaleDown: boolean;
    adjustLimits: boolean;
    redistributeLoad: boolean;
    enableCaching: boolean;
  };
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /**
   * Rate limiter ID
   */
  id: string;
  
  /**
   * Maximum requests per time window
   */
  maxRequests: number;
  
  /**
   * Time window size (ms)
   */
  windowSize: number;
  
  /**
   * Rate limiting algorithm
   */
  algorithm: 'token_bucket' | 'leaky_bucket' | 'fixed_window' | 'sliding_window';
  
  /**
   * Burst capacity (for token bucket)
   */
  burstCapacity?: number;
  
  /**
   * Refill rate (for token bucket)
   */
  refillRate?: number;
}

/**
 * Rate limiter state
 */
export interface RateLimiterState {
  /**
   * Rate limiter ID
   */
  id: string;
  
  /**
   * Available tokens/capacity
   */
  availableCapacity: number;
  
  /**
   * Last refill timestamp
   */
  lastRefillTime: number;
  
  /**
   * Request history window
   */
  requestWindow: number[];
  
  /**
   * Statistics
   */
  statistics: {
    totalRequests: number;
    allowedRequests: number;
    rejectedRequests: number;
    avgRequestRate: number;
  };
}

/**
 * Auto-scaling configuration
 */
export interface AutoScalingConfig {
  /**
   * Minimum number of resources
   */
  minCapacity: number;
  
  /**
   * Maximum number of resources
   */
  maxCapacity: number;
  
  /**
   * Scale up threshold
   */
  scaleUpThreshold: number;
  
  /**
   * Scale down threshold
   */
  scaleDownThreshold: number;
  
  /**
   * Cool-down period (ms)
   */
  coolDownPeriod: number;
  
  /**
   * Metrics to monitor
   */
  monitoredMetrics: ('cpu' | 'memory' | 'queue_size' | 'response_time')[];
}

/**
 * Comprehensive performance and scalability system providing circuit breakers,
 * bulkhead patterns, rate limiting, adaptive optimization, and auto-scaling
 * for multi-agent environments.
 */
export class PerformanceScalability {
  private readonly logger = createLogger(LogLevel.INFO, 'PerformanceScalability');
  
  /**
   * Agent registry
   */
  private readonly registry: AgentRegistry;
  
  /**
   * Communication hub
   */
  private readonly communicationHub: AgentCommunicationHub;
  
  /**
   * Circuit breakers
   */
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  
  /**
   * Bulkheads
   */
  private readonly bulkheads = new Map<string, BulkheadState>();
  
  /**
   * Rate limiters
   */
  private readonly rateLimiters = new Map<string, RateLimiterState>();
  
  /**
   * Performance metrics history
   */
  private readonly metricsHistory: PerformanceMetrics[] = [];
  
  /**
   * Current system capacity
   */
  private currentCapacity = {
    agents: 0,
    connections: 0,
    operations: 0
  };
  
  /**
   * Event streams
   */
  private readonly performanceEventStream = new Subject<AgentEvent>();
  private readonly scalingEventStream = new Subject<AgentEvent>();
  
  /**
   * Optimization timers
   */
  private readonly metricsCollectionTimer: NodeJS.Timeout;
  private readonly optimizationTimer: NodeJS.Timeout;
  
  /**
   * Configuration
   */
  private readonly config = {
    metricsRetentionPeriod: 3600000, // 1 hour
    metricsCollectionInterval: 10000, // 10 seconds
    optimizationInterval: 30000, // 30 seconds
    circuitBreakerCleanupInterval: 60000, // 1 minute
    defaultCircuitBreakerTimeout: 60000, // 1 minute
    defaultBulkheadTimeout: 30000, // 30 seconds
    maxMetricsHistory: 360, // 1 hour at 10s intervals
    autoScalingCoolDown: 300000 // 5 minutes
  };
  
  /**
   * Adaptive optimization configuration
   */
  private optimizationConfig: AdaptiveOptimizationConfig = {
    strategy: 'load_based',
    optimizationInterval: 30000,
    metricsInterval: 10000,
    thresholds: {
      highLoad: 0.8,
      lowLoad: 0.3,
      highLatency: 1000,
      lowThroughput: 10,
      highErrorRate: 0.1
    },
    actions: {
      scaleUp: true,
      scaleDown: true,
      adjustLimits: true,
      redistributeLoad: true,
      enableCaching: false
    }
  };
  
  /**
   * Last scaling action timestamp
   */
  private lastScalingAction = 0;

  constructor(registry: AgentRegistry, communicationHub: AgentCommunicationHub) {
    this.registry = registry;
    this.communicationHub = communicationHub;
    
    // Start background tasks
    this.metricsCollectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);
    
    this.optimizationTimer = setInterval(() => {
      this.performAdaptiveOptimization();
    }, this.config.optimizationInterval);
    
    this.logger.info('PerformanceScalability system initialized');
  }

  /**
   * Creates a circuit breaker
   * 
   * @param config - Circuit breaker configuration
   * @returns Circuit breaker ID
   */
  createCircuitBreaker(config: CircuitBreakerConfig): string {
    const state: CircuitBreakerState = {
      id: config.id,
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      requestCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      nextRetryTime: 0,
      requestHistory: [],
      statistics: {
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        avgResponseTime: 0,
        slowCallCount: 0
      }
    };
    
    this.circuitBreakers.set(config.id, state);
    
    this.logger.info('Circuit breaker created', {
      id: config.id,
      failureThreshold: config.failureThreshold,
      timeout: config.timeout
    });
    
    return config.id;
  }

  /**
   * Executes an operation through a circuit breaker
   * 
   * @param circuitBreakerId - Circuit breaker ID
   * @param operation - Operation to execute
   * @param config - Circuit breaker configuration
   * @returns Promise resolving to operation result
   */
  async executeWithCircuitBreaker<T>(
    circuitBreakerId: string,
    operation: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    const state = this.circuitBreakers.get(circuitBreakerId);
    
    if (!state) {
      throw new Error(`Circuit breaker ${circuitBreakerId} not found`);
    }
    
    // Check circuit state
    if (state.state === 'open') {
      if (Date.now() < state.nextRetryTime) {
        throw new Error('Circuit breaker is open');
      } else {
        // Transition to half-open
        state.state = 'half_open';
        this.logger.info('Circuit breaker transitioned to half-open', {
          id: circuitBreakerId
        });
      }
    }
    
    const startTime = Date.now();
    
    try {
      // Execute the operation with timeout
      const result = await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), config.timeout);
        })
      ]);
      
      const duration = Date.now() - startTime;
      
      // Record success
      this.recordCircuitBreakerRequest(state, config, true, duration);
      
      // Check if we should close the circuit
      if (state.state === 'half_open' && state.successCount >= config.successThreshold) {
        state.state = 'closed';
        state.failureCount = 0;
        state.successCount = 0;
        
        this.logger.info('Circuit breaker closed', { id: circuitBreakerId });
      }
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failure
      this.recordCircuitBreakerRequest(state, config, false, duration, error instanceof Error ? error.message : 'Unknown error');
      
      // Check if we should open the circuit
      if (this.shouldOpenCircuit(state, config)) {
        state.state = 'open';
        state.nextRetryTime = Date.now() + config.timeout;
        
        this.logger.warn('Circuit breaker opened', {
          id: circuitBreakerId,
          failureCount: state.failureCount,
          requestCount: state.requestCount
        });
        
        this.emitPerformanceEvent({
          id: `circuit_breaker_opened_${circuitBreakerId}`,
          type: 'message_received',
          agentId: 'performance_system',
          payload: {
            circuitBreakerId,
            failureCount: state.failureCount,
            requestCount: state.requestCount
          },
          timestamp: Date.now(),
          priority: 'high'
        });
      }
      
      throw error;
    }
  }

  /**
   * Creates a bulkhead
   * 
   * @param config - Bulkhead configuration
   * @returns Bulkhead ID
   */
  createBulkhead(config: BulkheadConfig): string {
    const state: BulkheadState = {
      id: config.id,
      activeOperations: 0,
      queuedOperations: 0,
      availableResources: config.maxConcurrentOperations,
      resourcePool: new Map(),
      operationQueue: [],
      statistics: {
        totalOperations: 0,
        totalTimeouts: 0,
        totalRejections: 0,
        avgWaitTime: 0,
        avgExecutionTime: 0,
        maxConcurrentOperations: 0
      }
    };
    
    // Initialize resource pool if using resource_pool strategy
    if (config.strategy === 'resource_pool' && config.resourcePoolConfig) {
      for (let i = 0; i < config.resourcePoolConfig.minResources; i++) {
        const resource: BulkheadResource = {
          id: `resource_${i}`,
          available: true,
          lastUsed: 0,
          metadata: {}
        };
        state.resourcePool.set(resource.id, resource);
      }
      state.availableResources = config.resourcePoolConfig.minResources;
    }
    
    this.bulkheads.set(config.id, state);
    
    this.logger.info('Bulkhead created', {
      id: config.id,
      strategy: config.strategy,
      maxConcurrentOperations: config.maxConcurrentOperations
    });
    
    return config.id;
  }

  /**
   * Executes an operation through a bulkhead
   * 
   * @param bulkheadId - Bulkhead ID
   * @param operation - Operation to execute
   * @param config - Bulkhead configuration
   * @returns Promise resolving to operation result
   */
  async executeWithBulkhead<T>(
    bulkheadId: string,
    operation: () => Promise<T>,
    config: BulkheadConfig
  ): Promise<T> {
    const state = this.bulkheads.get(bulkheadId);
    
    if (!state) {
      throw new Error(`Bulkhead ${bulkheadId} not found`);
    }
    
    // Check if we can execute immediately
    if (state.activeOperations < config.maxConcurrentOperations) {
      return this.executeBulkheadOperation(state, operation, config);
    }
    
    // Check if we can queue the operation
    if (state.queuedOperations >= config.queueSize) {
      state.statistics.totalRejections++;
      throw new Error('Bulkhead queue is full');
    }
    
    // Queue the operation
    return new Promise<T>((resolve, reject) => {
      const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const bulkheadOperation: BulkheadOperation = {
        id: operationId,
        operation: operation as () => Promise<unknown>,
        priority: 1, // Default priority
        queuedAt: Date.now(),
        resolvers: { resolve: resolve as (value: unknown) => void, reject }
      };
      
      // Set queue timeout
      bulkheadOperation.timeoutHandle = setTimeout(() => {
        this.removeBulkheadOperation(state, operationId);
        state.statistics.totalTimeouts++;
        reject(new Error('Bulkhead queue timeout'));
      }, config.queueTimeout);
      
      state.operationQueue.push(bulkheadOperation);
      state.queuedOperations++;
      
      this.logger.debug('Operation queued in bulkhead', {
        bulkheadId,
        operationId,
        queueSize: state.queuedOperations
      });
    });
  }

  /**
   * Creates a rate limiter
   * 
   * @param config - Rate limiter configuration
   * @returns Rate limiter ID
   */
  createRateLimiter(config: RateLimiterConfig): string {
    const state: RateLimiterState = {
      id: config.id,
      availableCapacity: config.maxRequests,
      lastRefillTime: Date.now(),
      requestWindow: [],
      statistics: {
        totalRequests: 0,
        allowedRequests: 0,
        rejectedRequests: 0,
        avgRequestRate: 0
      }
    };
    
    this.rateLimiters.set(config.id, state);
    
    this.logger.info('Rate limiter created', {
      id: config.id,
      algorithm: config.algorithm,
      maxRequests: config.maxRequests,
      windowSize: config.windowSize
    });
    
    return config.id;
  }

  /**
   * Checks if a request is allowed by the rate limiter
   * 
   * @param rateLimiterId - Rate limiter ID
   * @param config - Rate limiter configuration
   * @returns Whether request is allowed
   */
  async checkRateLimit(
    rateLimiterId: string,
    config: RateLimiterConfig
  ): Promise<boolean> {
    const state = this.rateLimiters.get(rateLimiterId);
    
    if (!state) {
      throw new Error(`Rate limiter ${rateLimiterId} not found`);
    }
    
    state.statistics.totalRequests++;
    
    const now = Date.now();
    
    switch (config.algorithm) {
      case 'token_bucket':
        return this.checkTokenBucketLimit(state, config, now);
        
      case 'fixed_window':
        return this.checkFixedWindowLimit(state, config, now);
        
      case 'sliding_window':
        return this.checkSlidingWindowLimit(state, config, now);
        
      default:
        return this.checkTokenBucketLimit(state, config, now);
    }
  }

  /**
   * Performs adaptive optimization based on current metrics
   * 
   * @private
   */
  private async performAdaptiveOptimization(): Promise<void> {
    if (this.metricsHistory.length === 0) return;
    
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const optimizationActions: string[] = [];
    
    // Load-based optimizations
    if (latestMetrics.load.cpuUsage > this.optimizationConfig.thresholds.highLoad) {
      if (this.optimizationConfig.actions.scaleUp) {
        await this.performScaleUp();
        optimizationActions.push('scale_up');
      }
      
      if (this.optimizationConfig.actions.redistributeLoad) {
        await this.redistributeLoad();
        optimizationActions.push('redistribute_load');
      }
    }
    
    // Latency-based optimizations
    if (latestMetrics.latency.p95 > this.optimizationConfig.thresholds.highLatency) {
      if (this.optimizationConfig.actions.adjustLimits) {
        await this.adjustLimits('increase');
        optimizationActions.push('increase_limits');
      }
    }
    
    // Low load optimizations
    if (latestMetrics.load.cpuUsage < this.optimizationConfig.thresholds.lowLoad) {
      if (this.optimizationConfig.actions.scaleDown) {
        await this.performScaleDown();
        optimizationActions.push('scale_down');
      }
    }
    
    // Error rate optimizations
    if (latestMetrics.errors.errorRate > this.optimizationConfig.thresholds.highErrorRate) {
      // Open circuit breakers for failing services
      await this.adjustCircuitBreakers();
      optimizationActions.push('adjust_circuit_breakers');
    }
    
    if (optimizationActions.length > 0) {
      this.logger.info('Adaptive optimization performed', {
        actions: optimizationActions,
        metrics: {
          cpuUsage: latestMetrics.load.cpuUsage,
          latency: latestMetrics.latency.p95,
          errorRate: latestMetrics.errors.errorRate
        }
      });
      
      this.emitPerformanceEvent({
        id: `optimization_${Date.now()}`,
        type: 'message_received',
        agentId: 'performance_optimizer',
        payload: {
          actions: optimizationActions,
          metrics: latestMetrics
        },
        timestamp: Date.now(),
        priority: 'medium'
      });
    }
  }

  /**
   * Records a circuit breaker request
   * 
   * @private
   */
  private recordCircuitBreakerRequest(
    state: CircuitBreakerState,
    config: CircuitBreakerConfig,
    success: boolean,
    duration: number,
    error?: string
  ): void {
    const request: CircuitBreakerRequest = {
      timestamp: Date.now(),
      success,
      duration,
      error
    };
    
    // Add to history and maintain window size
    state.requestHistory.push(request);
    if (state.requestHistory.length > config.monitoringWindowSize) {
      state.requestHistory.shift();
    }
    
    // Update counters
    state.requestCount++;
    state.statistics.totalRequests++;
    
    if (success) {
      state.successCount++;
      state.statistics.totalSuccesses++;
      state.lastSuccessTime = Date.now();
    } else {
      state.failureCount++;
      state.statistics.totalFailures++;
      state.lastFailureTime = Date.now();
    }
    
    // Update average response time
    state.statistics.avgResponseTime = 
      (state.statistics.avgResponseTime + duration) / 2;
    
    // Check for slow calls
    if (duration > config.slowCallDurationThreshold) {
      state.statistics.slowCallCount++;
    }
  }

  /**
   * Determines if circuit should be opened
   * 
   * @private
   */
  private shouldOpenCircuit(
    state: CircuitBreakerState,
    config: CircuitBreakerConfig
  ): boolean {
    // Check minimum request threshold
    if (state.requestCount < config.minimumRequestThreshold) {
      return false;
    }
    
    // Check failure rate
    const failureRate = state.failureCount / state.requestCount;
    const failureThreshold = config.failureThreshold / 100;
    
    if (failureRate >= failureThreshold) {
      return true;
    }
    
    // Check slow call rate
    const slowCallRate = state.statistics.slowCallCount / state.requestCount;
    const slowCallThreshold = config.slowCallThreshold / 100;
    
    return slowCallRate >= slowCallThreshold;
  }

  /**
   * Executes a bulkhead operation
   * 
   * @private
   */
  private async executeBulkheadOperation<T>(
    state: BulkheadState,
    operation: () => Promise<T>,
    config: BulkheadConfig
  ): Promise<T> {
    const startTime = Date.now();
    
    state.activeOperations++;
    state.statistics.totalOperations++;
    state.statistics.maxConcurrentOperations = Math.max(
      state.statistics.maxConcurrentOperations,
      state.activeOperations
    );
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error('Bulkhead operation timeout')), config.operationTimeout);
        })
      ]);
      
      const executionTime = Date.now() - startTime;
      state.statistics.avgExecutionTime = 
        (state.statistics.avgExecutionTime + executionTime) / 2;
      
      return result;
      
    } finally {
      state.activeOperations--;
      
      // Process queue if there are waiting operations
      if (state.operationQueue.length > 0) {
        const nextOperation = state.operationQueue.shift();
        if (nextOperation) {
          state.queuedOperations--;
          
          if (nextOperation.timeoutHandle) {
            clearTimeout(nextOperation.timeoutHandle);
          }
          
          const waitTime = Date.now() - nextOperation.queuedAt;
          state.statistics.avgWaitTime = 
            (state.statistics.avgWaitTime + waitTime) / 2;
          
          // Execute the queued operation
          this.executeBulkheadOperation(state, nextOperation.operation as () => Promise<T>, config)
            .then(result => nextOperation.resolvers.resolve(result))
            .catch(error => nextOperation.resolvers.reject(error));
        }
      }
    }
  }

  /**
   * Removes a bulkhead operation from queue
   * 
   * @private
   */
  private removeBulkheadOperation(state: BulkheadState, operationId: string): void {
    const index = state.operationQueue.findIndex(op => op.id === operationId);
    if (index >= 0) {
      state.operationQueue.splice(index, 1);
      state.queuedOperations--;
    }
  }

  /**
   * Checks token bucket rate limit
   * 
   * @private
   */
  private checkTokenBucketLimit(
    state: RateLimiterState,
    config: RateLimiterConfig,
    now: number
  ): boolean {
    const timeDelta = now - state.lastRefillTime;
    const refillRate = config.refillRate || config.maxRequests / (config.windowSize / 1000);
    
    // Refill tokens
    const tokensToAdd = Math.floor((timeDelta / 1000) * refillRate);
    state.availableCapacity = Math.min(
      config.burstCapacity || config.maxRequests,
      state.availableCapacity + tokensToAdd
    );
    
    state.lastRefillTime = now;
    
    // Check if request can be allowed
    if (state.availableCapacity >= 1) {
      state.availableCapacity--;
      state.statistics.allowedRequests++;
      return true;
    }
    
    state.statistics.rejectedRequests++;
    return false;
  }

  /**
   * Checks fixed window rate limit
   * 
   * @private
   */
  private checkFixedWindowLimit(
    state: RateLimiterState,
    config: RateLimiterConfig,
    now: number
  ): boolean {
    const windowStart = Math.floor(now / config.windowSize) * config.windowSize;
    
    // Reset counter if in new window
    if (state.lastRefillTime < windowStart) {
      state.availableCapacity = config.maxRequests;
      state.lastRefillTime = windowStart;
    }
    
    if (state.availableCapacity > 0) {
      state.availableCapacity--;
      state.statistics.allowedRequests++;
      return true;
    }
    
    state.statistics.rejectedRequests++;
    return false;
  }

  /**
   * Checks sliding window rate limit
   * 
   * @private
   */
  private checkSlidingWindowLimit(
    state: RateLimiterState,
    config: RateLimiterConfig,
    now: number
  ): boolean {
    const windowStart = now - config.windowSize;
    
    // Remove old requests from window
    state.requestWindow = state.requestWindow.filter(timestamp => timestamp > windowStart);
    
    if (state.requestWindow.length < config.maxRequests) {
      state.requestWindow.push(now);
      state.statistics.allowedRequests++;
      return true;
    }
    
    state.statistics.rejectedRequests++;
    return false;
  }

  /**
   * Collects system performance metrics
   * 
   * @private
   */
  private async collectMetrics(): Promise<void> {
    const metrics: PerformanceMetrics = {
      load: {
        cpuUsage: process.cpuUsage().system / 1000000, // Convert to seconds
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        activeOperations: Array.from(this.bulkheads.values())
          .reduce((sum, state) => sum + state.activeOperations, 0),
        queueSize: Array.from(this.bulkheads.values())
          .reduce((sum, state) => sum + state.queuedOperations, 0)
      },
      latency: {
        p50: this.calculateLatencyPercentile(0.5),
        p90: this.calculateLatencyPercentile(0.9),
        p95: this.calculateLatencyPercentile(0.95),
        p99: this.calculateLatencyPercentile(0.99),
        avg: this.calculateAverageLatency()
      },
      throughput: {
        requestsPerSecond: this.calculateThroughput('requests'),
        operationsPerSecond: this.calculateThroughput('operations'),
        messagesPerSecond: this.calculateThroughput('messages')
      },
      errors: {
        errorRate: this.calculateErrorRate(),
        timeoutRate: this.calculateTimeoutRate(),
        rejectionRate: this.calculateRejectionRate()
      },
      resources: {
        agentUtilization: this.calculateAgentUtilization(),
        resourcePoolUtilization: this.calculateResourcePoolUtilization(),
        connectionUtilization: this.calculateConnectionUtilization()
      },
      timestamp: Date.now()
    };
    
    // Add to metrics history
    this.metricsHistory.push(metrics);
    
    // Maintain history size
    if (this.metricsHistory.length > this.config.maxMetricsHistory) {
      this.metricsHistory.shift();
    }
    
    this.logger.debug('Performance metrics collected', {
      cpuUsage: metrics.load.cpuUsage,
      memoryUsage: metrics.load.memoryUsage,
      p95Latency: metrics.latency.p95,
      errorRate: metrics.errors.errorRate
    });
  }

  /**
   * Calculates latency percentile
   * 
   * @private
   */
  private calculateLatencyPercentile(percentile: number): number {
    const allLatencies: number[] = [];
    
    // Collect latencies from circuit breakers
    for (const state of this.circuitBreakers.values()) {
      allLatencies.push(...state.requestHistory.map(r => r.duration));
    }
    
    if (allLatencies.length === 0) return 0;
    
    allLatencies.sort((a, b) => a - b);
    const index = Math.floor(percentile * (allLatencies.length - 1));
    return allLatencies[index] || 0;
  }

  /**
   * Calculates average latency
   * 
   * @private
   */
  private calculateAverageLatency(): number {
    let totalLatency = 0;
    let totalRequests = 0;
    
    for (const state of this.circuitBreakers.values()) {
      totalLatency += state.statistics.avgResponseTime * state.statistics.totalRequests;
      totalRequests += state.statistics.totalRequests;
    }
    
    return totalRequests > 0 ? totalLatency / totalRequests : 0;
  }

  /**
   * Calculates throughput for different operation types
   * 
   * @private
   */
  private calculateThroughput(type: 'requests' | 'operations' | 'messages'): number {
    // Calculate based on recent metrics history
    if (this.metricsHistory.length < 2) return 0;
    
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const recentMetrics = this.metricsHistory.filter(m => now - m.timestamp < timeWindow);
    
    if (recentMetrics.length < 2) return 0;
    
    // Simple throughput calculation (would be more sophisticated in real implementation)
    return Math.random() * 100; // Placeholder
  }

  /**
   * Calculates error rate
   * 
   * @private
   */
  private calculateErrorRate(): number {
    let totalRequests = 0;
    let totalFailures = 0;
    
    for (const state of this.circuitBreakers.values()) {
      totalRequests += state.statistics.totalRequests;
      totalFailures += state.statistics.totalFailures;
    }
    
    return totalRequests > 0 ? totalFailures / totalRequests : 0;
  }

  /**
   * Calculates timeout rate
   * 
   * @private
   */
  private calculateTimeoutRate(): number {
    let totalOperations = 0;
    let totalTimeouts = 0;
    
    for (const state of this.bulkheads.values()) {
      totalOperations += state.statistics.totalOperations;
      totalTimeouts += state.statistics.totalTimeouts;
    }
    
    return totalOperations > 0 ? totalTimeouts / totalOperations : 0;
  }

  /**
   * Calculates rejection rate
   * 
   * @private
   */
  private calculateRejectionRate(): number {
    let totalRequests = 0;
    let totalRejections = 0;
    
    for (const state of this.rateLimiters.values()) {
      totalRequests += state.statistics.totalRequests;
      totalRejections += state.statistics.rejectedRequests;
    }
    
    for (const state of this.bulkheads.values()) {
      totalRequests += state.statistics.totalOperations;
      totalRejections += state.statistics.totalRejections;
    }
    
    return totalRequests > 0 ? totalRejections / totalRequests : 0;
  }

  /**
   * Calculates agent utilization
   * 
   * @private
   */
  private calculateAgentUtilization(): Map<string, number> {
    const utilization = new Map<string, number>();
    
    const allAgents = this.registry.getAllAgents();
    
    for (const agent of allAgents) {
      // Calculate utilization based on agent activity (simplified)
      const timeSinceLastActivity = Date.now() - agent.lastActiveAt;
      const utilizationScore = Math.max(0, 1 - (timeSinceLastActivity / 60000)); // 1 minute window
      
      utilization.set(agent.id, utilizationScore);
    }
    
    return utilization;
  }

  /**
   * Calculates resource pool utilization
   * 
   * @private
   */
  private calculateResourcePoolUtilization(): number {
    let totalResources = 0;
    let activeResources = 0;
    
    for (const state of this.bulkheads.values()) {
      totalResources += state.resourcePool.size;
      activeResources += Array.from(state.resourcePool.values())
        .filter(r => !r.available).length;
    }
    
    return totalResources > 0 ? activeResources / totalResources : 0;
  }

  /**
   * Calculates connection utilization
   * 
   * @private
   */
  private calculateConnectionUtilization(): number {
    // Simplified connection utilization calculation
    return Math.random() * 0.8; // Placeholder
  }

  /**
   * Performs scale up operation
   * 
   * @private
   */
  private async performScaleUp(): Promise<void> {
    const now = Date.now();
    
    // Check cool-down period
    if (now - this.lastScalingAction < this.config.autoScalingCoolDown) {
      return;
    }
    
    this.logger.info('Performing scale up operation');
    
    // Increase bulkhead limits
    for (const [id, state] of this.bulkheads) {
      const config = { maxConcurrentOperations: Math.floor(state.availableResources * 1.2) };
      state.availableResources = config.maxConcurrentOperations;
    }
    
    this.currentCapacity.operations = Math.floor(this.currentCapacity.operations * 1.2);
    this.lastScalingAction = now;
    
    this.emitScalingEvent({
      id: `scale_up_${now}`,
      type: 'message_received',
      agentId: 'auto_scaler',
      payload: {
        action: 'scale_up',
        newCapacity: this.currentCapacity
      },
      timestamp: now,
      priority: 'medium'
    });
  }

  /**
   * Performs scale down operation
   * 
   * @private
   */
  private async performScaleDown(): Promise<void> {
    const now = Date.now();
    
    // Check cool-down period
    if (now - this.lastScalingAction < this.config.autoScalingCoolDown) {
      return;
    }
    
    this.logger.info('Performing scale down operation');
    
    // Decrease bulkhead limits
    for (const [id, state] of this.bulkheads) {
      const newCapacity = Math.max(1, Math.floor(state.availableResources * 0.8));
      state.availableResources = newCapacity;
    }
    
    this.currentCapacity.operations = Math.max(1, Math.floor(this.currentCapacity.operations * 0.8));
    this.lastScalingAction = now;
    
    this.emitScalingEvent({
      id: `scale_down_${now}`,
      type: 'message_received',
      agentId: 'auto_scaler',
      payload: {
        action: 'scale_down',
        newCapacity: this.currentCapacity
      },
      timestamp: now,
      priority: 'medium'
    });
  }

  /**
   * Adjusts system limits
   * 
   * @private
   */
  private async adjustLimits(direction: 'increase' | 'decrease'): Promise<void> {
    const multiplier = direction === 'increase' ? 1.1 : 0.9;
    
    for (const [id, state] of this.rateLimiters) {
      state.availableCapacity = Math.floor(state.availableCapacity * multiplier);
    }
    
    this.logger.info('System limits adjusted', { direction, multiplier });
  }

  /**
   * Redistributes load across agents
   * 
   * @private
   */
  private async redistributeLoad(): Promise<void> {
    // Simplified load redistribution
    this.logger.info('Load redistribution triggered');
    // Implementation would involve actual load balancing logic
  }

  /**
   * Adjusts circuit breakers based on current conditions
   * 
   * @private
   */
  private async adjustCircuitBreakers(): Promise<void> {
    for (const [id, state] of this.circuitBreakers) {
      if (state.statistics.totalFailures > state.statistics.totalSuccesses && state.state === 'closed') {
        state.state = 'open';
        state.nextRetryTime = Date.now() + 30000; // 30 seconds
        
        this.logger.info('Circuit breaker preemptively opened due to high error rate', { id });
      }
    }
  }

  /**
   * Emits performance event
   * 
   * @private
   */
  private emitPerformanceEvent(event: AgentEvent): void {
    this.performanceEventStream.next(event);
  }

  /**
   * Emits scaling event
   * 
   * @private
   */
  private emitScalingEvent(event: AgentEvent): void {
    this.scalingEventStream.next(event);
  }

  /**
   * Gets current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 ? 
      this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  /**
   * Gets metrics history
   */
  getMetricsHistory(timeWindow?: number): PerformanceMetrics[] {
    if (!timeWindow) return [...this.metricsHistory];
    
    const cutoff = Date.now() - timeWindow;
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Gets circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Gets bulkhead states
   */
  getBulkheadStates(): Map<string, BulkheadState> {
    return new Map(this.bulkheads);
  }

  /**
   * Gets rate limiter states
   */
  getRateLimiterStates(): Map<string, RateLimiterState> {
    return new Map(this.rateLimiters);
  }

  /**
   * Subscribes to performance events
   */
  subscribeToPerformanceEvents(): Observable<AgentEvent> {
    return this.performanceEventStream.asObservable();
  }

  /**
   * Subscribes to scaling events
   */
  subscribeToScalingEvents(): Observable<AgentEvent> {
    return this.scalingEventStream.asObservable();
  }

  /**
   * Updates optimization configuration
   */
  updateOptimizationConfig(config: Partial<AdaptiveOptimizationConfig>): void {
    this.optimizationConfig = { ...this.optimizationConfig, ...config };
    
    this.logger.info('Optimization configuration updated', { config });
  }

  /**
   * Shuts down the performance and scalability system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down PerformanceScalability system');
    
    // Clear timers
    clearInterval(this.metricsCollectionTimer);
    clearInterval(this.optimizationTimer);
    
    // Complete event streams
    this.performanceEventStream.complete();
    this.scalingEventStream.complete();
    
    // Clear data structures
    this.circuitBreakers.clear();
    this.bulkheads.clear();
    this.rateLimiters.clear();
    this.metricsHistory.length = 0;
    
    this.logger.info('PerformanceScalability system shutdown complete');
  }
}