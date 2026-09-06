import { SettingsProvider } from "@/lib/settings-context";
import { QuickExitButton } from "@/components/QuickExitButton";

/**
 * Quick Exit for public, pre-login pages. Wraps the same button used inside
 * the signed-in app in a settings provider so a saved exit destination is
 * honored, without applying the signed-in disguise title to marketing pages.
 *
 * Default dock is the top-right corner (not mid-header) so the control never
 * covers the wordmark / hero on mobile. Uses its own position storage key.
 */
export function PublicQuickExit() {
  return (
    <SettingsProvider applyDisguiseTitle={false}>
      <QuickExitButton defaultPosition={{ right: 12, top: 12 }} storageKey="pp.exit.pos.public" />
    </SettingsProvider>
  );
}
