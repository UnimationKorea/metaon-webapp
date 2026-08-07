const DEFAULT_LEARN_EVENT_APP_VERSION = "3.2.1";

/**
 * This value is captured when an Activity starts, so a queued batch is always
 * attributed to the build that produced it even if it is delivered later.
 */
export function learnEventAppVersion(): string {
  const configured = import.meta.env.VITE_METAON_CLIENT_APP_VERSION?.trim();
  return configured || DEFAULT_LEARN_EVENT_APP_VERSION;
}
