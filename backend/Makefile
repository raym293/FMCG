SHELL := /bin/bash

.PHONY: install test run

install:
	python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

test:
	source .venv/bin/activate && PYTHONPATH=. python -m unittest discover -s tests

run:
	source .venv/bin/activate && uvicorn app.main:app --reload

