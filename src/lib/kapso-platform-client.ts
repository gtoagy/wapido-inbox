// src/lib/kapso-platform-client.ts

const PLATFORM_BASE_URL = 'https://api.kapso.ai/platform/v1';

// Workflow de Kapso al que pertenecen las conversaciones de este inbox.
// Default: "wapido-flow v1.0 (Prod)". Configurable por env por si cambia.
const WORKFLOW_ID =
  process.env.KAPSO_WORKFLOW_ID || 'd82f0998-90cb-46d0-9dff-0eb7d1dfb72a';

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

// Get workflow executions for a conversation.
// La Platform API no expone una lista global filtrable por conversación; hay que
// listar las executions del workflow y filtrar por whatsapp_conversation_id.
export async function getWorkflowExecutions(conversationId: string) {
  return platformFetch(
    `/workflows/${WORKFLOW_ID}/executions?whatsapp_conversation_id=${conversationId}&per_page=5`,
  );
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
