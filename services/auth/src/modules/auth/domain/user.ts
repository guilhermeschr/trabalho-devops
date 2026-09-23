export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type NewUser = Omit<User, 'id' | 'createdAt'>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('E-mail já cadastrado');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Credenciais inválidas');
    this.name = 'InvalidCredentialsError';
  }
}
