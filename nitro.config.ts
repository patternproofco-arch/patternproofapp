// Auto-loaded by Nitro itself (via c12, name: "nitro") independently of
// @lovable.dev/vite-tanstack-config's `nitro` option — that wrapper's option
// type is deliberately narrow and doesn't expose `plugins`, so this file is
// the sanctioned way to register Nitro plugins for this app. See
// nitro-plugins/email-cron.ts for what this wires up.
export default {
  plugins: ["./nitro-plugins/email-cron.ts"],
};
