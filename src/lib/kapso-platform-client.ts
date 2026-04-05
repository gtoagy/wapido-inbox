// src/lib/kapso-platform-client.ts

const PLATFORM_BASE_URL = 'https://api.kapso.ai/platform/v1';

async function platformFetch(path: string, options: RequestInit = {}) {
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) throw new Error('KAPSO_API_KEY not set');

  const res = await fetch(`${PLATFORM_BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Platform API error ${res.status}: ${error}`);
  }

  return res.json();
}

// Get workflow executions for a conversation
export async function getWorkflowExecutions(conversationId: string) {
  return platformFetch(`/workflow_executions?conversation_id=${conversationId}&per_page=5`);
}

// Update workflow execution status (handoff, waiting, ended)
export async function updateExecutionStatus(executionId: string, status: 'handoff' | 'waiting' | 'ended') {
  return platformFetch(`/workflow_executions/${executionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Resume a waiting workflow execution
export async function resumeExecution(executionId: string, data?: { kind?: string; data?: string | object }) {
  return platformFetch(`/workflow_executions/${executionId}/resume`, {
    method: 'POST',
    body: JSON.stringify(data || { kind: 'payload', data: '' }),
  });
}

// Update conversation status (active, ended)
export async function updateConversationStatus(conversationId: string, status: 'active' | 'ended') {
  return platformFetch(`/conversations/${conversationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
