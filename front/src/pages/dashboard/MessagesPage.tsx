import { ChatInterface } from '@/components/ai/ChatInterface'
import { PageHeader } from '@/components/shared/PageHeader'

/** Messagerie interne, cloisonnée par agence. */
export function MessagesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Échanges"
        title="Messagerie"
        description="Conversations avec vos clients, propriétaires et collègues. Chaque échange reste rattaché à son agence."
      />
      <ChatInterface />
    </div>
  )
}
