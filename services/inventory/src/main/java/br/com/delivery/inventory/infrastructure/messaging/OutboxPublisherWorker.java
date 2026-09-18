package br.com.delivery.inventory.infrastructure.messaging;

import br.com.delivery.inventory.application.ports.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OutboxPublisherWorker {
  private static final Logger log = LoggerFactory.getLogger(OutboxPublisherWorker.class);
  private final OutboxRepository outbox;
  private final StockEventPublisher publisher;

  public OutboxPublisherWorker(OutboxRepository outbox, StockEventPublisher publisher) {
    this.outbox = outbox;
    this.publisher = publisher;
  }

  @Scheduled(fixedDelayString = "${inventory.outbox.delay:1000}")
  public void publishPending() {
    for (var event : outbox.findPending(50)) {
      try {
        publisher.publish(event);
        outbox.markPublished(event.eventId());
      } catch (RuntimeException e) {
        outbox.markFailed(event.eventId(), "Publicação não confirmada; aguardando nova tentativa");
        log.warn("Evento {} mantido na Outbox", event.eventId());
      }
    }
  }
}
