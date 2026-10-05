import { describe, expect, it } from 'vitest'
import {
  STEP_ORDER,
  WEEKDAY_LABELS,
  getStep,
  optionLabel,
  validateAnswers,
  type QuizAnswers,
} from './definition'
import { TEMPLATES } from './build-plan'

const valid = {
  area: 'saude',
  foco: 'correr',
  prazo: 3,
  dias: ['seg', 'qua'],
  obstaculo: 'tempo',
}

describe('quiz definition', () => {
  it('lists the five steps in order', () => {
    expect(STEP_ORDER).toEqual(['area', 'foco', 'prazo', 'dias', 'obstaculo'])
  })

  it('has a template for every focus of every area', () => {
    for (const area of ['saude', 'estudos', 'financas', 'carreira'] as const) {
      const focos = getStep('foco', { area }).options.map((o) => o.id)
      expect(focos.length).toBeGreaterThanOrEqual(3)
      for (const foco of focos) {
        const template = TEMPLATES[foco as keyof typeof TEMPLATES]
        expect(template, foco).toBeDefined()
        expect(template.tasks.length).toBeGreaterThanOrEqual(3)
        expect(template.shortTasks.length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('branches the foco step by area', () => {
    const step = getStep('foco', { area: 'estudos' })
    expect(step.title).toBe('Nos estudos, qual é o seu foco?')
    expect(step.options.map((o) => o.id)).toEqual(['leitura', 'idioma', 'curso'])
    expect(getStep('foco', { area: 'saude' }).options).toHaveLength(4)
  })

  it('marks only dias as multiple and exposes weekday labels', () => {
    expect(getStep('dias', {}).multiple).toBe(true)
    expect(getStep('area', {}).multiple).toBe(false)
    expect(getStep('prazo', {}).options.map((o) => o.id)).toEqual(['1', '3', '6', '12'])
    expect(WEEKDAY_LABELS.seg).toBe('Seg')
    expect(WEEKDAY_LABELS.dom).toBe('Dom')
  })

  it('resolves option labels', () => {
    expect(optionLabel('area', 'saude')).toBe('Saúde e corpo')
    expect(optionLabel('foco', 'idioma')).toBe('Aprender um idioma')
    expect(optionLabel('prazo', 12)).toBe('1 ano')
    expect(optionLabel('dias', 'sex')).toBe('Sex')
  })

  it('accepts a full valid set, de-duplicated and in week order', () => {
    const answers: QuizAnswers = validateAnswers({
      ...valid,
      dias: ['sab', 'seg', 'sab', 'qua'],
    })
    expect(answers.dias).toEqual(['seg', 'qua', 'sab'])
    expect(answers.prazo).toBe(3)
  })

  it.each([
    ['a missing step', { ...valid, obstaculo: undefined }],
    ['a focus from another area', { ...valid, area: 'saude', foco: 'idioma' }],
    ['no days', { ...valid, dias: [] }],
    ['an unknown weekday', { ...valid, dias: ['seg', 'xyz'] }],
    ['an invalid prazo', { ...valid, prazo: 2 }],
    ['an unknown obstacle', { ...valid, obstaculo: 'preguica' }],
    ['null', null],
    ['a string', 'oi'],
    ['an array', []],
  ])('rejects %s', (_name, input) => {
    expect(() => validateAnswers(input)).toThrow('Respostas inválidas')
  })
})
