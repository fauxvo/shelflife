import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import {
  getAllServiceConfigs,
  setServiceConfig,
  clearServiceConfig,
  getActiveRequestProvider,
  setActiveRequestProvider,
  getActiveStatsProvider,
  setActiveStatsProvider,
  maskApiKey,
  type ServiceType,
} from "@/lib/services/service-config";
import { settingsUpdateSchema } from "@/lib/validators/schemas";

export async function GET() {
  try {
    await requireAdmin();

    const configs = await getAllServiceConfigs();
    const activeProvider = await getActiveRequestProvider();
    const activeStatsProvider = await getActiveStatsProvider();

    // Mask API keys in response
    const masked: Record<string, { url: string; apiKey: string } | null> = {};
    for (const [type, config] of Object.entries(configs)) {
      masked[type] = config ? { url: config.url, apiKey: maskApiKey(config.apiKey) } : null;
    }

    return NextResponse.json({ services: masked, activeProvider, activeStatsProvider });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { services, activeProvider, activeStatsProvider } = parsed.data;

    // Save service configs
    if (services) {
      for (const [type, config] of Object.entries(services)) {
        const serviceType = type as ServiceType;
        if (config === null) {
          await clearServiceConfig(serviceType);
        } else {
          await setServiceConfig(serviceType, config);
        }
      }
    }

    // Save active provider
    if (activeProvider) {
      await setActiveRequestProvider(activeProvider);
    }

    // Save active stats provider
    if (activeStatsProvider) {
      await setActiveStatsProvider(activeStatsProvider);
    }

    // Return updated state
    const configs = await getAllServiceConfigs();
    const currentProvider = await getActiveRequestProvider();
    const currentStatsProvider = await getActiveStatsProvider();
    const masked: Record<string, { url: string; apiKey: string } | null> = {};
    for (const [type, config] of Object.entries(configs)) {
      masked[type] = config ? { url: config.url, apiKey: maskApiKey(config.apiKey) } : null;
    }

    return NextResponse.json({
      services: masked,
      activeProvider: currentProvider,
      activeStatsProvider: currentStatsProvider,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
