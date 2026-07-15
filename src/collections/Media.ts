import { withRBAC } from '@/access/withRBAC'
import type { CollectionConfig } from 'payload'

const MediaConfig: CollectionConfig = {
  slug: 'media',
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}

/**
 * To add a collection-specific guard later, compose it with the RBAC rule:
 *
 * const RBACMedia = withRBAC(MediaConfig, { ownable: true })
 *
 * export const Media = {
 *   ...RBACMedia,
 *   access: {
 *     ...RBACMedia.access,
 *     read: andAccess(readAccess('media'), mediaReadGuard),
 *   },
 * }
 */
export const Media = withRBAC(MediaConfig, { ownable: true })
