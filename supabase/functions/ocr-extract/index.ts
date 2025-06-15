
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

  // Import crypto for JWT signing
  const crypto = await import("https://deno.land/std@0.168.0/crypto/mod.ts");
  
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

  // Create the JWT
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signingInput = `${headerB64}.${payloadB64}`;
  
  // Clean and format the private key - handle both escaped and unescaped newlines
  let cleanPrivateKey = privateKey;
  
  // First handle escaped newlines from environment variables
  if (cleanPrivateKey.includes('\\n')) {
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
  }
  
  // Extract the key content between the headers
  const keyMatch = cleanPrivateKey.match(/-----BEGIN PRIVATE KEY-----\s*([\s\S]*?)\s*-----END PRIVATE KEY-----/);
  if (!keyMatch) {
    throw new Error('Invalid private key format. Expected PEM format with BEGIN/END headers.');
  }
  
  // Get the base64 content and remove all whitespace and newlines
  let keyContent = keyMatch[1].replace(/\s/g, '').replace(/\n/g, '').replace(/\r/g, '');
  
  console.log('OCR: Private key processed, length:', keyContent.length);
  console.log('OCR: First 50 chars of key content:', keyContent.substring(0, 50));
  
  // Validate that the key content is valid base64
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(keyContent)) {
    console.error('OCR: Invalid base64 characters found in private key');
    // Remove any invalid characters
    keyContent = keyContent.replace(/[^A-Za-z0-9+/=]/g, '');
    console.log('OCR: Cleaned key content length:', keyContent.length);
  }
  
  try {
    // Test base64 decoding first
    const testDecode = atob(keyContent);
    console.log('OCR: Base64 decode test successful, decoded length:', testDecode.length);
    
    // Import the private key for signing
    const binaryKey = Uint8Array.from(testDecode, c => c.charCodeAt(0));
    const cryptoKey = await crypto.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the JWT
    const signature = await crypto.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(signingInput)
    );
    
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    
    const jwt = `${signingInput}.${signatureB64}`;
    
    // Request access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OCR: Token request failed:', errorText);
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('OCR: Successfully obtained access token');
    return tokenData.access_token;
    
  } catch (error) {
    console.error('OCR: Error processing private key or signing JWT:', error);
    if (error instanceof Error && error.message.includes('Failed to decode base64')) {
      console.error('OCR: Base64 decoding failed. Key content preview:', keyContent.substring(0, 100) + '...');
      console.error('OCR: Key content has invalid characters. Please check the GOOGLE_PRIVATE_KEY secret.');
    }
    throw new Error(`JWT signing failed: ${error.message}`);
  }
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

    // Get access token using service account
    const accessToken = await getAccessToken();
    const authHeader = `Bearer ${accessToken}`;

    // Remove data URL prefix if present
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1] 
      : imageData;

    console.log(`OCR: Processing image (${base64Data.length} characters of base64)`);

    // Construct the API URL (no API key needed with service account)
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate`;

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

    const visionResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
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
        throw new Error(`Invalid Google Cloud credentials. Please check your service account configuration. Full error: ${errorMessage}`);
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
    console.error('OCR: Error stack trace:', error.stack);

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
