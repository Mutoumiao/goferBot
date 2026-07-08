import { BaseProvider, type FetchedModel } from './base.provider.js'

export class DeepSeekProvider extends BaseProvider {
  async fetchModels(): Promise<FetchedModel[]> {
    return this.defaultFetchModels()
  }
}
