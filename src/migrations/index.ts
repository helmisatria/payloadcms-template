import * as migration_20260405_042727 from './20260405_042727'

export const migrations = [
  {
    up: migration_20260405_042727.up,
    down: migration_20260405_042727.down,
    name: '20260405_042727',
  },
]
