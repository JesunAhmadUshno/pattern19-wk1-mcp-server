# Research and engineering review

This repo is a Week 1 teaching example (one MCP server, three tools, one role gate),
not a research study. It is graded here on a doctoral-style rubric adapted to an
engineering artifact: what claim it makes, how that claim is checked, and what is
missing. Grades are A (rigorous) to D (absent).

**Overall: B- as a worked example.** It meets its own done test with a captured,
unedited run. It was below a rigorous bar on verification (the only test printed and
never asserted); that gap is now closed. Security gaps remain and are listed below.

## The claim

> A client connects, calls all three tools, and a denied call is logged.

Hypothesis, stated so it can fail: for every role in `access.json`, each tool call is
allowed exactly when the policy allows it, internal notes are readable exactly by
`internal_read_roles`, and every decision (ALLOW or DENY) writes one audit line.

## Rubric

| Criterion | Grade | Evidence and gaps |
| --- | --- | --- |
| Question / objective | A | Stated as one post line, one build brief and one done test in the README. |
| Hypotheses | B | Implicit in the done test; written out above. |
| Method | B | Real MCP client over stdio (`client_test.py`), real SDK, two roles. |
| Baselines / comparison | C | The only comparison is analyst vs viewer. No admin run in the transcript, no unknown-role run. Now covered by `tests/test_server.py`. |
| Verification / statistics | C → B | Deterministic logic, so uncertainty is not the issue; coverage is. Before: one printed transcript checked by eye. Now: 5 assertion tests plus a build-time parity check (`site/src/parity.check.mjs`) that replays the client test through a browser port and requires all 6 client lines and 6 audit lines to match `RUN_OUTPUT.txt`. |
| Reproducibility | B- | One command (`python client_test.py`). Dependency is a range (`mcp>=1.2,<2`), no lockfile, and the transcript does not record the Python or SDK version. |
| Threats to validity | C | Listed below and on the dashboard; the README already notes that identity comes from an environment variable. |
| Related work | D | No reference to the MCP authorization spec or prior tool-gating patterns. Out of scope for Week 1. |
| Limitations stated | B | The README is honest about the environment-variable role. Further limits below. |
| Engineering rigor | B- | Small, readable, one gate in front of every tool. No CI before this change; the Pages workflow now runs the tests first. |

## Reproduction check (done 2026-11-07)

`client_test.py` was re-run in a fresh virtual environment (Python 3.12.3, `mcp`
1.30.0, installed from `requirements.txt`). Its stdout matched the committed
`RUN_OUTPUT.txt` line for line apart from timestamps. The server also writes
`Processing request of type ...` lines to stderr; those were never part of the
transcript. `RUN_OUTPUT.txt` was not changed.

The README says the run was captured 2026-10-18 while the audit stamps read
2026-10-19T00:12 UTC. That fits a local evening capture on the 18th; it is not
otherwise explained in the repo.

## Fixed now (cheap)

- **Assertions.** `tests/test_server.py` (standard library only, works with or
  without the SDK installed) asserts the recorded sequence, viewer search hiding
  internal notes, the admin role, an unknown role, and an unknown note id.
- **Parity guard.** The dashboard's playground is a browser port of `server.py`.
  The build fails if the port's output drifts from the recorded run, so the page
  cannot quietly disagree with the server.
- **CI.** `.github/workflows/pages.yml` runs the tests before building the site.

## Open gaps and what each needs

| Gap | Why it matters | What closing it needs |
| --- | --- | --- |
| Log injection in `access.log` | `log_access` writes the entry raw; a newline forges a line that looks like another role wrote it. `audit.log` is safe (it uses `repr`). | A one-line change in `server.py` (escape or reject newlines), a test, and a re-captured `RUN_OUTPUT.txt` in the same commit. Owner decision, since it changes the recorded artifact. No compute. |
| Existence oracle | `read_note` tells a viewer that an internal id exists; unknown ids get a different message, while search hides internal notes silently. | A policy decision (disclose or not), then a matching message and test. No compute. |
| Not-found logged as DENY | Audit counts mix authorization failures with missing records. | A separate decision value (for example `NOT_FOUND`) and an updated transcript. No compute. |
| Identity from an environment variable | No authentication, no per-request identity, role fixed per process. | MCP authorization (OAuth-based) on an HTTP transport, or a signed token per request. A Week 2+ build, not a patch. |
| Audit log not tamper-evident | Append-only by convention only. | Hash-chained lines or an external append-only sink. Small code change. |
| Loose dependency pin, single run | A future SDK could change the error text the client sees. | A lockfile (`pip freeze` or `uv lock`) and recording the Python and SDK versions in the transcript header. Free, about 10 minutes. |
| Substring search | Query `a` matches nearly everything. | Fine for the brief; tokenized or ranked search belongs to Week 2 retrieval. |
| No related work | The pattern is not placed against the MCP spec's authorization section or existing gateway designs. | A short reading note. No compute. |

## What the dashboard shows and does not show

Every number on the dashboard is read at build time from `access.json`,
`data/notes.json`, `server.py`, `RUN_OUTPUT.txt` and `README.md`. The playground runs
the ported logic in the browser and is labelled as a port, not the Python server.
The replay steps through the recorded transcript and is labelled as recorded.
