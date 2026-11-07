"""Assertion tests for the gate in server.py.

client_test.py prints a transcript; these tests fail if a decision changes.
They call the tool functions directly with the standard library only. If the
MCP SDK is not installed, a stand-in FastMCP whose tool() decorator returns
the function unchanged is used, so the gate logic is tested either way.

Run: python -m unittest discover -s tests -v
"""

import importlib
import sys
import tempfile
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    import mcp.server.fastmcp  # noqa: F401
except ImportError:
    class _FastMCP:
        def __init__(self, name):
            self.name = name

        def tool(self):
            return lambda fn: fn

    stub = types.ModuleType("mcp.server.fastmcp")
    stub.FastMCP = _FastMCP
    sys.modules.update({"mcp": types.ModuleType("mcp"), "mcp.server": types.ModuleType("mcp.server"), "mcp.server.fastmcp": stub})

server = importlib.import_module("server")


class GateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        server.AUDIT_LOG = self.tmp / "audit.log"
        server.ACCESS_LOG = self.tmp / "access.log"

    def as_role(self, role):
        server.ROLE = role

    def audit_lines(self):
        return [l.split(" ", 1)[1] for l in server.AUDIT_LOG.read_text(encoding="utf-8").splitlines()]

    def test_recorded_client_sequence(self):
        """The six calls of client_test.py give the six audit lines in RUN_OUTPUT.txt."""
        for role in ("analyst", "viewer"):
            self.as_role(role)
            server.search_notes("gateway")
            for call, arg in ((server.read_note, "n3"), (server.log_access, "client test run")):
                try:
                    call(arg)
                except PermissionError:
                    pass
        recorded = [l.split(" ", 1)[1] for l in (ROOT / "RUN_OUTPUT.txt").read_text(encoding="utf-8").splitlines() if " role=" in l and l[:4].isdigit()]
        self.assertEqual(self.audit_lines(), recorded)

    def test_viewer_search_hides_internal(self):
        self.as_role("viewer")
        self.assertEqual(server.search_notes("internal"), "no visible notes match")
        self.as_role("analyst")
        self.assertIn('"n3"', server.search_notes("internal"))

    def test_admin_can_do_everything(self):
        self.as_role("admin")
        self.assertIn("Client contract terms", server.read_note("n5"))
        self.assertEqual(server.log_access("x"), "logged: x")

    def test_unknown_role_denied_everything(self):
        self.as_role("intruder")
        with self.assertRaises(PermissionError):
            server.search_notes("a")
        self.assertIn("decision=DENY", self.audit_lines()[0])

    def test_unknown_note_is_denied_and_logged(self):
        self.as_role("admin")
        with self.assertRaisesRegex(PermissionError, "no note with id n99"):
            server.read_note("n99")
        self.assertEqual(self.audit_lines(), ["role=admin tool=read_note decision=DENY reason=no note with id n99"])


if __name__ == "__main__":
    unittest.main()
