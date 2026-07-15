# ADR 0001: Custom-role RBAC permission model

- Status: Accepted
- Date: 2026-07-14

## Context

The starter previously stored one of three hardcoded strings on each user and checked those strings directly in collection access functions. Administrators could not create roles, permissions did not scale with new collections, and the model could not express ownership.

`rumah-pendidikan/cms-v2` provided useful helper and matrix patterns, but its static target catalog, boolean-only actions, legacy normalization, and external synchronization are not requirements for this greenfield model.

## Decision

Each user has one required relationship to a `roles` document. A role stores an array with at most one row per configured collection:

```ts
{
  collection: string
  create: boolean
  read: 'none' | 'own' | 'all'
  update: 'none' | 'own' | 'all'
  delete: 'none' | 'own' | 'all'
}
```

The server strictly rejects unknown collections, duplicate rows, extra keys, invalid scopes, and `own` on collections that do not support ownership. A missing row denies every action.

Permission targets are derived from the Payload collection configuration. The matrix receives those serializable targets through Payload client-component props. The audit collection is included from the plugin slug configured beside the collection list.

Collections use a shared `withRBAC` wrapper. Opting into `ownable: true` adds an indexed `createdBy` relationship and stamps it on creation. Own scope returns a Payload query constraint instead of loading documents in application code. The `users` collection uses record identity as ownership and adds baseline self read/update access.

The reserved `super-admin` slug bypasses all checks. It cannot be deleted or re-slugged. A user may set another user's role only with `users.update = all` or the super-admin bypass; nobody may change their own role.

Better Auth continues to own identity and sessions. Its own admin-plugin role is independent. The custom Payload auth strategy resolves users at depth 1 so the role and JSON permissions are available on `req.user` without a database query per check. First-sync users receive `DEFAULT_ROLE_SLUG`, defaulting to `viewer`.

`payload-auditor` records create, update, and delete operations on the application collections. Its default audit schema requires a user while its logger emits the string `anonymous` for valid system operations. We use the plugin's supported `customLogger` and collection configuration hooks to store authenticated user IDs and `null` for system actors. Its realtime buffer is asynchronous, so verification waits for audit rows rather than assuming immediate visibility.

## Consequences

- New collections automatically appear in the matrix and start denied.
- Ownership is explicit and opt-in; legacy rows with `createdBy = null` are invisible to own-scoped access.
- Access checks stay pure and use the populated request user.
- Role and permission changes take effect on the next session resolution or login.
- The Postgres migration must seed roles and map the old enum before making `users.role_id` required.
- Audit writes support Postgres, but plugin upgrades must retain the system-actor normalization test.

## Deliberate differences from cms-v2

- Collection slugs replace a maintained application/module catalog.
- Read, update, and delete use `none`, `own`, and `all` rather than booleans.
- There is no legacy permission-shape normalization or hydration fallback.
- There is no external role synchronization.
- Ownership is injected only when a collection opts in.
