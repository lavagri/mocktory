export const isEqualContent = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) {
    return false
  }

  const sortedArr1 = [...a].sort()
  const sortedArr2 = [...b].sort()

  return sortedArr1.every((value, index) => value === sortedArr2[index])
}

export const separateByPredicate = <T>(
  array: T[],
  predicate: (item: T) => boolean,
): [T[], T[]] => {
  const pass: T[] = []
  const fail: T[] = []

  for (const item of array) {
    if (predicate(item)) {
      pass.push(item)
    } else {
      fail.push(item)
    }
  }

  return [pass, fail]
}
