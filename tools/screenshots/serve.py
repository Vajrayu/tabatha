import http.server, os, socketserver
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sites")
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        host = (self.headers.get("Host") or "").split(":")[0]
        p = path.split("?")[0]
        if p == "/": p = "/index.html"
        return os.path.join(ROOT, host, p.lstrip("/"))
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(("127.0.0.1", 80), H).serve_forever()
