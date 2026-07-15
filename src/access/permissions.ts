import type { CollectionConfig } from 'payload'

export const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete'] as const
export const PERMISSION_SCOPES = ['none', 'own', 'all'] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]
export type ScopedPermissionAction = Exclude<PermissionAction, 'create'>
export type Scope = (typeof PERMISSION_SCOPES)[number]

export type CollectionPermission = {
  collection: string
  create: boolean
  read: Scope
  update: Scope
  delete: Scope
}

export type PermissionTarget = {
  slug: string
  label: string
  ownable: boolean
}

const permissionKeys = new Set(['collection', ...PERMISSION_ACTIONS])
const permissionScopes = new Set<string>(PERMISSION_SCOPES)

const getCollectionLabel = (collection: CollectionConfig): string => {
  const pluralLabel = collection.labels?.plural

  if (typeof pluralLabel === 'string') {
    return pluralLabel
  }

  return collection.slug
}

export const getPermissionTargets = (collections: CollectionConfig[]): PermissionTarget[] => {
  return collections.map((collection) => ({
    slug: collection.slug,
    label: getCollectionLabel(collection),
    ownable: collection.slug === 'users' || collection.custom?.rbacOwnable === true,
  }))
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export const validatePermissions = (value: unknown, targets: PermissionTarget[]): true | string => {
  if (!Array.isArray(value)) {
    return 'Permissions must be an array.'
  }

  const targetsBySlug = new Map(targets.map((target) => [target.slug, target]))
  const seenCollections = new Set<string>()

  for (const permission of value) {
    if (!isPlainObject(permission)) {
      return 'Each permission must be an object.'
    }

    const unknownKey = Object.keys(permission).find((key) => !permissionKeys.has(key))
    if (unknownKey) {
      return `Permission contains an unknown field: ${unknownKey}.`
    }

    if (typeof permission.collection !== 'string') {
      return 'Each permission must name a collection.'
    }

    const target = targetsBySlug.get(permission.collection)
    if (!target) {
      return `Unknown permission collection: ${permission.collection}.`
    }

    if (seenCollections.has(permission.collection)) {
      return `Duplicate permission collection: ${permission.collection}.`
    }
    seenCollections.add(permission.collection)

    if (typeof permission.create !== 'boolean') {
      return `Create permission for ${permission.collection} must be true or false.`
    }

    for (const action of ['read', 'update', 'delete'] as const) {
      const scope = permission[action]

      if (typeof scope !== 'string' || !permissionScopes.has(scope)) {
        return `${action} permission for ${permission.collection} must be none, own, or all.`
      }

      if (scope === 'own' && !target.ownable) {
        return `${permission.collection} does not support own-scoped permissions.`
      }
    }
  }

  return true
}

export const isCollectionPermission = (value: unknown): value is CollectionPermission => {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    typeof value.collection === 'string' &&
    typeof value.create === 'boolean' &&
    typeof value.read === 'string' &&
    permissionScopes.has(value.read) &&
    typeof value.update === 'string' &&
    permissionScopes.has(value.update) &&
    typeof value.delete === 'string' &&
    permissionScopes.has(value.delete)
  )
}
