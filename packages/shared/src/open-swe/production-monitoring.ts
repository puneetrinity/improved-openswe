/**
 * Production monitoring and operational features for coordination systems
 * 
 * This module provides comprehensive monitoring, alerting, metrics collection,
 * and operational capabilities for production deployment of coordination patterns.
 */

import { Observable, Subject } from 'rxjs';
import { createLogger, LogLevel } from '../../../../apps/open-swe/src/utils/logger.js';
import type { AgentEvent } from './types.js';

/**
 * Production monitoring configuration
 */
export interface ProductionMonitoringConfig {
  metricsCollectionInterval: number;
  alertEvaluationInterval: number;
  dataRetentionPeriod: number;
  maxHistorySize: number;
  enableDetailedTracing: boolean;
  enablePerformanceAnalytics: boolean;
  enablePredictiveAnalytics: boolean;
  alertThresholds: {
    unhealthyComponentThreshold: number;
    failureRateThreshold: number;
    averageResponseTimeThreshold: number;
    activeWorkflowThreshold: number;
    memoryUsageThreshold: number;
    cpuUsageThreshold: number;
  };
}

/**
 * System health snapshot
 */
export interface HealthSnapshot {
  timestamp: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: Map<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Record<string, number>;
    details: string;
  }>;
  recommendations: string[];
}

/**
 * Operational metrics
 */
export interface OperationalMetrics {
  workflowMetrics: {
    totalExecuted: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    throughputPerSecond: number;
    executionHistory: Array<{
      workflowId: string;
      startTime: number;
      endTime: number;
      success: boolean;
      stepsExecuted: number;
      errors: string[];
      resourcesUsed: Record<string, number>;
    }>;
  };
  resourceMetrics: {
    activeWorkflows: number;
    peakActiveWorkflows: number;
    totalStepsExecuted: number;
    averageStepsPerWorkflow: number;
    resourceUtilization: Map<string, {
      current: number;
      peak: number;
      average: number;
    }>;
    memoryUsage: {
      used: number;
      available: number;
      peak: number;
    };
    cpuUsage: {
      current: number;
      average: number;
      peak: number;
    };
  };
  errorMetrics: {
    errorsByType: Map<string, number>;
    errorsByComponent: Map<string, number>;
    errorsByTimeframe: Map<string, number>;
    recentErrors: Array<{
      timestamp: number;
      component: string;
      error: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      stackTrace?: string;
      context: Record<string, any>;
    }>;
  };
  performanceMetrics: {
    responseTimePercentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
    throughputTrends: Array<{
      timestamp: number;
      requestsPerSecond: number;
      successRate: number;
    }>;
    resourceEfficiency: {
      cpuEfficiency: number;
      memoryEfficiency: number;
      networkEfficiency: number;
    };
  };
}

/**
 * Alert definition
 */
export interface Alert {
  id: string;
  type: 'health' | 'performance' | 'error' | 'resource' | 'security' | 'capacity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
  actions: string[];
}

/**
 * Trace information for detailed debugging
 */
export interface TraceInfo {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields: Record<string, any>;
  }>;
}

/**
 * Production monitoring system for coordination patterns
 */
export class ProductionMonitoring {
  private readonly config: ProductionMonitoringConfig;
  private readonly logger = createLogger('ProductionMonitoring', LogLevel.INFO);
  
  /**
   * Health monitoring
   */
  private readonly healthHistory = new Map<string, HealthSnapshot[]>();
  private readonly currentHealth = new Map<string, HealthSnapshot>();
  
  /**
   * Metrics collection
   */
  private readonly operationalMetrics: OperationalMetrics = {
    workflowMetrics: {
      totalExecuted: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      throughputPerSecond: 0,
      executionHistory: []
    },
    resourceMetrics: {
      activeWorkflows: 0,
      peakActiveWorkflows: 0,
      totalStepsExecuted: 0,
      averageStepsPerWorkflow: 0,
      resourceUtilization: new Map(),
      memoryUsage: { used: 0, available: 0, peak: 0 },
      cpuUsage: { current: 0, average: 0, peak: 0 }
    },
    errorMetrics: {
      errorsByType: new Map(),
      errorsByComponent: new Map(),
      errorsByTimeframe: new Map(),
      recentErrors: []
    },
    performanceMetrics: {
      responseTimePercentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
      throughputTrends: [],
      resourceEfficiency: {
        cpuEfficiency: 0,
        memoryEfficiency: 0,
        networkEfficiency: 0
      }
    }
  };
  
