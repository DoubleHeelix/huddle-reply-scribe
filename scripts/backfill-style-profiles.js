// Backfill style profiles (phrases + fingerprint) for all users with huddle data.
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-style-profiles.js

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const functionUrl =
  process.env.SUPABASE_FUNCTION_URL ||
  (supabaseUrl ? `${supabaseUrl}/functions/v1/enhanced-ai-suggestions` : "");

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function getDistinctUserIds(limit = 1000) {
  const ids = new Set();
  let from = 0;
  const pageSize = 200;

  // Paginate through huddle_plays for user_ids
  while (ids.size < limit) {
    const { data, error } = await supabase
      .from("huddle_plays")
      .select("user_id", { count: "exact" })
      .order("user_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach((row) => row.user_id && ids.add(row.user_id));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(ids);
}

async function analyzeUser(userId) {
  const body = {
    action: "analyzeStyle",
    userId,
  };

  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `analyzeStyle failed for ${userId}: ${res.status} ${res.statusText} - ${text}`
    );
  }

  return res.json();
}

async function saveUserProfile(userId, analysisData) {
  const body = {
    action: "confirmAndSaveStyle",
    userId,
    analysisData,
  };

  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `confirmAndSaveStyle failed for ${userId}: ${res.status} ${res.statusText} - ${text}`
    );
  }

  return res.json();
}

async function backfill() {
  const userIds = await getDistinctUserIds();
  if (!userIds.length) {
    console.log("No user_ids found in huddle_plays; nothing to backfill.");
    return;
  }

  console.log(`Found ${userIds.length} users. Backfilling...`);

  let processed = 0;
  for (const userId of userIds) {
    try {
      const analysis = await analyzeUser(userId);
      if (!analysis || analysis.message) {
        console.log(`Skipping ${userId}: ${analysis?.message || "no data"}`);
        continue;
      }
      await saveUserProfile(userId, analysis);
      processed += 1;
      console.log(`✅ Backfilled ${userId}`);
    } catch (err) {
      console.error(`❌ Failed for ${userId}:`, err.message);
    }
  }

  console.log(`Done. Profiles updated for ${processed} users.`);
}

backfill().catch((err) => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});
