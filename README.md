# Trainer

A web application for personal trainers to plan and track client workouts. Built with Kotlin, Angular Material, and H2 — packaged as a single Docker container.

## What It Does

Trainer helps personal trainers who work with clients doing circuit-style workouts:

- **Plan workouts** — Build upper-body and lower-body workout plans for each client, selecting 6-7 exercises per circuit from ranked progressions per muscle group
- **Track sessions** — Record weights, reps, set style (alternating vs. each side), and resistance annotations for every exercise in every session
- **View history** — See a client's workout history in a spreadsheet-style grid (exercises in rows, dated sessions in columns) to spot trends and plan progressions
- **Manage exercises** — Each exercise has a landing page with form notes, technique photos/videos, target muscles, and links to harder/easier variations in the progression
- **Progression planning** — When it's time to advance (every 3-4 sessions), quickly browse exercises by muscle group and progression rank to pick the next step

## Architecture

- **Backend:** Kotlin on Armeria (gRPC + REST on a single port)
- **Frontend:** Angular with Angular Material (dark theme)
- **Database:** H2 in file mode with AES encryption at rest, Flyway migrations
- **Auth:** JWT access tokens + cookie sessions, BCrypt passwords, rate-limited login
- **Deployment:** Single Docker container

### Dependencies

- [h2-kotlin-toolkit](https://github.com/jeffbstewart/h2-kotlin-toolkit) — Database initialization, encryption, backups, schema updaters
- [auth-kotlin-toolkit](https://github.com/jeffbstewart/auth-kotlin-toolkit) — Authentication framework (JWT, sessions, passwords, rate limiting)

## Development

### Prerequisites

- JDK 21+
- Node.js 22+
- Docker (for containerized deployment)

### Backend

```bash
./gradlew run          # Start server on port 9090
```

### Frontend

```bash
cd web-app
npm install
npx ng serve           # Dev server on port 4200, proxies API to :9090
```

### Docker

```bash
docker compose up      # Build and run everything
```

## License

MIT
