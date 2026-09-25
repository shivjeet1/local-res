## Features

- **Next-Gen UI/UX**: A beautiful, modern Next.js frontend with dark mode, subtle animations, and PWA offline-first support.
- **Role-Based Interface Adaptation**: Smart, role-specific navigation and layout switching (Admin Sidebar, Staff Top-Nav, Kitchen Full-Screen).
- **Advanced Admin Analytics Dashboard**: Real-time sales metrics, Recharts-powered 7-day revenue trend graphs, and top items list with one-tap CSV export.
- **Kanban Kitchen Display System (KDS)**: Real-time, drag-and-drop full-screen KDS optimized for tablets, featuring live ticket age tracking and color-coded urgency alerts.
- **GST Toggle**: Easily toggle GST calculations for individual orders directly from the POS cart with live recalculation and confirmation safeguards.
- **Multi-Tenant Security**: Enforces automatic multi-tenancy scoping and soft deletes using Prisma extensions, strictly preserving data integrity.
- **Monorepo Architecture**: Clean npm workspace structure sharing types and logic via `@local-res/shared` across backend, UI, and Tauri desktop apps.

## Quick Start

This project is structured as an **npm workspace** containing the `backend`, `ui`, `tauri` (desktop), and `packages/shared` directories.

### Install Dependencies

Run `npm install` at the root of the project to install and link all workspace dependencies:

```bash
npm install
```

### Run the Full Stack (Docker Compose)

Ensure you are in the **root** of the monorepo, then run:

```bash
# Set up environment variables
cp backend/.env.example backend/.env          

# Spin up Postgres, Backend, and UI
docker compose up -d --build         
npm run db:migrate --workspace=backend
npm run db:seed --workspace=backend
```

**Seed credentials:**
- Admin:   `admin@pos.dev`   / `admin1234`
- Staff:   `staff@pos.dev`   / `staff1234`
- Kitchen: `kitchen@pos.dev` / `kitchen1234`

### Troubleshooting

**Database Authentication Errors (`P1000`) or "incompatible with server" errors:**
If you run `npm run db:migrate` and encounter a `P1000: Authentication failed against database server` error, or if the PostgreSQL container crashes due to version mismatches (e.g. `initialized by PostgreSQL version 15`), it means an older Docker volume with conflicting credentials or versions is cached on your machine.

To fix this, tear down the containers and their volumes, then restart:

```bash
# 1. Stop containers and destroy the conflicting database volume
docker compose down -v

# 2. Spin everything back up
docker compose up -d --build

# 3. Re-run migrations and seed
npm run db:migrate --workspace=backend
npm run db:seed --workspace=backend
```

### UI

```bash
npm run dev --workspace=ui    # starts Next.js dev server
```

### Desktop app (Tauri)

```bash
npm run dev --workspace=tauri # starts Tauri + Next.js dev server
```

Build for production:
```bash
npm run build --workspace=tauri # produces installer in tauri/src-tauri/target/release/bundle/
```

### Docker Compose Setup

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

### Kubernetes Setup

To deploy the application to a Kubernetes cluster, apply the manifests in the `k8s` directory. Make sure you build the Docker images (`local-res-backend:latest` and `local-res-ui:latest`) first or have them available in your registry.

#### Deployment

```bash
# 1. Deploy the Secrets (Must be applied first!)
kubectl apply -f k8s/secrets.yaml

# 2. Deploy the Database (PostgreSQL)
kubectl apply -f k8s/database.yaml

# 3. Deploy the Backend API
kubectl apply -f k8s/backend.yaml

# 4. Deploy the Frontend UI
kubectl apply -f k8s/frontend.yaml
```

#### Building & Updating Images (Latest Code)

Since the Kubernetes manifests use `imagePullPolicy: Never` to look for local images, you need to rebuild your Docker images whenever you make code changes, and then tell Kubernetes to restart the pods to pick up the new images.

```bash
# 1. Rebuild the Docker images with your latest code
docker compose build

# 2. Restart the Kubernetes deployments to pull the fresh images
kubectl rollout restart deployment/backend deployment/ui
```

*(Note: If you are using Minikube instead of Docker Desktop, run `eval $(minikube docker-env)` before running `docker compose build` so the images are built directly into Minikube's Docker daemon).*

#### Useful Management Commands

**Monitoring & Status:**
```bash
# View all running pods
kubectl get pods

# View all services and their exposed ports
kubectl get svc

# Stream logs from the backend pod
kubectl logs -f deployment/backend

# Stream logs from the UI pod
kubectl logs -f deployment/ui
```

**Accessing Services Locally (Minikube / Docker Desktop):**
```bash
# Port-forward the UI to http://localhost:3000
kubectl port-forward svc/ui 3000:3000

# Port-forward the Backend to http://localhost:4000
kubectl port-forward svc/backend 4000:4000
```

**Scaling & Debugging:**
```bash
# Scale the backend to 3 replicas
kubectl scale deployment/backend --replicas=3

# Restart a deployment (useful if config/secrets change)
kubectl rollout restart deployment/backend

# Open a shell inside the backend pod
kubectl exec -it deployment/backend -- sh
```

**Teardown:**
```bash
# Remove all resources defined in the k8s directory
kubectl delete -f k8s/
```

**delete all cluster resources**


