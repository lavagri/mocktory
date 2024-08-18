import { applyTemplate } from '~/utils/json-template'

describe('json-template', () => {
  const multiTypeObj = {
    nameStr: 'test-name',
    boolValue: true,
    count: 123,
    date: new Date().toISOString(),
  }

  test('it leaves simple object as is', () => {
    expect(applyTemplate(multiTypeObj)).toEqual(multiTypeObj)
  })

  test('it leaves array of simple objects as is', () => {
    expect(applyTemplate([multiTypeObj, multiTypeObj])).toEqual([
      multiTypeObj,
      multiTypeObj,
    ])
  })

  test('it apply backing to simple object', () => {
    const backingObj = {
      s: 'test-name',
      b: true,
      n: 123,
      d: new Date().toISOString(),
    }

    const obj = {
      count: '{{backingObj.n}}',
      nameStr: '{{backingObj.s}}',
      boolValue: '{{backingObj.b}}',
      date: '{{backingObj.d}}',
      unknownVar: '{{backingObj.unknownVar}}',
      message: 'Some message text',
    }

    expect(applyTemplate(obj, { backingObj })).toEqual({
      count: backingObj.n,
      nameStr: backingObj.s,
      boolValue: backingObj.b,
      date: backingObj.d,
      unknownVar: null,
      message: obj.message,
    })
  })

  test('it apply backing to array of simple objects', () => {
    const backingObj = {
      s: 'test-name',
      b: true,
      n: 123,
      d: new Date().toISOString(),
    }

    const obj = {
      count: '{{backingObj.n}}',
      nameStr: '{{backingObj.s}}',
      boolValue: '{{backingObj.b}}',
      date: '{{backingObj.d}}',
      unknownVar: '{{backingObj.unknownVar}}',
      message: 'Some message text',
    }

    const expectedObjRes = {
      count: backingObj.n,
      nameStr: backingObj.s,
      boolValue: backingObj.b,
      date: backingObj.d,
      unknownVar: null,
      message: obj.message,
    }

    expect(applyTemplate([obj, obj], { backingObj })).toEqual([
      expectedObjRes,
      expectedObjRes,
    ])
  })
})
