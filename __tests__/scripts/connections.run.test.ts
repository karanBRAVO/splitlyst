// The runner is tested with the individual checks mocked out.
const mockDb = jest.fn();
const mockFx = jest.fn();
const mockEmail = jest.fn();
jest.mock('../../scripts/connections/database', () => ({ checkDatabase: () => mockDb() }));
jest.mock('../../scripts/connections/exchange-rate', () => ({ checkExchangeRate: () => mockFx() }));
jest.mock('../../scripts/connections/email', () => ({ checkEmail: (o: unknown) => mockEmail(o) }));

import { printSummary, runChecks } from '../../scripts/connections/run';

let logged: string[];
beforeEach(() => {
  logged = [];
  jest.spyOn(console, 'log').mockImplementation((...a) => void logged.push(a.join(' ')));
  mockDb.mockReset().mockResolvedValue({ name: 'Database', status: 'ok' });
  mockFx
    .mockReset()
    .mockResolvedValue({ name: 'Exchange Rate API', status: 'skipped', note: 'no key' });
  mockEmail.mockReset().mockResolvedValue({ name: 'Email', status: 'ok' });
});
afterEach(() => jest.restoreAllMocks());

describe('runChecks', () => {
  it('runs only the selected checks, in the order given', async () => {
    const results = await runChecks(['email', 'database']);
    expect(results.map((r) => r.name)).toEqual(['Email', 'Database']);
    expect(mockFx).not.toHaveBeenCalled();
  });

  it('hands the prompt to the email check so it can ask where to send a test', async () => {
    const prompt = jest.fn();
    await runChecks(['email'], { prompt });
    expect(mockEmail).toHaveBeenCalledWith({ prompt });
  });

  it('runs checks one after another so their output is not interleaved', async () => {
    const order: string[] = [];
    mockDb.mockImplementation(async () => {
      order.push('db:start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('db:end');
      return { name: 'Database', status: 'ok' };
    });
    mockFx.mockImplementation(async () => {
      order.push('fx:start');
      return { name: 'Exchange Rate API', status: 'ok' };
    });
    await runChecks(['database', 'exchange-rate']);
    expect(order).toEqual(['db:start', 'db:end', 'fx:start']);
  });

  it('turns an unexpected exception into a failure and still runs the remaining checks', async () => {
    mockDb.mockRejectedValue(new Error('boom'));
    const results = await runChecks(['database', 'exchange-rate', 'email']);
    expect(results[0]).toMatchObject({ name: 'Database', status: 'fail', note: 'boom' });
    expect(results).toHaveLength(3);
    expect(mockEmail).toHaveBeenCalled();
  });
});

describe('printSummary', () => {
  it('lists each result with its state, and the reason for skips and failures', () => {
    printSummary([
      { name: 'Database', status: 'ok' },
      { name: 'Exchange Rate API', status: 'skipped', note: 'no key' },
      { name: 'Email', status: 'fail', note: 'EAUTH 535' },
    ]);
    const text = logged.join('\n');
    expect(text).toContain('Database');
    expect(text).toContain('Exchange Rate API  (no key)');
    expect(text).toContain('Email  (EAUTH 535)');
  });
});
