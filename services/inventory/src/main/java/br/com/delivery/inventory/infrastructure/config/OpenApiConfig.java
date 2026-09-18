package br.com.delivery.inventory.infrastructure.config;

import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.*;

@Configuration
public class OpenApiConfig {
  @Bean
  OpenAPI inventoryOpenApi() {
    return new OpenAPI()
        .info(new Info().title("Delivery - Microsserviço de Estoque").version("2.0.0"))
        .addServersItem(new Server().url("/"))
        .components(
            new Components()
                .addSecuritySchemes(
                    "jwt",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
  }
}
