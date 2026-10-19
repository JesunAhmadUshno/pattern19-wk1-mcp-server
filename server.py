"""Week 1 worked example: an MCP server with governed access.

Pattern 19, Episode 1 roadmap, Week 1 brief: one MCP server that exposes
three tools over a small dataset (search, read one record, write one log
line), with a permission check on each tool.

Run it:
    pip install -r requirements.txt
    MCP_CALLER_ROLE=analyst python server.py

The caller role comes from the MCP_CALLER_ROLE environment variable. In a
real deployment the role would come from the client credential. Here the
point is the pattern: every tool call passes one gate before it runs.

Tools:
    search_notes(query)  - find notes by word. Internal notes are hidden
                           from roles that cannot read them.
    read_note(note_id)   - read one note. Internal notes need an internal
                           read role.
    log_access(entry)    - append a line to access.log. Write roles only.

Every allowed and denied call is written to audit.log in this folder.
A denied call also returns an error to the client, so the caller sees
the gate, not a silent empty result.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

BASE = Path(__file__).parent
ROLE = os.environ.get("MCP_CALLER_ROLE", "viewer")

with open(BASE / "access.json", encoding="utf-8") as fh:
    POLICY = json.load(fh)

with open(BASE / "data" / "notes.json", encoding="utf-8") as fh:
    NOTES = json.load(fh)

AUDIT_LOG = BASE / "audit.log"
ACCESS_LOG = BASE / "access.log"

mcp = FastMCP("wk1-notes")


def audit(tool: str, decision: str, detail: str) -> None:
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    line = f"{stamp} role={ROLE} tool={tool} decision={decision} {detail}"
    with open(AUDIT_LOG, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def gate(tool: str) -> None:
    """Raise PermissionError if the caller role may not use this tool."""
    allowed = POLICY["roles"].get(ROLE, [])
    if tool not in allowed:
        audit(tool, "DENY", f"reason=role {ROLE} may not call {tool}")
        raise PermissionError(f"DENIED: role '{ROLE}' may not call {tool}")


def can_read(note: dict) -> bool:
    if note["classification"] == "internal":
        return ROLE in POLICY["internal_read_roles"]
    return True


@mcp.tool()
def search_notes(query: str) -> str:
    """Search note titles and bodies for a word. Returns matching records
    the caller is allowed to see."""
    gate("search_notes")
    q = query.lower()
    hits = [
        n
        for n in NOTES
        if q in n["title"].lower() or q in n["body"].lower()
        if can_read(n)
    ]
    audit("search_notes", "ALLOW", f"query={query!r} hits={len(hits)}")
    if not hits:
        return "no visible notes match"
    return json.dumps(
        [{"id": n["id"], "title": n["title"], "classification": n["classification"]} for n in hits],
        indent=2,
    )


@mcp.tool()
def read_note(note_id: str) -> str:
    """Read one note by id. Internal notes need an internal read role."""
    gate("read_note")
    note = next((n for n in NOTES if n["id"] == note_id), None)
    if note is None:
        audit("read_note", "DENY", f"reason=no note with id {note_id}")
        raise PermissionError(f"DENIED: no note with id {note_id}")
    if not can_read(note):
        audit("read_note", "DENY", f"reason=note {note_id} is internal, role {ROLE} cannot read internal")
        raise PermissionError(
            f"DENIED: note {note_id} is internal and role '{ROLE}' cannot read internal notes"
        )
    audit("read_note", "ALLOW", f"note={note_id}")
    return json.dumps(note, indent=2)


@mcp.tool()
def log_access(entry: str) -> str:
    """Append one line to access.log. Write roles only."""
    gate("log_access")
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with open(ACCESS_LOG, "a", encoding="utf-8") as fh:
        fh.write(f"{stamp} role={ROLE} entry={entry}\n")
    audit("log_access", "ALLOW", f"entry={entry!r}")
    return f"logged: {entry}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
