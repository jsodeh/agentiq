# agēntīq: Autonomous AI Agent Management Platform

**agēntīq** is a state-of-the-art, cross-platform AI Agent Management Platform built with **Tauri 2**, **React 18**, **TypeScript**, and **Rust**.

It empowers businesses, entrepreneurs, and teams to deploy a team of **54 specialized digital AI employees** that handle lead generation, WhatsApp customer support, invoicing, marketing, payroll, market research, and web automation 24/7.

---

## 🌟 Executive Summary: What is agēntīq?

Think of **agēntīq** as an intelligent operating system for autonomous AI employees. Instead of using a simple AI chatbot where you type one-off prompts, **agēntīq** allows you to configure, schedule, and monitor autonomous agents that run continuous workflows:

- 📍 **Find Local Business Leads**: Automatically extract verified business contacts and phone numbers from Google Maps.
- 💬 **WhatsApp Customer Service**: Respond to customer inquiries instantly with localized Pidgin/English context.
- 🧾 **Automated Invoicing & Payments**: Generate PDF invoices and verify payments via **Paystack** and **Flutterwave**.
- 🎙️ **Voice AI Companion**: Talk directly to your AI agents via voice, either 100% offline (Whisper.cpp + Coqui TTS) or through high-speed cloud voice (Deepgram + ElevenLabs).
- 🖥️ **Computer Use & Web Automation**: Allow AI agents to autonomously navigate web browsers, extract data, fill forms, and perform web actions—safely guarded by an interactive **Human Approval Gate**.

---

## 🚀 Key Features & Capabilities

### 1. 🤖 54 Pre-Built Digital Agents
Deploy 54 pre-configured, specialized agents across 10 business departments. Each agent comes with custom system prompts, Zod validation schemas, Composio integrations, and configurable default settings.

### 2. 🧠 Smart Multi-Engine AI Orchestrator
- **Priority Queue**: Tasks are prioritized dynamically based on business urgency.
- **Concurrency Management**: Runs up to 3 background agent operations simultaneously.
- **Auto-Retry & Escalation**: Retries transient failures automatically and escalates high-risk decisions to human operators.

### 3. 🎙️ Multi-Engine Voice System (Offline & Cloud)
- **Local Mode (100% Offline)**: Uses `whisper.cpp` for Speech-to-Text (STT) and `coqui-tts` for Text-to-Speech (TTS). Zero data leaves your computer.
- **Cloud Mode (High Speed)**: Uses Deepgram for real-time transcription and ElevenLabs for natural voice synthesis.
- **VAD & Wake-Word Detection**: Built-in Voice Activity Detection (VAD) and customizable wake-word triggers ("Hey Agent").

### 4. 🖥️ Computer Use & Web Automation
- **Playwright Integration**: Agents can interact with live web pages, click buttons, fill out inputs, navigate web portals, and capture screenshots.
- **Interactive Approval Gate**: High-risk actions (e.g., submitting payment forms, entering passwords, or altering live data) automatically pause for explicit human approval via desktop notifications and UI modals.

### 5. 💳 Built-in Localized Billing & Payments
- Native integrations for **Paystack** and **Flutterwave**.
- Multi-currency support (**Nigerian Naira ₦**, USD $, etc.) for subscriptions, automated invoices, and transaction tracking.

---

## 🏬 Complete Directory of All 54 Digital Agents

agēntīq groups all 54 digital agents into **10 core business departments**:

### 💼 1. Business & Strategy
1. **Executive Assistant** (`assistant`): Schedules tasks, manages daily summaries, and prioritizes email threads.
2. **Strategy Advisor** (`strategy-advisor`): Generates SWOT analyses, competitive assessments, and growth roadmaps.
3. **Insight Hub** (`market-research-analyst`): Scrapes market trends, customer sentiment, and industry reports.
4. **BizDev Scout** (`bizdev-scout`): Identifies strategic partnership opportunities and B2B expansion targets.
5. **Risk Guard** (`risk-analyst`): Evaluates operational, financial, and compliance risks across workflows.

### 🎯 2. Sales & Lead Generation
6. **Lead Gen (Maps)** (`lead-gen-maps`): Searches Google Maps to extract verified business phone numbers, addresses, and emails.
7. **Cold Outreach Specialist** (`cold-outreach`): Drafts and sends personalized cold emails and multi-channel outreach sequences.
8. **Appointment Booker** (`appointment-booker`): Coordinates schedules and books client meetings automatically.
9. **Order Handler** (`order-handler`): Receives customer orders, calculates totals, and creates order records.
10. **CRM Specialist** (`crm-specialist`): Keeps your customer relationship management database updated and segmented.

