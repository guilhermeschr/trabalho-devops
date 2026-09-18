package br.com.delivery.inventory.infrastructure.persistence;

import br.com.delivery.inventory.application.ports.StockReadRepository;
import br.com.delivery.inventory.domain.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class StockReadJdbcRepository implements StockReadRepository {
  private final JdbcTemplate jdbc;

  public StockReadJdbcRepository(@Qualifier("readJdbc") JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<Stock> findById(UUID productId) {
    return jdbc
        .query(
            "SELECT * FROM stock_projection WHERE product_id=?",
            (rs, n) ->
                new Stock(
                    rs.getObject("product_id", UUID.class),
                    rs.getInt("available_quantity"),
                    rs.getTimestamp("updated_at").toInstant()),
            productId)
        .stream()
        .findFirst();
  }

  @Override
  @Transactional("readTransactionManager")
  public void project(StockEvent event) {
    event.validate();
    int inserted =
        jdbc.update(
            "INSERT INTO processed_events(event_id) VALUES(?) ON CONFLICT DO NOTHING",
            event.eventId());
    if (inserted == 0) return;
    jdbc.update(
        "INSERT INTO stock_projection(product_id,available_quantity,updated_at,version)"
            + " VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET"
            + " available_quantity=EXCLUDED.available_quantity,updated_at=EXCLUDED.updated_at,version=EXCLUDED.version"
            + " WHERE stock_projection.version < EXCLUDED.version",
        event.payload().productId(),
        event.payload().availableQuantity(),
        Timestamp.from(event.payload().updatedAt()),
        event.version());
  }
}
