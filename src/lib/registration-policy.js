const NON_DELIVERY_CODES = new Set(["SMTP_NOT_CONFIGURED", "SMTP_DISABLED", "EMAIL_DISABLED"]);

export function mayRegisterWithoutEmailConfirmation(error, managedAccount = false) {
  return !managedAccount && NON_DELIVERY_CODES.has(error?.code);
}
