# Open SWE Multi-Agent System

A comprehensive multi-agent collaboration system for the Open SWE platform, enabling sophisticated agent orchestration, capability discovery, health monitoring, and event-driven communication patterns.

## 🚀 Features

### Agent Registry
- **Capability Discovery**: Intelligent agent matching based on skills, tools, and specializations
- **Health Monitoring**: Continuous agent health checks with performance metrics
- **Load Balancing**: Automatic distribution of tasks based on agent availability and performance
- **Lifecycle Management**: Complete agent registration, status tracking, and cleanup
- **Performance Analytics**: Comprehensive metrics for optimization and monitoring

### Communication Hub
- **Message Routing**: Reliable point-to-point message delivery with retry mechanisms
- **Role-based Broadcasting**: Efficient message distribution to agent groups
- **Event Streaming**: Observable event streams for real-time coordination
- **Message Persistence**: Optional message history with configurable retention
- **Queue Management**: Per-agent message queues with overflow protection

### Multi-Agent System
- **Orchestration Rules**: Automated agent coordination based on configurable patterns
- **Task Delegation**: Intelligent task assignment with capability matching
- **System Health**: Comprehensive health monitoring across all components
- **Performance Monitoring**: Real-time metrics and statistics
- **Integration Ready**: Seamless integration with existing Open SWE infrastructure

## 📦 Installation

```bash
# The multi-agent system is included with Open SWE shared packages
npm install @open-swe/shared
```

## 🔧 Quick Start

### Basic Setup

```typescript
import { MultiAgentSystem, MultiAgentPresets, MultiAgentUtils } from '@open-swe/shared/open-swe';

// Create system with production configuration
const system = new MultiAgentSystem(MultiAgentPresets.production);

// Register a code reviewer agent
const codeReviewer = MultiAgentUtils.createDefaultAgentProfile(
  'code-reviewer-1',
  'code_reviewer',
  ['javascript', 'typescript', 'react'],
  ['eslint', 'prettier', 'jest']
);

await system.registerAgent(codeReviewer);
```

### Agent Discovery

```typescript
// Find agents with specific capabilities
const query = MultiAgentUtils.createCapabilityQuery(
  ['javascript'], // Required capabilities
  'code_reviewer', // Role filter
  ['typescript', 'react'] // Optional capabilities
);

const discovery = await system.discoverAgents(query);
console.log(`Found ${discovery.agents.length} suitable agents`);

// Agents are automatically sorted by suitability and load balancing
const bestAgent = discovery.agents[0];
```

### Inter-Agent Communication

```typescript
// Send direct message
const message = MultiAgentUtils.createAgentMessage(
  'sender-agent',
  'receiver-agent',
  'Please review this code change',
  'request',
  'high',
  { pullRequestId: 123, changes: ['src/utils.ts'] }
);

await system.sendMessage('sender-agent', 'receiver-agent', message);

// Broadcast to all code reviewers
await system.broadcastToRole(
  'project-manager',
  'code_reviewer',
  MultiAgentUtils.createAgentMessage(
    'project-manager',
    '', // Will be filled for each recipient
    'New coding standards released',
    'notification',
    'medium'
  )
);
```

### Task Delegation

```typescript
// Delegate task with automatic agent selection
const delegation = MultiAgentUtils.createTaskDelegation(
  'security-review-task-456',
  'security-lead',
  '', // Auto-assign to best available agent
  'Perform security review of authentication module'
);

await system.delegateTask(delegation);
```

### System Monitoring

```typescript
// Get comprehensive system statistics
const stats = system.getSystemStatistics();
console.log(`Total agents: ${stats.registry.totalAgents}`);
console.log(`Messages processed: ${stats.communication.totalMessagesProcessed}`);
console.log(`System uptime: ${stats.performance.systemUptime}ms`);

// Monitor system health
const healthReport = await system.performSystemHealthCheck();
console.log(`Overall health: ${healthReport.overall}`);

if (healthReport.recommendations.length > 0) {
  console.log('Recommendations:', healthReport.recommendations);
}
```

### Event Subscriptions

```typescript
// Subscribe to system events
const subscription = system.subscribeToSystemEvents({
  eventType: 'agent_registered'
});

subscription.subscribe(event => {
  console.log(`New agent registered: ${event.agentId}`);
});

// Clean up
subscription.unsubscribe();
```

## 🏗️ Architecture

### Core Components

1. **AgentRegistry**: Manages agent lifecycle, capabilities, and health
2. **AgentCommunicationHub**: Handles message routing and event distribution
3. **MultiAgentSystem**: Orchestrates the complete system with coordination rules

### Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Agent A       │    │  Communication   │    │   Agent B       │
│                 │───▶│      Hub         │───▶│                 │
│ - Capabilities  │    │                  │    │ - Capabilities  │
│ - Status        │    │ - Message Queue  │    │ - Status        │
│ - Metrics       │    │ - Event Stream   │    │ - Metrics       │
└─────────────────┘    │ - Broadcasting   │    └─────────────────┘
         │              └──────────────────┘             │
         │                        │                      │
         └────────────────────────▼──────────────────────┘
                    ┌─────────────────────────┐
                    │    Agent Registry       │
                    │                         │
                    │ - Capability Discovery  │
                    │ - Health Monitoring     │
                    │ - Load Balancing        │
                    │ - Performance Metrics   │
                    └─────────────────────────┘
