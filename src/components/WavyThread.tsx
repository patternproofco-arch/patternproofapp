/** Decorative connecting thread. Big waves, charcoal ink, no persona gradient. */
export function WavyThread({
  className,
  orientation = "vertical",
}: {
  className?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const vertical =
    "M 24 0 C 48 40, 0 80, 24 120 C 48 160, 0 200, 24 240 C 48 280, 0 320, 24 360 C 48 400, 0 440, 24 480 C 48 520, 0 560, 24 600 C 48 640, 0 680, 24 720 C 48 760, 0 800, 24 840 C 48 880, 0 920, 24 960 C 48 1000, 0 1040, 24 1080 C 48 1120, 0 1160, 24 1200 C 48 1240, 0 1280, 24 1320 C 48 1360, 0 1400, 24 1440 C 48 1480, 0 1520, 24 1600";
  const horizontal =
    "M 0 20 C 80 52, 160 -12, 240 20 C 320 52, 400 -12, 480 20 C 560 52, 640 -12, 720 20 C 800 52, 880 -12, 960 20 C 1040 52, 1120 -12, 1200 20 C 1280 52, 1360 -12, 1440 20 C 1520 52, 1600 -12, 1680 20";

  if (orientation === "horizontal") {
    return (
      <svg
        className={className}
        aria-hidden="true"
        viewBox="0 0 1680 40"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: "40% 0 auto", height: 40, width: "100%", pointerEvents: "none", zIndex: 0 }}
      >
        <path d={horizontal} fill="none" stroke="var(--stitch, #2a2622)" strokeWidth="1.75" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 48 1600"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 8,
        width: 48,
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <path d={vertical} fill="none" stroke="var(--stitch, #2a2622)" strokeWidth="1.75" />
    </svg>
  );
}

export default WavyThread;
