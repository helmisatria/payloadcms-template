// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { inMemoryKVAdapter } from 'payload'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { seed } from './seeds'
import { setIsSeedingUsers } from './seeds/state'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

function shouldRunSeedOnInit(): boolean {
  return process.env.PAYLOAD_SKIP_SEED !== 'true'
}

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
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: process.env.USE_SQLITE
    ? sqliteAdapter({
        client: { url: 'file:./ci.db' },
        push: true,
      })
    : postgresAdapter({
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
    // storage-adapter-placeholder
  ],
  onInit: async (payload) => {
    if (!shouldRunSeedOnInit()) {
      return
    }

    setIsSeedingUsers(true)

    try {
      await seed(payload)
    } finally {
      setIsSeedingUsers(false)
    }
  },
})
