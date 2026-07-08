import { AppException } from '../../lib/app-error.js'

export function providerNotFoundError(id: string): AppException {
  return new AppException('MODEL_PROVIDER_NOT_FOUND', `模型提供商不存在：${id}`, 404)
}

export function modelNotEnabledError(providerId: string, modelName: string): AppException {
  return new AppException(
    'MODEL_NOT_ENABLED',
    `模型 ${modelName} 在提供商 ${providerId} 中未启用`,
    400,
  )
}

export function fetchModelsNotSupportedError(): AppException {
  return new AppException(
    'FETCH_MODELS_NOT_SUPPORTED',
    '自定义供应商不支持自动获取模型列表',
    400,
  )
}

export function unknownPresetError(presetKey: string): AppException {
  return new AppException('UNKNOWN_PRESET', `未知预设供应商：${presetKey}`, 400)
}
