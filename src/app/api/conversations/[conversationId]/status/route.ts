import { NextResponse } from 'next/server';
import { updateConversationStatus } from '@/lib/kapso-platform-client';

export async function PATCH(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params;
    const body = await request.json();
    const { status } = body; // 'active' or 'ended'
    const result = await updateConversationStatus(conversationId, status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating conversation status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
