// Auth in this MVP is roster-first: identities exist before users open the
// app, and users only CLAIM their existing slot. The actual claim / sign-in /
// transfer logic lives in AppContext. This module is reduced to the password
// rules — the one piece of validation shared between forms.
//
// To replace with a real auth provider (Firebase Auth, etc.): swap the
// matching predicates in AppContext, keep this file as-is.

export interface PasswordValidation {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function validatePassword(pw: string): PasswordValidation {
  return {
    minLength:  pw.length >= 8,
    hasUpper:   /[A-Z]/.test(pw),
    hasLower:   /[a-z]/.test(pw),
    hasNumber:  /[0-9]/.test(pw),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  };
}

export function isPasswordValid(v: PasswordValidation): boolean {
  return v.minLength && v.hasUpper && v.hasLower && v.hasNumber && v.hasSpecial;
}

// Israeli phone: 10 digits, starts with 05 (mobile) or 0 + 1–2 digit area
export function validatePhone(p: string): boolean {
  const clean = p.replace(/\D/g, '');
  return clean.length === 10 && clean.startsWith('0');
}

// Last 4 of ת"ז: exactly 4 digits
export function validateIdLast4(s: string): boolean {
  return /^\d{4}$/.test(s.trim());
}
