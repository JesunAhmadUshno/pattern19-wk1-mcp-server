"""Protocol-level test client for the Week 1 MCP server.

Spawns server.py over stdio with the real MCP client, twice:

  Run A, role analyst: all three tools succeed; an internal note reads.
  Run B, role viewer: search works, the internal read is denied, and the
  log write is denied.

Run it:
    python client_test.py

The transcript is printed to stdout. Save it with:
    python client_test.py | tee RUN_OUTPUT.txt
"""

import asyncio
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

BASE = Path(__file__).parent
PYTHON = sys.executable


def show(label, result):
    text = " ".join(c.text for c in result.content if hasattr(c, "text")).replace("\n", " ")
    flag = "ERROR" if result.isError else "OK"
    print(f"  [{flag}] {label}: {text[:600]}")


async def run(role: str) -> None:
    env = dict(os.environ, MCP_CALLER_ROLE=role)
    params = StdioServerParameters(command=PYTHON, args=[str(BASE / "server.py")], env=env)
    print(f"== Run: role={role} ==")
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("  tools:", ", ".join(t.name for t in tools.tools))
            show("search_notes('gateway')", await session.call_tool("search_notes", {"query": "gateway"}))
            show("read_note('n3') internal", await session.call_tool("read_note", {"note_id": "n3"}))
            show(
                "log_access('client test run')",
                await session.call_tool("log_access", {"entry": "client test run"}),
            )
    print()


async def main() -> None:
    print("Week 1 MCP server: client test transcript")
    print("Server: server.py over stdio transport, official MCP Python SDK")
    print()
    await run("analyst")
    await run("viewer")
    print("== audit.log after both runs ==")
    print((BASE / "audit.log").read_text(encoding="utf-8"), end="")


if __name__ == "__main__":
    asyncio.run(main())
