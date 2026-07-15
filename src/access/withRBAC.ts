import type { CollectionBeforeChangeHook, CollectionConfig, Field } from 'payload'

import { createAccess, deleteAccess, hiddenUnlessReadable, readAccess, updateAccess } from './index'

type RBACOptions = {
  ownable?: boolean
}

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

export const withRBAC = (
  collection: CollectionConfig,
  { ownable = false }: RBACOptions = {},
): CollectionConfig => {
  const fields = ownable ? [...collection.fields, createdByField] : collection.fields
  const beforeChange = ownable
    ? [...(collection.hooks?.beforeChange ?? []), stampOwner]
    : collection.hooks?.beforeChange

  return {
    ...collection,
    access: {
      create: createAccess(collection.slug),
      read: readAccess(collection.slug),
      update: updateAccess(collection.slug),
      delete: deleteAccess(collection.slug),
    },
    admin: {
      ...collection.admin,
      hidden: hiddenUnlessReadable(collection.slug),
    },
    custom: {
      ...collection.custom,
      rbacOwnable: ownable,
    },
    fields,
    hooks: {
      ...collection.hooks,
      beforeChange,
    },
  }
}
