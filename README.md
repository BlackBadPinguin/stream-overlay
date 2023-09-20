# Stream Overlay

[![Status](https://status.tklein.it/api/badge/15/status?style=for-the-badge)]() [![Uptime](https://status.tklein.it/api/badge/15/uptime?style=for-the-badge)]()

## ToC

- [Features](#features)
- [Getting started](#getting-started)
- [Docker](#docker)
- [Workflow](#workflows)
- [FaQ](#faq)
- [Commands](#commands)

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
   docker run -itd -v test-volume:/app/stream-overlay/data --env-file '.env' --restart on-failure:3 -p '8090:80' --name=stream-overlay docker pull ghcr.io/tklein1801/stream-overlay:latest
   ```

## Workflows

> Make sure that **the user** which executes the workflow **has permissions** to **manage docker volumes and docker containers**

> The provided Github Personal Access Token need to have permission to read and write to the Github Package Registry

### Publish Docker Image

| Secrets  |   Variables   |
| :------: | :-----------: |
| `GH_PAT` | `IMAGE_NAME`  |
|          | `DOCKER_USER` |

### Deploy Image

> Variables marked with `ENV-PROD` are defined in the enviroment `production`

|          Secrets          |              Variables               |
| :-----------------------: | :----------------------------------: |
|   `SSH_HOST` (ENV-PROD)   |             `IMAGE_NAME`             |
|   `SSH_USER` (ENV-PROD)   |            `DOCKER_USER`             |
| `SSH_PASSWORD` (ENV-PROD) |     `CONTAINER_NAME` (ENV-PROD)      |
|         `GH_PAT`          | `SERVER_ENV_FILE_LOCATION`(ENV-PROD) |

## FaQ

<details>
  <summary><strong>Sign in with Twitch</strong></summary>

- Visit `/auth/login` and sign in with your Twitch account (prefered PanthorDE)

</details>

<details>
  <summary><strong>Save access-token</strong></summary>

- Send a request to `POST /auth/token` with the following payload

```
{
  "token": <TOKEN> // string or object
}
```

</details>

<details>
  <summary><strong>Start Bot/Event-Listener</strong></summary>

> Sign in with Twitch beforehand or save a valid access token

> The endpoint is only reachable if the environment variable `BOT_INIT_PASSWORD` is set. The value of the variable must be specified as the query parameter `password`.

- Call the endpoint `/bot/init` and wait about 2 seconds

</details>

<details>
  <summary><strong>Overlay</strong></summary>

> You are able to customize the overlay by providing these query parameters

```
https://overlay.tklein.it/static/index.html?...
```

|  Param   |        Description        |              Example               |
| :------: | :-----------------------: | :--------------------------------: |
|  `name`  |     Whats your name?      |               Bobby                |
|  `rank`  |    Position @ Panthor     |             Entwickler             |
|  `img`   | Source URL of your avatar | https://...b23446f5f7639b1-128.jpg |
| `stream` |   Current stream title    |       Bohrinsel für Bollmann       |

</details>

## Commands

> Prefix for commands is defined in the [`src/app.config.ts`](./src/app.config.ts)

|   Command    |      Syntax      |                    Description                    |
| :----------: | :--------------: | :-----------------------------------------------: |
|    `ping`    |      `ping`      |                 Will return pong                  |
|   `server`   |     `server`     | Will provide some basic information about Panthor |
| `mitspielen` |   `mitspielen`   | Will provide some basic information about Panthor |
|    `hint`    | `hint <MESSAGE>` |         Show hint on your stream-overlay          |
|   `topic`    | `topic <TOPIC>`  |        Change topic on your stream-overlay        |
|    `time`    | `time <MINUTER>` |                Set timer/countdown                |
|   `scene`    | `scene <SCENE>`  |             Switch your current scene             |
