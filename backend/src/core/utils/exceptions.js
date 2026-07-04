"use strict";
// Custom exceptions to replace NestJS exceptions
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenException = exports.UnauthorizedException = exports.BadRequestException = exports.ConflictException = exports.NotFoundException = void 0;
class NotFoundException extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundException';
    }
}
exports.NotFoundException = NotFoundException;
class ConflictException extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConflictException';
    }
}
exports.ConflictException = ConflictException;
class BadRequestException extends Error {
    constructor(message) {
        super(message);
        this.name = 'BadRequestException';
    }
}
exports.BadRequestException = BadRequestException;
class UnauthorizedException extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnauthorizedException';
    }
}
exports.UnauthorizedException = UnauthorizedException;
class ForbiddenException extends Error {
    constructor(message) {
        super(message);
        this.name = 'ForbiddenException';
    }
}
exports.ForbiddenException = ForbiddenException;
