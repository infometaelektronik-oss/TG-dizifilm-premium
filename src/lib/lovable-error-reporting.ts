/**
 * Application & System Error Logger
 * Persists runtime errors and warnings directly into the system audit trail.
 */
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error("[SystemError]", errMsg, context);

  // Safely record to audit logs if running in browser
  if (typeof window !== "undefined") {
    try {
      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client.error",
          level: "error",
          source: "client",
          message: `${errMsg} (context: ${JSON.stringify(context)})`,
        }),
      }).catch(() => {});
    } catch {
      // Ignore network failures for error reporter
    }
  }
}
