/** A small key hint on a button, e.g. <Kbd>Enter ↵</Kbd>. Hidden on touch screens where there is no keyboard. */
export function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd aria-hidden className={`ml-1.5 hidden rounded-md border border-current/35 px-1.5 py-px font-sans text-[10px] font-extrabold leading-4 opacity-70 [@media(pointer:fine)]:inline-block ${className}`}>
      {children}
    </kbd>
  )
}
