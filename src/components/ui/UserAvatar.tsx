type UserAvatarProps = {
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

function getInitials(username: string) {
  const chunks = username
    .split(/[\s_]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  if (!chunks.length) return 'SB'
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase()
  return `${chunks[0][0] ?? ''}${chunks[1][0] ?? ''}`.toUpperCase()
}

export function UserAvatar({ username, avatarUrl, size = 'md' }: UserAvatarProps) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={username}
      className={`user-avatar ${size}`}
    />
  ) : (
    <div className={`user-avatar fallback ${size}`} aria-label={username}>
      {getInitials(username)}
    </div>
  )
}
