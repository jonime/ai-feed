export function getAppAccessRedirect(isVerifiedUser: boolean): "/login" | null {
  if (!isVerifiedUser) return "/login";
  return null;
}
