export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: "ok",
    runtime: "node",
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasDriveEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasDriveKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  });
}
