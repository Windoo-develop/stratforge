import { supabase } from './supabaseClient'

export function isBucketNotFoundError(error: unknown) {
  return error instanceof Error && /bucket not found/i.test(error.message)
}

export async function uploadFileToBucket(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFileToBucketList(buckets: string[], path: string, file: File) {
  let lastError: unknown = null

  for (const bucket of buckets) {
    try {
      return await uploadFileToBucket(bucket, path, file)
    } catch (error) {
      lastError = error
      if (!isBucketNotFoundError(error)) {
        throw error
      }
    }
  }

  if (lastError) throw lastError
  throw new Error('No upload bucket configured')
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(',')
  const mime = metadata.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const binary = atob(encoded ?? '')
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mime })
}

export async function uploadDataUrlToBucket(bucket: string, path: string, dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl)
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadDataUrlToBucketList(buckets: string[], path: string, dataUrl: string) {
  let lastError: unknown = null

  for (const bucket of buckets) {
    try {
      return await uploadDataUrlToBucket(bucket, path, dataUrl)
    } catch (error) {
      lastError = error
      if (!isBucketNotFoundError(error)) {
        throw error
      }
    }
  }

  if (lastError) throw lastError
  throw new Error('No upload bucket configured')
}

export function buildStoragePath(prefix: string, fileName: string) {
  const extension = fileName.split('.').pop() ?? 'png'
  return `${prefix}/${crypto.randomUUID()}.${extension}`
}
