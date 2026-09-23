import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 254, unique: true })
  email!: string;

  @Column({ name: 'password_hash', length: 100 })
  passwordHash!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
