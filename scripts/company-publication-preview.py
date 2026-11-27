#!/usr/bin/env python3
"""Loopback-only acceptance route, backed by verified publication artifacts."""
import argparse, http.server, importlib.util, pathlib, re, urllib.parse

def handler(db,root,worker):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def do_GET(self):
            path=urllib.parse.urlsplit(self.path).path
            match=re.fullmatch(r'/company/([a-z0-9][a-z0-9-]{0,62})/(index\.html|profile\.(css|json|md)|llms\.txt|media/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp))?',path)
            if not match: self.send_error(404); return
            slug,name=match.group(1),match.group(2);name=name or 'index.html'
            try:
                directory=worker.resolve_local(db,root,slug)
                if directory is None: self.send_error(404); return
                file=directory/name
                if not file.is_file(): self.send_error(404); return
                data=file.read_bytes()
            except Exception:
                self.send_error(503,'Publication unavailable'); return
            types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}
            self.send_response(200);self.send_header('Content-Type',types[file.suffix]);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Robots-Tag','noindex, nofollow');self.end_headers();self.wfile.write(data)
    return Handler

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--psql',default='psql');p.add_argument('--database',required=True);p.add_argument('--db-port',type=int,default=55487);p.add_argument('--port',type=int,default=8087);p.add_argument('--artifacts',required=True);a=p.parse_args()
    spec=importlib.util.spec_from_file_location('worker',pathlib.Path(__file__).with_name('company-publication-worker.py'));w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',a.port),handler(w.Database(a.psql,a.db_port,a.database),a.artifacts,w));server.serve_forever()

if __name__=='__main__':main()
