import subprocess
import json
import threading
import uuid
import os
from typing import Dict, Any, List

class SimpleMCPClient:
    """
    A lightweight, custom MCP (Model Context Protocol) Stdio Client for Python 3.9.
    Communicates with the Node.js MCP server via JSON-RPC over stdin/stdout.
    """
    def __init__(self, server_script_path: str):
        self.server_script_path = server_script_path
        self.process = None
        self._responses = {}
        self._lock = threading.Lock()
        self._event = threading.Event()

    def connect(self):
        # Spawn the Node MCP server
        env = os.environ.copy()
        server_root = os.path.abspath(os.path.join(os.path.dirname(self.server_script_path), "..", ".."))
        self.process = subprocess.Popen(
            ["npx", "tsx", self.server_script_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
            cwd=server_root,
        )

        # Start a thread to read responses
        self.reader_thread = threading.Thread(target=self._read_stdout, daemon=True)
        self.reader_thread.start()

        # Send an initialization request (required by MCP protocol)
        self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "claimsure-python-agent", "version": "1.0.0"}
        })
        self._send_notification("notifications/initialized")

    def _read_stdout(self):
        for line in self.process.stdout:
            try:
                msg = json.loads(line.strip())
                if "id" in msg:
                    with self._lock:
                        self._responses[msg["id"]] = msg
                    self._event.set()
            except json.JSONDecodeError:
                pass # Ignore non-JSON logs

    def _send_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        req = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": method
        }
        if params:
            req["params"] = params

        self._event.clear()
        self.process.stdin.write(json.dumps(req) + "\n")
        self.process.stdin.flush()

        # Wait for response (timeout 10s)
        timeout = 10.0
        elapsed = 0.0
        while elapsed < timeout:
            self._event.wait(0.1)
            with self._lock:
                if msg_id in self._responses:
                    return self._responses.pop(msg_id)
            elapsed += 0.1
            self._event.clear()
            
        raise TimeoutError(f"MCP request {method} timed out")

    def _send_notification(self, method: str, params: Dict[str, Any] = None):
        req = {
            "jsonrpc": "2.0",
            "method": method
        }
        if params:
            req["params"] = params
        self.process.stdin.write(json.dumps(req) + "\n")
        self.process.stdin.flush()

    def list_tools(self) -> List[Dict[str, Any]]:
        resp = self._send_request("tools/list")
        return resp.get("result", {}).get("tools", [])

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        return resp.get("result", {})

    def close(self):
        if self.process:
            self.process.terminate()
            self.process.wait()
