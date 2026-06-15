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
  lastActiveAt?: string;
};

// Vista de lista clásica del inbox (columna de conversaciones + chat + panel de
// info). Antes vivía en app/page.tsx; se extrajo para que el contenedor
// (inbox-app) pueda alternar entre esta vista y la del CRM sin cambiar de ruta.
export function InboxView() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation>();
  // Todas las conversaciones del contacto seleccionado (para el historial unificado).
  const [selectedContactConvs, setSelectedContactConvs] = useState<Conversation[]>();
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const conversationListRef = useRef<ConversationListRef>(null);

  const handleSelect = (conversation: Conversation, contactConversations: Conversation[]) => {
    setSelectedConversation(conversation);
    setSelectedContactConvs(contactConversations);
  };

  // Reconstruye el contacto seleccionado tras un refresh (la conv más reciente
  // del teléfono pasa a ser la principal).
  const reselectContact = (conversations: Conversation[], phoneNumber: string) => {
    const contactConvs = conversations
      .filter(conv => conv.phoneNumber === phoneNumber)
      .sort((a, b) => new Date(b.lastActiveAt || 0).getTime() - new Date(a.lastActiveAt || 0).getTime());
    if (contactConvs.length) {
      setSelectedConversation(contactConvs[0]);
      setSelectedContactConvs(contactConvs);
    }
  };

  const handleTemplateSent = async (phoneNumber: string) => {
    const conversations = await conversationListRef.current?.refresh();
    if (conversations) {
      reselectContact(conversations, phoneNumber);
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(undefined);
    setSelectedContactConvs(undefined);
  };

  const handleStatusChange = async () => {
    const conversations = await conversationListRef.current?.refresh();
    if (conversations && selectedConversation) {
      reselectContact(conversations, selectedConversation.phoneNumber);
    }
  };

  return (
    <div className="h-screen flex">
      <ConversationList
        ref={conversationListRef}
        onSelectConversation={handleSelect}
        selectedConversationId={selectedConversation?.id}
        isHidden={!!selectedConversation}
      />
      <MessageView
        key={selectedConversation?.id}
        conversationId={selectedConversation?.id}
        contactConversations={selectedContactConvs}
        phoneNumber={selectedConversation?.phoneNumber}
        contactName={selectedConversation?.contactName}
        onTemplateSent={handleTemplateSent}
        onBack={handleBackToList}
        // En móvil solo se muestra un panel a la vez: si el panel de info está
        // abierto, el chat se oculta (en desktop conviven via hidden md:flex).
        isVisible={!!selectedConversation && !showInfoPanel}
        conversationStatus={selectedConversation?.status}
        onStatusChange={handleStatusChange}
        onToggleInfo={() => setShowInfoPanel(prev => !prev)}
      />
      {showInfoPanel && selectedConversation && (
        <InfoPanel
          conversationId={selectedConversation.id}
          contactName={selectedConversation.contactName}
          phoneNumber={selectedConversation.phoneNumber}
          status={selectedConversation.status}
          lastActiveAt={selectedConversation.lastActiveAt}
          onClose={() => setShowInfoPanel(false)}
        />
      )}
    </div>
  );
}
