# Stream Overlay

[![Status](https://status.tklein.it/api/badge/15/status?style=for-the-badge)]() [![Uptime](https://status.tklein.it/api/badge/15/uptime?style=for-the-badge)]()

## Features

|                           Feature                           |                                                                                                                               Beschreibung                                                                                                                                |
| :---------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| _Mit Twitch anmelden (erstmaligen Access-Token generieren)_ |                                                                                                        Endpunkt `/auth/login` aufrufen und mittels Twich anmelden                                                                                                         |
|                 _Status manuell überprüfen_                 |                                                                                                                      Endpunkt `/bot/status` aufrufen                                                                                                                      |
|             _(Manuell) Access-Token speichern_              |                                                                                                                                                                                                                                                                           |
|                        _Bot starten_                        | Endpunkt `/bot/init` aufrufen <br />(Setzt voraus dass ein gültiger Access-Token vorhanden ist. Um diesen Endpunkt zu erreichen muss die Umgebungsvariable `BOT_INIT_PASSWORD` gesetzt sein und mittels dem Query-Parameter `password` an den Endpunkt mitgegeben werden) |
|                            _ff_                             |                                                                                                                                                                                                                                                                           |
|                            _ff_                             |                                                                                                                                                                                                                                                                           |
|                            _ff_                             |                                                                                                                                                                                                                                                                           |

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

|    Secrets     |         Variables          |
| :------------: | :------------------------: |
|   `SSH_HOST`   |        `IMAGE_NAME`        |
|   `SSH_USER`   |       `DOCKER_USER`        |
| `SSH_PASSWORD` |      `CONTAINER_NAME`      |
|    `GH_PAT`    | `SERVER_ENV_FILE_LOCATION` |
