import { NotFoundException, ConflictException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { User, CreateUserDto, UpdateUserDto } from './user.entity';
import * as bcrypt from 'bcrypt';

class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Omit<User, 'password_hash'>[]> {
    const rows = await this.db.all(
      'SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users ORDER BY created_at DESC',
    );
    return rows.map((row: any) => ({
      ...row,
      require_captain_approval: row.role === 'customer' ? Boolean(row.require_captain_approval) : false,
      customer_free_order: row.role === 'customer' ? Boolean(row.customer_free_order) : false,
    })) as Omit<User, 'password_hash'>[];
  }

  async findOne(id: number): Promise<Omit<User, 'password_hash'>> {
    const row = await this.db.get(
      'SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return {
      ...row,
      require_captain_approval: row.role === 'customer' ? Boolean(row.require_captain_approval) : false,
      customer_free_order: row.role === 'customer' ? Boolean(row.customer_free_order) : false,
    } as Omit<User, 'password_hash'>;
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.db.get(
      'SELECT id, username, password_hash, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE username = ?',
      [username],
    );
    if (!row) {
      return null;
    }
    return {
      ...row,
      require_captain_approval: Boolean(row.require_captain_approval),
      customer_free_order: Boolean(row.customer_free_order),
    } as User;
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'password_hash'>> {
    const existing = await this.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const isCustomer = dto.role === 'customer';
    const require_captain_approval = isCustomer && dto.customer_free_order ? 0 : (isCustomer && dto.require_captain_approval ? 1 : 0);
    const customer_free_order = isCustomer && dto.customer_free_order ? 1 : 0;

    await this.db.run(
      'INSERT INTO users (username, password_hash, role, require_captain_approval, customer_free_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
      [dto.username, password_hash, dto.role, require_captain_approval, customer_free_order],
    );
    const row = await this.db.get(
      'SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE username = ? ORDER BY id DESC LIMIT 1',
      [dto.username],
    );
    if (!row) {
      throw new Error('Failed to retrieve created user');
    }
    return {
      ...row,
      require_captain_approval: Boolean(row.require_captain_approval),
      customer_free_order: Boolean(row.customer_free_order),
    } as Omit<User, 'password_hash'>;
  }

  async update(id: number, dto: UpdateUserDto): Promise<Omit<User, 'password_hash'>> {
    const existing = await this.findOne(id);

    if (dto.username && dto.username !== existing.username) {
      const usernameExists = await this.findByUsername(dto.username);
      if (usernameExists) {
        throw new ConflictException('Username already exists');
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (dto.username) {
      updates.push('username = ?');
      values.push(dto.username);
    }

    if (dto.password) {
      const password_hash = await bcrypt.hash(dto.password, 10);
      updates.push('password_hash = ?');
      values.push(password_hash);
    }

    if (dto.role) {
      updates.push('role = ?');
      values.push(dto.role);
    }

    const newRole = dto.role || existing.role;
    const isCustomer = newRole === 'customer';

    if (isCustomer) {
      const currentRequire = dto.require_captain_approval !== undefined
        ? dto.require_captain_approval
        : (existing.role === 'customer' ? existing.require_captain_approval : false);
      const currentFree = dto.customer_free_order !== undefined
        ? dto.customer_free_order
        : (existing.role === 'customer' ? existing.customer_free_order : false);

      const finalRequire = currentFree ? false : currentRequire;
      const finalFree = currentFree;

      updates.push('require_captain_approval = ?');
      values.push(finalRequire ? 1 : 0);
      updates.push('customer_free_order = ?');
      values.push(finalFree ? 1 : 0);
    } else {
      updates.push('require_captain_approval = ?');
      values.push(0);
      updates.push('customer_free_order = ?');
      values.push(0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = datetime("now")');
    values.push(id);

    await this.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await this.db.get(
      'SELECT id, username, role, require_captain_approval, customer_free_order, created_at, updated_at FROM users WHERE id = ?',
      [id],
    );
    if (!row) {
      throw new NotFoundException('User not found after update');
    }
    return {
      ...row,
      require_captain_approval: Boolean(row.require_captain_approval),
      customer_free_order: Boolean(row.customer_free_order),
    } as Omit<User, 'password_hash'>;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.run('DELETE FROM users WHERE id = ?', [id]);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }
}

let usersInstance: UsersService | null = null;

export function initializeUsers(db: DatabaseService): void {
  usersInstance = new UsersService(db);
}

export function requireUsers(): UsersService {
  if (!usersInstance) {
    throw new Error('Users not initialized');
  }
  return usersInstance;
}

export function findAll(): ReturnType<UsersService['findAll']> {
  return requireUsers().findAll();
}

export function findOne(
  ...args: Parameters<UsersService['findOne']>
): ReturnType<UsersService['findOne']> {
  return requireUsers().findOne(...args);
}

export function findByUsername(
  ...args: Parameters<UsersService['findByUsername']>
): ReturnType<UsersService['findByUsername']> {
  return requireUsers().findByUsername(...args);
}

export function create(
  ...args: Parameters<UsersService['create']>
): ReturnType<UsersService['create']> {
  return requireUsers().create(...args);
}

export function update(
  ...args: Parameters<UsersService['update']>
): ReturnType<UsersService['update']> {
  return requireUsers().update(...args);
}

export function remove(
  ...args: Parameters<UsersService['remove']>
): ReturnType<UsersService['remove']> {
  return requireUsers().remove(...args);
}

export function validatePassword(
  ...args: Parameters<UsersService['validatePassword']>
): ReturnType<UsersService['validatePassword']> {
  return requireUsers().validatePassword(...args);
}
