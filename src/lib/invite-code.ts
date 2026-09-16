/**
 * Shared invite code required to create a new account on the "Set up your PIN" screen.
 * Change this single value to rotate the code. Existing users logging in are unaffected.
 */
export const INVITE_CODE = "DESK-2026";

export function isValidInviteCode(input: string) {
  return input.trim().toUpperCase() === INVITE_CODE.toUpperCase();
}
