import { SettingsProvider } from "@/lib/settings-context";
import { QuickExitButton } from "@/components/QuickExitButton";

/**
 * Quick Exit for public, pre-login pages. Wraps the same button used inside
 * the signed-in app in a settings provider so a saved exit destination is
 * honored, without applying the signed-in disguise title to marketing pages.
 */
export function PublicQuickExit() {
  return (
    <SettingsProvider applyDisguiseTitle={false}>
      <QuickExitButton />
    </SettingsProvider>
  );
}
