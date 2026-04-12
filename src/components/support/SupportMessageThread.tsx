import type { ReactNode } from 'react'
import type { SupportConversation, SupportMessage } from '../../types/domain'
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
  if (!conversation) {
    return (
      <section className="support-thread-panel">
        <div className="empty-panel">
          <strong>No conversation selected</strong>
          <span>Pick an existing thread or start a new one to continue.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="support-thread-panel">
      <div className="support-thread-header">
        <div>
          <p className="eyebrow">Support thread</p>
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
                    username={message.author?.username ?? (message.is_admin ? 'Admin' : 'Player')}
                    avatarUrl={message.author?.avatar_url ?? null}
                    size="sm"
                  />
                  <div>
                    <strong>{message.author?.username ?? (message.is_admin ? 'Support admin' : 'Player')}</strong>
                    <span>{new Date(message.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <p>{message.body}</p>
              </article>
            )
          })
        ) : (
          <div className="empty-panel">
            <strong>No messages yet</strong>
            <span>The thread is ready. Send the first reply below.</span>
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
              ? 'This thread is closed. Reopen it from the admin panel to continue.'
              : 'Keep replies short and actionable so the thread stays easy to scan.'}
          </span>
          <button type="submit" className="primary-action" disabled={composerDisabled || loading || !composerValue.trim()}>
            {loading ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </form>
    </section>
  )
}
