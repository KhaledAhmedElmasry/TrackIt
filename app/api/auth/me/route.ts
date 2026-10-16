import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { handleApiError } from "@/lib/errors/app-error";

export async function GET() {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json({ success: true, data: { user: null } });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: session.user,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
