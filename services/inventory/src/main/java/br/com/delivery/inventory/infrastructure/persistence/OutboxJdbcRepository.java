package br.com.delivery.inventory.infrastructure.persistence;

import br.com.delivery.inventory.application.ports.OutboxRepository;
import br.com.delivery.inventory.domain.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OutboxJdbcRepository implements OutboxRepository {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public OutboxJdbcRepository(@Qualifier("writeJdbc") JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  @Override
  public List<StockEvent> findPending(int limit) {
    return jdbc.query(
        "SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY occurred_at,version LIMIT"
            + " ?",
        (rs, n) -> {
          try {
            return new StockEvent(
                rs.getObject("event_id", UUID.class),
                rs.getString("event_type"),
                rs.getObject("aggregate_id", UUID.class),
                rs.getTimestamp("occurred_at").toInstant(),
                rs.getInt("version"),
                json.readValue(rs.getString("payload"), Stock.class));
          } catch (java.io.IOException e) {
            throw new IllegalStateException("Evento inválido na Outbox", e);
          }
        },
        limit);
  }

  @Override
  public void markPublished(UUID id) {
    jdbc.update("UPDATE outbox_events SET published_at=now() WHERE event_id=?", id);
  }

  @Override
  public void markFailed(UUID id, String reason) {
    jdbc.update(
        "UPDATE outbox_events SET attempts=attempts+1,last_error=? WHERE event_id=?",
        reason.substring(0, Math.min(reason.length(), 1000)),
        id);
  }
}
