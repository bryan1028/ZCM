"use client";

import { useFormStatus } from "react-dom";

// A submit button that reacts the instant it's pressed: it shows a spinner and ignores further taps until the
// server has answered, so slow connections never look like "nothing happened" (and nobody double-submits).
// Like ActionButton, it deliberately has no name/value: Next's bundled React drops those from the form data.
export default function Submit({ children, className, style, disabled, ...rest }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "name" | "value" | "type" | "formAction">) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={className} style={style} disabled={pending || disabled} aria-busy={pending}>
      {children}
    </button>
  );
}
