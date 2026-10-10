import { z } from 'zod'

export const RESERVED_USERNAMES: readonly string[] = ['admin', 'root', 'support', 'api', 'www', 'help', 'system', 'plan']

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username: 3–20 characters — lowercase letters, digits or _.')
  .refine((u) => !RESERVED_USERNAMES.includes(u), 'That username is reserved.')

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')

export const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('Enter a valid email.'),
  password: passwordSchema,
  timezone: z.string().default('UTC').refine(isValidTimeZone, 'Unknown timezone.'),
})
