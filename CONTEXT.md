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
  read: 'none' | 'own' | 'all'
  update: 'none' | 'own' | 'all'
  delete: 'none' | 'own' | 'all'
}
```

Missing rows grant nothing. Collection targets come from the configured Payload collections, so adding a collection does not require maintaining a separate permission catalog.

### Scope

- `none`: deny the action.
- `own`: restrict the action to documents owned by the current user.
- `all`: allow the action across the collection.

Create is boolean because a document has no owner until it is created.

### Owner

For an ownable collection, the owner is the user in its hidden `createdBy` relationship. The RBAC wrapper stamps that relationship during creation. Existing documents with no owner do not match own-scoped access.

For `users`, ownership means the user record itself. Every authenticated user can read their own record and update the safe profile fields `name` and `image`. They cannot change their own role, email, or Better Auth identifier.

### Super Admin

The protected role with slug `super-admin`. It bypasses every collection permission check even when its permission matrix is empty. Its matrix is hidden because stored permissions do not affect it.

### Audit Log

An operation trail written by `payload-auditor` to `audit-logs`. Audit data is evidence, not an input to access decisions. Authenticated operations store the actor's Payload user ID; system operations store no actor.
