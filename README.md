# Week 1 worked example: an MCP server with governed access

This repo is the worked example for **Week 1** of the INFUSE Roadmap
(Pattern 19, Episode 1): 8 weeks, 8 proof projects, one real job post
read as a test list.

Full roadmap: https://jesunahmadushno.com/roadmap/infuse-ai-engineer/

## The Week 1 brief

Post line it answers: build and maintain MCP servers and tool layers
for governed agent access.

Build: one MCP server that exposes three tools over a small dataset
(search, read one record, write one log line), with a permission check
on each tool.

Done when: a client connects, calls all three tools, and a denied call
is logged.

## What this server does

Three tools over a set of 8 sample notes. Each note is `public` or
`internal`. The caller has a role: `viewer`, `analyst`, or `admin`.

| Tool | What it does | Who may call it |
| --- | --- | --- |
| `search_notes(query)` | Find notes by word. Internal notes stay hidden from roles that cannot read them. | viewer, analyst, admin |
| `read_note(note_id)` | Read one note in full. Internal notes need an internal read role. | viewer, analyst, admin (internal: analyst, admin) |
| `log_access(entry)` | Append one line to `access.log`. | analyst, admin |

Every call, allowed or denied, lands in `audit.log` with a timestamp,
the role, the tool, and the decision. A denied call returns an error to
the client. The gate is visible, never silent.

The role comes from the `MCP_CALLER_ROLE` environment variable. In a
real deployment the role comes from the client credential or token.
The pattern is the lesson: one gate in front of every tool, one log
behind it.

## Files

| File | Role in the brief |
| --- | --- |
| `server.py` | The MCP server (stdio transport, official MCP Python SDK). Holds the three tools and the gate function. |
| `access.json` | The access policy: which roles may call which tools, and which roles may read internal notes. |
| `data/notes.json` | The small dataset: 8 notes, public and internal. |
| `client_test.py` | A real MCP client. Connects over stdio, lists the tools, calls all three as `analyst`, then again as `viewer`. |
| `RUN_OUTPUT.txt` | The captured test transcript, including both denied calls and the audit log. |
| `requirements.txt` | One dependency: the MCP Python SDK, pinned to the v1 line. |

## Run it

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python client_test.py
```

Run the server by hand:

```bash
MCP_CALLER_ROLE=analyst python server.py
```

Then connect any MCP client over stdio. Point the client at
`server.py`, and set `MCP_CALLER_ROLE` in the server environment.

## Real run output

Captured 2026-10-18 with `python client_test.py`, unedited:

```text
Week 1 MCP server: client test transcript
Server: server.py over stdio transport, official MCP Python SDK

== Run: role=analyst ==
  tools: search_notes, read_note, log_access
  [OK] search_notes('gateway'): [   {     "id": "n4",     "title": "Gateway routing rule",     "classification": "public"   } ]
  [OK] read_note('n3') internal: {   "body": "Internal notes on target pay bands. Do not share outside the team.",   "classification": "internal",   "id": "n3",   "tags": [     "internal",     "career"   ],   "title": "Salary band research" }
  [OK] log_access('client test run'): logged: client test run

== Run: role=viewer ==
  tools: search_notes, read_note, log_access
  [OK] search_notes('gateway'): [   {     "id": "n4",     "title": "Gateway routing rule",     "classification": "public"   } ]
  [ERROR] read_note('n3') internal: Error executing tool read_note: DENIED: note n3 is internal and role 'viewer' cannot read internal notes
  [ERROR] log_access('client test run'): Error executing tool log_access: DENIED: role 'viewer' may not call log_access

== audit.log after both runs ==
2026-10-19T00:12:38+00:00 role=analyst tool=search_notes decision=ALLOW query='gateway' hits=1
2026-10-19T00:12:38+00:00 role=analyst tool=read_note decision=ALLOW note=n3
2026-10-19T00:12:38+00:00 role=analyst tool=log_access decision=ALLOW entry='client test run'
2026-10-19T00:12:39+00:00 role=viewer tool=search_notes decision=ALLOW query='gateway' hits=1
2026-10-19T00:12:39+00:00 role=viewer tool=read_note decision=DENY reason=note n3 is internal, role viewer cannot read internal
2026-10-19T00:12:39+00:00 role=viewer tool=log_access decision=DENY reason=role viewer may not call log_access
```

## Done test, checked

- A client connects: yes, `client_test.py` over stdio, both runs.
- All three tools called: yes, search, read, and log in each run.
- A denied call is logged: yes, two denials in the viewer run, both in
  `audit.log` with role, tool, and reason.

## Next step

Week 2 of the roadmap puts retrieval over messy data on top of this
server. The gate and the audit log carry over as they are.

A story, a real method. The roadmap is free. Use it, ship the
projects, and send us the repo links.
