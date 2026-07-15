import type { CollectionConfig } from 'payload'

export const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete'] as const
export const BASE_SCOPES = ['none', 'all'] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]
export type ScopedPermissionAction = Exclude<PermissionAction, 'create'>

/**
 * A scope is the reach of one action: 'none' and 'all' always exist, and a
 * collection can declare extra scopes such as 'own' or 'team' through withRBAC.
 */
export type Scope = string

/**
 * How a declared scope resolves to a query filter.
 *
 * `field` is the document field holding the owning relationship.
 * `userField` is the request-user field holding the matching value(s);
 * the special value 'id' means the user record itself.
 *
 * Planned extension (see ADR 0002, "condition scopes"): rules that match a
 * document state instead of a membership, e.g. a 'published' scope declared
 * as `{ where: { _status: { equals: 'published' } } }`. When needed, make
 * this type a union of the membership rule and `{ where }`, return the
 * constant filter from the access resolver, and skip the membership guard
 * for condition scopes.
 */
export type ScopeRule = {
  field: string
  userField: string
}

export type ScopeRules = Record<string, ScopeRule>

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
  /** Extra scopes this collection supports beyond none/all, e.g. ['own', 'team']. */
  scopes: string[]
}

const permissionKeys = new Set(['collection', ...PERMISSION_ACTIONS])

const getCollectionLabel = (collection: CollectionConfig): string => {
  const pluralLabel = collection.labels?.plural

  if (typeof pluralLabel === 'string') {
    return pluralLabel
  }

  return collection.slug
}

const getCollectionScopes = (collection: CollectionConfig): string[] => {
  const scopes = collection.custom?.rbacScopes

  if (!Array.isArray(scopes)) {
    return []
  }

  return scopes.filter((scope): scope is string => typeof scope === 'string')
}

export const getPermissionTargets = (collections: CollectionConfig[]): PermissionTarget[] => {
  return collections.map((collection) => ({
    slug: collection.slug,
    label: getCollectionLabel(collection),
    scopes: getCollectionScopes(collection),
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

    const allowedScopes = [...BASE_SCOPES, ...target.scopes]

    for (const action of ['read', 'update', 'delete'] as const) {
      const scope = permission[action]

      if (typeof scope !== 'string' || scope.length === 0) {
        return `${action} permission for ${permission.collection} must be one of: ${allowedScopes.join(', ')}.`
      }

      if (scope !== 'none' && scope !== 'all' && !target.scopes.includes(scope)) {
        return `${permission.collection} does not support ${scope}-scoped permissions.`
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
    value.read.length > 0 &&
    typeof value.update === 'string' &&
    value.update.length > 0 &&
    typeof value.delete === 'string' &&
    value.delete.length > 0
  )
}
