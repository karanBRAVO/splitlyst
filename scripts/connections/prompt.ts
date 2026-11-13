import { createInterface } from 'node:readline/promises';

export function isInteractive(): boolean {
  return !!process.stdin.isTTY && !!process.stdout.isTTY;
}

/**
 * Ask one question on the terminal. Returns undefined when there is no terminal (CI, pipes), so
 * callers can skip interactive steps instead of hanging.
 */
export async function askLine(question: string): Promise<string | undefined> {
  if (!isInteractive()) return undefined;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Ctrl+C should end the run, not leave the question hanging
  rl.on('SIGINT', () => {
    rl.close();
    process.exit(130);
  });
  try {
    return (await rl.question(`  ? ${question} `)).trim();
  } finally {
    rl.close();
  }
}
