import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saveKeySchema, deleteKeySchema } from "@/lib/validations/auth.schema";
import { KeyService } from "@/lib/services/key.service";
import { handleApiError, AuthenticationError } from "@/lib/errors/app-error";

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    const summary = await KeyService.getKeySummary(session.user.id);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    const body = await req.json();
    const validated = saveKeySchema.parse(body);

    const result = await KeyService.saveKey(session.user.id, validated.keyType, validated.key);

    return NextResponse.json({
      success: true,
      message: `${validated.keyType.toUpperCase()} key securely encrypted and saved.`,
      data: {
        lastFour: result.lastFour,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    const body = await req.json();
    const validated = deleteKeySchema.parse(body);

    await KeyService.deleteKey(session.user.id, validated.keyType);

    return NextResponse.json({
      success: true,
      message: `${validated.keyType.toUpperCase()} key deleted successfully.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
