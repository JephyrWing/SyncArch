"""검증 코드 SMTP 어댑터입니다. 주소·코드·비밀번호를 로그에 남기지 않습니다."""
from email.message import EmailMessage
import smtplib
import ssl

from ..errors import AuthenticationUnavailable


class SmtpMailer:
    def __init__(self, config):
        self.host, self.port = config["SMTP_HOST"], config["SMTP_PORT"]
        self.username, self.password = config["SMTP_USERNAME"], config["SMTP_PASSWORD"]
        self.sender = config["SMTP_FROM"]
        self.ssl, self.starttls = config["SMTP_SSL"], config["SMTP_STARTTLS"]

    @property
    def available(self):
        return bool(self.host and self.sender)

    def send_code(self, address, code):
        if not self.available:
            raise AuthenticationUnavailable()
        message = EmailMessage()
        message["From"], message["To"], message["Subject"] = self.sender, address, "SyncArch 이메일 확인 코드"
        message.set_content("이메일 확인 코드는 " + code + " 입니다. 10분 안에 입력해 주세요.")
        try:
            connection = smtplib.SMTP_SSL(self.host, self.port, timeout=5, context=ssl.create_default_context()) if self.ssl else smtplib.SMTP(self.host, self.port, timeout=5)
            with connection as smtp:
                if self.starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if self.username:
                    smtp.login(self.username, self.password)
                if smtp.send_message(message):
                    raise AuthenticationUnavailable()
        except (OSError, smtplib.SMTPException, ValueError):
            raise AuthenticationUnavailable() from None
