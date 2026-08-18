## Features

- **GST Toggle**: Easily toggle GST calculations for individual orders directly from the POS cart.
- **Offline-First Synchronization**: Powered by Tauri with a local SQLite database that seamlessly syncs to a Postgres cloud backend.
- **Multi-Tenant Security**: Enforces automatic multi-tenancy scoping and soft deletes using Prisma extensions and Fastify's `AsyncLocalStorage`.
- **Monorepo Architecture**: Clean npm workspace structure sharing types and logic via `@local-res/shared` between the backend, UI, and Tauri apps.

## Quick Start

This project is structured as an **npm workspace** containing the `backend`, `ui`, `tauri` (desktop), and `packages/shared` directories.

### 0. Install Dependencies

Run `npm install` at the root of the project to install and link all workspace dependencies:

```bash
npm install
```

### 1. Cloud backend

```bash
cd backend
cp .env.example .env          
docker compose up -d         
npm run db:migrate          
npm run db:seed            
```

**Seed credentials:**
- Admin:   `admin@pos.dev`   / `admin1234`
- Staff:   `staff@pos.dev`   / `staff1234`
- Kitchen: `kitchen@pos.dev` / `kitchen1234`

### 2. UI

```bash
cd ui
npm run dev                   # starts Next.js dev server
```

### 3. Desktop app (Tauri)

```bash
cd tauri
npm run dev                   # starts Tauri + Next.js dev server
```

Build for production:
```bash
npm run build                 # produces installer in src-tauri/target/release/bundle/
```

### 4. Docker Compose Setup

To run the entire stack (Database, Backend, and UI) using Docker Compose:

```bash
docker-compose up -d --build
```
The services will be available at:
- **UI**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Database**: `postgresql://postgres:password123@localhost:5432/local_res_db`

To stop the services:
```bash
docker-compose down
```

### 5. Kubernetes Setup

To deploy the application to a Kubernetes cluster, apply the manifests in the `k8s` directory. Make sure you build the Docker images (`local-res-backend:latest` and `local-res-ui:latest`) first or have them available in your registry.

```bash
# 1. Deploy the Database (PostgreSQL)
kubectl apply -f k8s/database.yaml

# 2. Deploy the Backend API
kubectl apply -f k8s/backend.yaml

# 3. Deploy the Frontend UI
kubectl apply -f k8s/frontend.yaml
```

Verify that the pods are running:
```bash
kubectl get pods
```

To access the services locally (e.g. Minikube/Docker Desktop), you can port-forward them:
```bash
# Port-forward the UI
kubectl port-forward svc/ui 3000:3000

# Port-forward the Backend (if needed for API testing)
kubectl port-forward svc/backend 4000:4000
```
