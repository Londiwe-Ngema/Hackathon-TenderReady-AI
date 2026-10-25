/** An error whose message is safe and useful to show the hub advisor (surfaced as the tender's statusReason). */
export class UserFacingError extends Error {
  name = "UserFacingError";
}
