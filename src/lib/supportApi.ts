import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Profile, SupportConversation, SupportConversationStatus, SupportMessage } from '../types/domain'

const PROFILE_SELECT = `
  id,
  username,
  user_code,
  avatar_url,
  bio,
  team_id,
  advanced_access_enabled,
  standoff_player_id,
  created_at
`

function throwIfError(error: PostgrestError | null) {
  if (error) throw error
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function normalizeConversation(raw: Record<string, unknown>): SupportConversation {
  return {
    ...(raw as unknown as SupportConversation),
    user: unwrapRelation(raw.user as Profile | Profile[] | null | undefined),
  }
}

function normalizeMessage(raw: Record<string, unknown>): SupportMessage {
  return {
    ...(raw as unknown as SupportMessage),
    author: unwrapRelation(raw.author as Profile | Profile[] | null | undefined),
  }
}

export async function fetchSupportConversationsForUser(userId: string) {
  const { data, error } = await supabase
    .from('support_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  throwIfError(error)
  return (data ?? []) as SupportConversation[]
}

export async function fetchSupportInbox(options?: { includeClosed?: boolean }) {
  const includeClosed = options?.includeClosed ?? false

  let query = supabase
    .from('support_conversations')
    .select(`
      *,
      user:profiles (
        ${PROFILE_SELECT}
      )
    `)
    .order('updated_at', { ascending: false })

  if (!includeClosed) {
    query = query.neq('status', 'closed')
  }

  const { data, error } = await query

  throwIfError(error)
  return (data ?? []).map((item) => normalizeConversation(item as Record<string, unknown>))
}

export async function fetchSupportMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('support_messages')
    .select(`
      *,
      author:profiles (
        ${PROFILE_SELECT}
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  throwIfError(error)
  return (data ?? []).map((item) => normalizeMessage(item as Record<string, unknown>))
}

export async function createSupportConversation(params: {
  userId: string
  subject: string
  body: string
}) {
  const { data, error } = await supabase
    .from('support_conversations')
    .insert({
      user_id: params.userId,
      subject: params.subject.trim(),
      status: 'open',
    })
    .select('id')
    .single()

  throwIfError(error)

  if (!data?.id) {
    throw new Error('Support conversation creation failed')
  }

  const { error: messageError } = await supabase.from('support_messages').insert({
    conversation_id: data.id,
    author_id: params.userId,
    body: params.body.trim(),
    is_admin: false,
  })

  throwIfError(messageError)
  return data.id as string
}

export async function sendSupportMessage(params: {
  conversationId: string
  authorId: string
  body: string
  isAdmin?: boolean
}) {
  const { error } = await supabase.from('support_messages').insert({
    conversation_id: params.conversationId,
    author_id: params.authorId,
    body: params.body.trim(),
    is_admin: params.isAdmin ?? false,
  })

  throwIfError(error)
}

export async function updateSupportConversationStatus(conversationId: string, status: SupportConversationStatus) {
  const { error } = await supabase
    .from('support_conversations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  throwIfError(error)
}
