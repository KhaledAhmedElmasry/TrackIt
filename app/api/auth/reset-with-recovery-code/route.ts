import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithRecoveryCodeSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/lib/services/auth.service";
import { handleApiError } from "@/lib/errors/app-error";
import { getClientIp } from "@/lib/utils/request-ip";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resetPasswordWithRecoveryCodeSchema.parse(body);

    const ip = getClientIp(req);
    await AuthService.resetPasswordWithRecoveryCode({
      email: validated.email,
      recoveryCode: validated.recoveryCode,
      newPassword: validated.newPassword,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully using recovery code. You can now log in.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

