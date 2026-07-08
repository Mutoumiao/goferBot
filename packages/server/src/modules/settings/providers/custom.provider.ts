import { BaseProvider, type FetchedModel } from './base.provider.js'
import { fetchModelsNotSupportedError } from '../errors.js'

export class CustomProvider extends BaseProvider {
  async fetchModels(): Promise<FetchedModel[]> {
    throw fetchModelsNotSupportedError()
  }
}
