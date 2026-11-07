// Known-answer check, run by `npm run build` before vite: the browser port must reproduce
// the recorded RUN_OUTPUT.txt line for line (timestamps aside), or the build fails.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pyRepr, pyStamp, makeServer, toolsInServer, parseRun, replayClientTest } from './gate.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const policy = JSON.parse(read('access.json'));
const notes = JSON.parse(read('data/notes.json'));
const recorded = parseRun(read('RUN_OUTPUT.txt'));

// Python repr() and isoformat() known answers.
assert.equal(pyRepr('gateway'), "'gateway'");
assert.equal(pyRepr("it's"), `"it's"`);
assert.equal(pyRepr(`it's "x"`), `'it\\'s "x"'`);
assert.equal(pyRepr('a\nb\\c'), "'a\\nb\\\\c'");
assert.equal(pyStamp(new Date('2026-10-19T00:12:38.512Z')), '2026-10-19T00:12:38+00:00');

// The tool list: server.py decorators, the transcript, and the policy all agree.
const tools = toolsInServer(read('server.py'));
assert.deepEqual(tools, ['search_notes', 'read_note', 'log_access']);
for (const run of recorded.runs) assert.deepEqual(run.tools, tools);
assert.deepEqual([...new Set(Object.values(policy.roles).flat())].sort(), [...tools].sort());

// The transcript has two runs of three calls and six audit lines.
assert.deepEqual(recorded.runs.map((r) => r.role), ['analyst', 'viewer']);
assert.equal(recorded.audit.length, 6);

// Replay client_test.py: every client line and audit line must match exactly.
const rows = replayClientTest({ policy, notes, recorded });
assert.equal(rows.length, 6);
for (const r of rows) {
  assert.equal(r.clientLine, r.rec.raw, `client line drift (${r.role} ${r.label})`);
  assert.deepEqual(r.portAudit, [r.recAudit.body], `audit line drift (${r.role} ${r.label})`);
}

// Paths the transcript never exercised, matching tests/test_server.py.
const viewer = makeServer({ policy, notes, role: 'viewer' });
assert.equal(viewer.call('search_notes', 'internal').text, 'no visible notes match');
const admin = makeServer({ policy, notes, role: 'admin' });
assert.equal(admin.call('read_note', 'n99').text, 'Error executing tool read_note: DENIED: no note with id n99');
const intruder = makeServer({ policy, notes, role: 'intruder' });
assert.equal(intruder.call('search_notes', 'a').ok, false);

const deny = recorded.audit.filter((a) => a.decision === 'DENY').length;
console.log('parity ok', { calls: rows.length, matched: rows.filter((r) => r.match).length, deny, notes: notes.length });
