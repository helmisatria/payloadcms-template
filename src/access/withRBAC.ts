import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Field,
  FilterOptionsProps,
} from 'payload'
import { ValidationError } from 'payload'

import {
  checkPermission,
  createAccess,
  deleteAccess,
  hiddenUnlessReadable,
  isSuperAdmin,
  readAccess,
  relationshipIds,
  scopeUserIds,
  updateAccess,
} from './index'
import type { ScopeRule, ScopeRules } from './permissions'

type RBACOptions = {
  /** Adds a hidden createdBy relationship and an 'own' scope that matches it. */
  ownable?: boolean
  /**
   * Extra scopes this collection supports, e.g.
   * `{ team: { field: 'team', userField: 'teams' } }` means team-scoped
   * permissions match documents whose `team` is one of the user's `teams`.
   *
   * State-based rules like "read only published" belong here too once
   * condition scopes exist (see ADR 0002) — not as role-slug checks in
   * access code. Only the protected `super-admin` slug may be checked in
   * code; every other role behavior must stay admin-editable data.
   */
  scopes?: ScopeRules
}

const OWN_SCOPE_RULE: ScopeRule = { field: 'createdBy', userField: 'id' }

const stampOwner: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create' || !req.user) {
    return data
  }

  return {
    ...data,
    createdBy: req.user.id,
  }
}

const createdByField: Field = {
  name: 'createdBy',
  type: 'relationship',
  relationTo: 'users',
  index: true,
  admin: {
    hidden: true,
    readOnly: true,
  },
  access: {
    create: () => false,
    update: () => false,
  },
}

/** A membership scope matches a document field against a list on the user (e.g. teams). */
const isMembershipRule = (rule: ScopeRule): boolean => rule.userField !== 'id'

/**
 * Rejects writes that assign a scope field to a group the user is not a member
 * of. Users with update = all (or super-admin) may assign any value; system
 * operations without a request user are not restricted.
 */
const enforceScopeMembership = (
  collectionSlug: string,
  rule: ScopeRule,
): CollectionBeforeValidateHook => {
  return ({ data, operation, req }) => {
    if (operation !== 'create' && operation !== 'update') {
      return data
    }

    const user = req.user
    const submitted = data?.[rule.field]

    if (!user || submitted === undefined || submitted === null) {
      return data
    }

    if (isSuperAdmin(user) || checkPermission(user, collectionSlug, 'update') === true) {
      return data
    }

    const memberIds = new Set(scopeUserIds(user, rule.userField).map(String))
    const outside = relationshipIds(submitted).filter((id) => !memberIds.has(String(id)))

    if (outside.length > 0) {
      throw new ValidationError({
        collection: collectionSlug,
        errors: [
          {
            path: rule.field,
            message: `You can only assign a ${rule.field} you belong to.`,
          },
        ],
        req,
      })
    }

    return data
  }
}

/**
 * Limits the admin-panel dropdown for a scope field to the user's own
 * memberships, mirroring what enforceScopeMembership accepts server-side.
 */
const withMembershipFilter = (field: Field, collectionSlug: string, rule: ScopeRule): Field => {
  if (
    !('name' in field) ||
    field.name !== rule.field ||
    field.type !== 'relationship' ||
    field.filterOptions
  ) {
    return field
  }

  return {
    ...field,
    filterOptions: ({ user }: FilterOptionsProps) => {
      if (user?.id === undefined) {
        return true
      }

      const accessUser = user as Parameters<typeof isSuperAdmin>[0]

      if (
        isSuperAdmin(accessUser) ||
        checkPermission(accessUser, collectionSlug, 'update') === true
      ) {
        return true
      }

      return { id: { in: scopeUserIds(accessUser, rule.userField) } }
    },
  }
}

export const withRBAC = (
  collection: CollectionConfig,
  { ownable = false, scopes = {} }: RBACOptions = {},
): CollectionConfig => {
  const scopeRules: ScopeRules = {
    ...(ownable ? { own: OWN_SCOPE_RULE } : {}),
    ...scopes,
  }

  for (const name of Object.keys(scopeRules)) {
    if (name === 'none' || name === 'all') {
      throw new Error(`Collection ${collection.slug} declares the reserved scope name "${name}".`)
    }
  }

  const membershipRules = Object.values(scopeRules).filter(isMembershipRule)

  let fields = ownable ? [...collection.fields, createdByField] : collection.fields
  fields = fields.map((field) => {
    return membershipRules.reduce(
      (current, rule) => withMembershipFilter(current, collection.slug, rule),
      field,
    )
  })

  const beforeChange = ownable
    ? [...(collection.hooks?.beforeChange ?? []), stampOwner]
    : collection.hooks?.beforeChange
  const beforeValidate = membershipRules.length
    ? [
        ...(collection.hooks?.beforeValidate ?? []),
        ...membershipRules.map((rule) => enforceScopeMembership(collection.slug, rule)),
      ]
    : collection.hooks?.beforeValidate

  return {
    ...collection,
    access: {
      create: createAccess(collection.slug),
      read: readAccess(collection.slug, scopeRules),
      update: updateAccess(collection.slug, scopeRules),
      delete: deleteAccess(collection.slug, scopeRules),
    },
    admin: {
      ...collection.admin,
      hidden: hiddenUnlessReadable(collection.slug),
    },
    custom: {
      ...collection.custom,
      rbacScopes: Object.keys(scopeRules),
    },
    fields,
    hooks: {
      ...collection.hooks,
      beforeChange,
      beforeValidate,
    },
  }
}
