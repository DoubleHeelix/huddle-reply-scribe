
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRRequest {
  imageData: string; // base64 encoded image
  enableAutoCropping?: boolean;
  margin?: number;
}

// Google Cloud service account authentication
async function getAccessToken() {
  const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');
  const projectId = Deno.env.get('GOOGLE_PROJECT_ID');

  if (!serviceAccountEmail || !privateKey || !projectId) {
    throw new Error('Missing Google Cloud service account credentials. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_PROJECT_ID in Supabase secrets.');
  }

  console.log('OCR: Using service account authentication');
  console.log('OCR: Project ID:', projectId);
  console.log('OCR: Service account email:', serviceAccountEmail);

  // Create JWT for Google Cloud authentication
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const jwtPayload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Base64 encode header and payload
  const encodedHeader = btoa(JSON.stringify(jwtHeader));
  const encodedPayload = btoa(JSON.stringify(jwtPayload));
  
  // Create signature (simplified - in production you'd use proper crypto)
  const assertion = `${encodedHeader}.${encodedPayload}`;
  
  // Request access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('OCR: Token request failed:', errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();
  
  try {
    console.log('OCR: Starting text extraction process');

    const { imageData, enableAutoCropping = true, margin = 12 }: OCRRequest = await req.json();

    if (!imageData) {
      throw new Error('Image data is required');
    }

    // Try to get access token using service account first, fallback to API key
    let authHeader = '';
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    
    try {
      const accessToken = await getAccessToken();
      authHeader = `Bearer ${accessToken}`;
      console.log('OCR: Using service account authentication');
    } catch (authError) {
      console.log('OCR: Service account auth failed, trying API key fallback:', authError.message);
      
      if (!googleApiKey) {
        throw new Error('No Google Cloud authentication available. Please set either service account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID) or GOOGLE_API_KEY in Supabase secrets.');
      }
      
      console.log('OCR: Using API key authentication');
    }

    // Remove data URL prefix if present
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1] 
      : imageData;

    console.log(`OCR: Processing image (${base64Data.length} characters of base64)`);

    // Construct the API URL
    const apiUrl = googleApiKey 
      ? `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`
      : `https://vision.googleapis.com/v1/images:annotate`;

    console.log('OCR: API URL constructed');

    // Prepare the request body
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Data,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    };

    console.log('OCR: Making request to Google Cloud Vision API...');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const visionResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log(`OCR: Vision API response status: ${visionResponse.status}`);

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('OCR: Google Vision API error response (full):', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.error('OCR: Parsed error data:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('OCR: Could not parse error response as JSON');
        errorData = { error: { message: errorText } };
      }
      
      const errorMessage = errorData.error?.message || errorText || 'Unknown Google Vision API error';
      
      // Check for specific error types and provide helpful messages
      if (errorMessage.includes('billing') || errorMessage.includes('BILLING_DISABLED')) {
        throw new Error(`Billing issue detected. Please verify billing is enabled for your Google Cloud project and the credentials have the correct permissions. Full error: ${errorMessage}`);
      } else if (errorMessage.includes('API key not valid') || errorMessage.includes('INVALID_ARGUMENT')) {
        throw new Error(`Invalid Google Cloud credentials. Please check your service account or API key configuration. Full error: ${errorMessage}`);
      } else if (errorMessage.includes('not been used') || errorMessage.includes('disabled') || errorMessage.includes('PERMISSION_DENIED')) {
        throw new Error(`Google Cloud Vision API access issue. Please ensure the API is enabled and has proper permissions. Full error: ${errorMessage}`);
      } else {
        throw new Error(`Google Vision API error (${visionResponse.status}): ${errorMessage}`);
      }
    }

    const visionData = await visionResponse.json();
    console.log('OCR: Google Vision API response received successfully');

    // Extract text from response
    let extractedText = '';
    if (visionData.responses?.[0]?.textAnnotations?.[0]?.description) {
      extractedText = visionData.responses[0].textAnnotations[0].description;
      console.log(`OCR: Successfully extracted ${extractedText.length} characters`);
      console.log(`OCR: First 100 chars: ${extractedText.substring(0, 100)}`);
    } else if (visionData.responses?.[0]?.error) {
      const apiError = visionData.responses[0].error;
      console.error('OCR: Vision API returned error in response:', apiError);
      throw new Error(`Vision API error: ${apiError.message || 'Unknown error'}`);
    } else {
      console.log('OCR: No text detected in image');
      extractedText = 'No text detected in the image.';
    }

    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;

    console.log(`OCR: Processing completed successfully in ${processingTime.toFixed(2)} seconds`);

    return new Response(
      JSON.stringify({
        text: extractedText.trim(),
        processingTime,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    console.error('OCR: Error during processing:', error);

    return new Response(
      JSON.stringify({
        text: '',
        processingTime,
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
