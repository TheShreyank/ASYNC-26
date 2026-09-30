<div align="center">
  <h1>
    <img src="frontend/public/casualhealth-minilogo.png" alt="CasualHealth Logo" width="48" style="vertical-align: middle; margin-right: 12px; margin-bottom: 6px;" />
    <span style="vertical-align: middle;">Casual<font color="#4CB050">Health</font></span>
  </h1>

  <p><strong>Live Demo: <a href="https://async-26.vercel.app/">https://async-26.vercel.app/</a></strong></p>
</div>

---

CasualHealth is a voice-first, AI-powered habit tracker that seamlessly integrates into your daily life. Instead of manually ticking boxes, just talk about your day. Our app listens, analyzes your reflection using Google's Gemini AI, automatically ticks off completed habits, and syncs directly with your Google Calendar.

## ✨ Key Features

- 🎙️ **Voice-First AI Check-ins:** Speak naturally about your day. We use Google Gemini to transcribe and analyze your voice, intelligently detecting which habits you accomplished.
- 📅 **Google Calendar Integration:** Syncs seamlessly with your Google Calendar. Events are automatically checked off when the time passes or when you mention them in your check-in.
- 📊 **Progress & Analytics:** A dedicated analytics dashboard using Recharts visualizes your weekly consistency, current streak, and total habits completed over time.
- 🔊 **AI Daily Review & Playback:** Generates a comprehensive, AI-written summary of your entire day based on all your check-ins, complete with Text-to-Speech (TTS) audio playback.
- 🔒 **Secure Authentication:** Robust Google OAuth 2.0 integration via NextAuth.
- 💾 **Persistent Data:** Secure, scalable database architecture powered by Supabase to store your historical habit logs.
- 📱 **Premium, Responsive UI:** A gorgeous, glassmorphism-inspired dark-mode interface built from the ground up for desktop and mobile, ensuring a premium user experience.

## 🛠️ Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, custom CSS (for precise, premium aesthetic control)
- **AI Processing:** Google Gemini API (Audio Transcription & Natural Language Analysis)
- **Backend & Auth:** NextAuth.js (Google Provider), Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Data Visualization:** Recharts
- **Icons:** Lucide React

## 🚀 Running Locally

### Prerequisites
- Node.js (v20+)
- Gemini API Key
- Supabase Project (URL & Service Role Key)
- Google Cloud Console Project (for OAuth Client ID & Secret)

### Setup Instructions

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file in the `frontend` directory and add the following keys:
   ```env
   # AI
   GEMINI_API_KEY=your_gemini_api_key

   # Authentication
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   GOOGLE_ID=your_google_oauth_client_id
   GOOGLE_SECRET=your_google_oauth_client_secret

   # Database (Supabase)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

4. **Experience CasualHealth:**
   Visit `http://localhost:3000`. Please allow microphone access to test the voice check-in feature!
