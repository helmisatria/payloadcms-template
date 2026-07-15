import type { PostgresAdapter } from '@payloadcms/db-postgres'

// Keep this file as reference for the Better Auth table shape.
// It is only needed when Payload `push` is enabled again.
export const BA_TABLES = {
  user: 'ba_user',
  session: 'ba_session',
  account: 'ba_account',
  verification: 'ba_verification',
} as const

type RawTable = PostgresAdapter['rawTables'][string]
type RawColumn = RawTable['columns'][string]
type TimestampColumn = Extract<RawColumn, { type: 'timestamp' }>

const timestampColumn = (
  name: string,
  options?: { defaultNow?: boolean; notNull?: boolean },
): TimestampColumn => {
  return {
    defaultNow: options?.defaultNow,
    mode: 'date',
    name,
    notNull: options?.notNull,
    precision: 3,
    type: 'timestamp',
    withTimezone: true,
  }
}

const betterAuthRawTables: RawTable[] = [
  {
    name: BA_TABLES.user,
    columns: {
      id: {
        name: 'id',
        primaryKey: true,
        type: 'text',
      },
      name: {
        name: 'name',
        notNull: true,
        type: 'text',
      },
      email: {
        name: 'email',
        notNull: true,
        type: 'text',
      },
      emailVerified: {
        name: 'emailVerified',
        notNull: true,
        type: 'boolean',
      },
      image: {
        name: 'image',
        type: 'text',
      },
      createdAt: timestampColumn('createdAt', {
        defaultNow: true,
        notNull: true,
      }),
      updatedAt: timestampColumn('updatedAt', {
        defaultNow: true,
        notNull: true,
      }),
      role: {
        name: 'role',
        type: 'text',
      },
      banned: {
        name: 'banned',
        type: 'boolean',
      },
      banReason: {
        name: 'banReason',
        type: 'text',
      },
      banExpires: timestampColumn('banExpires'),
    },
    indexes: {
      emailUnique: {
        name: `${BA_TABLES.user}_email_key`,
        on: 'email',
        unique: true,
      },
    },
  },
  {
    name: BA_TABLES.session,
    columns: {
      id: {
        name: 'id',
        primaryKey: true,
        type: 'text',
      },
      expiresAt: timestampColumn('expiresAt', {
        notNull: true,
      }),
      token: {
        name: 'token',
        notNull: true,
        type: 'text',
      },
      createdAt: timestampColumn('createdAt', {
        defaultNow: true,
        notNull: true,
      }),
      updatedAt: timestampColumn('updatedAt', {
        notNull: true,
      }),
      ipAddress: {
        name: 'ipAddress',
        type: 'text',
      },
      userAgent: {
        name: 'userAgent',
        type: 'text',
      },
      userId: {
        name: 'userId',
        notNull: true,
        reference: {
          name: 'id',
          onDelete: 'cascade',
          table: BA_TABLES.user,
        },
        type: 'text',
      },
      impersonatedBy: {
        name: 'impersonatedBy',
        type: 'text',
      },
    },
    indexes: {
      tokenUnique: {
        name: `${BA_TABLES.session}_token_key`,
        on: 'token',
        unique: true,
      },
      userIdIndex: {
        name: `${BA_TABLES.session}_userId_idx`,
        on: 'userId',
      },
    },
  },
  {
    name: BA_TABLES.account,
    columns: {
      id: {
        name: 'id',
        primaryKey: true,
        type: 'text',
      },
      accountId: {
        name: 'accountId',
        notNull: true,
        type: 'text',
      },
      providerId: {
        name: 'providerId',
        notNull: true,
        type: 'text',
      },
      userId: {
        name: 'userId',
        notNull: true,
        reference: {
          name: 'id',
          onDelete: 'cascade',
          table: BA_TABLES.user,
        },
        type: 'text',
      },
      accessToken: {
        name: 'accessToken',
        type: 'text',
      },
      refreshToken: {
        name: 'refreshToken',
        type: 'text',
      },
      idToken: {
        name: 'idToken',
        type: 'text',
      },
      accessTokenExpiresAt: timestampColumn('accessTokenExpiresAt'),
      refreshTokenExpiresAt: timestampColumn('refreshTokenExpiresAt'),
      scope: {
        name: 'scope',
        type: 'text',
      },
      password: {
        name: 'password',
        type: 'text',
      },
      createdAt: timestampColumn('createdAt', {
        defaultNow: true,
        notNull: true,
      }),
      updatedAt: timestampColumn('updatedAt', {
        notNull: true,
      }),
    },
    indexes: {
      userIdIndex: {
        name: `${BA_TABLES.account}_userId_idx`,
        on: 'userId',
      },
    },
  },
  {
    name: BA_TABLES.verification,
    columns: {
      id: {
        name: 'id',
        primaryKey: true,
        type: 'text',
      },
      identifier: {
        name: 'identifier',
        notNull: true,
        type: 'text',
      },
      value: {
        name: 'value',
        notNull: true,
        type: 'text',
      },
      expiresAt: timestampColumn('expiresAt', {
        notNull: true,
      }),
      createdAt: timestampColumn('createdAt', {
        defaultNow: true,
        notNull: true,
      }),
      updatedAt: timestampColumn('updatedAt', {
        defaultNow: true,
        notNull: true,
      }),
    },
    indexes: {
      identifierIndex: {
        name: `${BA_TABLES.verification}_identifier_idx`,
        on: 'identifier',
      },
    },
  },
]

export function addBetterAuthTables(adapter: Pick<PostgresAdapter, 'rawTables'>): void {
  for (const table of betterAuthRawTables) {
    adapter.rawTables[table.name] = table
  }
}
