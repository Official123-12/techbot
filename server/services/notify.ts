let _fn: ((msg: string) => Promise<void>) | null = null;

export function registerNotifier(fn: (msg: string) => Promise<void>): void {
  _fn = fn;
}

export async function notifyOwner(msg: string): Promise<void> {
  if (_fn) await _fn(msg).catch(() => {});
}
