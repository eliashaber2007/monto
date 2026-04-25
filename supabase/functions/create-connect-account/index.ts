import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://montofinance.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" as any });

    const body = await req.json().catch(() => ({}));

    // Account-token based onboarding (preferred)
    if (body.account_token && body.iban) {
      const ibanCountry = countryFromIban(body.iban);
      const accountCountry = body.country || ibanCountry;

      const createNewAccount = async () => {
        const account = await stripe.accounts.create({
          type: "custom",
          country: accountCountry,
          email: userEmail,
          account_token: body.account_token,
          capabilities: {
            transfers: { requested: true },
          },
          business_profile: {
            url: "https://monto.app",
            mcc: "7372",
          },
          external_account: {
            object: "bank_account",
            country: ibanCountry,
            currency: "eur",
            account_number: body.iban.replace(/\s/g, ""),
          },
          settings: {
            payouts: { schedule: { interval: "manual" } },
          },
        } as any);
        return account.id;
      };

      const { error: resetError } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_account_id: null, stripe_onboarding_complete: false })
        .eq("id", userId);

      if (resetError) throw resetError;

      const accountId = await createNewAccount();

      const { error: saveError } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_account_id: accountId, stripe_onboarding_complete: true })
        .eq("id", userId);

      if (saveError) throw saveError;

      return new Response(JSON.stringify({ success: true, account_id: accountId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy Express fallback
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
      "https://montofinance.app";

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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
