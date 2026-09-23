import { Column, Entity, Index, PrimaryColumn, ValueTransformer } from 'typeorm';
import { OrderStatus } from '../../../domain/order';

/** O driver pg devolve numeric como string; o domínio usa number. */
export const numericTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'orders' })
export class OrderOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_orders_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice!: number;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 2,
    transformer: numericTransformer,
  })
  total!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: OrderStatus;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
