import { useEffect, useId, useMemo, useState } from 'react';
import policy from '../../access.json';
import notes from '../../data/notes.json';
import serverSrc from '../../server.py?raw';
import runText from '../../RUN_OUTPUT.txt?raw';
import readme from '../../README.md?raw';
import { makeServer, parseRun, replayClientTest, toolsInServer, CLIENT_TEST } from './gate.js';

const REPO = 'https://github.com/JesunAhmadUshno/pattern19-wk1-mcp-server';
const blob = (p) => `${REPO}/blob/main/${p}`;

// Everything below is derived from the imported repo files.
const TOOLS = toolsInServer(serverSrc);
const ROLES = Object.keys(policy.roles);
const recorded = parseRun(runText);
const rows = replayClientTest({ policy, notes, recorded });
const matched = rows.filter((r) => r.match).length;
const denies = recorded.audit.filter((a) => a.decision === 'DENY');
const internal = notes.filter((n) => n.classification === 'internal').length;
const line = (re) => readme.match(re)?.[1].replace(/\s*\n\s*/g, ' ').trim() ?? '';
const BRIEF = { post: line(/Post line it answers: ([\s\S]*?)\n\n/), build: line(/Build: ([\s\S]*?)\n\n/), done: line(/Done when: ([\s\S]*?)\n\n/) };
const CAPTURED = line(/Captured (\d{4}-\d{2}-\d{2})/);
const NEXT = line(/## Next step\n\n([\s\S]*?)\n\n/);
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const viewerDenies = denies.filter((a) => a.role === 'viewer').length;

const SECTIONS = [['top', 'Overview', '◎'], ['policy', 'Policy', '▦'], ['gate', 'Playground', '❯_'], ['data', 'Dataset', '▤'], ['replay', 'Replay', '⏵'], ['parity', 'Parity', '='], ['flow', 'Flow', '⇄'], ['gaps', 'Gaps', '!']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">wk1-notes</a>
      <a className="m" href={blob('server.py')}>server.py</a>
      <a className="m" href={blob('access.json')}>access.json</a>
      <a className="m" href={blob('docs/research-review.md')}>Review</a>
      <span className="spacer" />
      <span className="status"><i /> parity {matched}/{rows.length}</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <Policy />
      <Playground />
      <Dataset />
      <Replay />
      <Parity />
      <Flow />
      <Gaps />
      <Dock />
      <footer>
        Every number on this page is read at build time from <code>access.json</code>, <code>data/notes.json</code>, <code>server.py</code> and <code>RUN_OUTPUT.txt</code>.
        The playground is a browser port of the gate in <code>server.py</code>, checked line for line against the recorded run. <a href={REPO} style={{ color: 'inherit' }}>Source on GitHub</a>.
      </footer>
    </div>
  );
}

function Hero() {
  const done = matched === rows.length && denies.length > 0;
  return (
    <header className="card hero window" id="top" data-title="wk1-notes — server.py">
      <div className="head">
        <p className="eyebrow">INFUSE roadmap · Week 1 worked example</p>
        <span className={`pill ${done ? 'good' : 'bad'}`}>● {done ? 'Done test met' : 'Done test not met'}</span>
      </div>
      <h1>One gate in front of every tool: a viewer’s {WORDS[viewerDenies] ?? viewerDenies} forbidden calls were <em>denied and logged</em>, not silently dropped.</h1>
      <p className="sub">
        An MCP server over stdio with a role check on each of its {TOOLS.length} tools. <b>The brief:</b> {BRIEF.build} <b>Done when:</b> {BRIEF.done}
      </p>
      <div className="actions">
        <a className="btn primary" href="#gate">Try the gate</a>
        <a className="btn ghost" href="#replay">Step through the recorded run</a>
        <span className="hint">Answers the post line: “{BRIEF.post}”</span>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{TOOLS.length}</div><div className="cap">tools behind one gate: {TOOLS.join(', ')}</div></div>
        <div className="tile"><div className="num">{ROLES.length}</div><div className="cap">roles in access.json: {ROLES.join(', ')}</div></div>
        <div className="tile"><div className="num">{notes.length}</div><div className="cap">sample notes, {notes.length - internal} public and {internal} internal</div></div>
        <div className="tile"><div className="num">{denies.length}/{recorded.audit.length}</div><div className="cap">audit lines in the recorded run that are DENY</div></div>
      </div>
    </header>
  );
}

