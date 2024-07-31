export const secToMinHuman = (sec: number): string => {
  const secInMin = 60
  const fixed = 2

  const min = sec / secInMin
  return min.toFixed(fixed) + ' minutes'
}
