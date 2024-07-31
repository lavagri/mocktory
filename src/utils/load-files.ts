import glob from 'glob'
import path from 'path'

export function loadMockingFiles(pattern: string) {
  glob(pattern, (globErr, files) => {
    if (globErr) {
      // eslint-disable-next-line no-console
      console.error('Error while scanning for mocking files:', globErr)
      return
    }

    // Require each file
    files.forEach((file) => {
      try {
        require(path.resolve(file))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error while loading ${file}:`, err)
      }
    })
  })
}
