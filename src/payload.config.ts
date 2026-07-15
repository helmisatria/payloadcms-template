// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { auditorPlugin } from 'payload-auditor'
import path from 'path'
import { buildConfig, type CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { inMemoryKVAdapter } from 'payload'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { createRolesCollection } from './collections/Roles'
import { readAccess } from './access'
import { getPermissionTargets } from './access/permissions'
import { withAuditTrail } from './audit/withAuditTrail'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const AUDIT_LOG_SLUG = 'audit-logs'
const RolesWithoutTargets = createRolesCollection([])
const AuditLogsTarget: CollectionConfig = {
  slug: AUDIT_LOG_SLUG,
  labels: { singular: 'Audit Log', plural: 'Audit Logs' },
  fields: [],
}
const permissionTargets = getPermissionTargets([Users, RolesWithoutTargets, Media, AuditLogsTarget])
const Roles = createRolesCollection(permissionTargets)
const collections = [Users, Roles, Media].map(withAuditTrail)

export default buildConfig({
  kv: inMemoryKVAdapter(),
  admin: {
    user: 'users',
    avatar: {
      Component: '/components/BetterAuthAvatar#BetterAuthAvatar',
    },
    components: {
      graphics: {
        Logo: '/components/Logo#Logo',
        Icon: '/components/Logo#Logo',
      },
      logout: {
        Button: '/components/BetterAuthLogout#BetterAuthLogoutButton',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    blocksAsJSON: true,
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    auditorPlugin({
      collection: {
        slug: AUDIT_LOG_SLUG,
        Accessibility: {
          customAccess: {
            read: readAccess(AUDIT_LOG_SLUG),
          },
        },
        buffer: {
          flushStrategy: 'realtime',
        },
        configureRootCollection: (defaults) => ({
          ...defaults,
          fields: [
            ...defaults.fields.map((field) => {
              if ('name' in field && field.name === 'user') {
                return { ...field, required: false }
              }

              return field
            }),
            {
              name: 'previousValue',
              type: 'json',
              admin: { hidden: true },
            },
            {
              name: 'currentValue',
              type: 'json',
              admin: { hidden: true },
            },
            {
              name: 'changes',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/AuditLogDiff#AuditLogDiff',
                },
              },
            },
          ],
        }),
        trackCollections: [],
      },
    }),
    // storage-adapter-placeholder
  ],
})
