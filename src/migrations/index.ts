import * as migration_20260405_092927 from './20260405_092927'
import * as migration_20260405_092928_auth from './20260405_092928_auth'
import * as migration_20260714_150021_rbac_custom_roles from './20260714_150021_rbac_custom_roles'
import * as migration_20260714_154149 from './20260714_154149'

export const migrations = [
  {
    up: migration_20260405_092927.up,
    down: migration_20260405_092927.down,
    name: '20260405_092927',
  },
  {
    up: migration_20260405_092928_auth.up,
    down: migration_20260405_092928_auth.down,
    name: '20260405_092928_auth',
  },
  {
    up: migration_20260714_150021_rbac_custom_roles.up,
    down: migration_20260714_150021_rbac_custom_roles.down,
    name: '20260714_150021_rbac_custom_roles',
  },
  {
    up: migration_20260714_154149.up,
    down: migration_20260714_154149.down,
    name: '20260714_154149',
  },
]
