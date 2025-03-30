require('dotenv').config();
const { testGeminiAPIKey } = require('./utils/geminiApi');

const testAPI = async () => {
  console.log('Testing Gemini API connection...');
  console.log('API Key:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'Not set');
  
  try {
    const result = await testGeminiAPIKey();
    
    if (result.success) {
      console.log('✅ API key is working!');
      console.log('Response:', result.result.substring(0, 100) + '...');
    } else {
      console.error('❌ API key test failed:');
      console.error(result.error);
    }
  } catch (error) {
    console.error('❌ Unexpected error testing API key:');
    console.error(error);
  }
};

testAPI(); 