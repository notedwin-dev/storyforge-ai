const WebSocket = require('ws');

let wss = null;
const clients = new Map();

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    clients.set(clientId, ws);
    
    console.log(`WebSocket client connected: ${clientId}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleClientMessage(clientId, data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      clients.delete(clientId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      client_id: clientId,
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
  });

  console.log('WebSocket server initialized');
}

function handleClientMessage(clientId, data) {
  console.log(`Message from client ${clientId}:`, data);

  switch (data.type) {
    case 'subscribe':
      subscribeToJob(clientId, data.job_id);
      break;
    case 'unsubscribe':
      unsubscribeFromJob(clientId, data.job_id);
      break;
    case 'ping':
      sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
      break;
    default:
      console.warn(`Unknown message type: ${data.type}`);
  }
}

const jobSubscriptions = new Map(); // job_id -> Set<client_id>

function subscribeToJob(clientId, jobId) {
  if (!jobSubscriptions.has(jobId)) {
    jobSubscriptions.set(jobId, new Set());
  }
  jobSubscriptions.get(jobId).add(clientId);
  
  console.log(`Client ${clientId} subscribed to job ${jobId}`);
  
  sendToClient(clientId, {
    type: 'subscription',
    job_id: jobId,
    status: 'subscribed',
    timestamp: new Date().toISOString()
  });
}

function unsubscribeFromJob(clientId, jobId) {
  if (jobSubscriptions.has(jobId)) {
    jobSubscriptions.get(jobId).delete(clientId);
    
    if (jobSubscriptions.get(jobId).size === 0) {
      jobSubscriptions.delete(jobId);
    }
  }
  
  console.log(`Client ${clientId} unsubscribed from job ${jobId}`);
}

function broadcastProgress(jobId, progressData) {
  if (!jobSubscriptions.has(jobId)) {
    return;
  }

  const message = {
    type: 'progress',
    job_id: jobId,
    data: progressData,
    timestamp: new Date().toISOString()
  };

  const subscribers = jobSubscriptions.get(jobId);
  let activeSubscribers = 0;

  for (const clientId of subscribers) {
    if (sendToClient(clientId, message)) {
      activeSubscribers++;
    }
  }

  console.log(`Broadcasted progress for job ${jobId} to ${activeSubscribers} clients`);
}

function sendToClient(clientId, message) {
  const client = clients.get(clientId);
  if (client && client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  }
  return false;
}

function broadcast(message) {
  let activeclients = 0;
  
  for (const [clientId, client] of clients) {
    if (sendToClient(clientId, message)) {
      activeclients++;
    }
  }
  
  console.log(`Broadcasted message to ${activeclients} clients`);
}

function broadcastToSubscribers(jobId, message) {
  if (!jobSubscriptions.has(jobId)) {
    return;
  }

  const subscribers = jobSubscriptions.get(jobId);
  let activeSubscribers = 0;

  for (const clientId of subscribers) {
    if (sendToClient(clientId, message)) {
      activeSubscribers++;
    }
  }

  console.log(`Sent message to ${activeSubscribers} subscribers of job ${jobId}`);
}

function getConnectionStats() {
  return {
    total_connections: clients.size,
    active_jobs: jobSubscriptions.size,
    total_subscriptions: Array.from(jobSubscriptions.values())
      .reduce((sum, subscribers) => sum + subscribers.size, 0)
  };
}

function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Cleanup disconnected clients periodically
setInterval(() => {
  for (const [clientId, client] of clients) {
    if (client.readyState !== WebSocket.OPEN) {
      clients.delete(clientId);
      
      // Remove from job subscriptions
      for (const [jobId, subscribers] of jobSubscriptions) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          jobSubscriptions.delete(jobId);
        }
      }
    }
  }
}, 30000); // Check every 30 seconds

module.exports = {
  setupWebSocket,
  broadcastProgress,
  broadcast,
  broadcastToSubscribers,
  sendToClient,
  getConnectionStats
};
