import { hasRole } from '@/access'
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: ({ req }) =>
      hasRole(req.user, 'viewer') ||
      hasRole(req.user, 'content-admin') ||
      hasRole(req.user, 'admin'),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
