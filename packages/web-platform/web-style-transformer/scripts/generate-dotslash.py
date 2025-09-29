#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "blake3>=1.0.6",
# ]
# ///

# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

# This is modified from https://github.com/facebook/dotslash-publish-release/blob/9c9ec027515c34db9282a09a25a9cab5880b2c52/process_config.py

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import tempfile

from functools import cache
from typing import Any, Dict, Literal, Optional, Tuple, Union


HashAlgorithm = Literal["blake3", "sha256"]
ArtifactFormat = Literal["gz", "tar", "tar.gz", "tar.zst", "zst", "tar.xz", "xz", "zip"]

# Recognized properties in the JSON config.
OUTPUTS_PARAM = "outputs"
EXCLUDE_HTTP_PROVIDER_PARAM = "exclude-http-provider"
EXCLUDE_GITHUB_PROVIDER_PARAM = "exclude-github-release-provider"


def main() -> None:
    exit_code = _main()
    sys.exit(exit_code)


def _main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler()],
    )

    args = parse_args()
    repo: str = args.repo
    if not repo:
        raise ValueError(
            "no repo specified: must specify --repo or set the GITHUB_REPOSITORY environment variable"
        )

    output_folder = args.output
    if not output_folder:
        output_folder = tempfile.mkdtemp(prefix=f"{repo.replace('/', '_')}_dotslash")
    logging.info(f"DotSlash files will be written to `{output_folder}")

    tag = args.tag
    github_server_url = args.server
    api_server_url = args.api_server
    gh_repo_arg = f"{github_server_url}/{repo}"

    if args.local_config:
        print(args.config)
        with open(args.config, "r") as f:
            config = json.load(f)
    else:
        config = get_config(
            path_to_config=args.config,
            config_ref=args.config_ref,
            github_repository=repo,
            api_url=api_server_url,
        )
    if not isinstance(config, dict):
        logging.error(f"config should be a dict, but was:")
        logging.error(json.dumps(config, indent=2))
        return 1

    outputs = config.get(OUTPUTS_PARAM)
    if not outputs:
        logging.error(f"no {OUTPUTS_PARAM} specified in config:")
        logging.error(json.dumps(config, indent=2))
        return 1

    exclude_http_provider = config.get(EXCLUDE_HTTP_PROVIDER_PARAM, False)
    if not isinstance(exclude_http_provider, bool):
        logging.error(
            f'"{EXCLUDE_HTTP_PROVIDER_PARAM}" field must be a boolean, but was `{exclude_http_provider}`'
        )
        return 1
    exclude_github_release_provider = config.get(EXCLUDE_GITHUB_PROVIDER_PARAM, False)
    if not isinstance(exclude_github_release_provider, bool):
        logging.error(
            f'"{EXCLUDE_GITHUB_PROVIDER_PARAM}" field must be a boolean, but was `{exclude_github_release_provider}`'
        )
        return 1

    logging.info("using config:")
    logging.info(json.dumps(config, indent=2))

    name_to_asset = get_release_assets(tag=tag, github_repository=repo)
    logging.info(json.dumps(name_to_asset, indent=2))

    for output_filename, output_config in outputs.items():
        platform_entries = map_platforms(output_config, name_to_asset)
        if not isinstance(platform_entries, dict):
            logging.error(f"failed with error type {platform_entries}")
            return 1

        logging.info(json.dumps(platform_entries, indent=2))

        manifest_file_contents = generate_manifest_file(
            output_filename,
            gh_repo_arg,
            tag,
            platform_entries,
            include_http_provider=not exclude_http_provider,
            include_github_release_provider=not exclude_github_release_provider,
        )
        logging.info(manifest_file_contents)

        output_file = os.path.join(output_folder, output_filename)
        with open(output_file, "w") as f:
            f.write(manifest_file_contents)

            # `chmod +x` if not on Windows.
            if not sys.platform.startswith('win'):
                fd = f.fileno()
                os.fchmod(fd, 0o755)
        logging.info(f"wrote manifest to {output_file}")

        if args.upload:
            # Upload manifest to release, but do not clobber. Note that this may
            # fail if this action has been called more than once for the same config.
            subprocess.run(
                [
                    "gh",
                    "release",
                    "upload",
                    tag,
                    output_file,
                    "--repo",
                    gh_repo_arg,
                ],
                check=True
            )

    return 0


