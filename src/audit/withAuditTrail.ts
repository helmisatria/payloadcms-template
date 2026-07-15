import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'

import type { AuditLog } from '@/payload-types'

const REDACTED_VALUE = '[redacted]'
const SENSITIVE_KEY_PARTS = [
  'apikey',
  'authorization',
  'cookie',
  'password',
  'refreshtoken',
  'secret',
  'session',
  'token',
]

const isSensitiveKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))
}

const normalizeSnapshotValue = (value: unknown, depth = 0): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshotValue(item, depth + 1))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const objectValue = value as Record<string, unknown>
  const isPopulatedRelationship =
    depth > 0 &&
    objectValue.id != null &&
    (objectValue.collection != null ||
      (objectValue.createdAt != null && objectValue.updatedAt != null))

  if (isPopulatedRelationship) {
    return objectValue.id
  }

  return Object.fromEntries(
    Object.entries(objectValue).map(([key, nestedValue]) => {
      if (isSensitiveKey(key)) {
        return [key, REDACTED_VALUE]
      }

      return [key, normalizeSnapshotValue(nestedValue, depth + 1)]
    }),
  )
}

type AuditSnapshot = Exclude<AuditLog['previousValue'], undefined>

const createSnapshot = (value: unknown): AuditSnapshot => {
  return JSON.parse(JSON.stringify(normalizeSnapshotValue(value))) as AuditSnapshot
}

type AuditEntry = {
  currentValue: AuditSnapshot
  documentId: string
  hook: 'afterChange' | 'afterDelete'
  onCollection: string
  operation: 'create' | 'delete' | 'update'
  previousValue: AuditSnapshot
}

const writeAuditEntry = async (req: PayloadRequest, entry: AuditEntry): Promise<void> => {
  try {
    await req.payload.create({
      collection: 'audit-logs',
      data: {
        ...entry,
        createdAt: new Date().toISOString(),
        type: 'audit',
        user: req.user?.id ?? null,
        userAgent: req.headers.get('user-agent') || null,
      },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Failed to write audit log for ${entry.onCollection}/${entry.documentId}`,
    })
  }
}

const logChange: CollectionAfterChangeHook = async ({
  collection,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  await writeAuditEntry(req, {
    currentValue: createSnapshot(doc),
    documentId: String(doc.id),
    hook: 'afterChange',
    onCollection: collection.slug,
    operation,
    previousValue: operation === 'create' ? null : createSnapshot(previousDoc),
  })

  return doc
}

const logDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
  await writeAuditEntry(req, {
    currentValue: null,
    documentId: String(doc.id),
    hook: 'afterDelete',
    onCollection: collection.slug,
    operation: 'delete',
    previousValue: createSnapshot(doc),
  })

  return doc
}

export const withAuditTrail = (collection: CollectionConfig): CollectionConfig => {
  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [...(collection.hooks?.afterChange ?? []), logChange],
      afterDelete: [...(collection.hooks?.afterDelete ?? []), logDelete],
    },
  }
}
