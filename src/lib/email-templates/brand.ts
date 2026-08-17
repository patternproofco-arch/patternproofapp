// Shared PatternProof brand styling for auth emails.
// Palette: oxblood #7A1F3D, deep purple #4A2A6B, ink #1C1A22, paper #ffffff.
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Space Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const main = { backgroundColor: "#ffffff", fontFamily: SANS };

export const container = {
  padding: "32px 28px",
  maxWidth: "560px",
  margin: "0 auto",
  borderTop: "4px solid #7A1F3D",
};

export const h1 = {
  fontFamily: SERIF,
  fontSize: "26px",
  fontWeight: 600 as const,
  color: "#4A2A6B",
  lineHeight: "1.25",
  margin: "0 0 20px",
};

export const text = {
  fontSize: "15px",
  color: "#1C1A22",
  lineHeight: "1.6",
  margin: "0 0 22px",
};

export const link = { color: "#7A1F3D", textDecoration: "underline" };

export const button = {
  backgroundColor: "#7A1F3D",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600 as const,
  borderRadius: "10px",
  padding: "13px 24px",
  textDecoration: "none",
  display: "inline-block",
};

export const codeStyle = {
  fontFamily: "'Space Mono', Menlo, Consolas, monospace",
  fontSize: "30px",
  letterSpacing: "6px",
  fontWeight: 700 as const,
  color: "#4A2A6B",
  backgroundColor: "#F6F2F4",
  border: "1px solid #E4DAE0",
  borderRadius: "10px",
  padding: "16px 20px",
  margin: "0 0 26px",
  textAlign: "center" as const,
};

export const footer = {
  fontSize: "12px",
  color: "#6B6472",
  lineHeight: "1.6",
  margin: "32px 0 0",
  borderTop: "1px solid #EDE7EA",
  paddingTop: "16px",
};
