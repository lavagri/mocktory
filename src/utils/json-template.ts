function getValueByPath(obj: any, path: string) {
  const keys = path.split('.')
  let value = obj

  for (const key of keys) {
    if (value[key] !== undefined) {
      value = value[key]
    } else {
      return undefined
    }
  }

  return value
}
export const applyTemplate = (
  template: any,
  payload: any = {},
  options = { leftWrap: '{{', rightWrap: '}}' },
): any => {
  const regex = new RegExp(`^${options.leftWrap}(.+)${options.rightWrap}$`)

  for (const i in template) {
    const templateEntry = regex.exec(template[i])
    const value = templateEntry
      ? getValueByPath(payload, templateEntry[1])
      : false

    if (templateEntry) {
      template[i] = structuredClone(value || null)
    } else if (template[i] && 'object' == typeof template[i]) {
      applyTemplate(template[i], payload)
    }
  }

  return template
}
