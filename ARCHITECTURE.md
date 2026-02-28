# MediTrack AI Architecture Breakdown

This document provides a deep and structured architectural analysis of the **MediTrack AI** application, examining the entire stack, module integrations, AI processes, and suggestions for production readiness.

---

## PHASE 1: STRUCTURE ANALYSIS

The project is structured into two primary top-level directories separating the frontend mobile application and the backend API service:

### **1. `App/` (Expo React Native Frontend)**
This folder contains the cross-platform mobile application.
- **`src/`**: The core directory for all frontend code.
  - **`screens/`**: Contains UI screens organized by feature domain (e.g., `auth`, `home`, `medicine`, `scanner`, `caretaker`). It also houses the AI WebView wrappers (`VoiceAgentScreen.jsx` & `RagChatScreen.jsx`).
  - **`components/`**: Reusable UI elements (`VoiceAgentButton`, `RagChatButton`, `StatCard`, `CountdownTimer`, `ProgressRing`).
  - **`navigation/`**: Manages app routing (`AppNavigator.js`, `MainTabNavigator.js`).
  - **`services/`**: Handles external communication and background tasks (`api.js` for Axios requests, `notificationService.js`, `backgroundDoseMonitor.js`, `smsService.js`).
  - **`theme/`**: Manages the dark/glassmorphism design system (`ThemeContext.js`).

### **2. `Backend/` (Flask Python Backend)**
This folder hosts the RESTful API and machine learning logic.
- **`app.py`**: The main entry point that configures Flask, handles CORS, and registers all route blueprints.
- **`config.py`**: Manages environment variables (MySQL credentials, Twilio keys, JWT keys).
- **`routes/`**: API endpoints separated by concern (`auth_routes.py`, `medicine_routes.py`, `scanner_routes.py`, `caretaker_routes.py`, `analytics_routes.py`, etc.).
- **`models/`**: The database access layer. Contains SQL execution logic directly interacting with the MySQL tables (`user.py`, `medicine.py`, `dose_log.py`, `emergency_alert.py`).
- **`ml/`**: The core AI/ML business logic.
  - `ocr_scanner.py`: Parses prescription text using Tesseract.
  - `ai_insights.py`: Logic regarding data interpretation.
  - `adherence_model.py`: Calculates predictive non-adherence risk scores.
  - `drug_interactions.py`: Analyzes prescription combinations to flag medical risks.

*External Modules (Running independently):*
- **LiveKit Voice Agent**: Running locally on Port 3001.
- **Groq RAG Chatbot**: Running via Vite on Port 5173.
- **MySQL Database**: Cloud-hosted on Aiven.

---

## PHASE 2: FEATURE BREAKDOWN

### **Frontend-Backend API Flow**
1. **User Action**: A user triggers an event (e.g., scanning a medicine).
2. **Frontend `services/api.js`**: An Axios call is constructed with the JWT bearer token attached.
3. **Backend `app.py`**: Receives the request, validates the JWT, and routes it to the specific blueprint (e.g., `scanner_routes.py`).
4. **Backend `models/`**: The route invokes functions acting directly on the MySQL DB.
5. **Response**: JSON payloads are returned and mapped to React Native state.

### **Major Features**
- **Authentication**: `authAPI` → `auth_routes.py`. Registers users/caretakers securely using Bcrypt hashing and returns short-lived JWTs.
- **Medicine Scanning (OCR)**: `scannerAPI` → `scanner_routes.py` → `ml/ocr_scanner.py`. The app uploads a Base64 image; the backend processes it via PyTesseract + Pillow, extracting medicine names, dosage, and frequencies natively.
- **Dashboard & Reminders**: Calculates what doses are due next using `backgroundDoseMonitor.js` to create localized background system notifications without requiring an active backend ping.
- **Caretaker Emergency System**: A critical module (`caretaker_routes.py` + `emergency_alert.py`). If a dose is missed, a Twilio wrapper automatically triggers SMS and Voice calls to the assigned caretaker.

---

## PHASE 3: AI SYSTEM ANALYSIS

### **1. Voice Assistant Architecture (LiveKit)**
- **Integration**: `VoiceAgentScreen.jsx`.
- **How it works**: Uses `react-native-webview` to embed an external Next.js/LiveKit application (port 3001). 
- **Flow**: User presses the floating `VoiceAgentButton` → Modal slides up → The WebView requests microphone permissions natively via Expo → Grants access to the embedded browser → Audio streams via WebRTC to the LiveKit cloud server → Processing pipeline executes STT (Speech-to-Text) → LLM determines response → TTS (Text-to-Speech) answers the patient verbally in real-time.

### **2. RAG Chatbot Architecture (Groq)**
- **Integration**: `RagChatScreen.jsx`.
- **How it works**: Embeds an external Vite application (port 5173). 
- **The Magic Link Payload**: Because the Vite app strictly points to `localhost:8000`, a JavaScript interceptor injected into the WebView dynamically rewrites global `fetch` and `XMLHttpRequest` calls inside the VM. It physically overrides `localhost:8000` to the PC's LAN IP (`192.168.137.86:8000`), allowing the phone emulator to hit the machine's backend.
- **Flow**: Retrieves contextual chunks regarding users/medications using RAG (Retrieval-Augmented Generation) from a Vector Store (FAISS), feeding it to a Groq LLM (e.g., LLaMA) for lightning-fast, highly accurate medical data retrieval.

