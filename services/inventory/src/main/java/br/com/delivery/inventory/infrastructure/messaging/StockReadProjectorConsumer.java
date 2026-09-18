package br.com.delivery.inventory.infrastructure.messaging;

import br.com.delivery.inventory.application.ports.StockReadRepository;
import br.com.delivery.inventory.domain.StockEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class StockReadProjectorConsumer {
  private final ObjectMapper json;
  private final StockReadRepository repository;

  public StockReadProjectorConsumer(ObjectMapper json, StockReadRepository repository) {
    this.json = json;
    this.repository = repository;
  }

  @RabbitListener(queues = "${inventory.rabbitmq.queue}")
  public void receive(Message message) {
    StockEvent event;
    try {
      event = json.readValue(message.getBody(), StockEvent.class);
      event.validate();
    } catch (IOException | IllegalArgumentException | NullPointerException e) {
      throw new AmqpRejectAndDontRequeueException("Evento de estoque inválido", e);
    }
    // AUTO acknowledgement happens only after the transactional projection returns.
    repository.project(event);
  }
}
