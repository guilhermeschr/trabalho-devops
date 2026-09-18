package br.com.delivery.inventory.presentation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record AddStockDto(
    @NotNull @Schema(format = "uuid") UUID productId,
    @NotNull @Min(1) @Schema(minimum = "1", maximum = "2147483647", example = "20")
        Integer quantity) {}
