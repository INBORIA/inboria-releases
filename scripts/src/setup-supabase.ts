import { createClient } from "@supabase/supabase-js";

const url = process.env["VITE_SUPABASE_URL"]!;
const key = process.env["SUPABASE_SECRET_KEY"]!;
const supabase = createClient(url, key);

async function main() {
  // Check profiles columns
  const { data: p, error: pe } = await supabase.from("profiles").select("*").limit(0);
  console.log("profiles columns check:", pe ? pe.message : "OK");
  
  // Check tasks columns
  const { data: t, error: te } = await supabase.from("tasks").select("*").limit(0);
  console.log("tasks columns check:", te ? te.message : "OK");

  // Check emails columns
  const { data: e, error: ee } = await supabase.from("emails").select("*").limit(0);
  console.log("emails columns check:", ee ? ee.message : "OK");

  // Check categories columns
  const { data: c, error: ce } = await supabase.from("categories").select("*").limit(0);
  console.log("categories columns check:", ce ? ce.message : "OK");

  // Test signup flow - create a test user
  const testEmail = "test-ncv-" + Date.now() + "@test.com";
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: testEmail,
    password: "TestPassword123!"
  });
  
  if (signupError) {
    console.log("Signup test:", signupError.message);
  } else {
    console.log("Signup test: OK, user id:", signupData.user?.id);
    
    // Try inserting a profile for this user
    if (signupData.user) {
      const { error: profileInsertError } = await supabase.from("profiles").insert({
        id: signupData.user.id,
        full_name: "Test User",
        plan: "gratuit",
        emails_used: 0,
        emails_quota: 50
      });
      console.log("Profile insert:", profileInsertError ? profileInsertError.message : "OK");
      
      // Clean up - delete test user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(signupData.user.id);
      console.log("Cleanup:", deleteError ? deleteError.message : "OK");
    }
  }
}
main();
