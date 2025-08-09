import { Observable, Subject, BehaviorSubject, merge, combineLatest } from 'rxjs';
import { 
  map, 
  filter, 
  debounceTime, 
  throttleTime, 
  bufferTime, 
  scan, 
  groupBy, 
  mergeMap,
  switchMap,
  windowTime,
  concatMap
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
 * Event sourcing event types
 */
export interface DomainEvent {
  /**
   * Event identifier
   */
  id: string;
  
  /**
   * Event type
   */
  type: string;
  
  /**
   * Aggregate identifier this event belongs to
   */
  aggregateId: string;
  
  /**
   * Aggregate type
   */
  aggregateType: string;
  
  /**
   * Event data payload
   */
  data: Record<string, unknown>;
  
  /**
   * Event metadata
   */
  metadata: {
    timestamp: number;
    version: number;
    causationId?: string;
    correlationId?: string;
    userId?: string;
    source: string;
  };
  
  /**
   * Event schema version
   */
  schemaVersion: string;
}

/**
 * Event store interface for persistence
 */
export interface EventStore {
  /**
   * Appends events to the store
   */
  appendEvents(streamId: string, events: DomainEvent[]): Promise<void>;
  
  /**
   * Reads events from a stream
   */
  readEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;
  
  /**
   * Reads all events of specific types
   */
  readEventsByType(eventTypes: string[]): Promise<DomainEvent[]>;
  
  /**
   * Creates a snapshot of an aggregate
   */
  saveSnapshot(streamId: string, snapshot: AggregateSnapshot): Promise<void>;
  
  /**
   * Loads the latest snapshot of an aggregate
   */
  loadSnapshot(streamId: string): Promise<AggregateSnapshot | null>;
}

/**
 * Aggregate snapshot for optimization
 */
export interface AggregateSnapshot {
  /**
   * Aggregate identifier
   */
  aggregateId: string;
  
  /**
   * Aggregate type
   */
  aggregateType: string;
  
  /**
   * Snapshot data
   */
  data: Record<string, unknown>;
  
  /**
   * Version at which snapshot was taken
   */
  version: number;
  
  /**
   * Snapshot timestamp
   */
  timestamp: number;
}

/**
 * Event subscription configuration
 */
export interface EventSubscription {
  /**
   * Subscription identifier
   */
  id: string;
  
  /**
   * Subscriber agent ID
   */
  subscriberId: string;
  
  /**
   * Event pattern to match
   */
  eventPattern: EventPattern;
  
  /**
   * Delivery guarantees
   */
  deliveryGuarantee: 'at_most_once' | 'at_least_once' | 'exactly_once';
  
  /**
   * Subscription metadata
   */
  metadata: {
    createdAt: number;
    lastDelivered?: number;
    deliveryCount: number;
    failureCount: number;
  };
}

/**
 * Event pattern for subscription matching
 */
export interface EventPattern {
  /**
   * Event types to match (supports wildcards)
   */
  eventTypes?: string[];
  
  /**
   * Aggregate types to match
   */
  aggregateTypes?: string[];
  
  /**
   * Custom predicate function
   */
  predicate?: (event: DomainEvent) => boolean;
  
  /**
   * Pattern priority
   */
  priority: number;
}

/**
 * Complex event processing rule
 */
export interface CEPRule {
  /**
   * Rule identifier
   */
  id: string;
  
  /**
   * Rule name
   */
  name: string;
  
  /**
   * Rule description
   */
  description: string;
  
  /**
   * Pattern to detect
   */
  pattern: EventSequencePattern;
  
  /**
   * Action to execute when pattern matches
   */
  action: CEPAction;
  
  /**
   * Rule priority
   */
  priority: number;
  
  /**
   * Rule state
   */
  enabled: boolean;
  
  /**
   * Rule statistics
   */
  statistics: {
    matchCount: number;
    lastMatch?: number;
    avgProcessingTime: number;
  };
}

/**
 * Event sequence pattern for complex event processing
 */
export interface EventSequencePattern {
  /**
   * Pattern type
   */
  type: 'sequence' | 'conjunction' | 'disjunction' | 'negation' | 'temporal';
  
  /**
   * Event conditions
   */
  conditions: EventCondition[];
  
  /**
   * Time window for pattern matching
   */
  timeWindow?: {
    duration: number;
    type: 'sliding' | 'tumbling';
  };
  
  /**
   * Minimum occurrences
   */
  minOccurrences?: number;
  
  /**
   * Maximum occurrences
   */
  maxOccurrences?: number;
}

/**
 * Individual event condition in a pattern
 */
export interface EventCondition {
  /**
   * Event type pattern
   */
  eventType: string;
  
  /**
   * Aggregate type pattern
   */
  aggregateType?: string;
  
  /**
   * Data constraints
   */
  dataConstraints?: Record<string, unknown>;
  
  /**
   * Temporal constraints
   */
  temporalConstraints?: {
    before?: string; // Reference to another condition
    after?: string;
    within?: number; // Milliseconds
  };
  
  /**
   * Custom predicate
   */
  predicate?: (event: DomainEvent) => boolean;
}

/**
 * Action to execute when CEP rule matches
 */
export interface CEPAction {
  /**
   * Action type
   */
  type: 'emit_event' | 'send_message' | 'trigger_workflow' | 'custom';
  
  /**
   * Action configuration
   */
  config: Record<string, unknown>;
  
  /**
   * Custom action handler
   */
  handler?: (matchedEvents: DomainEvent[], context: CEPContext) => Promise<void>;
}

/**
 * Context for CEP rule execution
 */
export interface CEPContext {
  /**
   * Rule that was triggered
   */
  rule: CEPRule;
  
  /**
   * Matched events
   */
  matchedEvents: DomainEvent[];
  
  /**
   * Match timestamp
   */
  matchTimestamp: number;
  
  /**
   * Additional context data
   */
  contextData: Record<string, unknown>;
}

/**
 * Event replay configuration
 */
export interface EventReplayConfig {
  /**
   * Stream to replay from
   */
  streamId: string;
  
  /**
   * Start version/timestamp
   */
  fromVersion?: number;
  fromTimestamp?: number;
  
  /**
   * End version/timestamp
   */
  toVersion?: number;
  toTimestamp?: number;
  
  /**
   * Event types to include in replay
   */
  eventTypes?: string[];
  
  /**
   * Replay speed multiplier
   */
  speedMultiplier: number;
  
  /**
   * Callback for each replayed event
   */
  onEvent?: (event: DomainEvent) => Promise<void>;
}

/**
 * Saga configuration for distributed transactions
 */
export interface SagaDefinition {
  /**
   * Saga identifier
   */
  id: string;
  
  /**
   * Saga name
   */
  name: string;
  
  /**
   * Saga steps
   */
  steps: SagaStep[];
  
  /**
   * Saga timeout
   */
  timeout: number;
  
  /**
   * Compensation strategy
   */
  compensationStrategy: 'immediate' | 'deferred' | 'manual';
}

/**
 * Individual step in a saga
 */
export interface SagaStep {
  /**
   * Step identifier
   */
  id: string;
  
  /**
   * Step name
   */
  name: string;
  
  /**
   * Forward action
   */
  action: SagaAction;
  
  /**
   * Compensation action
   */
  compensation: SagaAction;
  
  /**
   * Step timeout
   */
  timeout: number;
  
  /**
   * Retry configuration
   */
  retry: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
}

/**
 * Saga action definition
 */
export interface SagaAction {
  /**
   * Action type
   */
  type: 'emit_event' | 'send_command' | 'call_service' | 'custom';
  
  /**
   * Action target
   */
  target: string;
  
  /**
   * Action payload
   */
  payload: Record<string, unknown>;
  
  /**
   * Custom action handler
   */
  handler?: (payload: Record<string, unknown>) => Promise<SagaActionResult>;
}

/**
 * Result of saga action execution
 */
export interface SagaActionResult {
  /**
   * Success status
   */
  success: boolean;
  
  /**
   * Result data
   */
  data?: Record<string, unknown>;
  
  /**
   * Error information
   */
  error?: string;
  
  /**
   * Whether the action can be retried
   */
  retryable?: boolean;
}

/**
 * In-memory event store implementation
 */
class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, DomainEvent[]>();
  private readonly snapshots = new Map<string, AggregateSnapshot>();
  private readonly logger = createLogger(LogLevel.INFO, 'InMemoryEventStore');

  async appendEvents(streamId: string, events: DomainEvent[]): Promise<void> {
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    
    const stream = this.events.get(streamId)!;
    stream.push(...events);
    
    this.logger.debug('Events appended to stream', {
      streamId,
      eventCount: events.length,
      totalEvents: stream.length
    });
  }

  async readEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const stream = this.events.get(streamId) || [];
    
    if (fromVersion !== undefined) {
      return stream.filter(event => event.metadata.version >= fromVersion);
    }
    
    return [...stream];
  }

  async readEventsByType(eventTypes: string[]): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = [];
    
    for (const stream of this.events.values()) {
      const matchingEvents = stream.filter(event => eventTypes.includes(event.type));
      allEvents.push(...matchingEvents);
    }
    
    return allEvents.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  }

  async saveSnapshot(streamId: string, snapshot: AggregateSnapshot): Promise<void> {
    this.snapshots.set(streamId, snapshot);
    
    this.logger.debug('Snapshot saved', {
      streamId,
      aggregateId: snapshot.aggregateId,
      version: snapshot.version
    });
  }

  async loadSnapshot(streamId: string): Promise<AggregateSnapshot | null> {
    return this.snapshots.get(streamId) || null;
  }
}

