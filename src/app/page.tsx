'use client';

import { useState, useRef } from 'react';
import { ConversationList, type ConversationListRef } from '@/components/conversation-list';
import { MessageView } from '@/components/message-view';
import { InfoPanel } from '@/components/info-panel';

type Conversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
  status?: string;
};

export default function Home() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation>();
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const conversationListRef = useRef<ConversationListRef>(null);

  const handleTemplateSent = async (phoneNumber: string) => {
    // Refresh the conversation list and get the updated conversations
    const conversations = await conversationListRef.current?.refresh();

    // Find and select the conversation for the phone number
    if (conversations) {
      const conversation = conversations.find(conv => conv.phoneNumber === phoneNumber);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(undefined);
  };

  return (
    <div className="h-screen flex">
      <ConversationList
        ref={conversationListRef}
        onSelectConversation={setSelectedConversation}
        selectedConversationId={selectedConversation?.id}
        isHidden={!!selectedConversation}
      />
      <MessageView
        conversationId={selectedConversation?.id}
        phoneNumber={selectedConversation?.phoneNumber}
        contactName={selectedConversation?.contactName}
        onTemplateSent={handleTemplateSent}
        onBack={handleBackToList}
        isVisible={!!selectedConversation}
        onToggleInfo={() => setShowInfoPanel(prev => !prev)}
      />
      {showInfoPanel && selectedConversation && (
        <InfoPanel
          conversationId={selectedConversation.id}
          contactName={selectedConversation.contactName}
          phoneNumber={selectedConversation.phoneNumber}
          onClose={() => setShowInfoPanel(false)}
        />
      )}
    </div>
  );
}