```

## ⚙️ Configuration

### Configuration Presets

The system provides three pre-configured setups:

```typescript
import { MultiAgentPresets } from '@open-swe/shared/open-swe';

// Development - Relaxed limits, verbose logging
const devSystem = new MultiAgentSystem(MultiAgentPresets.development);

// Production - Optimized performance, strict limits
const prodSystem = new MultiAgentSystem(MultiAgentPresets.production);

// Testing - Fast execution, minimal overhead
const testSystem = new MultiAgentSystem(MultiAgentPresets.testing);
```

### Custom Configuration

```typescript
const customConfig = {
  registry: {
    maxAgents: 100,
    healthCheck: {
      interval: 20000, // 20 seconds
      timeout: 3000,   // 3 seconds
      failureThreshold: 2
    },
    performance: {
      maxResponseTime: 5000,
      minSuccessRate: 0.95,
      maxLoad: 0.8,
      healthCheckInterval: 20000
    },
    autoCleanup: true,
    offlineTimeout: 300000
  },
  communication: {
    maxQueueSize: 200,
    messageTimeout: 10000,
    maxRetryAttempts: 3,
    enablePersistence: true,
    messageRetentionTime: 1800000
  },
  enableOrchestration: true,
  maxConcurrentOperations: 75,
  enableDetailedLogging: false
};

const system = new MultiAgentSystem(customConfig);
```

## 🎯 Advanced Usage

### Custom Orchestration Rules

```typescript
const customRule = {
  id: 'security-alert-rule',
  name: 'Security Alert Orchestration',
  triggers: {
    eventTypes: ['health_check_failed'],
    condition: (event) => {
      // Only trigger for security agents
      return event.payload.role === 'security';
    }
  },
  actions: {
    notifyAgents: ['security-lead', 'system-admin'],
    broadcastToRoles: ['architect'],
    handler: async (event, system) => {
      // Custom escalation logic
      console.log(`Security agent ${event.agentId} needs attention!`);
    }
  },
  priority: 'critical',
  active: true
};

system.addOrchestrationRule(customRule);
```

### Performance Optimization

```typescript
// Monitor performance metrics
const stats = system.getSystemStatistics();

if (stats.performance.operationsPerSecond < 10) {
  console.log('System performance is degraded');
}

// Optimize agent discovery with specific criteria
const optimizedQuery = {
  required: ['javascript'],
  role: 'code_reviewer',
  minAvailabilityScore: 0.8, // Only highly available agents
  maxResponseTime: 2000 // Fast response required
};

const fastAgents = await system.discoverAgents(optimizedQuery, true);
```

### Integration with Open SWE GraphState

```typescript
import { GraphState } from '@open-swe/shared/open-swe/types';

// The system integrates seamlessly with existing Open SWE state management
function updateGraphStateWithAgents(state: GraphState, system: MultiAgentSystem) {
  const agents = new Map();
  const systemStatus = system.getSystemStatus();
  
  for (const [agentId, status] of systemStatus.entries()) {
    const agentDetails = system.registry.getAgentDetails(agentId);
    if (agentDetails) {
      agents.set(agentId, agentDetails);
    }
  }
  
  return {
    ...state,
    activeAgents: agents,
    collaborationContext: {
      ...state.collaborationContext,
      currentTaskId: 'multi-agent-coordination'
    }
  };
}
```

## 🧪 Testing

The system includes comprehensive test coverage:

```bash
# Run all multi-agent system tests
npm test -- --testNamePattern="MultiAgentSystem|AgentRegistry|AgentCommunicationHub"

# Run specific component tests
npm test agent-registry.test.ts
npm test agent-communication-hub.test.ts
npm test multi-agent-system.test.ts
```

### Test Utilities

```typescript
import { MultiAgentSystem, MultiAgentPresets } from '@open-swe/shared/open-swe';

describe('My Agent Tests', () => {
  let system: MultiAgentSystem;

  beforeEach(() => {
    // Use testing preset for predictable behavior
    system = new MultiAgentSystem(MultiAgentPresets.testing);
  });

  afterEach(async () => {
    await system.shutdown();
  });

  it('should handle agent interactions', async () => {
    // Your test code here
  });
});
```

## 📊 Monitoring and Observability

### Health Checks

```typescript
// Regular health monitoring
setInterval(async () => {
  const health = await system.performSystemHealthCheck();
  
  if (health.overall !== 'healthy') {
    console.warn('System health degraded:', health.recommendations);
  }
}, 60000); // Check every minute
```

### Performance Metrics

```typescript
// Monitor key performance indicators
const stats = system.getSystemStatistics();

const kpis = {
  agentUtilization: stats.registry.agentsByStatus.busy / stats.registry.totalAgents,
  messageSuccessRate: 1 - (stats.communication.failedDeliveries / stats.communication.totalMessagesProcessed),
  averageResponseTime: stats.registry.avgResponseTime,
  systemLoad: stats.performance.operationsPerSecond
};

