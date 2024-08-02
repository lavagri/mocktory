import { globSync } from 'glob'
import path from 'path'

export function loadMockingFiles(pattern: string) {
  const files = globSync(pattern)

  files.forEach((file) => {
    try {
      require(path.resolve(file))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error while loading ${file}:`, err)
    }
  })
}
