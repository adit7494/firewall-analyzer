# Enterprise Firewall Audit & Compliance Analyzer

An air-gapped, multi-tenant enterprise firewall configuration analyzer designed to audit FortiGate, SonicWall, and Palo Alto network gateway backups against **CIS Benchmarks** and **NIST SP 800-53** controls without requiring direct device network credentials.

---

## 🌟 Key Features

- **Air-Gapped Backup Parsing**: Audit raw configuration backup files offline (`.conf`, `.txt`) safely without exposing production management interfaces or credentials.
- **CIS & NIST Compliance Rules Engine**: Automatically evaluates rulebases, administrative access settings, WAN interface exposure, VPN policies, logging compliance, and default credential usage against 26+ critical security benchmarks.
- **Multi-Tenant Enterprise Management**: Manage multiple client organizations, track physical/virtual firewall gateway inventories per tenant, and view aggregate security posture scores.
- **Historical Remediation Tracking**: Track finding resolutions across consecutive configuration backups over time to verify vulnerability remediation month-over-month.
- **Compliance Snapshot Reports**: Generate finalized executive and technical audit reports ready for client distribution and compliance documentation.
- **Enterprise Design & Polish**: Clean, responsive UI with glassmorphic modal overlays, custom posture metrics, and real-time audit progress indicators.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **Frontend**: React 19, Lucide Icons, Modern Vanilla CSS Design System
- **ORM & Database**: [Prisma ORM 7](https://www.prisma.io/) with LibSQL / SQLite backend
- **Authentication**: NextAuth.js
- **Containerization**: Docker & Docker Compose (Multi-stage build)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) and Docker Compose (optional for containerized deployment)

---

### Option A: Running with Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd firewall-analyzer
   ```

2. **Start the application**:
   ```bash
   docker compose up -d --build
   ```

3. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup environment variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="your-super-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Initialize Database & Prisma Client**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📂 Project Structure

```
firewall-analyzer/
├── prisma/               # Database schema & migrations
├── public/               # Static assets
├── src/
│   ├── app/              # Next.js App Router pages & server actions
│   │   ├── audit/        # Audit details & progress view
│   │   ├── companies/    # Multi-tenant company management
│   │   ├── dashboard/    # Security posture overview & metrics
│   │   ├── devices/      # Firewall device gateway inventory
│   │   ├── findings/     # Rule failure breakdown & remediation
│   │   ├── reports/      # Audit report generation & viewer
│   │   └── upload/       # Configuration backup parser & upload engine
│   ├── lib/              # Core parsers, types, and audit rule engines
│   └── components/       # UI layout components
├── Dockerfile            # Container build specification
├── docker-compose.yml    # Orchestration configuration
└── package.json
```

---

## 🔒 Security & Privacy

This application is designed specifically for security auditors, managed service providers (MSPs), and enterprise IT teams. All parsing operations occur within your deployed environment; no backup contents or security findings leave your infrastructure.

---

## 📄 License

Internal Enterprise License / All Rights Reserved.
