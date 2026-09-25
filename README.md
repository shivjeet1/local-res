# Local-Res (Restaurant POS & Management System)

A full-stack, monorepo-based Point of Sale (POS) and Restaurant Management System. 

## Features
- **Next-Gen UI/UX**: A beautiful, modern Next.js frontend with dark mode, subtle animations, and PWA offline-first support.
- **Role-Based Interface Adaptation**: Smart, role-specific navigation and layout switching (Admin Sidebar, Staff Top-Nav, Kitchen Full-Screen).
- **Advanced Admin Analytics Dashboard**: Real-time sales metrics, Recharts-powered 7-day revenue trend graphs, and top items list with one-tap CSV export.
- **Kanban Kitchen Display System (KDS)**: Real-time, drag-and-drop full-screen KDS optimized for tablets, featuring live ticket age tracking and color-coded urgency alerts.
- **GST Toggle**: Easily toggle GST calculations for individual orders directly from the POS cart with live recalculation and confirmation safeguards.
- **Multi-Tenant Security**: Enforces automatic multi-tenancy scoping and soft deletes using Prisma extensions, strictly preserving data integrity.

## Project Structure
This project is structured as an **npm workspace** monorepo:
- `backend/`: Node.js / Fastify API with Prisma ORM.
- `ui/`: Next.js web frontend.
- `tauri/`: Desktop application wrapper using Tauri.
- `packages/shared/`: Shared TypeScript types and business logic.

---

## 1. Getting Started

First, clone the repository and install all dependencies from the root of the project:

```bash
# Install and link all workspace dependencies
npm install

# Set up local environment variables
cp backend/.env.example backend/.env          
```

---

## 2. Running the Application (Local Development)

There are two ways to run the application locally. **Method A (Docker Compose)** is highly recommended as it spins up the entire stack, including the database, with hot-reloading out of the box.

### Method A: Full Stack with Docker Compose (Recommended)

This project is configured for a seamless local development experience using Docker Compose and multi-stage Dockerfiles. The local setup mounts your source code directly into the container, allowing you to develop without repeatedly rebuilding images.

```bash
# Spin up Postgres, Backend (with hot-reload), and UI
docker compose up --build
```

**What happens automatically:**
- The PostgreSQL database spins up.
- The backend container runs migrations (`prisma migrate deploy`) and seeds the database automatically.
- The backend starts a `dev` server with hot-reloading. Any changes you make to `backend/src` or `packages/shared/src` will reflect instantly.
- The Next.js UI spins up on `http://localhost:3000`.

**Seed credentials:**
- Admin:   `admin@pos.dev`   / `admin1234`
- Staff:   `staff@pos.dev`   / `staff1234`
- Kitchen: `kitchen@pos.dev` / `kitchen1234`

#### Troubleshooting Database Errors
If the PostgreSQL container crashes due to version mismatches (e.g. `initialized by PostgreSQL version 15`) or you get a `P1000` Authentication error, it means an older conflicting Docker volume is cached on your machine.
```bash
# Stop containers and destroy the conflicting database volume
docker compose down -v

# Spin everything back up
docker compose up --build
```

### Method B: Developing Individually (Without Docker)

If you prefer to run services natively on your host machine, you will still need a running PostgreSQL database (which you can spin up via `docker compose up -d postgres`).

Before running the backend natively, you must generate the Prisma client:
```bash
cd backend
npx prisma generate
cd ..
```

Then, you can run the individual services:
```bash
# Run backend API
npm run dev --workspace=backend

# Run UI (Next.js dev server)
npm run dev --workspace=ui

# Run Desktop app (Tauri + Next.js dev server)
npm run dev --workspace=tauri
```

---

## 3. Production Build & Cloud Deployment

The `Dockerfile`s in this project use multi-stage builds. Building them without specifying a target will automatically yield optimized, production-ready images.

### Building Production Docker Images

```bash
# Build production backend image
docker build -t local-res-backend:latest -f backend/Dockerfile .

# Build production UI image
docker build -t local-res-ui:latest -f ui/Dockerfile .

# Build Tauri Desktop App for production (produces installer in tauri/src-tauri/target/release/bundle/)
npm run build --workspace=tauri
```

### Kubernetes Setup

To deploy the application to a Kubernetes cluster, apply the manifests in the `k8s` directory. Ensure your production Docker images (`local-res-backend:latest` and `local-res-ui:latest`) are built or available in your registry.

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

#### Updating Deployments (Latest Code)
If you are using Minikube, run `eval $(minikube docker-env)` first so the images are built directly into Minikube's Docker daemon.

```bash
# 1. Rebuild the Docker images for production with your latest code
docker build -t local-res-backend:latest -f backend/Dockerfile .
docker build -t local-res-ui:latest -f ui/Dockerfile .

# 2. Restart the Kubernetes deployments to pull the fresh images
kubectl rollout restart deployment/backend deployment/ui
```

#### Useful Management Commands

**Monitoring & Status:**
```bash
kubectl get pods
kubectl get svc
kubectl logs -f deployment/backend
kubectl logs -f deployment/ui
```

**Accessing Services Locally (Minikube / Docker Desktop):**
```bash
kubectl port-forward svc/ui 3000:3000
kubectl port-forward svc/backend 4000:4000
```

**Scaling & Debugging:**
```bash
kubectl scale deployment/backend --replicas=3
kubectl rollout restart deployment/backend
kubectl exec -it deployment/backend -- sh
```

**Teardown:**
```bash
kubectl delete -f k8s/
```
