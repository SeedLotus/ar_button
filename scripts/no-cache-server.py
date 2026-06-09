from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Clear-Site-Data", '"cache"')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
    server = ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"Serving no-cache dev server at http://127.0.0.1:{port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
