import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, clearSessionCookie } from "@/lib/auth/session";
import { deleteAccountSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/lib/services/auth.service";
import { handleApiError, AuthenticationError } from "@/lib/errors/app-error";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required to delete account");
    }

    const body = await req.json();
    const validated = deleteAccountSchema.parse(body);

    await AuthService.deleteAccount(session.user.id, validated.password);
    await clearSessionCookie();

    return NextResponse.json({
      success: true,
      message: "Account and all associated tracking data have been permanently deleted.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

