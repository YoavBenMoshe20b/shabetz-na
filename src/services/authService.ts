// Authentication is mocked in this MVP and must be replaced with
// Firebase Auth or another secure auth provider before production.
import { mockUsers } from '../data/mockData';
import type { MockUser } from '../types';

export function mockLogin(identifier: string, password: string): MockUser | null {
  const clean = identifier.trim().toLowerCase();
  return (
    mockUsers.find(
      (u) =>
        (u.email.toLowerCase() === clean || u.username.toLowerCase() === clean) &&
        u.password === password
    ) ?? null
  );
}

// Password rules:
// - min 8 characters
// - at least one uppercase letter (A-Z)
// - at least one lowercase letter (a-z)
// - at least one digit
// - at least one special character
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

// Username rules: min 3 chars, English letters/numbers only, no spaces
export function validateUsername(u: string): boolean {
  return /^[a-zA-Z0-9]{3,}$/.test(u);
}
