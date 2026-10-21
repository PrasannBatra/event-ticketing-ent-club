// Open decision #7 in the plan: may one student buy more than one ticket per event in V1?
// Flip this number once the team decides. The UI follows it.
export const MAX_TICKETS_PER_EVENT = 1;

export const PRODUCT_NAME = "Ashoka Events";
export const STUDENT_EMAIL_DOMAIN = "ashoka.edu.in";

// Manual payment: shown on the checkout page. Set these before launch.
export const PAYMENT_PAYEE = process.env.NEXT_PUBLIC_PAYEE_NAME ?? "Entrepreneurship Club";
export const PAYMENT_UPI_ID = process.env.NEXT_PUBLIC_UPI_ID ?? "your-club@upi";

export function isAshokaEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@" + STUDENT_EMAIL_DOMAIN);
}
