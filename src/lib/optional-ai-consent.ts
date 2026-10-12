/** No retention/training promises: those belong to the provider-policy review. */
export function confirmOptionalAiProcessing(): boolean {
  return window.confirm(
    "This sends the selected file to an outside AI provider for a software suggestion. " +
      "You can save and review it manually instead. Do you want to continue?",
  );
}
