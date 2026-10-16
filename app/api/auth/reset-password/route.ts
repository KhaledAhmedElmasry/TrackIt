import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithTokenSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/lib/services/auth.service";
import { handleApiError } from "@/lib/errors/app-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resetPasswordWithTokenSchema.parse(body);

    await AuthService.resetPasswordWithToken(validated.token, validated.newPassword);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
