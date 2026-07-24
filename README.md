# 🎙️ AI_Voice_Interview

An AI-powered voice interview platform for practicing role-based mock interviews. Upload a resume, get an AI-generated candidate profile, and go through an adaptive voice interview where question difficulty and follow-ups adjust based on your answers — finishing with a detailed AI-scored performance report.

**🔗 Live app:** https://ai-interview-agent-one-kohl.vercel.app

## ✨ Features

- 📄 Resume parsing (PDF) into structured role/skills/projects/achievements data
- 🗣️ Voice-driven interview flow — AI speaks questions (speech synthesis) and listens to your spoken answers (speech recognition)
- 🎯 Adaptive difficulty — questions get harder/easier and dig deeper based on how you're answering
- 📊 AI-scored feedback on confidence, communication, and correctness, plus a full performance report
- 💳 Credits & payments via Razorpay
- 🔐 Google sign-in via Firebase Auth

## 🛠️ Tech Stack

- **Client:** ⚛️ React (Vite), Tailwind CSS, Redux Toolkit, Firebase Auth
- **Server:** 🟢 Node.js, Express, MongoDB (Mongoose)
- **AI:** 🤖 OpenRouter (`openai/gpt-4o-mini`) — called directly via `axios`.
  Note: `@langchain/core` / `@langchain/openai` are present in `server/package.json` but are **not currently used** in the codebase; all AI calls go through a plain HTTP client in `server/services/openRouter.service.js`.
- **Payments:** 💰 Razorpay

## 📁 Folder Structure

```
3.interviewIQ/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── components/
│       │   ├── AuthModel.jsx        # Google sign-in modal
│       │   ├── Footer.jsx
│       │   ├── Navbar.jsx
│       │   ├── Step1SetUp.jsx       # Role/experience/resume setup
│       │   ├── Step2Interview.jsx   # Live voice interview flow
│       │   ├── Step3Report.jsx      # Post-interview report view
│       │   └── Timer.jsx
│       ├── pages/
│       │   ├── Auth.jsx
│       │   ├── Home.jsx
│       │   ├── InterviewHistory.jsx
│       │   ├── InterviewPage.jsx
│       │   ├── InterviewReport.jsx
│       │   └── Pricing.jsx
│       ├── redux/
│       │   ├── store.js
│       │   └── userSlice.js
│       ├── utils/
│       │   └── firebase.js          # Firebase Auth config
│       ├── App.jsx
│       └── main.jsx
│
├── server/                          # Express backend API
│   ├── config/
│   │   ├── connectDb.js             # MongoDB connection
│   │   └── token.js                 # JWT signing
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── interview.controller.js  # Resume parsing, question gen, scoring
│   │   ├── payment.controller.js    # Razorpay order/verify
│   │   └── user.controller.js
│   ├── middlewares/
│   │   ├── isAuth.js                # JWT auth guard
│   │   └── multer.js                # Resume file upload
│   ├── models/
│   │   ├── interview.model.js
│   │   ├── payment.model.js
│   │   └── user.model.js
│   ├── routes/
│   │   ├── auth.route.js
│   │   ├── interview.route.js
│   │   ├── payment.route.js
│   │   └── user.route.js
│   ├── services/
│   │   ├── openRouter.service.js    # OpenRouter AI calls (axios)
│   │   └── razorpay.service.js
│   └── index.js                     # App entry point
│
├── client/.env.example
└── server/.env.example
```

Built By - Peehal❤️