FROM python:3.9-slim-buster

ADD index.py index.py

RUN pip install gunicorn

ENTRYPOINT ["gunicorn", "index:application"]
# CMD ["-b", "0.0.0.0:8000"]