def generate_manifest_file(
    name: str,
    gh_repo_arg: str,
    tag: str,
    platform_entries,
    include_http_provider: bool,
    include_github_release_provider: bool,
) -> str:
    platforms = {}
    with tempfile.TemporaryDirectory() as temp_dir:
        for platform_name, platform_entry in platform_entries.items():
            asset, platform_config = platform_entry
            hash_algo = platform_config.get("hash", "blake3")
            size = asset.get("size")
            if size is None:
                logging.error(f"missing 'size' field in asset: {asset}")
                return 1

            asset_name = asset.get("name")
            if asset_name is None:
                logging.error(f"missing 'name' field in asset: {asset}")
                return 1

            # lynx-stack modifed start: add `.format(tag=tag)`
            path = platform_config.get("path").format(tag=tag)
            # lynx-stack modifed end.
            if not path:
                logging.error(f"missing `path` field in asset: {asset}")
                return 1

            if "format" in platform_config:
                # If the user is knowingly not using any sort of compression,
                # then `"format": null` must be explicitly specified in the JSON.
                asset_format = platform_config["format"]
            else:
                asset_format = guess_artifact_format_from_asset_name(asset_name)
                if not asset_format:
                    logging.error(
                        f'"format" could not be inferred from asset name: {asset_name} in {asset}, must specify explicitly'
                    )
                    return 1

            hash_hex = compute_hash(
                gh_repo_arg, temp_dir, tag, asset_name, hash_algo, size
            )

            providers = []
            if include_http_provider:
                providers.append(
                    {
                        "url": asset["url"],
                    }
                )
            if include_github_release_provider:
                providers.append(
                    {
                        "type": "github-release",
                        "repo": gh_repo_arg,
                        "tag": tag,
                        "name": asset_name,
                    }
                )

            artifact_entry = {
                "size": size,
                "hash": hash_algo,
                "digest": hash_hex,
                "format": asset_format,
                "path": path,
                "providers": providers,
            }

            # If `"format": null` was specified, there should not be a "format"
            # field in the arifact entry.
            if not asset_format:
                del artifact_entry["format"]

            platforms[platform_name] = artifact_entry

    manifest = {
        "name": name,
        "platforms": platforms,
    }

# lynx-stack modified start: Add auto-generated header
    return f"""#!/usr/bin/env dotslash

// AUTO GENERATED. DO NOT MODIFY

// This is generated with
// `uv run ./scripts/generate-dotslash.py --config ./scripts/dotslash-config.json --repo wasm-bindgen/wasm-bindgen --tag {tag} --local-config --output ./scripts`

{json.dumps(manifest, indent=2)}
"""
# lynx-stack modified end.


def map_platforms(
    config, name_to_asset: Dict[str, Any]
) -> Union[
    Dict[str, Tuple[Any, Any]],
    Literal["BothNameAndRegex", "NeitherNameNorRegex", "NoMatchForAsset", "ParseError"],
]:
    """Attempts to take every platform specified in the config and return a map
    of platform names to their corresponding asset information. If successful,
    each value in the dict will be a tuple of (asset, platform_config).

    Note that it is possible that not all assets have been uploaded yet, in
    which case "NoMatchForAsset" will be returned.
    """
    platforms = config.get("platforms")
    if platforms is None:
        logging.error("'platforms' field missing from config: {config}")
        return "ParseError"

    platform_entries = {}
    for platform, platform_config in platforms.items():
        name = platform_config.get("name")
        name_regex = platform_config.get("regex")
        if name and name_regex:
            logging.error(
                f"only one of 'name' and 'regex' should be specified for {platform}"
            )
            return "BothNameAndRegex"
        elif not name and not name_regex:
            logging.error(
                f"exactly one of 'name' and 'regex' should be specified for {platform}"
            )
            return "NeitherNameNorRegex"

        if name:
            # Try to match the name exactly:
            for asset_name, asset in name_to_asset.items():
                if asset_name == name:
                    platform_entries[platform] = (asset, platform_config)
                    break
            if platform in platform_entries:
                continue
            else:
                logging.error(f"could not find asset with name '{name}'")
                return "NoMatchForAsset"
        else:
            # Try to match the name using a regular expression.
            regex = re.compile(name_regex)
            for asset_name, asset in name_to_asset.items():
                if regex.match(asset_name):
                    platform_entries[platform] = (asset, platform_config)
                    break
            if platform in platform_entries:
                continue
            else:
                logging.error(f"could not find asset matching regex '{name_regex}'")
                return "NoMatchForAsset"

    return platform_entries


