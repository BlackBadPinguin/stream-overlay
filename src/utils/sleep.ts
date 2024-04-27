/**
 * Pauses the execution for a specified amount of time.
 * @param timeInMillis - The duration to sleep in milliseconds. Default is 1000 milliseconds (1 second).
 * @returns A Promise that resolves after the specified time has elapsed.
 */
export function sleep(timeInMillis = 1000) {
  return new Promise((res) => setTimeout(res, timeInMillis));
}
