import { Injectable } from '@nestjs/common'

export interface ModelInfo {
  providerKey: string
  providerName: string
  baseUrl: string
}

export interface ModelRegistration {
  id: string
  providerKey: string
  providerName: string
  baseUrl: string
}

@Injectable()
export class ModelRegistryService {
  private models = new Map<string, ModelInfo>()

  register(models: ModelRegistration[]): void {
    for (const m of models) {
      this.models.set(m.id, {
        providerKey: m.providerKey,
        providerName: m.providerName,
        baseUrl: m.baseUrl,
      })
    }
  }

  lookup(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId)
  }

  list(): Array<{ key: string; name: string; model: string; isBuiltin: boolean }> {
    return Array.from(this.models.entries()).map(([id, info]) => ({
      key: id,
      name: info.providerName,
      model: id,
      isBuiltin: true,
    }))
  }
}
