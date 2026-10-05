import { cloneElement, isValidElement, useId, type CSSProperties, type ReactElement, type ReactNode } from "react";

/**
 * A visible label tied to its control, so the field has a name a screen reader announces and
 * clicking the label focuses it. A single input, textarea or select is linked directly. Anything else
 * (a row of choice buttons, say) is wrapped as a group named by the label.
 */
export function FormField({
  label,
  children,
  className,
  labelClassName = "label-eyebrow mb-1 block",
  labelStyle,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
}) {
  const uid = useId();
  if (isValidElement(children) && typeof children.type === "string" && ["input", "textarea", "select"].includes(children.type)) {
    const el = children as ReactElement<{ id?: string }>;
    const id = el.props.id ?? uid;
    return (
      <div className={className}>
        <label htmlFor={id} className={labelClassName} style={labelStyle}>
          {label}
        </label>
        {cloneElement(el, { id })}
      </div>
    );
  }
  const labelId = `${uid}-label`;
  return (
    <div className={className} role="group" aria-labelledby={labelId}>
      <div id={labelId} className={labelClassName} style={labelStyle}>
        {label}
      </div>
      {children}
    </div>
  );
}
