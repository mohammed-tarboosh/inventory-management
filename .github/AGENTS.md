---
description: "Always-on workflow guidance for inventory-management. Use coordinator, arabic, planner, frontend, backend, supabase, qa, and docs agents for orchestration, Arabic-first routing, implementation, validation, and documentation."
---

# Inventory Management Agent Guide

This project uses TanStack Start, React, server functions, and Supabase. Prefer specialized subagents instead of one large generalist flow.

## When to delegate

- Use the coordinator agent for automatic agent routing and multi-stage orchestration.
- Use the arabic agent for Arabic-language requests, intent normalization, and routing to the right specialist.
- Use the planner agent to break work into steps, sequence tasks, and define validation.
- Use the frontend agent for React, routes, components, RTL, and UI polish.
- Use the backend agent for server-side logic in `src/server.ts`, `src/start.ts`, middleware, and server functions.
- Use the Supabase agent for auth, schema, migrations, RLS, and local database inspection.
- Use the QA agent for build, lint, regression checks, and failure analysis.
- Use the docs agent for documentation updates and consistency checks.

## Suggested default flow

1. Coordinator receives the request and assigns work.
2. Arabic agent normalizes Arabic intent when the prompt is Arabic-first.
3. Planner creates task decomposition when scope is non-trivial.
4. Frontend and/or backend implement changes.
5. Supabase agent handles database/auth work through MCP.
6. QA validates the result.
7. Docs agent updates project documentation.

## Supabase rule

- The Supabase agent must access project/database data through the `supabase` MCP server only.
- Do not treat local config files as the source of truth when the MCP server can answer the question directly.

Supabase MCP is configured in `.vscode/mcp.json` as:

- server name: `supabase`
- endpoint: `http://127.0.0.1:54321/mcp`
