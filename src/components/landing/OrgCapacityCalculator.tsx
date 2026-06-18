import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";

export function calcOrgCapacity(input: {
  survivors: number;
  hoursPerSurvivor: number;
  advocateRate: number;
  timeSavedPct: number;
}) {
  const totalHours = input.survivors * input.hoursPerSurvivor;
  const hoursSaved = totalHours * (input.timeSavedPct / 100);
  const valueRecovered = hoursSaved * input.advocateRate;
  const additionalSurvivors = input.hoursPerSurvivor > 0 ? hoursSaved / input.hoursPerSurvivor : 0;
  const handoffReadiness = Math.min(100, 40 + input.timeSavedPct * 0.7); // qualitative %
  return { totalHours, hoursSaved, valueRecovered, additionalSurvivors, handoffReadiness };
}

export function OrgCapacityCalculator() {
  const [survivors, setSurvivors] = useState(40);
  const [hours, setHours] = useState(3);
  const [rate, setRate] = useState(45);
  const [saved, setSaved] = useState(60);

  const out = useMemo(
    () => calcOrgCapacity({ survivors, hoursPerSurvivor: hours, advocateRate: rate, timeSavedPct: saved }),
    [survivors, hours, rate, saved]
  );
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const usd = (n: number) => `$${fmt(n)}`;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 24,
        padding: 32,
        border: "1px solid var(--border)",
        boxShadow: "0 10px 40px rgba(61,114,184,0.10)",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 8 }}>
          Advocate capacity calculator
        </div>
        <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
          See the capacity you could give back to your team.
        </h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 32 }}>
        <Field label="Survivors served / month" v={fmt(survivors)}>
          <Slider value={[survivors]} min={5} max={500} step={5} onValueChange={(v) => setSurvivors(v[0] ?? 5)} />
        </Field>
        <Field label="Intake / documentation hours / survivor" v={`${hours} hrs`}>
          <Slider value={[hours]} min={1} max={10} step={1} onValueChange={(v) => setHours(v[0] ?? 1)} />
        </Field>
        <Field label="Advocate hourly cost" v={usd(rate)}>
          <Slider value={[rate]} min={20} max={120} step={5} onValueChange={(v) => setRate(v[0] ?? 20)} />
        </Field>
        <Field label="Estimated time saved with PatternProof" v={`${saved}%`}>
          <Slider value={[saved]} min={20} max={90} step={5} onValueChange={(v) => setSaved(v[0] ?? 20)} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Stat label="Monthly advocate hours saved" value={`${fmt(out.hoursSaved)} hrs`} highlight />
        <Stat label="Operating value recovered" value={usd(out.valueRecovered)} highlight />
        <Stat label="Additional survivor capacity" value={`${fmt(out.additionalSurvivors)} survivors`} />
        <Stat label="Cleaner handoff to legal aid" value={`${fmt(out.handoffReadiness)}%`} />
      </div>
    </div>
  );
}

function Field({ label, v, children }: { label: string; v: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 700 }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#3D72B8" }}>{v}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: highlight ? "linear-gradient(135deg, rgba(61,114,184,0.10), rgba(158,216,208,0.10))" : "#F4F5F9",
        border: highlight ? "1px solid rgba(61,114,184,0.30)" : "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}