import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";

const PLAN_COST = 297;
const TIME_SAVED_PCT = 0.7; // PatternProof recovers 70% of manual hours

export function calcAttorneyROI(input: {
  clients: number;
  hoursPerClient: number;
  hourlyValue: number;
  revenuePerClient: number;
}) {
  const monthlyHoursLost = input.clients * input.hoursPerClient;
  const hoursRecovered = monthlyHoursLost * TIME_SAVED_PCT;
  const valueRecovered = hoursRecovered * input.hourlyValue;
  const additionalCapacity = input.hoursPerClient > 0 ? hoursRecovered / input.hoursPerClient : 0;
  const monthlyROI = valueRecovered - PLAN_COST;
  return { monthlyHoursLost, hoursRecovered, valueRecovered, additionalCapacity, monthlyROI };
}

export function AttorneyROICalculator() {
  const [clients, setClients] = useState(8);
  const [hours, setHours] = useState(5);
  const [rate, setRate] = useState(250);
  const [revenue, setRevenue] = useState(3500);

  const out = useMemo(
    () => calcAttorneyROI({ clients, hoursPerClient: hours, hourlyValue: rate, revenuePerClient: revenue }),
    [clients, hours, rate, revenue]
  );
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const usd = (n: number) => `$${fmt(Math.max(0, n))}`;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 24,
        padding: 32,
        color: "#14171F",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 8 }}>
          Attorney savings calculator
        </div>
        <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
          See what disorganized evidence is costing your firm.
        </h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 32 }}>
        <SliderInput label="Clients per month" value={clients} min={1} max={50} step={1} onChange={setClients} display={fmt(clients)} />
        <SliderInput label="Manual evidence hours / client" value={hours} min={1} max={20} step={1} onChange={setHours} display={`${hours} hrs`} />
        <SliderInput label="Billable / admin hourly value" value={rate} min={50} max={800} step={25} onChange={setRate} display={usd(rate)} />
        <SliderInput label="Avg. revenue per client / mo" value={revenue} min={500} max={20000} step={250} onChange={setRevenue} display={usd(revenue)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Stat label="Monthly hours lost" value={`${fmt(out.monthlyHoursLost)} hrs`} />
        <Stat label="Hours recovered" value={`${fmt(out.hoursRecovered)} hrs`} highlight />
        <Stat label="Value of recovered time" value={usd(out.valueRecovered)} highlight />
        <Stat label="Additional case capacity" value={`${out.additionalCapacity.toFixed(1)} clients`} />
        <Stat label="Monthly ROI (net of $297)" value={usd(out.monthlyROI)} highlight />
      </div>

      <p style={{ marginTop: 20, fontSize: 13, color: "var(--muted-foreground)" }}>
        Estimate assumes PatternProof recovers ~70% of manual evidence-organization time.
      </p>
    </div>
  );
}

function SliderInput({
  label, value, min, max, step, onChange, display,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; display: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "#14171F" }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--teal-dark)" }}>{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0] ?? min)} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: highlight ? "linear-gradient(135deg, rgba(47,141,133,0.10), rgba(124,92,196,0.10))" : "#F4F5F9",
        border: highlight ? "1px solid rgba(47,141,133,0.30)" : "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#14171F", letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}