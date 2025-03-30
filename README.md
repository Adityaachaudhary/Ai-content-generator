# AI-Powered Subscription-Based Content Generator

A full-stack application that uses AI to generate content for various purposes with a subscription-based model.

## Features

- Generate AI-powered content using Google Gemini API
- Authenticate users with Google OAuth
- Manage subscriptions with Lemon Squeezy
- Dashboard to view subscription status and content history
- Multiple content types (blog posts, articles, social media, etc.)

## Tech Stack

### Frontend
- React.js
- Redux Toolkit for state management
- React Router for navigation
- Tailwind CSS for styling
- Axios for API requests

### Backend
- Node.js with Express.js
- MongoDB with Mongoose
- JWT for authentication
- Passport.js with Google OAuth
- Google Gemini API for content generation
- Lemon Squeezy API for subscription management

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB instance (local or Atlas)
- Google OAuth credentials
- Google Gemini API key
- Lemon Squeezy API credentials

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/ai-content-generator.git
cd ai-content-generator
```

2. Install backend dependencies
```
cd backend
npm install
```

3. Install frontend dependencies
```
cd ../frontend
npm install
```

4. Set up environment variables
Create a `.env` file in the backend folder with the following variables:
```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
LEMON_SQUEEZY_API_KEY=your_lemon_squeezy_api_key
LEMON_SQUEEZY_WEBHOOK_SECRET=your_lemon_squeezy_webhook_secret
LEMON_SQUEEZY_BASIC_CHECKOUT_URL=your_lemon_squeezy_basic_checkout_url
LEMON_SQUEEZY_PREMIUM_CHECKOUT_URL=your_lemon_squeezy_premium_checkout_url
LEMON_SQUEEZY_BASIC_VARIANT_ID=your_lemon_squeezy_basic_variant_id
LEMON_SQUEEZY_PREMIUM_VARIANT_ID=your_lemon_squeezy_premium_variant_id
```

5. Start the backend server
```
cd ../backend
npm run dev
```

6. Start the frontend development server
```
cd ../frontend
npm start
```

7. Access the application
Open your browser and navigate to `http://localhost:3000`

## Usage

1. Sign in with Google
2. Select a subscription plan
3. Generate content by providing prompts
4. View and manage your generated content

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google Gemini API for providing the AI capabilities
- Lemon Squeezy for subscription management
- Google OAuth for authentication

## Running the application on Windows PowerShell

Since Windows PowerShell doesn't support the `&&` operator for command chaining, you need to run the backend and frontend in separate PowerShell windows.

### Starting the Backend Server

Open a PowerShell window and run:

```powershell
cd backend
npm run dev
```

### Starting the Frontend

Open another PowerShell window and run:

```powershell
cd frontend
npm start
```

### Alternative Method (Advanced)

You can also use the following command to start each application in a new PowerShell window:

```powershell
# Start the backend
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'cd \""$pwd\backend\""; npm run dev'"

# Start the frontend
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'cd \""$pwd\frontend\""; npm start'"
```

## Setting up PayPal Integration

This application uses PayPal for subscription payments. The default setup is configured to use the PayPal sandbox environment for testing.

### PayPal Configuration

1. The frontend uses the PayPal sandbox client ID set in the `.env` file
2. For testing, the value `sb` is used as a special sandbox testing client ID
3. For production, you should replace this with your actual PayPal client ID

### Testing PayPal Integration

When using the sandbox configuration:
- A mock PayPal order will be created
- You can test the payment flow without real transactions
- Success and cancel flows will redirect to the appropriate pages

## Features

- Google Authentication
- Content generation using Google Gemini API
- Subscription plans (Free, Basic, Premium)
- PayPal payment integration
- Usage limits based on subscription tier 