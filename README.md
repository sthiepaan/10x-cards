# 10x-cards

A fast, AI‑assisted flashcards app for creating, editing, and studying spaced‑repetition decks. The app generates high‑quality flashcard suggestions from pasted text using LLMs, while also supporting full manual curation.

---

## Table of contents

- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

---

## Project description

10x-cards helps users quickly create and manage study flashcards. Users can paste text (e.g., a textbook excerpt), and the system proposes flashcards via an LLM API. Suggestions can be accepted, edited, or rejected before saving. The app also supports fully manual flashcard creation and a study mode powered by a spaced‑repetition algorithm. Basic authentication ensures each user’s data remains private.

- AI proposes question–answer flashcards from an input text
- Users accept/edit/reject suggestions and save selected cards
- Manual creation, editing, and deletion of cards
- Study sessions using a ready‑made spaced‑repetition algorithm
- Basic auth with private, per‑user data access
- Simple generation metrics (accepted vs generated)

See detailed product requirements in `.ai/prd.md`.

---

## Tech stack

- Frontend: Astro 5 with React 19 for interactive components
- Language: TypeScript 5
- Styling: Tailwind CSS 4
- UI Library: Shadcn/ui
- Backend (BaaS): Supabase (PostgreSQL + Auth SDK)
- AI: OpenRouter.ai (access to multiple LLM providers)
- CI/CD: GitHub Actions (planned)
- Hosting: DigitalOcean via Docker image (planned)

Reference: `.ai/tech-stack.md`.

---

## Getting started locally

Prerequisites:

- Node.js **22.14.0** (see `.nvmrc`)
- npm 10+ (recommended)

Setup:

```bash
# 1) Clone the repository
git clone https://github.com/sthiepaan/10x-cards.git
cd 10x-cards

# 2) Use the correct Node.js version
nvm use

# 3) Install dependencies
npm install

# 4) Start the dev server
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Notes:

- No environment variables are required yet in this scaffold.
- Supabase and OpenRouter integrations will require configuration in future iterations.

---

## Available scripts

- `npm run dev`: Start the Astro development server with hot reload.
- `npm run build`: Build the production bundle.
- `npm run preview`: Preview the production build locally.
- `npm run astro`: Run the Astro CLI directly.
- `npm run lint`: Lint the project with ESLint.
- `npm run lint:fix`: Lint and automatically fix simple issues.
- `npm run format`: Format the codebase with Prettier.

---

## Project scope

In scope (MVP):

- AI flashcard generation from pasted text (1,000–10,000 characters)
- Review flow to accept, edit, or reject proposed cards
- Manual card CRUD and “My flashcards” view
- Basic user registration/login and account deletion
- Study sessions using a ready‑made spaced‑repetition algorithm
- Per‑user privacy: only the signed‑in user can access their cards
- Simple metrics on generated vs accepted flashcards
- GDPR considerations: access and deletion on request

Out of scope (MVP):

- Custom/advanced spaced‑repetition algorithm (use a ready‑made library)
- Gamification, notifications, sharing, public API
- Mobile apps
- Multi‑format document import (PDF/DOCX)
- Advanced search/filtering

See user stories and acceptance criteria in `.ai/prd.md`.

---

## Project status

- Current: Initial Astro + React scaffold with Tailwind and UI setup
- Roadmap: Integrate Supabase auth/storage, AI generation via OpenRouter, study session UX
- Docs:
  - Product requirements: `.ai/prd.md`
  - Tech stack overview: `.ai/tech-stack.md`

Badges (informational):

- Node: 22.14.0 (from `.nvmrc`)
- Astro: ^5.13.7
- React: ^19.1.1

---

## License

This project is licensed under the MIT License
