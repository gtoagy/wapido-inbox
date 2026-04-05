import { NextResponse } from 'next/server';
import { getWorkflowExecutions } from '@/lib/kapso-platform-client';

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params;
    const result = await getWorkflowExecutions(conversationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 });
  }
}
