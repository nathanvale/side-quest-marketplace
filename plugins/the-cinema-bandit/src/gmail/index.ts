/**
 * Gmail API integration for the-cinema-bandit.
 *
 * Public API for Gmail authentication and email sending.
 */

export { isTokenExpired, loadCredentials, loadToken, saveToken } from "./auth";
export type { EmailMessage } from "./send";
export { sendEmail, sendTicketEmail } from "./send";
export type { GmailCredentials, GmailToken } from "./types";
export { GmailAuthError, GmailSendError } from "./types";
