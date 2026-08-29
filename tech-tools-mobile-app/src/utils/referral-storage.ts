// ============================================
// Referral-link attribution storage
// ============================================
// Mobile equivalent of e-commerce-web-store's src/utils/referral-cookie.ts.
// There are no browser cookies here -- AsyncStorage is this app's
// equivalent (same store cartStore.ts/wishlistStore.ts already persist
// to), so the referral code and visitor id are read/written there
// instead. The only real difference from the web version: every call is
// async (AsyncStorage has no synchronous API), so callers must await
// these instead of calling them inline.
//
// Same 30-day attribution window and same "necessary, not gated behind
// any consent toggle" treatment as the web cookie -- this app has no
// cookie-consent banner at all, so there's nothing to gate against.

import AsyncStorage from '@react-native-async-storage/async-storage'

const REFERRAL_CODE_KEY = 'techtools_referral_code'
const REFERRAL_SET_AT_KEY = 'techtools_referral_set_at'
const VISITOR_ID_KEY = 'techtools_visitor_id'
const REFERRAL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days, matches the program's attribution window

export async function getReferralCode(): Promise<string | null> {
  const [code, setAt] = await Promise.all([
    AsyncStorage.getItem(REFERRAL_CODE_KEY),
    AsyncStorage.getItem(REFERRAL_SET_AT_KEY),
  ])
  if (!code || !setAt) return null

  const age = Date.now() - Number(setAt)
  if (Number.isNaN(age) || age > REFERRAL_MAX_AGE_MS) {
    // Expired -- clean up rather than silently keep serving a stale code.
    await Promise.all([
      AsyncStorage.removeItem(REFERRAL_CODE_KEY),
      AsyncStorage.removeItem(REFERRAL_SET_AT_KEY),
    ])
    return null
  }
  return code
}

/** Last-click wins: a new deep-link open overwrites any existing code and
 * restarts the 30-day window. */
export async function setReferralCode(code: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(REFERRAL_CODE_KEY, code.trim().toUpperCase()),
    AsyncStorage.setItem(REFERRAL_SET_AT_KEY, String(Date.now())),
  ])
}

export async function getOrCreateVisitorId(): Promise<string> {
  const existing = await AsyncStorage.getItem(VISITOR_ID_KEY)
  if (existing) return existing
  const id = `v-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await AsyncStorage.setItem(VISITOR_ID_KEY, id)
  return id
}
