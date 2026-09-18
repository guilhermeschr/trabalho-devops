package br.com.delivery.inventory.presentation;

import br.com.delivery.inventory.presentation.dto.HealthResponseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@Tag(name = "Infraestrutura")
public class HealthController {
  @GetMapping("/health")
  @Operation(summary = "Verificar disponibilidade do serviço")
  public HealthResponseDto health() {
    return new HealthResponseDto("ok", "inventory-service", Instant.now());
  }
}
