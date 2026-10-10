// Shared maths for the 270° speedometer dials: 0 sits bottom-left, 1 bottom-right, sweeping clockwise.

export const dialAngle = (f: number) => 135 + 270 * f

export function dialPoint(cx: number, cy: number, r: number, f: number): [number, number] {
  const a = (dialAngle(f) * Math.PI) / 180
  // Rounded so server and browser render identical SVG (float maths can differ in the last digit).
  return [round2(cx + r * Math.cos(a)), round2(cy + r * Math.sin(a))]
}

export function dialArc(cx: number, cy: number, r: number, f0: number, f1: number): string {
  const end = Math.max(f0 + 0.0001, Math.min(1, f1))
  const [x0, y0] = dialPoint(cx, cy, r, f0)
  const [x1, y1] = dialPoint(cx, cy, r, end)
  return `M${x0} ${y0} A${r} ${r} 0 ${270 * (end - f0) > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

const round2 = (n: number) => Math.round(n * 100) / 100
