/** Keeps math symbols (μ, σ, S_T) out of the uppercase `label` transform. */
export function Sym({ children }: { children: React.ReactNode }) {
  return <span className="font-display normal-case tracking-normal">{children}</span>;
}

export const ST = () => (
  <Sym>
    S<sub>T</sub>
  </Sym>
);
export const S0 = () => (
  <Sym>
    S<sub>0</sub>
  </Sym>
);
