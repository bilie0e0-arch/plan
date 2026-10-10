import { describe, expect, it } from 'vitest'
import { passwordSchema, signupSchema, usernameSchema } from './validation'

describe('auth validation', () => {
  it('normalises usernames and rejects bad ones', () => {
    expect(usernameSchema.parse('  Harshit_96 ')).toBe('harshit_96')
    for (const bad of ['ab', 'a'.repeat(21), 'has space', 'dash-name']) {
      expect(usernameSchema.safeParse(bad).success).toBe(false)
    }
    expect(usernameSchema.safeParse('Admin').error?.issues[0]?.message).toBe('That username is reserved.')
  })
  it('uses length, not complexity, for passwords', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('aaaaaaaaaaaa').success).toBe(true)
  })
  it('validates timezones including legacy aliases', () => {
    const base = { username: 'harshit', email: 'h@example.com', password: 'correct-horse' }
    expect(signupSchema.parse(base).timezone).toBe('UTC')
    expect(signupSchema.safeParse({ ...base, timezone: 'Asia/Calcutta' }).success).toBe(true)
    expect(signupSchema.safeParse({ ...base, timezone: 'Mars/Base' }).success).toBe(false)
  })
})
