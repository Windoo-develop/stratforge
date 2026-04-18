import type { ReactNode } from 'react'
import type { SupportConversation, SupportMessage } from '../../types/domain'
import { useLocale } from '../../hooks/useLocale'
import { UserAvatar } from '../ui/UserAvatar'

export function SupportMessageThread({
  conversation,
  messages,
  currentUserId,
  loading,
  composerValue,
  composerPlaceholder,
  composerDisabled,
  headerActions,
  onComposerChange,
  onSend,
}: {
  conversation: SupportConversation | null
  messages: SupportMessage[]
  currentUserId: string
  loading: boolean
  composerValue: string
  composerPlaceholder: string
  composerDisabled?: boolean
  headerActions?: ReactNode
  onComposerChange: (value: string) => void
  onSend: () => Promise<void> | void
}) {
  const { t, formatDateTime } = useLocale()

  if (!conversation) {
    return (
      <section className="support-thread-panel">
        <div className="empty-panel">
          <strong>{t('support.noConversationSelected')}</strong>
          <span>{t('support.noConversationHint')}</span>
        </div>
      </section>
    )
  }

  return (
    <section className="support-thread-panel">
      <div className="support-thread-header">
        <div>
          <p className="eyebrow">{t('support.thread')}</p>
          <h2>{conversation.subject}</h2>
        </div>
        <div className="inline-actions">
          <span className={`support-status-pill status-${conversation.status}`}>{conversation.status}</span>
          {headerActions}
        </div>
      </div>

      <div className="support-message-list">
        {messages.length ? (
          messages.map((message) => {
            const mine = message.author_id === currentUserId

            return (
              <article key={message.id} className={`support-message-card ${mine ? 'mine' : ''} ${message.is_admin ? 'admin' : ''}`}>
                <div className="support-message-author">
                  <UserAvatar
                    username={message.author?.username ?? (message.is_admin ? t('support.adminLabel') : t('support.playerLabel'))}
                    avatarUrl={message.author?.avatar_url ?? null}
                    size="sm"
                  />
                  <div>
                    <strong>{message.author?.username ?? (message.is_admin ? t('support.adminLabel') : t('support.playerLabel'))}</strong>
                    <span>{formatDateTime(message.created_at)}</span>
                  </div>
                </div>
                <p>{message.body}</p>
              </article>
            )
          })
        ) : (
          <div className="empty-panel">
            <strong>{t('support.noMessages')}</strong>
            <span>{t('support.noMessagesHint')}</span>
          </div>
        )}
      </div>

      <form
        className="comment-compose support-compose"
        onSubmit={(event) => {
          event.preventDefault()
          void onSend()
        }}
      >
        <textarea
          rows={4}
          value={composerValue}
          placeholder={composerPlaceholder}
          disabled={composerDisabled || loading}
          onChange={(event) => onComposerChange(event.target.value)}
        />
        <div className="comment-compose-footer">
          <span className="form-hint">
            {conversation.status === 'closed'
              ? t('support.closedHint')
              : t('support.openHint')}
          </span>
          <button type="submit" className="primary-action" disabled={composerDisabled || loading || !composerValue.trim()}>
            {loading ? t('support.sending') : t('support.sendMessage')}
          </button>
        </div>
      </form>
    </section>
  )
}