### 💬 3. Customer Support & Engagement
11. **WhatsApp Customer Support** (`customer-support-whatsapp`): Handles customer chats 24/7 on WhatsApp with Pidgin/English fluency.
12. **Front Desk AI** (`virtual-receptionist`): Greets visitors, answers inbound inquiries, and routes messages.
13. **Knowledge Hub** (`faq-generator`): Analyzes help articles and customer tickets to generate dynamic FAQ bases.
14. **Feedback Collector** (`feedback-collector`): Gathers NPS scores, product reviews, and customer feedback.
15. **Fan Base** (`loyalty-manager`): Manages customer reward programs, VIP tiers, and retention offers.

### 📣 4. Marketing & Growth
16. **Social Media Manager** (`social-media-manager`): Creates, schedules, and tracks social media posts across platforms.
17. **Ad Maestro** (`ad-campaign-manager`): Designs ad copy, sets campaign targeting, and optimizes Naira/USD ad spend.
18. **Search Sage** (`seo-optimizer`): Audits website content, finds high-traffic keywords, and improves SEO rankings.
19. **Brand Sentinel** (`brand-monitor`): Scans the web and social media for brand mentions and customer reviews.
20. **Influence Scout** (`influencer-outreach`): Identifies relevant influencers and drafts outreach proposals.
21. **Narrative Lead** (`newsletter-writer`): Writes and formats engaging email newsletters.
22. **Script Wiz** (`video-script-generator`): Outlines scripts for promotional videos, Reels, and Shorts.
23. **Vibe Curator** (`content-calendar-planner`): Plans structured monthly content calendars.

### 💰 5. Finance & Billing
24. **Invoice Generator** (`invoice-generator`): Generates professional PDF invoices and sends payment links.
25. **Naira Watcher** (`expense-tracker`): Tracks business expenses, categorizes receipts, and monitors budget limits.
26. **Paymaster** (`payroll-assistant`): Calculates monthly salary schedules, deductions, and payout summaries.
27. **Tax Sentry** (`tax-compliance-checker`): Checks tax deadlines, VAT calculations, and compliance filings.
28. **Debt Collector** (`payment-collector`): Sends polite, automated payment reminders for overdue invoices.
29. **Trust Keeper** (`refund-processor`): Handles refund requests according to approved business rules.

### ⚙️ 6. Operations & Supply Chain
30. **Stock Sentinel** (`inventory-checker`): Monitors stock levels and alerts when re-orders are needed.
31. **Logistics Link** (`shipping-tracker`): Tracks shipments, packages, and delivery statuses.
32. **Vendor Ally** (`vendor-manager`): Manages supplier contacts, purchase orders, and quotes.
33. **Warehouse WIZ** (`warehouse-manager`): Organizes stock placement and fulfillment workflows.
34. **Fleet Master** (`fleet-coordinator`): Tracks vehicle usage, maintenance schedules, and fuel logs.

### 👥 7. HR & Recruiting
35. **Talent Scout** (`recruiter-assistant`): Filters job applications, parses resumes, and ranks top candidates.
36. **Onboarder Pro** (`onboarding-specialist`): Guides new hires through welcome packages and setup checklists.
37. **HR Guide** (`hr-policy-advisor`): Answers internal employee questions regarding HR policies and leave.
38. **Goal Tracker** (`performance-evaluator`): Tracks team KPIs and quarterly performance objectives.

### 🎨 8. Content & Creative
39. **Creative Scribe** (`graphic-design-brief-writer`): Writes detailed briefs for designers and artists.
40. **Copy Smith** (`copywriter`): Drafts high-converting landing page copy, sales pages, and headlines.
41. **Comm Guard** (`community-moderator`): Moderates community groups, forums, and chat channels.
42. **PR Officer** (`press-release-writer`): Writes formal press releases and media announcements.

### 💻 9. Development & IT Support
43. **Code Master** (`coder`): Writes, refactors, and debugs code across TypeScript, Python, Rust, and Go.
44. **Tech Aide** (`it-support-bot`): Resolves common software, password, and network issues for teams.
45. **Code Reviewer** (`code-reviewer`): Inspects pull requests for performance, security, and clean code standards.
46. **Database Admin** (`database-admin`): Generates SQL queries, schema migrations, and database backups.
47. **Security Sentry** (`security-auditor`): Audits applications for security vulnerabilities and access permissions.

