package br.com.delivery.inventory.presentation;

import br.com.delivery.inventory.application.usecase.DebitStockUseCase;
import br.com.delivery.inventory.domain.DebitResult;
import br.com.delivery.inventory.presentation.dto.*;
import io.swagger.v3.oas.annotations.*;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/internal/v1/inventory")
@Tag(name = "Estoque interno")
public class InternalInventoryController {
  private final DebitStockUseCase debitStock;

  public InternalInventoryController(DebitStockUseCase debitStock) {
    this.debitStock = debitStock;
  }

  @PostMapping("/debit")
  @Operation(summary = "Debitar estoque de forma idempotente por pedido")
  @Parameter(
      name = "X-Internal-Token",
      in = ParameterIn.HEADER,
      required = true,
      description = "Token compartilhado entre serviços")
  @ApiResponses({
    @ApiResponse(
        responseCode = "200",
        description = "Débito realizado ou repetido",
        content = @Content(schema = @Schema(implementation = DebitResult.class))),
    @ApiResponse(
        responseCode = "400",
        description = "Dados inválidos",
        content = @Content(schema = @Schema(implementation = ErrorResponseDto.class))),
    @ApiResponse(
        responseCode = "403",
        description = "Token interno inválido",
        content = @Content(schema = @Schema(implementation = ErrorResponseDto.class))),
    @ApiResponse(
        responseCode = "409",
        description = "Estoque insuficiente ou pedido reutilizado",
        content = @Content(schema = @Schema(implementation = ErrorResponseDto.class))),
    @ApiResponse(
        responseCode = "500",
        description = "Erro interno",
        content = @Content(schema = @Schema(implementation = ErrorResponseDto.class)))
  })
  public DebitResult debit(@Valid @RequestBody DebitStockDto input) {
    return debitStock.execute(input.orderId(), input.productId(), input.quantity());
  }
}
