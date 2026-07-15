# Domain Context

This project uses Better Auth for identity and Payload for application authorization. The two role systems are deliberately separate: Better Auth's `ba_user.role` supports its admin plugin, while `users.role` points to the Payload role described below.

## Glossary

### Role

A named permission set assigned to exactly one Payload user. Administrators can create roles in the Payload admin panel. The reserved `super-admin` role bypasses permission checks and cannot be deleted or re-slugged.

### Permission

One role row for one Payload collection:

```ts
{
  collection: string
  create: boolean
  read: Scope // 'none' | 'all' | a scope the collection declares, e.g. 'own' | 'team'
  update: Scope
  delete: Scope
}
```

Missing rows grant nothing. Collection targets come from the configured Payload collections, so adding a collection does not require maintaining a separate permission catalog.

### Scope

- `none`: deny the action.
- `all`: allow the action across the collection.
- Any other scope is declared by the collection through `withRBAC` and resolves to a query filter: the document's rule field must match the user's rule values. `own` (documents the user created; for `users`, the user's own record) is the only declared scope in use today. Group-based scopes such as `team` are supported by the machinery but not wired to any collection — see ADR 0002 for the worked example.

Create is boolean because a document has no owner until it is created. Membership scopes still constrain create through the assignment guard below.

### Membership guard

For membership scopes (rules matching a user list, e.g. a future `teams` field), a `beforeValidate` hook rejects writes that assign the scope field to a group the user is not in, and the admin dropdown is filtered to the user's groups. Super-admin and holders of `update: all` on the collection may assign any group. System operations without a request user are unrestricted.

### Owner

For an ownable collection, the owner is the user in its hidden `createdBy` relationship. The RBAC wrapper stamps that relationship during creation. Existing documents with no owner do not match own-scoped access.

For `users`, ownership means the user record itself. Every authenticated user can read their own record and update the safe profile fields `name` and `image`. They cannot change their own role, email, or Better Auth identifier.

### Super Admin

The protected role with slug `super-admin`. It bypasses every collection permission check even when its permission matrix is empty. Its matrix is hidden because stored permissions do not affect it.

### Audit Log

An operation trail written by `payload-auditor` to `audit-logs`. Audit data is evidence, not an input to access decisions. Authenticated operations store the actor's Payload user ID; system operations store no actor.
