package br.com.delivery.inventory.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(name = "StockResponseDto")
public record Stock(UUID productId, int availableQuantity, Instant updatedAt) {}
