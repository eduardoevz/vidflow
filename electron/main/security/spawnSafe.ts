import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface SpawnSafeOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Spawns an external binary with an argument array — never a shell string.
 * `binaryPath` must be a fully-resolved path (or a bare command looked up on
 * PATH by Node itself); it is never derived from unsanitized user input.
 */
export function spawnSafe(
  binaryPath: string,
  args: string[],
  options: SpawnSafeOptions = {},
): ChildProcessWithoutNullStreams {
  return spawn(binaryPath, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell: false,
    windowsHide: true,
  });
}
