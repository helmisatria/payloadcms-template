# ADR 0002: Collection-declared scopes

- Status: Accepted
- Date: 2026-07-15

## Context

ADR 0001 fixed the permission scopes to `none | own | all`, with `own`
hardcoded to the `createdBy` relationship. We evaluated a team requirement
(users in a team manage only that team's documents) and found the model does
not extend well: adding one dimension the way `own` was built means editing
the scope enum, the permission validator, the access where-builders, the
`withRBAC` options, and the matrix UI — and repeating all of that for every
future dimension (region, department, and so on).

We also evaluated alternatives. `@payloadcms/plugin-multi-tenant` solves
hard-walled tenancy but brings its own access wiring that conflicts with
`withRBAC` and cannot express per-action scoping such as "read all, update
team-only". Role-level grouping (a "Manager Content Team 1" role per team)
multiplies roles by teams and breaks the one-role-per-user constraint.
Policy engines and ability libraries add expressive power we do not need at
real operational cost.

## Decision

Scopes are no longer a fixed enum. `none` and `all` always exist; every other
scope is declared by the collection through `withRBAC`. `ownable: true` is
sugar for declaring `own: { field: 'createdBy', userField: 'id' }`; the
`users` collection declares `own: { field: 'id', userField: 'id' }` because
ownership there is record identity.

A scope rule names the document field holding the owning relationship and the
request-user field holding the matching value(s); the special
`userField: 'id'` means the user record itself. Everything derives from that
one declaration:

- **Access** resolves a granted scope to `{ [field]: { in: userValues } }`,
  still a pure query constraint. A user with no matching values is denied
  outright.
- **Validation** allows a scope on a collection only if the collection
  declares it; the reserved names `none` and `all` cannot be declared.
- **The matrix UI** renders `none`, the declared scopes, and `all` per
  collection from the serializable targets.
- **Membership scopes** (rules whose `userField` is not `id`, matching a user
  list such as `teams`) additionally get a `beforeValidate` guard and
  admin-UI `filterOptions`: a user may only assign a group they belong to,
  unless they are super-admin or hold `update: all` on the collection.
  System operations without a request user are not restricted.

No collection beyond `users` and the `ownable` wrappers uses a custom scope
yet. The machinery is dormant until a collection declares one; contract tests
pin its behavior with a hypothetical team-scoped collection.

## Worked example: team scoping (not built yet)

When team access is needed:

1. Create a `teams` collection (wrapped in `withRBAC`).
2. Add a `hasMany` relationship `teams` on `users`, guarded like `role`
   (only `users.update = all` may change it, never one's own). The auth
   strategy's depth-1 user resolution makes team IDs available on `req.user`
   without extra queries.
3. Declare the scope on the scoped collection:

```ts
withRBAC(Articles, {
  ownable: true,
  scopes: {
    team: { field: 'team', userField: 'teams' },
  },
})
```

4. Grant roles `read/update/delete: 'team'` in the matrix, plus
   `teams: read all` so relationship dropdowns can load.

Backfill note: documents with a null scope field are invisible to that scope
(the `createdBy = null` rule from ADR 0001), so assign teams before granting
team-scoped roles.

## Known extension: condition scopes (not built yet)

Some access rules match a document state instead of a membership — for
example "read only published articles". These fit the scope model as a
declared scope with a fixed filter instead of a user match:

```ts
scopes: {
  team: { field: 'team', userField: 'teams' },        // membership scope
  published: { where: { _status: { equals: 'published' } } }, // condition scope
}
```

To build it: make `ScopeRule` a union (membership rule or `{ where }`), return
the constant filter from the access resolver, and skip the membership guard
and dropdown filtering for condition scopes (there is no assignment to
police). Validation and the matrix UI already derive from declarations, so
they pick the new scope up unchanged. Roles then select it like any other
scope (`articles.read = 'published'`) — never branch on role slugs in code;
`super-admin` stays the only slug code may check.

## Consequences

- Adding a scoping dimension is: create the group collection, add the user
  membership field, add one line to the collection's `scopes` declaration.
- Stored role JSON keeps its shape; only the set of valid scope strings per
  collection is dynamic, so no role data migration is needed.
- Own-scope filters changed from `{ equals: id }` to `{ in: [id] }` — the
  same semantics through the generic resolver.
- A role holds one scope per action. Combined rules like "published plus my
  own drafts" need either a purpose-built combined scope or an
  `andAccess`/`or` composition — role-varying rules belong in the matrix,
  universal invariants in composed access code.
- Deliberately not built: arbitrary query conditions stored in roles or a
  policy engine. Permissions stay auditable — one JSON row plus one
  collection declaration answers "who can see this and why". Revisit (for
  example with a relationship-based engine such as OpenFGA) only if
  per-document sharing, access hierarchies, or cross-service authorization
  arrive; all decisions flow through `src/access/`, so swapping the resolver
  is a contained change.
