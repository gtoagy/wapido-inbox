import { NextResponse } from 'next/server';
import { updateExecutionStatus } from '@/lib/kapso-platform-client';

export async function POST(request: Request, { params }: { params: Promise<{ executionId: string }> }) {
  try {
    const { executionId } = await params;
    const result = await updateExecutionStatus(executionId, 'handoff');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error triggering handoff:', error);
    return NextResponse.json({ error: 'Failed to trigger handoff' }, { status: 500 });
  }
}
