import { validatePermissions, type PermissionTarget } from '@/access/permissions'
import { withRBAC } from '@/access/withRBAC'
import type { CollectionBeforeDeleteHook, CollectionConfig, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

const toSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const immutableSlugError = (req: PayloadRequest) => {
  return new ValidationError({
    collection: 'roles',
    errors: [{ path: 'slug', message: 'A role slug cannot be changed after creation.' }],
    req,
  })
}

const protectSuperAdminDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const role = await req.payload.findByID({
    collection: 'roles',
    id,
    depth: 0,
    req,
  })

  if (role.slug === 'super-admin') {
    throw new ValidationError({
      collection: 'roles',
      errors: [{ path: 'slug', message: 'The super-admin role cannot be deleted.' }],
      req,
    })
  }
}

export const createRolesCollection = (targets: PermissionTarget[]): CollectionConfig => {
  return withRBAC({
    slug: 'roles',
    labels: {
      singular: 'Role',
      plural: 'Roles',
    },
    admin: {
      useAsTitle: 'name',
      defaultColumns: ['name', 'slug', 'updatedAt'],
    },
    hooks: {
      beforeValidate: [
        ({ data, operation }) => {
          if (operation !== 'create' || !data?.name) {
            return data
          }

          return {
            ...data,
            slug: toSlug(String(data.name)),
          }
        },
      ],
      beforeChange: [
        ({ data, operation, originalDoc, req }) => {
          if (operation === 'update' && data.slug !== undefined && data.slug !== originalDoc.slug) {
            throw immutableSlugError(req)
          }

          return data
        },
      ],
      beforeDelete: [protectSuperAdminDeletion],
    },
    fields: [
      {
        name: 'name',
        type: 'text',
        required: true,
        unique: true,
      },
      {
        name: 'slug',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        admin: {
          description: 'Generated from the role name and fixed after creation.',
          readOnly: true,
        },
      },
      {
        name: 'description',
        type: 'textarea',
      },
      {
        name: 'permissions',
        type: 'json',
        defaultValue: [],
        required: true,
        validate: (value) => validatePermissions(value, targets),
        admin: {
          components: {
            Field: {
              path: '/components/RolePermissionsMatrix#RolePermissionsMatrix',
              clientProps: { targets },
            },
          },
        },
      },
    ],
  })
}
