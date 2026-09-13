import { supabase } from "../database/supabase.js";

async function main() {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, email, full_name, role");
  console.log("PROFILES:", profiles, pErr);

  const { data: notifs, error: nErr } = await supabase
    .from("notifications")
    .select("id, user_id, title, message, channel, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("RECENT NOTIFICATIONS:", notifs, nErr);
}

main().catch(console.error);
