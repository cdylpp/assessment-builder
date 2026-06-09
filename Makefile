.PHONY: help dev dev-reset down logs

COMPOSE := docker compose -f compose.yml

help:
	@echo "Available targets:"
	@echo "  make dev        Start the development stack"
	@echo "  make dev-reset  Stop stack, delete dev volumes, rebuild, and start fresh"
	@echo "  make down       Stop the development stack"
	@echo "  make logs       Tail stack logs"

dev:
	$(COMPOSE) up --build

dev-reset:
	@echo "WARNING: this deletes the local Postgres dev volume and all dev data."
	$(COMPOSE) down --volumes --remove-orphans
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f
