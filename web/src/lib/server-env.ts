import 'server-only'
import { z } from 'zod'

const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  PASSWORD_BREACH_CHECK: z.enum(['on', 'off']).default('on'),
})

export const serverEnv = schema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  PASSWORD_BREACH_CHECK: process.env.PASSWORD_BREACH_CHECK || undefined,
})
