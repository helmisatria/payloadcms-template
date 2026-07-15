import { readAccess, type AccessUser } from '@/access'
import { getPermissionTargets, validatePermissions } from '@/access/permissions'
import { withRBAC } from '@/access/withRBAC'
import type { Role } from '@/payload-types'
import type { Access, CollectionConfig, RelationshipField } from 'payload'
import { describe, expect, it } from 'vitest'

// Contract tests for collection-declared scopes, using a hypothetical
// team-scoped articles collection as the fixture. No real collection is
// team-scoped yet; see ADR 0002 for the worked example these tests pin down.

const teamRules = { team: { field: 'team', userField: 'teams' } }
const articles = withRBAC(
  {
    slug: 'articles',
    labels: { plural: 'Articles', singular: 'Article' },
    fields: [
      { name: 'title', type: 'text' },
      // Teams are hypothetical in ADR 0002, so this slug is absent from generated types.
      { name: 'team', type: 'relationship', relationTo: 'teams' as never },
    ],
  },
  { ownable: true, scopes: teamRules },
)
const media = withRBAC(
  {
    slug: 'media',
    labels: { plural: 'Media', singular: 'Media item' },
    fields: [{ name: 'alt', type: 'text' }],
  },
  { ownable: true },
)
const targets = getPermissionTargets([articles, media])

const teamUser = (
  id: number,
  teams: unknown,
  permissions: Role['permissions'] = [
    { collection: 'articles', create: true, read: 'team', update: 'team', delete: 'team' },
  ],
): AccessUser => {
  return {
    id,
    role: { slug: 'team-editor', permissions },
    teams,
  } as AccessUser
}

const runAccess = (access: Access, user: AccessUser) => {
  return access({ req: { user } } as Parameters<Access>[0])
}

describe('declared scope contract', () => {
  it('derives the available scopes from each collection declaration', () => {
    expect(targets).toEqual([
      { slug: 'articles', label: 'Articles', scopes: ['own', 'team'] },
      { slug: 'media', label: 'Media', scopes: ['own'] },
    ])
  })

  it('accepts a scope only on collections that declare it', () => {
    expect(
      validatePermissions(
        [{ collection: 'articles', create: true, read: 'team', update: 'team', delete: 'none' }],
        targets,
      ),
    ).toBe(true)

    expect(
      validatePermissions(
        [{ collection: 'media', create: false, read: 'team', update: 'none', delete: 'none' }],
        targets,
      ),
    ).toContain('does not support team-scoped permissions')
  })

  it('turns a membership scope into a membership filter', async () => {
    const member = teamUser(7, [1, 2])
    expect(await runAccess(readAccess('articles', teamRules), member)).toEqual({
      team: { in: [1, 2] },
    })

    const populatedMember = teamUser(7, [{ id: 3, name: 'Team Three' }])
    expect(await runAccess(readAccess('articles', teamRules), populatedMember)).toEqual({
      team: { in: [3] },
    })
  })

  it('denies membership-scoped access to users without any membership', async () => {
    expect(await runAccess(readAccess('articles', teamRules), teamUser(7, []))).toBe(false)
    expect(await runAccess(readAccess('articles', teamRules), teamUser(7, undefined))).toBe(false)
  })

  it('rejects assigning a group the user does not belong to', async () => {
    const guard = articles.hooks?.beforeValidate?.[0]
    expect(guard).toBeDefined()

    const member = teamUser(7, [1])

    expect(() =>
      guard?.({
        data: { title: 'Foreign', team: 2 },
        operation: 'create',
        req: { user: member },
      } as never),
    ).toThrow('The following field is invalid')

    expect(
      guard?.({
        data: { title: 'Mine', team: 1 },
        operation: 'create',
        req: { user: member },
      } as never),
    ).toMatchObject({ team: 1 })

    // update = all lets a user assign any group.
    const collectionAdmin = teamUser(
      9,
      [],
      [{ collection: 'articles', create: true, read: 'all', update: 'all', delete: 'all' }],
    )
    expect(
      guard?.({
        data: { title: 'Anywhere', team: 2 },
        operation: 'create',
        req: { user: collectionAdmin },
      } as never),
    ).toMatchObject({ team: 2 })

    // Super-admin bypasses the guard entirely.
    const superAdmin: AccessUser = { id: 1, role: { slug: 'super-admin', permissions: [] } }
    expect(
      guard?.({
        data: { title: 'Anywhere', team: 2 },
        operation: 'create',
        req: { user: superAdmin },
      } as never),
    ).toMatchObject({ team: 2 })

    // System operations without a request user are not restricted.
    expect(
      guard?.({
        data: { title: 'Seeded', team: 2 },
        operation: 'create',
        req: { user: null },
      } as never),
    ).toMatchObject({ team: 2 })
  })

  it('limits relationship options to the request user memberships', () => {
    const teamField = articles.fields.find(
      (field): field is RelationshipField => 'name' in field && field.name === 'team',
    )

    expect(teamField?.filterOptions).toBeTypeOf('function')
    if (typeof teamField?.filterOptions !== 'function') {
      throw new Error('Missing team relationship filter')
    }

    expect(teamField.filterOptions({ user: teamUser(7, [1, { id: 2 }]) } as never)).toEqual({
      id: { in: [1, 2] },
    })
    expect(
      teamField.filterOptions({
        user: teamUser(
          9,
          [],
          [{ collection: 'articles', create: true, read: 'all', update: 'all', delete: 'all' }],
        ),
      } as never),
    ).toBe(true)
  })

  it('rejects reserved scope declarations', () => {
    const collection: CollectionConfig = {
      slug: 'articles',
      fields: [{ name: 'title', type: 'text' }],
    }

    expect(() =>
      withRBAC(collection, { scopes: { all: { field: 'team', userField: 'teams' } } }),
    ).toThrow('declares the reserved scope name "all"')
  })
})
