export const isEqualContent = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) {
    return false
  }

  const sortedArr1 = [...a].sort()
  const sortedArr2 = [...b].sort()

  return sortedArr1.every((value, index) => value === sortedArr2[index])
}
