import { Column, Entity, PrimaryColumn } from 'typeorm';

export const numericTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};

@Entity({ name: 'products' })
export class ProductWriteOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;

  @Column({ default: true })
  active!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
