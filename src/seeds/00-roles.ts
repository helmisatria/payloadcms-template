import type { Role } from '@/payload-types'
import type { Payload } from 'payload'

type RoleSeed = {
  name: string
  slug: string
  description: string
  permissions: Array<{
    collection: string
    create: boolean
    read: 'none' | 'own' | 'all'
    update: 'none' | 'own' | 'all'
    delete: 'none' | 'own' | 'all'
  }>
}

const ROLE_SEEDS: RoleSeed[] = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Protected role that bypasses every permission check.',
    permissions: [],
  },
  {
    name: 'Content Admin',
    slug: 'content-admin',
    description: 'Manages all media records.',
    permissions: [
      {
        collection: 'media',
        create: true,
        read: 'all',
        update: 'all',
        delete: 'all',
      },
    ],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Can view media records.',
    permissions: [
      {
        collection: 'media',
        create: false,
        read: 'all',
        update: 'none',
        delete: 'none',
      },
    ],
  },
]

const findRoleBySlug = async (payload: Payload, slug: string): Promise<Role | null> => {
  const result = await payload.find({
    collection: 'roles',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })

  return result.docs[0] ?? null
}

export const seedRoles = async (payload: Payload): Promise<Map<string, Role>> => {
  payload.logger.info('🔐 Seeding roles...')
  const rolesBySlug = new Map<string, Role>()

  for (const roleData of ROLE_SEEDS) {
    const existingRole = await findRoleBySlug(payload, roleData.slug)

    if (!existingRole) {
      const role = await payload.create({
        collection: 'roles',
        data: {
          name: roleData.name,
          slug: roleData.slug,
          description: roleData.description,
          permissions: roleData.permissions,
        },
      })
      rolesBySlug.set(roleData.slug, role)
      payload.logger.info(`✅ Created role: ${roleData.name}`)
      continue
    }

    const needsUpdate =
      existingRole.name !== roleData.name ||
      existingRole.description !== roleData.description ||
      JSON.stringify(existingRole.permissions) !== JSON.stringify(roleData.permissions)

    if (!needsUpdate) {
      rolesBySlug.set(roleData.slug, existingRole)
      payload.logger.info(`ℹ️ Role is up to date: ${roleData.name}`)
      continue
    }

    const role = await payload.update({
      collection: 'roles',
      id: existingRole.id,
      data: {
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
      },
    })
    rolesBySlug.set(roleData.slug, role)
    payload.logger.info(`♻️ Updated role: ${roleData.name}`)
  }

  return rolesBySlug
}
