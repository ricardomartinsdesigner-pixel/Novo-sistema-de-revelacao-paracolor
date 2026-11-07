export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 160;

export function isAllowedCustomerPassword(value) {
  return typeof value === "string"
    && value.length >= CUSTOMER_PASSWORD_MIN_LENGTH
    && value.length <= CUSTOMER_PASSWORD_MAX_LENGTH;
}