  /**
   * Alert management
   */
  private readonly activeAlerts = new Map<string, Alert>();
  private readonly alertHistory: Alert[] = [];
  private readonly alertStream = new Subject<Alert>();
  
  /**
   * Tracing support
   */
  private readonly activeTraces = new Map<string, TraceInfo>();
  private readonly completedTraces: TraceInfo[] = [];
  
  /**
   * Event streams
   */
  private readonly healthStream = new Subject<HealthSnapshot>();
  private readonly metricsStream = new Subject<OperationalMetrics>();
  
  /**
   * Monitoring intervals
   */
  private metricsInterval?: NodeJS.Timeout;
  private alertInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<ProductionMonitoringConfig> = {}) {
    this.config = {
      metricsCollectionInterval: 10000, // 10 seconds
      alertEvaluationInterval: 15000, // 15 seconds
      dataRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxHistorySize: 10000,
      enableDetailedTracing: false,
      enablePerformanceAnalytics: true,
      enablePredictiveAnalytics: false,
      alertThresholds: {
        unhealthyComponentThreshold: 2,
        failureRateThreshold: 0.1,
        averageResponseTimeThreshold: 30000,
        activeWorkflowThreshold: 100,
        memoryUsageThreshold: 0.85,
        cpuUsageThreshold: 0.8
      },
      ...config
    };

    this.initialize();
  }

  /**
   * Initializes monitoring system
   */
  private initialize(): void {
    this.logger.info('Initializing production monitoring system');

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    // Start alert evaluation
    this.alertInterval = setInterval(() => {
      this.evaluateAlerts();
    }, this.config.alertEvaluationInterval);

    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000); // 5 minutes

    this.logger.info('Production monitoring system initialized');
  }

  /**
   * Records workflow execution metrics
   */
  recordWorkflowExecution(workflowId: string, startTime: number, endTime: number, 
                         success: boolean, stepsExecuted: number, errors: string[] = [],
                         resourcesUsed: Record<string, number> = {}): void {
    const execution = {
      workflowId,
      startTime,
      endTime,
      success,
      stepsExecuted,
      errors,
      resourcesUsed
    };

    this.operationalMetrics.workflowMetrics.executionHistory.push(execution);
    this.operationalMetrics.workflowMetrics.totalExecuted++;

    if (success) {
      this.operationalMetrics.workflowMetrics.successfulExecutions++;
    } else {
      this.operationalMetrics.workflowMetrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime = this.operationalMetrics.workflowMetrics.executionHistory
      .reduce((sum, ex) => sum + (ex.endTime - ex.startTime), 0);
    this.operationalMetrics.workflowMetrics.averageExecutionTime = 
      totalTime / this.operationalMetrics.workflowMetrics.totalExecuted;

    // Update steps metrics
    this.operationalMetrics.resourceMetrics.totalStepsExecuted += stepsExecuted;
    this.operationalMetrics.resourceMetrics.averageStepsPerWorkflow =
      this.operationalMetrics.resourceMetrics.totalStepsExecuted / 
      this.operationalMetrics.workflowMetrics.totalExecuted;

    // Limit history size
    if (this.operationalMetrics.workflowMetrics.executionHistory.length > this.config.maxHistorySize) {
      this.operationalMetrics.workflowMetrics.executionHistory = 
        this.operationalMetrics.workflowMetrics.executionHistory.slice(-this.config.maxHistorySize);
    }

    this.logger.debug('Workflow execution recorded', {
      workflowId,
      success,
      duration: endTime - startTime,
      stepsExecuted
    });
  }

  /**
   * Records error information
   */
  recordError(component: string, error: any, severity: 'low' | 'medium' | 'high' | 'critical',
             context: Record<string, any> = {}): void {
    const errorInfo = {
      timestamp: Date.now(),
      component,
      error: error instanceof Error ? error.message : String(error),
      severity,
      stackTrace: error instanceof Error ? error.stack : undefined,
      context
    };

    this.operationalMetrics.errorMetrics.recentErrors.push(errorInfo);

    // Update error counts
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    this.operationalMetrics.errorMetrics.errorsByType.set(
      errorType,
      (this.operationalMetrics.errorMetrics.errorsByType.get(errorType) || 0) + 1
    );
    
    this.operationalMetrics.errorMetrics.errorsByComponent.set(
      component,
      (this.operationalMetrics.errorMetrics.errorsByComponent.get(component) || 0) + 1
    );

    // Create alert for high severity errors
    if (severity === 'high' || severity === 'critical') {
      this.createAlert({
        type: 'error',
        severity,
        title: `${severity.toUpperCase()} Error in ${component}`,
        message: `Error occurred: ${errorInfo.error}`,
        metadata: { component, errorType, context },
        actions: ['check_logs', 'restart_component', 'escalate']
      });
    }

    // Limit error history
    if (this.operationalMetrics.errorMetrics.recentErrors.length > this.config.maxHistorySize) {
      this.operationalMetrics.errorMetrics.recentErrors = 
        this.operationalMetrics.errorMetrics.recentErrors.slice(-this.config.maxHistorySize);
    }

    this.logger.error('Error recorded', errorInfo);
  }

  /**
   * Updates resource utilization metrics
   */
  updateResourceUtilization(resourceId: string, currentUsage: number, 
                           peakUsage?: number, averageUsage?: number): void {
    const existing = this.operationalMetrics.resourceMetrics.resourceUtilization.get(resourceId) || 
      { current: 0, peak: 0, average: 0 };

    this.operationalMetrics.resourceMetrics.resourceUtilization.set(resourceId, {
      current: currentUsage,
      peak: peakUsage !== undefined ? Math.max(existing.peak, peakUsage) : existing.peak,
      average: averageUsage !== undefined ? averageUsage : existing.average
    });
  }

  /**
   * Records health snapshot
   */
  recordHealthSnapshot(systemId: string, snapshot: HealthSnapshot): void {
    this.currentHealth.set(systemId, snapshot);

    if (!this.healthHistory.has(systemId)) {
      this.healthHistory.set(systemId, []);
    }

    const history = this.healthHistory.get(systemId)!;
    history.push(snapshot);

    // Limit history size
    if (history.length > this.config.maxHistorySize) {
      this.healthHistory.set(systemId, history.slice(-this.config.maxHistorySize));
    }

    // Emit health update
    this.healthStream.next(snapshot);

    this.logger.debug('Health snapshot recorded', {
      systemId,
      status: snapshot.overall,
      componentCount: snapshot.components.size
    });
  }

  /**
   * Creates an alert
   */
  createAlert(alertData: {
    type: Alert['type'];
    severity: Alert['severity'];
    title: string;
    message: string;
    metadata?: Record<string, any>;
    actions?: string[];
  }): string {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      acknowledged: false,
      metadata: {},
      actions: [],
      ...alertData
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Emit alert
    this.alertStream.next(alert);

    this.logger.warn('Alert created', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title
    });

    return alert.id;
  }

  /**
   * Acknowledges an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.info('Alert acknowledged', { alertId, title: alert.title });
      return true;
    }
    return false;
  }

  /**
   * Resolves an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      this.activeAlerts.delete(alertId);
      this.logger.info('Alert resolved', { alertId, title: alert.title });
      return true;
    }
    return false;
  }

  /**
   * Starts a distributed trace
   */
  startTrace(operationName: string, parentSpanId?: string): string {
    if (!this.config.enableDetailedTracing) {
      return '';
    }

    const traceInfo: TraceInfo = {
      traceId: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      spanId: `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: []
    };

    this.activeTraces.set(traceInfo.traceId, traceInfo);
    return traceInfo.traceId;
  }

  /**
   * Adds a log entry to a trace
   */
  addTraceLog(traceId: string, level: 'debug' | 'info' | 'warn' | 'error', 
             message: string, fields: Record<string, any> = {}): void {
    if (!this.config.enableDetailedTracing) {
      return;
    }

    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
      });
    }
  }

  /**
   * Completes a trace
   */
  completeTrace(traceId: string): void {
    if (!this.config.enableDetailedTracing) {
      return;
    }

    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      this.completedTraces.push(trace);
      this.activeTraces.delete(traceId);

      // Limit completed traces
      if (this.completedTraces.length > this.config.maxHistorySize) {
        this.completedTraces.splice(0, this.completedTraces.length - this.config.maxHistorySize);
      }
    }
  }

  /**
   * Collects current metrics
   */
  private collectMetrics(): void {
    // Update throughput
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentExecutions = this.operationalMetrics.workflowMetrics.executionHistory
      .filter(ex => ex.endTime >= oneSecondAgo);
    
    this.operationalMetrics.workflowMetrics.throughputPerSecond = recentExecutions.length;

    // Update active workflows count
    this.operationalMetrics.resourceMetrics.activeWorkflows = this.activeTraces.size;
    this.operationalMetrics.resourceMetrics.peakActiveWorkflows = 
      Math.max(this.operationalMetrics.resourceMetrics.peakActiveWorkflows,
               this.operationalMetrics.resourceMetrics.activeWorkflows);

    // Calculate performance percentiles
    const executionTimes = this.operationalMetrics.workflowMetrics.executionHistory
      .slice(-1000) // Last 1000 executions
      .map(ex => ex.endTime - ex.startTime)
      .sort((a, b) => a - b);

    if (executionTimes.length > 0) {
      this.operationalMetrics.performanceMetrics.responseTimePercentiles = {
        p50: this.calculatePercentile(executionTimes, 0.5),
        p90: this.calculatePercentile(executionTimes, 0.9),
        p95: this.calculatePercentile(executionTimes, 0.95),
        p99: this.calculatePercentile(executionTimes, 0.99)
      };
    }

    // Add throughput trend data point
    const successfulRecent = recentExecutions.filter(ex => ex.success).length;
    this.operationalMetrics.performanceMetrics.throughputTrends.push({
      timestamp: now,
      requestsPerSecond: recentExecutions.length,
      successRate: recentExecutions.length > 0 ? successfulRecent / recentExecutions.length : 1
    });

    // Limit trend data
    if (this.operationalMetrics.performanceMetrics.throughputTrends.length > this.config.maxHistorySize) {
      this.operationalMetrics.performanceMetrics.throughputTrends = 
        this.operationalMetrics.performanceMetrics.throughputTrends.slice(-this.config.maxHistorySize);
    }

    // Emit metrics update
    this.metricsStream.next({ ...this.operationalMetrics });
  }

  /**
   * Evaluates alert conditions
   */
  private evaluateAlerts(): void {
    const now = Date.now();

    // Check failure rate
    const recentExecutions = this.operationalMetrics.workflowMetrics.executionHistory
      .filter(ex => ex.endTime >= now - 300000); // Last 5 minutes

    if (recentExecutions.length >= 10) { // Only check if we have enough samples
      const failureRate = recentExecutions.filter(ex => !ex.success).length / recentExecutions.length;
      
      if (failureRate > this.config.alertThresholds.failureRateThreshold) {
        this.createAlert({
          type: 'performance',
          severity: failureRate > 0.5 ? 'critical' : 'high',
          title: 'High Failure Rate Detected',
          message: `Failure rate is ${(failureRate * 100).toFixed(1)}% over the last 5 minutes`,
          metadata: { failureRate, recentExecutions: recentExecutions.length },
          actions: ['check_system_health', 'review_recent_changes', 'scale_resources']
        });
      }
    }

    // Check active workflow threshold
    if (this.operationalMetrics.resourceMetrics.activeWorkflows > this.config.alertThresholds.activeWorkflowThreshold) {
      this.createAlert({
        type: 'capacity',
        severity: 'medium',
        title: 'High Active Workflow Count',
        message: `Currently ${this.operationalMetrics.resourceMetrics.activeWorkflows} active workflows`,
        metadata: { activeWorkflows: this.operationalMetrics.resourceMetrics.activeWorkflows },
        actions: ['monitor_resources', 'consider_scaling', 'check_queue_backlog']
      });
    }

    // Check unhealthy components
    let unhealthyCount = 0;
    for (const [_, health] of this.currentHealth) {
      for (const [_, component] of health.components) {
        if (component.status === 'unhealthy') {
          unhealthyCount++;
        }
      }
    }

    if (unhealthyCount >= this.config.alertThresholds.unhealthyComponentThreshold) {
      this.createAlert({
        type: 'health',
        severity: 'high',
        title: 'Multiple Unhealthy Components',
        message: `${unhealthyCount} components are currently unhealthy`,
        metadata: { unhealthyCount },
        actions: ['investigate_components', 'restart_services', 'escalate_incident']
      });
    }
  }

  /**
   * Cleans up old data
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.dataRetentionPeriod;

    // Clean up execution history
    this.operationalMetrics.workflowMetrics.executionHistory = 
      this.operationalMetrics.workflowMetrics.executionHistory
        .filter(ex => ex.endTime >= cutoff);

    // Clean up error history
    this.operationalMetrics.errorMetrics.recentErrors = 
      this.operationalMetrics.errorMetrics.recentErrors
        .filter(err => err.timestamp >= cutoff);

    // Clean up alert history
    const oldAlerts = this.alertHistory.filter(alert => alert.timestamp < cutoff);
    this.alertHistory.splice(0, this.alertHistory.length - 
      this.alertHistory.filter(alert => alert.timestamp >= cutoff).length);

    // Clean up health history
    for (const [systemId, history] of this.healthHistory) {
      const recentHistory = history.filter(snapshot => snapshot.timestamp >= cutoff);
      this.healthHistory.set(systemId, recentHistory);
    }

    // Clean up completed traces
    this.completedTraces.splice(0, 
      this.completedTraces.length - this.completedTraces.filter(trace => 
        (trace.endTime || trace.startTime) >= cutoff).length);

    this.logger.debug('Old data cleanup completed', { 
      cutoff: new Date(cutoff).toISOString(),
      removedAlerts: oldAlerts.length
    });
  }

  /**
   * Calculates percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Gets current operational metrics
   */
  getMetrics(): OperationalMetrics {
    return { ...this.operationalMetrics };
  }

  /**
   * Gets health history for a system
   */
  getHealthHistory(systemId: string): HealthSnapshot[] {
    return this.healthHistory.get(systemId) || [];
  }

  /**
   * Gets current health status
   */
  getCurrentHealth(): Map<string, HealthSnapshot> {
    return new Map(this.currentHealth);
  }

  /**
   * Gets active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Gets alert history
   */
  getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  /**
   * Subscribes to health updates
   */
  subscribeToHealthUpdates(): Observable<HealthSnapshot> {
    return this.healthStream.asObservable();
  }

  /**
   * Subscribes to metrics updates
   */
  subscribeToMetricsUpdates(): Observable<OperationalMetrics> {
    return this.metricsStream.asObservable();
  }

  /**
   * Subscribes to alerts
   */
  subscribeToAlerts(): Observable<Alert> {
    return this.alertStream.asObservable();
  }

  /**
   * Gets system performance report
   */
  getPerformanceReport(): {
    summary: {
      totalWorkflows: number;
      successRate: number;
      averageResponseTime: number;
      throughput: number;
      errorRate: number;
    };
    trends: {
      throughputTrend: 'increasing' | 'decreasing' | 'stable';
      errorTrend: 'increasing' | 'decreasing' | 'stable';
      performanceTrend: 'improving' | 'degrading' | 'stable';
    };
    recommendations: string[];
  } {
    const metrics = this.operationalMetrics;
    
    const successRate = metrics.workflowMetrics.totalExecuted > 0 
      ? metrics.workflowMetrics.successfulExecutions / metrics.workflowMetrics.totalExecuted
      : 1;

    const errorRate = metrics.workflowMetrics.totalExecuted > 0 
      ? metrics.workflowMetrics.failedExecutions / metrics.workflowMetrics.totalExecuted
      : 0;

    const recommendations: string[] = [];

    if (successRate < 0.95) {
      recommendations.push('Success rate is below 95% - investigate frequent failure patterns');
    }

    if (metrics.workflowMetrics.averageExecutionTime > this.config.alertThresholds.averageResponseTimeThreshold) {
      recommendations.push('Average execution time is high - consider performance optimization');
    }

    if (metrics.resourceMetrics.activeWorkflows > this.config.alertThresholds.activeWorkflowThreshold * 0.8) {
      recommendations.push('Approaching workflow capacity limits - consider scaling');
    }

    return {
      summary: {
        totalWorkflows: metrics.workflowMetrics.totalExecuted,
        successRate,
        averageResponseTime: metrics.workflowMetrics.averageExecutionTime,
        throughput: metrics.workflowMetrics.throughputPerSecond,
        errorRate
      },
      trends: {
        throughputTrend: this.analyzeTrend(metrics.performanceMetrics.throughputTrends.map(t => t.requestsPerSecond)),
        errorTrend: this.analyzeTrend(metrics.performanceMetrics.throughputTrends.map(t => 1 - t.successRate)),
        performanceTrend: this.analyzeTrend([
          metrics.performanceMetrics.responseTimePercentiles.p95,
          metrics.performanceMetrics.responseTimePercentiles.p90
        ])
      },
      recommendations
    };
  }

  /**
   * Analyzes trend direction
   */
  private analyzeTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-10); // Last 10 values
    if (recent.length < 2) return 'stable';
    
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Exports monitoring data for external analysis
   */
  exportMonitoringData(): {
    timestamp: number;
    metrics: OperationalMetrics;
    alerts: Alert[];
    healthHistory: Array<{ systemId: string; history: HealthSnapshot[] }>;
    traces: TraceInfo[];
  } {
    return {
      timestamp: Date.now(),
      metrics: this.operationalMetrics,
      alerts: this.alertHistory,
      healthHistory: Array.from(this.healthHistory.entries()).map(([systemId, history]) => ({
        systemId,
        history
      })),
      traces: this.completedTraces
    };
  }

  /**
   * Shuts down monitoring system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down production monitoring system');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Complete streams
    this.alertStream.complete();
    this.healthStream.complete();
    this.metricsStream.complete();

    this.logger.info('Production monitoring system shutdown complete');
  }
}

/**
 * Configuration management for hot-reloading configuration changes
 */
export class ConfigurationManager {
  private readonly logger = createLogger('ConfigurationManager', LogLevel.INFO);
  private currentConfig: Record<string, any> = {};
  private readonly configHistory: Array<{
    timestamp: number;
    changes: Record<string, any>;
    appliedBy: string;
    reason?: string;
  }> = [];
  
  private readonly validationRules = new Map<string, (value: any) => boolean>();
  private readonly changeStream = new Subject<{
    key: string;
    oldValue: any;
    newValue: any;
    timestamp: number;
  }>();

  constructor(initialConfig: Record<string, any> = {}) {
    this.currentConfig = { ...initialConfig };
    
    this.setupDefaultValidationRules();
    this.logger.info('Configuration manager initialized');
  }

  /**
   * Sets up default validation rules
   */
  private setupDefaultValidationRules(): void {
    this.validationRules.set('maxConcurrency', (value) => 
      typeof value === 'number' && value > 0 && value <= 1000
    );
    
    this.validationRules.set('timeout', (value) => 
      typeof value === 'number' && value > 0 && value <= 300000
    );
    
    this.validationRules.set('retryAttempts', (value) => 
      typeof value === 'number' && value >= 0 && value <= 10
    );
    
    this.validationRules.set('healthCheckInterval', (value) => 
      typeof value === 'number' && value >= 5000 && value <= 300000
    );
  }

  /**
   * Updates configuration values
   */
  updateConfiguration(changes: Record<string, any>, appliedBy: string = 'system', 
                     reason?: string): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    const validChanges: Record<string, any> = {};

    // Validate all changes
    for (const [key, value] of Object.entries(changes)) {
      const validator = this.validationRules.get(key);
      if (validator && !validator(value)) {
        errors.push(`Invalid value for ${key}: ${value}`);
        continue;
      }

      validChanges[key] = value;
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply valid changes
    for (const [key, newValue] of Object.entries(validChanges)) {
      const oldValue = this.currentConfig[key];
      this.currentConfig[key] = newValue;

      this.changeStream.next({
        key,
        oldValue,
        newValue,
        timestamp: Date.now()
      });
    }

    // Record change history
    this.configHistory.push({
      timestamp: Date.now(),
      changes: validChanges,
      appliedBy,
      reason
    });

    this.logger.info('Configuration updated', {
      changes: validChanges,
      appliedBy,
      reason
    });

    return { success: true, errors: [] };
  }

  /**
   * Gets current configuration
   */
  getConfiguration(): Record<string, any> {
    return { ...this.currentConfig };
  }

  /**
   * Gets configuration change history
   */
  getConfigurationHistory(): Array<{
    timestamp: number;
    changes: Record<string, any>;
    appliedBy: string;
    reason?: string;
  }> {
    return [...this.configHistory];
  }

  /**
   * Subscribes to configuration changes
   */
  subscribeToChanges(): Observable<{
    key: string;
    oldValue: any;
    newValue: any;
    timestamp: number;
  }> {
    return this.changeStream.asObservable();
  }

  /**
   * Adds custom validation rule
   */
  addValidationRule(key: string, validator: (value: any) => boolean): void {
    this.validationRules.set(key, validator);
    this.logger.debug('Validation rule added', { key });
  }

  /**
   * Shuts down configuration manager
   */
  shutdown(): void {
    this.changeStream.complete();
    this.logger.info('Configuration manager shutdown complete');
  }
}