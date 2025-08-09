import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductionMonitoring, ConfigurationManager } from '../open-swe/production-monitoring.js';

describe('ProductionMonitoring', () => {
  let productionMonitoring: ProductionMonitoring;

  beforeEach(() => {
    productionMonitoring = new ProductionMonitoring({
      metricsCollectionInterval: 5000, // Shorter for testing
      alertEvaluationInterval: 3000,
      enableDetailedTracing: true,
      enablePerformanceAnalytics: true,
      dataRetentionPeriod: 60000, // 1 minute for testing
      maxHistorySize: 100
    });
  });

  afterEach(async () => {
    await productionMonitoring.shutdown();
  });

  describe('Workflow Execution Tracking', () => {
    it('should record successful workflow execution', () => {
      const workflowId = 'test-workflow-1';
      const startTime = Date.now() - 5000;
      const endTime = Date.now();

      productionMonitoring.recordWorkflowExecution(
        workflowId,
        startTime,
        endTime,
        true, // successful
        3, // steps executed
        [], // no errors
        { memory: 100, cpu: 50 }
      );

      const metrics = productionMonitoring.getMetrics();
      expect(metrics.workflowMetrics.totalExecuted).toBe(1);
      expect(metrics.workflowMetrics.successfulExecutions).toBe(1);
      expect(metrics.workflowMetrics.failedExecutions).toBe(0);
    });

    it('should record failed workflow execution', () => {
      const workflowId = 'test-workflow-2';
      const startTime = Date.now() - 3000;
      const endTime = Date.now();

      productionMonitoring.recordWorkflowExecution(
        workflowId,
        startTime,
        endTime,
        false, // failed
        1, // steps executed
        ['Connection timeout', 'Resource not available'],
        { memory: 150, cpu: 75 }
      );

      const metrics = productionMonitoring.getMetrics();
      expect(metrics.workflowMetrics.totalExecuted).toBe(1);
      expect(metrics.workflowMetrics.successfulExecutions).toBe(0);
      expect(metrics.workflowMetrics.failedExecutions).toBe(1);
    });

    it('should calculate average execution time correctly', () => {
      // Record multiple executions
      productionMonitoring.recordWorkflowExecution('wf-1', 1000, 3000, true, 1);
      productionMonitoring.recordWorkflowExecution('wf-2', 2000, 6000, true, 2);
      productionMonitoring.recordWorkflowExecution('wf-3', 3000, 8000, true, 1);

      const metrics = productionMonitoring.getMetrics();
      const expectedAverage = (2000 + 4000 + 5000) / 3; // (3-1)s + (6-2)s + (8-3)s / 3
      expect(metrics.workflowMetrics.averageExecutionTime).toBe(expectedAverage);
    });
  });

  describe('Error Recording', () => {
    it('should record errors with proper categorization', () => {
      const error = new Error('Test error message');
      
      productionMonitoring.recordError('test-component', error, 'high', {
        context: 'unit-test',
        additionalInfo: 'test-data'
      });

      const metrics = productionMonitoring.getMetrics();
      expect(metrics.errorMetrics.recentErrors).toHaveLength(1);
      expect(metrics.errorMetrics.errorsByComponent.get('test-component')).toBe(1);
      expect(metrics.errorMetrics.errorsByType.get('Error')).toBe(1);
    });

    it('should create alerts for high severity errors', () => {
      productionMonitoring.recordError('critical-component', new Error('Critical failure'), 'critical');

      const alerts = productionMonitoring.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const criticalAlert = alerts.find(alert => alert.severity === 'critical');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.title).toContain('CRITICAL Error in critical-component');
    });
  });

  describe('Health Monitoring', () => {
    it('should record and retrieve health snapshots', () => {
      const healthSnapshot = {
        timestamp: Date.now(),
        overall: 'healthy' as const,
        components: new Map([
          ['component-1', { status: 'healthy' as const, metrics: { uptime: 100 }, details: 'Running normally' }],
          ['component-2', { status: 'degraded' as const, metrics: { uptime: 95 }, details: 'Minor issues detected' }]
        ]),
        recommendations: ['Monitor component-2 closely']
      };

      productionMonitoring.recordHealthSnapshot('test-system', healthSnapshot);

      const healthHistory = productionMonitoring.getHealthHistory('test-system');
      expect(healthHistory).toHaveLength(1);
      expect(healthHistory[0].overall).toBe('healthy');
    });

    it('should track current health status', () => {
      const healthSnapshot = {
        timestamp: Date.now(),
        overall: 'degraded' as const,
        components: new Map([
          ['db', { status: 'unhealthy' as const, metrics: { connections: 0 }, details: 'Connection failed' }]
        ]),
        recommendations: ['Restart database service']
      };

      productionMonitoring.recordHealthSnapshot('test-system', healthSnapshot);

      const currentHealth = productionMonitoring.getCurrentHealth();
      expect(currentHealth.has('test-system')).toBe(true);
      expect(currentHealth.get('test-system')?.overall).toBe('degraded');
    });
  });

  describe('Alert Management', () => {
    it('should create and manage alerts', () => {
      const alertId = productionMonitoring.createAlert({
        type: 'performance',
        severity: 'medium',
        title: 'High CPU Usage',
        message: 'CPU usage is above 80%',
        metadata: { cpuUsage: 85 },
        actions: ['scale_up', 'investigate']
      });

      const alerts = productionMonitoring.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe(alertId);
      expect(alerts[0].acknowledged).toBe(false);
    });

    it('should acknowledge and resolve alerts', () => {
      const alertId = productionMonitoring.createAlert({
        type: 'error',
        severity: 'low',
        title: 'Minor Error',
        message: 'Non-critical error occurred'
      });

      // Acknowledge alert
      const acknowledged = productionMonitoring.acknowledgeAlert(alertId);
      expect(acknowledged).toBe(true);

      let alerts = productionMonitoring.getActiveAlerts();
      expect(alerts[0].acknowledged).toBe(true);

      // Resolve alert
      const resolved = productionMonitoring.resolveAlert(alertId);
      expect(resolved).toBe(true);

      alerts = productionMonitoring.getActiveAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Tracing', () => {
    it('should start and complete traces', () => {
      const traceId = productionMonitoring.startTrace('test-operation');
      expect(traceId).toBeTruthy();

      productionMonitoring.addTraceLog(traceId, 'info', 'Operation started', { param1: 'value1' });
      productionMonitoring.addTraceLog(traceId, 'debug', 'Processing data', { records: 100 });
      productionMonitoring.completeTrace(traceId);

      // Trace should be completed (moved from active to completed)
      const exportData = productionMonitoring.exportMonitoringData();
      const completedTrace = exportData.traces.find((trace: any) => trace.traceId === traceId);
      
      expect(completedTrace).toBeDefined();
      expect(completedTrace.logs).toHaveLength(2);
      expect(completedTrace.endTime).toBeDefined();
    });
  });

  describe('Performance Reports', () => {
    it('should generate comprehensive performance report', () => {
      // Record some test data
      productionMonitoring.recordWorkflowExecution('wf-1', 1000, 3000, true, 2);
      productionMonitoring.recordWorkflowExecution('wf-2', 2000, 5000, false, 1);

      const report = productionMonitoring.getPerformanceReport();
      
      expect(report.summary.totalWorkflows).toBe(2);
      expect(report.summary.successRate).toBe(0.5);
      expect(report.summary.errorRate).toBe(0.5);
      expect(report.trends).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Data Export', () => {
    it('should export monitoring data', () => {
      productionMonitoring.recordWorkflowExecution('export-test', 1000, 2000, true, 1);
      productionMonitoring.recordError('export-component', new Error('Export test error'), 'low');

      const exportData = productionMonitoring.exportMonitoringData();
      
      expect(exportData.timestamp).toBeDefined();
      expect(exportData.metrics).toBeDefined();
      expect(exportData.alerts).toBeDefined();
      expect(exportData.healthHistory).toBeDefined();
      expect(exportData.traces).toBeDefined();
    });
  });
});

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager({
      maxConcurrency: 10,
      timeout: 30000,
      retryAttempts: 3
    });
  });

  afterEach(() => {
    configManager.shutdown();
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const config = configManager.getConfiguration();
      expect(config.maxConcurrency).toBe(10);
      expect(config.timeout).toBe(30000);
      expect(config.retryAttempts).toBe(3);
    });

    it('should update configuration successfully', () => {
      const result = configManager.updateConfiguration(
        { maxConcurrency: 20, newParam: 'test-value' },
        'test-user',
        'Performance optimization'
      );

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const config = configManager.getConfiguration();
      expect(config.maxConcurrency).toBe(20);
      expect(config.newParam).toBe('test-value');
    });

    it('should validate configuration changes', () => {
      const result = configManager.updateConfiguration(
        { maxConcurrency: -5 }, // Invalid value
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid value for maxConcurrency');
    });

    it('should maintain configuration history', () => {
      configManager.updateConfiguration({ timeout: 45000 }, 'user1', 'Increase timeout');
      configManager.updateConfiguration({ retryAttempts: 5 }, 'user2', 'More retries');

      const history = configManager.getConfigurationHistory();
      expect(history).toHaveLength(2);
      expect(history[0].appliedBy).toBe('user1');
      expect(history[1].appliedBy).toBe('user2');
    });

    it('should emit configuration change events', (done) => {
      const subscription = configManager.subscribeToChanges();
      
      subscription.subscribe(change => {
        expect(change.key).toBe('timeout');
        expect(change.oldValue).toBe(30000);
        expect(change.newValue).toBe(60000);
        expect(change.timestamp).toBeDefined();
        done();
      });

      configManager.updateConfiguration({ timeout: 60000 }, 'test-observer');
    });

    it('should support custom validation rules', () => {
      configManager.addValidationRule('customParam', (value) => {
        return typeof value === 'string' && value.length >= 5;
      });

      // Valid value
      let result = configManager.updateConfiguration({ customParam: 'valid_value' }, 'test');
      expect(result.success).toBe(true);

      // Invalid value
      result = configManager.updateConfiguration({ customParam: 'bad' }, 'test');
      expect(result.success).toBe(false);
    });
  });
});