import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from '../../write/entities/product-write.orm-entity';

@Entity({ name: 'products_projection' })
export class ProductReadOrmEntity {
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
