import { describe, expect, it } from 'vitest'
import { configFromValues, initialValues, validateValues, valuesFromConfig } from './ParamFields'
import type { Skill } from '@/api/types'

const skill: Skill = {
  id: 'demo',
  name: '데모',
  summary: '',
  detail: '',
  category: '자동매매',
  trades: true,
  params: [
    { key: 'budget', label: '시드', type: 'NUMBER', defaultValue: 5000000, min: 100000, max: 1e12, required: true, unit: '원' },
    { key: 'stopLossPct', label: '손절', type: 'NUMBER', defaultValue: 4, min: 1, max: 30, required: true, unit: '%' },
    { key: 'requireFlow', label: '수급 필수', type: 'SELECT', defaultValue: 'OFF', options: [{ value: 'ON', label: '켬' }, { value: 'OFF', label: '끔' }], required: true },
    { key: 'note', label: '메모', type: 'TEXT', defaultValue: '', required: false },
    { key: 'agree', label: '동의', type: 'BOOLEAN', defaultValue: false, required: true },
  ],
}

describe('valuesFromConfig', () => {
  it('기본값 위에 저장된 설정값을 덮어쓴다', () => {
    const v = valuesFromConfig(skill, { budget: 7000000, requireFlow: 'ON', agree: true })
    expect(v.budget).toBe('7000000')
    expect(v.stopLossPct).toBe('4') // 저장돼 있지 않으면 기본값
    expect(v.requireFlow).toBe('ON')
    expect(v.agree).toBe(true)
  })

  it('설정이 없거나 null 이면 기본값 그대로', () => {
    expect(valuesFromConfig(skill, null)).toEqual(initialValues(skill))
    expect(valuesFromConfig(skill, { budget: null })).toEqual(initialValues(skill))
  })
})

describe('validateValues', () => {
  it('범위 안의 값은 통과한다', () => {
    expect(validateValues(skill, initialValues(skill))).toEqual({})
  })

  it('범위를 벗어나거나 숫자가 아니면 항목별 오류를 돌려준다', () => {
    const errors = validateValues(skill, { ...initialValues(skill), budget: '50', stopLossPct: '99' })
    expect(errors.budget).toContain('이상')
    expect(errors.stopLossPct).toContain('이하')
    expect(validateValues(skill, { ...initialValues(skill), budget: '' }).budget).toBeTruthy()
    expect(validateValues(skill, { ...initialValues(skill), stopLossPct: 'abc' }).stopLossPct).toBeTruthy()
  })

  it('숫자가 아닌 항목은 검사하지 않는다', () => {
    expect(validateValues(skill, { ...initialValues(skill), note: '' })).toEqual({})
  })
})

describe('configFromValues', () => {
  it('쉼표가 있는 금액도 숫자로 바꾸고 불리언은 그대로 둔다', () => {
    const c = configFromValues(skill, { budget: '7,000,000', stopLossPct: '3.5', requireFlow: 'ON', note: '  ', agree: true })
    expect(c.budget).toBe(7000000)
    expect(c.stopLossPct).toBe(3.5)
    expect(c.requireFlow).toBe('ON')
    expect(c.agree).toBe(true)
  })

  it('비어 있는 텍스트 항목은 보내지 않고, 있는 값은 앞뒤 공백을 지운다', () => {
    expect('note' in configFromValues(skill, { ...initialValues(skill), note: '   ' })).toBe(false)
    expect(configFromValues(skill, { ...initialValues(skill), note: ' 메모 ' }).note).toBe('메모')
  })
})