### **3. AI Medicine Insights**
- Driven by `Backend/routes/medicine_routes.py`. It packages parsed medicine data and securely queries the `llama-3.1-8b-instant` model over the Groq API. A strict system prompt forcibly shapes the AI output into a guaranteed JSON payload determining Uses, Side Effects, and Interaction Warnings.

---

## PHASE 4: DATABASE ANALYSIS

The backend utilizes **MySQL** with raw query executions handled in `models/`. 
* **`users`**: Distinguishes via `role` (`patient` vs `caretaker`).
* **`medicines`**: Stores foundational data (`name`, `dosage`, `frequency`, `instructions`).
* **`medicine_schedules`**: Maps dynamic timing structures (e.g., 08:30, 20:30) separately, solving many-to-one daily relationships.
* **`dose_logs`**: Tracks actions (`taken`, `missed`, `skipped`) linked to schedules. Essential for generating the predictive streak and adherence logic in `dashboard_routes.py`.
* **`reminders` & `alerts`**: Logging tables to prevent duplicate caretaker pings and handle status lifecycles.

---

## PHASE 5: SECURITY ANALYSIS

1. **JWT Handling**: `PyJWT` enforces expiration durations (`JWT_EXPIRY_HOURS=24`). Passwords are mathematically salted and hashed via `Bcrypt`.
2. **Access Security**: Users can only access models attached to their specific `user_id` inside API routes. 
3. **Medical Disclaimer Enforcement**: AI queries strictly prompt the LLMs: *"Provide informational guidance only. NEVER diagnose or prescribe."*
4. **Vulnerabilities / Attack Vectors**: 
   - Uses completely raw SQL strings with `%s` tuple substitution (`cursor.execute("...", (var,))`). While `%s` protects against basic SQL injection in PyMySQL, maintaining raw queries scales poorly and is susceptible to human-error syntax injections. 

---

## PHASE 6: ARCHITECTURE DIAGRAM

```text
 [ Mobile Device (User) ]
           │
           ▼ (React Native / Expo)
┌─────────────────────────────────┐
│        Frontend (App/)          │
│  - State Management & Forms     │
│  - Expo Background Notifications│
│  - UI Glassmorphism System      │
│  - WebViews (Port 3001 / 5173)  │◄──────┐ Note: WebViews natively
└─────────────────────────────────┘       │ process STT/LLM chats
           │                              │ directly with local LAN 
           ▼ (HTTP API / JSON via JWT)    │ Next/Vite Servers.
┌─────────────────────────────────┐       │
│        Backend (Flask)          │       │
│  - Auth & Security Context      │       │
│  - Business / Rules engine      │◄──────┘ Overridden JS proxy 
│  - Twilio Dispatcher            │         points API calls here
│  - Tesseract OCR Processing     │
└──────────┬──────────┬───────────┘
           │          │
           ▼          ▼ (Groq API via HTTP)
┌────────────┐   ┌──────────────────────────┐
│ MySQL DB   │   │  Groq (LLaMA-3) LLM      │
│ (Aiven)    │   │  - Medical Insights      │
│ /models/*  │   │  - Unstructured RAG Data │
└────────────┘   └──────────────────────────┘
```

---

## PHASE 7: IMPROVEMENT SUGGESTIONS

### **Architectural Weaknesses & Solutions**
1. **Raw SQL Boilerplate**: Every model (`medicine.py`, `dose_log.py`) manually opens connections, executes raw strings, and handles connection closure. 
   - *Upgrade:* Transition to an ORM like **SQLAlchemy**. It will radically decrease code density, automate connection pooling, handle cascading deletes natively, and fully eradicate SQL injection risks.
2. **RAG/Voice Microservices**: Running separate local Node/Vite instances (3001, 5173) embedded in WebViews is prone to network failure in production (IP changes).
   - *Upgrade:* Host the RAG and Voice applications on Vercel/Netlify and point the Expo WebViews to static production URLs (`https://agent.meditrack.ai`).

### **Scalability & Performance**
1. **OCR Processing**: Processing heavy images (`ocr_scanner.py`) asynchronously blocks the Flask thread.
   - *Upgrade:* Implement **Celery + Redis** to offload image processing to background workers, returning a task ID to the mobile app for polling or WebSockets.
2. **Offline-First Resilience**: If the internet dies, the dashboard crashes when fetching API logic.
   - *Upgrade:* Expand `offlineCache.js` with **WatermelonDB** or **Realm** to sync databases delta-changes when the device reconnects.

### **Security Enhancements**
1. **Sensitive AI Data**: Do not transmit PII (Personal Identifiable Information) directly to Groq. 
   - *Upgrade:* Implement a data scrubbing middleware that strips User Details before forwarding `.json` payloads to the LLaMA model for insights. 
2. **Environment Masking**: `React Native WebViews` run their internal DOM globally. If `window.isReactNative = true` is intercepted by malicious ad-trackers nested inside the WebView, it could be exploited. Ensure `originWhitelist={['https://your-secured-domain.com']}` is locked down in production to prevent arbitrary site loads.
