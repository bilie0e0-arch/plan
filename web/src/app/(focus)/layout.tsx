/** Focus Mode is full-screen: no sidebar, minimal stimulation (DESIGN §13.5). */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <div className="focus-bg min-h-dvh text-[#EEF2F0]">{children}</div>
}