function Policy() {
  const cols = [...TOOLS.map((t) => ({ k: t, label: t })), { k: '__internal', label: 'read internal notes' }];
  const [tip, setTip] = useState(null);
  const allowed = (role, k) => (k === '__internal' ? policy.internal_read_roles.includes(role) : policy.roles[role].includes(k));
  const explain = (role, k, ok) => (k === '__internal'
    ? `${role} is ${ok ? '' : 'not '}in internal_read_roles, so read_note on an internal note ${ok ? 'is allowed' : 'is denied and logged'}, and search ${ok ? 'shows' : 'silently hides'} internal notes.`
    : `roles.${role} ${ok ? 'lists' : 'does not list'} ${k}, so gate("${k}") ${ok ? 'lets the call through' : 'writes a DENY line to audit.log and returns an error'}.`);
  return (
    <section id="policy" className="card window reveal" data-title="access.json">
      <p className="eyebrow">The policy</p>
      <h2>Who may call what, generated from <em>access.json</em>.</h2>
      <p className="sub">One file decides every tool call. Rows are the {ROLES.length} roles, columns the {TOOLS.length} tools plus the extra rule for internal notes. Hover or focus a cell for the rule behind it.</p>
      <div className="scroll-x" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="matrix">
          <thead><tr><th>role</th>{cols.map((c) => <th key={c.k} className="mono">{c.label}</th>)}</tr></thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role}><td className="mono"><b>{role}</b></td>
                {cols.map((c) => {
                  const ok = allowed(role, c.k);
                  const t = explain(role, c.k, ok);
                  return (
                    <td key={c.k} tabIndex={0} aria-label={t} onMouseEnter={() => setTip(t)} onFocus={() => setTip(t)}>
                      <span className={`pill ${ok ? 'good' : 'bad'}`}>{ok ? 'allow' : 'deny'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tip" aria-live="polite">{tip ?? 'Hover a cell to see the rule.'}</div>
    </section>
  );
}

const ARG = { search_notes: 'query', read_note: 'note_id', log_access: 'entry' };
const PRESETS = [
  { name: 'Viewer reads n3', role: 'viewer', tool: 'read_note', arg: 'n3' },
  { name: 'Viewer searches “internal”', role: 'viewer', tool: 'search_notes', arg: 'internal' },
  { name: 'Analyst searches “internal”', role: 'analyst', tool: 'search_notes', arg: 'internal' },
  { name: 'Admin reads a missing id', role: 'admin', tool: 'read_note', arg: 'n99' },
  { name: 'Log entry with a newline', role: 'analyst', tool: 'log_access', arg: 'ok\nrole=admin entry=spoofed' },
];

function Playground() {
  const [role, setRole] = useState('viewer');
  const [tool, setTool] = useState('read_note');
  const [arg, setArg] = useState('n3');
  const [out, setOut] = useState(null);
  const [audit, setAudit] = useState([]);
  const [access, setAccess] = useState([]);
  const run = (r = role, t = tool, a = arg) => {
    const a2 = [...audit], x2 = [...access];
    const res = makeServer({ policy, notes, role: r, audit: a2, access: x2 }).call(t, a);
    setOut({ ...res, label: `${t}(${JSON.stringify(a)}) as ${r}` });
    setAudit(a2); setAccess(x2);
  };
  const preset = (p) => { setRole(p.role); setTool(p.tool); setArg(p.arg); run(p.role, p.tool, p.arg); };
  return (
    <section id="gate" className="card window reveal" data-title="gate-sim — MCP_CALLER_ROLE (browser port)">
      <div className="head">
        <div>
          <p className="eyebrow">Live in your browser</p>
          <h2>Pick a role, call a tool, watch the <em>audit log</em> grow.</h2>
          <p className="sub">A JavaScript port of <code>gate()</code>, <code>can_read()</code> and the three tools in <a href={blob('server.py')}>server.py</a>, running over the real <code>access.json</code> and <code>notes.json</code>. It writes audit lines in the server’s exact format. This is not the Python MCP server; the parity window below shows the port reproducing the recorded run.</p>
        </div>
        <span className="pill info">browser port, not a live server</span>
      </div>
      <div className="controls">
        <div className="field"><label htmlFor="g-role">MCP_CALLER_ROLE</label>
          <select id="g-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="intruder">intruder (not in access.json)</option>
          </select>
        </div>
        <div className="field"><label htmlFor="g-tool">Tool</label>
          <select id="g-tool" value={tool} onChange={(e) => setTool(e.target.value)}>
            {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="g-arg">{ARG[tool]}</label>
          <textarea id="g-arg" rows={1} value={arg} onChange={(e) => setArg(e.target.value)} />
        </div>
      </div>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn primary" onClick={() => run()}>Call {tool}</button>
        <button className="btn ghost" onClick={() => { setAudit([]); setAccess([]); setOut(null); }}>Clear logs</button>
      </div>
      <div className="presets" role="group" aria-label="Example calls">
        {PRESETS.map((p) => <button key={p.name} className="chip" onClick={() => preset(p)}>{p.name}</button>)}
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <h3>Result returned to the client</h3>
          <pre className={`term ${out ? (out.ok ? 'okb' : 'errb') : ''}`}>{out ? `[${out.ok ? 'OK' : 'ERROR'}] ${out.label}\n${out.text}` : 'Press Call or pick an example.'}</pre>
        </div>
        <div>
          <h3>audit.log <span className="hint">({audit.length} lines, {audit.filter((l) => l.includes('decision=DENY')).length} DENY)</span></h3>
          <pre className="term">{audit.length ? audit.map((l, k) => <span key={k} className={l.includes('decision=DENY') ? 'deny' : ''}>{l}{'\n'}</span>) : 'empty'}</pre>
          <h3 style={{ marginTop: 12 }}>access.log <span className="hint">({access.length} lines)</span></h3>
          <pre className="term">{access.length ? access.join('\n') : 'empty'}</pre>
        </div>
      </div>
      <p className="hint">Try the newline example: server.py writes <code>entry</code> to access.log raw, so one call becomes two lines and the second one looks like an admin wrote it. audit.log is safe because it stores <code>repr(entry)</code>.</p>
    </section>
  );
}

function Dataset() {
  const [role, setRole] = useState('viewer');
  const srv = useMemo(() => makeServer({ policy, notes, role }), [role]);
  const visible = notes.filter(srv.canRead).length;
  return (
    <section id="data" className="card window reveal" data-title="data/notes.json">
      <div className="head">
        <div>
          <p className="eyebrow">The dataset</p>
          <h2>{role} can see <em>{visible} of {notes.length}</em> notes.</h2>
          <p className="sub">Greyed notes are internal and this role is not in <code>internal_read_roles</code>. Search hides them silently; <code>read_note</code> on one returns an explicit denial. The notes are synthetic sample text committed to the repo.</p>
        </div>
        <div className="seg" role="group" aria-label="Role">
          {ROLES.map((r) => <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>)}
        </div>
      </div>
      <div className="notes">
        {notes.map((n) => {
          const ok = srv.canRead(n);
          return (
            <article key={n.id} className={`note ${ok ? '' : 'hidden'}`}>
              <div className="head" style={{ marginBottom: 6 }}><span className="mono">{n.id}</span><span className={`pill ${n.classification === 'internal' ? 'warn' : 'info'}`}>{n.classification}</span></div>
              <h3>{n.title}</h3>
              <p className="hint" style={{ margin: '6px 0 0' }}>{ok ? n.body : 'Hidden from search. read_note → DENIED, logged.'}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Replay() {
  const [i, setI] = useState(0);
  const r = rows[i];
  const id = useId();
  return (
    <section id="replay" className="card window reveal" data-title={`RUN_OUTPUT.txt — recorded ${CAPTURED}, unedited`}>
      <div className="head">
        <div>
          <p className="eyebrow">Recorded replay</p>
          <h2>The real run, one call at a time.</h2>
          <p className="sub">Lines from the committed transcript of <code>python client_test.py</code> (README: captured {CAPTURED}; audit stamps are UTC, {recorded.audit[0].stamp.slice(0, 10)}). Nothing here is re-run; each step pairs what the client saw with the audit line the server wrote.</p>
        </div>
        <span className="pill warn">recorded, not live</span>
      </div>
      <div className="field">
        <label htmlFor={id}>Step <span>{i + 1} of {rows.length} · role {r.role}</span></label>
        <input id={id} type="range" min={0} max={rows.length - 1} step={1} value={i} onChange={(e) => setI(+e.target.value)} />
      </div>
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← Previous</button>
        <button className="btn primary" onClick={() => setI(Math.min(rows.length - 1, i + 1))} disabled={i === rows.length - 1}>Next call →</button>
      </div>
      <h3 style={{ marginTop: 16 }}>Client saw</h3>
      <pre className={`term ${r.rec.ok ? 'okb' : 'errb'}`}>{r.rec.raw.trim()}</pre>
      <h3 style={{ marginTop: 12 }}>audit.log</h3>
      <pre className="term">{recorded.audit.map((a, k) => <span key={k} className={`${k === i ? 'cur' : ''} ${a.decision === 'DENY' ? 'deny' : ''}`}>{a.raw}{'\n'}</span>)}</pre>
    </section>
  );
}

function Parity() {
  return (
    <section id="parity" className="card window reveal" data-title="parity.check">
      <div className="head">
        <div>
          <p className="eyebrow">Known-answer check</p>
          <h2>The port reproduces <em>{matched} of {rows.length}</em> recorded calls exactly.</h2>
          <p className="sub">Computed now, in your browser: <code>client_test.py</code>’s sequence ({CLIENT_TEST.map((c) => c.label).join(', ')}) is replayed through the port as {recorded.runs.map((x) => x.role).join(' then ')}. Both the client line and the audit line (timestamp aside) must equal the transcript. The same check, <a href={`${REPO}/blob/main/site/src/parity.check.mjs`}>parity.check.mjs</a>, runs in <code>npm run build</code> and fails the build on any drift.</p>
        </div>
        <span className={`pill ${matched === rows.length ? 'good' : 'bad'}`}>{matched}/{rows.length} match</span>
      </div>
      <div className="scroll-x" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>#</th><th>Role</th><th>Call</th><th>Recorded</th><th>Port</th><th>Client line</th><th>Audit line</th></tr></thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k}><td>{k + 1}</td><td className="mono">{r.role}</td><td className="mono">{r.label}</td>
                <td><span className={`pill ${r.recAudit.decision === 'ALLOW' ? 'good' : 'bad'}`}>{r.recAudit.decision}</span></td>
                <td><span className={`pill ${r.portDecision === 'ALLOW' ? 'good' : 'bad'}`}>{r.portDecision}</span></td>
                <td className={r.clientMatch ? 'ok' : 'no'}>{r.clientMatch ? 'identical' : 'differs'}</td>
                <td className={r.auditMatch ? 'ok' : 'no'}>{r.auditMatch ? 'identical' : 'differs'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Flow() {
  const box = (x, y, w, t, s, cls = '') => (
    <g key={t}><rect x={x} y={y} width={w} height={56} rx={12} className={`fbox ${cls}`} /><text x={x + w / 2} y={y + 24} textAnchor="middle" className="ft">{t}</text><text x={x + w / 2} y={y + 42} textAnchor="middle">{s}</text></g>
  );
  return (
    <section id="flow" className="card window reveal" data-title="flow.svg">
      <p className="eyebrow">Request lifecycle</p>
      <h2>Every call passes the gate, and <em>both</em> outcomes are written down.</h2>
      <svg className="chart" viewBox="0 0 960 262" role="img" aria-label="Flow: client sends a call over stdio to the gate; allowed calls run the tool and return a result, denied calls return an error; both write a line to audit.log">
        <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" className="fhead" /></marker></defs>
        {box(10, 40, 150, 'MCP client', 'client_test.py')}
        {box(220, 40, 150, 'stdio', 'JSON-RPC')}
        {box(430, 40, 150, 'gate(tool)', 'access.json', 'gatebox')}
        {box(640, 40, 150, 'tool runs', 'search · read · log', 'okbox')}
        {box(640, 170, 150, 'audit.log', 'ALLOW or DENY line')}
        {box(430, 170, 150, 'PermissionError', 'DENIED: …', 'denybox')}
        {[160, 370, 580].map((x) => <path key={x} d={`M${x} 68H${x + 58}`} className="fl" markerEnd="url(#ah)" />)}
        <path d="M715 96V168" className="fl" markerEnd="url(#ah)" />
        <path d="M505 96V168" className="fl deny" markerEnd="url(#ah)" />
        <path d="M580 198H638" className="fl deny" markerEnd="url(#ah)" />
        <path d="M790 68H880V22H85V38" className="fl" markerEnd="url(#ah)" />
        <path d="M430 214H85V98" className="fl deny" markerEnd="url(#ah)" />
        <text x={540} y={140}>deny</text><text x={724} y={140}>allow</text>
        <text x={480} y={15} textAnchor="middle">result back to the client</text><text x={258} y={250} textAnchor="middle">error back to the client, never a silent empty result</text>
      </svg>
    </section>
  );
}

function Gaps() {
  const gaps = [
    ['Identity is an environment variable', 'MCP_CALLER_ROLE is fixed per server process. There is no authentication and no per-request identity; the README says so.', 'warn'],
    ['The transcript test only prints', 'client_test.py exits 0 even if a denial wrongly succeeds. tests/test_server.py now asserts the decisions, including the paths the transcript skipped.', 'good'],
    ['Log injection on access.log', 'log_access writes the entry raw, so a newline fakes an extra line (see the playground example). audit.log uses repr and is safe.', 'bad'],
    ['Existence is disclosed', 'read_note says an internal id exists; an unknown id gets a different message. Search hides internal notes silently. The policy should pick one.', 'warn'],
    ['Not-found is logged as DENY', 'A missing id is a DENY in audit.log, which mixes authorization failures with missing records.', 'warn'],
    ['One recorded run', 'The committed transcript is a single run and the dependency is a range (mcp>=1.2,<2) with no lockfile. The research review records a later re-run and what a pinned setup still needs.', 'warn'],
  ];
  return (
    <section id="gaps" className="card window reveal" data-title="README.md — gaps and next step">
      <p className="eyebrow">Limits and threats</p>
      <h2>What this example does <em>not</em> prove.</h2>
      <p className="sub">It meets its own done test. It is a teaching example, not a hardened server. The full grading is in <a href={blob('docs/research-review.md')}>docs/research-review.md</a>.</p>
      <div className="grid2" style={{ marginTop: 16 }}>
        {gaps.map(([t, d, c]) => (
          <div className="tile" key={t}>
            <div className="head" style={{ marginBottom: 6 }}><h3>{t}</h3><span className={`pill ${c}`}>{c === 'good' ? 'Addressed' : c === 'bad' ? 'Open bug' : 'Open'}</span></div>
            <p className="hint" style={{ margin: 0, fontSize: 13 }}>{d}</p>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 20 }}>Next step</h3>
      <p className="sub" style={{ marginTop: 6 }}>{NEXT}</p>
    </section>
  );
}
