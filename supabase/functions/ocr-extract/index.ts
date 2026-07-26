
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuthenticatedUser } from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { errorResponse, jsonResponse } from "../shared/http.ts";
import { fetchWithTimeout } from "../shared/provider.ts";

const GOOGLE_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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
  
  // Validate that the key content is valid base64
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(keyContent)) {
    // Remove any invalid characters
    keyContent = keyContent.replace(/[^A-Za-z0-9+/=]/g, '');
  }
  
  try {
    // Test base64 decoding first
    const testDecode = atob(keyContent);
    // Import the private key for signing using Deno's crypto API
    const binaryKey = Uint8Array.from(testDecode, c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the JWT using Deno's crypto API
    const signature = await crypto.subtle.sign(
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
    const tokenResponse = await fetchWithTimeout(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      },
      GOOGLE_TIMEOUT_MS,
    );

    if (!tokenResponse.ok) {
      console.error('OCR token request failed', { status: tokenResponse.status });
      throw new Error('Failed to authenticate the OCR provider');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
    
  } catch (error) {
    console.error('OCR service-account authentication failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new Error('OCR provider authentication failed', { cause: error });
  }
}

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  const startTime = performance.now();
  
  try {
    await requireAuthenticatedUser(req);

    const { imageData }: OCRRequest = await req.json();

    if (
      typeof imageData !== "string" ||
      !imageData.trim() ||
      imageData.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1_000
    ) {
      throw new Error('Image data is required');
    }

    // Get access token using service account
    const accessToken = await getAccessToken();
    const authHeader = `Bearer ${accessToken}`;

    // Remove data URL prefix if present
    const base64Data = imageData.startsWith('data:') 
      ? imageData.split(',')[1] 
      : imageData;

    // Construct the API URL (no API key needed with service account)
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate`;

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

    const visionResponse = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(requestBody),
      },
      GOOGLE_TIMEOUT_MS,
    );

    if (!visionResponse.ok) {
      await visionResponse.body?.cancel();
      console.error('OCR provider request failed', {
        status: visionResponse.status,
      });
      throw new Error('OCR provider request failed');
    }

    const visionData = await visionResponse.json();
    // Extract text from response
    let extractedText = '';
    if (visionData.responses?.[0]?.textAnnotations?.[0]?.description) {
      extractedText = visionData.responses[0].textAnnotations[0].description;
    } else if (visionData.responses?.[0]?.error) {
      throw new Error('OCR provider returned an error');
    } else {
      extractedText = 'No text detected in the image.';
    }

    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;

    return jsonResponse(req, {
      text: extractedText.trim(),
      processingTime,
      success: true,
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;
    console.error('OCR request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    const response = errorResponse(req, error);
    response.headers.set("X-Processing-Time", processingTime.toFixed(3));
    return response;
  }
});
