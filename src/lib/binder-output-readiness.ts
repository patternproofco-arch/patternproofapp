type RequiredRead = {
  isPending?: boolean;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  data?: unknown;
};

/** Never treat cached or partial data as a complete, current binder. */
export function binderOutputBlockReason(
  reads: RequiredRead[],
  changedNumberedItems: number,
): string | null {
  if (reads.some((read) => read.error || read.data == null)) {
    return "The binder is not complete. Reload all required records before copying or printing.";
  }
  if (reads.some((read) => read.isPending || read.isLoading || read.isFetching)) {
    return "Wait for every required binder read to finish before copying or printing.";
  }
  if (changedNumberedItems > 0) {
    return "Review changed items and save a new package version before copying or printing an updated binder.";
  }
  return null;
}
