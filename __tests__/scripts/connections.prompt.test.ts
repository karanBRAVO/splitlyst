const mockQuestion = jest.fn();
const mockClose = jest.fn();
const mockOn = jest.fn();
jest.mock('node:readline/promises', () => ({
  createInterface: jest.fn(() => ({ question: mockQuestion, close: mockClose, on: mockOn })),
}));

import { createInterface } from 'node:readline/promises';
import { askLine, isInteractive } from '../../scripts/connections/prompt';

const setTty = (stdin: boolean, stdout: boolean) => {
  Object.defineProperty(process.stdin, 'isTTY', { value: stdin, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: stdout, configurable: true });
};
const original = { stdin: process.stdin.isTTY, stdout: process.stdout.isTTY };

beforeEach(() => {
  mockQuestion.mockReset().mockResolvedValue('  me@example.com  ');
  mockClose.mockReset();
  mockOn.mockReset();
  (createInterface as jest.Mock).mockClear();
});
afterAll(() => setTty(!!original.stdin, !!original.stdout));

describe('askLine', () => {
  it('does not ask (and never opens a prompt) when there is no terminal, e.g. in CI', async () => {
    setTty(false, false);
    expect(isInteractive()).toBe(false);
    expect(await askLine('Question?')).toBeUndefined();
    expect(createInterface).not.toHaveBeenCalled();
    setTty(true, false); // output piped to a file: still no prompt
    expect(await askLine('Question?')).toBeUndefined();
  });

  it('asks on a terminal, returns the trimmed answer, and always closes the prompt', async () => {
    setTty(true, true);
    expect(isInteractive()).toBe(true);
    expect(await askLine('Send a test?')).toBe('me@example.com');
    expect(mockQuestion.mock.calls[0][0]).toContain('Send a test?');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('closes the prompt even if reading fails', async () => {
    setTty(true, true);
    mockQuestion.mockRejectedValue(new Error('stream closed'));
    await expect(askLine('Q?')).rejects.toThrow('stream closed');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('wires Ctrl+C so it ends the run instead of hanging', async () => {
    setTty(true, true);
    await askLine('Q?');
    expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });
});
