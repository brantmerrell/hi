dev:
	docker-compose up -d
	cd backend && .venv/bin/uvicorn app.main:app --reload & \
	cd frontend && npm run dev; \
	kill %1

stop:
	docker-compose stop
