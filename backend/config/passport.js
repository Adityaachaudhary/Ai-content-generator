const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Validate required environment variables
const missingEnvVars = [];
if (!process.env.GOOGLE_CLIENT_ID) missingEnvVars.push('GOOGLE_CLIENT_ID');
if (!process.env.GOOGLE_CLIENT_SECRET) missingEnvVars.push('GOOGLE_CLIENT_SECRET');
if (!process.env.GOOGLE_CALLBACK_URL) missingEnvVars.push('GOOGLE_CALLBACK_URL');

if (missingEnvVars.length > 0) {
  console.error('⚠️ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('OAuth authentication may not work correctly.');
} else {
  console.log('✅ Google OAuth environment variables are configured');
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID.substring(0, 8) + '...');
  console.log('Callback URL:', process.env.GOOGLE_CALLBACK_URL);
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth profile received:', profile.id, profile.displayName);
        
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          console.log('Existing user found:', user.email);
          return done(null, user);
        }

        // Create new user
        console.log('Creating new user for:', profile.displayName);
        user = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          avatar: profile.photos[0].value,
          subscription: {
            status: 'free',
            endDate: null
          }
        });

        await user.save();
        console.log('New user created:', user.email);
        return done(null, user);
      } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}); 