# Rental-IQ MCP layer

Model Context Protocol server exposing fleet/rental tools to Cursor, Claude Desktop, and the HTTP API.

## What you get

| Transport | How |
|-----------|-----|
| **stdio** | `python manage.py run_mcp_server` (Cursor / Claude Desktop) |
| **HTTP** | `GET /api/v1/mcp/tools/`, `POST /api/v1/mcp/call/` (auth required) |

### Tools

- `fleet_utilisation` — active / idle / available / overdue
- `search_equipment` — query + status filter
- `list_overdue_rentals` — overdue open rentals
- `dispatch_desk` — Dispatch Hub snapshot (QR, possessions, due, eligible)
- `scan_anomalies` — idle / unassigned / underuse / misuse
- `scan_rental_alerts` — due-soon / overdue notifications
- `demand_forecast` — site demand forecast
- `rewards_leaderboard` — customer points / tier
- `fleet_live` — Redis live telemetry sample

Resources: `rental-iq://dispatch/desk`, `rental-iq://fleet/utilisation`  
Prompts: `dispatch_ops_brief`, `anomaly_risk_brief`

Agentic Mode catalog (`GET /api/v1/agentic/catalog/`) includes an `mcp` block with the same tool list.

## Run stdio (Docker)

```bash
docker compose exec -T backend python manage.py run_mcp_server
```

## Cursor MCP config

Copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) to `.cursor/mcp.json` (or merge into your user MCP settings):

```json
{
  "mcpServers": {
    "rental-iq": {
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/absolute/path/to/FleetVision/docker-compose.yml",
        "exec",
        "-T",
        "backend",
        "python",
        "manage.py",
        "run_mcp_server"
      ]
    }
  }
}
```

Use an absolute path to `docker-compose.yml` so Cursor can find the stack from any cwd.

## HTTP call example

```bash
# after JWT login
curl -s -X POST http://localhost:8000/api/v1/mcp/call/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"dispatch_desk","arguments":{}}'
```

## Layout

```
backend/mcp_layer/
  tools_registry.py   # shared handlers (stdio + HTTP + catalog)
  server.py           # FastMCP stdio server
  views.py / urls.py  # REST discovery + invoke
  management/commands/run_mcp_server.py
```
