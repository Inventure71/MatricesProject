import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from calculator import calculate_demo_model


class DemoRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/model":
            payload = json.dumps(calculate_demo_model()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        super().do_GET()


def main():
    server = ThreadingHTTPServer(("localhost", 5173), DemoRequestHandler)
    print("Serving Sparse SVD demo at http://localhost:5173")
    server.serve_forever()


if __name__ == "__main__":
    main()
