package br.com.delivery.inventory.presentation;

import br.com.delivery.inventory.application.usecase.*;
import br.com.delivery.inventory.domain.Stock;
import br.com.delivery.inventory.presentation.dto.*;
import io.swagger.v3.oas.annotations.*;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.*;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/inventory")
@Tag(name = "Estoque")
@SecurityRequirement(name = "jwt")
@ApiResponses({
  @ApiResponse(
      responseCode = "400",
      description = "Dados inválidos",
      content = @Content(schema = @Schema(implementation = ErrorResponseDto.class))),
  @ApiResponse(
      responseCode = "401",
      description = "JWT ausente ou inválido",
      content = @Content(schema = @Schema(implementation = ErrorResponseDto.class))),
  @ApiResponse(
      responseCode = "500",
      description = "Erro interno",
      content = @Content(schema = @Schema(implementation = ErrorResponseDto.class)))
})
public class InventoryController {
  private final AddStockUseCase addStock;
  private final GetStockUseCase getStock;

  public InventoryController(AddStockUseCase addStock, GetStockUseCase getStock) {
    this.addStock = addStock;
    this.getStock = getStock;
  }

  @PostMapping
  @Operation(summary = "Criar ou adicionar estoque")
  @ApiResponses({
    @ApiResponse(
        responseCode = "200",
        description = "Estoque atualizado",
        content = @Content(schema = @Schema(implementation = Stock.class))),
    @ApiResponse(
        responseCode = "409",
        description = "Limite de estoque excedido",
        content = @Content(schema = @Schema(implementation = ErrorResponseDto.class)))
  })
  public Stock add(@Valid @RequestBody AddStockDto input) {
    return addStock.execute(input.productId(), input.quantity());
  }

  @GetMapping("/{productId}")
  @Operation(summary = "Consultar projeção de estoque")
  @ApiResponses({
    @ApiResponse(
        responseCode = "200",
        description = "Saldo disponível",
        content = @Content(schema = @Schema(implementation = Stock.class))),
    @ApiResponse(
        responseCode = "404",
        description = "Estoque não encontrado",
        content = @Content(schema = @Schema(implementation = ErrorResponseDto.class)))
  })
  public Stock get(
      @Parameter(required = true, schema = @Schema(type = "string", format = "uuid"))
          @PathVariable
          @Pattern(regexp = "(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
          String productId) {
    return getStock.execute(UUID.fromString(productId));
  }
}
