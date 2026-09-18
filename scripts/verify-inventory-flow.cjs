// Run inside inventory-service: docker compose ... exec -T inventory-service node < scripts/verify-inventory-flow.cjs
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { JwtService } = require('@nestjs/jwt');
const { Client } = require('pg');
const amqp = require('amqplib');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const jwt = new JwtService().sign(
    { sub: randomUUID() },
    { secret: process.env.JWT_SECRET, expiresIn: '5m' },
  );
  const productId = randomUUID();
  async function api(path, body, internal = false, authorized = true) {
    const response = await fetch(
      (internal ? 'http://localhost:3000' : 'http://nginx-gateway') + path,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authorized
            ? internal
              ? { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
              : { Authorization: 'Bearer ' + jwt }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const text = await response.text();
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
    return { status: response.status, body: value };
  }
  assert.equal(
    (await api('/api/v1/inventory', { productId, quantity: 20 }, false, false))
      .status,
    401,
  );
  assert.equal(
    (await api('/api/v1/inventory', { productId, quantity: 0 })).status,
    400,
  );
  const addition = await api('/api/v1/inventory', { productId, quantity: 20 });
  assert.equal(addition.status, 200);
  assert.equal(addition.body.availableQuantity, 20);
  assert.equal(
    (
      await api('/internal/v1/inventory/debit', {
        productId,
        orderId: randomUUID(),
        quantity: 1,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await api(
        '/internal/v1/inventory/debit',
        { productId, orderId: randomUUID(), quantity: 1 },
        true,
        false,
      )
    ).status,
    403,
  );
  const orderId = randomUUID();
  const retries = await Promise.all(
    Array.from({ length: 10 }, () =>
      api(
        '/internal/v1/inventory/debit',
        { productId, orderId, quantity: 2 },
        true,
      ),
    ),
  );
  for (const result of retries) {
    assert.equal(result.status, 200);
    assert.equal(result.body.remainingQuantity, 18);
  }
  assert.equal(
    (
      await api(
        '/internal/v1/inventory/debit',
        { productId, orderId, quantity: 3 },
        true,
      )
    ).body.code,
    'IDEMPOTENCY_CONFLICT',
  );
  const debits = await Promise.all(
    Array.from({ length: 10 }, () =>
      api(
        '/internal/v1/inventory/debit',
        { productId, orderId: randomUUID(), quantity: 3 },
        true,
      ),
    ),
  );
  assert.equal(debits.filter((r) => r.status === 200).length, 6);
  assert.equal(debits.filter((r) => r.status === 409).length, 4);
  async function projected(quantity) {
    for (let i = 0; i < 60; i++) {
      const result = await api('/api/v1/inventory/' + productId);
      if (result.status === 200 && result.body.availableQuantity === quantity)
        return;
      await pause(250);
    }
    throw new Error('Projeção de estoque não convergiu para ' + quantity);
  }
  await projected(0);
  const db = new Client({
    host: process.env.INVENTORY_WRITE_DB_HOST,
    user: process.env.INVENTORY_WRITE_DB_USER,
    password: process.env.INVENTORY_WRITE_DB_PASSWORD,
    database: process.env.INVENTORY_WRITE_DB_NAME,
  });
  await db.connect();
  const movements = await db.query(
    'SELECT * FROM stock_movements WHERE product_id=$1',
    [productId],
  );
  assert.equal(movements.rows.length, 8);
  const events = await db.query(
    'SELECT * FROM outbox_events WHERE aggregate_id=$1 ORDER BY version',
    [productId],
  );
  assert.equal(events.rows.length, 8);
  // Replay an older event with a new ID: version guard must prevent rollback of the projection.
  const old = events.rows[0];
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createConfirmChannel();
  channel.publish(
    process.env.RABBITMQ_EXCHANGE || 'delivery.events',
    'inventory.stock_added',
    Buffer.from(
      JSON.stringify({
        eventId: randomUUID(),
        eventType: old.event_type,
        aggregateId: productId,
        occurredAt: old.occurred_at,
        version: old.version,
        payload: old.payload,
      }),
    ),
    { persistent: true },
  );
  await channel.waitForConfirms();
  await pause(500);
  await projected(0);
  await channel.close();
  await connection.close();
  await db.end();
  console.log(
    'Fluxo validado: JWT, validação, token interno, gateway, débito concorrente idempotente, estoque não negativo, movimentações, Outbox e projeção versionada.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
