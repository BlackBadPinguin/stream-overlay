# Stream Overlay

[![Status](https://status.tklein.it/api/badge/15/status?style=for-the-badge)]() [![Uptime](https://status.tklein.it/api/badge/15/uptime?style=for-the-badge)]()

## Features

- Anmelden mittels Twitch

  _Mittels Twitch anmelden und einen Access-Token abrufne_

- Statusendpunkt

  _Erreichbar unter `/bot/status`_

- Dynamisches Stream-Overlay

  > You are able to customize the overlay by providing these query-parameters

  ```
  https://overlay.tklein.it/static/index.html?...
  ```

  |  Param   |        Description        |              Example               |
  | :------: | :-----------------------: | :--------------------------------: |
  |  `name`  |     Whats your name?      |               Bobby                |
  |  `rank`  |    Position @ Panthor     |             Entwickler             |
  |  `img`   | Source URL of your avatar | https://...b23446f5f7639b1-128.jpg |
  | `stream` |   Current stream title    |       Bohrinsel für Bollmann       |

### Bot

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
