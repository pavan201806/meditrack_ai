# MediTrack-Ai 🏥

A comprehensive comprehensive Health Monitor and Medication Adherence Assistant app. MediTrack-Ai helps users manage their prescriptions, track medication schedules with smart reminders, and leverage AI to scan and process medical documents.

## 🌟 Key Features

- **Medication Management**: Add, edit, pause, and resume medicines with full scheduling support.
- **Smart Reminders**: Timezone-safe and background-safe push notifications to ensure you never miss a dose.
- **AI-Powered OCR Scanner**: Instantly extract details from medical prescriptions using built-in OCR (Tesseract).
- **Machine Learning Analytics**: Built-in predictive analytics for health monitoring.
- **Secure Integration**: JWT authenticated RESTful API with encrypted data storage.
- **Emergency SMS Alerts**: Twilio integration for critical notifications.
- **Premium UI/UX**: Dark glassmorphism design approach with smooth reanimated transitions.

## 🛠️ Technology Stack

### Mobile App (Frontend)
- **Framework**: React Native & Expo (`expo start`)
- **Navigation**: React Navigation (Stack & Bottom Tabs)
- **State/Storage**: AsyncStorage, Offline-first architecture
- **Device Capabilities**: Expo Notifications, Location, Haptics, Image Picker, AV, Speech
- **UI & Animations**: React Native Reanimated, Linear Gradient, SVG

### Backend (API & ML)
- **Framework**: Python 3 / Flask
- **Database**: MySQL (`mysql-connector-python`)
- **Authentication**: JWT (`PyJWT`), Bcrypt for password hashing
- **Machine Learning**: Scikit-learn, Numpy, Pandas
- **OCR Engine**: PyTesseract & Pillow
- **Communications**: Twilio API

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.8+
- MySQL Server
- Tesseract OCR engine installed on your system

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure Environment Variables:
   Create a `.env` file in the `Backend` directory and define your database credentials (e.g., `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SECRET_KEY`).
5. Run the backend server:
   ```bash
   python app.py
   ```
   *The server will automatically initialize the database schema.*

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd App
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```
4. Scan the generated QR code using the Expo Go app on your phone to launch the ap
## 🤝 Contributing

Contributions, issues and feature requests are welcome!

## 📝 License

This project is open-sourced during the Lendi Hackathon.
