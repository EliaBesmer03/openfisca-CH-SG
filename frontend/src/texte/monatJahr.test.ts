import { describe, expect, it } from 'vitest'
import { monatJahrAusText } from './format'

describe('monatJahrAusText', () => {
  it('liest Monat und Jahr im Schweizer Format', () => {
    expect(monatJahrAusText('03.2025')).toBe('2025-03')
    expect(monatJahrAusText('3.2025')).toBe('2025-03')
    expect(monatJahrAusText(' 12 / 2027 ')).toBe('2027-12')
  })
  it('lehnt unvollständige oder ungültige Eingaben ab', () => {
    expect(monatJahrAusText('03.25')).toBeNull()
    expect(monatJahrAusText('13.2025')).toBeNull()
    expect(monatJahrAusText('2025-03')).toBeNull()
    expect(monatJahrAusText('')).toBeNull()
  })
})
