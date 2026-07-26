# Chill Jade Hermes skill

This directory contains an installable [Hermes Agent](https://hermes-agent.nousresearch.com/docs) skill for operating a self-hosted **Chill Jade · 浅草玉简** instance.

> “浅草” refers to the creator's online name, **Chill**. It is not a reference to the Japanese place name.

## Install

```bash
# Direct install from this repository (works even before any registry listing exists)
hermes skills install \
  https://raw.githubusercontent.com/Asakushen/chill-jade/main/skills/chill-jade/SKILL.md
```

Or add the repository as a source, then browse/install from it:

```bash
hermes skills tap add Asakushen/chill-jade
hermes skills search chill-jade
```

For a manual installation, copy `skills/chill-jade/` into your Hermes skills directory and begin a fresh session.

## Configure safely

The skill deliberately ships without any live endpoint, database ID, bookmark data, password, or API key. Configure the following values in your own secret/config mechanism:

```text
CHILL_JADE_API_URL=https://bookmarks.example.com
CHILL_JADE_API_KEY=<store-this-as-a-secret>
```

The API key can write, edit, delete, and export bookmarks. For non-browser automation it is required, so keep it in the instance owner's secret/config store; do not put it in chat logs, tracked `.env` files, screenshots, or any copied skill directory. If a secret store is unavailable, use the normal browser login flow rather than pasting a long-lived key into a conversation.

## What it does

- reads page metadata through Hermes web tools;
- normalizes URLs and checks for an existing bookmark;
- proposes a title, short reason, category, tags, accent, and visibility;
- creates or updates records through the Chill Jade API;
- treats bookmark exports as private data.

The detailed procedure, API contract, privacy rules, and verification checklist are in [SKILL.md](SKILL.md).

## Compatibility

The skill targets the open-source Chill Jade API in this repository. Deploy your own instance first, then point `CHILL_JADE_API_URL` at it.

## License

MIT, matching the main project.
