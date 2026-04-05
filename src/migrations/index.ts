import * as migration_20260405_092927 from './20260405_092927'
import * as migration_20260405_092928_auth from './20260405_092928_auth'

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
]
