import argparse
import toml
import subprocess
import json
import base64
import ast

def main():
    parser = argparse.ArgumentParser(
        prog='connector-manifest-writer',
        description='Generates and compiles XTM Composer manifests',
        epilog='Good luck')

    parser.add_argument("target", action='extend', nargs='+', default=[])
    args = parser.parse_args()

    contracts = []
    config_schema_str = ""
    for dir in args.target:
        try:
            pyproject_path = "{}/pyproject.toml".format(dir)
            pyproject_contents = toml.load(pyproject_path)

            static_metadata_path = "{}/manifest-metadata.json".format(dir)
            with open(static_metadata_path, "r") as json_data_file:
                static_metadata_contents = json.load(json_data_file)

            tool_cmw = pyproject_contents.get("tool").get("cmw")

            install_process = subprocess.run(tool_cmw.get("install-command").split(), text=True, capture_output=True, cwd=dir)
            if install_process.returncode != 0:
                raise RuntimeError(f"There was a problem installing '{tool_cmw.get('install-command')}'")

            process = subprocess.run(tool_cmw.get("config-dump-command").split(), text=True, capture_output=True, cwd=dir)
            if process.returncode != 0:
                raise RuntimeError(f"problem with command '{tool_cmw.get('config-dump-command')}'")
            config_schema_str = process.stdout

            with open(f"{dir}/{tool_cmw.get('icon-path')}", "rb") as f:
                raw_bytes = f.read()
            logo_b64 = base64.b64encode(raw_bytes).decode("utf-8")
            logo_str = f"data:image/png;base64,{logo_b64}"

            static_metadata_contents["logo"] = logo_str
            static_metadata_contents["config_schema"] = ast.literal_eval(config_schema_str)

            contracts.append(static_metadata_contents)
        except Exception as e:
            raise RuntimeError(f"There was a problem processing directory '{dir}'; install process: {install_process}; Dump process: {process}") from e

    manifest = {"id": "filigran-catalog-id", "name": "OpenAEV Connectors contracts", "description": "",
                "version": "rolling", "contracts": contracts}

    print(json.dumps(manifest, indent=4))

if __name__ == "__main__":
    main()
