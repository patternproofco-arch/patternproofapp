/**
 * Locked Paper & Ink primitives for new screens. Values only — no shadows,
 * radius capped at 3px, paper ground, hairline rules.
 */
import type { CSSProperties } from "react";

export const folio = {
  page: {
    background: "var(--paper)",
    color: "var(--ink)",
    padding: "32px 20px 64px",
    maxWidth: 960,
    margin: "0 auto",
  } as CSSProperties,
  eyebrow: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
  } as CSSProperties,
  h1: {
    fontFamily: "Newsreader, Georgia, serif",
    fontSize: 30,
    lineHeight: 1.15,
    margin: "8px 0 10px",
    maxWidth: 640,
    fontWeight: 500,
  } as CSSProperties,
  h2: {
    fontFamily: "Newsreader, Georgia, serif",
    fontSize: 19,
    fontWeight: 500,
    margin: "0 0 10px",
  } as CSSProperties,
  lede: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--ink-muted)",
    maxWidth: 640,
    margin: "0 0 28px",
  } as CSSProperties,
  card: {
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--paper)",
    padding: 20,
    boxShadow: "none",
  } as CSSProperties,
  rule: { border: 0, borderTop: "1px solid var(--rule)", margin: "24px 0" } as CSSProperties,
  label: {
    display: "block",
    fontSize: 12,
    letterSpacing: "0.04em",
    color: "var(--ink-muted)",
    marginBottom: 4,
  } as CSSProperties,
  input: {
    width: "100%",
    padding: "9px 10px",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--paper)",
    color: "var(--ink)",
    fontSize: 14,
    fontFamily: "inherit",
  } as CSSProperties,
  btn: {
    padding: "9px 14px",
    border: "1px solid var(--ink)",
    borderRadius: 3,
    background: "var(--ink)",
    color: "var(--paper)",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  } as CSSProperties,
  btnQuiet: {
    padding: "8px 12px",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "transparent",
    color: "var(--ink)",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  } as CSSProperties,
  mono: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 12,
    color: "var(--ink-muted)",
  } as CSSProperties,
} as const;
