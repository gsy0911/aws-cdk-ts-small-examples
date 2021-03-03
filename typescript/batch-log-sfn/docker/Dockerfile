FROM python:3.9-buster as builder
WORKDIR /opt/app

COPY requirements.txt /opt/app
RUN pip3 install -r requirements.txt
RUN wget https://s3.amazonaws.com/amazoncloudwatch-agent/debian/amd64/latest/amazon-cloudwatch-agent.deb

# ここからは実行用コンテナの準備
FROM python:3.9-slim-buster as runner
WORKDIR /opt/app

COPY --from=builder /opt/app/amazon-cloudwatch-agent.deb /opt/app/amazon-cloudwatch-agent.deb
COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

RUN dpkg -i -E ./amazon-cloudwatch-agent.deb
COPY src /opt/app/src

WORKDIR /opt/app/src
CMD ["python3", "__init__.py"]

