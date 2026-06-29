export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} ID ${id} 不存在`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class StorageError extends RepositoryError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'StorageError'
  }
}

export class VectorStoreError extends RepositoryError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'VectorStoreError'
  }
}

export class AuthError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
