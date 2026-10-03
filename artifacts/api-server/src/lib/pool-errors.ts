type PoolEvents = {
  on(event: "error", listener: (error: unknown) => void): unknown;
};

type ErrorLogger = {
  error(fields: { code: string }, message: string): unknown;
};

export function registerIdlePoolErrorHandler(pool: PoolEvents, logger: ErrorLogger): void {
  pool.on("error", error => {
    // pg-pool already removes the failed idle client. Handle its emitted event
    // without swallowing query failures or logging client/connection details.
    const rawCode = error && typeof error === "object" && "code" in error ? error.code : null;
    const code = typeof rawCode === "string" && /^[A-Z0-9_]{1,20}$/.test(rawCode) ? rawCode : "unknown";
    logger.error({ code }, "Idle database connection failed; discarded client removed by pool");
  });
}