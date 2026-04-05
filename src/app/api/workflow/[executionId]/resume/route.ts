import { NextResponse } from 'next/server';
import { resumeExecution } from '@/lib/kapso-platform-client';

export async function POST(request: Request, { params }: { params: Promise<{ executionId: string }> }) {
  try {
    const { executionId } = await params;
    const result = await resumeExecution(executionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error resuming execution:', error);
    return NextResponse.json({ error: 'Failed to resume' }, { status: 500 });
  }
}
