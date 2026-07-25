## Quick Start

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
npm install
npm run dev                   # starts Next.js dev server
```
### 3. Desktop app (Tauri)

```bash
cd tauri
npm install
npm run dev                   # starts Tauri + Next.js dev server
```

Build for production:
```bash
npm run build                 # produces installer in src-tauri/target/release/bundle/
```

Build for production:
```bash
npm run build                 # produces static site in out/
```

