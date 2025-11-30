FROM python:3.10

WORKDIR /app

COPY . /app

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 8000

CMD ["gunicorn", "-k", "eventlet", "-w", "1", "-b", "0.0.0.0:${PORT}", "app:app"]
