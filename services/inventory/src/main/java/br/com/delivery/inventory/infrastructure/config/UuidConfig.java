package br.com.delivery.inventory.infrastructure.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;
import java.util.UUID;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.*;

@Configuration
public class UuidConfig {
  public static UUID parse(String value) {
    if (!value.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
      throw new IllegalArgumentException("UUID inválido");
    return UUID.fromString(value);
  }

  @Bean
  Jackson2ObjectMapperBuilderCustomizer strictUuids() {
    return builder ->
        builder.deserializerByType(
            UUID.class,
            new JsonDeserializer<UUID>() {
              @Override
              public UUID deserialize(JsonParser parser, DeserializationContext context)
                  throws IOException {
                String value = parser.getValueAsString();
                if (parser.currentToken() != JsonToken.VALUE_STRING || value == null)
                  throw context.weirdStringException(value, UUID.class, "UUID inválido");
                try {
                  return parse(value);
                } catch (IllegalArgumentException error) {
                  throw context.weirdStringException(value, UUID.class, "UUID inválido");
                }
              }
            });
  }
}
