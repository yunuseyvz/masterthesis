export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(404, `${what} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class OutOfStockError extends AppError {
  constructor(sku: string, requested: number, available: number) {
    super(409, `not enough stock for ${sku}: requested ${requested}, available ${available}`);
  }
}
