'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import { useMemo, useState } from 'react'

import {
  isCollectionPermission,
  type CollectionPermission,
  type PermissionTarget,
  type Scope,
  type ScopedPermissionAction,
} from '@/access/permissions'

type RolePermissionsMatrixProps = {
  path?: string
  readOnly?: boolean
  targets: PermissionTarget[]
}

const scopesFor = (target: PermissionTarget): Scope[] => ['none', ...target.scopes, 'all']

const emptyPermission = (collection: string): CollectionPermission => ({
  collection,
  create: false,
  read: 'none',
  update: 'none',
  delete: 'none',
})

const hasGrant = (permission: CollectionPermission): boolean => {
  return (
    permission.create ||
    permission.read !== 'none' ||
    permission.update !== 'none' ||
    permission.delete !== 'none'
  )
}

const normalizePermissions = (
  value: unknown,
  targets: PermissionTarget[],
): CollectionPermission[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const knownSlugs = new Set(targets.map((target) => target.slug))
  return value.filter(
    (permission): permission is CollectionPermission =>
      isCollectionPermission(permission) && knownSlugs.has(permission.collection),
  )
}

const controlStyle = {
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
}

export const RolePermissionsMatrix = ({
  path = 'permissions',
  readOnly = false,
  targets,
}: RolePermissionsMatrixProps) => {
  const { value, setValue } = useField<unknown>({ path })
  const slugField = useFormFields(([fields]) => fields?.slug ?? null)
  const [query, setQuery] = useState('')

  const permissions = useMemo(() => normalizePermissions(value, targets), [targets, value])
  const permissionsByCollection = useMemo(
    () => new Map(permissions.map((permission) => [permission.collection, permission])),
    [permissions],
  )
  const normalizedQuery = query.trim().toLowerCase()
  const visibleTargets = targets.filter((target) => {
    return (
      !normalizedQuery || `${target.label} ${target.slug}`.toLowerCase().includes(normalizedQuery)
    )
  })

  if (slugField?.value === 'super-admin') {
    return (
      <div className="field-type">
        <div className="field-label">Permissions</div>
        <p style={{ color: 'var(--theme-elevation-600)', margin: 0 }}>
          Super Admin bypasses every permission check. Its matrix is intentionally ignored.
        </p>
      </div>
    )
  }

  const commit = (nextByCollection: Map<string, CollectionPermission>) => {
    const orderedPermissions = targets.flatMap((target) => {
      const permission = nextByCollection.get(target.slug)
      return permission && hasGrant(permission) ? [permission] : []
    })

    setValue(orderedPermissions)
  }

  const updatePermission = (
    collection: string,
    update: (permission: CollectionPermission) => CollectionPermission,
  ) => {
    const nextByCollection = new Map(permissionsByCollection)
    const current = nextByCollection.get(collection) ?? emptyPermission(collection)
    nextByCollection.set(collection, update(current))
    commit(nextByCollection)
  }

  const setScope = (collection: string, action: ScopedPermissionAction, scope: Scope) => {
    updatePermission(collection, (permission) => ({ ...permission, [action]: scope }))
  }

  const setReadOnlyAll = () => {
    setValue(
      targets.map((target) => ({
        ...emptyPermission(target.slug),
        read: 'all' as const,
      })),
    )
  }

  return (
    <div className="field-type">
      <div className="field-label">
        <label htmlFor={`${path}-filter`}>Permissions</label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 16 }}>
        <input
          id={`${path}-filter`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter collections"
          style={{ ...controlStyle, flex: '1 1 240px', minInlineSize: 220, padding: '8px 10px' }}
        />
        <button
          type="button"
          disabled={readOnly}
          onClick={setReadOnlyAll}
          style={{
            ...controlStyle,
            cursor: readOnly ? 'not-allowed' : 'pointer',
            padding: '8px 12px',
          }}
        >
          Read-only all
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setValue([])}
          style={{
            ...controlStyle,
            cursor: readOnly ? 'not-allowed' : 'pointer',
            padding: '8px 12px',
          }}
        >
          Clear all
        </button>
      </div>

      <div
        style={{
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 6,
          overflowX: 'auto',
        }}
      >
        <table style={{ borderCollapse: 'collapse', inlineSize: '100%', minInlineSize: 760 }}>
          <thead style={{ background: 'var(--theme-elevation-100)' }}>
            <tr>
              <th style={{ padding: 12, textAlign: 'left' }}>Collection</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Create</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Read</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Update</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {visibleTargets.map((target) => {
              const permission =
                permissionsByCollection.get(target.slug) ?? emptyPermission(target.slug)

              return (
                <tr key={target.slug}>
                  <td style={{ borderTop: '1px solid var(--theme-elevation-150)', padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{target.label}</div>
                    <div style={{ color: 'var(--theme-elevation-500)', fontSize: 12 }}>
                      {target.slug}
                    </div>
                  </td>
                  <td
                    style={{
                      borderTop: '1px solid var(--theme-elevation-150)',
                      padding: 12,
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={permission.create}
                      disabled={readOnly}
                      onChange={(event) =>
                        updatePermission(target.slug, (current) => ({
                          ...current,
                          create: event.target.checked,
                        }))
                      }
                      aria-label={`${target.label} create`}
                      style={{ blockSize: 18, inlineSize: 18 }}
                    />
                  </td>
                  {(['read', 'update', 'delete'] as const).map((action) => (
                    <td
                      key={action}
                      style={{
                        borderTop: '1px solid var(--theme-elevation-150)',
                        padding: 12,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {scopesFor(target).map((scope) => {
                          const disabled = readOnly
                          const selected = permission[action] === scope

                          return (
                            <button
                              key={scope}
                              type="button"
                              disabled={disabled}
                              aria-pressed={selected}
                              onClick={() => setScope(target.slug, action, scope)}
                              style={{
                                ...controlStyle,
                                background: selected
                                  ? 'var(--theme-elevation-800)'
                                  : 'var(--theme-input-bg)',
                                color: selected ? 'var(--theme-elevation-0)' : 'var(--theme-text)',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.45 : 1,
                                padding: '5px 8px',
                              }}
                            >
                              {scope}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
