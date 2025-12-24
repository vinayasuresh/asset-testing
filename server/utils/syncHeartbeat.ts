// server/utils/syncHeartbeat.ts
let lastSyncAt: Date = new Date();
let revision = 0;

/** Call this when a sync finishes with at least one change */
export function markSyncChanged() {
  revision += 1;
  lastSyncAt = new Date();
}

/** Call this when a sync runs but nothing changed */
export function markSyncTick() {
  lastSyncAt = new Date();
}

export function getSyncStatus() {
  return { lastSyncAt, revision };
}
