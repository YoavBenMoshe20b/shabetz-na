// supabaseAuth.ts — Phone-OTP primitives for Supabase Auth.
//
// Phase 1 ships these primitives but the LoginPage still uses the
// mock flow by default. To opt in, set VITE_USE_SUPABASE=true and have
// the LoginPage call requestOtp / verifyOtp instead of signIn().
//
// The full LoginPage migration is intentionally Phase 2 work — it
// requires:
//   1. A configured Twilio (or other SMS provider) in the Supabase project
//   2. UX changes (two-step OTP flow vs single phone+password)
//   3. Claim flow integration (after first OTP success, link to soldier
//      slot via phone + idLast4)
//
// These primitives are written now so Phase 2 starts with a known API.

import { supabase, USE_SUPABASE } from '../api/_supabase';

export interface OtpRequestResult {
  ok: boolean;
  error?: string;
}

export interface OtpVerifyResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

/**
 * Send a one-time code to the user's phone. Supabase routes via the
 * configured SMS provider (Twilio / MessageBird / etc.).
 *
 * Phone format: E.164 with country code, e.g. "+972501234567".
 * Callers can convert from local "0501234567" via toE164Israeli().
 */
export async function requestOtp(phoneE164: string): Promise<OtpRequestResult> {
  if (!USE_SUPABASE) return { ok: false, error: 'Supabase not enabled' };
  const { error } = await supabase().auth.signInWithOtp({ phone: phoneE164 });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Verify the 6-digit code the user received. On success a session is
 * persisted and the trigger in 0001_identity.sql creates a profile row.
 */
export async function verifyOtp(phoneE164: string, code: string): Promise<OtpVerifyResult> {
  if (!USE_SUPABASE) return { ok: false, error: 'Supabase not enabled' };
  const { data, error } = await supabase().auth.verifyOtp({
    phone: phoneE164,
    token: code,
    type: 'sms',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data.user?.id };
}

export async function signOut(): Promise<void> {
  if (!USE_SUPABASE) return;
  await supabase().auth.signOut();
}

/**
 * Convert "0501234567" → "+972501234567". The DB stores phones with
 * a leading 0; this is only for Supabase Auth.
 */
export function toE164Israeli(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  if (digits.startsWith('972')) return `+${digits}`;
  return localPhone;
}
