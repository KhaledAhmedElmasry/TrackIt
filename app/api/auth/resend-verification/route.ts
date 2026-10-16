import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { AuthService } from "@/lib/services/auth.service";
import { handleApiError, AuthenticationError } from "@/lib/errors/app-error";
import { getClientIp } from "@/lib/utils/request-ip";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("You must be signed in to resend verification emails");
    }

    const ip = getClientIp(req);
    await AuthService.resendVerification(session.user.id, ip);

    return NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
