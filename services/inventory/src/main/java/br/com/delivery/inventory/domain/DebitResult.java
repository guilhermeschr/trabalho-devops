package br.com.delivery.inventory.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(name = "DebitResponseDto")
public record DebitResult(
    UUID orderId, UUID productId, int debitedQuantity, int remainingQuantity) {}
