# QMS — Docker delivery (customer)

You receive a small bundle (no application source code):

| File | Purpose |
|------|---------|
| `qms-image.tar` | Docker image (compiled app only) |
| `docker-compose.yml` | Run the container |
| `env.example` | Copy to `.env` and edit |
| `README.md` | This file |

**Vendor** produces the image:

```bash
docker build -t qms:latest /path/to/build-context
docker save qms:latest -o qms-image.tar
```

PostgreSQL is **not** included: use your own server and connection string in `DATABASE_URL`.

## 1. Load the image

```bash
docker load -i qms-image.tar
```

## 2. Uploads folder on the server

Files are stored on the **host**, mounted at `/app/public/uploads` in the container.

- If you set `UPLOADS_HOST_PATH` in `.env` (recommended for production), create that directory and make it writable by user **1001** (the app user inside the image):

```bash
sudo mkdir -p /var/lib/qms/uploads
sudo chown -R 1001:1001 /var/lib/qms/uploads
```

- If you omit `UPLOADS_HOST_PATH`, compose uses a folder named `uploads` next to `docker-compose.yml` (fine for trials).

## 3. Configure environment

```bash
cp env.example .env
# Edit .env: DATABASE_URL, AUTH_SECRET, AUTH_URL, UPLOADS_HOST_PATH
```

### PostgreSQL and Docker

Inside the container, **`localhost` is not your computer** unless we rewrite it.

The bundled `docker-compose.yml` sets **`DOCKER_PG_HOST=host.docker.internal`** so a `DATABASE_URL` that uses **`localhost` or `127.0.0.1`** (the same as `npm start` on the host) is **rewritten automatically** to reach Postgres on the Docker host.

- **Postgres on another server:** put that **hostname or IP** in `DATABASE_URL` (no localhost — nothing is rewritten).
- To disable rewriting, remove `DOCKER_PG_HOST` from compose or set it empty.

`AUTH_URL` must match the URL **in the browser**. With the bundled nginx service (port 80), use **`http://qms`** so users open **`http://qms/login`** (no `:3000`). If you skip nginx and publish the app port directly, use e.g. `http://qms:3000`.

## 4. Database schema

Create an empty database, then apply migrations **once** (from a machine that can reach PostgreSQL). Your vendor should supply migration SQL or a migration procedure. Typical internal command from the project (not in the customer image):

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

## 5. Start

From this directory:

```bash
docker compose up -d
```

Open `AUTH_URL` in the browser (with nginx: port **80** and no `:3000` in the URL).

If logs show **`UntrustedHost`**, ensure `AUTH_TRUST_HOST=true` is set (already in `docker-compose.yml`) and `AUTH_URL` matches how users reach the app.

## Updates

Load a new `qms-image.tar`, then:

```bash
docker compose pull   # if using a registry; otherwise docker load again
docker compose up -d --force-recreate
```

Data in `UPLOADS_HOST_PATH` and your PostgreSQL database are preserved.
