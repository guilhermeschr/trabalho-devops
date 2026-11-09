import { AppModule } from './app.module';
import { OrdersModule } from './modules/orders/orders.module';
import { OperationsModule } from './operations/operations.module';

describe('módulo raiz de Pedidos', () => {
  it('registra /api/v1/orders/version antes de /api/v1/orders/:id', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', AppModule);

    expect(imports.indexOf(OperationsModule)).toBeGreaterThanOrEqual(0);
    expect(imports.indexOf(OperationsModule)).toBeLessThan(
      imports.indexOf(OrdersModule),
    );
  });
});
