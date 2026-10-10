// A button that runs a server action with fixed values, e.g. <ActionButton action={review} fields={{ id, status: "verified" }}>Verify</ActionButton>.
//
// WHY THIS EXISTS: Next 15 ships its own copy of React, which builds a form action's FormData *without* the clicked
// button. So a submit button that relies on its own name/value silently loses the value and the action does nothing.
// Every button that needs a value therefore gets its own small form with hidden inputs. (CI enforces this:
// scripts/check-buttons.sh fails if a button with a name attribute appears in src/.)
import Submit from "./submit-button";

export default function ActionButton({ action, fields, children, className }: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form action={action} style={{ display: "contents" }}>
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <Submit className={className}>{children}</Submit>
    </form>
  );
}
