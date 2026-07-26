type UserWithAppMetadata = {
  app_metadata?: Record<string, unknown>;
} | null | undefined;

export const hasAdminRole = (user: UserWithAppMetadata): boolean => {
  const role = user?.app_metadata?.role;
  const roles = user?.app_metadata?.roles;

  return (
    role === "admin" ||
    (Array.isArray(roles) && roles.some((value) => value === "admin"))
  );
};
