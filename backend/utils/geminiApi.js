const axios = require('axios');

/**
 * Generate content using Google Gemini API
 * @param {string} prompt - The prompt for content generation
 * @param {string} contentType - Type of content (blog, article, social, etc.)
 * @param {Object} options - Additional configuration options
 * @returns {Promise<string>} - The generated content
 */
const generateContent = async (prompt, contentType, options = {}) => {
  try {
    // Default options
    const defaultOptions = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048
    };

    // Merge with user options if provided
    const finalOptions = { ...defaultOptions, ...options };

    // Define a base system message based on content type
    let systemMessage = 'You are a helpful AI assistant that generates high-quality content.';
    
    switch (contentType) {
      case 'blog':
        systemMessage = 'You are a professional blog writer. Create engaging blog content that is informative and reader-friendly.';
        break;
      case 'article':
        systemMessage = 'You are a professional article writer. Create in-depth articles with factual information and proper structure.';
        break;
      case 'social':
        systemMessage = 'You are a social media specialist. Create concise and engaging social media posts that drive engagement.';
        break;
      case 'seo':
        systemMessage = 'You are an SEO expert. Create content optimized for search engines while maintaining readability and value.';
        break;
      case 'email':
        systemMessage = 'You are an email marketing expert. Create effective email content with compelling subject lines and calls to action.';
        break;
      default:
        // Use default message
    }

    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in the environment variables');
    }

    // Updated Gemini API endpoint (uses the most recent URL format)
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Request body - Using the current Gemini API format
    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemMessage },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: finalOptions.temperature,
        topK: finalOptions.topK,
        topP: finalOptions.topP,
        maxOutputTokens: finalOptions.maxOutputTokens
      }
    };

    // Make API request to Gemini
    console.log(`Making request to Gemini API for ${contentType} content`);
    
    // Log a masked version of the API key for debugging
    if (process.env.GEMINI_API_KEY) {
      const maskedKey = process.env.GEMINI_API_KEY.substring(0, 10) + '...';
      console.log(`Using API key: ${maskedKey}`);
    }
    
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Extract and return the generated content
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log(`Successfully generated ${generatedText.length} characters of content`);
      return generatedText;
    } else {
      console.error('Incomplete response from Gemini API:', JSON.stringify(response.data));
      throw new Error('No content was generated');
    }
  } catch (error) {
    console.error('Error generating content with Gemini API:', error);
    
    // Handle different types of errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response Status:', error.response.status);
      console.error('API Error Response Data:', JSON.stringify(error.response.data));
      
      if (error.response.status === 400) {
        throw new Error('Bad request: Invalid prompt or configuration');
      } else if (error.response.status === 401) {
        throw new Error('Authentication error: Invalid API key');
      } else if (error.response.status === 403) {
        throw new Error('Authorization error: API key may not have access to Gemini API');
      } else if (error.response.status === 404) {
        throw new Error('API endpoint not found: Check Gemini API URL or model name');
      } else if (error.response.status === 429) {
        throw new Error('Rate limit exceeded: Too many requests');
      } else if (error.response.status >= 500) {
        throw new Error('Gemini API server error');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received, request details:', error.request);
      throw new Error('No response received from Gemini API');
    }
    
    // Pass through the original error if none of the above
    throw error;
  }
};

// Adding a basic test function to check if the API key is valid
const testGeminiAPIKey = async () => {
  try {
    const result = await generateContent('Test prompt. Please respond with a simple "Hello World"', 'other');
    return {
      success: true,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { generateContent, testGeminiAPIKey }; 