### 🔬 10. Research & Productivity
48. **Brief Bot** (`document-summarizer`): Condenses lengthy PDFs, documents, and transcripts into key takeaways.
49. **Sync Master** (`meeting-scheduler`): Finds suitable meeting slots and sends calendar invitations.
50. **Legal Eye** (`legal-contract-reviewer`): Reviews contracts, highlights non-standard clauses, and flags risk.
51. **Project Pilot** (`project-manager-ai`): Breaks projects down into milestone tasks and tracks progress.
52. **Churn Guard** (`churn-predictor`): Identifies at-risk customers based on activity and usage metrics.
53. **Proposal Writer** (`proposal-writer`): Compiles detailed client proposals and RFP responses.
54. **Data Analyst** (`data-analyst`): Analyzes spreadsheets, computes statistics, and generates charts.

---

## 🛠️ Technical Architecture

```
agentiq/
├── src/                    # React 18 Frontend
│   ├── agents/            # 54 Agent Definitions, prompts, and registry
│   ├── components/        # UI components (AgentCard, TimelineView, BillingPanel, etc.)
│   ├── computer-use/      # Browser automation (Playwright) & Approval Gate
│   ├── db/                # SQLite database queries and schema
│   ├── hooks/             # Custom React hooks (useAgents, useVoice, etc.)
│   ├── orchestrator/      # Multi-agent task queue & execution engine
│   ├── screens/           # Main screens (Dashboard, Setup Wizard, Agent Detail)
│   ├── store/             # Zustand global state management
│   ├── voice/             # Local & Cloud STT/TTS voice modules
│   └── types/             # TypeScript definitions
└── src-tauri/             # Rust Tauri 2 Backend
    ├── src/
    │   ├── main.rs        # Tauri entrypoint & system tray setup
    │   ├── db.rs          # SQLite Rust interface
    │   ├── voice.rs       # Local whisper.cpp / coqui-tts bindings
    │   └── protocol.rs    # Custom deep-link handler (agent://)
    └── Cargo.toml
```

---

## ⚙️ Setup & Installation Guide

agēntīq is designed to be completely user-friendly. Non-technical business users can install and run agēntīq directly as a native desktop app with zero command-line interaction required.

---

### 🖥️ For Business & Everyday Users (Desktop App)

No terminal commands, coding, or technical experience required!

#### 1. Download & Install
Download the pre-compiled standalone installer for your operating system from the **[Latest agēntīq Releases](../../releases/latest)**:
- 🍏 **macOS**: Download `agentiq-installer.dmg` *(Supports Apple Silicon M1/M2/M3 & Intel)*
- 🪟 **Windows**: Download `agentiq-setup.exe` *(Windows 10/11 64-bit)*
- 🐧 **Linux**: Download `agentiq.AppImage` or `agentiq_amd64.deb` *(Ubuntu / Debian / Fedora)*

Double-click the downloaded installer to install agēntīq on your computer like any standard desktop app.

#### 2. Launch & Interactive 3-Step Setup Wizard
When you open agēntīq for the first time, an intuitive visual setup wizard will guide you through:
1. **Automated Device Checks**: The app checks your audio inputs, microphone, and local storage permissions.
2. **AI Provider Connection**: Easily paste your API keys (Anthropic Claude, Deepgram, Composio) or select local Ollama.
3. **Select Digital Employees**: Choose which of the 54 digital AI agents you want to deploy to your dashboard.

#### 3. Automatic Background Management
agēntīq automatically initializes its embedded SQLite database, configures local voice models, and runs background worker tasks seamlessly. You can minimize agēntīq to your System Tray (`agent://` deep-link enabled) and let your digital workforce operate 24/7.

---

### 🛠️ For Developers & Contributors (Building from Source)

If you are a developer looking to customize agēntīq or build from source code:

#### Prerequisites
- **Node.js**: v18.0 or higher
- **npm** / **pnpm**
- **Rust Toolchain**: v1.75+ (required for building the Tauri Rust container)
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

#### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/agentiq.git
cd kiro/agentiq
npm install
```

#### 2. Run Test Suites
Execute all 555+ agent registry tests and full integration suites:
```bash
npm run test:run
```

#### 3. Run in Development Mode
Launch the live React frontend inside the native Tauri container with hot module reloading:
```bash
npm run tauri dev
```

#### 4. Package Desktop Executables
Compile production binaries for your current platform:
```bash
npm run tauri build
```

---

## 🎨 Theme & Styling System

agēntīq uses a dark aesthetic with glassmorphism and subtle animations:

| Element | Color Code | Preview |
| :--- | :--- | :--- |
| **Brand Primary** | `#6C3BFF` | 🟣 Deep Purple |
| **Accent / Active** | `#00D4AA` | 🟢 Vibrant Teal |
| **Background Dark** | `#0D0D1A` | 🌑 Dark Navy |
| **Mid Gray / Borders** | `#4A4A6A` | 🩶 Slate Gray |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