/**
 * Event-driven architecture system providing publish-subscribe, event sourcing,
 * complex event processing, and saga management for multi-agent coordination.
 */
export class EventDrivenArchitecture {
  private readonly logger = createLogger(LogLevel.INFO, 'EventDrivenArchitecture');
  
  /**
   * Agent registry
   */
  private readonly registry: AgentRegistry;
  
  /**
   * Communication hub
   */
  private readonly communicationHub: AgentCommunicationHub;
  
  /**
   * Event store
   */
  private readonly eventStore: EventStore;
  
  /**
   * Event subscriptions
   */
  private readonly subscriptions = new Map<string, EventSubscription>();
  
  /**
   * Complex event processing rules
   */
  private readonly cepRules = new Map<string, CEPRule>();
  
  /**
   * Active saga instances
   */
  private readonly activeSagas = new Map<string, SagaInstance>();
  
  /**
   * Event streams
   */
  private readonly eventStream = new Subject<DomainEvent>();
  private readonly cepEventStream = new Subject<CEPContext>();
  private readonly sagaEventStream = new Subject<SagaEvent>();
  
  /**
   * CEP pattern matcher state
   */
  private readonly patternMatcherState = new Map<string, PatternMatchState>();
  
  /**
   * Configuration
   */
  private readonly config = {
    maxEventBufferSize: 10000,
    eventDeliveryTimeout: 30000,
    sagaTimeout: 300000, // 5 minutes
    cepProcessingInterval: 1000, // 1 second
    snapshotInterval: 100, // Every 100 events
    maxRetryAttempts: 3
  };

