import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestContext } from './utils/request-context.js'

export class RequestContextStorage {
  private static readonly storage = new AsyncLocalStorage<RequestContext>()

  static get(): RequestContext | undefined {
    return RequestContextStorage.storage.getStore()
  }

  static run<T>(context: RequestContext, fn: () => T): T {
    return RequestContextStorage.storage.run(context, fn)
  }
}

export function getRequestContext(): RequestContext | undefined {
  return RequestContextStorage.get()
}