console.log('System KPIs:', kpis);
```

## 🤝 Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Start development: `npm run dev`

### Code Style

- Follow existing TypeScript patterns
- Include comprehensive JSDoc documentation
- Write tests for all new functionality
- Follow the existing error handling patterns

### Adding New Agent Types

```typescript
// 1. Add role to AgentRole union type
export type AgentRole = 
  | 'code_reviewer'
  | 'security'
  | 'my_new_role'; // Add here

// 2. Create agent profile
const newAgent = MultiAgentUtils.createDefaultAgentProfile(
  'my-agent-1',
  'my_new_role',
  ['specialized-capability'],
  ['specialized-tool']
);

// 3. Register and use
await system.registerAgent(newAgent);
```

## 📚 API Reference

### MultiAgentSystem

Main orchestrator class providing unified interface to all multi-agent functionality.

#### Methods

- `registerAgent(profile, capabilities?, metadata?)`: Register new agent
- `discoverAgents(query, loadBalance?)`: Find agents by capabilities
- `sendMessage(from, to, message)`: Send direct message
- `broadcastToRole(sender, role, message, excludeSender?)`: Broadcast to role
- `delegateTask(delegation)`: Delegate task with auto-assignment
- `subscribeToSystemEvents(filter?)`: Subscribe to system events
- `getSystemStatistics()`: Get comprehensive statistics
- `performSystemHealthCheck()`: Check system health
- `shutdown()`: Gracefully shutdown system

### AgentRegistry

Manages agent lifecycle, capabilities, and health monitoring.

#### Methods

- `registerAgent(profile, capabilities?, metadata?)`: Register agent
- `discoverAgents(query)`: Discover agents by capability
- `getAgentStatus(agentId)`: Get current agent status
- `getAgentDetails(agentId)`: Get detailed agent information
- `deregisterAgent(agentId)`: Remove agent from registry
- `updateAgentStatus(agentId, status)`: Update agent status
- `performHealthCheck(agentId?)`: Perform health checks
- `subscribeToEvents(agentId?, eventType?)`: Subscribe to events

### AgentCommunicationHub

Handles message routing, broadcasting, and event distribution.

#### Methods

- `sendMessage(from, to, message)`: Send message with delivery guarantees
- `broadcastToRole(sender, role, message, excludeSender?)`: Role-based broadcasting
- `subscribeToEvents(agentId, eventType?, roleFilter?)`: Event subscriptions
- `unsubscribeFromEvents(agentId, subscriptionId?)`: Remove subscriptions
- `getQueueStatus(agentId)`: Get message queue status
- `getMessageHistory(agentId, otherAgentId?, limit?)`: Retrieve message history

## 🔗 Integration Examples

### With Open SWE Graphs

```typescript
// In a LangGraph node
async function multiAgentNode(state: GraphState): Promise<Partial<GraphState>> {
  const system = new MultiAgentSystem(MultiAgentPresets.production);
  
  // Use multi-agent system for collaborative task execution
  const agents = await system.discoverAgents({
    required: ['code_review'],
    role: 'code_reviewer'
  });
  
  if (agents.agents.length > 0) {
    const message = MultiAgentUtils.createAgentMessage(
      'planner',
      agents.agents[0].id,
      'Review the generated code',
      'request',
      'high',
      { code: state.generatedCode }
    );
    
    await system.sendMessage('planner', agents.agents[0].id, message);
  }
  
  return {
    ...state,
    activeAgents: new Map(agents.agents.map(a => [a.id, a]))
  };
}
```

### With GitHub Integration

```typescript
// GitHub webhook handler with multi-agent coordination
async function handlePullRequest(prData: any) {
  const system = new MultiAgentSystem(MultiAgentPresets.production);
  
  // Register specialized review agents
  const securityReviewer = MultiAgentUtils.createDefaultAgentProfile(
    'security-reviewer',
    'security',
    ['owasp', 'security-scanning'],
    ['sonarqube', 'snyk']
  );
  
  await system.registerAgent(securityReviewer);
  
  // Coordinate review process
  const reviewMessage = MultiAgentUtils.createAgentMessage(
    'github-bot',
    'security-reviewer',
    'Security review required',
    'request',
    'high',
    { prNumber: prData.number, files: prData.changed_files }
  );
  
  await system.sendMessage('github-bot', 'security-reviewer', reviewMessage);
}
```

## 🛡️ Security Considerations

- All agent communications are logged and can be audited
- Health checks prevent agents from becoming unresponsive
- Message queues have size limits to prevent memory exhaustion
- Agent capabilities are validated during registration
- Performance metrics help detect anomalous behavior

## 📄 License

This multi-agent system is part of the Open SWE project and follows the same licensing terms.

## 🙋‍♂️ Support

For questions, issues, or contributions:

1. Check the existing documentation
2. Review the test cases for usage examples
3. Open an issue on the main Open SWE repository
4. Join the community discussions

---

**Built with ❤️ for the Open SWE community**