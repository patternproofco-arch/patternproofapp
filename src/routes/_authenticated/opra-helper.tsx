import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, FileSearch, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/opra-helper")({
  component: OpraHelper,
});

const RECORD_TYPES = [
  "Police incident reports",
  "911 call recordings & CAD logs",
  "Body-worn camera footage",
  "Dispatch records",
  "Officer notes / supplemental reports",
  "Domestic violence offense reports",
  "Restraining order service records",
];

interface OpraRow {
  id: string;
  agency_name: string | null;
  status: string;
  created_at: string;
}

function OpraHelper() {
  const { user } = useAuth();
  const [agency, setAgency] = useState("");
  const [address, setAddress] = useState("");
  const [custodian, setCustodian] = useState("Records Custodian");
  const [types, setTypes] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [details, setDetails] = useState("");
  const [past, setPast] = useState<OpraRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("opra_requests")
        .select("id,agency_name,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setPast((data as OpraRow[] | null) ?? []);
    })();
  }, [user]);

  const toggle = (t: string) => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const letter = useMemo(() => {
    const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const range = start && end
      ? `from ${new Date(start).toLocaleDateString()} through ${new Date(end).toLocaleDateString()}`
      : start ? `on or after ${new Date(start).toLocaleDateString()}`
      : end ? `on or before ${new Date(end).toLocaleDateString()}`
      : "covering all dates on which responsive records exist";
    return `${today}

${custodian}
${agency || "[Agency Name]"}
${address || "[Agency Address]"}

Re: Open Public Records Act Request — N.J.S.A. 47:1A-1 et seq.

Dear ${custodian},

Pursuant to the New Jersey Open Public Records Act, I respectfully request copies of the following records, ${range}:

${(types.length ? types : ["[describe records]"]).map((t) => `  • ${t}`).join("\n")}

${details ? `Additional context: ${details}\n\n` : ""}If any portion of this request is denied, please cite the specific statutory exemption. If responsive records exist in electronic format, electronic delivery is preferred.

I understand that the agency has seven (7) business days to respond. Please advise if any fees apply before processing.

Thank you for your assistance.

Respectfully,
[Your Name]
[Your Address]
[Your Email / Phone]`;
  }, [custodian, agency, address, types, start, end, details]);

  const copy = async () => {
    await navigator.clipboard.writeText(letter);
    toast("Letter copied to clipboard.");
  };

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("opra_requests").insert({
      user_id: user.id,
      agency_name: agency || null,
      agency_address: address || null,
      custodian_title: custodian || null,
      record_types: types,
      date_range_start: start || null,
      date_range_end: end || null,
      additional_details: details || null,
      generated_letter: letter,
      status: "draft",
    });
    if (error) { toast("We couldn't save that. Try again in a moment."); return; }
    toast("Saved as draft.");
    const { data } = await supabase.from("opra_requests").select("id,agency_name,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setPast((data as OpraRow[] | null) ?? []);
  };

  return (
    <div>
      <div className="label-eyebrow">OPRA helper · New Jersey</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Request your <em>public records.</em>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Police reports, 911 audio, body-cam footage. NJ agencies must respond within seven business days.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card-pp space-y-4">
          <div>
            <label className="label-eyebrow">Agency</label>
            <input className="input-pp mt-1" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. Newark Police Department" />
          </div>
          <div>
            <label className="label-eyebrow">Agency address</label>
            <textarea className="input-pp mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label-eyebrow">Custodian title</label>
            <input className="input-pp mt-1" value={custodian} onChange={(e) => setCustodian(e.target.value)} />
          </div>
          <div>
            <div className="label-eyebrow mb-2">Records requested</div>
            <div className="flex flex-wrap gap-2">
              {RECORD_TYPES.map((t) => {
                const on = types.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggle(t)}
                    className="rounded-[2px] px-3 py-1 text-[12px] font-semibold"
                    style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--foreground)", border: "1.5px solid var(--accent)" }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow">From</label>
              <input type="date" className="input-pp mt-1" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label-eyebrow">To</label>
              <input type="date" className="input-pp mt-1" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-eyebrow">Anything else they should know? (optional)</label>
            <textarea className="input-pp mt-1" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="btn-primary inline-flex items-center gap-2"><Copy size={15} /> Copy letter</button>
            <button onClick={save} className="btn-ghost inline-flex items-center gap-2"><Save size={15} /> Save as draft</button>
          </div>
        </div>

        <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
          <div className="flex items-center gap-2"><FileSearch size={16} /><div className="label-eyebrow">Preview</div></div>
          <pre className="mt-3 whitespace-pre-wrap font-serif text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>{letter}</pre>
        </div>
      </div>

      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="font-serif text-[22px]">Your past requests</h2>
          <div className="mt-3 space-y-2">
            {past.map((r) => (
              <div key={r.id} className="card-pp flex items-center justify-between">
                <div>
                  <div className="font-serif text-[15px]">{r.agency_name ?? "(no agency)"}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <span className="rounded-[2px] px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--input)", color: "var(--foreground)" }}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}