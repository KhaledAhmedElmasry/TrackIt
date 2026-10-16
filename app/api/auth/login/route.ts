import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/lib/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session";
import { handleApiError } from "@/lib/errors/app-error";
import { getClientIp } from "@/lib/utils/request-ip";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await AuthService.login({
      email: validated.email,
      password: validated.password,
      ip,
      userAgent,
    });

    await setSessionCookie(result.sessionToken);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: result.userId,
          email: result.email,
          isVerified: result.isVerified,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
