// Browser port of the gate logic in ../../server.py: gate(), can_read(), search_notes,
// read_note, log_access and audit(). It is NOT the Python MCP server; parity.check.mjs
// replays client_test.py through it at build time and fails the build if any line drifts
// from the recorded RUN_OUTPUT.txt.

// Python's repr() for a str, as used by the f-strings {query!r} and {entry!r}.
// ponytail: ASCII-only escaping; non-printable Unicode (repr's \u escapes) is not ported.
export function pyRepr(s) {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '\\' || ch === q) out += '\\' + ch;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0');
    else out += ch;
  }
  return q + out + q;
}

// datetime.now(timezone.utc).isoformat(timespec="seconds")
export const pyStamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, '+00:00');

class Denied extends Error {}

// One server process for one MCP_CALLER_ROLE. Pass shared audit/access arrays to keep
// appending across roles, the way audit.log accumulates across client_test.py's two runs.
export function makeServer({ policy, notes, role, now = () => new Date(), audit = [], access = [] }) {
  const log = (tool, decision, detail) => audit.push(`${pyStamp(now())} role=${role} tool=${tool} decision=${decision} ${detail}`);
  const gate = (tool) => {
    if (!(policy.roles[role] ?? []).includes(tool)) {
      log(tool, 'DENY', `reason=role ${role} may not call ${tool}`);
      throw new Denied(`DENIED: role '${role}' may not call ${tool}`);
    }
  };
  const canRead = (n) => n.classification !== 'internal' || policy.internal_read_roles.includes(role);
  const tools = {
    search_notes(query) {
      gate('search_notes');
      const q = query.toLowerCase();
      const hits = notes.filter((n) => (n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) && canRead(n));
      log('search_notes', 'ALLOW', `query=${pyRepr(query)} hits=${hits.length}`);
      if (!hits.length) return 'no visible notes match';
      return JSON.stringify(hits.map((n) => ({ id: n.id, title: n.title, classification: n.classification })), null, 2);
    },
    read_note(noteId) {
      gate('read_note');
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        log('read_note', 'DENY', `reason=no note with id ${noteId}`);
        throw new Denied(`DENIED: no note with id ${noteId}`);
      }
      if (!canRead(note)) {
        log('read_note', 'DENY', `reason=note ${noteId} is internal, role ${role} cannot read internal`);
        throw new Denied(`DENIED: note ${noteId} is internal and role '${role}' cannot read internal notes`);
      }
      log('read_note', 'ALLOW', `note=${noteId}`);
      return JSON.stringify(note, null, 2);
    },
    log_access(entry) {
      gate('log_access');
      // Written raw, as server.py does: a newline in entry becomes a second access.log line.
      access.push(...`${pyStamp(now())} role=${role} entry=${entry}`.split('\n'));
      log('log_access', 'ALLOW', `entry=${pyRepr(entry)}`);
      return `logged: ${entry}`;
    },
  };
  // The MCP SDK turns a raised exception into an error result with this prefix.
  const call = (tool, arg) => {
    try { return { ok: true, text: tools[tool](arg) }; } catch (e) {
      if (!(e instanceof Denied)) throw e;
      return { ok: false, text: `Error executing tool ${tool}: ${e.message}` };
    }
  };
  return { call, canRead, audit, access };
}

// Tool names in declaration order: every function decorated with @mcp.tool() in server.py.
export const toolsInServer = (src) => [...src.matchAll(/@mcp\.tool\(\)\s*\ndef (\w+)/g)].map((m) => m[1]);

// Parse RUN_OUTPUT.txt into runs (client lines) and audit lines.
export function parseRun(text) {
  const runs = [], audit = [];
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/^== Run: role=(\w+) ==$/))) runs.push({ role: m[1], tools: [], calls: [] });
    else if ((m = line.match(/^ {2}tools: (.*)$/))) runs.at(-1).tools = m[1].split(', ');
    else if ((m = line.match(/^ {2}\[(OK|ERROR)\] (.*?): (.*)$/))) runs.at(-1).calls.push({ ok: m[1] === 'OK', label: m[2], text: m[3], raw: line });
    else if ((m = line.match(/^(\S+) role=(\S+) tool=(\S+) decision=(ALLOW|DENY) (.*)$/))) audit.push({ stamp: m[1], role: m[2], tool: m[3], decision: m[4], detail: m[5], raw: line, body: line.slice(m[1].length + 1) });
  }
  return { runs, audit };
}

// The exact call sequence of client_test.py, per role.
export const CLIENT_TEST = [
  { tool: 'search_notes', arg: 'gateway', label: "search_notes('gateway')" },
  { tool: 'read_note', arg: 'n3', label: "read_note('n3') internal" },
  { tool: 'log_access', arg: 'client test run', label: "log_access('client test run')" },
];

// Replay client_test.py through the port and pair every call with the recorded transcript.
export function replayClientTest({ policy, notes, recorded }) {
  const audit = [];
  const rows = [];
  for (const run of recorded.runs) {
    const srv = makeServer({ policy, notes, role: run.role, audit });
    run.calls.forEach((rec, i) => {
      const c = CLIENT_TEST[i];
      const before = audit.length;
      const res = srv.call(c.tool, c.arg);
      // show() in client_test.py: newlines to spaces, cut at 600 characters.
      const clientLine = `  [${res.ok ? 'OK' : 'ERROR'}] ${c.label}: ${res.text.replace(/\n/g, ' ').slice(0, 600)}`;
      const portAudit = audit.slice(before).map((l) => l.slice(l.indexOf(' ') + 1));
      rows.push({ role: run.role, label: c.label, rec, clientLine, portAudit, portOk: res.ok });
    });
  }
  rows.forEach((r, i) => {
    r.recAudit = recorded.audit[i];
    r.portDecision = r.portAudit[0]?.match(/decision=(\w+)/)?.[1];
    r.clientMatch = r.clientLine === r.rec.raw;
    r.auditMatch = r.portAudit.length === 1 && r.portAudit[0] === r.recAudit?.body;
    r.match = r.clientMatch && r.auditMatch;
  });
  return rows;
}
