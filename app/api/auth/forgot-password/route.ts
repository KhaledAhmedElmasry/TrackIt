import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/lib/services/auth.service";
import { handleApiError } from "@/lib/errors/app-error";
import { getClientIp } from "@/lib/utils/request-ip";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = forgotPasswordSchema.parse(body);

    const ip = getClientIp(req);
    const result = await AuthService.requestPasswordReset(validated.email, ip);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

