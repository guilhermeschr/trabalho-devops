package br.com.delivery.inventory.infrastructure.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

@Configuration
public class RabbitConfig {
  @Bean
  CachingConnectionFactory rabbitConnectionFactory(@Value("${inventory.rabbitmq.url}") String url)
      throws Exception {
    var nativeFactory = new com.rabbitmq.client.ConnectionFactory();
    nativeFactory.setUri(url);
    nativeFactory.setAutomaticRecoveryEnabled(false); // Spring AMQP manages reconnections.
    var factory = new CachingConnectionFactory(nativeFactory);
    factory.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);
    factory.setPublisherReturns(true);
    return factory;
  }

  @Bean
  RabbitTemplate rabbitTemplate(CachingConnectionFactory factory) {
    var template = new RabbitTemplate(factory);
    template.setMandatory(true);
    return template;
  }

  @Bean
  TopicExchange inventoryExchange(@Value("${inventory.rabbitmq.exchange}") String name) {
    return new TopicExchange(name, true, false);
  }

  @Bean
  Queue inventoryQueue(@Value("${inventory.rabbitmq.queue}") String name) {
    return new Queue(name, true);
  }

  @Bean
  Binding inventoryBinding(Queue inventoryQueue, TopicExchange inventoryExchange) {
    return BindingBuilder.bind(inventoryQueue).to(inventoryExchange).with("inventory.*");
  }
}
