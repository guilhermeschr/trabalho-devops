package br.com.delivery.inventory.infrastructure.messaging;

import br.com.delivery.inventory.application.ports.StockEventPublisher;
import br.com.delivery.inventory.domain.StockEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.TimeUnit;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RabbitStockEventPublisher implements StockEventPublisher {
  private final RabbitTemplate rabbit;
  private final ObjectMapper json;
  private final String exchange;

  public RabbitStockEventPublisher(
      RabbitTemplate rabbit,
      ObjectMapper json,
      @Value("${inventory.rabbitmq.exchange}") String exchange) {
    this.rabbit = rabbit;
    this.json = json;
    this.exchange = exchange;
  }

  @Override
  public void publish(StockEvent event) {
    try {
      var properties = new MessageProperties();
      properties.setContentType(MessageProperties.CONTENT_TYPE_JSON);
      properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
      var correlation = new CorrelationData(event.eventId().toString());
      rabbit.send(
          exchange,
          event.eventType(),
          new Message(json.writeValueAsBytes(event), properties),
          correlation);
      var confirm = correlation.getFuture().get(5, TimeUnit.SECONDS);
      if (!confirm.isAck() || correlation.getReturned() != null)
        throw new IllegalStateException("Evento não confirmado ou sem fila de destino");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Publicação interrompida", e);
    } catch (Exception e) {
      throw new IllegalStateException("Falha na publicação do evento", e);
    }
  }
}
