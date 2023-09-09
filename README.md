# Stream Overlay

## How to use

1. Start the application _(as defined under [Getting started](#getting-started))_

## Getting started

1. Clone the repository

   ```bash
   git clone https://gitlab.panthor.de/Felix/stream-overlay.git
   ```

2. Set all required environment-variables as defined in the `.env.example`

3. Install all required dependencies

   ```bash
   npm install
   ```

4. Start your application

   ```bash
   npm run start
   # or start the dev-build
   npm run dev
   ```

## Docker

1. Pull the image

   ```bash
   docker pull ghcr.io/tklein1801/stream-overlay:latest
   ```

2. Start an container

   ```bash
   docker run -itd --env-file '.env' --restart on-failure:3 -p '8090:80' --name=stream-overlay docker pull ghcr.io/tklein1801/stream-overlay:latest
   ```

## Workflows

### Publish Docker Image

| Secrets  |   Variables   |
| :------: | :-----------: |
| `GH_PAT` | `IMAGE_NAME`  |
|          | `DOCKER_USER` |

### Deploy Image

|    Secrets     |         Variables          |
| :------------: | :------------------------: |
|   `SSH_HOST`   |        `IMAGE_NAME`        |
|   `SSH_USER`   |       `DOCKER_USER`        |
| `SSH_PASSWORD` |      `CONTAINER_NAME`      |
|    `GH_PAT`    | `SERVER_ENV_FILE_LOCATION` |
