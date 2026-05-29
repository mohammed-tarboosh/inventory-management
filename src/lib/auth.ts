const USERNAME_PATTERN = /^[a-zA-Z0-9_.\-]+$/;

export function resolveAuthEmail(identifier: string) {
  const value = identifier.trim();

  if (!value) {
    return { email: "", error: "" };
  }

  if (value.includes("@")) {
    return { email: value.toLowerCase(), error: "" };
  }

  if (!USERNAME_PATTERN.test(value)) {
    return {
      email: "",
      error: "Username can only contain letters, numbers, dots, underscores, and hyphens.",
    };
  }

  return { email: `${value.toLowerCase()}@inv.local`, error: "" };
}