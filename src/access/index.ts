import type { Access, PayloadRequest, Where } from 'payload'

import {
  isCollectionPermission,
  type PermissionAction,
  type ScopedPermissionAction,
} from './permissions'

export { andAccess } from './andAccess'

type RoleLike = {
  permissions?: unknown
  slug?: unknown
}

export type AccessUser =
  | {
      id: number | string
      role?: unknown
    }
  | null
  | undefined

type AdminHiddenArgs = {
  user?: AccessUser
}

export const getPopulatedRole = (user: AccessUser): RoleLike | null => {
  if (!user?.role || typeof user.role !== 'object') {
    return null
  }

  return user.role as RoleLike
}

export const isSuperAdmin = (user: AccessUser): boolean => {
  return getPopulatedRole(user)?.slug === 'super-admin'
}

export function checkPermission(user: AccessUser, collectionSlug: string, action: 'create'): boolean
export function checkPermission(
  user: AccessUser,
  collectionSlug: string,
  action: ScopedPermissionAction,
): boolean | 'own'
export function checkPermission(
  user: AccessUser,
  collectionSlug: string,
  action: PermissionAction,
): boolean | 'own' {
  const role = getPopulatedRole(user)

  if (!role) {
    return false
  }

  if (role.slug === 'super-admin') {
    return true
  }

  if (!Array.isArray(role.permissions)) {
    return false
  }

  const permission = role.permissions.find(
    (candidate) => isCollectionPermission(candidate) && candidate.collection === collectionSlug,
  )

  if (!permission || !isCollectionPermission(permission)) {
    return false
  }

  if (action === 'create') {
    return permission.create
  }

  const scope = permission[action]

  if (scope === 'all') {
    return true
  }

  if (scope === 'own') {
    return 'own'
  }

  return false
}

const ownWhere = (collectionSlug: string, userId: number | string): Where => {
  if (collectionSlug === 'users') {
    return { id: { equals: userId } }
  }

  return { createdBy: { equals: userId } }
}

const accessFor = (action: PermissionAction) => {
  return (collectionSlug: string): Access => {
    return ({ req: { user } }) => {
      const permission = checkPermission(user, collectionSlug, action as ScopedPermissionAction)

      if (permission !== 'own') {
        return permission
      }

      if (!user) {
        return false
      }

      return ownWhere(collectionSlug, user.id)
    }
  }
}

export const createAccess = accessFor('create')
export const readAccess = accessFor('read')
export const updateAccess = accessFor('update')
export const deleteAccess = accessFor('delete')

export const ownerOr = (access: Access): Access => {
  return async (args) => {
    const user = args.req.user

    if (!user) {
      return false
    }

    if (args.id === user.id) {
      return true
    }

    const permission = await access(args)
    if (permission === true) {
      return true
    }

    const selfWhere: Where = { id: { equals: user.id } }

    if (permission === false) {
      return selfWhere
    }

    return { or: [selfWhere, permission] }
  }
}

const hasAnyPermission = (user: AccessUser): boolean => {
  const role = getPopulatedRole(user)

  if (!Array.isArray(role?.permissions)) {
    return false
  }

  return role.permissions.some((value) => {
    if (!isCollectionPermission(value)) {
      return false
    }

    return (
      value.create || value.read !== 'none' || value.update !== 'none' || value.delete !== 'none'
    )
  })
}

export const canAccessAdminPanel = ({ req }: { req: PayloadRequest }): boolean => {
  return isSuperAdmin(req.user) || hasAnyPermission(req.user)
}

export const hiddenUnlessReadable = (collectionSlug: string) => {
  return ({ user }: AdminHiddenArgs): boolean => {
    return checkPermission(user, collectionSlug, 'read') === false
  }
}

export const canSetUserRole = ({
  id,
  req,
}: {
  id?: number | string
  req: PayloadRequest
}): boolean => {
  if (!req.user || id === req.user.id) {
    return false
  }

  return checkPermission(req.user, 'users', 'update') === true
}

export type { CollectionPermission, PermissionAction, PermissionTarget, Scope } from './permissions'
