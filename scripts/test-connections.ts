/* Checks that Splitlyst can reach what it depends on: the database, the exchange-rate API and email.
 *
 *   npm run test:connections           # runs every check; the email check asks where to send a test
 *
 * The logic for each check lives in scripts/connections/. */
import { HELP, TARGETS, exitCodeFor, loadEnv, out, parseArgs } from './connections/shared';
import { printSummary, runChecks } from './connections/run';
import { askLine } from './connections/prompt';

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (args.unknown.length > 0) {
    console.error(`Unknown argument: ${args.unknown.join(', ')}\n\n${HELP}`);
    process.exit(2);
  }

  out.title('Splitlyst — connection tests');
  const results = await runChecks([...TARGETS], { prompt: askLine });
  printSummary(results);
  process.exit(exitCodeFor(results));
}

main();
