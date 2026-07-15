import {
  andAccess,
  canAccessAdminPanel,
  checkPermission,
  createAccess,
  readAccess,
  type AccessUser,
} from '@/access'
import { validatePermissions, type PermissionTarget } from '@/access/permissions'
import { withRBAC } from '@/access/withRBAC'
import config from '@/payload.config'
import type { Role, User } from '@/payload-types'
import { getPayload, type Access, type CollectionConfig, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

const targets: PermissionTarget[] = [
  { slug: 'users', label: 'Users', ownable: true },
  { slug: 'roles', label: 'Roles', ownable: false },
  { slug: 'media', label: 'Media', ownable: true },
  { slug: 'audit-logs', label: 'Audit Logs', ownable: false },
]

const userWithRole = (id: number, slug: string, permissions: Role['permissions']): AccessUser => ({
  id,
  role: { slug, permissions },
})

const runAccess = (access: Access, user: AccessUser, id?: number | string) => {
  return access({ id, req: { user } } as Parameters<Access>[0])
}

describe('RBAC permission contract', () => {
  it('strictly validates the stored permission shape', () => {
    expect(validatePermissions([], targets)).toBe(true)
    expect(
      validatePermissions(
        [
          {
            collection: 'media',
            create: true,
            read: 'all',
            update: 'own',
            delete: 'none',
          },
        ],
        targets,
      ),
    ).toBe(true)

    expect(validatePermissions({}, targets)).toBe('Permissions must be an array.')
    expect(
      validatePermissions(
        [
          {
            collection: 'missing',
            create: false,
            read: 'none',
            update: 'none',
            delete: 'none',
          },
        ],
        targets,
      ),
    ).toContain('Unknown permission collection')
    expect(
      validatePermissions(
        [
          {
            collection: 'roles',
            create: false,
            read: 'own',
            update: 'none',
            delete: 'none',
          },
        ],
        targets,
      ),
    ).toContain('does not support own-scoped permissions')
    expect(
      validatePermissions(
        [
          {
            collection: 'media',
            create: false,
            read: 'all',
            update: 'none',
            delete: 'none',
          },
          {
            collection: 'media',
            create: false,
            read: 'none',
            update: 'none',
            delete: 'none',
          },
        ],
        targets,
      ),
    ).toContain('Duplicate permission collection')
  })

  it('denies anonymous users and users without a matching grant', async () => {
    expect(checkPermission(null, 'media', 'read')).toBe(false)

    const viewer = userWithRole(1, 'viewer', [
      {
        collection: 'media',
        create: false,
        read: 'all',
        update: 'none',
        delete: 'none',
      },
    ])

    expect(checkPermission(viewer, 'media', 'read')).toBe(true)
    expect(checkPermission(viewer, 'media', 'create')).toBe(false)
    expect(checkPermission(viewer, 'roles', 'read')).toBe(false)
    expect(await runAccess(createAccess('media'), viewer)).toBe(false)
  })

  it('turns own scope into an owner filter and hides ownerless legacy documents', async () => {
    const editor = userWithRole(7, 'editor', [
      {
        collection: 'media',
        create: false,
        read: 'all',
        update: 'own',
        delete: 'none',
      },
    ])

    expect(checkPermission(editor, 'media', 'update')).toBe('own')
    expect(await runAccess(readAccess('media'), editor)).toBe(true)

    const updateResult = await runAccess((await import('@/access')).updateAccess('media'), editor)
    expect(updateResult).toEqual({ createdBy: { equals: 7 } })
  })

  it('always lets super-admin bypass an empty matrix', () => {
    const superAdmin = userWithRole(1, 'super-admin', [])

    expect(checkPermission(superAdmin, 'users', 'delete')).toBe(true)
    expect(checkPermission(superAdmin, 'audit-logs', 'read')).toBe(true)
    expect(canAccessAdminPanel({ req: { user: superAdmin } } as never)).toBe(true)
  })

  it('requires every composed access rule to pass', async () => {
    const user = userWithRole(7, 'viewer', [])
    const ownerFilter = { createdBy: { equals: 7 } }
    const publishedFilter = { status: { equals: 'published' } }

    expect(
      await runAccess(
        andAccess(
          () => true,
          () => false,
        ),
        user,
      ),
    ).toBe(false)
    expect(
      await runAccess(
        andAccess(
          () => true,
          () => ownerFilter,
        ),
        user,
      ),
    ).toEqual(ownerFilter)
    expect(
      await runAccess(
        andAccess(
          () => ownerFilter,
          () => publishedFilter,
        ),
        user,
      ),
    ).toEqual({
      and: [ownerFilter, publishedFilter],
    })
  })

  it('only admits users with at least one grant to the admin panel', () => {
    expect(canAccessAdminPanel({ req: { user: userWithRole(1, 'viewer', []) } } as never)).toBe(
      false,
    )
    expect(
      canAccessAdminPanel({
        req: {
          user: userWithRole(1, 'viewer', [
            {
              collection: 'media',
              create: false,
              read: 'all',
              update: 'none',
              delete: 'none',
            },
          ]),
        },
      } as never),
    ).toBe(true)
  })

  it('injects and stamps ownership only for ownable collections', async () => {
    const collection = withRBAC(
      {
        slug: 'articles',
        fields: [{ name: 'title', type: 'text' }],
      },
      { ownable: true },
    )
    const createdBy = collection.fields.find(
      (field) => 'name' in field && field.name === 'createdBy',
    )
    expect(createdBy).toBeDefined()

    const stampOwner = collection.hooks?.beforeChange?.[0]
    expect(stampOwner).toBeDefined()

    const result = await stampOwner?.({
      data: { title: 'Owned' },
      operation: 'create',
      req: { user: { id: 42 } },
    } as never)
    expect(result).toMatchObject({ createdBy: 42 })
  })
})

describe('RBAC collection integration', () => {
  let payload: Payload
  let collections: CollectionConfig[]

  beforeAll(async () => {
    const payloadConfig = await config
    collections = payloadConfig.collections ?? []
    payload = await getPayload({ config: payloadConfig })
  })

  it('denies anonymous reads on every RBAC collection', async () => {
    for (const slug of ['users', 'roles', 'media', 'audit-logs']) {
      const collection = collections.find((candidate) => candidate.slug === slug)
      expect(collection, slug).toBeDefined()

      const access = collection?.access?.read
      expect(typeof access, `${slug} read access`).toBe('function')

      const result = await runAccess(access as Access, null)
      expect(result, `${slug} anonymous read`).toBe(false)
    }
  })

  it('allows baseline self access but blocks self-promotion', async () => {
    const users = collections.find((collection) => collection.slug === 'users')
    const viewer = userWithRole(17, 'viewer', [])
    const readResult = await runAccess(users?.access?.read as Access, viewer)

    expect(readResult).toEqual({ id: { equals: 17 } })

    const roleField = users?.fields.find((field) => 'name' in field && field.name === 'role')
    expect(roleField && 'access' in roleField ? roleField.access?.update : undefined).toBeDefined()

    if (!roleField || !('access' in roleField) || !roleField.access?.update) {
      throw new Error('Missing role update access')
    }

    expect(
      roleField.access.update({ id: 17, req: { user: viewer } } as Parameters<
        NonNullable<typeof roleField.access.update>
      >[0]),
    ).toBe(false)

    const userManager = userWithRole(17, 'user-manager', [
      {
        collection: 'users',
        create: false,
        read: 'all',
        update: 'all',
        delete: 'none',
      },
    ])
    expect(roleField.access.update({ id: 17, req: { user: userManager } } as never)).toBe(false)
    expect(roleField.access.update({ id: 18, req: { user: userManager } } as never)).toBe(true)
  })

  it('does not let the protected super-admin role be deleted', async () => {
    const roles = collections.find((collection) => collection.slug === 'roles')
    const beforeDelete = roles?.hooks?.beforeDelete?.[0]

    expect(beforeDelete).toBeDefined()
    await expect(
      beforeDelete?.({
        id: 1,
        req: {
          payload: {
            findByID: async () => ({ id: 1, slug: 'super-admin' }),
          },
        },
      } as never),
    ).rejects.toThrow('The following field is invalid')
  })

  it('writes auditor rows for authenticated creates and updates', async () => {
    const existingRoles = await payload.find({
      collection: 'roles',
      depth: 0,
      limit: 1,
      where: { slug: { equals: 'super-admin' } },
    })
    const superAdminRole =
      existingRoles.docs[0] ??
      (await payload.create({
        collection: 'roles',
        data: { name: 'Super Admin', slug: 'super-admin', permissions: [] },
      }))
    const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const actor = await payload.create({
      collection: 'users',
      depth: 1,
      data: {
        email: `rbac-audit-${uniqueId}@example.com`,
        name: 'RBAC Audit Test',
        role: superAdminRole.id,
      },
    })
    const authenticatedActor = actor as User & { collection: 'users' }

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Audited create' },
      file: {
        data: Buffer.from('audit test'),
        mimetype: 'text/plain',
        name: `rbac-audit-${uniqueId}.txt`,
        size: 10,
      },
      overrideAccess: false,
      user: authenticatedActor,
    })

    const createdById =
      typeof media.createdBy === 'object' && media.createdBy ? media.createdBy.id : media.createdBy
    expect(createdById).toBe(actor.id)

    await payload.update({
      collection: 'media',
      id: media.id,
      data: { alt: 'Audited update' },
      overrideAccess: false,
      user: authenticatedActor,
    })

    await expect
      .poll(
        async () => {
          const logs = await payload.find({
            collection: 'audit-logs',
            overrideAccess: true,
            where: {
              and: [
                { onCollection: { equals: 'media' } },
                { documentId: { equals: String(media.id) } },
              ],
            },
          })

          return logs.docs
        },
        { timeout: 5_000 },
      )
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ operation: 'create' }),
          expect.objectContaining({
            operation: 'update',
            previousValue: expect.objectContaining({
              alt: 'Audited create',
              createdBy: actor.id,
            }),
            currentValue: expect.objectContaining({
              alt: 'Audited update',
              createdBy: actor.id,
            }),
          }),
        ]),
      )

    const viewerRole = await payload.create({
      collection: 'roles',
      data: { name: `No Audit ${uniqueId}`, slug: `no-audit-${uniqueId}`, permissions: [] },
    })
    const viewer = { ...authenticatedActor, role: viewerRole } as User & { collection: 'users' }

    await expect(
      payload.find({
        collection: 'audit-logs',
        overrideAccess: false,
        user: viewer,
      }),
    ).rejects.toThrow()

    await payload.delete({ collection: 'media', id: media.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: actor.id, overrideAccess: true })
    await payload.delete({ collection: 'roles', id: viewerRole.id, overrideAccess: true })
  })
})
