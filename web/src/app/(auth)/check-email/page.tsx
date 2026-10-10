import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <p>Check your inbox and confirm your email to finish creating your account.</p>
      <p className="text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/login">Back to log in</Link>
      </p>
    </div>
  )
}
