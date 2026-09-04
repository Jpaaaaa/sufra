export class NotFoundException extends Error {
  readonly status = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundException';
  }
}

export class ConflictException extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictException';
  }
}

export class BadRequestException extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestException';
  }
}

export class UnauthorizedException extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenException';
  }
}

export class ServiceUnavailableException extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableException';
  }
}
