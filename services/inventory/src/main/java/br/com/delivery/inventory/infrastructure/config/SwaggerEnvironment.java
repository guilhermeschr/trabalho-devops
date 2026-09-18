package br.com.delivery.inventory.infrastructure.config;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.*;

/** Applies before auto-configuration, including in tests and production. */
public class SwaggerEnvironment implements EnvironmentPostProcessor, Ordered {
  @Override
  public int getOrder() {
    return Ordered.LOWEST_PRECEDENCE;
  }

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication app) {
    boolean enabled =
        "true".equalsIgnoreCase(env.getProperty("SWAGGER_ENABLED", "false"))
            && !"production".equalsIgnoreCase(env.getProperty("NODE_ENV", "development"))
            && !env.matchesProfiles("production", "prod");
    env.getPropertySources()
        .addFirst(
            new MapPropertySource(
                "inventorySwaggerPolicy",
                Map.of(
                    "springdoc.api-docs.enabled",
                    enabled,
                    "springdoc.swagger-ui.enabled",
                    enabled,
                    "inventory.swagger-enabled",
                    enabled)));
  }
}
