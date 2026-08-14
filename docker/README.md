# Self-Hosting with Docker/Podman with Compose

## Stack

| service    | Image                     | Description     |
| ---------- | ------------------------- | --------------- |
| **client** | `ghcr.io/readest/readest` | readest reader  |

### Exposed ports

| Port   | Service |
| ------ | ------- |
| `3000` | readest |

---

## Running with Docker/Podman Compose

### 1. setup .env

```bash
cp docker/.env.example docker/.env
```

update `docker/.env` if you want a different image or a self-hosted CJK font mirror.

### 2. Add your books

Drop `.epub` files into `apps/readest-app/data/books/` — the compose file bind-mounts
this directory into the container. Open a book at `http://localhost:3000/?book=<filename>.epub`.

### 3. Start the Stack (pull prebuilt client image)

run from the `docker/` directory:

```bash
cd docker
docker compose up -d
```

this pulls `${READEST_IMAGE}` (default: `ghcr.io/readest/readest:latest`) instead of building the client locally.

if you prefer Docker Hub, set `READEST_IMAGE` in `docker/.env`, for example:

```env
READEST_IMAGE=docker.io/your-dockerhub-username/readest:latest
```

replace `your-dockerhub-username` with the Docker Hub namespace that publishes your `readest` image.
for official images, use the namespace configured for this repository's Docker Hub publishing secrets.

published tags:
- `latest`: rolling image from the default branch and from release events
- `<release-tag>` (for example `v1.2.3`): published from release events
- `main`: rolling image from the default branch
- `sha-<commit>`: immutable commit tag

### Build locally instead of pulling

> **Prerequisites for local builds**: the `packages/js-mdict` and `packages/simplecc-wasm` git submodules must be initialized before building:
> ```bash
> git submodule update --init packages/js-mdict packages/simplecc-wasm
> ```
> In GitHub Codespaces this is done automatically via `.devcontainer/devcontainer.json`.

```bash
cd docker
docker compose -f compose.yaml -f compose.build.yaml up --build -d
```

### 4. Access

- Readest app: `http://localhost:3000`

### Hot Reload (development)

> **Prerequisites**: submodules must be initialized (see above).

to develop using the compose stack, use `compose.dev.yaml` which sets the build target to `development-stage` (Next.js dev server) and mounts your local repo for hot reload:

```bash
cd docker
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
```

the first mount overlays your local repo into the container. the remaining anonymous volumes shadow the directories that were pre-built inside the image, so the container's installed deps and vendor assets are used instead of what's on your host.

### Stop the Stack

```bash
cd docker
docker compose down
```

---

## Serving from a custom domain

`nginx.conf.example` is a working starting point for terminating TLS in front of the client.

### CJK fonts on a custom domain

the reader loads a few CJK webfont bundles from Readest's CDN, which only sends
`Access-Control-Allow-Origin` for readest.com origins, so the browser blocks them
on a self-hosted domain. mirror
`https://storage.readest.com/public/font/dist/<Family>/` (and the `.woff2` files it
references) onto a path your proxy serves, then point the client at it:

```env
FONT_BASE_URL=https://your-domain.com/fonts
```

leaving `FONT_BASE_URL` empty keeps the default CDN. system and Google fonts are
unaffected either way.

---

## Building the Dockerfile standalone

```bash
docker build \
  --target production-stage \
  --build-arg NEXT_PUBLIC_APP_PLATFORM=web \
  -t readest-client \
  .
```

run the built image:

```bash
docker run -p 3000:3000 \
  -e BOOKS_DIR=/app/apps/readest-app/data/books \
  -v $(pwd)/apps/readest-app/data/books:/app/apps/readest-app/data/books \
  readest-client
```
