SHELL := /bin/bash

.PHONY: install run

install:
	python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

run:
	source .venv/bin/activate && python server.py

