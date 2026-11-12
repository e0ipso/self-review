/** Native menu callbacks have no promise consumer. Contain action and reporter failures locally. */
export async function runMenuAction(
  action: () => void | Promise<unknown>,
  reportFailure: (error: unknown) => void | Promise<unknown>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    try {
      await reportFailure(error);
    } catch {
      // Diagnostics/presentation must never escape into the application's shutdown handler.
    }
  }
}
