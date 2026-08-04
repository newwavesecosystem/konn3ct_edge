# Konn3ct Scripts

This directory contains utility and maintenance scripts for the Konn3ct platform.

## Contents

- **`create-test-db.ts`**: A TypeScript script used to seed or reset the database for testing purposes. It ensures that the database is in a clean, predictable state before running integration or end-to-end tests.

## Usage

To execute scripts in this directory, it is recommended to use `ts-node` or `tsx` from the project root. For example:

```bash
npx tsx scripts/create-test-db.ts
```

*Note: Ensure your `.env` or `.env.test` file is properly configured with the correct `DATABASE_URL` before running database manipulation scripts to avoid accidental data loss.*
