import { NextRequest, NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/lib/services/auth.service";
import { handleApiError } from "@/lib/errors/app-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = verifyEmailSchema.parse(body);

    const result = await AuthService.verifyEmail(validated.token);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      data: { email: result.email },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

