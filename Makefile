dev:
	docker compose up -d
	./scripts/dev.sh

stop:
	docker compose stop