  constructor(
    registry: AgentRegistry, 
    communicationHub: AgentCommunicationHub,
    eventStore?: EventStore
  ) {
    this.registry = registry;
    this.communicationHub = communicationHub;
    this.eventStore = eventStore || new InMemoryEventStore();
    
    this.initializeEventProcessing();
    this.initializeCEPProcessing();
    this.initializeSagaProcessing();
    
    this.logger.info('EventDrivenArchitecture system initialized');
  }

  /**
   * Publishes a domain event
   * 
   * @param event - Domain event to publish
   * @returns Promise resolving to operation result
   */
  async publishEvent(event: DomainEvent): Promise<RegistryOperationResult> {
    const startTime = Date.now();
    
    try {
      // Validate event
      this.validateEvent(event);
      
      // Store event
      await this.eventStore.appendEvents(event.aggregateId, [event]);
      
      // Emit to event stream
      this.eventStream.next(event);
      
      // Deliver to subscribers
      await this.deliverToSubscribers(event);
      
      this.logger.info('Event published successfully', {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId
      });
      
      return {
        success: true,
        metadata: { 
          eventId: event.id,
          deliveryCount: this.getSubscribersForEvent(event).length 
        },
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Failed to publish event', {
        eventId: event.id,
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
   * Subscribes to events with specified pattern
   * 
   * @param subscriberId - Agent subscribing to events
   * @param pattern - Event pattern to match
   * @param deliveryGuarantee - Delivery guarantee level
   * @returns Promise resolving to subscription ID
   */
  async subscribeToEvents(
    subscriberId: string,
    pattern: EventPattern,
    deliveryGuarantee: EventSubscription['deliveryGuarantee'] = 'at_least_once'
  ): Promise<string> {
    const subscriptionId = `sub_${subscriberId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      subscriberId,
      eventPattern: pattern,
      deliveryGuarantee,
      metadata: {
        createdAt: Date.now(),
        deliveryCount: 0,
        failureCount: 0
      }
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    this.logger.info('Event subscription created', {
      subscriptionId,
      subscriberId,
      eventTypes: pattern.eventTypes,
      deliveryGuarantee
    });
    
    return subscriptionId;
  }

  /**
   * Unsubscribes from events
   * 
   * @param subscriptionId - Subscription to remove
   * @returns Promise resolving to operation result
   */
  async unsubscribeFromEvents(subscriptionId: string): Promise<RegistryOperationResult> {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return {
        success: false,
        error: `Subscription ${subscriptionId} not found`,
        executionTime: 0
      };
    }
    
    this.subscriptions.delete(subscriptionId);
    
    this.logger.info('Event subscription removed', {
      subscriptionId,
      subscriberId: subscription.subscriberId
    });
    
    return {
      success: true,
      metadata: { subscriptionId },
      executionTime: 0
    };
  }

  /**
   * Adds a complex event processing rule
   * 
   * @param rule - CEP rule to add
   * @returns Promise resolving to operation result
   */
  async addCEPRule(rule: CEPRule): Promise<RegistryOperationResult> {
    if (this.cepRules.has(rule.id)) {
      return {
        success: false,
        error: `CEP rule ${rule.id} already exists`,
        executionTime: 0
      };
    }
    
    this.cepRules.set(rule.id, rule);
    
    // Initialize pattern matcher state
    this.patternMatcherState.set(rule.id, {
      ruleId: rule.id,
      partialMatches: [],
      lastProcessed: Date.now()
    });
    
    this.logger.info('CEP rule added', {
      ruleId: rule.id,
      ruleName: rule.name,
      patternType: rule.pattern.type
    });
    
    return {
      success: true,
      metadata: { ruleId: rule.id },
      executionTime: 0
    };
  }

  /**
   * Removes a CEP rule
   * 
   * @param ruleId - Rule to remove
   * @returns Promise resolving to operation result
   */
  async removeCEPRule(ruleId: string): Promise<RegistryOperationResult> {
    const removed = this.cepRules.delete(ruleId);
    this.patternMatcherState.delete(ruleId);
    
    if (removed) {
      this.logger.info('CEP rule removed', { ruleId });
    }
    
    return {
      success: removed,
      error: removed ? undefined : `Rule ${ruleId} not found`,
      executionTime: 0
    };
  }

  /**
   * Starts a saga instance
   * 
   * @param sagaDefinition - Saga definition
   * @param initialData - Initial saga data
   * @returns Promise resolving to saga instance ID
   */
  async startSaga(
    sagaDefinition: SagaDefinition,
    initialData: Record<string, unknown> = {}
  ): Promise<string> {
    const sagaInstanceId = `saga_${sagaDefinition.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sagaInstance: SagaInstance = {
      id: sagaInstanceId,
      sagaId: sagaDefinition.id,
      definition: sagaDefinition,
      state: 'running',
      currentStep: 0,
      data: initialData,
      startedAt: Date.now(),
      completedSteps: new Set(),
      compensatedSteps: new Set(),
      lastActivity: Date.now()
    };
    
    this.activeSagas.set(sagaInstanceId, sagaInstance);
    
    // Start executing the saga
    this.executeSaga(sagaInstance);
    
    this.logger.info('Saga started', {
      sagaInstanceId,
      sagaDefinition: sagaDefinition.id,
      stepsCount: sagaDefinition.steps.length
    });
    
    return sagaInstanceId;
  }

  /**
   * Replays events from the event store
   * 
   * @param config - Replay configuration
   * @returns Promise resolving to replay result
   */
  async replayEvents(config: EventReplayConfig): Promise<{
    totalEvents: number;
    replayDuration: number;
  }> {
    const startTime = Date.now();
    
    this.logger.info('Starting event replay', {
      streamId: config.streamId,
      fromVersion: config.fromVersion,
      fromTimestamp: config.fromTimestamp,
      speedMultiplier: config.speedMultiplier
    });
    
    // Load events to replay
    const events = await this.eventStore.readEvents(config.streamId, config.fromVersion);
    
    // Filter by criteria
    let filteredEvents = events;
    
    if (config.fromTimestamp) {
      filteredEvents = filteredEvents.filter(e => e.metadata.timestamp >= config.fromTimestamp!);
    }
    
    if (config.toTimestamp) {
      filteredEvents = filteredEvents.filter(e => e.metadata.timestamp <= config.toTimestamp!);
    }
    
    if (config.eventTypes) {
      filteredEvents = filteredEvents.filter(e => config.eventTypes!.includes(e.type));
    }
    
    // Replay events
    let replayedCount = 0;
    for (const event of filteredEvents) {
      // Calculate delay based on original timing and speed multiplier
      const originalDelay = replayedCount > 0 ? 
        event.metadata.timestamp - filteredEvents[replayedCount - 1].metadata.timestamp : 0;
      const adjustedDelay = Math.max(0, originalDelay / config.speedMultiplier);
      
      if (adjustedDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, adjustedDelay));
      }
      
      // Emit replayed event
      this.eventStream.next(event);
      
      // Call callback if provided
      if (config.onEvent) {
        await config.onEvent(event);
      }
      
      replayedCount++;
    }
    
    const replayDuration = Date.now() - startTime;
    
    this.logger.info('Event replay completed', {
      streamId: config.streamId,
      totalEvents: replayedCount,
      replayDuration
    });
    
    return {
      totalEvents: replayedCount,
      replayDuration
    };
  }

  /**
   * Gets event stream for real-time processing
   */
  getEventStream(): Observable<DomainEvent> {
    return this.eventStream.asObservable();
  }

  /**
   * Gets CEP event stream
   */
  getCEPEventStream(): Observable<CEPContext> {
    return this.cepEventStream.asObservable();
  }

  /**
   * Gets saga event stream
   */
  getSagaEventStream(): Observable<SagaEvent> {
    return this.sagaEventStream.asObservable();
  }

  /**
   * Validates a domain event
   * 
   * @private
   */
  private validateEvent(event: DomainEvent): void {
    if (!event.id || !event.type || !event.aggregateId || !event.aggregateType) {
      throw new Error('Event missing required fields');
    }
    
    if (!event.metadata || !event.metadata.timestamp || !event.metadata.version) {
      throw new Error('Event metadata incomplete');
    }
  }

  /**
   * Gets subscribers for a specific event
   * 
   * @private
   */
  private getSubscribersForEvent(event: DomainEvent): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(subscription => 
      this.matchesEventPattern(event, subscription.eventPattern)
    );
  }

  /**
   * Checks if event matches subscription pattern
   * 
   * @private
   */
  private matchesEventPattern(event: DomainEvent, pattern: EventPattern): boolean {
    // Check event types
    if (pattern.eventTypes && pattern.eventTypes.length > 0) {
      const matches = pattern.eventTypes.some(type => {
        if (type.includes('*')) {
          const regex = new RegExp(type.replace(/\*/g, '.*'));
          return regex.test(event.type);
        }
        return type === event.type;
      });
      
      if (!matches) return false;
    }
    
    // Check aggregate types
    if (pattern.aggregateTypes && pattern.aggregateTypes.length > 0) {
      if (!pattern.aggregateTypes.includes(event.aggregateType)) {
        return false;
      }
    }
    
    // Check custom predicate
    if (pattern.predicate && !pattern.predicate(event)) {
      return false;
    }
    
    return true;
  }

  /**
   * Delivers event to subscribers
   * 
   * @private
   */
  private async deliverToSubscribers(event: DomainEvent): Promise<void> {
    const subscribers = this.getSubscribersForEvent(event);
    
    const deliveryPromises = subscribers.map(subscription => 
      this.deliverEventToSubscriber(event, subscription)
    );
    
    await Promise.all(deliveryPromises);
  }

  /**
   * Delivers event to a specific subscriber
   * 
   * @private
   */
  private async deliverEventToSubscriber(
    event: DomainEvent,
    subscription: EventSubscription
  ): Promise<void> {
    try {
      // Create event message
      const eventMessage: AgentMessage = {
        id: `event_delivery_${event.id}_${subscription.id}`,
        fromAgentId: 'event_system',
        toAgentId: subscription.subscriberId,
        type: 'notification',
        content: `Domain event: ${event.type}`,
        data: {
          event,
          subscription: subscription.id,
          deliveryGuarantee: subscription.deliveryGuarantee
        },
        timestamp: Date.now(),
        priority: 'medium'
      };
      
      // Attempt delivery
      const deliveryResult = await this.communicationHub.sendMessage(
        'event_system',
        subscription.subscriberId,
        eventMessage
      );
      
      if (deliveryResult.success) {
        subscription.metadata.deliveryCount++;
        subscription.metadata.lastDelivered = Date.now();
      } else {
        subscription.metadata.failureCount++;
        
        // Handle delivery guarantees
        if (subscription.deliveryGuarantee === 'at_least_once') {
          // Schedule retry
          setTimeout(() => {
            this.deliverEventToSubscriber(event, subscription);
          }, 5000);
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to deliver event to subscriber', {
        eventId: event.id,
        subscriberId: subscription.subscriberId,
        error: error instanceof Error ? error.message : error
      });
      
      subscription.metadata.failureCount++;
    }
  }

  /**
   * Initializes event processing
   * 
   * @private
   */
  private initializeEventProcessing(): void {
    // Set up event stream processing
    this.eventStream.subscribe({
      next: (event) => {
        this.logger.debug('Event processed', {
          eventId: event.id,
          eventType: event.type
        });
      },
      error: (error) => {
        this.logger.error('Event stream error', { error });
      }
    });
    
    this.logger.info('Event processing initialized');
  }

  /**
   * Initializes complex event processing
   * 
   * @private
   */
  private initializeCEPProcessing(): void {
    // Process CEP rules at regular intervals
    setInterval(() => {
      this.processCEPRules();
    }, this.config.cepProcessingInterval);
    
    this.logger.info('CEP processing initialized');
  }

  /**
   * Processes all CEP rules against recent events
   * 
   * @private
   */
  private async processCEPRules(): Promise<void> {
    if (this.cepRules.size === 0) return;
    
    // Get recent events (simplified - would be more sophisticated in real implementation)
    const recentEvents = await this.getRecentEvents(60000); // Last minute
    
    for (const rule of this.cepRules.values()) {
      if (!rule.enabled) continue;
      
      try {
        const matches = this.evaluateRulePattern(rule, recentEvents);
        
        if (matches.length > 0) {
          for (const match of matches) {
            await this.executeCEPAction(rule, match);
          }
        }
      } catch (error) {
        this.logger.error('CEP rule processing failed', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Gets recent events for CEP processing
   * 
   * @private
   */
  private async getRecentEvents(timeWindow: number): Promise<DomainEvent[]> {
    // Simplified implementation - in reality would use more efficient querying
    const allEventTypes = Array.from(this.cepRules.values())
      .flatMap(rule => rule.pattern.conditions.map(c => c.eventType));
    
    const events = await this.eventStore.readEventsByType(allEventTypes);
    const cutoffTime = Date.now() - timeWindow;
    
    return events.filter(event => event.metadata.timestamp >= cutoffTime);
  }

  /**
   * Evaluates a CEP rule pattern against events
   * 
   * @private
   */
  private evaluateRulePattern(rule: CEPRule, events: DomainEvent[]): DomainEvent[][] {
    // Simplified pattern matching - real implementation would be much more sophisticated
    const matches: DomainEvent[][] = [];
    
    switch (rule.pattern.type) {
      case 'sequence':
        matches.push(...this.evaluateSequencePattern(rule.pattern, events));
        break;
      case 'conjunction':
        matches.push(...this.evaluateConjunctionPattern(rule.pattern, events));
        break;
      case 'temporal':
        matches.push(...this.evaluateTemporalPattern(rule.pattern, events));
        break;
      // Add other pattern types as needed
    }
    
    return matches;
  }

  /**
   * Evaluates sequence pattern
   * 
   * @private
   */
  private evaluateSequencePattern(
    pattern: EventSequencePattern,
    events: DomainEvent[]
  ): DomainEvent[][] {
    const matches: DomainEvent[][] = [];
    
    // Simplified sequence matching
    for (let i = 0; i < events.length - pattern.conditions.length + 1; i++) {
      const candidate: DomainEvent[] = [];
      let conditionIndex = 0;
      
      for (let j = i; j < events.length && conditionIndex < pattern.conditions.length; j++) {
        const event = events[j];
        const condition = pattern.conditions[conditionIndex];
        
        if (this.eventMatchesCondition(event, condition)) {
          candidate.push(event);
          conditionIndex++;
          
          if (conditionIndex === pattern.conditions.length) {
            // Check time window constraint
            if (pattern.timeWindow) {
              const timeSpan = candidate[candidate.length - 1].metadata.timestamp - 
                              candidate[0].metadata.timestamp;
              
              if (timeSpan <= pattern.timeWindow.duration) {
                matches.push(candidate);
              }
            } else {
              matches.push(candidate);
            }
            break;
          }
        }
      }
    }
    
    return matches;
  }

  /**
   * Evaluates conjunction pattern (all conditions must be met)
   * 
   * @private
   */
  private evaluateConjunctionPattern(
    pattern: EventSequencePattern,
    events: DomainEvent[]
  ): DomainEvent[][] {
    const matches: DomainEvent[][] = [];
    const matchedEvents = new Map<string, DomainEvent[]>();
    
    // Group events by condition
    for (const condition of pattern.conditions) {
      const conditionMatches = events.filter(event => 
        this.eventMatchesCondition(event, condition)
      );
      matchedEvents.set(condition.eventType, conditionMatches);
    }
    
    // Check if all conditions have matches
    const allConditionsMet = pattern.conditions.every(condition => 
      (matchedEvents.get(condition.eventType)?.length || 0) > 0
    );
    
    if (allConditionsMet) {
      // Create combinations (simplified)
      const combination: DomainEvent[] = [];
      for (const condition of pattern.conditions) {
        const conditionEvents = matchedEvents.get(condition.eventType) || [];
        if (conditionEvents.length > 0) {
          combination.push(conditionEvents[0]); // Take first match
        }
      }
      
      if (combination.length === pattern.conditions.length) {
        matches.push(combination);
      }
    }
    
    return matches;
  }

  /**
   * Evaluates temporal pattern
   * 
   * @private
   */
  private evaluateTemporalPattern(
    pattern: EventSequencePattern,
    events: DomainEvent[]
  ): DomainEvent[][] {
    // Simplified temporal pattern matching
    return this.evaluateSequencePattern(pattern, events);
  }

  /**
   * Checks if event matches condition
   * 
   * @private
   */
  private eventMatchesCondition(event: DomainEvent, condition: EventCondition): boolean {
    // Check event type
    if (condition.eventType !== event.type) {
      return false;
    }
    
    // Check aggregate type
    if (condition.aggregateType && condition.aggregateType !== event.aggregateType) {
      return false;
    }
    
    // Check data constraints (simplified)
    if (condition.dataConstraints) {
      for (const [key, value] of Object.entries(condition.dataConstraints)) {
        if (event.data[key] !== value) {
          return false;
        }
      }
    }
    
    // Check custom predicate
    if (condition.predicate && !condition.predicate(event)) {
      return false;
    }
    
    return true;
  }

  /**
   * Executes CEP action when rule matches
   * 
   * @private
   */
  private async executeCEPAction(rule: CEPRule, matchedEvents: DomainEvent[]): Promise<void> {
    const context: CEPContext = {
      rule,
      matchedEvents,
      matchTimestamp: Date.now(),
      contextData: {}
    };
    
    // Update rule statistics
    rule.statistics.matchCount++;
    rule.statistics.lastMatch = Date.now();
    
    const actionStart = Date.now();
    
    try {
      switch (rule.action.type) {
        case 'emit_event':
          await this.executeCEPEmitEventAction(rule.action, context);
          break;
        case 'send_message':
          await this.executeCEPSendMessageAction(rule.action, context);
          break;
        case 'custom':
          if (rule.action.handler) {
            await rule.action.handler(matchedEvents, context);
          }
          break;
      }
      
      // Emit CEP event
      this.cepEventStream.next(context);
      
    } catch (error) {
      this.logger.error('CEP action execution failed', {
        ruleId: rule.id,
        actionType: rule.action.type,
        error: error instanceof Error ? error.message : error
      });
    } finally {
      const executionTime = Date.now() - actionStart;
      rule.statistics.avgProcessingTime = 
        (rule.statistics.avgProcessingTime + executionTime) / 2;
    }
  }

  /**
   * Executes emit event action
   * 
   * @private
   */
  private async executeCEPEmitEventAction(
    action: CEPAction,
    context: CEPContext
  ): Promise<void> {
    const eventData = action.config.eventData || {};
    const eventType = action.config.eventType as string;
    const aggregateId = action.config.aggregateId as string || 'cep_system';
    
    const event: DomainEvent = {
      id: `cep_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      aggregateId,
      aggregateType: 'cep_rule',
      data: {
        ...eventData,
        triggeredBy: context.rule.id,
        matchedEventIds: context.matchedEvents.map(e => e.id)
      },
      metadata: {
        timestamp: Date.now(),
        version: 1,
        source: 'cep_engine',
        correlationId: context.rule.id
      },
      schemaVersion: '1.0'
    };
    
    await this.publishEvent(event);
  }

  /**
   * Executes send message action
   * 
   * @private
   */
  private async executeCEPSendMessageAction(
    action: CEPAction,
    context: CEPContext
  ): Promise<void> {
    const targetAgentId = action.config.targetAgentId as string;
    const messageContent = action.config.messageContent as string;
    
    const message: AgentMessage = {
      id: `cep_message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgentId: 'cep_engine',
      toAgentId: targetAgentId,
      type: 'notification',
      content: messageContent,
      data: {
        ruleId: context.rule.id,
        matchedEvents: context.matchedEvents,
        context
      },
      timestamp: Date.now(),
      priority: 'high'
    };
    
    await this.communicationHub.sendMessage('cep_engine', targetAgentId, message);
  }

  /**
   * Initializes saga processing
   * 
   * @private
   */
  private initializeSagaProcessing(): void {
    // Monitor saga timeouts
    setInterval(() => {
      this.checkSagaTimeouts();
    }, 30000); // Check every 30 seconds
    
    this.logger.info('Saga processing initialized');
  }

  /**
   * Executes a saga instance
   * 
   * @private
   */
  private async executeSaga(sagaInstance: SagaInstance): Promise<void> {
    try {
      while (sagaInstance.currentStep < sagaInstance.definition.steps.length) {
        const step = sagaInstance.definition.steps[sagaInstance.currentStep];
        
        this.logger.info('Executing saga step', {
          sagaInstanceId: sagaInstance.id,
          stepId: step.id,
          stepName: step.name
        });
        
        const result = await this.executeSagaStep(sagaInstance, step);
        
        if (result.success) {
          sagaInstance.completedSteps.add(step.id);
          sagaInstance.currentStep++;
          sagaInstance.lastActivity = Date.now();
          
          // Update saga data with step result
          if (result.data) {
            sagaInstance.data = { ...sagaInstance.data, ...result.data };
          }
          
        } else {
          // Step failed, start compensation
          await this.compensateSaga(sagaInstance, step, result.error);
          return;
        }
      }
      
      // All steps completed successfully
      sagaInstance.state = 'completed';
      sagaInstance.completedAt = Date.now();
      
      this.emitSagaEvent({
        type: 'saga_completed',
        sagaInstanceId: sagaInstance.id,
        data: sagaInstance.data,
        timestamp: Date.now()
      });
      
      this.activeSagas.delete(sagaInstance.id);
      
    } catch (error) {
      this.logger.error('Saga execution failed', {
        sagaInstanceId: sagaInstance.id,
        error: error instanceof Error ? error.message : error
      });
      
      sagaInstance.state = 'failed';
      sagaInstance.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emitSagaEvent({
        type: 'saga_failed',
        sagaInstanceId: sagaInstance.id,
        error: sagaInstance.error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Executes a single saga step
   * 
   * @private
   */
  private async executeSagaStep(
    sagaInstance: SagaInstance,
    step: SagaStep
  ): Promise<SagaActionResult> {
    let attempt = 0;
    let lastError: string = '';
    
    while (attempt < step.retry.maxAttempts) {
      try {
        const result = await this.executeSagaAction(step.action, sagaInstance.data);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error || 'Unknown error';
        
        if (!result.retryable) {
          break;
        }
        
        attempt++;
        
        if (attempt < step.retry.maxAttempts) {
          const delay = step.retry.initialDelay * Math.pow(step.retry.backoffMultiplier, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        attempt++;
      }
    }
    
    return {
      success: false,
      error: lastError,
      retryable: false
    };
  }

  /**
   * Executes a saga action
   * 
   * @private
   */
  private async executeSagaAction(
    action: SagaAction,
    sagaData: Record<string, unknown>
  ): Promise<SagaActionResult> {
    const payload = {
      ...action.payload,
      sagaData
    };
    
    switch (action.type) {
      case 'emit_event':
        return this.executeSagaEmitEventAction(action.target, payload);
      case 'send_command':
        return this.executeSagaSendCommandAction(action.target, payload);
      case 'custom':
        if (action.handler) {
          return action.handler(payload);
        }
        break;
    }
    
    return {
      success: false,
      error: `Unknown action type: ${action.type}`,
      retryable: false
    };
  }

  /**
   * Executes saga emit event action
   * 
   * @private
   */
  private async executeSagaEmitEventAction(
    target: string,
    payload: Record<string, unknown>
  ): Promise<SagaActionResult> {
    try {
      const event: DomainEvent = {
        id: `saga_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: payload.eventType as string,
        aggregateId: payload.aggregateId as string,
        aggregateType: payload.aggregateType as string || 'saga',
        data: payload.eventData as Record<string, unknown> || {},
        metadata: {
          timestamp: Date.now(),
          version: 1,
          source: 'saga_engine'
        },
        schemaVersion: '1.0'
      };
      
      const result = await this.publishEvent(event);
      
      return {
        success: result.success,
        data: { eventId: event.id },
        error: result.error,
        retryable: !result.success
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  /**
   * Executes saga send command action
   * 
   * @private
   */
  private async executeSagaSendCommandAction(
    target: string,
    payload: Record<string, unknown>
  ): Promise<SagaActionResult> {
    try {
      const message: AgentMessage = {
        id: `saga_command_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromAgentId: 'saga_engine',
        toAgentId: target,
        type: 'collaboration',
        content: 'Saga command execution',
        data: payload,
        timestamp: Date.now(),
        priority: 'high'
      };
      
      const result = await this.communicationHub.sendMessage('saga_engine', target, message);
      
      return {
        success: result.success,
        data: { messageId: message.id },
        error: result.error,
        retryable: !result.success
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  /**
   * Compensates a saga after step failure
   * 
   * @private
   */
  private async compensateSaga(
    sagaInstance: SagaInstance,
    failedStep: SagaStep,
    failureReason?: string
  ): Promise<void> {
    sagaInstance.state = 'compensating';
    
    this.logger.info('Starting saga compensation', {
      sagaInstanceId: sagaInstance.id,
      failedStep: failedStep.id,
      failureReason
    });
    
    // Compensate completed steps in reverse order
    const completedSteps = sagaInstance.definition.steps
      .filter(step => sagaInstance.completedSteps.has(step.id))
      .reverse();
    
    for (const step of completedSteps) {
      try {
        const result = await this.executeSagaAction(step.compensation, sagaInstance.data);
        
        if (result.success) {
          sagaInstance.compensatedSteps.add(step.id);
        } else {
          this.logger.error('Saga compensation step failed', {
            sagaInstanceId: sagaInstance.id,
            stepId: step.id,
            error: result.error
          });
        }
        
      } catch (error) {
        this.logger.error('Saga compensation error', {
          sagaInstanceId: sagaInstance.id,
          stepId: step.id,
          error: error instanceof Error ? error.message : error
        });
      }
    }
    
    sagaInstance.state = 'compensated';
    sagaInstance.completedAt = Date.now();
    sagaInstance.error = failureReason;
    
    this.emitSagaEvent({
      type: 'saga_compensated',
      sagaInstanceId: sagaInstance.id,
      failureReason,
      compensatedSteps: Array.from(sagaInstance.compensatedSteps),
      timestamp: Date.now()
    });
    
    this.activeSagas.delete(sagaInstance.id);
  }

  /**
   * Checks for saga timeouts
   * 
   * @private
   */
  private checkSagaTimeouts(): void {
    const now = Date.now();
    
    for (const [instanceId, sagaInstance] of this.activeSagas) {
      const timeoutDuration = sagaInstance.definition.timeout || this.config.sagaTimeout;
      
      if (now - sagaInstance.startedAt > timeoutDuration) {
        this.logger.warn('Saga timeout detected', {
          sagaInstanceId: instanceId,
          startedAt: sagaInstance.startedAt,
          timeout: timeoutDuration
        });
        
        // Start compensation due to timeout
        const currentStep = sagaInstance.definition.steps[sagaInstance.currentStep];
        this.compensateSaga(sagaInstance, currentStep, 'Saga timeout');
      }
    }
  }

  /**
   * Emits saga event
   * 
   * @private
   */
  private emitSagaEvent(event: SagaEvent): void {
    this.sagaEventStream.next(event);
  }

  /**
   * Gets active sagas
   */
  getActiveSagas(): Map<string, SagaInstance> {
    return new Map(this.activeSagas);
  }

  /**
   * Gets CEP rules
   */
  getCEPRules(): Map<string, CEPRule> {
    return new Map(this.cepRules);
  }

  /**
   * Gets event subscriptions
   */
  getEventSubscriptions(): Map<string, EventSubscription> {
    return new Map(this.subscriptions);
  }

  /**
   * Shuts down the event-driven architecture system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down EventDrivenArchitecture system');
    
    // Complete all active sagas with compensation
    for (const [instanceId, sagaInstance] of this.activeSagas) {
      if (sagaInstance.state === 'running') {
        const currentStep = sagaInstance.definition.steps[sagaInstance.currentStep];
        await this.compensateSaga(sagaInstance, currentStep, 'System shutdown');
      }
    }
    
    // Complete event streams
    this.eventStream.complete();
    this.cepEventStream.complete();
    this.sagaEventStream.complete();
    
    // Clear data structures
    this.subscriptions.clear();
    this.cepRules.clear();
    this.activeSagas.clear();
    this.patternMatcherState.clear();
    
    this.logger.info('EventDrivenArchitecture system shutdown complete');
  }
}

// Supporting interfaces and types

interface PatternMatchState {
  ruleId: string;
  partialMatches: DomainEvent[];
  lastProcessed: number;
}

interface SagaInstance {
  id: string;
  sagaId: string;
  definition: SagaDefinition;
  state: 'running' | 'compensating' | 'completed' | 'compensated' | 'failed';
  currentStep: number;
  data: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  completedSteps: Set<string>;
  compensatedSteps: Set<string>;
  lastActivity: number;
  error?: string;
}

interface SagaEvent {
  type: 'saga_started' | 'saga_completed' | 'saga_failed' | 'saga_compensated';
  sagaInstanceId: string;
  data?: Record<string, unknown>;
  error?: string;
  failureReason?: string;
  compensatedSteps?: string[];
  timestamp: number;
}