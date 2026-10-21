"""외부 수신자 없이 로컬 SMTP 프로토콜로 실제 smtplib 어댑터를 검증합니다."""
from email import policy
from email.parser import BytesParser
import socketserver
from threading import Thread
from unittest.mock import patch

import pytest

from app.errors import AuthenticationUnavailable
from app.services.mail_service import SmtpMailer


@pytest.fixture
def smtp_server():
    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            self.wfile.write(b"220 fixture.local ESMTP\r\n")
            while line := self.rfile.readline():
                command = line.split(b" ", 1)[0].strip().upper()
                if command in {b"EHLO", b"HELO"}:
                    self.wfile.write(b"250 fixture.local\r\n")
                elif command == b"DATA":
                    self.wfile.write(b"354 End with dot\r\n")
                    raw = b""
                    while (body := self.rfile.readline()) not in {b".\r\n", b""}:
                        raw += body[1:] if body.startswith(b"..") else body
                    self.server.messages.append(BytesParser(policy=policy.default).parsebytes(raw))
                    self.wfile.write(b"250 Accepted\r\n")
                elif command == b"QUIT":
                    self.wfile.write(b"221 Bye\r\n")
                    return
                elif command == b"RCPT" and self.server.refuse:
                    self.wfile.write(b"550 Refused\r\n")
                else:
                    self.wfile.write(b"250 OK\r\n")
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    server.messages, server.refuse = [], False
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


def mailer(server):
    return SmtpMailer({"SMTP_HOST": "127.0.0.1", "SMTP_PORT": server.server_address[1],
        "SMTP_USERNAME": "", "SMTP_PASSWORD": "", "SMTP_FROM": "fixture@syncarch.example",
        "SMTP_SSL": False, "SMTP_STARTTLS": False})


def test_real_local_smtp_adapter_delivers_unicode_message(smtp_server, caplog):
    mailer(smtp_server).send_code("receiver@fixture.example", "735291")
    assert len(smtp_server.messages) == 1
    message = smtp_server.messages[0]
    assert message["To"] == "receiver@fixture.example" and message["Subject"] == "SyncArch 이메일 확인 코드"
    assert "735291" in message.get_content() and "10분" in message.get_content()
    assert "735291" not in caplog.text and "receiver@fixture.example" not in caplog.text


def test_real_local_smtp_refusal_and_transport_failure_are_unavailable(smtp_server):
    smtp_server.refuse = True
    with pytest.raises(AuthenticationUnavailable):
        mailer(smtp_server).send_code("receiver@fixture.example", "735291")
    with patch("smtplib.SMTP", side_effect=OSError("private-smtp-password")):
        with pytest.raises(AuthenticationUnavailable) as error:
            mailer(smtp_server).send_code("receiver@fixture.example", "735291")
    assert "private-smtp-password" not in str(error.value)
