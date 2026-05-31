# Pull Jobs: AI Job Application Assistant

**Pull Jobs** is a conversational Telegram bot designed to automate the job search and application process. Built with Next.js, Mistral Large, and Playwright, it provides a seamless, human-like experience for finding and applying to remote jobs without the manual overhead.

## 🚀 Features

- **Conversational AI**: Powered by Mistral Large for natural, human-like interactions.
- **Smart Profile Extraction**: Intelligently extracts names, contact details, and career preferences from chat.
- **Automated Applications**: Auto-fills and submits job applications for:
  - **Greenhouse.io**
  - **Lever.co**
  - **AshbyHQ.com**
  - **Workable.com**
- **Remotive Integration**: Search thousands of remote jobs directly from Telegram.
- **Admin Dashboard**: "Pull Jobs Admin" panel to track users, view detailed application logs, and manage data.
- **Secure File Storage**: Resume storage and management via UploadThing.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Mistral Large (via Vercel AI SDK)
- **Database**: Prisma ORM with PostgreSQL (Neon)
- **Automation**: Playwright
- **Bot Platform**: Telegram (Webhook)
- **Styling**: Tailwind CSS

## 📋 Prerequisites

- Node.js 20+
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- A Mistral AI API Key
- An UploadThing Account & Token
- A PostgreSQL Database (Neon recommended)

## ⚙️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/pull-jobs.git
   cd pull-jobs
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and add the following:
   ```env
   # Database
   DATABASE_URL="your-postgresql-url"

   # Telegram
   TELEGRAM_BOT_TOKEN="your-bot-token"
   TELEGRAM_WEBHOOK_URL="your-ngrok-or-public-url/api/telegram"

   # AI
   MISTRAL_API_KEY="your-mistral-api-key"
   MISTRAL_MODEL="mistral-large-latest"

   # File Storage
   UPLOADTHING_TOKEN="your-base64-token"

   # Admin
   ADMIN_PASSWORD="your-secure-password"
   ```

4. **Initialize Database**:
   ```bash
   npx prisma db push
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

6. **Set Telegram Webhook**:
   The bot requires a public URL to receive updates. Use `ngrok` for local development and update the `TELEGRAM_WEBHOOK_URL`.

## 🤖 Bot Commands

- `/start` - Begin your profile setup.
- `Find Jobs [role]` - Search for remote job openings (e.g., `Find Jobs Senior React`).
- `/me` - View your current profile details.
- `/resume` - Upload or update your resume PDF.
- `/myapps` - View your application history and statuses.
- `/help` - Show all available commands.

## 🛡️ Admin Dashboard

Access the dashboard at `/admin`. Log in with your `ADMIN_PASSWORD` to:
- View all registered users.
- Expand user profiles to see full details and resume links.
- Track every application log (Applied/Failed/In Progress).
- Delete users fully to allow a fresh start.

## 🤝 Contribution

Contributions are welcome! Please follow these steps:
1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

This project is private and for demonstration purposes. Refer to the repository owner for licensing terms.
