/**
 * Feed Entry Utilities — REMOVED IN PHASE 7
 *
 * This file has been removed. All feed functionality has been consolidated
 * into activityFeedStore.ts, which computes feed entries as projections
 * of gateway-native state.
 *
 * Migration Path:
 *   - Import feed hooks from: stores/activityFeedStore.ts
 *   - Use useFeedEntries() hook instead of synthetic entry creation
 *   - Feed is now read-only, computed from sessions/chat/tool stores
 *
 * @see src/stores/activityFeedStore.ts
 */

export const FEED_MODULE_REMOVED = 'Phase 7: Use activityFeedStore instead';
