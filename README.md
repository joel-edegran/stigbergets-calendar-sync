# Stigbergets Calendar Sync

Automates keeping track of new Stigbergets beer releases by fetching product drops from Systembolaget and synchronizing them directly to Google Calendar.

## Overview

This TypeScript project runs on Google Apps Script and automatically synchronizes upcoming Stigbergets beer releases from Systembolaget's e-commerce API to a designated Google Calendar. It supports both full imports and daily incremental checks, and sends out an email summary upon completion.

## Features

- **Automated Sync**: Fetches product release data directly from Systembolaget.
- **Smart Filtering**: Filters products specifically for Stigbergets releases.
- **Calendar Management**: Automatically creates calendar events with detailed product descriptions, prices, alcohol percentages, and direct links.
- **Duplicate Prevention**: Tracks existing events using unique markers to avoid duplicates.
- **Email Notifications**: Sends a summary report of created and skipped events via email after each run.

## Configuration

The project uses a configuration object in `src/config.ts` and requires Google Apps Script properties for authentication and notifications:

- `SYSTEMBOLAGET_API_KEY`: Your subscription key for Systembolaget's external API.
- `NOTIFICATION_EMAIL`: The recipient address for import summary reports.

## Development & Build

This project uses Vite to bundle the TypeScript code for Google Apps Script.

- Install dependencies:
  ```bash
  pnpm install
  ```
