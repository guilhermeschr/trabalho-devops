package br.com.delivery.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import br.com.delivery.inventory.application.ports.*;
import br.com.delivery.inventory.domain.*;
import br.com.delivery.inventory.infrastructure.messaging.*;
import com.fasterxml.jackson.databind.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

class MessagingTest {
  final ObjectMapper json =
      new ObjectMapper()
          .findAndRegisterModules()
          .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

  StockEvent event() {
    UUID id = UUID.randomUUID();
    return new StockEvent(
        UUID.randomUUID(),
        "inventory.stock_added",
        id,
        Instant.now(),
        1,
        new Stock(id, 20, Instant.now()));
  }

  @Test
  void confirmsPersistentJsonBeforeMarkingPublished() throws Exception {
    var rabbit = mock(RabbitTemplate.class);
    var event = event();
    doAnswer(
            invocation -> {
              Message message = invocation.getArgument(2);
              CorrelationData correlation = invocation.getArgument(3);
              assertEquals(
                  MessageDeliveryMode.PERSISTENT, message.getMessageProperties().getDeliveryMode());
              assertEquals(event, json.readValue(message.getBody(), StockEvent.class));
              correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
              return null;
            })
        .when(rabbit)
        .send(
            eq("delivery.events"),
            eq(event.eventType()),
            any(Message.class),
            any(CorrelationData.class));
    new RabbitStockEventPublisher(rabbit, json, "delivery.events").publish(event);
  }

  @Test
  void rejectsNackAndReturnedMessages() {
    for (boolean returned : List.of(false, true)) {
      var rabbit = mock(RabbitTemplate.class);
      doAnswer(
              invocation -> {
                CorrelationData correlation = invocation.getArgument(3);
                if (returned)
                  correlation.setReturned(
                      new ReturnedMessage(
                          invocation.getArgument(2),
                          312,
                          "NO_ROUTE",
                          "delivery.events",
                          "inventory.stock_added"));
                correlation.getFuture().complete(new CorrelationData.Confirm(returned, "rejected"));
                return null;
              })
          .when(rabbit)
          .send(anyString(), anyString(), any(Message.class), any(CorrelationData.class));
      assertThrows(
          IllegalStateException.class,
          () -> new RabbitStockEventPublisher(rabbit, json, "delivery.events").publish(event()));
    }
  }

  @Test
  void outboxRetainsFailureAndContinuesWithNextEvent() {
    var outbox = mock(OutboxRepository.class);
    var publisher = mock(StockEventPublisher.class);
    var first = event();
    var second = event();
    when(outbox.findPending(50)).thenReturn(List.of(first, second));
    doThrow(new IllegalStateException("offline")).when(publisher).publish(first);
    new OutboxPublisherWorker(outbox, publisher).publishPending();
    verify(outbox).markFailed(eq(first.eventId()), anyString());
    verify(outbox, never()).markPublished(first.eventId());
    verify(outbox).markPublished(second.eventId());
  }

  @Test
  void consumerRejectsMalformedMessagesAndPropagatesDatabaseFailure() throws Exception {
    var repository = mock(StockReadRepository.class);
    var consumer = new StockReadProjectorConsumer(json, repository);
    var event = event();
    var message = new Message(json.writeValueAsBytes(event));
    consumer.receive(message);
    verify(repository).project(event);
    doThrow(new IllegalStateException("database unavailable")).when(repository).project(event);
    assertThrows(IllegalStateException.class, () -> consumer.receive(message));
    for (String raw : List.of("{", "null", "{}"))
      assertThrows(
          AmqpRejectAndDontRequeueException.class,
          () -> consumer.receive(new Message(raw.getBytes())));
  }
}
