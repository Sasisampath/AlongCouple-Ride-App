import { getChatGPTUser, chatGPTSignInPath } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({ authenticated: Boolean(user), signInUrl: chatGPTSignInPath("/?connect=partner") }, { headers: { "Cache-Control": "no-store" } });
}
