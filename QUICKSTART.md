# Quick Start Guide

## Local Development (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Services

```bash
docker-compose up
```

Wait for all services to be healthy (about 30 seconds).

### 3. Access the Application

- **API**: `http://localhost:3010`
- **DynamoDB Local**: `http://localhost:8010`

### 4. Test the API

```bash
curl http://localhost:3010/hello
```

Expected response: `{"message":"Hello World"}`

## Development Notes

- **Authentication**: Bypassed in local dev mode
- **Database**: DynamoDB Local (data persists in Docker volume)
- **Hot Reload**: Enabled for API
- **API Endpoints**: All endpoints work without authentication tokens

## Common Issues

### Port Already in Use

If ports 3010 or 8010 are in use:

```bash
# Stop existing containers
docker-compose down

# Or change ports in docker-compose.yml
```

### Docker Not Running

Ensure Docker Desktop (or Docker daemon) is running before starting services.

### Build Errors

If you see build errors:

```bash
# Clean and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## Next Steps

- For AWS deploy, see [docs/DEPLOY.md](./docs/DEPLOY.md)
- Check [.env.dev](./.env.dev) for environment variable configuration
- Review the code structure in `services/` and `packages/`
