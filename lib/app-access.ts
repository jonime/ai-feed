export function getAppAccessRedirect(
  isVerifiedUser: boolean,
  isAllowed: boolean,
): "/login" | "/no-access" | null {
  if (!isVerifiedUser) return "/login";
  if (!isAllowed) return "/no-access";
  return null;
}
