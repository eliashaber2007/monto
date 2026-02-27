import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Derive the 2-letter country code from an IBAN string
function countryFromIban(iban: string): string {
  return iban.replace(/\s/g, "").substring(0, 2).toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // ✅ FIXED: use getUser() instead of getClaims()
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const body = await req.json().catch(() => ({}));

    // Custom onboarding submission
    if (body.first_name && body.last_name && body.dob && body.address && body.iban) {
      // ✅ FIXED: derive bank account country from IBAN prefix, not address country
      const ibanCountry = countryFromIban(body.iban);
      const addressCountry = body.address.country || "FR";

      let accountId = profile?.stripe_account_id;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "custom",
          country: addressCountry,
          email: userEmail,
          business_type: "individual",
          capabilities: {
            transfers: { requested: true },
          },
          individual: {
            first_name: body.first_name,
            last_name: body.last_name,
            email: userEmail,
            dob: {
              day: body.dob.day,
              month: body.dob.month,
              year: body.dob.year,
            },
            address: {
              line1: body.address.line1,
              city: body.address.city,
              postal_code: body.address.postal_code,
              country: addressCountry,
            },
          },
          external_account: {
            object: "bank_account",
            country: ibanCountry, // ✅ from IBAN, not address
            currency: "eur",
            account_number: body.iban.replace(/\s/g, ""), // strip spaces
          },
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0.0.0.0",
          },
          settings: {
            payouts: { schedule: { interval: "manual" } },
          },
        } as any);

        accountId = account.id;
      } else {
        // Update existing account
        await stripe.accounts.update(accountId, {
          individual: {
            first_name: body.first_name,
            last_name: body.last_name,
            dob: {
              day: body.dob.day,
              month: body.dob.month,
              year: body.dob.year,
            },
            address: {
              line1: body.address.line1,
              city: body.address.city,
              postal_code: body.address.postal_code,
              country: addressCountry,
            },
          },
          external_account: {
            object: "bank_account",
            country: ibanCountry, // ✅ from IBAN, not address
            currency: "eur",
            account_number: body.iban.replace(/\s/g, ""),
          } as any,
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0.0.0.0",
          },
        } as any);
      }

      // ✅ Always update profile after create or update
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_account_id: accountId, stripe_onboarding_complete: true })
        .eq("id", userId);

      return new Response(JSON.stringify({ success: true, account_id: accountId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy Express fallback (keep as-is)
    let accountId = profile?.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: userEmail,
        country: "FR",
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        settings: { payouts: { schedule: { interval: "manual" } } },
      });
      accountId = account.id;
      await supabaseAdmin.from("profiles").update({ stripe_account_id: accountId }).eq("id", userId);
    }

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/$/, "") ||
      "https://id-preview--59da60b6-faa4-4fa4-890f-0b571d3b5fa7.lovable.app";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      return_url: `${origin}/profile?connect=success`,
      refresh_url: `${origin}/profile?connect=refresh`,
      type: "account_onboarding",
      collection_options: { fields: "eventually_due" },
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-connect-account error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
