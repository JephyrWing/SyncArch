"""Prove the release Nginx follows a changed backend DNS address without restart."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import socket
import socketserver
import struct
import subprocess
from threading import Thread
import time
from urllib.error import URLError
from urllib.request import urlopen


def verify_dns_rotation(image):
    assert os.getenv('CI') == 'true', 'Only run against disposable CI containers'
    address = ['127.0.0.1']

    class DNS(socketserver.BaseRequestHandler):
        def handle(self):
            query, transport = self.request
            end = 12
            while query[end]:
                end += query[end] + 1
            end += 5  # terminator, QTYPE, QCLASS
            response = query[:2] + struct.pack('!5H', 0x8180, 1, 1, 0, 0)
            response += query[12:end]
            response += b'\xc0\x0c' + struct.pack('!HHIH', 1, 1, 1, 4) + socket.inet_aton(address[0])
            transport.sendto(response, self.client_address)

    class Backend(BaseHTTPRequestHandler):
        def do_GET(self):
            payload = json.dumps({'server': self.server.server_address[0], 'path': self.path}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):
            pass

    dns = socketserver.ThreadingUDPServer(('127.0.0.1', 0), DNS)
    first = ThreadingHTTPServer(('127.0.0.1', 0), Backend)
    second = ThreadingHTTPServer(('127.0.0.2', first.server_port), Backend)
    servers = (dns, first, second)
    threads = [Thread(target=server.serve_forever, daemon=True) for server in servers]
    container = None
    try:
        for thread in threads:
            thread.start()
        container = subprocess.check_output(['docker', 'run', '-d', '--network', 'host',
            '-e', f'API_UPSTREAM=http://backend.test:{first.server_port}',
            '-e', 'NGINX_ENTRYPOINT_LOCAL_RESOLVERS=',
            '-e', f'NGINX_LOCAL_RESOLVERS=127.0.0.1:{dns.server_address[1]}', image], text=True).strip()

        def wait_for(expected):
            deadline = time.monotonic() + 30
            while True:
                try:
                    with urlopen('http://127.0.0.1:8080/api/dns-probe?preserve=query', timeout=2) as response:
                        result = json.load(response)
                    if result == {'server': expected, 'path': '/api/dns-probe?preserve=query'}:
                        return
                except (OSError, URLError, ValueError):
                    pass
                if time.monotonic() >= deadline:
                    raise RuntimeError('Nginx did not follow backend DNS or preserve the request URI')
                time.sleep(1)

        wait_for('127.0.0.1')
        address[0] = '127.0.0.2'
        first.shutdown()
        first.server_close()
        wait_for('127.0.0.2')
        print('PASS: backend DNS IP changed; same Nginx container recovered and preserved path/query')
    finally:
        if container:
            subprocess.run(['docker', 'rm', '-f', container], check=True, stdout=subprocess.DEVNULL)
        for server in servers:
            server.shutdown()
            server.server_close()
        for thread in threads:
            thread.join(timeout=5)
