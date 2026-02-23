# connector-manifest-writer
Writes an OpenAEV compatible manifest for connectors leveraging PEP621 metadata

## Design goals
* Full python program with an aim of being cross-platform: Windows, most Linux, macOS
* Runs on CLI
* Support python 3.11+
* Can be invoked anywhere: paths (if any) are provided as CLI arguments
* Parse main metadata from pyproject.toml in each component's main dir path
* Load targeted python modules in virtual env; support poetry and pip+venv

## Installing from source
This tool requires `poetry` for managing its dependencies.
```shell
poetry install
```

## Usage
```shell
poetry run python -m connector_manifest_writer [-h] path [path ...]
```

## Requirements
Each `path` must be the root directory of a compatible python module. To be compatible, a module must:

**Define a top-level JSON file called `manifest-metadata.json`**

The contents of `manifest-metadata.json` define the manifest keys for that object. Filigran products have different expectations regarding which keys are required or not.

**Define a top-level `pyproject.toml`**

There must be a `pyproject.toml` file at the root of the specified `path` directories, containing a tool section as such:

```toml
[tool.cmw]
install-command = "..."
config-dump-command = "..."
icon-path = "..."
```

Where:

* `install-command`: this command must atomically and reliably install the module in its own virtual environment with all runtime dependencies. It may write to `stdout`, as this output will be discarded.
* `config-dump-command`: this command must output a valid JSON Schema representing the configuration object for the module. **It must not write any other output on `stdout`**. Note that this command may need to activate the module's virtual environment (installed with `install-command`) before invoking the configuration output.
* `icon-path`: a path relative to `path` pointing to the binary icon file.

### Meeting requirements for OpenAEV

**manifest-metadata.json**

The required keys for this file are:

* `title`
* `slug`
* `description`
* `short_description`
* `use_cases, verified`
* `last_verified_date`
* `playbook_supported`
* `max_confidence_level`
* `support_version`
* `subscription_link`
* `source_code`
* `manager_supported`
* `container_version`
* `container_image`
* `container_type`

**pyproject.toml**

As long as the specified commands honour their contract, it may be up to the module to define the appropriate commands and point to the icon file.

## Process outline

For each `path` argument, the program:

1. loads the contents of `manifest-metadata.json` in memory
2. parses the `[tool.cmw]` section in `pyproject.toml` and
    a. executes `install-command` (discards the output)
    b. executes `config-dump-command` and captures the output on `stdout`. It's important that this command produces only the expected JSON Schema output, or the process will fail for that module.
3. encodes the binary file found at `icon-path` in base64
4. combines all the abvoe outputs into a consolidated JSON object
5. appends that object into the `.contracts` property of the overall JSON manifest object.
6. outputs the resulting overall JSON manifest object over `stdout`.

## Example

### Invocation
```shell
poetry run python -m connector_manifest_writer ../collectors/crowdstrike
```

### manifest-metadata.json
```json
{
  "title": "Crowdstrike",
  "slug": "openaev_crowdstrike",
  "description": "Collect responses from Crowdstrike EDR",
  "short_description": "Collect responses from Crowdstrike EDR",
  "use_cases": ["Security response"],
  "verified": true,
  "last_verified_date": "",
  "playbook_supported": false,
  "max_confidence_level": 80,
  "support_version": "",
  "subscription_link": "https://www.crowdstrike.com/en-us/resources/white-papers/endpoint-detection-and-response/",
  "source_code": "",
  "manager_supported": true,
  "container_version": "rolling",
  "container_image": "openaev/collector-crowdstrike",
  "container_type": "COLLECTOR"
}
```

### pyproject.toml
```toml
[tool.cmw]
install-command = "poetry install"
config-dump-command = "poetry run python -m crowdstrike.openaev_crowdstrike --dump-config-schema"
icon-path = "crowdstrike/img/icon-crowdstrike.png"
```

### Output
```json
{
    "id": "filigran-catalog-id",
    "name": "OpenAEV Connectors contracts",
    "description": "",
    "version": "rolling",
    "contracts": [
        {
            "title": "Crowdstrike",
            "slug": "openaev_crowdstrike",
            "description": "Collect responses from Crowdstrike EDR",
            "short_description": "Collect responses from Crowdstrike EDR",
            "use_cases": [
                "Security response"
            ],
            "verified": true,
            "last_verified_date": "",
            "playbook_supported": false,
            "max_confidence_level": 80,
            "support_version": "",
            "subscription_link": "https://www.crowdstrike.com/en-us/resources/white-papers/endpoint-detection-and-response/",
            "source_code": "",
            "manager_supported": true,
            "container_version": "rolling",
            "container_image": "openaev/collector-crowdstrike",
            "container_type": "COLLECTOR",
            "logo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
            "config_schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "config.schema.json",
                "type": "object",
                "properties": {
                    "OPENAEV_URL": {
                        "description": "The OpenAEV platform URL.",
                        "format": "uri",
                        "maxLength": 2083,
                        "minLength": 1,
                        "type": "string"
                    },
                    "OPENAEV_TOKEN": {
                        "description": "The token for the OpenAEV platform.",
                        "type": "string"
                    },
                    "COLLECTOR_ID": {
                        "description": "ID of the collector.",
                        "type": "string"
                    },
                    "COLLECTOR_NAME": {
                        "description": "Name of the collector",
                        "type": "string"
                    },
                    "COLLECTOR_LOG_LEVEL": {
                        "default": "error",
                        "description": "Determines the verbosity of the logs.",
                        "enum": [
                            "debug",
                            "info",
                            "warn",
                            "error"
                        ],
                        "type": "string"
                    },
                    "COLLECTOR_PERIOD": {
                        "default": "PT1M",
                        "description": "Duration between two scheduled runs of the collector (ISO 8601 format).",
                        "format": "duration",
                        "type": "string"
                    },
                    "COLLECTOR_ICON_FILEPATH": {
                        "default": "crowdstrike/img/icon-crowdstrike.png",
                        "description": "Path to the icon file",
                        "type": "string"
                    },
                    "COLLECTOR_PLATFORM": {
                        "default": "EDR",
                        "description": "Platform type for the collector (e.g., EDR, SIEM, etc.).",
                        "type": "string"
                    },
                    "CROWDSTRIKE_CLIENT_ID": {
                        "description": "The CrowdStrike API client ID.",
                        "type": "string"
                    },
                    "CROWDSTRIKE_CLIENT_SECRET": {
                        "description": "The CrowdStrike API client secret.",
                        "format": "password",
                        "type": "string",
                        "writeOnly": true
                    },
                    "CROWDSTRIKE_API_BASE_URL": {
                        "description": "The base URL for the CrowdStrike APIs. ",
                        "type": "string"
                    },
                    "CROWDSTRIKE_UI_BASE_URL": {
                        "default": "https://falcon.us-2.crowdstrike.com",
                        "description": "The base URL for the CrowdStrike UI you use to see your alerts.",
                        "type": "string"
                    }
                },
                "required": [
                    "OPENAEV_URL",
                    "OPENAEV_TOKEN",
                    "COLLECTOR_ID",
                    "COLLECTOR_NAME",
                    "CROWDSTRIKE_CLIENT_ID",
                    "CROWDSTRIKE_CLIENT_SECRET",
                    "CROWDSTRIKE_API_BASE_URL"
                ],
                "additionalProperties": true
            }
        }
    ]
}
```
