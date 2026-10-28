import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({ authenticated: Boolean(user), signInUrl: chatGPTSignInPath("/?connect=partner"), name: user?.fullName ?? null, email: user?.email ?? null, signOutUrl: user ? chatGPTSignOutPath("/") : null }, { headers: { "Cache-Control": "no-store" } });
}
