import { createClient } from "@supabase/supabase-js";

const url = process.env["VITE_SUPABASE_URL"]!;
const key = process.env["SUPABASE_SECRET_KEY"]!;
const supabase = createClient(url, key);

async function main() {
  // Test signup with admin client (bypasses email confirmation)
  const testEmail = "testncv@gmail.com";
  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: "Test1234!",
    email_confirm: true,
    user_metadata: { full_name: "Test User" }
  });
  
  if (error) {
    console.log("Create user error:", error.message);
  } else {
    console.log("User created:", data.user?.id);
    
    // Create profile
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: data.user!.id,
      full_name: "Test User",
      plan: "gratuit",
      seats: 1,
      emails_used: 0,
      emails_quota: 50,
    });
    console.log("Profile:", profileErr ? profileErr.message : "OK");
    
    // Try login
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: "Test1234!"
    });
    console.log("Login:", loginErr ? loginErr.message : "OK, session:", !!loginData.session);
    
    // Cleanup
    await supabase.auth.admin.deleteUser(data.user!.id);
    console.log("Cleaned up");
  }
}
main();
