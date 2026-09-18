package br.com.delivery.inventory.presentation.dto;

import java.time.Instant;

public record HealthResponseDto(String status, String service, Instant timestamp) {}
