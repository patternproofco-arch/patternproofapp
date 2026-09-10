import { WavyThread } from "@/components/WavyThread";

export type ThreadPersona = "survivor" | "attorney" | "org" | "shared";

interface ThreadConnectorProps {
  persona?: ThreadPersona;
  orientation?: "vertical" | "horizontal" | "vertical-behind";
  className?: string;
  style?: React.CSSProperties;
}

export function ThreadConnector({
  orientation = "vertical",
  className,
}: ThreadConnectorProps) {
  return (
    <WavyThread
      className={className}
      orientation={orientation === "horizontal" ? "horizontal" : "vertical"}
    />
  );
}

export function ThreadGroup({
  className,
  style,
  children,
  orientation = "horizontal",
}: {
  persona?: ThreadPersona;
  orientation?: "horizontal" | "vertical-behind";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className={["pp-thread-group", className].filter(Boolean).join(" ")} style={{ position: "relative", ...style }}>
      <ThreadConnector orientation={orientation === "vertical-behind" ? "vertical" : "horizontal"} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

export default ThreadConnector;
