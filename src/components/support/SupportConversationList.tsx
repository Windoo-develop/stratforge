import type { SupportConversation } from '../../types/domain'
import { useLocale } from '../../hooks/useLocale'
import { UserAvatar } from '../ui/UserAvatar'

export function SupportConversationList({
  conversations,
  activeConversationId,
  title,
  emptyMessage,
  onSelect,
  renderMeta,
}: {
  conversations: SupportConversation[]
  activeConversationId: string | null
  title: string
  emptyMessage: string
  onSelect: (conversation: SupportConversation) => void
  renderMeta?: (conversation: SupportConversation) => string
}) {
  const { t, formatDateTime } = useLocale()

  return (
    <aside className="support-sidebar">
      <div className="support-sidebar-header">
        <h3>{title}</h3>
        <span>{conversations.length}</span>
      </div>

      {conversations.length ? (
        <div className="support-conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`support-conversation-card ${activeConversationId === conversation.id ? 'active' : ''}`}
              onClick={() => onSelect(conversation)}
            >
              <div className="support-conversation-title">
                <strong>{conversation.subject}</strong>
                <span className={`support-status-pill status-${conversation.status}`}>{conversation.status}</span>
              </div>

              {conversation.user ? (
                <div className="support-conversation-user">
                  <UserAvatar username={conversation.user.username} avatarUrl={conversation.user.avatar_url} size="sm" />
                  <div>
                    <strong>{conversation.user.username}</strong>
                    <span>#{conversation.user.user_code}</span>
                  </div>
                </div>
              ) : null}

              <span className="support-conversation-meta">
                {renderMeta
                  ? renderMeta(conversation)
                  : formatDateTime(conversation.updated_at)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <strong>{t('support.noConversationsYet')}</strong>
          <span>{emptyMessage}</span>
        </div>
      )}
    </aside>
  )
}