@cache
def compute_hash(
    gh_repo_arg: str,
    temp_dir: str,
    tag: str,
    name: str,
    hash_algo: HashAlgorithm,
    size: int,
) -> str:
    """Fetches the release entry corresponding to the specified (tag, name) tuple,
    fetches the contents, verifies the size matches, and computes the hash.

    Return value is a hex string representing the hash.
    """
    output_filename = os.path.join(temp_dir, name)

    # Fetch the url using the gh CLI to ensure authentication is handled correctly.
    args = [
        "gh",
        "release",
        "download",
        tag,
        "--repo",
        gh_repo_arg,
        # --pattern takes a "glob pattern", though we want to match an exact
        # filename. Using re.escape() seems to do the right thing, though adding
        # ^ and $ appears to break things.
        "--pattern",
        re.escape(name),
        "--output",
        output_filename,
    ]
    subprocess.run(args, check=True)
    stats = os.stat(output_filename)
    if stats.st_size != size:
        raise Exception(f"expected size {size} for {name} but got {stats.st_size}")

    if hash_algo == "blake3":
        import blake3

        hasher = blake3.blake3()
        with open(output_filename, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        digest = hasher.digest()
        return digest.hex()
    elif hash_algo == "sha256":
        import hashlib

        hasher = hashlib.sha256()
        with open(output_filename, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()


def get_config(
    *, path_to_config: str, config_ref: str, github_repository: str, api_url: str
) -> Any:
    args = [
        "gh",
        "api",
        "-X",
        "GET",
        f"{api_url}/repos/{github_repository}/contents/{path_to_config}",
        "-H",
        "Accept: application/vnd.github.raw",
        "-f",
        f"ref={config_ref}",
    ]
    output = subprocess.check_output(args)
    return json.loads(output.decode("utf-8"))


def get_release_assets(*, tag: str, github_repository) -> Dict[str, Any]:
    args = [
        "gh",
        "release",
        "view",
        tag,
        "--repo",
        github_repository,
        "--json",
        "assets",
    ]
    output = subprocess.check_output(args)
    release_data = json.loads(output.decode("utf-8"))
    assets = release_data.get("assets")
    if not assets:
        raise Exception(f"no assets found for release '{tag}'")
    return {asset["name"]: asset for asset in assets if asset["state"] == "uploaded"}


def guess_artifact_format_from_asset_name(asset_name: str) -> Optional[ArtifactFormat]:
    if asset_name.endswith(".tar.gz") or asset_name.endswith(".tgz"):
        return "tar.gz"
    elif asset_name.endswith(".tar.zst") or asset_name.endswith(".tzst"):
        return "tar.zst"
    elif asset_name.endswith(".tar.xz"):
        return "tar.xz"
    elif asset_name.endswith(".tar"):
        return "tar"
    elif asset_name.endswith(".gz"):
        return "gz"
    elif asset_name.endswith(".zst"):
        return "zst"
    elif asset_name.endswith(".xz"):
        return "xz"
    elif asset_name.endswith(".zip"):
        return "zip"

    else:
        return None


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate DotSlash files for a GitHub release"
    )

    parser.add_argument("--tag", required=True, help="tag identifying the release")
    parser.add_argument("--config", required=True, help="path to JSON config file")
    parser.add_argument(
        "--local-config",
        action="store_true",
        help="if specified, --config is treated as a local path and --config-ref is ignored",
    )
    parser.add_argument(
        "--repo",
        help="github repo specified in `ORG/REPO` format",
        default=os.getenv("GITHUB_REPOSITORY"),
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="if specified, upload the generated DotSlash files to the release",
    )

    # It would make things slightly easier for the user to default to the
    # default branch of the repo, which might not be main.
    default_config_ref = "main"
    parser.add_argument(
        "--config-ref",
        help=f"SHA of Git commit to look up the config, defaults to {default_config_ref}",
        default=os.getenv("GITHUB_SHA", default_config_ref),
    )

    default_server = "https://github.com"
    parser.add_argument(
        "--server",
        help=f"URL for the GitHub server, defaults to {default_server}",
        default=os.getenv("GITHUB_SERVER_URL", default_server),
    )

    default_api_server = "https://api.github.com"
    parser.add_argument(
        "--api-server",
        help=f"URL for the GitHub API server, defaults to {default_api_server}",
        default=os.getenv("GITHUB_API_URL", default_api_server),
    )

    parser.add_argument(
        "--output",
        help=f"folder where DotSlash files should be written, defaults to $GITHUB_WORKSPACE",
        default=os.getenv("GITHUB_WORKSPACE"),
    )

    return parser.parse_args()


if __name__ == "__main__":
    main()
